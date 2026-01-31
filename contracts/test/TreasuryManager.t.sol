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
}
