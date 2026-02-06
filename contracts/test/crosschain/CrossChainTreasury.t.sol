// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../../src/strategies/ArcUSYCStrategy.sol";
import "../../src/strategies/remote/ArcUSYCAgent.sol";
import "../mocks/MockUSDC.sol";
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
    MockCCTPMessageTransmitter public cctp;
    MockAavePool public aavePool;
    MockUSYCArc public usycVault;

    ArcUSYCStrategy public arcStrategy;

    // ============ Addresses ============

    address public owner = address(this);
    address public treasuryManager = address(0x1111);
    address public keeper = address(0x2222);
    address public user = address(0x3333);

    // Mock remote agents (simulated addresses)
    address public mockArcAgent = address(0x5555);

    // ============ Constants ============

    uint256 constant INITIAL_BALANCE = 1_000_000e6; // 1M USDC
    uint256 constant DEPOSIT_AMOUNT = 100_000e6; // 100k USDC

    // ============ Setup ============

    function setUp() public {
        // Deploy mock tokens
        usdc = new MockUSDC();

        // Deploy mock bridges
        cctp = new MockCCTPMessageTransmitter(address(usdc), 6); // Base domain = 6

        // Deploy mock yield sources
        aavePool = new MockAavePool(address(usdc));
        usycVault = new MockUSYCArc(address(usdc));

        // Deploy strategies
        arcStrategy = new ArcUSYCStrategy(
            address(usdc),
            treasuryManager,
            mockArcAgent,
            address(cctp)
        );

        // Set up keepers
        arcStrategy.setKeeper(keeper, true);

        // Fund accounts
        usdc.mint(treasuryManager, INITIAL_BALANCE);
        usdc.mint(address(cctp), INITIAL_BALANCE); // For mock CCTP mints

        // Approve strategies from treasury manager
        vm.startPrank(treasuryManager);
        usdc.approve(address(arcStrategy), type(uint256).max);
        vm.stopPrank();
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
        assertFalse(arcStrategy.isValueStale());

        // Make a deposit and confirm
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

        // Just updated - not stale
        assertFalse(arcStrategy.isValueStale());

        // Warp time past staleness threshold (1 hour)
        vm.warp(block.timestamp + 2 hours);

        // Now stale
        assertTrue(arcStrategy.isValueStale());

        // Update value - no longer stale
        vm.prank(keeper);
        arcStrategy.updateRemoteValue(DEPOSIT_AMOUNT, "");

        assertFalse(arcStrategy.isValueStale());
    }

    function test_MaxValueStaleness_CanBeUpdated() public {
        uint256 newStaleness = 2 hours;

        arcStrategy.setMaxValueStaleness(newStaleness);
        assertEq(arcStrategy.maxValueStaleness(), newStaleness);
    }

    // ============ Admin Function Tests ============

    function test_Admin_SetKeeper() public {
        address newKeeper = address(0x9999);

        arcStrategy.setKeeper(newKeeper, true);
        assertTrue(arcStrategy.keepers(newKeeper));

        arcStrategy.setKeeper(newKeeper, false);
        assertFalse(arcStrategy.keepers(newKeeper));
    }

    function test_Admin_SetRemoteAgent() public {
        address newAgent = address(0x8888);

        arcStrategy.setRemoteAgent(newAgent);
        assertEq(arcStrategy.remoteAgent(), newAgent);
    }

    function test_Admin_Activate_Deactivate() public {
        assertTrue(arcStrategy.isActive());

        arcStrategy.deactivate();
        assertFalse(arcStrategy.isActive());

        // Cannot deposit when inactive
        vm.prank(treasuryManager);
        vm.expectRevert(BaseCrossChainStrategy.StrategyNotActive.selector);
        arcStrategy.deposit(DEPOSIT_AMOUNT);

        arcStrategy.activate();
        assertTrue(arcStrategy.isActive());
    }

    function test_Admin_EmergencyWithdraw() public {
        // Fund strategy directly
        usdc.mint(address(arcStrategy), DEPOSIT_AMOUNT);

        uint256 ownerBalanceBefore = usdc.balanceOf(owner);

        arcStrategy.emergencyWithdraw();

        assertEq(usdc.balanceOf(owner), ownerBalanceBefore + DEPOSIT_AMOUNT);
        assertFalse(arcStrategy.isActive());
    }

    // ============ Edge Case Tests ============

    function test_WithdrawAll_HandlesCorrectly() public {
        // Deposit and confirm
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

        // Withdraw all
        vm.prank(treasuryManager);
        arcStrategy.withdrawAll();

        assertEq(arcStrategy.pendingWithdrawals(), DEPOSIT_AMOUNT);
        assertEq(arcStrategy.totalValue(), 0);
    }

    function test_MultipleDeposits_TrackCorrectly() public {
        uint256 firstDeposit = 50_000e6;
        uint256 secondDeposit = 30_000e6;

        // First deposit
        vm.prank(treasuryManager);
        arcStrategy.deposit(firstDeposit);

        // Second deposit
        vm.warp(block.timestamp + 1);
        vm.prank(treasuryManager);
        arcStrategy.deposit(secondDeposit);

        assertEq(arcStrategy.pendingDeposits(), firstDeposit + secondDeposit);
        assertEq(arcStrategy.totalDeposited(), firstDeposit + secondDeposit);
    }

    function test_ZeroDeposit_Reverts() public {
        vm.prank(treasuryManager);
        vm.expectRevert(BaseCrossChainStrategy.ZeroAmount.selector);
        arcStrategy.deposit(0);
    }

    function test_ZeroWithdraw_Reverts() public {
        vm.prank(treasuryManager);
        vm.expectRevert(BaseCrossChainStrategy.ZeroAmount.selector);
        arcStrategy.withdraw(0);
    }

    function test_OnlyManager_CanDeposit() public {
        vm.prank(user);
        vm.expectRevert(BaseCrossChainStrategy.OnlyTreasuryManager.selector);
        arcStrategy.deposit(DEPOSIT_AMOUNT);
    }

    function test_OnlyKeeper_CanConfirm() public {
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

        vm.prank(user);
        vm.expectRevert(ICrossChainStrategy.OnlyKeeper.selector);
        arcStrategy.confirmDeposit(transferId, DEPOSIT_AMOUNT);
    }

    function test_SupportsInstantWithdraw_ReturnsFalse() public view {
        assertFalse(arcStrategy.supportsInstantWithdraw());
        assertEq(arcStrategy.maxInstantWithdraw(), 0);
    }
}
