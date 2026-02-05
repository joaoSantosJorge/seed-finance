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
 * @title CrossChainTreasuryTest
 * @notice Unit tests for cross-chain treasury strategies using mocks
 * @dev Single-anvil tests that mock all cross-chain interactions
 */
contract CrossChainTreasuryTest is Test {
    // ============ Contracts ============

    MockUSDC public usdc;
    MockLiFiBridgeExecutor public lifiBridge;
    MockCCTPMessageTransmitter public cctp;
    MockAavePool public aavePool;
    MockUSYCArc public usycVault;

    LiFiVaultStrategy public lifiStrategy;
    ArcUSYCStrategy public arcStrategy;

    // ============ Addresses ============

    address public owner = address(this);
    address public treasuryManager = address(0x1111);
    address public keeper = address(0x2222);
    address public user = address(0x3333);

    // Mock remote agents (simulated addresses)
    address public mockLiFiAgent = address(0x4444);
    address public mockArcAgent = address(0x5555);

    // ============ Constants ============

    uint256 constant INITIAL_BALANCE = 1_000_000e6; // 1M USDC
    uint256 constant DEPOSIT_AMOUNT = 100_000e6; // 100k USDC

    // ============ Setup ============

    function setUp() public {
        // Deploy mock tokens
        usdc = new MockUSDC();

        // Deploy mock bridges
        lifiBridge = new MockLiFiBridgeExecutor();
        cctp = new MockCCTPMessageTransmitter(address(usdc), 6); // Base domain = 6

        // Deploy mock yield sources
        aavePool = new MockAavePool(address(usdc));
        usycVault = new MockUSYCArc(address(usdc));

        // Deploy strategies
        lifiStrategy = new LiFiVaultStrategy(
            address(usdc),
            treasuryManager,
            mockLiFiAgent,
            address(lifiBridge)
        );

        arcStrategy = new ArcUSYCStrategy(
            address(usdc),
            treasuryManager,
            mockArcAgent,
            address(cctp)
        );

        // Set up keepers
        lifiStrategy.setKeeper(keeper, true);
        arcStrategy.setKeeper(keeper, true);

        // Fund accounts
        usdc.mint(treasuryManager, INITIAL_BALANCE);
        usdc.mint(address(lifiBridge), INITIAL_BALANCE); // For mock bridge
        usdc.mint(address(cctp), INITIAL_BALANCE); // For mock CCTP mints

        // Approve strategies from treasury manager
        vm.startPrank(treasuryManager);
        usdc.approve(address(lifiStrategy), type(uint256).max);
        usdc.approve(address(arcStrategy), type(uint256).max);
        vm.stopPrank();
    }

    // ============ LiFiVaultStrategy Tests ============

    function test_LiFi_Deposit_InitiatesBridge() public {
        vm.prank(treasuryManager);
        uint256 shares = lifiStrategy.deposit(DEPOSIT_AMOUNT);

        // Cross-chain strategies return 0 shares
        assertEq(shares, 0);

        // Check pending deposit tracked
        assertEq(lifiStrategy.pendingDeposits(), DEPOSIT_AMOUNT);
        assertEq(lifiStrategy.totalDeposited(), DEPOSIT_AMOUNT);

        // Total value includes pending
        assertEq(lifiStrategy.totalValue(), DEPOSIT_AMOUNT);
    }

    function test_LiFi_Deposit_BelowMinimum_Reverts() public {
        uint256 smallAmount = 1e6; // 1 USDC

        vm.expectRevert(abi.encodeWithSelector(
            LiFiVaultStrategy.AmountBelowMinimum.selector,
            smallAmount,
            lifiStrategy.minBridgeAmount()
        ));
        vm.prank(treasuryManager);
        lifiStrategy.deposit(smallAmount);
    }

    function test_LiFi_ConfirmDeposit_UpdatesValue() public {
        // Deposit
        vm.prank(treasuryManager);
        lifiStrategy.deposit(DEPOSIT_AMOUNT);

        // Get the pending deposit transfer ID
        // We can derive it from internal counter (first deposit = counter 0)
        bytes32 transferId = keccak256(
            abi.encodePacked(
                address(lifiStrategy),
                block.chainid,
                uint256(0),
                block.timestamp
            )
        );

        // Confirm deposit
        vm.prank(keeper);
        lifiStrategy.confirmDeposit(transferId, DEPOSIT_AMOUNT);

        // Check state updated
        assertEq(lifiStrategy.pendingDeposits(), 0);
        assertEq(lifiStrategy.lastReportedValue(), DEPOSIT_AMOUNT);
        assertEq(lifiStrategy.totalValue(), DEPOSIT_AMOUNT);
    }

    function test_LiFi_UpdateRemoteValue_TracksYield() public {
        // Deposit and confirm
        vm.prank(treasuryManager);
        lifiStrategy.deposit(DEPOSIT_AMOUNT);

        bytes32 transferId = keccak256(
            abi.encodePacked(
                address(lifiStrategy),
                block.chainid,
                uint256(0),
                block.timestamp
            )
        );

        vm.prank(keeper);
        lifiStrategy.confirmDeposit(transferId, DEPOSIT_AMOUNT);

        // Simulate yield accrual (4% APY over 1 year)
        uint256 valueWithYield = DEPOSIT_AMOUNT * 104 / 100;

        vm.prank(keeper);
        lifiStrategy.updateRemoteValue(valueWithYield, "");

        assertEq(lifiStrategy.lastReportedValue(), valueWithYield);
        assertEq(lifiStrategy.totalValue(), valueWithYield);

        // Check yield calculation
        assertEq(lifiStrategy.yieldEarned(), valueWithYield - DEPOSIT_AMOUNT);
    }

    function test_LiFi_Withdraw_CreatesRequest() public {
        // Setup: deposit and confirm
        vm.prank(treasuryManager);
        lifiStrategy.deposit(DEPOSIT_AMOUNT);

        bytes32 depositId = keccak256(
            abi.encodePacked(
                address(lifiStrategy),
                block.chainid,
                uint256(0),
                block.timestamp
            )
        );

        vm.prank(keeper);
        lifiStrategy.confirmDeposit(depositId, DEPOSIT_AMOUNT);

        // Withdraw half
        uint256 withdrawAmount = DEPOSIT_AMOUNT / 2;

        vm.prank(treasuryManager);
        uint256 received = lifiStrategy.withdraw(withdrawAmount);

        // Returns 0 initially (async)
        assertEq(received, 0);

        // Check pending withdrawal
        assertEq(lifiStrategy.pendingWithdrawals(), withdrawAmount);

        // Value reduced by pending withdrawal
        assertEq(lifiStrategy.totalValue(), DEPOSIT_AMOUNT - withdrawAmount);
    }

    function test_LiFi_ReceiveWithdrawal_TransfersToManager() public {
        // Setup: deposit, confirm, withdraw
        vm.prank(treasuryManager);
        lifiStrategy.deposit(DEPOSIT_AMOUNT);

        bytes32 depositId = keccak256(
            abi.encodePacked(
                address(lifiStrategy),
                block.chainid,
                uint256(0),
                block.timestamp
            )
        );

        vm.prank(keeper);
        lifiStrategy.confirmDeposit(depositId, DEPOSIT_AMOUNT);

        vm.prank(treasuryManager);
        lifiStrategy.withdraw(DEPOSIT_AMOUNT);

        // Get withdrawal transfer ID (second transfer, counter = 1)
        vm.warp(block.timestamp + 1); // Ensure different timestamp
        bytes32 withdrawId = keccak256(
            abi.encodePacked(
                address(lifiStrategy),
                block.chainid,
                uint256(1),
                block.timestamp - 1 // Original timestamp
            )
        );

        // Simulate funds arriving back
        usdc.mint(address(lifiStrategy), DEPOSIT_AMOUNT);

        uint256 managerBalanceBefore = usdc.balanceOf(treasuryManager);

        // Keeper receives the bridged funds
        vm.prank(keeper);
        lifiStrategy.receiveBridgedFunds(withdrawId);

        // Check manager received funds
        assertEq(
            usdc.balanceOf(treasuryManager),
            managerBalanceBefore + DEPOSIT_AMOUNT
        );
    }

    function test_LiFi_OnlyManager_CanDeposit() public {
        vm.prank(user);
        vm.expectRevert(BaseCrossChainStrategy.OnlyTreasuryManager.selector);
        lifiStrategy.deposit(DEPOSIT_AMOUNT);
    }

    function test_LiFi_OnlyKeeper_CanConfirm() public {
        vm.prank(treasuryManager);
        lifiStrategy.deposit(DEPOSIT_AMOUNT);

        bytes32 transferId = keccak256(
            abi.encodePacked(
                address(lifiStrategy),
                block.chainid,
                uint256(0),
                block.timestamp
            )
        );

        vm.prank(user);
        vm.expectRevert(ICrossChainStrategy.OnlyKeeper.selector);
        lifiStrategy.confirmDeposit(transferId, DEPOSIT_AMOUNT);
    }

    function test_LiFi_SupportsInstantWithdraw_ReturnsFalse() public view {
        assertFalse(lifiStrategy.supportsInstantWithdraw());
        assertEq(lifiStrategy.maxInstantWithdraw(), 0);
    }

    // ============ ArcUSYCStrategy Tests ============

    function test_Arc_Deposit_InitiatesCCTPBurn() public {
        vm.prank(treasuryManager);
        uint256 shares = arcStrategy.deposit(DEPOSIT_AMOUNT);

        assertEq(shares, 0);
        assertEq(arcStrategy.pendingDeposits(), DEPOSIT_AMOUNT);
        assertEq(arcStrategy.totalDeposited(), DEPOSIT_AMOUNT);
    }

    function test_Arc_ConfirmDeposit_UpdatesValue() public {
        vm.prank(treasuryManager);
        arcStrategy.deposit(DEPOSIT_AMOUNT);

        bytes32 transferId = keccak256(
            abi.encodePacked(
                address(arcStrategy),
                block.chainid,
                uint256(0),
                block.timestamp
            )
        );

        vm.prank(keeper);
        arcStrategy.confirmDeposit(transferId, DEPOSIT_AMOUNT);

        assertEq(arcStrategy.pendingDeposits(), 0);
        assertEq(arcStrategy.lastReportedValue(), DEPOSIT_AMOUNT);
    }

    function test_Arc_Withdraw_CreatesRequest() public {
        // Setup
        vm.prank(treasuryManager);
        arcStrategy.deposit(DEPOSIT_AMOUNT);

        bytes32 depositId = keccak256(
            abi.encodePacked(
                address(arcStrategy),
                block.chainid,
                uint256(0),
                block.timestamp
            )
        );

        vm.prank(keeper);
        arcStrategy.confirmDeposit(depositId, DEPOSIT_AMOUNT);

        // Withdraw
        vm.prank(treasuryManager);
        arcStrategy.withdraw(DEPOSIT_AMOUNT);

        assertEq(arcStrategy.pendingWithdrawals(), DEPOSIT_AMOUNT);
    }

    function test_Arc_ReceiveCCTPFunds_TransfersToManager() public {
        // Setup
        vm.prank(treasuryManager);
        arcStrategy.deposit(DEPOSIT_AMOUNT);

        bytes32 depositId = keccak256(
            abi.encodePacked(
                address(arcStrategy),
                block.chainid,
                uint256(0),
                block.timestamp
            )
        );

        vm.prank(keeper);
        arcStrategy.confirmDeposit(depositId, DEPOSIT_AMOUNT);

        vm.prank(treasuryManager);
        arcStrategy.withdraw(DEPOSIT_AMOUNT);

        bytes32 withdrawId = keccak256(
            abi.encodePacked(
                address(arcStrategy),
                block.chainid,
                uint256(1),
                block.timestamp
            )
        );

        // Simulate CCTP minting USDC to strategy
        usdc.mint(address(arcStrategy), DEPOSIT_AMOUNT);

        uint256 managerBalanceBefore = usdc.balanceOf(treasuryManager);

        vm.prank(keeper);
        arcStrategy.receiveCCTPFunds(withdrawId, 0);

        assertEq(
            usdc.balanceOf(treasuryManager),
            managerBalanceBefore + DEPOSIT_AMOUNT
        );
    }

    // ============ Value Staleness Tests ============

    function test_ValueStaleness_TracksProperly() public {
        // Initial state - not stale (no updates yet, but also no deposits)
        assertFalse(lifiStrategy.isValueStale());

        // Make a deposit and confirm
        vm.prank(treasuryManager);
        lifiStrategy.deposit(DEPOSIT_AMOUNT);

        bytes32 transferId = keccak256(
            abi.encodePacked(
                address(lifiStrategy),
                block.chainid,
                uint256(0),
                block.timestamp
            )
        );

        vm.prank(keeper);
        lifiStrategy.confirmDeposit(transferId, DEPOSIT_AMOUNT);

        // Just updated - not stale
        assertFalse(lifiStrategy.isValueStale());

        // Warp time past staleness threshold (1 hour)
        vm.warp(block.timestamp + 2 hours);

        // Now stale
        assertTrue(lifiStrategy.isValueStale());

        // Update value - no longer stale
        vm.prank(keeper);
        lifiStrategy.updateRemoteValue(DEPOSIT_AMOUNT, "");

        assertFalse(lifiStrategy.isValueStale());
    }

    function test_MaxValueStaleness_CanBeUpdated() public {
        uint256 newStaleness = 2 hours;

        lifiStrategy.setMaxValueStaleness(newStaleness);
        assertEq(lifiStrategy.maxValueStaleness(), newStaleness);
    }

    // ============ Admin Function Tests ============

    function test_Admin_SetKeeper() public {
        address newKeeper = address(0x9999);

        lifiStrategy.setKeeper(newKeeper, true);
        assertTrue(lifiStrategy.keepers(newKeeper));

        lifiStrategy.setKeeper(newKeeper, false);
        assertFalse(lifiStrategy.keepers(newKeeper));
    }

    function test_Admin_SetRemoteAgent() public {
        address newAgent = address(0x8888);

        lifiStrategy.setRemoteAgent(newAgent);
        assertEq(lifiStrategy.remoteAgent(), newAgent);
    }

    function test_Admin_Activate_Deactivate() public {
        assertTrue(lifiStrategy.isActive());

        lifiStrategy.deactivate();
        assertFalse(lifiStrategy.isActive());

        // Cannot deposit when inactive
        vm.prank(treasuryManager);
        vm.expectRevert(BaseCrossChainStrategy.StrategyNotActive.selector);
        lifiStrategy.deposit(DEPOSIT_AMOUNT);

        lifiStrategy.activate();
        assertTrue(lifiStrategy.isActive());
    }

    function test_Admin_EmergencyWithdraw() public {
        // Fund strategy directly
        usdc.mint(address(lifiStrategy), DEPOSIT_AMOUNT);

        uint256 ownerBalanceBefore = usdc.balanceOf(owner);

        lifiStrategy.emergencyWithdraw();

        assertEq(usdc.balanceOf(owner), ownerBalanceBefore + DEPOSIT_AMOUNT);
        assertFalse(lifiStrategy.isActive());
    }

    // ============ Edge Case Tests ============

    function test_WithdrawAll_HandlesCorrectly() public {
        // Deposit and confirm
        vm.prank(treasuryManager);
        lifiStrategy.deposit(DEPOSIT_AMOUNT);

        bytes32 depositId = keccak256(
            abi.encodePacked(
                address(lifiStrategy),
                block.chainid,
                uint256(0),
                block.timestamp
            )
        );

        vm.prank(keeper);
        lifiStrategy.confirmDeposit(depositId, DEPOSIT_AMOUNT);

        // Withdraw all
        vm.prank(treasuryManager);
        lifiStrategy.withdrawAll();

        assertEq(lifiStrategy.pendingWithdrawals(), DEPOSIT_AMOUNT);
        assertEq(lifiStrategy.totalValue(), 0);
    }

    function test_MultipleDeposits_TrackCorrectly() public {
        uint256 firstDeposit = 50_000e6;
        uint256 secondDeposit = 30_000e6;

        // First deposit
        vm.prank(treasuryManager);
        lifiStrategy.deposit(firstDeposit);

        // Second deposit
        vm.warp(block.timestamp + 1);
        vm.prank(treasuryManager);
        lifiStrategy.deposit(secondDeposit);

        assertEq(lifiStrategy.pendingDeposits(), firstDeposit + secondDeposit);
        assertEq(lifiStrategy.totalDeposited(), firstDeposit + secondDeposit);
    }

    function test_ZeroDeposit_Reverts() public {
        vm.prank(treasuryManager);
        vm.expectRevert(BaseCrossChainStrategy.ZeroAmount.selector);
        lifiStrategy.deposit(0);
    }

    function test_ZeroWithdraw_Reverts() public {
        vm.prank(treasuryManager);
        vm.expectRevert(BaseCrossChainStrategy.ZeroAmount.selector);
        lifiStrategy.withdraw(0);
    }
}
