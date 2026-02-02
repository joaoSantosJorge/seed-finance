// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "src/base/LiquidityPool.sol";
import "src/base/TreasuryManager.sol";
import "./mocks/MockUSDC.sol";
import "./mocks/MockStrategy.sol";

contract LiquidityPoolTest is Test {
    LiquidityPool public pool;
    TreasuryManager public treasuryManager;
    MockUSDC public usdc;
    MockStrategy public strategy;

    address public owner = address(this);
    address public lp1 = address(0x1);
    address public lp2 = address(0x2);
    address public router = address(0x3);
    address public treasury = address(0x4);

    uint256 constant INITIAL_BALANCE = 1_000_000e6; // 1M USDC

    function setUp() public {
        // Deploy MockUSDC
        usdc = new MockUSDC();

        // Deploy LiquidityPool
        pool = new LiquidityPool(IERC20(address(usdc)), "Seed", "SEED");

        // Grant roles
        pool.grantRole(pool.ROUTER_ROLE(), router);
        pool.grantRole(pool.TREASURY_ROLE(), treasury);

        // Mint USDC to LPs
        usdc.mint(lp1, INITIAL_BALANCE);
        usdc.mint(lp2, INITIAL_BALANCE);

        // Approve pool
        vm.prank(lp1);
        usdc.approve(address(pool), type(uint256).max);
        vm.prank(lp2);
        usdc.approve(address(pool), type(uint256).max);
    }

    // ============ Deployment Tests ============

    function test_Deployment() public view {
        assertEq(pool.name(), "Seed");
        assertEq(pool.symbol(), "SEED");
        assertEq(pool.asset(), address(usdc));
        assertEq(pool.totalAssets(), 0);
        assertEq(pool.liquidityBuffer(), 100_000e6);
        assertEq(pool.maxTreasuryAllocation(), 8000);
    }

    // ============ Deposit Tests ============

    function test_Deposit() public {
        uint256 depositAmount = 10_000e6;

        vm.prank(lp1);
        uint256 shares = pool.deposit(depositAmount, lp1);

        assertEq(pool.totalAssets(), depositAmount);
        assertEq(pool.balanceOf(lp1), shares);
        assertGt(shares, 0);
    }

    function test_DepositMultipleUsers() public {
        uint256 depositAmount = 10_000e6;

        vm.prank(lp1);
        pool.deposit(depositAmount, lp1);

        vm.prank(lp2);
        pool.deposit(depositAmount, lp2);

        assertEq(pool.totalAssets(), depositAmount * 2);
    }

    function testFuzz_Deposit(uint256 amount) public {
        amount = bound(amount, 1e6, INITIAL_BALANCE);

        vm.prank(lp1);
        uint256 shares = pool.deposit(amount, lp1);

        assertEq(pool.totalAssets(), amount);
        assertEq(pool.balanceOf(lp1), shares);
    }

    // ============ Withdrawal Tests ============

    function test_Withdraw() public {
        uint256 depositAmount = 10_000e6;
        uint256 withdrawAmount = 5_000e6;

        vm.prank(lp1);
        pool.deposit(depositAmount, lp1);

        uint256 balanceBefore = usdc.balanceOf(lp1);

        vm.prank(lp1);
        pool.withdraw(withdrawAmount, lp1, lp1);

        assertEq(usdc.balanceOf(lp1) - balanceBefore, withdrawAmount);
    }

    function test_Redeem() public {
        uint256 depositAmount = 10_000e6;

        vm.prank(lp1);
        pool.deposit(depositAmount, lp1);

        uint256 shares = pool.balanceOf(lp1);
        uint256 halfShares = shares / 2;

        vm.prank(lp1);
        pool.redeem(halfShares, lp1, lp1);

        assertEq(pool.balanceOf(lp1), shares - halfShares);
    }

    // ============ Invoice Funding Tests ============

    function test_DeployForFunding() public {
        uint256 depositAmount = 100_000e6;
        uint256 fundingAmount = 10_000e6;

        vm.prank(lp1);
        pool.deposit(depositAmount, lp1);

        vm.prank(router);
        bool success = pool.deployForFunding(fundingAmount, 1);

        assertTrue(success);
        assertEq(pool.totalDeployed(), fundingAmount);
        assertEq(usdc.balanceOf(router), fundingAmount);
    }

    function test_DeployForFunding_InsufficientLiquidity() public {
        uint256 depositAmount = 10_000e6;
        uint256 fundingAmount = 20_000e6;

        vm.prank(lp1);
        pool.deposit(depositAmount, lp1);

        // When insufficient liquidity, pool tries to withdraw from treasury first
        // Since no treasury is set, it reverts with TreasuryManagerNotSet
        vm.prank(router);
        vm.expectRevert(LiquidityPool.TreasuryManagerNotSet.selector);
        pool.deployForFunding(fundingAmount, 1);
    }

    function test_ReceiveRepayment() public {
        uint256 depositAmount = 100_000e6;
        uint256 fundingAmount = 10_000e6;
        uint256 yieldAmount = 500e6;
        uint256 repaymentAmount = fundingAmount + yieldAmount;

        vm.prank(lp1);
        pool.deposit(depositAmount, lp1);

        vm.prank(router);
        pool.deployForFunding(fundingAmount, 1);

        // Simulate repayment
        usdc.mint(router, yieldAmount);
        vm.prank(router);
        usdc.transfer(address(pool), repaymentAmount);

        vm.prank(router);
        pool.receiveRepayment(fundingAmount, yieldAmount, 1);

        assertEq(pool.totalDeployed(), 0);
        assertEq(pool.totalInvoiceYield(), yieldAmount);
    }

    // ============ Utilization Tests ============

    function test_UtilizationRate() public {
        uint256 depositAmount = 100_000e6;
        uint256 fundingAmount = 50_000e6;

        vm.prank(lp1);
        pool.deposit(depositAmount, lp1);

        vm.prank(router);
        pool.deployForFunding(fundingAmount, 1);

        // 50% utilization = 5000 bps
        assertEq(pool.utilizationRate(), 5000);
    }

    function test_AvailableLiquidity() public {
        uint256 depositAmount = 100_000e6;
        uint256 fundingAmount = 30_000e6;

        vm.prank(lp1);
        pool.deposit(depositAmount, lp1);

        vm.prank(router);
        pool.deployForFunding(fundingAmount, 1);

        assertEq(pool.availableLiquidity(), depositAmount - fundingAmount);
    }

    // ============ Admin Tests ============

    function test_SetLiquidityBuffer() public {
        uint256 newBuffer = 200_000e6;
        pool.setLiquidityBuffer(newBuffer);
        assertEq(pool.liquidityBuffer(), newBuffer);
    }

    function test_SetMaxTreasuryAllocation() public {
        uint256 newAllocation = 5000; // 50%
        pool.setMaxTreasuryAllocation(newAllocation);
        assertEq(pool.maxTreasuryAllocation(), newAllocation);
    }

    function test_Pause() public {
        pool.pause();
        assertTrue(pool.paused());

        vm.prank(lp1);
        vm.expectRevert();
        pool.deposit(10_000e6, lp1);
    }

    function test_Unpause() public {
        pool.pause();
        pool.unpause();
        assertFalse(pool.paused());

        vm.prank(lp1);
        pool.deposit(10_000e6, lp1);
    }

    // ============ Access Control Tests ============

    function test_OnlyRouterCanDeploy() public {
        uint256 depositAmount = 100_000e6;

        vm.prank(lp1);
        pool.deposit(depositAmount, lp1);

        vm.prank(lp1);
        vm.expectRevert();
        pool.deployForFunding(10_000e6, 1);
    }

    function test_OnlyTreasuryCanDepositToTreasury() public {
        // First setup treasury manager
        treasuryManager = new TreasuryManager(address(usdc), address(pool));
        pool.setTreasuryManager(address(treasuryManager));

        vm.prank(lp1);
        pool.deposit(1_000_000e6, lp1);

        vm.prank(lp1);
        vm.expectRevert();
        pool.depositToTreasury(100_000e6);
    }
}
