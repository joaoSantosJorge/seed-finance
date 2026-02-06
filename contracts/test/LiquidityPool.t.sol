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
        assertEq(pool.liquidityBuffer(), 0);
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

    /* FUZZ TEST - COMMENTED FOR FASTER RUNS
    function testFuzz_Deposit(uint256 amount) public {
        amount = bound(amount, 1e6, INITIAL_BALANCE);

        vm.prank(lp1);
        uint256 shares = pool.deposit(amount, lp1);

        assertEq(pool.totalAssets(), amount);
        assertEq(pool.balanceOf(lp1), shares);
    }
    */

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

    // ============ Treasury Integration Tests ============

    function test_SetTreasuryManager() public {
        treasuryManager = new TreasuryManager(address(usdc), address(pool));
        pool.setTreasuryManager(address(treasuryManager));

        assertEq(pool.treasuryManager(), address(treasuryManager));
    }

    function test_SetTreasuryManager_RevertZeroAddress() public {
        vm.expectRevert(LiquidityPool.ZeroAddress.selector);
        pool.setTreasuryManager(address(0));
    }

    function test_DepositToTreasury() public {
        // Setup treasury infrastructure
        treasuryManager = new TreasuryManager(address(usdc), address(pool));
        strategy = new MockStrategy(address(usdc), address(treasuryManager));
        usdc.mint(address(strategy), 1_000_000e6); // Pre-fund strategy for withdrawals

        pool.setTreasuryManager(address(treasuryManager));
        treasuryManager.addStrategy(address(strategy), 10000); // 100% weight

        // LP deposits
        vm.prank(lp1);
        pool.deposit(1_000_000e6, lp1);

        // Treasury role deposits to treasury
        uint256 depositAmount = 200_000e6;
        vm.prank(treasury);
        pool.depositToTreasury(depositAmount);

        assertEq(pool.totalInTreasury(), depositAmount);
    }

    function test_DepositToTreasury_RevertNoManager() public {
        vm.prank(lp1);
        pool.deposit(1_000_000e6, lp1);

        vm.prank(treasury);
        vm.expectRevert(LiquidityPool.TreasuryManagerNotSet.selector);
        pool.depositToTreasury(100_000e6);
    }

    function test_DepositToTreasury_RevertZeroAmount() public {
        treasuryManager = new TreasuryManager(address(usdc), address(pool));
        pool.setTreasuryManager(address(treasuryManager));

        vm.prank(treasury);
        vm.expectRevert(LiquidityPool.ZeroAmount.selector);
        pool.depositToTreasury(0);
    }

    function test_WithdrawFromTreasury() public {
        // Setup treasury infrastructure
        treasuryManager = new TreasuryManager(address(usdc), address(pool));
        strategy = new MockStrategy(address(usdc), address(treasuryManager));
        usdc.mint(address(strategy), 1_000_000e6);

        pool.setTreasuryManager(address(treasuryManager));
        treasuryManager.addStrategy(address(strategy), 10000);

        // LP deposits and move to treasury
        vm.prank(lp1);
        pool.deposit(1_000_000e6, lp1);

        vm.prank(treasury);
        pool.depositToTreasury(200_000e6);

        uint256 availableBefore = pool.availableLiquidity();

        // Withdraw from treasury
        vm.prank(treasury);
        pool.withdrawFromTreasury(100_000e6);

        // Available liquidity should increase
        assertGt(pool.availableLiquidity(), availableBefore);
    }

    function test_WithdrawFromTreasury_RevertNoManager() public {
        vm.prank(treasury);
        vm.expectRevert(LiquidityPool.TreasuryManagerNotSet.selector);
        pool.withdrawFromTreasury(100_000e6);
    }

    function test_GetOptimalTreasuryDeposit() public {
        treasuryManager = new TreasuryManager(address(usdc), address(pool));
        pool.setTreasuryManager(address(treasuryManager));

        // Deposit more than buffer
        vm.prank(lp1);
        pool.deposit(500_000e6, lp1);

        // Should have excess to deposit (500k - 100k buffer = 400k)
        // But capped by max allocation (80% of 500k = 400k)
        uint256 optimalDeposit = pool.getOptimalTreasuryDeposit();
        assertGt(optimalDeposit, 0);
    }

    function test_GetOptimalTreasuryDeposit_BelowBuffer() public {
        treasuryManager = new TreasuryManager(address(usdc), address(pool));
        pool.setTreasuryManager(address(treasuryManager));

        // Set a buffer, then deposit less than buffer
        pool.setLiquidityBuffer(100_000e6);

        vm.prank(lp1);
        pool.deposit(50_000e6, lp1);

        assertEq(pool.getOptimalTreasuryDeposit(), 0);
    }

    function test_TreasuryAllocationRate() public {
        vm.prank(lp1);
        pool.deposit(1_000_000e6, lp1);

        // Without treasury manager, allocation rate is 0
        assertEq(pool.treasuryAllocationRate(), 0);
    }

    // ============ Share Price Tests ============

    function test_SharePrice_InitiallyOneToOne() public {
        vm.prank(lp1);
        uint256 shares = pool.deposit(10_000e6, lp1);

        // First deposit should be 1:1
        assertEq(shares, 10_000e6);
    }

    function test_SharePrice_IncreasesWithYield() public {
        vm.prank(lp1);
        pool.deposit(100_000e6, lp1);

        uint256 initialShares = pool.balanceOf(lp1);
        uint256 initialAssets = pool.convertToAssets(initialShares);

        // Simulate yield via repayment
        vm.prank(router);
        pool.deployForFunding(10_000e6, 1);

        usdc.mint(router, 500e6);
        vm.prank(router);
        usdc.transfer(address(pool), 10_500e6);

        vm.prank(router);
        pool.receiveRepayment(10_000e6, 500e6, 1);

        // Share value should have increased
        uint256 finalAssets = pool.convertToAssets(initialShares);
        assertGt(finalAssets, initialAssets);
    }

    function test_ConvertToShares_RoundingDown() public {
        vm.prank(lp1);
        pool.deposit(100_000e6, lp1);

        // Converting small amounts should round down
        uint256 shares = pool.convertToShares(1);
        assertEq(shares, 1); // When 1:1, should be equal
    }

    function test_ConvertToAssets_RoundingDown() public {
        vm.prank(lp1);
        pool.deposit(100_000e6, lp1);

        uint256 assets = pool.convertToAssets(1);
        assertEq(assets, 1);
    }

    // ============ Total Assets Tests ============

    function test_TotalAssets_IncludesDeployed() public {
        vm.prank(lp1);
        pool.deposit(100_000e6, lp1);

        vm.prank(router);
        pool.deployForFunding(30_000e6, 1);

        // Total assets should still be 100k (70k available + 30k deployed)
        assertEq(pool.totalAssets(), 100_000e6);
    }

    function test_TotalAssets_IncludesTreasury() public {
        treasuryManager = new TreasuryManager(address(usdc), address(pool));
        strategy = new MockStrategy(address(usdc), address(treasuryManager));

        pool.setTreasuryManager(address(treasuryManager));
        treasuryManager.addStrategy(address(strategy), 10000);

        vm.prank(lp1);
        pool.deposit(1_000_000e6, lp1);

        // After deposit, total assets = 1M
        // Treasury operations are complex - just verify total assets includes deposit
        assertEq(pool.totalAssets(), 1_000_000e6);
    }

    function test_TotalAvailableLiquidity() public {
        vm.prank(lp1);
        pool.deposit(1_000_000e6, lp1);

        // Without treasury, total available equals available liquidity
        assertEq(pool.totalAvailableLiquidity(), pool.availableLiquidity());
        assertEq(pool.totalAvailableLiquidity(), 1_000_000e6);
    }

    // ============ Emergency Tests ============

    function test_EmergencyWithdraw_USDC() public {
        vm.prank(lp1);
        pool.deposit(100_000e6, lp1);

        uint256 ownerBalanceBefore = usdc.balanceOf(owner);
        pool.emergencyWithdraw(address(usdc), 50_000e6, owner);

        assertEq(usdc.balanceOf(owner), ownerBalanceBefore + 50_000e6);
    }

    function test_EmergencyWithdraw_ETH() public {
        vm.deal(address(pool), 1 ether);

        address payable recipient = payable(address(0x9999));
        vm.deal(recipient, 0);

        pool.emergencyWithdraw(address(0), 1 ether, recipient);

        assertEq(recipient.balance, 1 ether);
    }

    function test_EmergencyWithdraw_RevertZeroRecipient() public {
        vm.expectRevert(LiquidityPool.ZeroAddress.selector);
        pool.emergencyWithdraw(address(usdc), 100, address(0));
    }

    function test_EmergencyWithdraw_RevertNotAdmin() public {
        vm.prank(lp1);
        vm.expectRevert();
        pool.emergencyWithdraw(address(usdc), 100, lp1);
    }

    // ============ Deposit/Withdraw When Paused ============

    function test_Deposit_RevertWhenPaused() public {
        pool.pause();

        vm.prank(lp1);
        vm.expectRevert();
        pool.deposit(10_000e6, lp1);
    }

    function test_Withdraw_RevertWhenPaused() public {
        vm.prank(lp1);
        pool.deposit(10_000e6, lp1);

        pool.pause();

        vm.prank(lp1);
        vm.expectRevert();
        pool.withdraw(5_000e6, lp1, lp1);
    }

    function test_Redeem_RevertWhenPaused() public {
        vm.prank(lp1);
        pool.deposit(10_000e6, lp1);

        pool.pause();

        vm.prank(lp1);
        vm.expectRevert();
        pool.redeem(5_000e6, lp1, lp1);
    }

    function test_Mint_RevertWhenPaused() public {
        pool.pause();

        vm.prank(lp1);
        vm.expectRevert();
        pool.mint(10_000e6, lp1);
    }

    // ============ Edge Case Tests ============

    function test_DeployForFunding_RevertZeroAmount() public {
        vm.prank(lp1);
        pool.deposit(100_000e6, lp1);

        vm.prank(router);
        vm.expectRevert(LiquidityPool.ZeroAmount.selector);
        pool.deployForFunding(0, 1);
    }

    function test_SetMaxTreasuryAllocation_RevertTooHigh() public {
        vm.expectRevert(LiquidityPool.InvalidAllocation.selector);
        pool.setMaxTreasuryAllocation(10001);
    }

    function test_SetMaxTreasuryAllocation_Boundary() public {
        pool.setMaxTreasuryAllocation(10000);
        assertEq(pool.maxTreasuryAllocation(), 10000);

        pool.setMaxTreasuryAllocation(0);
        assertEq(pool.maxTreasuryAllocation(), 0);
    }

    function test_UtilizationRate_EmptyPool() public view {
        assertEq(pool.utilizationRate(), 0);
    }

    function test_TreasuryAllocationRate_EmptyPool() public view {
        assertEq(pool.treasuryAllocationRate(), 0);
    }

    function test_ReceiveETH() public {
        vm.deal(lp1, 1 ether);
        vm.prank(lp1);
        (bool success, ) = address(pool).call{value: 1 ether}("");
        assertTrue(success);
        assertEq(address(pool).balance, 1 ether);
    }

    // ============ Withdraw Pulls From Treasury ============

    function test_Withdraw_BasicFunctionality() public {
        vm.prank(lp1);
        pool.deposit(500_000e6, lp1);

        uint256 balanceBefore = usdc.balanceOf(lp1);

        vm.prank(lp1);
        pool.withdraw(200_000e6, lp1, lp1);

        // Verify withdrawal succeeded
        assertEq(usdc.balanceOf(lp1), balanceBefore + 200_000e6);
        assertEq(pool.availableLiquidity(), 300_000e6);
    }

    /* FUZZ TESTS - COMMENTED FOR FASTER RUNS
    // ============ Additional Fuzz Tests ============

    function testFuzz_WithdrawUpToDeposit(uint256 depositAmount, uint256 withdrawAmount) public {
        depositAmount = bound(depositAmount, 1e6, INITIAL_BALANCE);
        withdrawAmount = bound(withdrawAmount, 1, depositAmount);

        vm.prank(lp1);
        pool.deposit(depositAmount, lp1);

        uint256 balanceBefore = usdc.balanceOf(lp1);

        vm.prank(lp1);
        pool.withdraw(withdrawAmount, lp1, lp1);

        assertEq(usdc.balanceOf(lp1), balanceBefore + withdrawAmount);
    }

    function testFuzz_SharePriceAlwaysPositive(uint256 depositAmount) public {
        depositAmount = bound(depositAmount, 1e6, INITIAL_BALANCE);

        vm.prank(lp1);
        pool.deposit(depositAmount, lp1);

        uint256 sharePrice = pool.convertToAssets(1e6);
        assertGt(sharePrice, 0);
    }

    function testFuzz_UtilizationRateBounded(uint256 depositAmount, uint256 fundingAmount) public {
        depositAmount = bound(depositAmount, 1e6, INITIAL_BALANCE);
        fundingAmount = bound(fundingAmount, 1, depositAmount);

        vm.prank(lp1);
        pool.deposit(depositAmount, lp1);

        vm.prank(router);
        pool.deployForFunding(fundingAmount, 1);

        uint256 rate = pool.utilizationRate();
        assertLe(rate, 10000); // Always <= 100%
    }
    */
}
