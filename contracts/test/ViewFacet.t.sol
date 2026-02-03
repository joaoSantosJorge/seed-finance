// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/invoice/InvoiceDiamond.sol";
import "../src/invoice/ExecutionPool.sol";
import "../src/invoice/facets/InvoiceFacet.sol";
import "../src/invoice/facets/FundingFacet.sol";
import "../src/invoice/facets/RepaymentFacet.sol";
import "../src/invoice/facets/ViewFacet.sol";
import "../src/invoice/facets/AdminFacet.sol";
import "../src/invoice/libraries/LibInvoiceStorage.sol";
import "../src/invoice/interfaces/IInvoiceDiamond.sol";
import "../src/base/LiquidityPool.sol";
import "./mocks/MockUSDC.sol";

/**
 * @title ViewFacet Test Suite
 * @notice Comprehensive tests for all view functions
 */
contract ViewFacetTest is Test {
    InvoiceDiamond public diamond;
    MockUSDC public usdc;
    ExecutionPool public executionPool;

    // Facets
    InvoiceFacet public invoiceFacet;
    FundingFacet public fundingFacet;
    RepaymentFacet public repaymentFacet;
    ViewFacet public viewFacet;
    AdminFacet public adminFacet;

    // Test addresses
    address public owner = address(this);
    address public supplier = address(0x1);
    address public buyer = address(0x2);
    address public operator = address(0x3);
    address public lp1 = address(0x4);

    // Contracts
    LiquidityPool public liquidityPool;

    // Test constants
    uint128 constant FACE_VALUE = 10_000e6;
    uint16 constant DISCOUNT_RATE = 500;
    uint64 constant MATURITY_30_DAYS = 30 days;
    uint256 constant LP_DEPOSIT = 100_000e6;

    function setUp() public {
        // Deploy USDC
        usdc = new MockUSDC();

        // Deploy LiquidityPool
        liquidityPool = new LiquidityPool(IERC20(address(usdc)), "Seed", "SEED");

        // Deploy facets
        invoiceFacet = new InvoiceFacet();
        fundingFacet = new FundingFacet();
        repaymentFacet = new RepaymentFacet();
        viewFacet = new ViewFacet();
        adminFacet = new AdminFacet();

        // Prepare facet cuts
        InvoiceDiamond.FacetCut[] memory cuts = new InvoiceDiamond.FacetCut[](5);

        bytes4[] memory invoiceSelectors = new bytes4[](3);
        invoiceSelectors[0] = InvoiceFacet.createInvoice.selector;
        invoiceSelectors[1] = InvoiceFacet.approveInvoice.selector;
        invoiceSelectors[2] = InvoiceFacet.cancelInvoice.selector;
        cuts[0] = InvoiceDiamond.FacetCut({
            facetAddress: address(invoiceFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: invoiceSelectors
        });

        bytes4[] memory fundingSelectors = new bytes4[](5);
        fundingSelectors[0] = FundingFacet.approveFunding.selector;
        fundingSelectors[1] = FundingFacet.requestFunding.selector;
        fundingSelectors[2] = FundingFacet.batchFund.selector;
        fundingSelectors[3] = FundingFacet.canFundInvoice.selector;
        fundingSelectors[4] = FundingFacet.getFundingAmount.selector;
        cuts[1] = InvoiceDiamond.FacetCut({
            facetAddress: address(fundingFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: fundingSelectors
        });

        bytes4[] memory repaymentSelectors = new bytes4[](4);
        repaymentSelectors[0] = RepaymentFacet.processRepayment.selector;
        repaymentSelectors[1] = RepaymentFacet.getRepaymentAmount.selector;
        repaymentSelectors[2] = RepaymentFacet.isOverdue.selector;
        repaymentSelectors[3] = RepaymentFacet.markDefaulted.selector;
        cuts[2] = InvoiceDiamond.FacetCut({
            facetAddress: address(repaymentFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: repaymentSelectors
        });

        bytes4[] memory viewSelectors = new bytes4[](9);
        viewSelectors[0] = ViewFacet.getInvoice.selector;
        viewSelectors[1] = ViewFacet.getSupplierInvoices.selector;
        viewSelectors[2] = ViewFacet.getBuyerInvoices.selector;
        viewSelectors[3] = ViewFacet.getPendingApprovals.selector;
        viewSelectors[4] = ViewFacet.getUpcomingRepayments.selector;
        viewSelectors[5] = ViewFacet.getStats.selector;
        viewSelectors[6] = ViewFacet.getContractAddresses.selector;
        viewSelectors[7] = ViewFacet.isOperator.selector;
        viewSelectors[8] = ViewFacet.owner.selector;
        cuts[3] = InvoiceDiamond.FacetCut({
            facetAddress: address(viewFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: viewSelectors
        });

        bytes4[] memory adminSelectors = new bytes4[](6);
        adminSelectors[0] = AdminFacet.setExecutionPool.selector;
        adminSelectors[1] = AdminFacet.setLiquidityPool.selector;
        adminSelectors[2] = AdminFacet.setUSDC.selector;
        adminSelectors[3] = AdminFacet.setOperator.selector;
        adminSelectors[4] = AdminFacet.transferOwnership.selector;
        adminSelectors[5] = AdminFacet.initialize.selector;
        cuts[4] = InvoiceDiamond.FacetCut({
            facetAddress: address(adminFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: adminSelectors
        });

        bytes memory initData = abi.encodeWithSelector(
            AdminFacet.initialize.selector,
            owner,
            address(usdc)
        );

        diamond = new InvoiceDiamond(cuts, address(adminFacet), initData);

        // Deploy ExecutionPool
        executionPool = new ExecutionPool(address(usdc));
        executionPool.setLiquidityPool(address(liquidityPool));
        executionPool.grantRole(executionPool.OPERATOR_ROLE(), operator);

        // Grant ROUTER_ROLE to ExecutionPool
        liquidityPool.grantRole(liquidityPool.ROUTER_ROLE(), address(executionPool));

        // Configure diamond
        AdminFacet(address(diamond)).setOperator(operator, true);
        AdminFacet(address(diamond)).setExecutionPool(address(executionPool));
        AdminFacet(address(diamond)).setLiquidityPool(address(liquidityPool));

        // Set diamond in execution pool
        executionPool.setInvoiceDiamond(address(diamond));

        // Mint USDC
        usdc.mint(supplier, 1_000_000e6);
        usdc.mint(buyer, 1_000_000e6);
        usdc.mint(lp1, 1_000_000e6);

        // Approve spending
        vm.prank(lp1);
        usdc.approve(address(liquidityPool), type(uint256).max);
        vm.prank(buyer);
        usdc.approve(address(diamond), type(uint256).max);
        vm.prank(buyer);
        usdc.approve(address(executionPool), type(uint256).max);

        // LP deposits for liquidity
        vm.prank(lp1);
        liquidityPool.deposit(LP_DEPOSIT, lp1);
    }

    // ============ Helper Functions ============

    function _createInvoice() internal returns (uint256) {
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);
        vm.prank(supplier);
        return InvoiceFacet(address(diamond)).createInvoice(
            buyer, FACE_VALUE, DISCOUNT_RATE, maturityDate, bytes32("QmHash"), bytes32("INV-001")
        );
    }

    function _createApprovedInvoice() internal returns (uint256) {
        uint256 invoiceId = _createInvoice();
        vm.prank(buyer);
        InvoiceFacet(address(diamond)).approveInvoice(invoiceId);
        return invoiceId;
    }

    function _createFundedInvoice() internal returns (uint256) {
        uint256 invoiceId = _createApprovedInvoice();

        // Approve funding (operator approval)
        vm.prank(operator);
        FundingFacet(address(diamond)).approveFunding(invoiceId);

        // Fund via FundingFacet (updates diamond storage)
        vm.prank(operator);
        FundingFacet(address(diamond)).requestFunding(invoiceId);

        // Fund via ExecutionPool (actual USDC movement and funding record creation)
        uint128 fundingAmount = FundingFacet(address(diamond)).getFundingAmount(invoiceId);
        vm.prank(operator);
        executionPool.fundInvoice(invoiceId, supplier, fundingAmount, FACE_VALUE);

        return invoiceId;
    }

    // ============ getInvoice Tests ============

    function test_GetInvoice_Success() public {
        uint256 invoiceId = _createInvoice();

        IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);

        assertEq(invoice.id, invoiceId);
        assertEq(invoice.buyer, buyer);
        assertEq(invoice.supplier, supplier);
        assertEq(invoice.faceValue, FACE_VALUE);
        assertEq(uint8(invoice.status), uint8(LibInvoiceStorage.InvoiceStatus.Pending));
    }

    function test_GetInvoice_RevertNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(ViewFacet.InvoiceNotFound.selector, 999));
        ViewFacet(address(diamond)).getInvoice(999);
    }

    // ============ getSupplierInvoices Tests ============

    function test_GetSupplierInvoices_Empty() public view {
        uint256[] memory invoices = ViewFacet(address(diamond)).getSupplierInvoices(supplier);
        assertEq(invoices.length, 0);
    }

    function test_GetSupplierInvoices_Multiple() public {
        _createInvoice();
        _createInvoice();
        _createInvoice();

        uint256[] memory invoices = ViewFacet(address(diamond)).getSupplierInvoices(supplier);
        assertEq(invoices.length, 3);
        assertEq(invoices[0], 1);
        assertEq(invoices[1], 2);
        assertEq(invoices[2], 3);
    }

    // ============ getBuyerInvoices Tests ============

    function test_GetBuyerInvoices_Empty() public view {
        uint256[] memory invoices = ViewFacet(address(diamond)).getBuyerInvoices(buyer);
        assertEq(invoices.length, 0);
    }

    function test_GetBuyerInvoices_Multiple() public {
        _createInvoice();
        _createInvoice();

        uint256[] memory invoices = ViewFacet(address(diamond)).getBuyerInvoices(buyer);
        assertEq(invoices.length, 2);
    }

    // ============ getPendingApprovals Tests ============

    function test_GetPendingApprovals_Empty() public view {
        uint256[] memory pending = ViewFacet(address(diamond)).getPendingApprovals(buyer);
        assertEq(pending.length, 0);
    }

    function test_GetPendingApprovals_FiltersCorrectly() public {
        // Create 3 invoices
        uint256 id1 = _createInvoice();
        uint256 id2 = _createInvoice();
        uint256 id3 = _createInvoice();

        // Approve one
        vm.prank(buyer);
        InvoiceFacet(address(diamond)).approveInvoice(id2);

        // Cancel one
        vm.prank(buyer);
        InvoiceFacet(address(diamond)).cancelInvoice(id3);

        // Should only return id1
        uint256[] memory pending = ViewFacet(address(diamond)).getPendingApprovals(buyer);
        assertEq(pending.length, 1);
        assertEq(pending[0], id1);
    }

    // ============ getUpcomingRepayments Tests ============

    function test_GetUpcomingRepayments_Empty() public view {
        uint256[] memory repayments = ViewFacet(address(diamond)).getUpcomingRepayments(buyer);
        assertEq(repayments.length, 0);
    }

    function test_GetUpcomingRepayments_OnlyFunded() public {
        // Create various invoices
        _createInvoice(); // pending
        _createApprovedInvoice(); // approved
        uint256 fundedId = _createFundedInvoice(); // funded

        uint256[] memory repayments = ViewFacet(address(diamond)).getUpcomingRepayments(buyer);
        assertEq(repayments.length, 1);
        assertEq(repayments[0], fundedId);
    }

    function test_GetUpcomingRepayments_MultipleFunded() public {
        uint256 id1 = _createFundedInvoice();
        uint256 id2 = _createFundedInvoice();

        uint256[] memory repayments = ViewFacet(address(diamond)).getUpcomingRepayments(buyer);
        assertEq(repayments.length, 2);
        assertEq(repayments[0], id1);
        assertEq(repayments[1], id2);
    }

    function test_GetUpcomingRepayments_ExcludesPaid() public {
        uint256 fundedId = _createFundedInvoice();

        // Pay the invoice (approve diamond, not execution pool)
        usdc.mint(buyer, FACE_VALUE);
        vm.prank(buyer);
        usdc.approve(address(diamond), FACE_VALUE);

        vm.prank(buyer);
        RepaymentFacet(address(diamond)).processRepayment(fundedId);

        // Should no longer appear in upcoming repayments
        uint256[] memory repayments = ViewFacet(address(diamond)).getUpcomingRepayments(buyer);
        assertEq(repayments.length, 0);
    }

    // ============ getStats Tests ============

    function test_GetStats_Initial() public view {
        (uint256 totalFunded, uint256 totalRepaid, uint256 activeCount, uint256 nextId) =
            ViewFacet(address(diamond)).getStats();

        assertEq(totalFunded, 0);
        assertEq(totalRepaid, 0);
        assertEq(activeCount, 0);
        assertEq(nextId, 1);
    }

    function test_GetStats_AfterFunding() public {
        _createFundedInvoice();

        (uint256 totalFunded,, uint256 activeCount, uint256 nextId) =
            ViewFacet(address(diamond)).getStats();

        assertGt(totalFunded, 0);
        assertEq(activeCount, 1);
        assertEq(nextId, 2);
    }

    function test_GetStats_AfterRepayment() public {
        uint256 invoiceId = _createFundedInvoice();

        // Pay the invoice (approve diamond, not execution pool)
        usdc.mint(buyer, FACE_VALUE);
        vm.prank(buyer);
        usdc.approve(address(diamond), FACE_VALUE);

        vm.prank(buyer);
        RepaymentFacet(address(diamond)).processRepayment(invoiceId);

        (uint256 totalFunded, uint256 totalRepaid, uint256 activeCount,) =
            ViewFacet(address(diamond)).getStats();

        assertGt(totalFunded, 0);
        assertEq(totalRepaid, FACE_VALUE);
        assertEq(activeCount, 0);
    }

    // ============ getContractAddresses Tests ============

    function test_GetContractAddresses() public view {
        (address execPool, address liqPool, address usdcAddr) =
            ViewFacet(address(diamond)).getContractAddresses();

        assertEq(execPool, address(executionPool));
        assertEq(liqPool, address(liquidityPool));
        assertEq(usdcAddr, address(usdc));
    }

    function test_GetContractAddresses_BeforeSetup() public {
        // Deploy a fresh diamond without setting addresses
        InvoiceDiamond.FacetCut[] memory cuts = new InvoiceDiamond.FacetCut[](2);

        bytes4[] memory viewSelectors = new bytes4[](1);
        viewSelectors[0] = ViewFacet.getContractAddresses.selector;
        cuts[0] = InvoiceDiamond.FacetCut({
            facetAddress: address(viewFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: viewSelectors
        });

        bytes4[] memory adminSelectors = new bytes4[](1);
        adminSelectors[0] = AdminFacet.initialize.selector;
        cuts[1] = InvoiceDiamond.FacetCut({
            facetAddress: address(adminFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: adminSelectors
        });

        bytes memory initData = abi.encodeWithSelector(AdminFacet.initialize.selector, owner, address(usdc));
        InvoiceDiamond freshDiamond = new InvoiceDiamond(cuts, address(adminFacet), initData);

        (address execPool, address liqPool, address usdcAddr) =
            ViewFacet(address(freshDiamond)).getContractAddresses();

        assertEq(execPool, address(0));
        assertEq(liqPool, address(0));
        assertEq(usdcAddr, address(usdc));
    }

    // ============ isOperator Tests ============

    function test_IsOperator_True() public view {
        assertTrue(ViewFacet(address(diamond)).isOperator(operator));
    }

    function test_IsOperator_False() public view {
        assertFalse(ViewFacet(address(diamond)).isOperator(address(0x123)));
    }

    function test_IsOperator_OwnerIsOperator() public view {
        // Owner should always be considered an operator
        assertTrue(ViewFacet(address(diamond)).isOperator(owner));
    }

    function test_IsOperator_AfterRemoval() public {
        AdminFacet(address(diamond)).setOperator(operator, false);
        assertFalse(ViewFacet(address(diamond)).isOperator(operator));
    }

    // ============ owner Tests ============

    function test_Owner_ReturnsCorrectAddress() public view {
        assertEq(ViewFacet(address(diamond)).owner(), owner);
    }

    function test_Owner_AfterTransfer() public {
        address newOwner = address(0x789);
        AdminFacet(address(diamond)).transferOwnership(newOwner);

        assertEq(ViewFacet(address(diamond)).owner(), newOwner);
    }

    // ============ Complex Scenarios ============

    function test_ViewFunctions_FullLifecycle() public {
        // Create invoice
        uint256 invoiceId = _createInvoice();

        // Check initial state
        IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);
        assertEq(uint8(invoice.status), uint8(LibInvoiceStorage.InvoiceStatus.Pending));

        uint256[] memory pending = ViewFacet(address(diamond)).getPendingApprovals(buyer);
        assertEq(pending.length, 1);

        // Approve (buyer)
        vm.prank(buyer);
        InvoiceFacet(address(diamond)).approveInvoice(invoiceId);

        pending = ViewFacet(address(diamond)).getPendingApprovals(buyer);
        assertEq(pending.length, 0);

        // Approve funding (operator)
        vm.prank(operator);
        FundingFacet(address(diamond)).approveFunding(invoiceId);

        // Fund via FundingFacet (updates diamond storage)
        vm.prank(operator);
        FundingFacet(address(diamond)).requestFunding(invoiceId);

        // Fund via ExecutionPool (actual USDC movement and funding record creation)
        uint128 fundingAmount = FundingFacet(address(diamond)).getFundingAmount(invoiceId);
        vm.prank(operator);
        executionPool.fundInvoice(invoiceId, supplier, fundingAmount, FACE_VALUE);

        uint256[] memory repayments = ViewFacet(address(diamond)).getUpcomingRepayments(buyer);
        assertEq(repayments.length, 1);

        // Pay (approve diamond for the safeTransferFrom)
        usdc.mint(buyer, FACE_VALUE);
        vm.prank(buyer);
        usdc.approve(address(diamond), FACE_VALUE);
        vm.prank(buyer);
        RepaymentFacet(address(diamond)).processRepayment(invoiceId);

        repayments = ViewFacet(address(diamond)).getUpcomingRepayments(buyer);
        assertEq(repayments.length, 0);

        // Final state
        invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);
        assertEq(uint8(invoice.status), uint8(LibInvoiceStorage.InvoiceStatus.Paid));
    }

    /* FUZZ TESTS - COMMENTED FOR FASTER RUNS
    // ============ Fuzz Tests ============

    function testFuzz_GetSupplierInvoices_ManyInvoices(uint8 count) public {
        vm.assume(count > 0 && count <= 20);

        for (uint8 i = 0; i < count; i++) {
            _createInvoice();
        }

        uint256[] memory invoices = ViewFacet(address(diamond)).getSupplierInvoices(supplier);
        assertEq(invoices.length, count);
    }

    function testFuzz_GetBuyerInvoices_ManyInvoices(uint8 count) public {
        vm.assume(count > 0 && count <= 20);

        for (uint8 i = 0; i < count; i++) {
            _createInvoice();
        }

        uint256[] memory invoices = ViewFacet(address(diamond)).getBuyerInvoices(buyer);
        assertEq(invoices.length, count);
    }
    */
}
