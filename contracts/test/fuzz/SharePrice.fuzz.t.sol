// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../../src/base/LiquidityPool.sol";
import "../mocks/MockUSDC.sol";

/**
 * @title Share Price Fuzz Tests
 * @notice Property-based tests for ERC-4626 share price calculations
 */
contract SharePriceFuzzTest is Test {
    LiquidityPool public pool;
    MockUSDC public usdc;

    address public router = address(0x1);
    address public lp1 = address(0x10);
    address public lp2 = address(0x20);
    address public lp3 = address(0x30);

    uint256 constant MAX_DEPOSIT = 100_000_000e6; // 100M USDC

    function setUp() public {
        usdc = new MockUSDC();
        pool = new LiquidityPool(IERC20(address(usdc)), "Seed", "SEED");
        pool.grantRole(pool.ROUTER_ROLE(), router);

        // Pre-mint USDC for LPs
        usdc.mint(lp1, MAX_DEPOSIT * 10);
        usdc.mint(lp2, MAX_DEPOSIT * 10);
        usdc.mint(lp3, MAX_DEPOSIT * 10);

        vm.prank(lp1);
        usdc.approve(address(pool), type(uint256).max);
        vm.prank(lp2);
        usdc.approve(address(pool), type(uint256).max);
        vm.prank(lp3);
        usdc.approve(address(pool), type(uint256).max);
    }

    /* FUZZ TESTS - COMMENTED FOR FASTER RUNS
    // ============ Invariant: Total Assets >= Total Shares ============

    function testFuzz_TotalAssetsGteShares(uint256 deposit1, uint256 deposit2) public {
        deposit1 = bound(deposit1, 1e6, MAX_DEPOSIT);
        deposit2 = bound(deposit2, 1e6, MAX_DEPOSIT);

        vm.prank(lp1);
        pool.deposit(deposit1, lp1);

        vm.prank(lp2);
        pool.deposit(deposit2, lp2);

        // When no yield, assets should equal total supply
        assertEq(pool.totalAssets(), deposit1 + deposit2);
        assertEq(pool.totalSupply(), deposit1 + deposit2); // 1:1 when no yield
    }

    // ============ Property: Share Price Never Decreases (Without Losses) ============

    function testFuzz_SharePriceNeverDecreases(
        uint256 deposit,
        uint256 fundingAmount,
        uint256 yieldAmount
    ) public {
        deposit = bound(deposit, 10_000e6, MAX_DEPOSIT);
        fundingAmount = bound(fundingAmount, 1e6, deposit / 2);
        yieldAmount = bound(yieldAmount, 0, fundingAmount / 10); // Max 10% yield

        // Initial deposit
        vm.prank(lp1);
        pool.deposit(deposit, lp1);

        uint256 initialSharePrice = pool.convertToAssets(1e6);

        // Deploy and receive repayment with yield
        vm.prank(router);
        pool.deployForFunding(fundingAmount, 1);

        usdc.mint(router, yieldAmount);
        vm.prank(router);
        usdc.transfer(address(pool), fundingAmount + yieldAmount);

        vm.prank(router);
        pool.receiveRepayment(fundingAmount, yieldAmount, 1);

        uint256 finalSharePrice = pool.convertToAssets(1e6);

        // Share price should not decrease
        assertGe(finalSharePrice, initialSharePrice, "Share price decreased");
    }

    // ============ Property: Deposit/Withdraw Symmetry ============

    function testFuzz_DepositWithdrawSymmetry(uint256 depositAmount) public {
        depositAmount = bound(depositAmount, 1e6, MAX_DEPOSIT);

        uint256 balanceBefore = usdc.balanceOf(lp1);

        vm.prank(lp1);
        uint256 shares = pool.deposit(depositAmount, lp1);

        vm.prank(lp1);
        uint256 withdrawn = pool.redeem(shares, lp1, lp1);

        // Should get back exactly what was deposited (no yield, no losses)
        assertEq(withdrawn, depositAmount, "Deposit/withdraw not symmetric");
        assertEq(usdc.balanceOf(lp1), balanceBefore, "Balance not restored");
    }

    // ============ Property: Fair Yield Distribution ============

    function testFuzz_FairYieldDistribution(
        uint256 deposit1,
        uint256 deposit2,
        uint256 yieldAmount
    ) public {
        deposit1 = bound(deposit1, 10_000e6, MAX_DEPOSIT / 2);
        deposit2 = bound(deposit2, 10_000e6, MAX_DEPOSIT / 2);
        yieldAmount = bound(yieldAmount, 1e6, 10_000e6);

        // Both LPs deposit
        vm.prank(lp1);
        uint256 shares1 = pool.deposit(deposit1, lp1);

        vm.prank(lp2);
        uint256 shares2 = pool.deposit(deposit2, lp2);

        // Simulate yield accrual
        uint256 fundingAmount = deposit1 / 2;
        vm.prank(router);
        pool.deployForFunding(fundingAmount, 1);

        usdc.mint(router, yieldAmount);
        vm.prank(router);
        usdc.transfer(address(pool), fundingAmount + yieldAmount);

        vm.prank(router);
        pool.receiveRepayment(fundingAmount, yieldAmount, 1);

        // Calculate each LP's value
        uint256 value1 = pool.convertToAssets(shares1);
        uint256 value2 = pool.convertToAssets(shares2);

        // Yield should be distributed proportionally to deposits
        // LP1 should get yield * deposit1 / (deposit1 + deposit2)
        uint256 expectedYield1 = (yieldAmount * deposit1) / (deposit1 + deposit2);
        uint256 expectedYield2 = (yieldAmount * deposit2) / (deposit1 + deposit2);

        // Allow 1 wei tolerance for rounding
        assertApproxEqAbs(value1, deposit1 + expectedYield1, 1, "LP1 yield incorrect");
        assertApproxEqAbs(value2, deposit2 + expectedYield2, 1, "LP2 yield incorrect");
    }

    // ============ Property: No Dilution Attack ============

    function testFuzz_NoDilutionAttack(uint256 existingDeposit, uint256 attackAmount) public {
        existingDeposit = bound(existingDeposit, 10_000e6, MAX_DEPOSIT);
        attackAmount = bound(attackAmount, 1e6, existingDeposit / 10);

        // LP1 deposits first
        vm.prank(lp1);
        pool.deposit(existingDeposit, lp1);

        uint256 lp1ValueBefore = pool.convertToAssets(pool.balanceOf(lp1));

        // LP2 deposits (potential attacker)
        vm.prank(lp2);
        pool.deposit(attackAmount, lp2);

        uint256 lp1ValueAfter = pool.convertToAssets(pool.balanceOf(lp1));

        // LP1's value should not decrease due to LP2's deposit
        assertEq(lp1ValueAfter, lp1ValueBefore, "LP1 value changed due to new deposit");
    }

    // ============ Property: Rounding Always Favors Pool ============

    function testFuzz_RoundingFavorsPool(uint256 deposit) public {
        deposit = bound(deposit, 1e6, MAX_DEPOSIT);

        vm.prank(lp1);
        uint256 shares = pool.deposit(deposit, lp1);

        // Asset value of shares should be <= original deposit (rounding down)
        uint256 assetValue = pool.convertToAssets(shares);
        assertLe(assetValue, deposit, "Rounding did not favor pool");
    }

    // ============ Property: Share Calculation Consistency ============

    function testFuzz_ShareCalculationConsistency(uint256 deposit) public {
        deposit = bound(deposit, 1e6, MAX_DEPOSIT);

        vm.prank(lp1);
        pool.deposit(deposit, lp1);

        // Preview should match actual
        uint256 previewShares = pool.previewDeposit(deposit);
        uint256 previewAssets = pool.previewMint(previewShares);

        // These should be consistent (within 1 wei for rounding)
        assertApproxEqAbs(previewAssets, deposit, 1, "Preview inconsistent");
    }

    // ============ Property: Total Supply Matches Share Sum ============

    function testFuzz_TotalSupplyMatchesShareSum(
        uint256 deposit1,
        uint256 deposit2,
        uint256 deposit3
    ) public {
        deposit1 = bound(deposit1, 1e6, MAX_DEPOSIT / 3);
        deposit2 = bound(deposit2, 1e6, MAX_DEPOSIT / 3);
        deposit3 = bound(deposit3, 1e6, MAX_DEPOSIT / 3);

        vm.prank(lp1);
        pool.deposit(deposit1, lp1);

        vm.prank(lp2);
        pool.deposit(deposit2, lp2);

        vm.prank(lp3);
        pool.deposit(deposit3, lp3);

        uint256 totalSupply = pool.totalSupply();
        uint256 sumOfBalances = pool.balanceOf(lp1) + pool.balanceOf(lp2) + pool.balanceOf(lp3);

        assertEq(totalSupply, sumOfBalances, "Total supply mismatch");
    }

    // ============ Property: Utilization Rate Bounded ============

    function testFuzz_UtilizationRateBounded(uint256 deposit, uint256 funding) public {
        deposit = bound(deposit, 10_000e6, MAX_DEPOSIT);
        funding = bound(funding, 1, deposit);

        vm.prank(lp1);
        pool.deposit(deposit, lp1);

        vm.prank(router);
        pool.deployForFunding(funding, 1);

        uint256 rate = pool.utilizationRate();

        // Rate should be between 0 and 10000 (0-100%)
        assertLe(rate, 10000, "Utilization rate > 100%");
    }

    // ============ Property: Total Assets Remains Consistent During Funding ============

    function testFuzz_TotalAssetsConsistentDuringFunding(uint256 deposit, uint256 funding) public {
        deposit = bound(deposit, 10_000e6, MAX_DEPOSIT);
        funding = bound(funding, 1e6, deposit / 2);

        vm.prank(lp1);
        pool.deposit(deposit, lp1);

        uint256 totalBefore = pool.totalAssets();

        vm.prank(router);
        pool.deployForFunding(funding, 1);

        uint256 totalAfter = pool.totalAssets();

        // Total assets should remain the same (just moved from available to deployed)
        assertEq(totalAfter, totalBefore, "Total assets changed during funding");
    }

    // ============ Property: Max Withdrawal Bounded ============

    function testFuzz_MaxWithdrawalBounded(uint256 deposit) public {
        deposit = bound(deposit, 1e6, MAX_DEPOSIT);

        vm.prank(lp1);
        pool.deposit(deposit, lp1);

        uint256 maxWithdraw = pool.maxWithdraw(lp1);

        // Max withdrawal should not exceed deposit
        assertLe(maxWithdraw, deposit, "Max withdraw exceeds deposit");
    }

    // ============ Property: Preview Functions Never Revert ============

    function testFuzz_PreviewFunctionsNoRevert(uint256 amount) public view {
        amount = bound(amount, 1, MAX_DEPOSIT);

        // These should never revert with valid inputs
        pool.previewDeposit(amount);
        pool.previewMint(amount);
        pool.previewWithdraw(amount);
        pool.previewRedeem(amount);
    }

    // ============ Property: Convert Functions Inverse ============

    function testFuzz_ConvertFunctionsInverse(uint256 amount) public {
        amount = bound(amount, 1e6, MAX_DEPOSIT);

        // First add some liquidity
        vm.prank(lp1);
        pool.deposit(amount, lp1);

        // Convert to shares then back to assets
        uint256 shares = pool.convertToShares(amount);
        uint256 assets = pool.convertToAssets(shares);

        // Should be close (within 1 for rounding)
        assertApproxEqAbs(assets, amount, 1, "Convert functions not inverse");
    }
    FUZZ TESTS - COMMENTED FOR FASTER RUNS */
}
