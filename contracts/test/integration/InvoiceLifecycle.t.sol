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
 * @title InvoiceLifecycleTest
 * @notice Full integration test for the invoice financing lifecycle
 * @dev Tests the complete flow: LP deposit -> Invoice creation -> Approval -> Funding -> Repayment
 */
contract InvoiceLifecycleTest is Test {
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
    address public lp2 = address(0x2);
    address public supplier = address(0x3);
    address public buyer = address(0x4);
    address public operator = address(0x5);

    // Test constants
    uint256 constant LP_DEPOSIT = 100_000e6; // 100k USDC
    uint128 constant INVOICE_FACE_VALUE = 10_000e6; // 10k USDC
    uint16 constant DISCOUNT_RATE = 500; // 5% annual
    uint64 constant MATURITY_30_DAYS = 30 days;

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

        // Deploy diamond
        bytes memory initData = abi.encodeWithSelector(
            AdminFacet.initialize.selector,
            owner,
            address(usdc)
        );

        diamond = new InvoiceDiamond(cuts, address(adminFacet), initData);

        // Configure diamond
        AdminFacet(address(diamond)).setExecutionPool(address(executionPool));
        AdminFacet(address(diamond)).setLiquidityPool(address(liquidityPool));
        AdminFacet(address(diamond)).setOperator(operator, true);

        // Set diamond in execution pool
        executionPool.setInvoiceDiamond(address(diamond));

        // Mint USDC to test accounts
        usdc.mint(lp1, 1_000_000e6);
        usdc.mint(lp2, 1_000_000e6);
        usdc.mint(buyer, 1_000_000e6);
        usdc.mint(supplier, 100_000e6);

        // Approve spending
        vm.prank(lp1);
        usdc.approve(address(liquidityPool), type(uint256).max);
        vm.prank(lp2);
        usdc.approve(address(liquidityPool), type(uint256).max);
        vm.prank(buyer);
        usdc.approve(address(executionPool), type(uint256).max);
    }

    /**
     * @notice Full lifecycle test: LP deposit -> Invoice -> Fund -> Repay -> LP withdrawal
     */
    function test_FullInvoiceLifecycle() public {
        // ==========================================
        // PHASE 1: LP deposits USDC
        // ==========================================
        vm.prank(lp1);
        uint256 shares = liquidityPool.deposit(LP_DEPOSIT, lp1);

        assertGt(shares, 0);
        assertEq(liquidityPool.totalAssets(), LP_DEPOSIT);
        assertEq(liquidityPool.balanceOf(lp1), shares);

        console.log("Phase 1 - LP deposited:", LP_DEPOSIT / 1e6, "USDC");
        console.log("LP received shares:", shares);

        // ==========================================
        // PHASE 2: Supplier creates invoice
        // ==========================================
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);

        vm.prank(supplier);
        uint256 invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer,
            INVOICE_FACE_VALUE,
            DISCOUNT_RATE,
            maturityDate,
            bytes32("QmInvoiceHash123"),
            bytes32("INV-2024-001")
        );

        assertEq(invoiceId, 1);

        IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);
        assertEq(uint8(invoice.status), uint8(LibInvoiceStorage.InvoiceStatus.Pending));

        console.log("Phase 2 - Invoice created, ID:", invoiceId);
        console.log("Face value:", INVOICE_FACE_VALUE / 1e6, "USDC");

        // ==========================================
        // PHASE 3: Buyer approves invoice
        // ==========================================
        vm.prank(buyer);
        InvoiceFacet(address(diamond)).approveInvoice(invoiceId);

        invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);
        assertEq(uint8(invoice.status), uint8(LibInvoiceStorage.InvoiceStatus.Approved));

        console.log("Phase 3 - Invoice approved by buyer");

        // ==========================================
        // PHASE 4: Operator triggers funding
        // ==========================================
        uint128 fundingAmount = FundingFacet(address(diamond)).getFundingAmount(invoiceId);

        // Calculate expected discount (5% annual, 30 days)
        // discount = faceValue * rate * time / 365 days
        uint256 expectedDiscount = (uint256(INVOICE_FACE_VALUE) * DISCOUNT_RATE * MATURITY_30_DAYS) / (10000 * 365 days);
        uint256 expectedFunding = INVOICE_FACE_VALUE - expectedDiscount;

        console.log("Phase 4 - Expected funding amount:", expectedFunding / 1e6, "USDC");
        console.log("Calculated funding amount:", fundingAmount / 1e6, "USDC");
        console.log("Discount amount:", expectedDiscount / 1e6, "USDC");

        // Note: fundingAmount is approximate due to integer division
        assertApproxEqAbs(fundingAmount, expectedFunding, 1e6); // Within 1 USDC

        uint256 supplierBalanceBefore = usdc.balanceOf(supplier);

        // Fund via ExecutionPool (operator action)
        vm.prank(operator);
        executionPool.fundInvoice(invoiceId, supplier, fundingAmount, INVOICE_FACE_VALUE);

        // Verify supplier received funds
        assertEq(usdc.balanceOf(supplier), supplierBalanceBefore + fundingAmount);

        // Verify pool stats
        assertEq(liquidityPool.totalDeployed(), fundingAmount);
        assertEq(executionPool.activeInvoices(), 1);

        console.log("Phase 4 - Supplier received:", fundingAmount / 1e6, "USDC");
        console.log("Pool deployed:", liquidityPool.totalDeployed() / 1e6, "USDC");

        // ==========================================
        // PHASE 5: Time passes to maturity
        // ==========================================
        vm.warp(block.timestamp + MATURITY_30_DAYS);

        console.log("Phase 5 - Warped to maturity date");

        // ==========================================
        // PHASE 6: Buyer repays invoice
        // ==========================================
        uint256 buyerBalanceBefore = usdc.balanceOf(buyer);

        vm.prank(buyer);
        executionPool.repayInvoice(invoiceId);

        // Verify buyer paid face value
        assertEq(buyerBalanceBefore - usdc.balanceOf(buyer), INVOICE_FACE_VALUE);

        // Verify pool received repayment with yield
        uint256 yield = INVOICE_FACE_VALUE - fundingAmount;
        assertEq(liquidityPool.totalInvoiceYield(), yield);
        assertEq(liquidityPool.totalDeployed(), 0);

        console.log("Phase 6 - Buyer repaid:", INVOICE_FACE_VALUE / 1e6, "USDC");
        console.log("Yield earned:", yield / 1e6, "USDC");

        // ==========================================
        // PHASE 7: LP withdraws with yield
        // ==========================================
        // Share value should have increased
        uint256 shareValueAfter = liquidityPool.convertToAssets(shares);
        assertGt(shareValueAfter, LP_DEPOSIT);

        console.log("Phase 7 - LP shares now worth:", shareValueAfter / 1e6, "USDC");
        console.log("LP profit:", (shareValueAfter - LP_DEPOSIT) / 1e6, "USDC");

        // LP redeems all shares
        vm.prank(lp1);
        uint256 withdrawn = liquidityPool.redeem(shares, lp1, lp1);

        assertGt(withdrawn, LP_DEPOSIT);
        assertApproxEqAbs(withdrawn, LP_DEPOSIT + yield, 1e6);

        console.log("Phase 7 - LP withdrew:", withdrawn / 1e6, "USDC");
        console.log("LP earned yield:", (withdrawn - LP_DEPOSIT) / 1e6, "USDC");
    }

    /**
     * @notice Test multiple invoices processed concurrently
     */
    function test_MultipleInvoicesConcurrent() public {
        // LP deposits
        vm.prank(lp1);
        liquidityPool.deposit(LP_DEPOSIT, lp1);

        // Create 3 invoices
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);

        vm.startPrank(supplier);
        uint256 inv1 = InvoiceFacet(address(diamond)).createInvoice(buyer, 5_000e6, DISCOUNT_RATE, maturityDate, bytes32(0), bytes32("INV-1"));
        uint256 inv2 = InvoiceFacet(address(diamond)).createInvoice(buyer, 10_000e6, DISCOUNT_RATE, maturityDate, bytes32(0), bytes32("INV-2"));
        uint256 inv3 = InvoiceFacet(address(diamond)).createInvoice(buyer, 7_500e6, DISCOUNT_RATE, maturityDate, bytes32(0), bytes32("INV-3"));
        vm.stopPrank();

        // Buyer approves all
        vm.startPrank(buyer);
        InvoiceFacet(address(diamond)).approveInvoice(inv1);
        InvoiceFacet(address(diamond)).approveInvoice(inv2);
        InvoiceFacet(address(diamond)).approveInvoice(inv3);
        vm.stopPrank();

        // Fund all
        uint128 funding1 = FundingFacet(address(diamond)).getFundingAmount(inv1);
        uint128 funding2 = FundingFacet(address(diamond)).getFundingAmount(inv2);
        uint128 funding3 = FundingFacet(address(diamond)).getFundingAmount(inv3);

        vm.startPrank(operator);
        executionPool.fundInvoice(inv1, supplier, funding1, 5_000e6);
        executionPool.fundInvoice(inv2, supplier, funding2, 10_000e6);
        executionPool.fundInvoice(inv3, supplier, funding3, 7_500e6);
        vm.stopPrank();

        assertEq(executionPool.activeInvoices(), 3);
        assertEq(liquidityPool.totalDeployed(), funding1 + funding2 + funding3);

        // Warp and repay all
        vm.warp(block.timestamp + MATURITY_30_DAYS);

        vm.startPrank(buyer);
        executionPool.repayInvoice(inv1);
        executionPool.repayInvoice(inv2);
        executionPool.repayInvoice(inv3);
        vm.stopPrank();

        // Verify all repaid
        assertEq(executionPool.activeInvoices(), 0);
        assertEq(liquidityPool.totalDeployed(), 0);

        // Total yield should be sum of all discounts
        uint256 totalFaceValue = 5_000e6 + 10_000e6 + 7_500e6;
        uint256 totalFunding = funding1 + funding2 + funding3;
        assertEq(liquidityPool.totalInvoiceYield(), totalFaceValue - totalFunding);
    }

    /**
     * @notice Test invoice cancellation flow
     */
    function test_InvoiceCancellation() public {
        // Create invoice
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);
        vm.prank(supplier);
        uint256 invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer, INVOICE_FACE_VALUE, DISCOUNT_RATE, maturityDate, bytes32(0), bytes32(0)
        );

        // Supplier cancels
        vm.prank(supplier);
        InvoiceFacet(address(diamond)).cancelInvoice(invoiceId);

        IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);
        assertEq(uint8(invoice.status), uint8(LibInvoiceStorage.InvoiceStatus.Cancelled));

        // Verify cannot fund cancelled invoice
        assertFalse(FundingFacet(address(diamond)).canFundInvoice(invoiceId));
    }

    /**
     * @notice Test overdue invoice handling
     * @dev Note: The Diamond's FundingFacet.requestFunding updates the diamond storage status.
     *      When using ExecutionPool.fundInvoice directly, only ExecutionPool tracks the funding.
     *      This test verifies the ExecutionPool's tracking independent of diamond status.
     */
    function test_OverdueInvoice() public {
        // LP deposits
        vm.prank(lp1);
        liquidityPool.deposit(LP_DEPOSIT, lp1);

        // Create and approve invoice
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);
        vm.prank(supplier);
        uint256 invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer, INVOICE_FACE_VALUE, DISCOUNT_RATE, maturityDate, bytes32(0), bytes32(0)
        );

        vm.prank(buyer);
        InvoiceFacet(address(diamond)).approveInvoice(invoiceId);

        // Fund via Diamond's FundingFacet (updates diamond storage)
        // This updates the invoice status in diamond storage
        vm.prank(operator);
        FundingFacet(address(diamond)).requestFunding(invoiceId);

        // Now fund via ExecutionPool (for actual USDC movement)
        uint128 fundingAmount = FundingFacet(address(diamond)).getFundingAmount(invoiceId);
        vm.prank(operator);
        executionPool.fundInvoice(invoiceId, supplier, fundingAmount, INVOICE_FACE_VALUE);

        // Check diamond status is now Funded
        IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);
        assertEq(uint8(invoice.status), uint8(LibInvoiceStorage.InvoiceStatus.Funded));

        // Not overdue yet (maturity in future)
        assertFalse(RepaymentFacet(address(diamond)).isOverdue(invoiceId));

        // Warp past maturity
        vm.warp(block.timestamp + MATURITY_30_DAYS + 1);

        // Now overdue
        assertTrue(RepaymentFacet(address(diamond)).isOverdue(invoiceId));

        // Buyer can still repay via ExecutionPool
        vm.prank(buyer);
        executionPool.repayInvoice(invoiceId);

        // Invoice is now paid in ExecutionPool records
        ExecutionPool.FundingRecord memory record = executionPool.getFundingRecord(invoiceId);
        assertTrue(record.repaid);
    }

    /**
     * @notice Test share price increase from yield
     */
    function test_SharePriceIncrease() public {
        // Both LPs deposit equal amounts
        vm.prank(lp1);
        uint256 shares1 = liquidityPool.deposit(LP_DEPOSIT, lp1);
        vm.prank(lp2);
        uint256 shares2 = liquidityPool.deposit(LP_DEPOSIT, lp2);

        assertEq(shares1, shares2); // Equal deposits = equal shares

        // Initial share price
        uint256 initialPrice = liquidityPool.convertToAssets(1e6);
        console.log("Initial share price:", initialPrice);

        // Process invoice
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);
        vm.prank(supplier);
        uint256 invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer, INVOICE_FACE_VALUE, DISCOUNT_RATE, maturityDate, bytes32(0), bytes32(0)
        );

        vm.prank(buyer);
        InvoiceFacet(address(diamond)).approveInvoice(invoiceId);

        uint128 fundingAmount = FundingFacet(address(diamond)).getFundingAmount(invoiceId);
        vm.prank(operator);
        executionPool.fundInvoice(invoiceId, supplier, fundingAmount, INVOICE_FACE_VALUE);

        vm.warp(block.timestamp + MATURITY_30_DAYS);
        vm.prank(buyer);
        executionPool.repayInvoice(invoiceId);

        // Share price should have increased
        uint256 finalPrice = liquidityPool.convertToAssets(1e6);
        console.log("Final share price:", finalPrice);

        assertGt(finalPrice, initialPrice);

        // Both LPs should have equal value (they deposited equal amounts)
        uint256 value1 = liquidityPool.convertToAssets(shares1);
        uint256 value2 = liquidityPool.convertToAssets(shares2);
        assertEq(value1, value2);

        console.log("LP1 position value:", value1 / 1e6, "USDC");
        console.log("LP2 position value:", value2 / 1e6, "USDC");
    }
}
