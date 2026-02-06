# Seed Finance - Arc Testnet Deployment Script
# Prerequisites:
#   - Foundry installed (forge)
#   - Environment variables set (see below)
#   - Testnet USDC from https://faucet.circle.com

param(
    [switch]$DryRun,
    [switch]$Verify
)

$ErrorActionPreference = "Stop"

# ===== Check required environment variables =====
if (-not $env:ARC_TESTNET_PRIVATE_KEY) {
    Write-Error @"
ARC_TESTNET_PRIVATE_KEY not set. Run:
  `$env:ARC_TESTNET_PRIVATE_KEY = "0x..."
"@
    exit 1
}

$RpcUrl = if ($env:ARC_TESTNET_RPC_URL) { $env:ARC_TESTNET_RPC_URL } else { "https://rpc.testnet.arc.network" }

Write-Host "=== Seed Finance - Arc Testnet Deployment ===" -ForegroundColor Cyan
Write-Host "RPC URL: $RpcUrl"
Write-Host ""

# ===== Build contracts first =====
Write-Host "Building contracts..." -ForegroundColor Yellow
Push-Location $PSScriptRoot
forge build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed. Fix compilation errors before deploying."
    Pop-Location
    exit 1
}
Write-Host "Build successful." -ForegroundColor Green
Write-Host ""

# ===== Construct forge script command =====
$forgeArgs = @(
    "script",
    "script/DeployArcTestnet.s.sol:DeployArcTestnet",
    "--rpc-url", $RpcUrl,
    "--private-key", $env:ARC_TESTNET_PRIVATE_KEY
)

if (-not $DryRun) {
    $forgeArgs += "--broadcast"
    Write-Host "Mode: LIVE DEPLOYMENT (--broadcast)" -ForegroundColor Red
} else {
    Write-Host "Mode: DRY RUN (simulation only)" -ForegroundColor Yellow
}

if ($Verify -and $env:ARCSCAN_API_KEY) {
    $forgeArgs += @("--verify", "--etherscan-api-key", $env:ARCSCAN_API_KEY)
    Write-Host "Verification: ENABLED" -ForegroundColor Green
} elseif ($Verify) {
    Write-Host "Verification: SKIPPED (ARCSCAN_API_KEY not set)" -ForegroundColor Yellow
}

Write-Host ""

# ===== Run deployment =====
Write-Host "Running forge script..." -ForegroundColor Yellow
Write-Host ""

& forge @forgeArgs

if ($LASTEXITCODE -ne 0) {
    Write-Error "Deployment failed."
    Pop-Location
    exit 1
}

Pop-Location

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
if ($DryRun) {
    Write-Host "This was a dry run. To deploy for real, run:" -ForegroundColor Yellow
    Write-Host "  .\deploy-arc-testnet.ps1" -ForegroundColor White
    Write-Host "  .\deploy-arc-testnet.ps1 -Verify   # with contract verification" -ForegroundColor White
}
