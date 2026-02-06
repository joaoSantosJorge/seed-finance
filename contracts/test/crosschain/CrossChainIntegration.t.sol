// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../../src/strategies/ArcUSYCStrategy.sol";
import "../../src/strategies/remote/ArcUSYCAgent.sol";
import "../mocks/MockUSDC.sol";
import "../mocks/crosschain/MockCCTPMessageTransmitter.sol";
import "../mocks/crosschain/MockUSYCArc.sol";

/**
 * @title CrossChainIntegrationTest
 * @notice Integration tests for cross-chain treasury strategies
 * @dev These tests require:
 *      1. MULTI_ANVIL=true environment variable
 *      2. Multi-anvil environment running (./start-multi-anvil.sh)
 *      3. Contracts deployed (./deploy-multi-chain.sh)
 *      4. Relay service running (npx ts-node scripts/relay/relay.ts)
 *
 * Run with: MULTI_ANVIL=true forge test --match-contract CrossChainIntegration
 */
contract CrossChainIntegrationTest is Test {
    // Skip if MULTI_ANVIL is not set
    modifier requireMultiAnvil() {
        if (bytes(vm.envOr("MULTI_ANVIL", string(""))).length == 0) {
            vm.skip(true);
        }
        _;
    }

    // ============ Fork Configuration ============

    uint256 baseFork;
    uint256 arcFork;

    // RPC URLs
    string constant BASE_RPC = "http://localhost:8545";
    string constant ARC_RPC = "http://localhost:8547";

    // Test accounts
    address deployer = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    uint256 deployerKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    // Contract addresses (loaded from deployments)
    address baseUsdc;
    address baseCctp;
    address arcUSYCStrategy;

    address arcUsdc;
    address arcUsyc;
    address arcCctp;
    address arcUSYCAgent;

    // Constants
    uint256 constant DEPOSIT_AMOUNT = 100_000e6; // 100k USDC

    // ============ Setup ============

    function setUp() public requireMultiAnvil {
        // Create forks
        baseFork = vm.createFork(BASE_RPC);
        arcFork = vm.createFork(ARC_RPC);

        // Load deployment addresses from environment or hardcode for testing
        _loadDeploymentAddresses();
    }

    function _loadDeploymentAddresses() internal {
        // Base addresses
        baseUsdc = vm.envOr("BASE_USDC", address(0));
        baseCctp = vm.envOr("BASE_CCTP", address(0));
        arcUSYCStrategy = vm.envOr("ARC_USYC_STRATEGY", address(0));

        // Arc addresses
        arcUsdc = vm.envOr("ARC_USDC", address(0));
        arcUsyc = vm.envOr("ARC_USYC", address(0));
        arcCctp = vm.envOr("ARC_CCTP", address(0));
        arcUSYCAgent = vm.envOr("ARC_USYC_AGENT", address(0));
    }

    // ============ Arc USYC Strategy Integration Tests ============

    function test_Arc_FullDepositFlow() public requireMultiAnvil {
        if (arcUSYCStrategy == address(0)) return;

        vm.selectFork(baseFork);

        ArcUSYCStrategy strategy = ArcUSYCStrategy(arcUSYCStrategy);
        IERC20 usdc = IERC20(baseUsdc);

        vm.startPrank(deployer);
        usdc.approve(address(strategy), type(uint256).max);

        uint256 initialPending = strategy.pendingDeposits();

        // Deposit initiates CCTP burn
        strategy.deposit(DEPOSIT_AMOUNT);

        assertEq(
            strategy.pendingDeposits(),
            initialPending + DEPOSIT_AMOUNT,
            "Pending should increase"
        );

        vm.stopPrank();
    }

    function test_Arc_AgentDeposit_OnArc() public requireMultiAnvil {
        if (arcUSYCAgent == address(0)) return;

        vm.selectFork(arcFork);

        ArcUSYCAgent agent = ArcUSYCAgent(payable(arcUSYCAgent));
        MockUSDC usdc = MockUSDC(arcUsdc);

        // Simulate USDC arriving from CCTP
        vm.prank(deployer);
        usdc.mint(address(agent), DEPOSIT_AMOUNT);

        // Process deposit
        bytes32 transferId = keccak256("test_cctp_transfer");
        vm.prank(deployer);
        agent.processDeposit(transferId);

        // Verify deposited to USYC
        assertGt(agent.getCurrentValue(), 0, "Agent should have USYC value");
    }

    // ============ Cross-Chain Value Sync Tests ============

    function test_CrossChain_ValueSync_Arc() public requireMultiAnvil {
        if (arcUSYCStrategy == address(0) || arcUSYCAgent == address(0)) return;

        // 1. Check value on Arc
        vm.selectFork(arcFork);
        ArcUSYCAgent agent = ArcUSYCAgent(payable(arcUSYCAgent));
        uint256 remoteValue = agent.getCurrentValue();

        // 2. Update value on Base
        vm.selectFork(baseFork);
        ArcUSYCStrategy strategy = ArcUSYCStrategy(arcUSYCStrategy);

        vm.prank(deployer);
        strategy.updateRemoteValue(remoteValue, "");

        // 3. Verify synced
        assertEq(
            strategy.lastReportedValue(),
            remoteValue,
            "Values should be synced"
        );
    }

    // ============ Yield Accrual Tests ============

    function test_Arc_YieldAccrual_OnArc() public requireMultiAnvil {
        if (arcUSYCAgent == address(0)) return;

        vm.selectFork(arcFork);

        ArcUSYCAgent agent = ArcUSYCAgent(payable(arcUSYCAgent));
        MockUSYCArc usycVault = MockUSYCArc(arcUsyc);

        // First deposit
        MockUSDC usdc = MockUSDC(arcUsdc);
        vm.prank(deployer);
        usdc.mint(address(agent), DEPOSIT_AMOUNT);

        vm.prank(deployer);
        agent.autoDeposit();

        uint256 valueBefore = agent.getCurrentValue();

        // Simulate 1 year of yield (4.5% APY)
        usycVault.simulateTimePassage(365 days);

        uint256 valueAfter = agent.getCurrentValue();

        assertGt(valueAfter, valueBefore, "Value should increase with yield");

        uint256 yieldPercent = ((valueAfter - valueBefore) * 10000) / valueBefore;
        assertApproxEqAbs(yieldPercent, 450, 50, "Yield should be ~4.5%");
    }

    // ============ Withdrawal Tests ============

    function test_Arc_WithdrawalFlow() public requireMultiAnvil {
        if (arcUSYCStrategy == address(0)) return;

        vm.selectFork(baseFork);

        ArcUSYCStrategy strategy = ArcUSYCStrategy(arcUSYCStrategy);

        // Confirm a deposit
        bytes32 depositId = keccak256("prior_arc_deposit");
        vm.prank(deployer);
        strategy.confirmDeposit(depositId, DEPOSIT_AMOUNT);

        // Initiate withdrawal
        vm.prank(deployer);
        strategy.withdraw(DEPOSIT_AMOUNT / 2);

        assertEq(
            strategy.pendingWithdrawals(),
            DEPOSIT_AMOUNT / 2,
            "Pending withdrawals tracked"
        );
    }

    // ============ Emergency Tests ============

    function test_Arc_EmergencyWithdraw_Agent() public requireMultiAnvil {
        if (arcUSYCAgent == address(0)) return;

        vm.selectFork(arcFork);

        ArcUSYCAgent agent = ArcUSYCAgent(payable(arcUSYCAgent));

        // Deposit first
        MockUSDC usdc = MockUSDC(arcUsdc);
        vm.prank(deployer);
        usdc.mint(address(agent), DEPOSIT_AMOUNT);

        vm.prank(deployer);
        agent.autoDeposit();

        uint256 ownerBalanceBefore = usdc.balanceOf(deployer);

        vm.prank(deployer);
        agent.emergencyWithdraw();

        uint256 ownerBalanceAfter = usdc.balanceOf(deployer);

        assertGt(ownerBalanceAfter, ownerBalanceBefore, "Owner should receive");
    }
}
