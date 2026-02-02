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
import "./mocks/MockUSDC.sol";

contract InvoiceFacetTest is Test {
    InvoiceDiamond public diamond;
    MockUSDC public usdc;

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

    // Test constants
    uint128 constant FACE_VALUE = 10_000e6; // 10,000 USDC
    uint16 constant DISCOUNT_RATE = 500; // 5% annual
    uint64 constant MATURITY_30_DAYS = 30 days;

    function setUp() public {
        // Deploy USDC
        usdc = new MockUSDC();

        // Deploy facets
        invoiceFacet = new InvoiceFacet();
        fundingFacet = new FundingFacet();
        repaymentFacet = new RepaymentFacet();
        viewFacet = new ViewFacet();
        adminFacet = new AdminFacet();

        // Prepare facet cuts
        InvoiceDiamond.FacetCut[] memory cuts = new InvoiceDiamond.FacetCut[](5);

        // InvoiceFacet selectors
        bytes4[] memory invoiceSelectors = new bytes4[](3);
        invoiceSelectors[0] = InvoiceFacet.createInvoice.selector;
        invoiceSelectors[1] = InvoiceFacet.approveInvoice.selector;
        invoiceSelectors[2] = InvoiceFacet.cancelInvoice.selector;

        cuts[0] = InvoiceDiamond.FacetCut({
            facetAddress: address(invoiceFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: invoiceSelectors
        });

        // FundingFacet selectors
        bytes4[] memory fundingSelectors = new bytes4[](4);
        fundingSelectors[0] = FundingFacet.requestFunding.selector;
        fundingSelectors[1] = FundingFacet.batchFund.selector;
        fundingSelectors[2] = FundingFacet.canFundInvoice.selector;
        fundingSelectors[3] = FundingFacet.getFundingAmount.selector;

        cuts[1] = InvoiceDiamond.FacetCut({
            facetAddress: address(fundingFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: fundingSelectors
        });

        // RepaymentFacet selectors
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

        // ViewFacet selectors
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

        // AdminFacet selectors
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

        // Deploy diamond with initialization
        bytes memory initData = abi.encodeWithSelector(
            AdminFacet.initialize.selector,
            owner,
            address(usdc)
        );

        diamond = new InvoiceDiamond(cuts, address(adminFacet), initData);

        // Set operator
        AdminFacet(address(diamond)).setOperator(operator, true);

        // Mint USDC to test accounts
        usdc.mint(supplier, 1_000_000e6);
        usdc.mint(buyer, 1_000_000e6);
    }

    // ============ Create Invoice Tests ============

    function test_CreateInvoice() public {
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);

        vm.prank(supplier);
        uint256 invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer,
            FACE_VALUE,
            DISCOUNT_RATE,
            maturityDate,
            bytes32("QmHash123"),
            bytes32("INV-001")
        );

        assertEq(invoiceId, 1);

        // Verify invoice data
        IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);
        assertEq(invoice.buyer, buyer);
        assertEq(invoice.supplier, supplier);
        assertEq(invoice.faceValue, FACE_VALUE);
        assertEq(invoice.discountRateBps, DISCOUNT_RATE);
        assertEq(invoice.maturityDate, maturityDate);
        assertEq(uint8(invoice.status), uint8(LibInvoiceStorage.InvoiceStatus.Pending));
    }

    function test_CreateInvoice_MultipleInvoices() public {
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);

        vm.startPrank(supplier);

        uint256 invoiceId1 = InvoiceFacet(address(diamond)).createInvoice(
            buyer, FACE_VALUE, DISCOUNT_RATE, maturityDate, bytes32("QmHash1"), bytes32("INV-001")
        );

        uint256 invoiceId2 = InvoiceFacet(address(diamond)).createInvoice(
            buyer, FACE_VALUE * 2, DISCOUNT_RATE, maturityDate, bytes32("QmHash2"), bytes32("INV-002")
        );

        vm.stopPrank();

        assertEq(invoiceId1, 1);
        assertEq(invoiceId2, 2);

        // Verify supplier has both invoices
        uint256[] memory supplierInvoices = ViewFacet(address(diamond)).getSupplierInvoices(supplier);
        assertEq(supplierInvoices.length, 2);
    }

    function test_CreateInvoice_RevertZeroAddress() public {
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);

        vm.prank(supplier);
        vm.expectRevert(InvoiceFacet.ZeroAddress.selector);
        InvoiceFacet(address(diamond)).createInvoice(
            address(0), FACE_VALUE, DISCOUNT_RATE, maturityDate, bytes32(0), bytes32(0)
        );
    }

    function test_CreateInvoice_RevertBuyerIsSupplier() public {
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);

        vm.prank(supplier);
        vm.expectRevert(InvoiceFacet.BuyerCannotBeSupplier.selector);
        InvoiceFacet(address(diamond)).createInvoice(
            supplier, FACE_VALUE, DISCOUNT_RATE, maturityDate, bytes32(0), bytes32(0)
        );
    }

    function test_CreateInvoice_RevertZeroAmount() public {
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);

        vm.prank(supplier);
        vm.expectRevert(InvoiceFacet.ZeroAmount.selector);
        InvoiceFacet(address(diamond)).createInvoice(
            buyer, 0, DISCOUNT_RATE, maturityDate, bytes32(0), bytes32(0)
        );
    }

    function test_CreateInvoice_RevertMaturityInPast() public {
        uint64 pastDate = uint64(block.timestamp - 1);

        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(InvoiceFacet.MaturityInPast.selector, pastDate));
        InvoiceFacet(address(diamond)).createInvoice(
            buyer, FACE_VALUE, DISCOUNT_RATE, pastDate, bytes32(0), bytes32(0)
        );
    }

    function test_CreateInvoice_RevertDiscountRateTooHigh() public {
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);
        uint16 tooHighRate = 10001; // > 100%

        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(InvoiceFacet.DiscountRateTooHigh.selector, tooHighRate));
        InvoiceFacet(address(diamond)).createInvoice(
            buyer, FACE_VALUE, tooHighRate, maturityDate, bytes32(0), bytes32(0)
        );
    }

    // ============ Approve Invoice Tests ============

    function test_ApproveInvoice() public {
        // Create invoice
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);
        vm.prank(supplier);
        uint256 invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer, FACE_VALUE, DISCOUNT_RATE, maturityDate, bytes32(0), bytes32(0)
        );

        // Approve
        vm.prank(buyer);
        InvoiceFacet(address(diamond)).approveInvoice(invoiceId);

        // Verify status
        IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);
        assertEq(uint8(invoice.status), uint8(LibInvoiceStorage.InvoiceStatus.Approved));
    }

    function test_ApproveInvoice_RevertNotBuyer() public {
        // Create invoice
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);
        vm.prank(supplier);
        uint256 invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer, FACE_VALUE, DISCOUNT_RATE, maturityDate, bytes32(0), bytes32(0)
        );

        // Try to approve as supplier
        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(InvoiceFacet.Unauthorized.selector, supplier, "buyer"));
        InvoiceFacet(address(diamond)).approveInvoice(invoiceId);
    }

    function test_ApproveInvoice_RevertAlreadyApproved() public {
        // Create and approve invoice
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);
        vm.prank(supplier);
        uint256 invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer, FACE_VALUE, DISCOUNT_RATE, maturityDate, bytes32(0), bytes32(0)
        );

        vm.prank(buyer);
        InvoiceFacet(address(diamond)).approveInvoice(invoiceId);

        // Try to approve again
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(
            InvoiceFacet.InvalidInvoiceStatus.selector,
            invoiceId,
            LibInvoiceStorage.InvoiceStatus.Pending,
            LibInvoiceStorage.InvoiceStatus.Approved
        ));
        InvoiceFacet(address(diamond)).approveInvoice(invoiceId);
    }

    // ============ Cancel Invoice Tests ============

    function test_CancelInvoice_BySupplier() public {
        // Create invoice
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);
        vm.prank(supplier);
        uint256 invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer, FACE_VALUE, DISCOUNT_RATE, maturityDate, bytes32(0), bytes32(0)
        );

        // Cancel by supplier
        vm.prank(supplier);
        InvoiceFacet(address(diamond)).cancelInvoice(invoiceId);

        // Verify status
        IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);
        assertEq(uint8(invoice.status), uint8(LibInvoiceStorage.InvoiceStatus.Cancelled));
    }

    function test_CancelInvoice_ByBuyer() public {
        // Create invoice
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);
        vm.prank(supplier);
        uint256 invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer, FACE_VALUE, DISCOUNT_RATE, maturityDate, bytes32(0), bytes32(0)
        );

        // Cancel by buyer
        vm.prank(buyer);
        InvoiceFacet(address(diamond)).cancelInvoice(invoiceId);

        // Verify status
        IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);
        assertEq(uint8(invoice.status), uint8(LibInvoiceStorage.InvoiceStatus.Cancelled));
    }

    function test_CancelInvoice_RevertUnauthorized() public {
        // Create invoice
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);
        vm.prank(supplier);
        uint256 invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer, FACE_VALUE, DISCOUNT_RATE, maturityDate, bytes32(0), bytes32(0)
        );

        // Try to cancel as random address
        address randomUser = address(0x999);
        vm.prank(randomUser);
        vm.expectRevert(abi.encodeWithSelector(InvoiceFacet.Unauthorized.selector, randomUser, "buyer or supplier"));
        InvoiceFacet(address(diamond)).cancelInvoice(invoiceId);
    }

    function test_CancelInvoice_RevertAlreadyApproved() public {
        // Create and approve invoice
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);
        vm.prank(supplier);
        uint256 invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer, FACE_VALUE, DISCOUNT_RATE, maturityDate, bytes32(0), bytes32(0)
        );

        vm.prank(buyer);
        InvoiceFacet(address(diamond)).approveInvoice(invoiceId);

        // Try to cancel
        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(
            InvoiceFacet.InvalidInvoiceStatus.selector,
            invoiceId,
            LibInvoiceStorage.InvoiceStatus.Pending,
            LibInvoiceStorage.InvoiceStatus.Approved
        ));
        InvoiceFacet(address(diamond)).cancelInvoice(invoiceId);
    }

    // ============ View Functions Tests ============

    function test_GetPendingApprovals() public {
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);

        // Create 3 invoices for buyer
        vm.startPrank(supplier);
        InvoiceFacet(address(diamond)).createInvoice(buyer, FACE_VALUE, DISCOUNT_RATE, maturityDate, bytes32(0), bytes32("1"));
        InvoiceFacet(address(diamond)).createInvoice(buyer, FACE_VALUE, DISCOUNT_RATE, maturityDate, bytes32(0), bytes32("2"));
        InvoiceFacet(address(diamond)).createInvoice(buyer, FACE_VALUE, DISCOUNT_RATE, maturityDate, bytes32(0), bytes32("3"));
        vm.stopPrank();

        // Approve one
        vm.prank(buyer);
        InvoiceFacet(address(diamond)).approveInvoice(2);

        // Check pending approvals
        uint256[] memory pending = ViewFacet(address(diamond)).getPendingApprovals(buyer);
        assertEq(pending.length, 2);
        assertEq(pending[0], 1);
        assertEq(pending[1], 3);
    }

    function test_GetStats() public {
        // Create some invoices
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);
        vm.prank(supplier);
        InvoiceFacet(address(diamond)).createInvoice(buyer, FACE_VALUE, DISCOUNT_RATE, maturityDate, bytes32(0), bytes32(0));

        (uint256 totalFunded, uint256 totalRepaid, uint256 activeCount, uint256 nextId) =
            ViewFacet(address(diamond)).getStats();

        assertEq(totalFunded, 0);
        assertEq(totalRepaid, 0);
        assertEq(activeCount, 0);
        assertEq(nextId, 2); // Next ID is 2 after creating invoice 1
    }

    // ============ Admin Functions Tests ============

    function test_SetOperator() public {
        address newOperator = address(0x123);

        AdminFacet(address(diamond)).setOperator(newOperator, true);
        assertTrue(ViewFacet(address(diamond)).isOperator(newOperator));

        AdminFacet(address(diamond)).setOperator(newOperator, false);
        assertFalse(ViewFacet(address(diamond)).isOperator(newOperator));
    }

    function test_TransferOwnership() public {
        address newOwner = address(0x456);

        AdminFacet(address(diamond)).transferOwnership(newOwner);
        assertEq(ViewFacet(address(diamond)).owner(), newOwner);
    }

    // ============ Fuzz Tests ============

    function testFuzz_CreateInvoice(
        uint128 faceValue,
        uint16 discountRate,
        uint32 daysToMaturity
    ) public {
        vm.assume(faceValue > 0);
        vm.assume(discountRate <= 10000);
        vm.assume(daysToMaturity > 0 && daysToMaturity < 3650); // Max 10 years

        uint64 maturityDate = uint64(block.timestamp + uint256(daysToMaturity) * 1 days);

        vm.prank(supplier);
        uint256 invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer, faceValue, discountRate, maturityDate, bytes32(0), bytes32(0)
        );

        IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);
        assertEq(invoice.faceValue, faceValue);
        assertEq(invoice.discountRateBps, discountRate);
    }
}
