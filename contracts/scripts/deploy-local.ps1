# Seed Finance - Local Deployment Script for Windows
#
# Usage:
#   # Terminal 1: Start Anvil (from contracts directory)
#   anvil --host 0.0.0.0 --accounts 15 --balance 10000 --state state.json
#
#   # Terminal 2: Run this script (from contracts directory)
#   .\scripts\deploy-local.ps1
#
# Options:
#   -Extensive    Run the extensive multi-party workflow test (20 invoices)
#   -UpdateEnv    Update frontend/.env.local with new addresses
#
# Examples:
#   .\scripts\deploy-local.ps1                      # Basic deployment only
#   .\scripts\deploy-local.ps1 -Extensive           # Run extensive test
#   .\scripts\deploy-local.ps1 -Extensive -UpdateEnv # Run test and update .env

param(
    [switch]$Extensive,
    [switch]$UpdateEnv
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Header { param($msg) Write-Host "`n========================================" -ForegroundColor Cyan; Write-Host "  $msg" -ForegroundColor Cyan; Write-Host "========================================" -ForegroundColor Cyan }
function Write-Step { param($msg) Write-Host "[*] $msg" -ForegroundColor Yellow }
function Write-Success { param($msg) Write-Host "[+] $msg" -ForegroundColor Green }
function Write-Error { param($msg) Write-Host "[!] $msg" -ForegroundColor Red }

# Check we're in the contracts directory
if (-not (Test-Path "foundry.toml")) {
    Write-Error "Please run this script from the contracts directory"
    Write-Host "  cd contracts" -ForegroundColor Gray
    Write-Host "  .\scripts\deploy-local.ps1" -ForegroundColor Gray
    exit 1
}

# Check Anvil is running
Write-Step "Checking Anvil connection..."
try {
    $blockNumber = cast block-number --rpc-url http://localhost:8545 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Failed to connect" }
    Write-Success "Anvil connected (block: $blockNumber)"
} catch {
    Write-Error "Anvil is not running. Start it first:"
    Write-Host "  anvil --host 0.0.0.0 --accounts 15 --balance 10000 --state state.json" -ForegroundColor Gray
    exit 1
}

# Anvil Account #0 private key
$DEPLOYER_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

Write-Header "Seed Finance Local Deployment"

if ($Extensive) {
    Write-Step "Running EXTENSIVE workflow test (20 invoices, 5 suppliers, 5 buyers)..."
    Write-Host ""

    forge script script/TestWorkflowExtensive.s.sol:TestWorkflowExtensive `
        --rpc-url http://localhost:8545 `
        --broadcast

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Extensive workflow test failed"
        exit 1
    }

    # Extract addresses from broadcast file
    $broadcastFile = "broadcast\TestWorkflowExtensive.s.sol\31337\run-latest.json"
} else {
    Write-Step "Running basic deployment..."
    Write-Host ""

    forge script script/DeployLocal.s.sol:DeployLocal `
        --rpc-url http://localhost:8545 `
        --broadcast `
        --private-key $DEPLOYER_PK

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Deployment failed"
        exit 1
    }

    $broadcastFile = "broadcast\DeployLocal.s.sol\31337\run-latest.json"
}

Write-Success "Deployment completed!"

# Parse addresses from broadcast
if (Test-Path $broadcastFile) {
    Write-Step "Extracting contract addresses..."

    $broadcast = Get-Content $broadcastFile | ConvertFrom-Json

    $addresses = @{}
    foreach ($tx in $broadcast.transactions) {
        if ($tx.contractName -and $tx.contractAddress) {
            $addresses[$tx.contractName] = $tx.contractAddress
        }
    }

    Write-Host ""
    Write-Host "Contract Addresses:" -ForegroundColor Cyan
    Write-Host "  USDC:           $($addresses['MockUSDC'])" -ForegroundColor White
    Write-Host "  LiquidityPool:  $($addresses['LiquidityPool'])" -ForegroundColor White
    Write-Host "  InvoiceDiamond: $($addresses['InvoiceDiamond'])" -ForegroundColor White
    Write-Host "  ExecutionPool:  $($addresses['ExecutionPool'])" -ForegroundColor White

    # Update .env.local if requested
    if ($UpdateEnv) {
        $envFile = "..\frontend\.env.local"

        if (Test-Path $envFile) {
            Write-Step "Updating frontend/.env.local..."

            $envContent = Get-Content $envFile -Raw

            # Update addresses
            if ($addresses['MockUSDC']) {
                $envContent = $envContent -replace 'NEXT_PUBLIC_USDC_ADDRESS=.*', "NEXT_PUBLIC_USDC_ADDRESS=$($addresses['MockUSDC'])"
            }
            if ($addresses['LiquidityPool']) {
                $envContent = $envContent -replace 'NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS=.*', "NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS=$($addresses['LiquidityPool'])"
            }
            if ($addresses['InvoiceDiamond']) {
                $envContent = $envContent -replace 'NEXT_PUBLIC_INVOICE_DIAMOND_ADDRESS=.*', "NEXT_PUBLIC_INVOICE_DIAMOND_ADDRESS=$($addresses['InvoiceDiamond'])"
            }
            if ($addresses['ExecutionPool']) {
                $envContent = $envContent -replace 'NEXT_PUBLIC_EXECUTION_POOL_ADDRESS=.*', "NEXT_PUBLIC_EXECUTION_POOL_ADDRESS=$($addresses['ExecutionPool'])"
            }

            Set-Content $envFile $envContent
            Write-Success "Updated frontend/.env.local"
            Write-Host "  Restart frontend: cd ..\frontend && npm run dev" -ForegroundColor Gray
        } else {
            Write-Error "frontend/.env.local not found"
        }
    } else {
        Write-Host ""
        Write-Host "To update frontend/.env.local, run with -UpdateEnv flag:" -ForegroundColor Gray
        Write-Host "  .\scripts\deploy-local.ps1 -UpdateEnv" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Header "Deployment Summary"

Write-Host ""
Write-Host "Test Accounts:" -ForegroundColor Cyan
Write-Host "  Deployer/Admin: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" -ForegroundColor White
Write-Host "  Financier/LP:   0x70997970C51812dc3A010C7d01b50e0d17dc79C8" -ForegroundColor White
Write-Host "  Supplier:       0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" -ForegroundColor White
Write-Host "  Buyer:          0x90F79bf6EB2c4f870365E785982E1f101E93b906" -ForegroundColor White

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Update frontend/.env.local with addresses above (or use -UpdateEnv)" -ForegroundColor Gray
Write-Host "  2. Restart frontend: cd ..\frontend && npm run dev" -ForegroundColor Gray
Write-Host "  3. Connect wallet 0xf39... to access operator dashboard" -ForegroundColor Gray
Write-Host ""
