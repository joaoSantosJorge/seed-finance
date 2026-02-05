#
# Deploy Contracts to Multi-Anvil Environment (Windows PowerShell)
#
# Deploys all cross-chain strategy contracts to the local multi-anvil setup.
#
# Prerequisites:
# - Multi-anvil environment running (.\start-multi-anvil.ps1)
# - Foundry installed
#

$ErrorActionPreference = "Continue"

# Configuration
$BASE_RPC = "http://localhost:8545"
$ARBITRUM_RPC = "http://localhost:8546"
$ARC_RPC = "http://localhost:8547"

# Private key for deployments (Anvil default account 0)
$DEPLOYER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
$DEPLOYER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

# Output file for addresses
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Definition
$CONTRACTS_DIR = Split-Path -Parent (Split-Path -Parent $SCRIPT_DIR)
$OUTPUT_DIR = Join-Path $CONTRACTS_DIR "deployments"
if (-not (Test-Path $OUTPUT_DIR)) {
    New-Item -ItemType Directory -Path $OUTPUT_DIR | Out-Null
}
$OUTPUT_FILE = Join-Path $OUTPUT_DIR "multi-chain-addresses.json"

Write-Host "========================================" -ForegroundColor Blue
Write-Host "  Cross-Chain Contracts Deployment" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# Function to check RPC connection
function Test-RpcConnection {
    param($Rpc, $Name)
    try {
        $body = '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
        $response = Invoke-RestMethod -Uri $Rpc -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
        if ($response.result) {
            Write-Host "[OK] $Name connected" -ForegroundColor Green
            return $true
        }
    } catch {
        Write-Host "Error: $Name is not running at $Rpc" -ForegroundColor Red
        Write-Host "Run .\start-multi-anvil.ps1 first"
        return $false
    }
    return $false
}

Write-Host "Checking RPC connections..." -ForegroundColor Yellow
if (-not (Test-RpcConnection $BASE_RPC "Base")) { exit 1 }
if (-not (Test-RpcConnection $ARBITRUM_RPC "Arbitrum")) { exit 1 }
if (-not (Test-RpcConnection $ARC_RPC "Arc")) { exit 1 }
Write-Host ""

# Change to contracts directory
Push-Location $CONTRACTS_DIR

try {
    # Build contracts
    Write-Host "Building contracts..." -ForegroundColor Yellow
    forge build --quiet
    Write-Host "[OK] Contracts built" -ForegroundColor Green
    Write-Host ""

    # Function to deploy contract and get address (no constructor args)
    function Deploy-SimpleContract {
        param($Rpc, $Key, $Contract)

        $result = forge create --rpc-url $Rpc --private-key $Key $Contract --broadcast 2>&1
        $resultStr = $result -join "`n"

        # Extract "Deployed to:" address from output
        if ($resultStr -match 'Deployed to:\s*(0x[a-fA-F0-9]+)') {
            return $matches[1]
        }

        Write-Host "    Failed to parse deployment result: $resultStr" -ForegroundColor Red
        return $null
    }

    # Function to deploy contract with constructor args
    function Deploy-ContractWithArgs {
        param($Rpc, $Key, $Contract, [string[]]$ConstructorArgs)

        $result = forge create --rpc-url $Rpc --private-key $Key $Contract --broadcast --constructor-args @ConstructorArgs 2>&1
        $resultStr = $result -join "`n"

        # Extract "Deployed to:" address from output
        if ($resultStr -match 'Deployed to:\s*(0x[a-fA-F0-9]+)') {
            return $matches[1]
        }

        Write-Host "    Failed to parse deployment result: $resultStr" -ForegroundColor Red
        return $null
    }

    # ============ Deploy to Base ============
    Write-Host "Deploying to Base (8545)..." -ForegroundColor Blue

    Write-Host "  Deploying MockUSDC..."
    $BASE_USDC = Deploy-SimpleContract $BASE_RPC $DEPLOYER_KEY "test/mocks/MockUSDC.sol:MockUSDC"
    if (-not $BASE_USDC) { Write-Host "  FAILED" -ForegroundColor Red; exit 1 }
    Write-Host "  [OK] MockUSDC: $BASE_USDC" -ForegroundColor Green

    Write-Host "  Deploying MockLiFiBridgeExecutor..."
    $BASE_LIFI_BRIDGE = Deploy-SimpleContract $BASE_RPC $DEPLOYER_KEY "test/mocks/crosschain/MockLiFiBridgeExecutor.sol:MockLiFiBridgeExecutor"
    if (-not $BASE_LIFI_BRIDGE) { Write-Host "  FAILED" -ForegroundColor Red; exit 1 }
    Write-Host "  [OK] MockLiFiBridgeExecutor: $BASE_LIFI_BRIDGE" -ForegroundColor Green

    Write-Host "  Deploying MockCCTPMessageTransmitter..."
    $BASE_CCTP = Deploy-ContractWithArgs $BASE_RPC $DEPLOYER_KEY "test/mocks/crosschain/MockCCTPMessageTransmitter.sol:MockCCTPMessageTransmitter" @($BASE_USDC, "6")
    if (-not $BASE_CCTP) { Write-Host "  FAILED" -ForegroundColor Red; exit 1 }
    Write-Host "  [OK] MockCCTPMessageTransmitter: $BASE_CCTP" -ForegroundColor Green

    Write-Host ""

    # ============ Deploy to Arbitrum ============
    Write-Host "Deploying to Arbitrum (8546)..." -ForegroundColor Blue

    Write-Host "  Deploying MockUSDC..."
    $ARB_USDC = Deploy-SimpleContract $ARBITRUM_RPC $DEPLOYER_KEY "test/mocks/MockUSDC.sol:MockUSDC"
    if (-not $ARB_USDC) { Write-Host "  FAILED" -ForegroundColor Red; exit 1 }
    Write-Host "  [OK] MockUSDC: $ARB_USDC" -ForegroundColor Green

    Write-Host "  Deploying MockAavePool..."
    $ARB_AAVE = Deploy-ContractWithArgs $ARBITRUM_RPC $DEPLOYER_KEY "test/mocks/crosschain/MockAavePool.sol:MockAavePool" @($ARB_USDC)
    if (-not $ARB_AAVE) { Write-Host "  FAILED" -ForegroundColor Red; exit 1 }
    Write-Host "  [OK] MockAavePool: $ARB_AAVE" -ForegroundColor Green

    Write-Host "  Deploying MockLiFiBridgeExecutor..."
    $ARB_LIFI_BRIDGE = Deploy-SimpleContract $ARBITRUM_RPC $DEPLOYER_KEY "test/mocks/crosschain/MockLiFiBridgeExecutor.sol:MockLiFiBridgeExecutor"
    if (-not $ARB_LIFI_BRIDGE) { Write-Host "  FAILED" -ForegroundColor Red; exit 1 }
    Write-Host "  [OK] MockLiFiBridgeExecutor: $ARB_LIFI_BRIDGE" -ForegroundColor Green

    Write-Host ""

    # ============ Deploy to Arc ============
    Write-Host "Deploying to Arc (8547)..." -ForegroundColor Blue

    Write-Host "  Deploying MockUSDC..."
    $ARC_USDC = Deploy-SimpleContract $ARC_RPC $DEPLOYER_KEY "test/mocks/MockUSDC.sol:MockUSDC"
    if (-not $ARC_USDC) { Write-Host "  FAILED" -ForegroundColor Red; exit 1 }
    Write-Host "  [OK] MockUSDC: $ARC_USDC" -ForegroundColor Green

    Write-Host "  Deploying MockUSYCArc..."
    $ARC_USYC = Deploy-ContractWithArgs $ARC_RPC $DEPLOYER_KEY "test/mocks/crosschain/MockUSYCArc.sol:MockUSYCArc" @($ARC_USDC)
    if (-not $ARC_USYC) { Write-Host "  FAILED" -ForegroundColor Red; exit 1 }
    Write-Host "  [OK] MockUSYCArc: $ARC_USYC" -ForegroundColor Green

    Write-Host "  Deploying MockCCTPMessageTransmitter..."
    $ARC_CCTP = Deploy-ContractWithArgs $ARC_RPC $DEPLOYER_KEY "test/mocks/crosschain/MockCCTPMessageTransmitter.sol:MockCCTPMessageTransmitter" @($ARC_USDC, "26")
    if (-not $ARC_CCTP) { Write-Host "  FAILED" -ForegroundColor Red; exit 1 }
    Write-Host "  [OK] MockCCTPMessageTransmitter: $ARC_CCTP" -ForegroundColor Green

    Write-Host ""

    # ============ Deploy Strategies ============
    $TREASURY_MANAGER = $DEPLOYER_ADDRESS
    $PLACEHOLDER_AGENT = $DEPLOYER_ADDRESS

    Write-Host "Deploying Strategies on Base..." -ForegroundColor Blue

    Write-Host "  Deploying LiFiVaultStrategy..."
    $LIFI_STRATEGY = Deploy-ContractWithArgs $BASE_RPC $DEPLOYER_KEY "src/strategies/LiFiVaultStrategy.sol:LiFiVaultStrategy" @($BASE_USDC, $TREASURY_MANAGER, $PLACEHOLDER_AGENT, $BASE_LIFI_BRIDGE)
    if (-not $LIFI_STRATEGY) { Write-Host "  FAILED" -ForegroundColor Red; exit 1 }
    Write-Host "  [OK] LiFiVaultStrategy: $LIFI_STRATEGY" -ForegroundColor Green

    Write-Host "  Deploying ArcUSYCStrategy..."
    $ARC_STRATEGY = Deploy-ContractWithArgs $BASE_RPC $DEPLOYER_KEY "src/strategies/ArcUSYCStrategy.sol:ArcUSYCStrategy" @($BASE_USDC, $TREASURY_MANAGER, $PLACEHOLDER_AGENT, $BASE_CCTP)
    if (-not $ARC_STRATEGY) { Write-Host "  FAILED" -ForegroundColor Red; exit 1 }
    Write-Host "  [OK] ArcUSYCStrategy: $ARC_STRATEGY" -ForegroundColor Green

    Write-Host ""

    # ============ Deploy Remote Agents ============
    Write-Host "Deploying Remote Agents..." -ForegroundColor Blue

    Write-Host "  Deploying LiFiVaultAgent on Arbitrum..."
    $LIFI_AGENT = Deploy-ContractWithArgs $ARBITRUM_RPC $DEPLOYER_KEY "src/strategies/remote/LiFiVaultAgent.sol:LiFiVaultAgent" @($LIFI_STRATEGY, $ARB_USDC, $ARB_AAVE, $ARB_LIFI_BRIDGE)
    if (-not $LIFI_AGENT) { Write-Host "  FAILED" -ForegroundColor Red; exit 1 }
    Write-Host "  [OK] LiFiVaultAgent: $LIFI_AGENT" -ForegroundColor Green

    Write-Host "  Deploying ArcUSYCAgent on Arc..."
    $ARC_AGENT = Deploy-ContractWithArgs $ARC_RPC $DEPLOYER_KEY "src/strategies/remote/ArcUSYCAgent.sol:ArcUSYCAgent" @($ARC_STRATEGY, $ARC_USDC, $ARC_USYC, $ARC_CCTP)
    if (-not $ARC_AGENT) { Write-Host "  FAILED" -ForegroundColor Red; exit 1 }
    Write-Host "  [OK] ArcUSYCAgent: $ARC_AGENT" -ForegroundColor Green

    Write-Host ""

    # ============ Update Strategy Remote Agents ============
    Write-Host "Updating strategy remote agent addresses..." -ForegroundColor Blue

    & cast send --rpc-url $BASE_RPC --private-key $DEPLOYER_KEY $LIFI_STRATEGY "setRemoteAgent(address)" $LIFI_AGENT 2>&1 | Out-Null
    Write-Host "  [OK] LiFiVaultStrategy remote agent updated" -ForegroundColor Green

    & cast send --rpc-url $BASE_RPC --private-key $DEPLOYER_KEY $ARC_STRATEGY "setRemoteAgent(address)" $ARC_AGENT 2>&1 | Out-Null
    Write-Host "  [OK] ArcUSYCStrategy remote agent updated" -ForegroundColor Green

    Write-Host ""

    # ============ Fund Accounts ============
    Write-Host "Minting test USDC..." -ForegroundColor Blue

    & cast send --rpc-url $BASE_RPC --private-key $DEPLOYER_KEY $BASE_USDC "mint(address,uint256)" $DEPLOYER_ADDRESS 1000000000000 2>&1 | Out-Null
    Write-Host "  [OK] Minted 1M USDC on Base" -ForegroundColor Green

    & cast send --rpc-url $ARBITRUM_RPC --private-key $DEPLOYER_KEY $ARB_USDC "mint(address,uint256)" $DEPLOYER_ADDRESS 1000000000000 2>&1 | Out-Null
    Write-Host "  [OK] Minted 1M USDC on Arbitrum" -ForegroundColor Green

    & cast send --rpc-url $ARC_RPC --private-key $DEPLOYER_KEY $ARC_USDC "mint(address,uint256)" $DEPLOYER_ADDRESS 1000000000000 2>&1 | Out-Null
    Write-Host "  [OK] Minted 1M USDC on Arc" -ForegroundColor Green

    # Fund mock bridges
    & cast send --rpc-url $BASE_RPC --private-key $DEPLOYER_KEY $BASE_USDC "mint(address,uint256)" $BASE_LIFI_BRIDGE 1000000000000 2>&1 | Out-Null
    & cast send --rpc-url $BASE_RPC --private-key $DEPLOYER_KEY $BASE_USDC "mint(address,uint256)" $BASE_CCTP 1000000000000 2>&1 | Out-Null
    Write-Host "  [OK] Funded Base bridges" -ForegroundColor Green

    & cast send --rpc-url $ARBITRUM_RPC --private-key $DEPLOYER_KEY $ARB_USDC "mint(address,uint256)" $ARB_LIFI_BRIDGE 1000000000000 2>&1 | Out-Null
    Write-Host "  [OK] Funded Arbitrum bridge" -ForegroundColor Green

    & cast send --rpc-url $ARC_RPC --private-key $DEPLOYER_KEY $ARC_USDC "mint(address,uint256)" $ARC_CCTP 1000000000000 2>&1 | Out-Null
    Write-Host "  [OK] Funded Arc CCTP" -ForegroundColor Green

    Write-Host ""

    # ============ Save Addresses ============
    Write-Host "Saving deployment addresses..." -ForegroundColor Blue

    $addresses = @{
        base = @{
            chainId = 31337
            rpc = $BASE_RPC
            usdc = $BASE_USDC
            lifiBridge = $BASE_LIFI_BRIDGE
            cctp = $BASE_CCTP
            lifiVaultStrategy = $LIFI_STRATEGY
            arcUSYCStrategy = $ARC_STRATEGY
        }
        arbitrum = @{
            chainId = 31338
            rpc = $ARBITRUM_RPC
            usdc = $ARB_USDC
            aavePool = $ARB_AAVE
            lifiBridge = $ARB_LIFI_BRIDGE
            lifiVaultAgent = $LIFI_AGENT
        }
        arc = @{
            chainId = 31339
            rpc = $ARC_RPC
            usdc = $ARC_USDC
            usyc = $ARC_USYC
            cctp = $ARC_CCTP
            arcUSYCAgent = $ARC_AGENT
        }
        deployer = @{
            address = $DEPLOYER_ADDRESS
            privateKey = $DEPLOYER_KEY
        }
    }

    $addresses | ConvertTo-Json -Depth 3 | Out-File -FilePath $OUTPUT_FILE -Encoding utf8NoBOM
    Write-Host "[OK] Addresses saved to $OUTPUT_FILE" -ForegroundColor Green

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Deployment Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. Start the relay service: npx ts-node scripts/relay/relay.ts"
    Write-Host "  2. Run integration tests: `$env:MULTI_ANVIL=`"true`"; forge test --match-contract CrossChainIntegration"
    Write-Host ""

} finally {
    Pop-Location
}
