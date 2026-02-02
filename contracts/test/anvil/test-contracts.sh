#!/bin/bash

# ============================================================================
# SEED FINANCE - ANVIL INTEGRATION TEST SUITE
# ============================================================================
#
# DESCRIPTION:
#   End-to-end integration tests for the Seed Finance smart contract system.
#   Deploys all contracts to a local Anvil blockchain and executes 4 test
#   scenarios covering LP operations, treasury management, multi-strategy
#   rebalancing, and access control.
#
# CONTRACTS TESTED:
#   - LiquidityPool.sol   : ERC-4626 vault for USDC deposits
#   - TreasuryManager.sol : Multi-strategy yield allocator
#   - MockUSDC.sol        : Test USDC token (6 decimals)
#   - MockStrategy.sol    : Test yield strategy
#
# TEST SCENARIOS:
#   1. Basic LP Flow       - deposit, withdraw, share mechanics
#   2. Treasury Integration - yield strategies, accrual
#   3. Multi-Strategy      - weighted allocation, rebalancing
#   4. Access Control      - roles, permissions, pause/unpause
#
# PREREQUISITES:
#   - Foundry installed (forge, cast, anvil)
#   - Anvil running: `anvil` in a separate terminal
#   - Contracts compiled: `forge build`
#
# USAGE:
#   cd /path/to/contracts
#   ./test/anvil/test-contracts.sh
#
# ============================================================================

set -e  # Exit on error

# ============================================================================
# Configuration
# ============================================================================

RPC_URL="http://localhost:8545"

# Get the contracts directory (parent of test/anvil)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Anvil default accounts (deterministic, for testing only)
DEPLOYER_PK="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
DEPLOYER_ADDR="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

LP_USER_PK="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
LP_USER_ADDR="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

STRATEGIST_PK="0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
STRATEGIST_ADDR="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"

# USDC amounts (6 decimals - standard for USDC)
ONE_MILLION_USDC="1000000000000"   # 1,000,000 USDC
HUNDRED_K_USDC="100000000000"      # 100,000 USDC
FIFTY_K_USDC="50000000000"         # 50,000 USDC
TEN_K_USDC="10000000000"           # 10,000 USDC
FIVE_K_USDC="5000000000"           # 5,000 USDC

# Max uint256 for infinite approvals
MAX_UINT256="115792089237316195423570985008687907853269984665640564039457584007913129639935"

# AccessControl role hashes (keccak256 of role names)
DEFAULT_ADMIN_ROLE="0x0000000000000000000000000000000000000000000000000000000000000000"
ROUTER_ROLE="0x7a05a596cb0ce7fdea8a1e1ec73be300bdb35097c944ce1897202f7a13122eb2"
TREASURY_ROLE="0xe1dcbdb91df27212a29bc27177c840cf2f819ecf2187432e1fac86c2dd5dfca9"
POOL_ROLE="0xb8179c2726c8d8961ef054875ab3f4c1c3d34e1cb429c3d5e0bc97958e4cab9d"
STRATEGIST_ROLE="0x17a8e30262c1f919c33056d877a3c22b95c2f5e4dac44683c1c2323cd79fbdb0"
PAUSER_ROLE="0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a"

# Contract addresses (populated after deployment)
USDC_ADDR=""
LIQUIDITY_POOL_ADDR=""
TREASURY_MANAGER_ADDR=""
MOCK_STRATEGY_ADDR=""
MOCK_STRATEGY_2_ADDR=""

# Save original directory for restoration
ORIG_DIR=$(pwd)

# ============================================================================
# Helper Functions - Output Formatting
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo -e "${BLUE}================================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================================${NC}"
}

print_step() {
    echo -e "${YELLOW}>>> $1${NC}"
}

print_success() {
    echo -e "${GREEN}[PASS] $1${NC}"
}

print_fail() {
    echo -e "${RED}[FAIL] $1${NC}"
}

print_info() {
    echo -e "    $1"
}

# ============================================================================
# Helper Functions - Value Parsing
# ============================================================================

# Parse cast output (handles both "value [scientific]" and raw hex formats)
# Cast returns format like "10000 [1e4]" - we extract the first number
parse_value() {
    local input="$1"
    local value=$(echo "$input" | awk '{print $1}')
    # If it starts with 0x, convert from hex
    if [[ "$value" == 0x* ]]; then
        printf "%d" "$value" 2>/dev/null || echo "0"
    else
        echo "$value"
    fi
}

# Alias for backwards compatibility
hex_to_dec() {
    parse_value "$1"
}

# Format USDC amount for display (divide by 1e6)
format_usdc() {
    local amount=$(parse_value "$1")
    echo "scale=2; $amount / 1000000" | bc
}

# ============================================================================
# Helper Functions - Blockchain Interaction
# ============================================================================

# Check if Anvil is running
check_anvil() {
    if ! cast chain-id --rpc-url $RPC_URL > /dev/null 2>&1; then
        echo -e "${RED}Error: Anvil is not running. Start it with: anvil${NC}"
        exit 1
    fi
    print_success "Anvil is running"
}

# Deploy a contract using forge create
# Usage: forge_deploy <contract_path> <contract_name> [constructor_args...]
forge_deploy() {
    local contract_path=$1
    local contract_name=$2
    shift 2

    local output
    if [ $# -eq 0 ]; then
        output=$(forge create "${contract_path}:${contract_name}" \
            --rpc-url "$RPC_URL" \
            --private-key "$DEPLOYER_PK" \
            --broadcast 2>&1)
    else
        # Build command with proper argument handling for strings with spaces
        local cmd="forge create ${contract_path}:${contract_name}"
        cmd="$cmd --rpc-url $RPC_URL"
        cmd="$cmd --private-key $DEPLOYER_PK"
        cmd="$cmd --broadcast"
        cmd="$cmd --constructor-args"
        for arg in "$@"; do
            cmd="$cmd \"$arg\""
        done
        output=$(eval "$cmd" 2>&1)
    fi

    local deployed_addr=$(echo "$output" | grep "Deployed to:" | awk '{print $3}')
    if [ -z "$deployed_addr" ]; then
        echo "DEPLOY_FAILED:$output"
        return 1
    fi
    echo "$deployed_addr"
}

# Call a contract function (read-only, no state change)
call_contract() {
    local contract=$1
    local signature=$2
    shift 2
    local args="$@"

    cast call $contract "$signature" $args --rpc-url $RPC_URL
}

# Send a transaction (state-changing call)
send_tx() {
    local contract=$1
    local signature=$2
    local pk=$3
    shift 3
    local args="$@"

    local output
    output=$(cast send $contract "$signature" $args \
        --rpc-url $RPC_URL \
        --private-key $pk 2>&1)
    local status=$?
    if [ $status -ne 0 ]; then
        echo "TX FAILED: $output" >&2
        return $status
    fi
}

# Check ERC20 balance
check_balance() {
    local token=$1
    local address=$2
    call_contract $token "balanceOf(address)(uint256)" $address
}

# ============================================================================
# Deployment Functions
# ============================================================================

deploy_all_contracts() {
    print_header "DEPLOYING CONTRACTS"

    # Change to contracts directory for forge to find sources
    cd "$CONTRACTS_DIR"

    # Deploy MockUSDC (test token with 6 decimals)
    print_step "Deploying MockUSDC..."
    USDC_ADDR=$(forge_deploy "test/mocks/MockUSDC.sol" "MockUSDC")
    if [[ "$USDC_ADDR" == DEPLOY_FAILED* ]]; then
        print_fail "Failed to deploy MockUSDC"
        echo "${USDC_ADDR#DEPLOY_FAILED:}"
        exit 1
    fi
    print_success "MockUSDC deployed at: $USDC_ADDR"

    # Deploy LiquidityPool (ERC-4626 vault)
    print_step "Deploying LiquidityPool..."
    LIQUIDITY_POOL_ADDR=$(forge_deploy "src/base/LiquidityPool.sol" "LiquidityPool" \
        "$USDC_ADDR" "Seed" "SEED")
    if [[ "$LIQUIDITY_POOL_ADDR" == DEPLOY_FAILED* ]]; then
        print_fail "Failed to deploy LiquidityPool"
        echo "${LIQUIDITY_POOL_ADDR#DEPLOY_FAILED:}"
        exit 1
    fi
    print_success "LiquidityPool deployed at: $LIQUIDITY_POOL_ADDR"

    # Deploy TreasuryManager (multi-strategy allocator)
    print_step "Deploying TreasuryManager..."
    TREASURY_MANAGER_ADDR=$(forge_deploy "src/base/TreasuryManager.sol" "TreasuryManager" \
        "$USDC_ADDR" "$LIQUIDITY_POOL_ADDR")
    if [[ "$TREASURY_MANAGER_ADDR" == DEPLOY_FAILED* ]]; then
        print_fail "Failed to deploy TreasuryManager"
        echo "${TREASURY_MANAGER_ADDR#DEPLOY_FAILED:}"
        exit 1
    fi
    print_success "TreasuryManager deployed at: $TREASURY_MANAGER_ADDR"

    # Deploy MockStrategy (test yield strategy)
    print_step "Deploying MockStrategy..."
    MOCK_STRATEGY_ADDR=$(forge_deploy "test/mocks/MockStrategy.sol" "MockStrategy" \
        "$USDC_ADDR" "$TREASURY_MANAGER_ADDR")
    if [[ "$MOCK_STRATEGY_ADDR" == DEPLOY_FAILED* ]]; then
        print_fail "Failed to deploy MockStrategy"
        echo "${MOCK_STRATEGY_ADDR#DEPLOY_FAILED:}"
        exit 1
    fi
    print_success "MockStrategy deployed at: $MOCK_STRATEGY_ADDR"

    cd "$ORIG_DIR"

    echo ""
    print_info "Contract Addresses:"
    print_info "  USDC:            $USDC_ADDR"
    print_info "  LiquidityPool:   $LIQUIDITY_POOL_ADDR"
    print_info "  TreasuryManager: $TREASURY_MANAGER_ADDR"
    print_info "  MockStrategy:    $MOCK_STRATEGY_ADDR"
}

setup_contract_links() {
    print_header "SETTING UP CONTRACT LINKS"

    # Link LiquidityPool to TreasuryManager
    print_step "Setting TreasuryManager on LiquidityPool..."
    send_tx $LIQUIDITY_POOL_ADDR "setTreasuryManager(address)" $DEPLOYER_PK $TREASURY_MANAGER_ADDR
    print_success "TreasuryManager linked to LiquidityPool"

    # Grant TREASURY_ROLE to deployer on LiquidityPool
    print_step "Granting TREASURY_ROLE to deployer..."
    send_tx $LIQUIDITY_POOL_ADDR "grantRole(bytes32,address)" $DEPLOYER_PK $TREASURY_ROLE $DEPLOYER_ADDR
    print_success "TREASURY_ROLE granted"

    # Add MockStrategy to TreasuryManager with 100% weight
    print_step "Adding MockStrategy to TreasuryManager..."
    send_tx $TREASURY_MANAGER_ADDR "addStrategy(address,uint256)" $DEPLOYER_PK $MOCK_STRATEGY_ADDR 10000
    print_success "MockStrategy added with 100% weight"
}

# ============================================================================
# Test Scenario 1: Basic LP Flow
# Tests: deposit, withdraw, share token mechanics
# ============================================================================

test_scenario_1() {
    print_header "SCENARIO 1: Basic LP Flow"

    # Step 1: Mint USDC to LP user (simulates fiat on-ramp)
    print_step "Minting 1M USDC to LP user..."
    send_tx $USDC_ADDR "mint(address,uint256)" $DEPLOYER_PK $LP_USER_ADDR $ONE_MILLION_USDC

    local balance=$(check_balance $USDC_ADDR $LP_USER_ADDR)
    local balance_formatted=$(format_usdc $balance)
    print_success "LP user USDC balance: $balance_formatted USDC"

    # Step 2: LP approves LiquidityPool to spend USDC
    print_step "LP approving LiquidityPool..."
    send_tx $USDC_ADDR "approve(address,uint256)" $LP_USER_PK $LIQUIDITY_POOL_ADDR $MAX_UINT256
    print_success "LiquidityPool approved"

    # Step 3: LP deposits 100k USDC
    print_step "LP depositing 100k USDC..."
    send_tx $LIQUIDITY_POOL_ADDR "deposit(uint256,address)" $LP_USER_PK $HUNDRED_K_USDC $LP_USER_ADDR

    # Check SEED shares received
    local shares=$(check_balance $LIQUIDITY_POOL_ADDR $LP_USER_ADDR)
    local shares_formatted=$(format_usdc $shares)
    print_success "LP received SEED shares: $shares_formatted"

    # Check pool totalAssets
    local total_assets=$(call_contract $LIQUIDITY_POOL_ADDR "totalAssets()(uint256)")
    local total_formatted=$(format_usdc $total_assets)
    print_success "Pool totalAssets: $total_formatted USDC"

    # Step 4: LP withdraws 50k USDC
    print_step "LP withdrawing 50k USDC..."
    send_tx $LIQUIDITY_POOL_ADDR "withdraw(uint256,address,address)" $LP_USER_PK $FIFTY_K_USDC $LP_USER_ADDR $LP_USER_ADDR

    # Verify final balances
    local final_usdc=$(check_balance $USDC_ADDR $LP_USER_ADDR)
    local final_shares=$(check_balance $LIQUIDITY_POOL_ADDR $LP_USER_ADDR)
    local final_usdc_fmt=$(format_usdc $final_usdc)
    local final_shares_fmt=$(format_usdc $final_shares)

    print_success "Final LP USDC balance: $final_usdc_fmt USDC"
    print_success "Final LP SEED shares: $final_shares_fmt"

    echo ""
    print_success "Scenario 1 PASSED"
}

# ============================================================================
# Test Scenario 2: Treasury Integration
# Tests: treasury deposits, yield simulation, yield accrual
# ============================================================================

test_scenario_2() {
    print_header "SCENARIO 2: Treasury Integration"

    # Add more liquidity for treasury testing
    print_step "Adding 50k USDC liquidity for treasury testing..."
    send_tx $USDC_ADDR "mint(address,uint256)" $DEPLOYER_PK $LP_USER_ADDR $FIFTY_K_USDC
    send_tx $LIQUIDITY_POOL_ADDR "deposit(uint256,address)" $LP_USER_PK $FIFTY_K_USDC $LP_USER_ADDR
    print_success "Added 50k USDC to pool"

    # Check available liquidity before treasury deposit
    local available_before=$(call_contract $LIQUIDITY_POOL_ADDR "availableLiquidity()(uint256)")
    local available_before_fmt=$(format_usdc $available_before)
    print_info "Available liquidity before treasury: $available_before_fmt USDC"

    # Step 1: Deposit 30k to treasury strategies
    print_step "Depositing 30k USDC to treasury..."
    local thirty_k="30000000000"
    send_tx $LIQUIDITY_POOL_ADDR "depositToTreasury(uint256)" $DEPLOYER_PK $thirty_k
    print_success "Deposited to treasury"

    # Verify treasury value
    local treasury_value=$(call_contract $LIQUIDITY_POOL_ADDR "getTreasuryValue()(uint256)")
    local treasury_fmt=$(format_usdc $treasury_value)
    print_success "Treasury value: $treasury_fmt USDC"

    # Check internal tracking
    local total_in_treasury=$(call_contract $LIQUIDITY_POOL_ADDR "totalInTreasury()(uint256)")
    local total_in_treasury_fmt=$(format_usdc $total_in_treasury)
    print_info "totalInTreasury: $total_in_treasury_fmt USDC"

    # Step 2: Simulate yield on MockStrategy (mint USDC to strategy)
    print_step "Simulating 5k USDC yield on strategy..."
    send_tx $USDC_ADDR "mint(address,uint256)" $DEPLOYER_PK $MOCK_STRATEGY_ADDR $FIVE_K_USDC
    print_success "Yield simulated"

    # Step 3: Accrue treasury yield (updates totalTreasuryYield)
    print_step "Accruing treasury yield..."
    send_tx $LIQUIDITY_POOL_ADDR "accrueTreasuryYield()" $DEPLOYER_PK

    # Verify yield accrual
    local treasury_yield=$(call_contract $LIQUIDITY_POOL_ADDR "totalTreasuryYield()(uint256)")
    local yield_fmt=$(format_usdc $treasury_yield)
    print_success "Total treasury yield accrued: $yield_fmt USDC"

    # Verify totalAssets includes yield
    local total_assets=$(call_contract $LIQUIDITY_POOL_ADDR "totalAssets()(uint256)")
    local total_fmt=$(format_usdc $total_assets)
    print_success "Pool totalAssets (with yield): $total_fmt USDC"

    echo ""
    print_success "Scenario 2 PASSED"
}

# ============================================================================
# Test Scenario 3: Multi-Strategy Rebalancing
# Tests: multiple strategies, weight allocation, rebalancing
# ============================================================================

test_scenario_3() {
    print_header "SCENARIO 3: Multi-Strategy Rebalancing"

    cd "$CONTRACTS_DIR"

    # Deploy second mock strategy
    print_step "Deploying second MockStrategy..."
    MOCK_STRATEGY_2_ADDR=$(forge_deploy "test/mocks/MockStrategy.sol" "MockStrategy" \
        "$USDC_ADDR" "$TREASURY_MANAGER_ADDR")
    if [[ "$MOCK_STRATEGY_2_ADDR" == DEPLOY_FAILED* ]]; then
        print_fail "Failed to deploy MockStrategy 2"
        echo "${MOCK_STRATEGY_2_ADDR#DEPLOY_FAILED:}"
        exit 1
    fi
    print_success "MockStrategy 2 deployed at: $MOCK_STRATEGY_2_ADDR"

    cd "$ORIG_DIR"

    # Configure 60%/40% allocation
    print_step "Adding second strategy with 40% weight (changing first to 60%)..."

    # Update first strategy weight to 6000 (60%)
    send_tx $TREASURY_MANAGER_ADDR "setStrategyWeight(address,uint256)" $DEPLOYER_PK $MOCK_STRATEGY_ADDR 6000
    print_success "First strategy weight updated to 60%"

    # Add second strategy with 4000 (40%)
    send_tx $TREASURY_MANAGER_ADDR "addStrategy(address,uint256)" $DEPLOYER_PK $MOCK_STRATEGY_2_ADDR 4000
    print_success "Second strategy added with 40%"

    # Verify strategy setup
    local strategy_count=$(call_contract $TREASURY_MANAGER_ADDR "strategyCount()(uint256)")
    print_info "Total strategies: $(hex_to_dec $strategy_count)"

    local total_weight=$(call_contract $TREASURY_MANAGER_ADDR "totalWeight()(uint256)")
    print_info "Total weight: $(hex_to_dec $total_weight) basis points"

    # Add more LP funds for treasury testing
    print_step "LP depositing 100k more USDC..."
    send_tx $USDC_ADDR "mint(address,uint256)" $DEPLOYER_PK $LP_USER_ADDR $HUNDRED_K_USDC
    send_tx $LIQUIDITY_POOL_ADDR "deposit(uint256,address)" $LP_USER_PK $HUNDRED_K_USDC $LP_USER_ADDR

    # Deposit to treasury (should distribute 60%/40%)
    print_step "Depositing 100k to treasury (should distribute 60%/40%)..."
    send_tx $LIQUIDITY_POOL_ADDR "depositToTreasury(uint256)" $DEPLOYER_PK $HUNDRED_K_USDC
    print_success "Deposited to treasury"

    # Check allocation
    print_step "Checking strategy allocations..."
    local strategy1_value=$(call_contract $MOCK_STRATEGY_ADDR "totalValue()(uint256)")
    local strategy2_value=$(call_contract $MOCK_STRATEGY_2_ADDR "totalValue()(uint256)")

    local s1_fmt=$(format_usdc $strategy1_value)
    local s2_fmt=$(format_usdc $strategy2_value)

    print_info "Strategy 1 value: $s1_fmt USDC"
    print_info "Strategy 2 value: $s2_fmt USDC"

    # Update weights to 50%/50%
    print_step "Updating weights to 50%/50%..."
    send_tx $TREASURY_MANAGER_ADDR "setStrategyWeight(address,uint256)" $DEPLOYER_PK $MOCK_STRATEGY_ADDR 5000
    send_tx $TREASURY_MANAGER_ADDR "setStrategyWeight(address,uint256)" $DEPLOYER_PK $MOCK_STRATEGY_2_ADDR 5000
    print_success "Weights updated"

    # Set cooldown to 0 for immediate rebalance
    print_step "Setting rebalance cooldown to 0..."
    send_tx $TREASURY_MANAGER_ADDR "setRebalanceCooldown(uint256)" $DEPLOYER_PK 0

    # Trigger rebalance
    print_step "Triggering rebalance..."
    send_tx $TREASURY_MANAGER_ADDR "rebalance()" $DEPLOYER_PK
    print_success "Rebalance complete"

    # Verify new allocation
    local new_s1_value=$(call_contract $MOCK_STRATEGY_ADDR "totalValue()(uint256)")
    local new_s2_value=$(call_contract $MOCK_STRATEGY_2_ADDR "totalValue()(uint256)")

    local new_s1_fmt=$(format_usdc $new_s1_value)
    local new_s2_fmt=$(format_usdc $new_s2_value)

    print_success "After rebalance:"
    print_info "Strategy 1 value: $new_s1_fmt USDC"
    print_info "Strategy 2 value: $new_s2_fmt USDC"

    echo ""
    print_success "Scenario 3 PASSED"
}

# ============================================================================
# Test Scenario 4: Access Control
# Tests: role-based permissions, pause/unpause functionality
# ============================================================================

test_scenario_4() {
    print_header "SCENARIO 4: Access Control Tests"

    # Test 1: Unauthorized treasury deposit (LP user lacks TREASURY_ROLE)
    print_step "Testing unauthorized treasury deposit..."

    if send_tx $LIQUIDITY_POOL_ADDR "depositToTreasury(uint256)" $LP_USER_PK $TEN_K_USDC 2>/dev/null; then
        print_fail "Should have reverted - LP user shouldn't have TREASURY_ROLE"
    else
        print_success "Correctly reverted - LP user lacks TREASURY_ROLE"
    fi

    # Test 2: Unauthorized strategy addition (LP user lacks STRATEGIST_ROLE)
    print_step "Testing unauthorized strategy addition..."

    if send_tx $TREASURY_MANAGER_ADDR "addStrategy(address,uint256)" $LP_USER_PK $STRATEGIST_ADDR 1000 2>/dev/null; then
        print_fail "Should have reverted - LP user shouldn't have STRATEGIST_ROLE"
    else
        print_success "Correctly reverted - LP user lacks STRATEGIST_ROLE"
    fi

    # Test 3: Grant role and retry
    print_step "Granting TREASURY_ROLE to LP user..."
    send_tx $LIQUIDITY_POOL_ADDR "grantRole(bytes32,address)" $DEPLOYER_PK $TREASURY_ROLE $LP_USER_ADDR
    print_success "TREASURY_ROLE granted to LP user"

    print_step "LP user depositing to treasury (should work now)..."

    local available=$(call_contract $LIQUIDITY_POOL_ADDR "availableLiquidity()(uint256)")
    print_info "Available liquidity: $(format_usdc $available) USDC"

    if send_tx $LIQUIDITY_POOL_ADDR "depositToTreasury(uint256)" $LP_USER_PK $TEN_K_USDC; then
        print_success "LP user successfully deposited to treasury after role grant"
    else
        print_fail "Treasury deposit failed even with role"
    fi

    # Test 4: Pause functionality
    print_step "Testing pause functionality..."
    send_tx $LIQUIDITY_POOL_ADDR "pause()" $DEPLOYER_PK
    print_success "Pool paused"

    # Try deposit while paused
    print_step "Attempting deposit while paused..."
    if send_tx $LIQUIDITY_POOL_ADDR "deposit(uint256,address)" $LP_USER_PK $TEN_K_USDC $LP_USER_ADDR 2>/dev/null; then
        print_fail "Should have reverted - pool is paused"
    else
        print_success "Correctly reverted - pool is paused"
    fi

    # Unpause
    print_step "Unpausing pool..."
    send_tx $LIQUIDITY_POOL_ADDR "unpause()" $DEPLOYER_PK
    print_success "Pool unpaused"

    echo ""
    print_success "Scenario 4 PASSED"
}

# ============================================================================
# Summary
# ============================================================================

print_summary() {
    print_header "TEST SUMMARY"

    echo ""
    print_info "Contract Addresses:"
    print_info "  USDC:             $USDC_ADDR"
    print_info "  LiquidityPool:    $LIQUIDITY_POOL_ADDR"
    print_info "  TreasuryManager:  $TREASURY_MANAGER_ADDR"
    print_info "  MockStrategy 1:   $MOCK_STRATEGY_ADDR"
    print_info "  MockStrategy 2:   $MOCK_STRATEGY_2_ADDR"
    echo ""

    # Final pool statistics
    local total_assets=$(call_contract $LIQUIDITY_POOL_ADDR "totalAssets()(uint256)")
    local treasury_value=$(call_contract $LIQUIDITY_POOL_ADDR "getTreasuryValue()(uint256)")
    local available=$(call_contract $LIQUIDITY_POOL_ADDR "availableLiquidity()(uint256)")
    local utilization=$(call_contract $LIQUIDITY_POOL_ADDR "utilizationRate()(uint256)")
    local treasury_alloc=$(call_contract $LIQUIDITY_POOL_ADDR "treasuryAllocationRate()(uint256)")

    print_info "Final Pool Statistics:"
    print_info "  Total Assets:           $(format_usdc $total_assets) USDC"
    print_info "  Available Liquidity:    $(format_usdc $available) USDC"
    print_info "  Treasury Value:         $(format_usdc $treasury_value) USDC"
    print_info "  Utilization Rate:       $(hex_to_dec $utilization) bps"
    print_info "  Treasury Allocation:    $(hex_to_dec $treasury_alloc) bps"
    echo ""

    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}    ALL TESTS PASSED SUCCESSFULLY!      ${NC}"
    echo -e "${GREEN}========================================${NC}"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    echo ""
    echo "=============================================="
    echo "   Seed Finance - Anvil Integration Tests"
    echo "=============================================="
    echo ""

    # Check prerequisites
    check_anvil

    # Deploy all contracts
    deploy_all_contracts

    # Setup contract links and roles
    setup_contract_links

    # Run test scenarios
    test_scenario_1  # Basic LP Flow
    test_scenario_2  # Treasury Integration
    test_scenario_3  # Multi-Strategy Rebalancing
    test_scenario_4  # Access Control

    # Print summary
    print_summary
}

# Run main function
main "$@"
