// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../../src/strategies/LiFiVaultStrategy.sol";
import "../../src/strategies/ArcUSYCStrategy.sol";
import "../../src/strategies/remote/LiFiVaultAgent.sol";
import "../../src/strategies/remote/ArcUSYCAgent.sol";
import "../mocks/MockUSDC.sol";
import "../mocks/crosschain/MockLiFiBridgeExecutor.sol";
import "../mocks/crosschain/MockCCTPMessageTransmitter.sol";
import "../mocks/crosschain/MockAavePool.sol";
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
    uint256 arbitrumFork;
    uint256 arcFork;

    // RPC URLs
    string constant BASE_RPC = "http://localhost:8545";
    string constant ARBITRUM_RPC = "http://localhost:8546";
    string constant ARC_RPC = "http://localhost:8547";

    // Test accounts
    address deployer = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    uint256 deployerKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    // Contract addresses (loaded from deployments)
    address baseUsdc;
    address baseLiFiBridge;
    address baseCctp;
    address lifiVaultStrategy;
    address arcUSYCStrategy;

    address arbUsdc;
    address arbAavePool;
    address arbLiFiBridge;
    address lifiVaultAgent;

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
        arbitrumFork = vm.createFork(ARBITRUM_RPC);
        arcFork = vm.createFork(ARC_RPC);

        // Load deployment addresses from environment or hardcode for testing
        // In real setup, these would be loaded from the deployment JSON
        _loadDeploymentAddresses();
    }

    function _loadDeploymentAddresses() internal {
        // For now, we'll use environment variables or test with deployed addresses
        // These should match what deploy-multi-chain.sh outputs

        // Base addresses
        baseUsdc = vm.envOr("BASE_USDC", address(0));
        baseLiFiBridge = vm.envOr("BASE_LIFI_BRIDGE", address(0));
        baseCctp = vm.envOr("BASE_CCTP", address(0));
        lifiVaultStrategy = vm.envOr("LIFI_VAULT_STRATEGY", address(0));
        arcUSYCStrategy = vm.envOr("ARC_USYC_STRATEGY", address(0));

        // Arbitrum addresses
        arbUsdc = vm.envOr("ARB_USDC", address(0));
        arbAavePool = vm.envOr("ARB_AAVE_POOL", address(0));
        arbLiFiBridge = vm.envOr("ARB_LIFI_BRIDGE", address(0));
        lifiVaultAgent = vm.envOr("LIFI_VAULT_AGENT", address(0));

        // Arc addresses
        arcUsdc = vm.envOr("ARC_USDC", address(0));
        arcUsyc = vm.envOr("ARC_USYC", address(0));
        arcCctp = vm.envOr("ARC_CCTP", address(0));
        arcUSYCAgent = vm.envOr("ARC_USYC_AGENT", address(0));
    }

    // ============ LiFi Strategy Integration Tests ============

    function test_LiFi_FullDepositFlow() public requireMultiAnvil {
        // Skip if addresses not configured
        if (lifiVaultStrategy == address(0)) {
            emit log("Skipping: LiFi strategy not deployed");
            return;
        }

        // Start on Base fork
        vm.selectFork(baseFork);

        LiFiVaultStrategy strategy = LiFiVaultStrategy(lifiVaultStrategy);
        IERC20 usdc = IERC20(baseUsdc);

        // Setup: Approve strategy
        vm.startPrank(deployer);
        usdc.approve(address(strategy), type(uint256).max);

        // Get initial state
        uint256 initialPending = strategy.pendingDeposits();

        // Deposit
        strategy.deposit(DEPOSIT_AMOUNT);

        // Verify pending deposit tracked
        assertEq(
            strategy.pendingDeposits(),
            initialPending + DEPOSIT_AMOUNT,
            "Pending deposits should increase"
        );

        vm.stopPrank();

        // Wait for relay to process (in real test, this would be async)
        // For now, we just verify the event was emitted
    }

    function test_LiFi_ValueReporting() public requireMultiAnvil {
        if (lifiVaultStrategy == address(0)) return;

        vm.selectFork(baseFork);

        LiFiVaultStrategy strategy = LiFiVaultStrategy(lifiVaultStrategy);

        // Get current state
        uint256 lastUpdate = strategy.lastValueUpdate();

        // Keeper updates value
        vm.prank(deployer);
        strategy.updateRemoteValue(DEPOSIT_AMOUNT, "");

        // Verify update
        assertGt(
            strategy.lastValueUpdate(),
            lastUpdate,
            "Last update should be newer"
        );
        assertEq(
            strategy.lastReportedValue(),
            DEPOSIT_AMOUNT,
            "Reported value should match"
        );
    }

    function test_LiFi_AgentDeposit_OnArbitrum() public requireMultiAnvil {
        if (lifiVaultAgent == address(0)) return;

        // Switch to Arbitrum fork
        vm.selectFork(arbitrumFork);

        LiFiVaultAgent agent = LiFiVaultAgent(payable(lifiVaultAgent));
        MockUSDC usdc = MockUSDC(arbUsdc);

        // Simulate USDC arriving from bridge
        vm.prank(deployer);
        usdc.mint(address(agent), DEPOSIT_AMOUNT);

        // Process deposit
        bytes32 transferId = keccak256("test_transfer");
        vm.prank(deployer);
        agent.processDeposit(transferId);

        // Verify deposited to Aave
        assertGt(agent.getCurrentValue(), 0, "Agent should have value in Aave");
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

    function test_CrossChain_ValueSync_LiFi() public requireMultiAnvil {
        if (lifiVaultStrategy == address(0) || lifiVaultAgent == address(0)) return;

        // 1. Check value on Arbitrum
        vm.selectFork(arbitrumFork);
        LiFiVaultAgent agent = LiFiVaultAgent(payable(lifiVaultAgent));
        uint256 remoteValue = agent.getCurrentValue();

        // 2. Update value on Base
        vm.selectFork(baseFork);
        LiFiVaultStrategy strategy = LiFiVaultStrategy(lifiVaultStrategy);

        vm.prank(deployer);
        strategy.updateRemoteValue(remoteValue, "");

        // 3. Verify synced
        assertEq(
            strategy.lastReportedValue(),
            remoteValue,
            "Values should be synced"
        );
    }

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

    function test_LiFi_YieldAccrual_OnArbitrum() public requireMultiAnvil {
        if (lifiVaultAgent == address(0)) return;

        vm.selectFork(arbitrumFork);

        LiFiVaultAgent agent = LiFiVaultAgent(payable(lifiVaultAgent));
        MockAavePool aavePool = MockAavePool(arbAavePool);

        // First deposit
        MockUSDC usdc = MockUSDC(arbUsdc);
        vm.prank(deployer);
        usdc.mint(address(agent), DEPOSIT_AMOUNT);

        vm.prank(deployer);
        agent.autoDeposit();

        uint256 valueBefore = agent.getCurrentValue();

        // Simulate 1 year of yield (4% APY)
        aavePool.simulateTimePassage(365 days);

        uint256 valueAfter = agent.getCurrentValue();

        // Value should have increased
        assertGt(valueAfter, valueBefore, "Value should increase with yield");

        // Yield should be approximately 4%
        uint256 yieldPercent = ((valueAfter - valueBefore) * 10000) / valueBefore;
        assertApproxEqAbs(yieldPercent, 400, 50, "Yield should be ~4%");
    }

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

    function test_LiFi_WithdrawalFlow() public requireMultiAnvil {
        if (lifiVaultStrategy == address(0)) return;

        vm.selectFork(baseFork);

        LiFiVaultStrategy strategy = LiFiVaultStrategy(lifiVaultStrategy);

        // First, confirm a deposit to have value
        bytes32 depositId = keccak256("prior_deposit");
        vm.prank(deployer);
        strategy.confirmDeposit(depositId, DEPOSIT_AMOUNT);

        // Initiate withdrawal
        vm.prank(deployer);
        strategy.withdraw(DEPOSIT_AMOUNT / 2);

        // Check pending withdrawal
        assertEq(
            strategy.pendingWithdrawals(),
            DEPOSIT_AMOUNT / 2,
            "Pending withdrawals should be tracked"
        );
    }

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

    function test_LiFi_EmergencyWithdraw_Agent() public requireMultiAnvil {
        if (lifiVaultAgent == address(0)) return;

        vm.selectFork(arbitrumFork);

        LiFiVaultAgent agent = LiFiVaultAgent(payable(lifiVaultAgent));

        // Deposit first
        MockUSDC usdc = MockUSDC(arbUsdc);
        vm.prank(deployer);
        usdc.mint(address(agent), DEPOSIT_AMOUNT);

        vm.prank(deployer);
        agent.autoDeposit();

        uint256 ownerBalanceBefore = usdc.balanceOf(deployer);

        // Emergency withdraw
        vm.prank(deployer);
        agent.emergencyWithdraw();

        uint256 ownerBalanceAfter = usdc.balanceOf(deployer);

        assertGt(
            ownerBalanceAfter,
            ownerBalanceBefore,
            "Owner should receive funds"
        );
    }

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
