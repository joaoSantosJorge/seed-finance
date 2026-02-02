// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/strategies/BaseTreasuryStrategy.sol";
import "./mocks/MockUSDC.sol";

/**
 * @title MockConcreteStrategy
 * @notice Concrete implementation of BaseTreasuryStrategy for testing
 */
contract MockConcreteStrategy is BaseTreasuryStrategy {
    uint256 public mockYieldRate = 0; // Basis points of yield to add

    constructor(
        address asset_,
        address treasuryManager_,
        uint256 initialAPY
    ) BaseTreasuryStrategy(asset_, "Mock Concrete Strategy", treasuryManager_, initialAPY) {}

    function _deposit(uint256 amount) internal override returns (uint256 shares) {
        // Just hold the assets
        return amount;
    }

    function _withdraw(uint256 amount) internal override returns (uint256 received) {
        uint256 balance = _asset.balanceOf(address(this));
        received = amount > balance ? balance : amount;
        return received;
    }

    function _withdrawAll() internal override returns (uint256 received) {
        received = _asset.balanceOf(address(this));
        return received;
    }

    function _totalValue() internal view override returns (uint256) {
        uint256 balance = _asset.balanceOf(address(this));
        // Apply mock yield
        return balance + (balance * mockYieldRate / 10000);
    }

    // Test helper to simulate yield
    function setMockYieldRate(uint256 _rate) external {
        mockYieldRate = _rate;
    }
}

/**
 * @title BaseTreasuryStrategy Test Suite
 * @notice Tests for the abstract BaseTreasuryStrategy contract
 */
contract BaseTreasuryStrategyTest is Test {
    MockConcreteStrategy public strategy;
    MockUSDC public usdc;

    address public owner = address(this);
    address public treasuryManager = address(0x1);
    address public randomUser = address(0x2);

    uint256 constant INITIAL_APY = 500; // 5%
    uint256 constant DEPOSIT_AMOUNT = 10_000e6;

    function setUp() public {
        // Deploy USDC
        usdc = new MockUSDC();

        // Deploy strategy
        strategy = new MockConcreteStrategy(
            address(usdc),
            treasuryManager,
            INITIAL_APY
        );

        // Mint USDC
        usdc.mint(treasuryManager, 1_000_000e6);
        // Don't pre-fund strategy - let deposit tests provide funds

        // Approve strategy from treasury manager
        vm.prank(treasuryManager);
        usdc.approve(address(strategy), type(uint256).max);
    }

    // ============ Constructor Tests ============

    function test_Constructor() public view {
        assertEq(address(strategy._asset()), address(usdc));
        assertEq(strategy.name(), "Mock Concrete Strategy");
        assertEq(strategy.treasuryManager(), treasuryManager);
        assertEq(strategy.estimatedAPY(), INITIAL_APY);
        assertTrue(strategy.isActive());
    }

    function test_Constructor_RevertZeroAsset() public {
        vm.expectRevert(BaseTreasuryStrategy.ZeroAddress.selector);
        new MockConcreteStrategy(address(0), treasuryManager, INITIAL_APY);
    }

    function test_Constructor_RevertZeroManager() public {
        vm.expectRevert(BaseTreasuryStrategy.ZeroAddress.selector);
        new MockConcreteStrategy(address(usdc), address(0), INITIAL_APY);
    }

    // ============ Deposit Tests ============

    function test_Deposit_Success() public {
        vm.prank(treasuryManager);
        uint256 shares = strategy.deposit(DEPOSIT_AMOUNT);

        assertEq(shares, DEPOSIT_AMOUNT);
        assertEq(strategy.totalDeposited(), DEPOSIT_AMOUNT);
    }

    function test_Deposit_RevertNotManager() public {
        vm.prank(randomUser);
        vm.expectRevert(BaseTreasuryStrategy.OnlyTreasuryManager.selector);
        strategy.deposit(DEPOSIT_AMOUNT);
    }

    function test_Deposit_RevertZeroAmount() public {
        vm.prank(treasuryManager);
        vm.expectRevert(BaseTreasuryStrategy.ZeroAmount.selector);
        strategy.deposit(0);
    }

    function test_Deposit_RevertWhenNotActive() public {
        strategy.deactivate();

        vm.prank(treasuryManager);
        vm.expectRevert(BaseTreasuryStrategy.StrategyNotActive.selector);
        strategy.deposit(DEPOSIT_AMOUNT);
    }

    function test_Deposit_MultipleDeposits() public {
        vm.startPrank(treasuryManager);

        strategy.deposit(DEPOSIT_AMOUNT);
        strategy.deposit(DEPOSIT_AMOUNT);

        vm.stopPrank();

        assertEq(strategy.totalDeposited(), DEPOSIT_AMOUNT * 2);
    }

    // ============ Withdraw Tests ============

    function test_Withdraw_Success() public {
        // First deposit
        vm.prank(treasuryManager);
        strategy.deposit(DEPOSIT_AMOUNT);

        uint256 balanceBefore = usdc.balanceOf(treasuryManager);

        // Then withdraw
        vm.prank(treasuryManager);
        uint256 received = strategy.withdraw(DEPOSIT_AMOUNT);

        assertEq(received, DEPOSIT_AMOUNT);
        assertEq(usdc.balanceOf(treasuryManager), balanceBefore + DEPOSIT_AMOUNT);
    }

    function test_Withdraw_RevertNotManager() public {
        vm.prank(randomUser);
        vm.expectRevert(BaseTreasuryStrategy.OnlyTreasuryManager.selector);
        strategy.withdraw(DEPOSIT_AMOUNT);
    }

    function test_Withdraw_RevertZeroAmount() public {
        vm.prank(treasuryManager);
        vm.expectRevert(BaseTreasuryStrategy.ZeroAmount.selector);
        strategy.withdraw(0);
    }

    function test_Withdraw_PartialAmount() public {
        vm.prank(treasuryManager);
        strategy.deposit(DEPOSIT_AMOUNT);

        vm.prank(treasuryManager);
        uint256 received = strategy.withdraw(DEPOSIT_AMOUNT / 2);

        assertEq(received, DEPOSIT_AMOUNT / 2);
        // totalDeposited tracking should be updated
    }

    function test_Withdraw_CanWithdrawWhenInactive() public {
        vm.prank(treasuryManager);
        strategy.deposit(DEPOSIT_AMOUNT);

        strategy.deactivate();

        // Should still be able to withdraw when inactive
        vm.prank(treasuryManager);
        uint256 received = strategy.withdraw(DEPOSIT_AMOUNT);

        assertEq(received, DEPOSIT_AMOUNT);
    }

    // ============ WithdrawAll Tests ============

    function test_WithdrawAll_Success() public {
        vm.prank(treasuryManager);
        strategy.deposit(DEPOSIT_AMOUNT);

        uint256 balanceBefore = usdc.balanceOf(treasuryManager);

        vm.prank(treasuryManager);
        uint256 received = strategy.withdrawAll();

        assertEq(received, DEPOSIT_AMOUNT);
        assertEq(usdc.balanceOf(treasuryManager), balanceBefore + DEPOSIT_AMOUNT);
        assertEq(strategy.totalDeposited(), 0);
    }

    function test_WithdrawAll_RevertNotManager() public {
        vm.prank(randomUser);
        vm.expectRevert(BaseTreasuryStrategy.OnlyTreasuryManager.selector);
        strategy.withdrawAll();
    }

    function test_WithdrawAll_ZeroBalance() public {
        // Create new strategy with no balance
        MockConcreteStrategy newStrategy = new MockConcreteStrategy(
            address(usdc),
            treasuryManager,
            INITIAL_APY
        );

        vm.prank(treasuryManager);
        uint256 received = newStrategy.withdrawAll();

        assertEq(received, 0);
    }

    // ============ View Functions Tests ============

    function test_TotalValue() public {
        vm.prank(treasuryManager);
        strategy.deposit(DEPOSIT_AMOUNT);

        assertEq(strategy.totalValue(), DEPOSIT_AMOUNT);
    }

    function test_TotalValue_WithYield() public {
        vm.prank(treasuryManager);
        strategy.deposit(DEPOSIT_AMOUNT);

        // Simulate 10% yield
        strategy.setMockYieldRate(1000);

        uint256 expectedValue = DEPOSIT_AMOUNT + (DEPOSIT_AMOUNT * 1000 / 10000);
        assertEq(strategy.totalValue(), expectedValue);
    }

    function test_Asset() public view {
        assertEq(strategy.asset(), address(usdc));
    }

    function test_Name() public view {
        assertEq(strategy.name(), "Mock Concrete Strategy");
    }

    function test_SupportsInstantWithdraw() public view {
        assertTrue(strategy.supportsInstantWithdraw());
    }

    function test_MaxInstantWithdraw() public {
        vm.prank(treasuryManager);
        strategy.deposit(DEPOSIT_AMOUNT);

        assertEq(strategy.maxInstantWithdraw(), DEPOSIT_AMOUNT);
    }

    function test_YieldEarned_NoYield() public {
        vm.prank(treasuryManager);
        strategy.deposit(DEPOSIT_AMOUNT);

        assertEq(strategy.yieldEarned(), 0);
    }

    function test_YieldEarned_WithYield() public {
        vm.prank(treasuryManager);
        strategy.deposit(DEPOSIT_AMOUNT);

        // Simulate 5% yield
        strategy.setMockYieldRate(500);

        uint256 expectedYield = DEPOSIT_AMOUNT * 500 / 10000;
        assertEq(strategy.yieldEarned(), expectedYield);
    }

    // ============ Admin Functions Tests ============

    function test_SetTreasuryManager_Success() public {
        address newManager = address(0x999);
        strategy.setTreasuryManager(newManager);

        assertEq(strategy.treasuryManager(), newManager);
    }

    function test_SetTreasuryManager_RevertZeroAddress() public {
        vm.expectRevert(BaseTreasuryStrategy.ZeroAddress.selector);
        strategy.setTreasuryManager(address(0));
    }

    function test_SetTreasuryManager_RevertNotOwner() public {
        vm.prank(randomUser);
        vm.expectRevert();
        strategy.setTreasuryManager(address(0x999));
    }

    function test_SetEstimatedAPY_Success() public {
        uint256 newAPY = 1000; // 10%
        strategy.setEstimatedAPY(newAPY);

        assertEq(strategy.estimatedAPY(), newAPY);
    }

    function test_SetEstimatedAPY_RevertNotOwner() public {
        vm.prank(randomUser);
        vm.expectRevert();
        strategy.setEstimatedAPY(1000);
    }

    function test_Activate() public {
        strategy.deactivate();
        assertFalse(strategy.isActive());

        strategy.activate();
        assertTrue(strategy.isActive());
    }

    function test_Activate_RevertNotOwner() public {
        vm.prank(randomUser);
        vm.expectRevert();
        strategy.activate();
    }

    function test_Deactivate() public {
        assertTrue(strategy.isActive());

        strategy.deactivate();
        assertFalse(strategy.isActive());
    }

    function test_Deactivate_RevertNotOwner() public {
        vm.prank(randomUser);
        vm.expectRevert();
        strategy.deactivate();
    }

    // ============ Emergency Withdraw Tests ============

    function test_EmergencyWithdraw_Success() public {
        vm.prank(treasuryManager);
        strategy.deposit(DEPOSIT_AMOUNT);

        uint256 ownerBalanceBefore = usdc.balanceOf(owner);

        strategy.emergencyWithdraw();

        assertEq(usdc.balanceOf(owner), ownerBalanceBefore + DEPOSIT_AMOUNT);
        assertEq(strategy.totalDeposited(), 0);
        assertFalse(strategy.isActive());
    }

    function test_EmergencyWithdraw_RevertNotOwner() public {
        vm.prank(randomUser);
        vm.expectRevert();
        strategy.emergencyWithdraw();
    }

    // ============ Rescue Tokens Tests ============

    function test_RescueTokens_Success() public {
        // Create another token
        MockUSDC otherToken = new MockUSDC();
        otherToken.mint(address(strategy), 1000e6);

        strategy.rescueTokens(address(otherToken), 1000e6);

        assertEq(otherToken.balanceOf(owner), 1000e6);
    }

    function test_RescueTokens_RevertMainAsset() public {
        vm.expectRevert("Cannot rescue main asset");
        strategy.rescueTokens(address(usdc), 1000e6);
    }

    function test_RescueTokens_RevertNotOwner() public {
        MockUSDC otherToken = new MockUSDC();
        otherToken.mint(address(strategy), 1000e6);

        vm.prank(randomUser);
        vm.expectRevert();
        strategy.rescueTokens(address(otherToken), 1000e6);
    }

    /* FUZZ TESTS - COMMENTED FOR FASTER RUNS
    // ============ Fuzz Tests ============

    function testFuzz_Deposit(uint256 amount) public {
        amount = bound(amount, 1, usdc.balanceOf(treasuryManager));

        vm.prank(treasuryManager);
        uint256 shares = strategy.deposit(amount);

        assertEq(shares, amount);
        assertEq(strategy.totalDeposited(), amount);
    }

    function testFuzz_YieldEarned(uint256 yieldBps) public {
        yieldBps = bound(yieldBps, 0, 10000); // 0-100% yield

        vm.prank(treasuryManager);
        strategy.deposit(DEPOSIT_AMOUNT);

        strategy.setMockYieldRate(yieldBps);

        uint256 expectedYield = DEPOSIT_AMOUNT * yieldBps / 10000;
        assertEq(strategy.yieldEarned(), expectedYield);
    }
    */
}
