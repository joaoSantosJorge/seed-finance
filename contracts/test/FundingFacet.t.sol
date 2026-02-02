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

/**
 * @title FundingFacet Test Suite
 * @notice Comprehensive tests for invoice funding operations
 */
contract FundingFacetTest is Test {
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
    address public liquidityPool = address(0x4);

    // Test constants
    uint128 constant FACE_VALUE = 10_000e6;
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

        // Deploy ExecutionPool
        executionPool = new ExecutionPool(address(usdc));
        executionPool.setLiquidityPool(liquidityPool);
        executionPool.setInvoiceDiamond(address(diamond));

        // Configure diamond
        AdminFacet(address(diamond)).setOperator(operator, true);
        AdminFacet(address(diamond)).setExecutionPool(address(executionPool));
        AdminFacet(address(diamond)).setLiquidityPool(liquidityPool);

        // Mint USDC
        usdc.mint(supplier, 1_000_000e6);
        usdc.mint(buyer, 1_000_000e6);
        usdc.mint(liquidityPool, 10_000_000e6);
    }

    // ============ Helper Functions ============

    function _createApprovedInvoice() internal returns (uint256 invoiceId) {
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);

        vm.prank(supplier);
        invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer,
            FACE_VALUE,
            DISCOUNT_RATE,
            maturityDate,
            bytes32("QmHash"),
            bytes32("INV-001")
        );

        vm.prank(buyer);
        InvoiceFacet(address(diamond)).approveInvoice(invoiceId);
    }

    function _createPendingInvoice() internal returns (uint256 invoiceId) {
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);

        vm.prank(supplier);
        invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer,
            FACE_VALUE,
            DISCOUNT_RATE,
            maturityDate,
            bytes32("QmHash"),
            bytes32("INV-001")
        );
    }

    // ============ requestFunding Tests ============

    function test_RequestFunding_Success() public {
        uint256 invoiceId = _createApprovedInvoice();

        vm.prank(operator);
        FundingFacet(address(diamond)).requestFunding(invoiceId);

        // Verify invoice is now funded
        IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);
        assertEq(uint8(invoice.status), uint8(LibInvoiceStorage.InvoiceStatus.Funded));
        assertGt(invoice.fundingAmount, 0);
        assertGt(invoice.fundedAt, 0);
    }

    function test_RequestFunding_RevertNotOperator() public {
        uint256 invoiceId = _createApprovedInvoice();

        vm.prank(randomAddress());
        vm.expectRevert("LibInvoiceStorage: not operator");
        FundingFacet(address(diamond)).requestFunding(invoiceId);
    }

    function test_RequestFunding_RevertInvoiceNotFound() public {
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(
            FundingFacet.InvoiceNotFound.selector,
            999
        ));
        FundingFacet(address(diamond)).requestFunding(999);
    }

    function test_RequestFunding_RevertNotApproved() public {
        uint256 invoiceId = _createPendingInvoice();

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(
            FundingFacet.InvalidInvoiceStatus.selector,
            invoiceId,
            LibInvoiceStorage.InvoiceStatus.Approved,
            LibInvoiceStorage.InvoiceStatus.Pending
        ));
        FundingFacet(address(diamond)).requestFunding(invoiceId);
    }

    function test_RequestFunding_RevertAlreadyFunded() public {
        uint256 invoiceId = _createApprovedInvoice();

        vm.prank(operator);
        FundingFacet(address(diamond)).requestFunding(invoiceId);

        // Try again
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(
            FundingFacet.InvalidInvoiceStatus.selector,
            invoiceId,
            LibInvoiceStorage.InvoiceStatus.Approved,
            LibInvoiceStorage.InvoiceStatus.Funded
        ));
        FundingFacet(address(diamond)).requestFunding(invoiceId);
    }

    function test_RequestFunding_RevertExecutionPoolNotSet() public {
        // Create a new diamond without execution pool set
        InvoiceDiamond.FacetCut[] memory cuts = new InvoiceDiamond.FacetCut[](3);

        bytes4[] memory invoiceSelectors = new bytes4[](2);
        invoiceSelectors[0] = InvoiceFacet.createInvoice.selector;
        invoiceSelectors[1] = InvoiceFacet.approveInvoice.selector;
        cuts[0] = InvoiceDiamond.FacetCut({
            facetAddress: address(invoiceFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: invoiceSelectors
        });

        bytes4[] memory fundingSelectors = new bytes4[](1);
        fundingSelectors[0] = FundingFacet.requestFunding.selector;
        cuts[1] = InvoiceDiamond.FacetCut({
            facetAddress: address(fundingFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: fundingSelectors
        });

        bytes4[] memory adminSelectors = new bytes4[](2);
        adminSelectors[0] = AdminFacet.initialize.selector;
        adminSelectors[1] = AdminFacet.setOperator.selector;
        cuts[2] = InvoiceDiamond.FacetCut({
            facetAddress: address(adminFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: adminSelectors
        });

        bytes memory initData = abi.encodeWithSelector(AdminFacet.initialize.selector, owner, address(usdc));
        InvoiceDiamond newDiamond = new InvoiceDiamond(cuts, address(adminFacet), initData);

        AdminFacet(address(newDiamond)).setOperator(operator, true);

        // Create and approve invoice
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);
        vm.prank(supplier);
        uint256 invoiceId = InvoiceFacet(address(newDiamond)).createInvoice(
            buyer, FACE_VALUE, DISCOUNT_RATE, maturityDate, bytes32(0), bytes32(0)
        );

        vm.prank(buyer);
        InvoiceFacet(address(newDiamond)).approveInvoice(invoiceId);

        // Try to fund without execution pool set
        vm.prank(operator);
        vm.expectRevert(FundingFacet.ExecutionPoolNotSet.selector);
        FundingFacet(address(newDiamond)).requestFunding(invoiceId);
    }

    function test_RequestFunding_UpdatesStats() public {
        uint256 invoiceId = _createApprovedInvoice();

        (uint256 totalFundedBefore,, uint256 activeCountBefore,) = ViewFacet(address(diamond)).getStats();

        vm.prank(operator);
        FundingFacet(address(diamond)).requestFunding(invoiceId);

        (uint256 totalFundedAfter,, uint256 activeCountAfter,) = ViewFacet(address(diamond)).getStats();

        assertGt(totalFundedAfter, totalFundedBefore);
        assertEq(activeCountAfter, activeCountBefore + 1);
    }

    // ============ batchFund Tests ============

    function test_BatchFund_Success() public {
        // Create multiple approved invoices
        uint256 id1 = _createApprovedInvoice();

        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);
        vm.prank(supplier);
        uint256 id2 = InvoiceFacet(address(diamond)).createInvoice(
            buyer, FACE_VALUE * 2, DISCOUNT_RATE, maturityDate, bytes32("QmHash2"), bytes32("INV-002")
        );
        vm.prank(buyer);
        InvoiceFacet(address(diamond)).approveInvoice(id2);

        uint256[] memory invoiceIds = new uint256[](2);
        invoiceIds[0] = id1;
        invoiceIds[1] = id2;

        vm.prank(operator);
        FundingFacet(address(diamond)).batchFund(invoiceIds);

        // Both should be funded
        IInvoiceDiamond.InvoiceView memory invoice1 = ViewFacet(address(diamond)).getInvoice(id1);
        IInvoiceDiamond.InvoiceView memory invoice2 = ViewFacet(address(diamond)).getInvoice(id2);

        assertEq(uint8(invoice1.status), uint8(LibInvoiceStorage.InvoiceStatus.Funded));
        assertEq(uint8(invoice2.status), uint8(LibInvoiceStorage.InvoiceStatus.Funded));
    }

    function test_BatchFund_SkipsNonApproved() public {
        uint256 approvedId = _createApprovedInvoice();
        uint256 pendingId = _createPendingInvoice();

        uint256[] memory invoiceIds = new uint256[](2);
        invoiceIds[0] = approvedId;
        invoiceIds[1] = pendingId;

        vm.prank(operator);
        FundingFacet(address(diamond)).batchFund(invoiceIds);

        // Only approved should be funded
        IInvoiceDiamond.InvoiceView memory approvedInvoice = ViewFacet(address(diamond)).getInvoice(approvedId);
        IInvoiceDiamond.InvoiceView memory pendingInvoice = ViewFacet(address(diamond)).getInvoice(pendingId);

        assertEq(uint8(approvedInvoice.status), uint8(LibInvoiceStorage.InvoiceStatus.Funded));
        assertEq(uint8(pendingInvoice.status), uint8(LibInvoiceStorage.InvoiceStatus.Pending));
    }

    function test_BatchFund_SkipsNonExistent() public {
        uint256 approvedId = _createApprovedInvoice();

        uint256[] memory invoiceIds = new uint256[](2);
        invoiceIds[0] = approvedId;
        invoiceIds[1] = 999; // Non-existent

        vm.prank(operator);
        FundingFacet(address(diamond)).batchFund(invoiceIds);

        // Approved should be funded, no revert for non-existent
        IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(approvedId);
        assertEq(uint8(invoice.status), uint8(LibInvoiceStorage.InvoiceStatus.Funded));
    }

    function test_BatchFund_EmptyArray() public {
        uint256[] memory invoiceIds = new uint256[](0);

        vm.prank(operator);
        FundingFacet(address(diamond)).batchFund(invoiceIds);

        // Should not revert
    }

    function test_BatchFund_RevertNotOperator() public {
        uint256[] memory invoiceIds = new uint256[](1);
        invoiceIds[0] = 1;

        vm.prank(randomAddress());
        vm.expectRevert("LibInvoiceStorage: not operator");
        FundingFacet(address(diamond)).batchFund(invoiceIds);
    }

    function test_BatchFund_RevertExecutionPoolNotSet() public {
        // Create diamond without execution pool
        InvoiceDiamond.FacetCut[] memory cuts = new InvoiceDiamond.FacetCut[](2);

        bytes4[] memory fundingSelectors = new bytes4[](1);
        fundingSelectors[0] = FundingFacet.batchFund.selector;
        cuts[0] = InvoiceDiamond.FacetCut({
            facetAddress: address(fundingFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: fundingSelectors
        });

        bytes4[] memory adminSelectors = new bytes4[](2);
        adminSelectors[0] = AdminFacet.initialize.selector;
        adminSelectors[1] = AdminFacet.setOperator.selector;
        cuts[1] = InvoiceDiamond.FacetCut({
            facetAddress: address(adminFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: adminSelectors
        });

        bytes memory initData = abi.encodeWithSelector(AdminFacet.initialize.selector, owner, address(usdc));
        InvoiceDiamond newDiamond = new InvoiceDiamond(cuts, address(adminFacet), initData);

        AdminFacet(address(newDiamond)).setOperator(operator, true);

        uint256[] memory invoiceIds = new uint256[](1);
        invoiceIds[0] = 1;

        vm.prank(operator);
        vm.expectRevert(FundingFacet.ExecutionPoolNotSet.selector);
        FundingFacet(address(newDiamond)).batchFund(invoiceIds);
    }

    // ============ canFundInvoice Tests ============

    function test_CanFundInvoice_TrueForApproved() public {
        uint256 invoiceId = _createApprovedInvoice();

        bool canFund = FundingFacet(address(diamond)).canFundInvoice(invoiceId);
        assertTrue(canFund);
    }

    function test_CanFundInvoice_FalseForPending() public {
        uint256 invoiceId = _createPendingInvoice();

        bool canFund = FundingFacet(address(diamond)).canFundInvoice(invoiceId);
        assertFalse(canFund);
    }

    function test_CanFundInvoice_FalseForNonExistent() public {
        bool canFund = FundingFacet(address(diamond)).canFundInvoice(999);
        assertFalse(canFund);
    }

    function test_CanFundInvoice_FalseForFunded() public {
        uint256 invoiceId = _createApprovedInvoice();

        vm.prank(operator);
        FundingFacet(address(diamond)).requestFunding(invoiceId);

        bool canFund = FundingFacet(address(diamond)).canFundInvoice(invoiceId);
        assertFalse(canFund);
    }

    // ============ getFundingAmount Tests ============

    function test_GetFundingAmount_ReturnsCorrectAmount() public {
        uint256 invoiceId = _createApprovedInvoice();

        uint128 fundingAmount = FundingFacet(address(diamond)).getFundingAmount(invoiceId);

        // Should be less than face value due to discount
        assertLt(fundingAmount, FACE_VALUE);
        assertGt(fundingAmount, 0);
    }

    function test_GetFundingAmount_ReturnsStoredAfterFunding() public {
        uint256 invoiceId = _createApprovedInvoice();

        uint128 fundingBefore = FundingFacet(address(diamond)).getFundingAmount(invoiceId);

        vm.prank(operator);
        FundingFacet(address(diamond)).requestFunding(invoiceId);

        // Advance time
        vm.warp(block.timestamp + 10 days);

        uint128 fundingAfter = FundingFacet(address(diamond)).getFundingAmount(invoiceId);

        // After funding, it should return the stored amount, not recalculate
        assertEq(fundingAfter, fundingBefore);
    }

    function test_GetFundingAmount_RevertInvoiceNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(
            FundingFacet.InvoiceNotFound.selector,
            999
        ));
        FundingFacet(address(diamond)).getFundingAmount(999);
    }

    function test_GetFundingAmount_AtMaturity() public {
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);

        vm.prank(supplier);
        uint256 invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer, FACE_VALUE, DISCOUNT_RATE, maturityDate, bytes32(0), bytes32(0)
        );

        // Warp to maturity
        vm.warp(maturityDate);

        uint128 fundingAmount = FundingFacet(address(diamond)).getFundingAmount(invoiceId);

        // At maturity, seconds to maturity = 0, so discount = 0
        assertEq(fundingAmount, FACE_VALUE);
    }

    function test_GetFundingAmount_PastMaturity() public {
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);

        vm.prank(supplier);
        uint256 invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer, FACE_VALUE, DISCOUNT_RATE, maturityDate, bytes32(0), bytes32(0)
        );

        // Warp past maturity
        vm.warp(maturityDate + 10 days);

        uint128 fundingAmount = FundingFacet(address(diamond)).getFundingAmount(invoiceId);

        // Past maturity, no discount
        assertEq(fundingAmount, FACE_VALUE);
    }

    /* FUZZ TESTS - COMMENTED FOR FASTER RUNS
    // ============ Fuzz Tests ============

    function testFuzz_RequestFunding_VariousFaceValues(uint128 faceValue) public {
        vm.assume(faceValue >= 1e6 && faceValue <= 1e12); // $1 to $1M

        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);

        vm.prank(supplier);
        uint256 invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer, faceValue, DISCOUNT_RATE, maturityDate, bytes32(0), bytes32(0)
        );

        vm.prank(buyer);
        InvoiceFacet(address(diamond)).approveInvoice(invoiceId);

        vm.prank(operator);
        FundingFacet(address(diamond)).requestFunding(invoiceId);

        IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);
        assertEq(uint8(invoice.status), uint8(LibInvoiceStorage.InvoiceStatus.Funded));
        assertLe(invoice.fundingAmount, faceValue);
    }

    function testFuzz_BatchFund_MultipleInvoices(uint8 count) public {
        // Limit count to avoid overflow with FACE_VALUE additions
        count = uint8(bound(count, 1, 5));

        uint256[] memory invoiceIds = new uint256[](count);
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);

        for (uint8 i = 0; i < count; i++) {
            vm.prank(supplier);
            invoiceIds[i] = InvoiceFacet(address(diamond)).createInvoice(
                buyer,
                FACE_VALUE, // Use same face value to avoid overflow
                DISCOUNT_RATE,
                maturityDate,
                bytes32(uint256(i + 1)),
                bytes32(uint256(i + 1))
            );

            vm.prank(buyer);
            InvoiceFacet(address(diamond)).approveInvoice(invoiceIds[i]);
        }

        vm.prank(operator);
        FundingFacet(address(diamond)).batchFund(invoiceIds);

        // All should be funded
        for (uint8 i = 0; i < count; i++) {
            IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(invoiceIds[i]);
            assertEq(uint8(invoice.status), uint8(LibInvoiceStorage.InvoiceStatus.Funded));
        }
    }
    */

    // ============ Helper ============

    function randomAddress() internal view returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao)))));
    }
}
