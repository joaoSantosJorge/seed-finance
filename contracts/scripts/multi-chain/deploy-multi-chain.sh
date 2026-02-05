#!/bin/bash
#
# Deploy Contracts to Multi-Anvil Environment
#
# Deploys all cross-chain strategy contracts to the local multi-anvil setup.
#
# Prerequisites:
# - Multi-anvil environment running (./start-multi-anvil.sh)
# - Foundry installed
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BASE_RPC="http://localhost:8545"
ARBITRUM_RPC="http://localhost:8546"
ARC_RPC="http://localhost:8547"

# Private key for deployments (Anvil default account 0)
DEPLOYER_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
DEPLOYER_ADDRESS="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

# Output file for addresses
OUTPUT_DIR="./deployments"
mkdir -p "$OUTPUT_DIR"
OUTPUT_FILE="$OUTPUT_DIR/multi-chain-addresses.json"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Cross-Chain Contracts Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if anvils are running
check_rpc() {
    local rpc=$1
    local name=$2
    if ! curl -s -X POST -H "Content-Type: application/json" \
        --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
        "$rpc" > /dev/null 2>&1; then
        echo -e "${RED}Error: $name is not running at $rpc${NC}"
        echo "Run ./start-multi-anvil.sh first"
        exit 1
    fi
    echo -e "${GREEN}✓ $name connected${NC}"
}

echo -e "${YELLOW}Checking RPC connections...${NC}"
check_rpc "$BASE_RPC" "Base"
check_rpc "$ARBITRUM_RPC" "Arbitrum"
check_rpc "$ARC_RPC" "Arc"
echo ""

# Change to contracts directory
cd "$(dirname "$0")/../.."

# Build contracts
echo -e "${YELLOW}Building contracts...${NC}"
forge build --quiet
echo -e "${GREEN}✓ Contracts built${NC}"
echo ""

# ============ Deploy to Base ============
echo -e "${BLUE}Deploying to Base (8545)...${NC}"

# Deploy MockUSDC
echo "  Deploying MockUSDC..."
BASE_USDC=$(forge create --rpc-url "$BASE_RPC" --private-key "$DEPLOYER_KEY" \
    test/mocks/MockUSDC.sol:MockUSDC --json | jq -r '.deployedTo')
echo -e "${GREEN}  ✓ MockUSDC: $BASE_USDC${NC}"

# Deploy MockLiFiBridgeExecutor
echo "  Deploying MockLiFiBridgeExecutor..."
BASE_LIFI_BRIDGE=$(forge create --rpc-url "$BASE_RPC" --private-key "$DEPLOYER_KEY" \
    test/mocks/crosschain/MockLiFiBridgeExecutor.sol:MockLiFiBridgeExecutor --json | jq -r '.deployedTo')
echo -e "${GREEN}  ✓ MockLiFiBridgeExecutor: $BASE_LIFI_BRIDGE${NC}"

# Deploy MockCCTPMessageTransmitter
echo "  Deploying MockCCTPMessageTransmitter..."
BASE_CCTP=$(forge create --rpc-url "$BASE_RPC" --private-key "$DEPLOYER_KEY" \
    test/mocks/crosschain/MockCCTPMessageTransmitter.sol:MockCCTPMessageTransmitter \
    --constructor-args "$BASE_USDC" 6 --json | jq -r '.deployedTo')
echo -e "${GREEN}  ✓ MockCCTPMessageTransmitter: $BASE_CCTP${NC}"

echo ""

# ============ Deploy to Arbitrum ============
echo -e "${BLUE}Deploying to Arbitrum (8546)...${NC}"

# Deploy MockUSDC (Arbitrum)
echo "  Deploying MockUSDC..."
ARB_USDC=$(forge create --rpc-url "$ARBITRUM_RPC" --private-key "$DEPLOYER_KEY" \
    test/mocks/MockUSDC.sol:MockUSDC --json | jq -r '.deployedTo')
echo -e "${GREEN}  ✓ MockUSDC: $ARB_USDC${NC}"

# Deploy MockAavePool
echo "  Deploying MockAavePool..."
ARB_AAVE=$(forge create --rpc-url "$ARBITRUM_RPC" --private-key "$DEPLOYER_KEY" \
    test/mocks/crosschain/MockAavePool.sol:MockAavePool \
    --constructor-args "$ARB_USDC" --json | jq -r '.deployedTo')
echo -e "${GREEN}  ✓ MockAavePool: $ARB_AAVE${NC}"

# Deploy MockLiFiBridgeExecutor (Arbitrum)
echo "  Deploying MockLiFiBridgeExecutor..."
ARB_LIFI_BRIDGE=$(forge create --rpc-url "$ARBITRUM_RPC" --private-key "$DEPLOYER_KEY" \
    test/mocks/crosschain/MockLiFiBridgeExecutor.sol:MockLiFiBridgeExecutor --json | jq -r '.deployedTo')
echo -e "${GREEN}  ✓ MockLiFiBridgeExecutor: $ARB_LIFI_BRIDGE${NC}"

echo ""

# ============ Deploy to Arc ============
echo -e "${BLUE}Deploying to Arc (8547)...${NC}"

# Deploy MockUSDC (Arc)
echo "  Deploying MockUSDC..."
ARC_USDC=$(forge create --rpc-url "$ARC_RPC" --private-key "$DEPLOYER_KEY" \
    test/mocks/MockUSDC.sol:MockUSDC --json | jq -r '.deployedTo')
echo -e "${GREEN}  ✓ MockUSDC: $ARC_USDC${NC}"

# Deploy MockUSYCArc
echo "  Deploying MockUSYCArc..."
ARC_USYC=$(forge create --rpc-url "$ARC_RPC" --private-key "$DEPLOYER_KEY" \
    test/mocks/crosschain/MockUSYCArc.sol:MockUSYCArc \
    --constructor-args "$ARC_USDC" --json | jq -r '.deployedTo')
echo -e "${GREEN}  ✓ MockUSYCArc: $ARC_USYC${NC}"

# Deploy MockCCTPMessageTransmitter (Arc)
echo "  Deploying MockCCTPMessageTransmitter..."
ARC_CCTP=$(forge create --rpc-url "$ARC_RPC" --private-key "$DEPLOYER_KEY" \
    test/mocks/crosschain/MockCCTPMessageTransmitter.sol:MockCCTPMessageTransmitter \
    --constructor-args "$ARC_USDC" 26 --json | jq -r '.deployedTo')
echo -e "${GREEN}  ✓ MockCCTPMessageTransmitter: $ARC_CCTP${NC}"

echo ""

# ============ Deploy Strategies ============
# Note: We need placeholder agent addresses first, then update them after deploying agents

# Placeholder treasury manager (deployer for testing)
TREASURY_MANAGER="$DEPLOYER_ADDRESS"

# Deploy placeholder agents first (we'll deploy real ones)
PLACEHOLDER_AGENT="$DEPLOYER_ADDRESS"

echo -e "${BLUE}Deploying Strategies on Base...${NC}"

# Deploy LiFiVaultStrategy
echo "  Deploying LiFiVaultStrategy..."
LIFI_STRATEGY=$(forge create --rpc-url "$BASE_RPC" --private-key "$DEPLOYER_KEY" \
    src/strategies/LiFiVaultStrategy.sol:LiFiVaultStrategy \
    --constructor-args "$BASE_USDC" "$TREASURY_MANAGER" "$PLACEHOLDER_AGENT" "$BASE_LIFI_BRIDGE" \
    --json | jq -r '.deployedTo')
echo -e "${GREEN}  ✓ LiFiVaultStrategy: $LIFI_STRATEGY${NC}"

# Deploy ArcUSYCStrategy
echo "  Deploying ArcUSYCStrategy..."
ARC_STRATEGY=$(forge create --rpc-url "$BASE_RPC" --private-key "$DEPLOYER_KEY" \
    src/strategies/ArcUSYCStrategy.sol:ArcUSYCStrategy \
    --constructor-args "$BASE_USDC" "$TREASURY_MANAGER" "$PLACEHOLDER_AGENT" "$BASE_CCTP" \
    --json | jq -r '.deployedTo')
echo -e "${GREEN}  ✓ ArcUSYCStrategy: $ARC_STRATEGY${NC}"

echo ""

# ============ Deploy Remote Agents ============
echo -e "${BLUE}Deploying Remote Agents...${NC}"

# Deploy LiFiVaultAgent on Arbitrum
echo "  Deploying LiFiVaultAgent on Arbitrum..."
LIFI_AGENT=$(forge create --rpc-url "$ARBITRUM_RPC" --private-key "$DEPLOYER_KEY" \
    src/strategies/remote/LiFiVaultAgent.sol:LiFiVaultAgent \
    --constructor-args "$LIFI_STRATEGY" "$ARB_USDC" "$ARB_AAVE" "$ARB_LIFI_BRIDGE" \
    --json | jq -r '.deployedTo')
echo -e "${GREEN}  ✓ LiFiVaultAgent: $LIFI_AGENT${NC}"

# Deploy ArcUSYCAgent on Arc
echo "  Deploying ArcUSYCAgent on Arc..."
ARC_AGENT=$(forge create --rpc-url "$ARC_RPC" --private-key "$DEPLOYER_KEY" \
    src/strategies/remote/ArcUSYCAgent.sol:ArcUSYCAgent \
    --constructor-args "$ARC_STRATEGY" "$ARC_USDC" "$ARC_USYC" "$ARC_CCTP" \
    --json | jq -r '.deployedTo')
echo -e "${GREEN}  ✓ ArcUSYCAgent: $ARC_AGENT${NC}"

echo ""

# ============ Update Strategy Remote Agents ============
echo -e "${BLUE}Updating strategy remote agent addresses...${NC}"

# Update LiFiVaultStrategy's remote agent
cast send --rpc-url "$BASE_RPC" --private-key "$DEPLOYER_KEY" \
    "$LIFI_STRATEGY" "setRemoteAgent(address)" "$LIFI_AGENT" > /dev/null
echo -e "${GREEN}  ✓ LiFiVaultStrategy remote agent updated${NC}"

# Update ArcUSYCStrategy's remote agent
cast send --rpc-url "$BASE_RPC" --private-key "$DEPLOYER_KEY" \
    "$ARC_STRATEGY" "setRemoteAgent(address)" "$ARC_AGENT" > /dev/null
echo -e "${GREEN}  ✓ ArcUSYCStrategy remote agent updated${NC}"

echo ""

# ============ Fund Accounts ============
echo -e "${BLUE}Minting test USDC...${NC}"

# Mint USDC on Base for treasury manager
cast send --rpc-url "$BASE_RPC" --private-key "$DEPLOYER_KEY" \
    "$BASE_USDC" "mint(address,uint256)" "$DEPLOYER_ADDRESS" "1000000000000" > /dev/null
echo -e "${GREEN}  ✓ Minted 1M USDC on Base${NC}"

# Mint USDC on Arbitrum for testing
cast send --rpc-url "$ARBITRUM_RPC" --private-key "$DEPLOYER_KEY" \
    "$ARB_USDC" "mint(address,uint256)" "$DEPLOYER_ADDRESS" "1000000000000" > /dev/null
echo -e "${GREEN}  ✓ Minted 1M USDC on Arbitrum${NC}"

# Mint USDC on Arc for testing
cast send --rpc-url "$ARC_RPC" --private-key "$DEPLOYER_KEY" \
    "$ARC_USDC" "mint(address,uint256)" "$DEPLOYER_ADDRESS" "1000000000000" > /dev/null
echo -e "${GREEN}  ✓ Minted 1M USDC on Arc${NC}"

# Fund mock bridges with USDC
cast send --rpc-url "$BASE_RPC" --private-key "$DEPLOYER_KEY" \
    "$BASE_USDC" "mint(address,uint256)" "$BASE_LIFI_BRIDGE" "1000000000000" > /dev/null
cast send --rpc-url "$BASE_RPC" --private-key "$DEPLOYER_KEY" \
    "$BASE_USDC" "mint(address,uint256)" "$BASE_CCTP" "1000000000000" > /dev/null
echo -e "${GREEN}  ✓ Funded Base bridges${NC}"

cast send --rpc-url "$ARBITRUM_RPC" --private-key "$DEPLOYER_KEY" \
    "$ARB_USDC" "mint(address,uint256)" "$ARB_LIFI_BRIDGE" "1000000000000" > /dev/null
echo -e "${GREEN}  ✓ Funded Arbitrum bridge${NC}"

cast send --rpc-url "$ARC_RPC" --private-key "$DEPLOYER_KEY" \
    "$ARC_USDC" "mint(address,uint256)" "$ARC_CCTP" "1000000000000" > /dev/null
echo -e "${GREEN}  ✓ Funded Arc CCTP${NC}"

echo ""

# ============ Save Addresses ============
echo -e "${BLUE}Saving deployment addresses...${NC}"

cat > "$OUTPUT_FILE" << EOF
{
  "base": {
    "chainId": 31337,
    "rpc": "$BASE_RPC",
    "usdc": "$BASE_USDC",
    "lifiBridge": "$BASE_LIFI_BRIDGE",
    "cctp": "$BASE_CCTP",
    "lifiVaultStrategy": "$LIFI_STRATEGY",
    "arcUSYCStrategy": "$ARC_STRATEGY"
  },
  "arbitrum": {
    "chainId": 31338,
    "rpc": "$ARBITRUM_RPC",
    "usdc": "$ARB_USDC",
    "aavePool": "$ARB_AAVE",
    "lifiBridge": "$ARB_LIFI_BRIDGE",
    "lifiVaultAgent": "$LIFI_AGENT"
  },
  "arc": {
    "chainId": 31339,
    "rpc": "$ARC_RPC",
    "usdc": "$ARC_USDC",
    "usyc": "$ARC_USYC",
    "cctp": "$ARC_CCTP",
    "arcUSYCAgent": "$ARC_AGENT"
  },
  "deployer": {
    "address": "$DEPLOYER_ADDRESS",
    "privateKey": "$DEPLOYER_KEY"
  }
}
EOF

echo -e "${GREEN}✓ Addresses saved to $OUTPUT_FILE${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Start the relay service: npx ts-node scripts/relay/relay.ts"
echo "  2. Run integration tests: MULTI_ANVIL=true forge test --match-contract CrossChainIntegration"
echo ""
