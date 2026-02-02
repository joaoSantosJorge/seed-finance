// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "src/base/TreasuryManager.sol";
import "./mocks/MockUSDC.sol";
import "./mocks/MockStrategy.sol";

contract TreasuryManagerTest is Test {
    TreasuryManager public treasuryManager;
    MockUSDC public usdc;
    MockStrategy public strategy1;
    MockStrategy public strategy2;

    address public owner = address(this);
    address public liquidityPool = address(0x1);
    address public strategist = address(0x2);

    uint256 constant INITIAL_BALANCE = 10_000_000e6; // 10M USDC

    function setUp() public {
        // Deploy MockUSDC
        usdc = new MockUSDC();

        // Deploy TreasuryManager
        treasuryManager = new TreasuryManager(address(usdc), liquidityPool);

        // Deploy MockStrategies
        strategy1 = new MockStrategy(address(usdc), address(treasuryManager));
        strategy2 = new MockStrategy(address(usdc), address(treasuryManager));

        // Grant STRATEGIST_ROLE
        treasuryManager.grantRole(treasuryManager.STRATEGIST_ROLE(), strategist);

        // Mint USDC to liquidity pool
        usdc.mint(liquidityPool, INITIAL_BALANCE);

        // Approve treasury manager from pool
        vm.prank(liquidityPool);
        usdc.approve(address(treasuryManager), type(uint256).max);
    }

    // ============ Deployment Tests ============

    function test_Deployment() public view {
        assertEq(address(treasuryManager.asset()), address(usdc));
        assertEq(treasuryManager.liquidityPool(), liquidityPool);
        assertEq(treasuryManager.strategyCount(), 0);
    }

    // ============ Strategy Management Tests ============

    function test_AddStrategy() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 10000);

        assertEq(treasuryManager.strategyCount(), 1);
        assertEq(treasuryManager.totalWeight(), 10000);
    }

    function test_AddMultipleStrategies() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 6000);

        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy2), 4000);

        assertEq(treasuryManager.strategyCount(), 2);
        assertEq(treasuryManager.totalWeight(), 10000);
    }

    function test_AddStrategy_RevertDuplicate() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 10000);

        vm.prank(strategist);
        vm.expectRevert(TreasuryManager.StrategyAlreadyExists.selector);
        treasuryManager.addStrategy(address(strategy1), 5000);
    }

    function test_RemoveStrategy() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 10000);

        vm.prank(strategist);
        treasuryManager.removeStrategy(address(strategy1));

        assertEq(treasuryManager.strategyCount(), 0);
        assertEq(treasuryManager.totalWeight(), 0);
    }

    function test_SetStrategyWeight() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 10000);

        vm.prank(strategist);
        treasuryManager.setStrategyWeight(address(strategy1), 5000);

        assertEq(treasuryManager.totalWeight(), 5000);
    }

    function test_PauseStrategy() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 10000);

        vm.prank(strategist);
        treasuryManager.pauseStrategy(address(strategy1));

        (,, , bool active,,, ) = treasuryManager.strategyInfo(address(strategy1));
        assertFalse(active);
    }

    // ============ Deposit Tests ============

    function test_Deposit() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 10000);

        uint256 depositAmount = 100_000e6;
        vm.prank(liquidityPool);
        treasuryManager.deposit(depositAmount);

        assertEq(treasuryManager.totalValue(), depositAmount);
        assertEq(strategy1.totalValue(), depositAmount);
    }

    function test_DepositDistributesByWeight() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 6000); // 60%

        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy2), 4000); // 40%

        uint256 depositAmount = 100_000e6;
        vm.prank(liquidityPool);
        treasuryManager.deposit(depositAmount);

        // Check approximate distribution (may have small rounding)
        assertApproxEqAbs(strategy1.totalValue(), 60_000e6, 1e6);
        assertApproxEqAbs(strategy2.totalValue(), 40_000e6, 1e6);
    }

    function test_Deposit_RevertWhenPaused() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 10000);

        treasuryManager.pause();

        vm.prank(liquidityPool);
        vm.expectRevert();
        treasuryManager.deposit(100_000e6);
    }

    function test_Deposit_OnlyPool() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 10000);

        vm.expectRevert(TreasuryManager.OnlyLiquidityPool.selector);
        treasuryManager.deposit(100_000e6);
    }

    // ============ Withdrawal Tests ============

    function test_Withdraw() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 10000);

        uint256 depositAmount = 100_000e6;
        vm.prank(liquidityPool);
        treasuryManager.deposit(depositAmount);

        uint256 withdrawAmount = 50_000e6;
        uint256 balanceBefore = usdc.balanceOf(liquidityPool);

        vm.prank(liquidityPool);
        treasuryManager.withdraw(withdrawAmount);

        assertEq(usdc.balanceOf(liquidityPool) - balanceBefore, withdrawAmount);
    }

    function test_WithdrawAll() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 10000);

        uint256 depositAmount = 100_000e6;
        vm.prank(liquidityPool);
        treasuryManager.deposit(depositAmount);

        uint256 balanceBefore = usdc.balanceOf(liquidityPool);

        vm.prank(liquidityPool);
        treasuryManager.withdrawAll();

        assertEq(usdc.balanceOf(liquidityPool) - balanceBefore, depositAmount);
        assertEq(treasuryManager.totalValue(), 0);
    }

    // ============ View Functions Tests ============

    function test_TotalValue() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 5000);

        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy2), 5000);

        uint256 depositAmount = 100_000e6;
        vm.prank(liquidityPool);
        treasuryManager.deposit(depositAmount);

        assertEq(treasuryManager.totalValue(), depositAmount);
    }

    function test_GetAllStrategies() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 6000);

        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy2), 4000);

        address[] memory strategies = treasuryManager.getAllStrategies();
        assertEq(strategies.length, 2);
    }

    function test_CanWithdrawInstant() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 10000);

        uint256 depositAmount = 100_000e6;
        vm.prank(liquidityPool);
        treasuryManager.deposit(depositAmount);

        (bool available, uint256 maxInstant) = treasuryManager.canWithdrawInstant(50_000e6);

        assertTrue(available);
        assertGe(maxInstant, 100_000e6);
    }

    function test_EstimatedAPY() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 10000);

        // MockStrategy has 500 bps (5%) APY
        assertEq(treasuryManager.estimatedAPY(), 500);
    }

    // ============ Admin Tests ============

    function test_SetLiquidityPool() public {
        address newPool = address(0x999);
        treasuryManager.setLiquidityPool(newPool);
        assertEq(treasuryManager.liquidityPool(), newPool);
    }

    function test_SetRebalanceCooldown() public {
        treasuryManager.setRebalanceCooldown(3600);
        assertEq(treasuryManager.rebalanceCooldown(), 3600);
    }

    function test_Pause() public {
        treasuryManager.pause();
        assertTrue(treasuryManager.paused());
    }

    function test_Unpause() public {
        treasuryManager.pause();
        treasuryManager.unpause();
        assertFalse(treasuryManager.paused());
    }

    // ============ Unpause Strategy Tests ============

    function test_UnpauseStrategy() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 10000);

        vm.prank(strategist);
        treasuryManager.pauseStrategy(address(strategy1));

        vm.prank(strategist);
        treasuryManager.unpauseStrategy(address(strategy1));

        (,, , bool active,,, ) = treasuryManager.strategyInfo(address(strategy1));
        assertTrue(active);
    }

    function test_UnpauseStrategy_RevertStrategyNotFound() public {
        vm.prank(strategist);
        vm.expectRevert(TreasuryManager.StrategyNotFound.selector);
        treasuryManager.unpauseStrategy(address(0x123));
    }

    // ============ Rebalance Tests ============

    function test_Rebalance() public {
        // Add two strategies
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 5000);

        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy2), 5000);

        // Deposit to manager
        uint256 depositAmount = 100_000e6;
        vm.prank(liquidityPool);
        treasuryManager.deposit(depositAmount);

        // Wait for cooldown
        vm.warp(block.timestamp + treasuryManager.rebalanceCooldown() + 1);

        // Rebalance
        vm.prank(strategist);
        treasuryManager.rebalance();

        // Both strategies should have roughly equal amounts
        assertApproxEqAbs(strategy1.totalValue(), 50_000e6, 1e6);
        assertApproxEqAbs(strategy2.totalValue(), 50_000e6, 1e6);
    }

    function test_Rebalance_RevertCooldown() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 10000);

        // Try to rebalance without waiting for cooldown
        vm.prank(strategist);
        vm.expectRevert(TreasuryManager.RebalanceCooldown.selector);
        treasuryManager.rebalance();
    }

    function test_Rebalance_WithZeroTotalValue() public {
        // Wait for cooldown with no strategies
        vm.warp(block.timestamp + treasuryManager.rebalanceCooldown() + 1);

        // Should not revert, just return early
        vm.prank(strategist);
        treasuryManager.rebalance();
    }

    // ============ Harvest Yield Tests ============

    function test_HarvestYield() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 10000);

        uint256 depositAmount = 100_000e6;
        vm.prank(liquidityPool);
        treasuryManager.deposit(depositAmount);

        // Move time forward
        vm.warp(block.timestamp + 1 days);

        // Simulate yield in mock strategy
        strategy1.simulateYield(5000); // 50% yield for testing

        vm.prank(strategist);
        treasuryManager.harvestYield(address(strategy1));

        // Last harvest should be updated to current timestamp
        (,,,,, uint256 addedAt, uint256 lastHarvest) = treasuryManager.strategyInfo(address(strategy1));
        assertGt(lastHarvest, addedAt);
    }

    function test_HarvestYield_RevertStrategyNotFound() public {
        vm.prank(strategist);
        vm.expectRevert(TreasuryManager.StrategyNotFound.selector);
        treasuryManager.harvestYield(address(0x123));
    }

    function test_HarvestYield_NoYield() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 10000);

        uint256 depositAmount = 100_000e6;
        vm.prank(liquidityPool);
        treasuryManager.deposit(depositAmount);

        // Harvest without any yield simulation
        vm.prank(strategist);
        treasuryManager.harvestYield(address(strategy1));

        // Should not revert, just not update if no yield
    }

    // ============ Set Withdraw Slippage Tolerance Tests ============

    function test_SetWithdrawSlippageTolerance() public {
        treasuryManager.setWithdrawSlippageTolerance(500); // 5%
        assertEq(treasuryManager.withdrawSlippageTolerance(), 500);
    }

    function test_SetWithdrawSlippageTolerance_Max() public {
        treasuryManager.setWithdrawSlippageTolerance(1000); // 10% max
        assertEq(treasuryManager.withdrawSlippageTolerance(), 1000);
    }

    function test_SetWithdrawSlippageTolerance_RevertTooHigh() public {
        vm.expectRevert("Max 10% slippage");
        treasuryManager.setWithdrawSlippageTolerance(1001);
    }

    // ============ Emergency Withdraw From Strategy Tests ============

    function test_EmergencyWithdrawFromStrategy() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 10000);

        uint256 depositAmount = 100_000e6;
        vm.prank(liquidityPool);
        treasuryManager.deposit(depositAmount);

        // Emergency withdraw
        treasuryManager.emergencyWithdrawFromStrategy(address(strategy1));

        // Strategy should be empty and paused
        assertEq(strategy1.totalValue(), 0);
        (,, , bool active,,, ) = treasuryManager.strategyInfo(address(strategy1));
        assertFalse(active);

        // Funds should be in treasury manager (not auto-sent to pool)
        assertEq(usdc.balanceOf(address(treasuryManager)), depositAmount);
    }

    function test_EmergencyWithdrawFromStrategy_RevertStrategyNotFound() public {
        vm.expectRevert(TreasuryManager.StrategyNotFound.selector);
        treasuryManager.emergencyWithdrawFromStrategy(address(0x123));
    }

    // ============ Rescue Tokens Tests ============

    function test_RescueTokens() public {
        // Send some tokens accidentally to treasury manager
        MockUSDC otherToken = new MockUSDC();
        otherToken.mint(address(treasuryManager), 1000e6);

        address recipient = address(0x999);
        treasuryManager.rescueTokens(address(otherToken), recipient, 1000e6);

        assertEq(otherToken.balanceOf(recipient), 1000e6);
    }

    function test_RescueTokens_RevertZeroAddress() public {
        vm.expectRevert(TreasuryManager.ZeroAddress.selector);
        treasuryManager.rescueTokens(address(usdc), address(0), 1000e6);
    }

    // ============ Get Strategy Allocation Tests ============

    function test_GetStrategyAllocation() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 6000);

        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy2), 4000);

        uint256 depositAmount = 100_000e6;
        vm.prank(liquidityPool);
        treasuryManager.deposit(depositAmount);

        (uint256 currentValue, uint256 targetAllocation, uint256 currentAllocation) =
            treasuryManager.getStrategyAllocation(address(strategy1));

        assertGt(currentValue, 0);
        assertEq(targetAllocation, 6000); // 60%
        assertApproxEqAbs(currentAllocation, 6000, 100); // ~60%
    }

    function test_GetStrategyAllocation_RevertStrategyNotFound() public {
        vm.expectRevert(TreasuryManager.StrategyNotFound.selector);
        treasuryManager.getStrategyAllocation(address(0x123));
    }

    // ============ Strategy Weight Tests ============

    function test_SetStrategyWeight_RevertZeroWeight() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 10000);

        vm.prank(strategist);
        vm.expectRevert(TreasuryManager.InvalidWeight.selector);
        treasuryManager.setStrategyWeight(address(strategy1), 0);
    }

    function test_SetStrategyWeight_RevertStrategyNotFound() public {
        vm.prank(strategist);
        vm.expectRevert(TreasuryManager.StrategyNotFound.selector);
        treasuryManager.setStrategyWeight(address(0x123), 5000);
    }

    // ============ Add Strategy Edge Cases ============

    function test_AddStrategy_RevertZeroAddress() public {
        vm.prank(strategist);
        vm.expectRevert(TreasuryManager.ZeroAddress.selector);
        treasuryManager.addStrategy(address(0), 10000);
    }

    function test_AddStrategy_RevertZeroWeight() public {
        vm.prank(strategist);
        vm.expectRevert(TreasuryManager.InvalidWeight.selector);
        treasuryManager.addStrategy(address(strategy1), 0);
    }

    function test_AddStrategy_RevertMaxStrategies() public {
        // Add MAX_STRATEGIES strategies
        for (uint256 i = 0; i < treasuryManager.MAX_STRATEGIES(); i++) {
            MockStrategy s = new MockStrategy(address(usdc), address(treasuryManager));
            vm.prank(strategist);
            treasuryManager.addStrategy(address(s), 1000);
        }

        // Try to add one more
        MockStrategy extraStrategy = new MockStrategy(address(usdc), address(treasuryManager));
        vm.prank(strategist);
        vm.expectRevert(TreasuryManager.MaxStrategiesReached.selector);
        treasuryManager.addStrategy(address(extraStrategy), 1000);
    }

    // ============ Remove Strategy Edge Cases ============

    function test_RemoveStrategy_RevertStrategyNotFound() public {
        vm.prank(strategist);
        vm.expectRevert(TreasuryManager.StrategyNotFound.selector);
        treasuryManager.removeStrategy(address(0x123));
    }

    function test_RemoveStrategy_WithDeposits() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 10000);

        uint256 depositAmount = 100_000e6;
        vm.prank(liquidityPool);
        treasuryManager.deposit(depositAmount);

        uint256 poolBalanceBefore = usdc.balanceOf(liquidityPool);

        vm.prank(strategist);
        treasuryManager.removeStrategy(address(strategy1));

        // Funds should be returned to pool
        assertEq(usdc.balanceOf(liquidityPool), poolBalanceBefore + depositAmount);
    }

    // ============ Pause Strategy Edge Cases ============

    function test_PauseStrategy_RevertStrategyNotFound() public {
        vm.prank(strategist);
        vm.expectRevert(TreasuryManager.StrategyNotFound.selector);
        treasuryManager.pauseStrategy(address(0x123));
    }

    // ============ Deposit Edge Cases ============

    function test_Deposit_RevertZeroAmount() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 10000);

        vm.prank(liquidityPool);
        vm.expectRevert(TreasuryManager.ZeroAmount.selector);
        treasuryManager.deposit(0);
    }

    function test_Deposit_NoActiveStrategies() public {
        // Add then pause strategy
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 10000);

        vm.prank(strategist);
        treasuryManager.pauseStrategy(address(strategy1));

        uint256 depositAmount = 100_000e6;
        vm.prank(liquidityPool);
        treasuryManager.deposit(depositAmount);

        // Funds should be stuck in manager (no active strategy to deposit to)
        assertEq(usdc.balanceOf(address(treasuryManager)), depositAmount);
    }

    // ============ Withdraw Edge Cases ============

    function test_Withdraw_RevertZeroAmount() public {
        vm.prank(liquidityPool);
        vm.expectRevert(TreasuryManager.ZeroAmount.selector);
        treasuryManager.withdraw(0);
    }

    function test_Withdraw_FromManagerBalance() public {
        // Send USDC directly to manager (not via deposit)
        usdc.mint(address(treasuryManager), 50_000e6);

        vm.prank(liquidityPool);
        uint256 received = treasuryManager.withdraw(30_000e6);

        assertEq(received, 30_000e6);
    }

    function test_Withdraw_SlippageExceeded() public {
        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 10000);

        uint256 depositAmount = 100_000e6;
        vm.prank(liquidityPool);
        treasuryManager.deposit(depositAmount);

        // Set very low slippage tolerance (0%)
        treasuryManager.setWithdrawSlippageTolerance(0);

        // Simulate 60% loss in strategy
        strategy1.simulateLoss(6000);

        // Try to withdraw original amount - should fail due to slippage
        vm.prank(liquidityPool);
        vm.expectRevert(abi.encodeWithSelector(
            TreasuryManager.WithdrawalSlippageExceeded.selector,
            100_000e6, // requested
            40_000e6   // received (after 60% loss)
        ));
        treasuryManager.withdraw(100_000e6);
    }

    // ============ Set Liquidity Pool Tests ============

    function test_SetLiquidityPool_RevertZeroAddress() public {
        vm.expectRevert(TreasuryManager.ZeroAddress.selector);
        treasuryManager.setLiquidityPool(address(0));
    }

    /* FUZZ TESTS - COMMENTED FOR FASTER RUNS
    // ============ Fuzz Tests ============

    function testFuzz_Deposit(uint256 amount) public {
        vm.assume(amount > 0 && amount <= usdc.balanceOf(liquidityPool));

        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 10000);

        vm.prank(liquidityPool);
        treasuryManager.deposit(amount);

        assertEq(treasuryManager.totalValue(), amount);
    }

    function testFuzz_WithdrawPartial(uint256 depositAmount, uint256 withdrawPercent) public {
        vm.assume(depositAmount >= 1e6 && depositAmount <= 1_000_000e6);
        vm.assume(withdrawPercent >= 1 && withdrawPercent <= 100);

        vm.prank(strategist);
        treasuryManager.addStrategy(address(strategy1), 10000);

        vm.prank(liquidityPool);
        treasuryManager.deposit(depositAmount);

        uint256 withdrawAmount = (depositAmount * withdrawPercent) / 100;

        vm.prank(liquidityPool);
        uint256 received = treasuryManager.withdraw(withdrawAmount);

        assertEq(received, withdrawAmount);
    }
    */
}
