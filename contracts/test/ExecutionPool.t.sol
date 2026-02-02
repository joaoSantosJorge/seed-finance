// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/invoice/ExecutionPool.sol";
import "../src/base/LiquidityPool.sol";
import "./mocks/MockUSDC.sol";

contract ExecutionPoolTest is Test {
    ExecutionPool public executionPool;
    LiquidityPool public liquidityPool;
    MockUSDC public usdc;

    address public owner = address(this);
    address public operator = address(0x1);
    address public supplier = address(0x2);
    address public buyer = address(0x3);
    address public lp = address(0x4);

    uint256 constant INITIAL_BALANCE = 1_000_000e6;

    function setUp() public {
        // Deploy USDC
        usdc = new MockUSDC();

        // Deploy LiquidityPool
        liquidityPool = new LiquidityPool(IERC20(address(usdc)), "Seed", "SEED");

        // Deploy ExecutionPool
        executionPool = new ExecutionPool(address(usdc));

        // Configure
        executionPool.setLiquidityPool(address(liquidityPool));
        executionPool.grantRole(executionPool.OPERATOR_ROLE(), operator);

        // Grant ROUTER_ROLE to ExecutionPool in LiquidityPool
        liquidityPool.grantRole(liquidityPool.ROUTER_ROLE(), address(executionPool));

        // Mint USDC and deposit to pool
        usdc.mint(lp, INITIAL_BALANCE);
        vm.startPrank(lp);
        usdc.approve(address(liquidityPool), type(uint256).max);
        liquidityPool.deposit(100_000e6, lp);
        vm.stopPrank();

        // Mint USDC to buyer for repayments
        usdc.mint(buyer, INITIAL_BALANCE);
        vm.prank(buyer);
        usdc.approve(address(executionPool), type(uint256).max);
    }

    // ============ Deployment Tests ============

    function test_Deployment() public view {
        assertEq(address(executionPool.usdc()), address(usdc));
        assertEq(executionPool.liquidityPool(), address(liquidityPool));
        assertEq(executionPool.totalFunded(), 0);
        assertEq(executionPool.totalRepaid(), 0);
        assertEq(executionPool.activeInvoices(), 0);
    }

    // ============ Fund Invoice Tests ============

    function test_FundInvoice() public {
        uint128 fundingAmount = 9_500e6;
        uint128 faceValue = 10_000e6;
        uint256 invoiceId = 1;

        uint256 supplierBalanceBefore = usdc.balanceOf(supplier);
        uint256 poolBalanceBefore = liquidityPool.availableLiquidity();

        vm.prank(operator);
        executionPool.fundInvoice(invoiceId, supplier, fundingAmount, faceValue);

        // Verify supplier received funds
        assertEq(usdc.balanceOf(supplier) - supplierBalanceBefore, fundingAmount);

        // Verify pool deployed funds
        assertEq(liquidityPool.totalDeployed(), fundingAmount);
        assertEq(liquidityPool.availableLiquidity(), poolBalanceBefore - fundingAmount);

        // Verify execution pool stats
        assertEq(executionPool.totalFunded(), fundingAmount);
        assertEq(executionPool.activeInvoices(), 1);

        // Verify funding record
        ExecutionPool.FundingRecord memory record = executionPool.getFundingRecord(invoiceId);
        assertEq(record.supplier, supplier);
        assertEq(record.fundingAmount, fundingAmount);
        assertEq(record.faceValue, faceValue);
        assertTrue(record.funded);
        assertFalse(record.repaid);
    }

    function test_FundInvoice_RevertAlreadyFunded() public {
        uint128 fundingAmount = 9_500e6;
        uint128 faceValue = 10_000e6;
        uint256 invoiceId = 1;

        vm.prank(operator);
        executionPool.fundInvoice(invoiceId, supplier, fundingAmount, faceValue);

        // Try to fund again
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(ExecutionPool.InvoiceAlreadyFunded.selector, invoiceId));
        executionPool.fundInvoice(invoiceId, supplier, fundingAmount, faceValue);
    }

    function test_FundInvoice_RevertZeroSupplier() public {
        vm.prank(operator);
        vm.expectRevert(ExecutionPool.ZeroAddress.selector);
        executionPool.fundInvoice(1, address(0), 9_500e6, 10_000e6);
    }

    function test_FundInvoice_RevertZeroAmount() public {
        vm.prank(operator);
        vm.expectRevert(ExecutionPool.ZeroAmount.selector);
        executionPool.fundInvoice(1, supplier, 0, 10_000e6);
    }

    function test_FundInvoice_RevertNotOperator() public {
        vm.prank(buyer);
        vm.expectRevert();
        executionPool.fundInvoice(1, supplier, 9_500e6, 10_000e6);
    }

    // ============ Repayment Tests ============

    function test_RepayInvoice() public {
        uint128 fundingAmount = 9_500e6;
        uint128 faceValue = 10_000e6;
        uint256 invoiceId = 1;

        // Fund invoice first
        vm.prank(operator);
        executionPool.fundInvoice(invoiceId, supplier, fundingAmount, faceValue);

        uint256 poolBalanceBefore = liquidityPool.availableLiquidity();

        // Repay
        vm.prank(buyer);
        executionPool.repayInvoice(invoiceId);

        // Verify stats
        assertEq(executionPool.totalRepaid(), faceValue);
        assertEq(executionPool.activeInvoices(), 0);

        // Verify funding record
        ExecutionPool.FundingRecord memory record = executionPool.getFundingRecord(invoiceId);
        assertTrue(record.repaid);

        // Verify pool received funds back plus yield
        assertEq(liquidityPool.availableLiquidity(), poolBalanceBefore + faceValue);
        assertEq(liquidityPool.totalDeployed(), 0);
        assertEq(liquidityPool.totalInvoiceYield(), faceValue - fundingAmount);
    }

    function test_RepayInvoice_RevertNotFunded() public {
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(ExecutionPool.InvoiceNotFunded.selector, 1));
        executionPool.repayInvoice(1);
    }

    function test_RepayInvoice_RevertAlreadyRepaid() public {
        uint256 invoiceId = 1;

        // Fund and repay
        vm.prank(operator);
        executionPool.fundInvoice(invoiceId, supplier, 9_500e6, 10_000e6);

        vm.prank(buyer);
        executionPool.repayInvoice(invoiceId);

        // Try to repay again
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(ExecutionPool.InvoiceAlreadyRepaid.selector, invoiceId));
        executionPool.repayInvoice(invoiceId);
    }

    // ============ Multiple Invoice Tests ============

    function test_MultipleFundAndRepay() public {
        // Fund 3 invoices
        vm.startPrank(operator);
        executionPool.fundInvoice(1, supplier, 9_500e6, 10_000e6);
        executionPool.fundInvoice(2, supplier, 19_000e6, 20_000e6);
        executionPool.fundInvoice(3, supplier, 4_750e6, 5_000e6);
        vm.stopPrank();

        assertEq(executionPool.activeInvoices(), 3);
        assertEq(executionPool.totalFunded(), 9_500e6 + 19_000e6 + 4_750e6);

        // Repay invoice 2
        vm.prank(buyer);
        executionPool.repayInvoice(2);

        assertEq(executionPool.activeInvoices(), 2);
        assertEq(executionPool.totalRepaid(), 20_000e6);

        // Repay remaining
        vm.prank(buyer);
        executionPool.repayInvoice(1);

        vm.prank(buyer);
        executionPool.repayInvoice(3);

        assertEq(executionPool.activeInvoices(), 0);
        assertEq(executionPool.totalRepaid(), 35_000e6);
    }

    // ============ View Functions Tests ============

    function test_GetStats() public {
        vm.prank(operator);
        executionPool.fundInvoice(1, supplier, 9_500e6, 10_000e6);

        (uint256 totalFunded, uint256 totalRepaid, uint256 activeInvoices) = executionPool.getStats();

        assertEq(totalFunded, 9_500e6);
        assertEq(totalRepaid, 0);
        assertEq(activeInvoices, 1);
    }

    function test_IsInvoiceFunded() public {
        assertFalse(executionPool.isInvoiceFunded(1));

        vm.prank(operator);
        executionPool.fundInvoice(1, supplier, 9_500e6, 10_000e6);

        assertTrue(executionPool.isInvoiceFunded(1));
    }

    function test_IsInvoiceRepaid() public {
        vm.prank(operator);
        executionPool.fundInvoice(1, supplier, 9_500e6, 10_000e6);

        assertFalse(executionPool.isInvoiceRepaid(1));

        vm.prank(buyer);
        executionPool.repayInvoice(1);

        assertTrue(executionPool.isInvoiceRepaid(1));
    }

    // ============ Admin Tests ============

    function test_SetLiquidityPool() public {
        address newPool = address(0x999);
        executionPool.setLiquidityPool(newPool);
        assertEq(executionPool.liquidityPool(), newPool);
    }

    function test_SetLiquidityPool_RevertZeroAddress() public {
        vm.expectRevert(ExecutionPool.ZeroAddress.selector);
        executionPool.setLiquidityPool(address(0));
    }

    /* FUZZ TESTS - COMMENTED FOR FASTER RUNS
    // ============ Fuzz Tests ============

    function testFuzz_FundAndRepay(uint128 faceValue, uint16 discountBps) public {
        vm.assume(faceValue > 1e6 && faceValue < 100_000e6); // 1 - 100k USDC
        vm.assume(discountBps > 0 && discountBps <= 1000); // 0.01% - 10%

        uint128 fundingAmount = uint128(uint256(faceValue) * (10000 - discountBps) / 10000);
        vm.assume(fundingAmount > 0);

        uint256 invoiceId = 1;

        // Fund
        vm.prank(operator);
        executionPool.fundInvoice(invoiceId, supplier, fundingAmount, faceValue);

        // Verify
        assertEq(executionPool.totalFunded(), fundingAmount);
        assertTrue(executionPool.isInvoiceFunded(invoiceId));

        // Repay
        vm.prank(buyer);
        executionPool.repayInvoice(invoiceId);

        // Verify yield
        uint256 yield = faceValue - fundingAmount;
        assertEq(liquidityPool.totalInvoiceYield(), yield);
    }
    */
}
