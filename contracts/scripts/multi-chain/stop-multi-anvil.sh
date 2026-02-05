#!/bin/bash
#
# Stop Multi-Anvil Environment
#
# Stops all Anvil instances started by start-multi-anvil.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

STATE_DIR="${HOME}/.anvil-state"

echo -e "${YELLOW}Stopping Multi-Anvil Environment...${NC}"

# Function to kill process by PID file
kill_by_pid_file() {
    local pid_file=$1
    local name=$2

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
            echo -e "${GREEN}✓ Stopped $name (PID: $pid)${NC}"
        else
            echo -e "${YELLOW}○ $name was not running${NC}"
        fi
        rm -f "$pid_file"
    else
        echo -e "${YELLOW}○ No PID file for $name${NC}"
    fi
}

# Stop each chain
kill_by_pid_file "$STATE_DIR/base.pid" "Base"
kill_by_pid_file "$STATE_DIR/arbitrum.pid" "Arbitrum"
kill_by_pid_file "$STATE_DIR/arc.pid" "Arc"

# Also kill any anvil processes on these ports (backup cleanup)
for port in 8545 8546 8547; do
    pid=$(lsof -t -i:$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
        kill "$pid" 2>/dev/null || true
        echo -e "${GREEN}✓ Killed process on port $port (PID: $pid)${NC}"
    fi
done

echo ""
echo -e "${GREEN}All Anvil instances stopped.${NC}"
echo ""
echo "State files preserved at: $STATE_DIR"
echo "To clean state: rm -rf $STATE_DIR/*.json"
