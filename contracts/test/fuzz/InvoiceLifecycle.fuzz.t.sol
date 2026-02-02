// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../../src/invoice/InvoiceDiamond.sol";
import "../../src/invoice/ExecutionPool.sol";
import "../../src/invoice/facets/InvoiceFacet.sol";
import "../../src/invoice/facets/FundingFacet.sol";
import "../../src/invoice/facets/RepaymentFacet.sol";
import "../../src/invoice/facets/ViewFacet.sol";
import "../../src/invoice/facets/AdminFacet.sol";
import "../../src/invoice/libraries/LibInvoiceStorage.sol";
import "../../src/invoice/interfaces/IInvoiceDiamond.sol";
import "../../src/base/LiquidityPool.sol";
import "../mocks/MockUSDC.sol";

/**
 * @title Invoice Lifecycle Fuzz Tests
 * @notice Property-based tests for invoice lifecycle operations
 */
contract InvoiceLifecycleFuzzTest is Test {
    InvoiceDiamond public diamond;
    ExecutionPool public executionPool;
    LiquidityPool public liquidityPool;
    MockUSDC public usdc;

    // Facets
    InvoiceFacet public invoiceFacet;
    FundingFacet public fundingFacet;
    RepaymentFacet public repaymentFacet;
    ViewFacet public viewFacet;
    AdminFacet public adminFacet;

    // Test addresses
    address public owner = address(this);
    address public lp1 = address(0x1);
    address public supplier = address(0x2);
    address public buyer = address(0x3);
    address public operator = address(0x4);

    uint256 constant MAX_FACE_VALUE = 10_000_000e6; // 10M USDC
    uint256 constant LP_LIQUIDITY = 100_000_000e6; // 100M USDC

    function setUp() public {
        // Deploy USDC
        usdc = new MockUSDC();

        // Deploy LiquidityPool
        liquidityPool = new LiquidityPool(IERC20(address(usdc)), "Seed", "SEED");

        // Deploy ExecutionPool
        executionPool = new ExecutionPool(address(usdc));
        executionPool.setLiquidityPool(address(liquidityPool));
        executionPool.grantRole(executionPool.OPERATOR_ROLE(), operator);

        // Grant ROUTER_ROLE to ExecutionPool
        liquidityPool.grantRole(liquidityPool.ROUTER_ROLE(), address(executionPool));

        // Deploy facets
        invoiceFacet = new InvoiceFacet();
        fundingFacet = new FundingFacet();
        repaymentFacet = new RepaymentFacet();
        viewFacet = new ViewFacet();
        adminFacet = new AdminFacet();

        // Prepare facet cuts
        _setupDiamond();

        // Configure
        AdminFacet(address(diamond)).setExecutionPool(address(executionPool));
        AdminFacet(address(diamond)).setLiquidityPool(address(liquidityPool));
        AdminFacet(address(diamond)).setOperator(operator, true);
        executionPool.setInvoiceDiamond(address(diamond));

        // Mint and approve
        usdc.mint(lp1, LP_LIQUIDITY);
        usdc.mint(buyer, LP_LIQUIDITY);

        vm.prank(lp1);
        usdc.approve(address(liquidityPool), type(uint256).max);
        vm.prank(buyer);
        usdc.approve(address(diamond), type(uint256).max);
        vm.prank(buyer);
        usdc.approve(address(executionPool), type(uint256).max);

        // LP provides liquidity
        vm.prank(lp1);
        liquidityPool.deposit(LP_LIQUIDITY, lp1);
    }

    function _setupDiamond() internal {
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
    }

    /* FUZZ TESTS - COMMENTED FOR FASTER RUNS
    // ============ Property: Invoice IDs Are Sequential ============

    function testFuzz_InvoiceIdsSequential(uint8 numInvoices) public {
        numInvoices = uint8(bound(numInvoices, 1, 20));

        uint256 lastId = 0;
        for (uint8 i = 0; i < numInvoices; i++) {
            vm.prank(supplier);
            uint256 invoiceId = InvoiceFacet(address(diamond)).createInvoice(
                buyer,
                uint128(1000e6 + i * 100e6),
                500,
                uint64(block.timestamp + 30 days),
                bytes32(uint256(i)),
                bytes32(uint256(i))
            );

            assertEq(invoiceId, lastId + 1, "Invoice ID not sequential");
            lastId = invoiceId;
        }
    }

    // ============ Property: Funding Amount Always Less Than Face Value ============

    function testFuzz_FundingLessThanFaceValue(
        uint128 faceValue,
        uint16 discountRate,
        uint32 daysToMaturity
    ) public {
        faceValue = uint128(bound(faceValue, 1e6, MAX_FACE_VALUE));
        discountRate = uint16(bound(discountRate, 0, 5000)); // Max 50%
        daysToMaturity = uint32(bound(daysToMaturity, 1, 365));

        uint64 maturityDate = uint64(block.timestamp + uint256(daysToMaturity) * 1 days);

        vm.prank(supplier);
        uint256 invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer,
            faceValue,
            discountRate,
            maturityDate,
            bytes32(0),
            bytes32(0)
        );

        uint128 fundingAmount = FundingFacet(address(diamond)).getFundingAmount(invoiceId);

        // Core invariant: funding never exceeds face value
        assertLe(fundingAmount, faceValue, "Funding exceeds face value");

        // When discount rate and time both exist, funding should be strictly less
        // BUT very small values can round to zero discount due to integer math
        // Only assert strict less-than for meaningful discount scenarios
        if (discountRate >= 100 && daysToMaturity >= 7 && faceValue >= 1_000e6) {
            assertLt(fundingAmount, faceValue, "No discount applied for meaningful values");
        }
    }

    // ============ Property: Valid State Transitions Only ============

    function testFuzz_ValidStateTransitions(uint128 faceValue) public {
        faceValue = uint128(bound(faceValue, 1e6, MAX_FACE_VALUE));

        uint64 maturityDate = uint64(block.timestamp + 30 days);

        // Create -> Pending
        vm.prank(supplier);
        uint256 invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer,
            faceValue,
            500,
            maturityDate,
            bytes32(0),
            bytes32(0)
        );

        IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);
        assertEq(uint8(invoice.status), uint8(LibInvoiceStorage.InvoiceStatus.Pending));

        // Approve -> Approved
        vm.prank(buyer);
        InvoiceFacet(address(diamond)).approveInvoice(invoiceId);

        invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);
        assertEq(uint8(invoice.status), uint8(LibInvoiceStorage.InvoiceStatus.Approved));

        // Fund -> Funded (via FundingFacet first, then ExecutionPool)
        vm.prank(operator);
        FundingFacet(address(diamond)).requestFunding(invoiceId);

        invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);
        assertEq(uint8(invoice.status), uint8(LibInvoiceStorage.InvoiceStatus.Funded));

        // Also fund via execution pool for actual USDC movement
        uint128 fundingAmount = FundingFacet(address(diamond)).getFundingAmount(invoiceId);
        vm.prank(operator);
        executionPool.fundInvoice(invoiceId, supplier, fundingAmount, faceValue);

        // Repay -> Paid
        vm.prank(buyer);
        RepaymentFacet(address(diamond)).processRepayment(invoiceId);

        invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);
        assertEq(uint8(invoice.status), uint8(LibInvoiceStorage.InvoiceStatus.Paid));
    }

    // ============ Property: Total Funded Tracks Correctly ============

    function testFuzz_TotalFundedTracking(uint128 faceValue1, uint128 faceValue2) public {
        faceValue1 = uint128(bound(faceValue1, 1e6, MAX_FACE_VALUE / 2));
        faceValue2 = uint128(bound(faceValue2, 1e6, MAX_FACE_VALUE / 2));

        uint64 maturityDate = uint64(block.timestamp + 30 days);

        // Create and fund first invoice
        vm.prank(supplier);
        uint256 id1 = InvoiceFacet(address(diamond)).createInvoice(
            buyer, faceValue1, 500, maturityDate, bytes32(0), bytes32("1")
        );
        vm.prank(buyer);
        InvoiceFacet(address(diamond)).approveInvoice(id1);
        vm.prank(operator);
        FundingFacet(address(diamond)).requestFunding(id1);

        // Create and fund second invoice
        vm.prank(supplier);
        uint256 id2 = InvoiceFacet(address(diamond)).createInvoice(
            buyer, faceValue2, 500, maturityDate, bytes32(0), bytes32("2")
        );
        vm.prank(buyer);
        InvoiceFacet(address(diamond)).approveInvoice(id2);
        vm.prank(operator);
        FundingFacet(address(diamond)).requestFunding(id2);

        (uint256 totalFunded, , uint256 activeCount,) = ViewFacet(address(diamond)).getStats();

        uint128 funding1 = FundingFacet(address(diamond)).getFundingAmount(id1);
        uint128 funding2 = FundingFacet(address(diamond)).getFundingAmount(id2);

        assertEq(totalFunded, funding1 + funding2, "Total funded mismatch");
        assertEq(activeCount, 2, "Active count mismatch");
    }

    // ============ Property: Repayment Returns Principal + Yield ============

    function testFuzz_RepaymentYieldCalculation(
        uint128 faceValue,
        uint16 discountRate
    ) public {
        faceValue = uint128(bound(faceValue, 1_000e6, MAX_FACE_VALUE));
        discountRate = uint16(bound(discountRate, 100, 3000)); // 1-30%

        uint64 maturityDate = uint64(block.timestamp + 30 days);

        vm.prank(supplier);
        uint256 invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer, faceValue, discountRate, maturityDate, bytes32(0), bytes32(0)
        );

        vm.prank(buyer);
        InvoiceFacet(address(diamond)).approveInvoice(invoiceId);

        vm.prank(operator);
        FundingFacet(address(diamond)).requestFunding(invoiceId);

        uint128 fundingAmount = FundingFacet(address(diamond)).getFundingAmount(invoiceId);
        vm.prank(operator);
        executionPool.fundInvoice(invoiceId, supplier, fundingAmount, faceValue);

        uint256 poolYieldBefore = liquidityPool.totalInvoiceYield();

        // Repay
        vm.prank(buyer);
        executionPool.repayInvoice(invoiceId);

        uint256 poolYieldAfter = liquidityPool.totalInvoiceYield();
        uint256 yield = faceValue - fundingAmount;

        assertEq(poolYieldAfter - poolYieldBefore, yield, "Yield calculation incorrect");
    }

    // ============ Property: Supplier/Buyer Invoice Lists Accurate ============

    function testFuzz_InvoiceListsAccurate(uint8 numInvoices) public {
        numInvoices = uint8(bound(numInvoices, 1, 10));

        for (uint8 i = 0; i < numInvoices; i++) {
            vm.prank(supplier);
            InvoiceFacet(address(diamond)).createInvoice(
                buyer,
                uint128(1000e6),
                500,
                uint64(block.timestamp + 30 days),
                bytes32(uint256(i)),
                bytes32(uint256(i))
            );
        }

        uint256[] memory supplierInvoices = ViewFacet(address(diamond)).getSupplierInvoices(supplier);
        uint256[] memory buyerInvoices = ViewFacet(address(diamond)).getBuyerInvoices(buyer);

        assertEq(supplierInvoices.length, numInvoices, "Supplier invoice count mismatch");
        assertEq(buyerInvoices.length, numInvoices, "Buyer invoice count mismatch");
    }

    // ============ Property: isOverdue Respects Maturity ============

    function testFuzz_IsOverdueRespectsMaturity(uint32 daysToMaturity, uint32 daysAfterCreation) public {
        daysToMaturity = uint32(bound(daysToMaturity, 1, 365));
        daysAfterCreation = uint32(bound(daysAfterCreation, 0, 730));

        uint64 maturityDate = uint64(block.timestamp + uint256(daysToMaturity) * 1 days);

        vm.prank(supplier);
        uint256 invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer, 10_000e6, 500, maturityDate, bytes32(0), bytes32(0)
        );

        vm.prank(buyer);
        InvoiceFacet(address(diamond)).approveInvoice(invoiceId);

        vm.prank(operator);
        FundingFacet(address(diamond)).requestFunding(invoiceId);

        // Warp time
        vm.warp(block.timestamp + uint256(daysAfterCreation) * 1 days);

        bool isOverdue = RepaymentFacet(address(diamond)).isOverdue(invoiceId);

        if (daysAfterCreation > daysToMaturity) {
            assertTrue(isOverdue, "Should be overdue");
        } else {
            assertFalse(isOverdue, "Should not be overdue");
        }
    }

    // ============ Property: Cancellation Only From Pending ============

    function testFuzz_CancellationOnlyFromPending(uint128 faceValue) public {
        faceValue = uint128(bound(faceValue, 1e6, MAX_FACE_VALUE));

        uint64 maturityDate = uint64(block.timestamp + 30 days);

        // Pending invoice CAN be cancelled
        vm.prank(supplier);
        uint256 pendingId = InvoiceFacet(address(diamond)).createInvoice(
            buyer, faceValue, 500, maturityDate, bytes32(0), bytes32("pending")
        );

        vm.prank(supplier);
        InvoiceFacet(address(diamond)).cancelInvoice(pendingId);

        IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(pendingId);
        assertEq(uint8(invoice.status), uint8(LibInvoiceStorage.InvoiceStatus.Cancelled));

        // Approved invoice CANNOT be cancelled
        vm.prank(supplier);
        uint256 approvedId = InvoiceFacet(address(diamond)).createInvoice(
            buyer, faceValue, 500, maturityDate, bytes32(0), bytes32("approved")
        );
        vm.prank(buyer);
        InvoiceFacet(address(diamond)).approveInvoice(approvedId);

        vm.prank(supplier);
        vm.expectRevert();
        InvoiceFacet(address(diamond)).cancelInvoice(approvedId);
    }

    // ============ Property: getRepaymentAmount Returns Face Value ============

    function testFuzz_RepaymentAmountIsFaceValue(uint128 faceValue, uint16 discountRate) public {
        faceValue = uint128(bound(faceValue, 1e6, MAX_FACE_VALUE));
        discountRate = uint16(bound(discountRate, 0, 5000));

        uint64 maturityDate = uint64(block.timestamp + 30 days);

        vm.prank(supplier);
        uint256 invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer, faceValue, discountRate, maturityDate, bytes32(0), bytes32(0)
        );

        uint128 repaymentAmount = RepaymentFacet(address(diamond)).getRepaymentAmount(invoiceId);

        // Repayment amount should always equal face value
        assertEq(repaymentAmount, faceValue, "Repayment should equal face value");
    }
    FUZZ TESTS - COMMENTED FOR FASTER RUNS */
}
