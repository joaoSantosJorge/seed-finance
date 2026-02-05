#
# Start Multi-Anvil Environment for Cross-Chain Testing (Windows PowerShell)
#
# This script starts 3 Anvil instances simulating:
# - Base (port 8545, chain ID 31337)
# - Arbitrum (port 8546, chain ID 31338)
# - Arc (port 8547, chain ID 31339)
#

$ErrorActionPreference = "Stop"

# Configuration
$BASE_PORT = 8545
$ARBITRUM_PORT = 8546
$ARC_PORT = 8547

$BASE_CHAIN_ID = 31337
$ARBITRUM_CHAIN_ID = 31338
$ARC_CHAIN_ID = 31339

# Common Anvil flags
$COMMON_FLAGS = "--block-time 1 --balance 10000 --accounts 10"

# State directory for persistence
$STATE_DIR = "$env:USERPROFILE\.anvil-state"
if (-not (Test-Path $STATE_DIR)) {
    New-Item -ItemType Directory -Path $STATE_DIR | Out-Null
}

Write-Host "Starting Multi-Anvil Environment..." -ForegroundColor Green
Write-Host ""

# Check if anvil is installed
try {
    $null = Get-Command anvil -ErrorAction Stop
} catch {
    Write-Host "Error: anvil is not installed" -ForegroundColor Red
    Write-Host "Install it with: curl -L https://foundry.paradigm.xyz | bash && foundryup"
    exit 1
}

# Function to check if port is in use
function Test-PortInUse {
    param($Port, $Name)
    $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($connection) {
        Write-Host "Warning: Port $Port ($Name) is already in use" -ForegroundColor Yellow
        Write-Host "Run .\stop-multi-anvil.ps1 first or kill the process manually"
        return $true
    }
    return $false
}

# Check ports
if (Test-PortInUse $BASE_PORT "Base") { exit 1 }
if (Test-PortInUse $ARBITRUM_PORT "Arbitrum") { exit 1 }
if (Test-PortInUse $ARC_PORT "Arc") { exit 1 }

# Start Base Anvil
Write-Host "Starting Base (Chain ID: $BASE_CHAIN_ID, Port: $BASE_PORT)..." -ForegroundColor Yellow
$baseProcess = Start-Process -FilePath "anvil" `
    -ArgumentList "--port $BASE_PORT --chain-id $BASE_CHAIN_ID $COMMON_FLAGS" `
    -WindowStyle Hidden `
    -PassThru `
    -RedirectStandardOutput "$STATE_DIR\base.log" `
    -RedirectStandardError "$STATE_DIR\base-error.log"
Write-Host "Base PID: $($baseProcess.Id)"
$baseProcess.Id | Out-File "$STATE_DIR\base.pid"

# Start Arbitrum Anvil
Write-Host "Starting Arbitrum (Chain ID: $ARBITRUM_CHAIN_ID, Port: $ARBITRUM_PORT)..." -ForegroundColor Yellow
$arbitrumProcess = Start-Process -FilePath "anvil" `
    -ArgumentList "--port $ARBITRUM_PORT --chain-id $ARBITRUM_CHAIN_ID $COMMON_FLAGS" `
    -WindowStyle Hidden `
    -PassThru `
    -RedirectStandardOutput "$STATE_DIR\arbitrum.log" `
    -RedirectStandardError "$STATE_DIR\arbitrum-error.log"
Write-Host "Arbitrum PID: $($arbitrumProcess.Id)"
$arbitrumProcess.Id | Out-File "$STATE_DIR\arbitrum.pid"

# Start Arc Anvil
Write-Host "Starting Arc (Chain ID: $ARC_CHAIN_ID, Port: $ARC_PORT)..." -ForegroundColor Yellow
$arcProcess = Start-Process -FilePath "anvil" `
    -ArgumentList "--port $ARC_PORT --chain-id $ARC_CHAIN_ID $COMMON_FLAGS" `
    -WindowStyle Hidden `
    -PassThru `
    -RedirectStandardOutput "$STATE_DIR\arc.log" `
    -RedirectStandardError "$STATE_DIR\arc-error.log"
Write-Host "Arc PID: $($arcProcess.Id)"
$arcProcess.Id | Out-File "$STATE_DIR\arc.pid"

# Wait for nodes to start
Write-Host ""
Write-Host "Waiting for nodes to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Function to verify node is running
function Test-NodeRunning {
    param($Port, $Name)
    try {
        $body = '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
        $response = Invoke-RestMethod -Uri "http://localhost:$Port" -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
        if ($response.result) {
            Write-Host "[OK] $Name is running on port $Port" -ForegroundColor Green
            return $true
        }
    } catch {
        Write-Host "[X] $Name failed to start on port $Port" -ForegroundColor Red
        return $false
    }
    return $false
}

$baseOk = Test-NodeRunning $BASE_PORT "Base"
$arbitrumOk = Test-NodeRunning $ARBITRUM_PORT "Arbitrum"
$arcOk = Test-NodeRunning $ARC_PORT "Arc"

Write-Host ""
if ($baseOk -and $arbitrumOk -and $arcOk) {
    Write-Host "Multi-Anvil Environment Started!" -ForegroundColor Green
} else {
    Write-Host "Some nodes failed to start. Check logs in $STATE_DIR" -ForegroundColor Red
}

Write-Host ""
Write-Host "RPC Endpoints:"
Write-Host "  Base:     http://localhost:$BASE_PORT"
Write-Host "  Arbitrum: http://localhost:$ARBITRUM_PORT"
Write-Host "  Arc:      http://localhost:$ARC_PORT"
Write-Host ""
Write-Host "Test Account (same on all chains):"
Write-Host "  Address:  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
Write-Host "  Key:      0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
Write-Host ""
Write-Host "Logs:"
Write-Host "  Base:     $STATE_DIR\base.log"
Write-Host "  Arbitrum: $STATE_DIR\arbitrum.log"
Write-Host "  Arc:      $STATE_DIR\arc.log"
Write-Host ""
Write-Host "To stop: .\stop-multi-anvil.ps1"
