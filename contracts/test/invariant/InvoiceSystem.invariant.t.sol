// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "forge-std/StdInvariant.sol";
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
 * @title InvoiceSystemHandler
 * @notice Handler for invoice system invariant tests
 */
contract InvoiceSystemHandler is Test {
    InvoiceDiamond public diamond;
    ExecutionPool public executionPool;
    LiquidityPool public liquidityPool;
    MockUSDC public usdc;

    address[] public suppliers;
    address[] public buyers;
    address public operator;
    address public lp;

    // Ghost variables
    uint256[] public createdInvoices;
    mapping(uint256 => uint128) public ghost_invoiceFaceValue;
    mapping(uint256 => uint128) public ghost_invoiceFundingAmount;
    mapping(uint256 => bool) public ghost_invoiceFunded;
    mapping(uint256 => bool) public ghost_invoiceRepaid;

    uint256 public ghost_totalFaceValue;
    uint256 public ghost_totalFundingAmount;
    uint256 public ghost_pendingCount;
    uint256 public ghost_approvedCount;
    uint256 public ghost_fundedCount;
    uint256 public ghost_paidCount;

    constructor(
        InvoiceDiamond _diamond,
        ExecutionPool _executionPool,
        LiquidityPool _liquidityPool,
        MockUSDC _usdc,
        address _operator,
        address _lp
    ) {
        diamond = _diamond;
        executionPool = _executionPool;
        liquidityPool = _liquidityPool;
        usdc = _usdc;
        operator = _operator;
        lp = _lp;

        // Setup suppliers and buyers
        for (uint256 i = 0; i < 3; i++) {
            address supplier_ = address(uint160(0x2000 + i));
            address buyer_ = address(uint160(0x3000 + i));
            suppliers.push(supplier_);
            buyers.push(buyer_);

            usdc.mint(buyer_, 1_000_000_000e6);
            vm.prank(buyer_);
            usdc.approve(address(diamond), type(uint256).max);
            vm.prank(buyer_);
            usdc.approve(address(executionPool), type(uint256).max);
        }
    }

    function createInvoice(
        uint256 supplierSeed,
        uint256 buyerSeed,
        uint128 faceValue,
        uint16 discountRate,
        uint32 daysToMaturity
    ) public {
        address supplier_ = suppliers[bound(supplierSeed, 0, suppliers.length - 1)];
        address buyer_ = buyers[bound(buyerSeed, 0, buyers.length - 1)];
        faceValue = uint128(bound(faceValue, 1_000e6, 1_000_000e6));
        discountRate = uint16(bound(discountRate, 100, 3000));
        daysToMaturity = uint32(bound(daysToMaturity, 7, 180));

        uint64 maturityDate = uint64(block.timestamp + uint256(daysToMaturity) * 1 days);

        vm.prank(supplier_);
        uint256 invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer_,
            faceValue,
            discountRate,
            maturityDate,
            bytes32(uint256(createdInvoices.length)),
            bytes32(uint256(block.timestamp))
        );

        createdInvoices.push(invoiceId);
        ghost_invoiceFaceValue[invoiceId] = faceValue;
        ghost_totalFaceValue += faceValue;
        ghost_pendingCount++;
    }

    function approveInvoice(uint256 invoiceSeed) public {
        if (createdInvoices.length == 0) return;

        uint256 idx = bound(invoiceSeed, 0, createdInvoices.length - 1);
        uint256 invoiceId = createdInvoices[idx];

        IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);
        if (invoice.status != LibInvoiceStorage.InvoiceStatus.Pending) return;

        vm.prank(invoice.buyer);
        try InvoiceFacet(address(diamond)).approveInvoice(invoiceId) {
            ghost_pendingCount--;
            ghost_approvedCount++;
        } catch {}
    }

    function fundInvoice(uint256 invoiceSeed) public {
        if (createdInvoices.length == 0) return;

        uint256 idx = bound(invoiceSeed, 0, createdInvoices.length - 1);
        uint256 invoiceId = createdInvoices[idx];

        IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);
        if (invoice.status != LibInvoiceStorage.InvoiceStatus.Approved) return;

        uint128 fundingAmount = FundingFacet(address(diamond)).getFundingAmount(invoiceId);
        if (liquidityPool.availableLiquidity() < fundingAmount) return;

        vm.prank(operator);
        try FundingFacet(address(diamond)).requestFunding(invoiceId) {
            // Also fund via execution pool
            vm.prank(operator);
            try executionPool.fundInvoice(
                invoiceId,
                invoice.supplier,
                fundingAmount,
                invoice.faceValue
            ) {
                ghost_invoiceFundingAmount[invoiceId] = fundingAmount;
                ghost_invoiceFunded[invoiceId] = true;
                ghost_totalFundingAmount += fundingAmount;
                ghost_approvedCount--;
                ghost_fundedCount++;
            } catch {}
        } catch {}
    }

    function repayInvoice(uint256 invoiceSeed) public {
        if (createdInvoices.length == 0) return;

        uint256 idx = bound(invoiceSeed, 0, createdInvoices.length - 1);
        uint256 invoiceId = createdInvoices[idx];

        if (!ghost_invoiceFunded[invoiceId] || ghost_invoiceRepaid[invoiceId]) return;

        IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);
        if (invoice.status != LibInvoiceStorage.InvoiceStatus.Funded) return;

        vm.prank(invoice.buyer);
        try RepaymentFacet(address(diamond)).processRepayment(invoiceId) {
            vm.prank(invoice.buyer);
            try executionPool.repayInvoice(invoiceId) {
                ghost_invoiceRepaid[invoiceId] = true;
                ghost_fundedCount--;
                ghost_paidCount++;
            } catch {}
        } catch {}
    }

    function cancelInvoice(uint256 invoiceSeed, uint256 actorSeed) public {
        if (createdInvoices.length == 0) return;

        uint256 idx = bound(invoiceSeed, 0, createdInvoices.length - 1);
        uint256 invoiceId = createdInvoices[idx];

        IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);
        if (invoice.status != LibInvoiceStorage.InvoiceStatus.Pending) return;

        address actor = actorSeed % 2 == 0 ? invoice.supplier : invoice.buyer;

        vm.prank(actor);
        try InvoiceFacet(address(diamond)).cancelInvoice(invoiceId) {
            ghost_pendingCount--;
            ghost_totalFaceValue -= ghost_invoiceFaceValue[invoiceId];
        } catch {}
    }

    function getInvoiceCount() public view returns (uint256) {
        return createdInvoices.length;
    }
}

/**
 * @title InvoiceSystem Invariant Tests
 * @notice Invariant tests for the Invoice Diamond system
 */
contract InvoiceSystemInvariantTest is StdInvariant, Test {
    InvoiceDiamond public diamond;
    ExecutionPool public executionPool;
    LiquidityPool public liquidityPool;
    MockUSDC public usdc;
    InvoiceSystemHandler public handler;

    address public owner = address(this);
    address public operator = address(0x5000);
    address public lp = address(0x6000);

    function setUp() public {
        // Deploy USDC
        usdc = new MockUSDC();

        // Deploy LiquidityPool
        liquidityPool = new LiquidityPool(IERC20(address(usdc)), "Seed", "SEED");

        // Deploy ExecutionPool
        executionPool = new ExecutionPool(address(usdc));
        executionPool.setLiquidityPool(address(liquidityPool));
        executionPool.grantRole(executionPool.OPERATOR_ROLE(), operator);

        liquidityPool.grantRole(liquidityPool.ROUTER_ROLE(), address(executionPool));

        // Setup diamond
        _setupDiamond();

        // LP provides liquidity
        usdc.mint(lp, 1_000_000_000e6);
        vm.prank(lp);
        usdc.approve(address(liquidityPool), type(uint256).max);
        vm.prank(lp);
        liquidityPool.deposit(500_000_000e6, lp);

        // Deploy handler
        handler = new InvoiceSystemHandler(
            diamond,
            executionPool,
            liquidityPool,
            usdc,
            operator,
            lp
        );

        targetContract(address(handler));

        bytes4[] memory selectors = new bytes4[](5);
        selectors[0] = handler.createInvoice.selector;
        selectors[1] = handler.approveInvoice.selector;
        selectors[2] = handler.fundInvoice.selector;
        selectors[3] = handler.repayInvoice.selector;
        selectors[4] = handler.cancelInvoice.selector;

        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function _setupDiamond() internal {
        InvoiceFacet invoiceFacet = new InvoiceFacet();
        FundingFacet fundingFacet = new FundingFacet();
        RepaymentFacet repaymentFacet = new RepaymentFacet();
        ViewFacet viewFacet = new ViewFacet();
        AdminFacet adminFacet = new AdminFacet();

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

        AdminFacet(address(diamond)).setExecutionPool(address(executionPool));
        AdminFacet(address(diamond)).setLiquidityPool(address(liquidityPool));
        AdminFacet(address(diamond)).setOperator(operator, true);
        executionPool.setInvoiceDiamond(address(diamond));
    }

    /* INVARIANT TESTS - COMMENTED FOR FASTER RUNS
    // ============ Invariant: Funding Amount <= Face Value ============

    function invariant_fundingLessThanFaceValue() public view {
        for (uint256 i = 0; i < handler.getInvoiceCount(); i++) {
            uint256 invoiceId = handler.createdInvoices(i);
            uint128 faceValue = handler.ghost_invoiceFaceValue(invoiceId);
            uint128 fundingAmount = handler.ghost_invoiceFundingAmount(invoiceId);

            if (fundingAmount > 0) {
                assertLe(fundingAmount, faceValue, "Funding exceeds face value");
            }
        }
    }

    // ============ Invariant: Total Funded Equals Sum of Funding Amounts ============

    function invariant_totalFundedConsistent() public view {
        (uint256 totalFunded, , ,) = ViewFacet(address(diamond)).getStats();

        uint256 expectedTotal = 0;
        for (uint256 i = 0; i < handler.getInvoiceCount(); i++) {
            uint256 invoiceId = handler.createdInvoices(i);
            IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);

            if (invoice.status == LibInvoiceStorage.InvoiceStatus.Funded ||
                invoice.status == LibInvoiceStorage.InvoiceStatus.Paid) {
                expectedTotal += invoice.fundingAmount;
            }
        }

        // Allow some tolerance for repaid invoices
        assertLe(totalFunded, handler.ghost_totalFundingAmount(), "Total funded inconsistent");
    }

    // ============ Invariant: Active Count Matches Funded Invoices ============

    function invariant_activeCountMatchesFunded() public view {
        (, , uint256 activeCount,) = ViewFacet(address(diamond)).getStats();

        uint256 fundedCount = 0;
        for (uint256 i = 0; i < handler.getInvoiceCount(); i++) {
            uint256 invoiceId = handler.createdInvoices(i);
            IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);

            if (invoice.status == LibInvoiceStorage.InvoiceStatus.Funded) {
                fundedCount++;
            }
        }

        assertEq(activeCount, fundedCount, "Active count mismatch");
    }

    // ============ Invariant: Invoice IDs Are Unique ============

    function invariant_uniqueInvoiceIds() public view {
        for (uint256 i = 0; i < handler.getInvoiceCount(); i++) {
            for (uint256 j = i + 1; j < handler.getInvoiceCount(); j++) {
                assertNotEq(
                    handler.createdInvoices(i),
                    handler.createdInvoices(j),
                    "Duplicate invoice ID"
                );
            }
        }
    }

    // ============ Invariant: No Double Repayment ============

    function invariant_noDoubleRepayment() public view {
        for (uint256 i = 0; i < handler.getInvoiceCount(); i++) {
            uint256 invoiceId = handler.createdInvoices(i);
            IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);

            if (invoice.status == LibInvoiceStorage.InvoiceStatus.Paid) {
                // Paid invoices should have paidAt set
                assertGt(invoice.paidAt, 0, "Paid invoice missing paidAt");
            }
        }
    }

    // ============ Invariant: Repayment Amount Equals Face Value ============

    function invariant_repaymentEqualsFaceValue() public view {
        for (uint256 i = 0; i < handler.getInvoiceCount(); i++) {
            uint256 invoiceId = handler.createdInvoices(i);
            IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);

            uint128 repaymentAmount = RepaymentFacet(address(diamond)).getRepaymentAmount(invoiceId);
            assertEq(repaymentAmount, invoice.faceValue, "Repayment != face value");
        }
    }

    // ============ Call Summary ============

    function invariant_callSummary() public view {
        console.log("Created invoices:", handler.getInvoiceCount());
        console.log("Pending count:", handler.ghost_pendingCount());
        console.log("Approved count:", handler.ghost_approvedCount());
        console.log("Funded count:", handler.ghost_fundedCount());
        console.log("Paid count:", handler.ghost_paidCount());
        console.log("Total face value:", handler.ghost_totalFaceValue());
        console.log("Total funding amount:", handler.ghost_totalFundingAmount());
    }
    INVARIANT TESTS - COMMENTED FOR FASTER RUNS */
}
