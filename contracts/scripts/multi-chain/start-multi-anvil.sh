#!/bin/bash
#
# Start Multi-Anvil Environment for Cross-Chain Testing
#
# This script starts 3 Anvil instances simulating:
# - Base (port 8545, chain ID 31337)
# - Arbitrum (port 8546, chain ID 31338)
# - Arc (port 8547, chain ID 31339)
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_PORT=8545
ARBITRUM_PORT=8546
ARC_PORT=8547

BASE_CHAIN_ID=31337
ARBITRUM_CHAIN_ID=31338
ARC_CHAIN_ID=31339

# Common Anvil flags
COMMON_FLAGS="--block-time 1 --balance 10000 --accounts 10"

# State directory for persistence (optional)
STATE_DIR="${HOME}/.anvil-state"
mkdir -p "$STATE_DIR"

echo -e "${GREEN}Starting Multi-Anvil Environment...${NC}"
echo ""

# Check if anvil is installed
if ! command -v anvil &> /dev/null; then
    echo -e "${RED}Error: anvil is not installed${NC}"
    echo "Install it with: curl -L https://foundry.paradigm.xyz | bash && foundryup"
    exit 1
fi

# Check if ports are already in use
check_port() {
    local port=$1
    local name=$2
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}Warning: Port $port ($name) is already in use${NC}"
        echo "Run ./stop-multi-anvil.sh first or kill the process manually"
        return 1
    fi
    return 0
}

check_port $BASE_PORT "Base" || exit 1
check_port $ARBITRUM_PORT "Arbitrum" || exit 1
check_port $ARC_PORT "Arc" || exit 1

# Start Base Anvil
echo -e "${YELLOW}Starting Base (Chain ID: $BASE_CHAIN_ID, Port: $BASE_PORT)...${NC}"
anvil \
    --port $BASE_PORT \
    --chain-id $BASE_CHAIN_ID \
    $COMMON_FLAGS \
    --state "$STATE_DIR/base.json" \
    > "$STATE_DIR/base.log" 2>&1 &
BASE_PID=$!
echo "Base PID: $BASE_PID"

# Start Arbitrum Anvil
echo -e "${YELLOW}Starting Arbitrum (Chain ID: $ARBITRUM_CHAIN_ID, Port: $ARBITRUM_PORT)...${NC}"
anvil \
    --port $ARBITRUM_PORT \
    --chain-id $ARBITRUM_CHAIN_ID \
    $COMMON_FLAGS \
    --state "$STATE_DIR/arbitrum.json" \
    > "$STATE_DIR/arbitrum.log" 2>&1 &
ARBITRUM_PID=$!
echo "Arbitrum PID: $ARBITRUM_PID"

# Start Arc Anvil
echo -e "${YELLOW}Starting Arc (Chain ID: $ARC_CHAIN_ID, Port: $ARC_PORT)...${NC}"
anvil \
    --port $ARC_PORT \
    --chain-id $ARC_CHAIN_ID \
    $COMMON_FLAGS \
    --state "$STATE_DIR/arc.json" \
    > "$STATE_DIR/arc.log" 2>&1 &
ARC_PID=$!
echo "Arc PID: $ARC_PID"

# Save PIDs for later shutdown
echo "$BASE_PID" > "$STATE_DIR/base.pid"
echo "$ARBITRUM_PID" > "$STATE_DIR/arbitrum.pid"
echo "$ARC_PID" > "$STATE_DIR/arc.pid"

# Wait for nodes to start
echo ""
echo -e "${YELLOW}Waiting for nodes to start...${NC}"
sleep 3

# Verify nodes are running
verify_node() {
    local port=$1
    local name=$2
    if curl -s -X POST -H "Content-Type: application/json" \
        --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
        http://localhost:$port > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $name is running on port $port${NC}"
        return 0
    else
        echo -e "${RED}✗ $name failed to start on port $port${NC}"
        return 1
    fi
}

verify_node $BASE_PORT "Base"
verify_node $ARBITRUM_PORT "Arbitrum"
verify_node $ARC_PORT "Arc"

echo ""
echo -e "${GREEN}Multi-Anvil Environment Started!${NC}"
echo ""
echo "RPC Endpoints:"
echo "  Base:     http://localhost:$BASE_PORT"
echo "  Arbitrum: http://localhost:$ARBITRUM_PORT"
echo "  Arc:      http://localhost:$ARC_PORT"
echo ""
echo "Test Account (same on all chains):"
echo "  Address:  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
echo "  Key:      0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
echo ""
echo "Logs:"
echo "  Base:     $STATE_DIR/base.log"
echo "  Arbitrum: $STATE_DIR/arbitrum.log"
echo "  Arc:      $STATE_DIR/arc.log"
echo ""
echo "To stop: ./stop-multi-anvil.sh"
