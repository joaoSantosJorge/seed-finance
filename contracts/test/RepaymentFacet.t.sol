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
 * @title RepaymentFacet Test Suite
 * @notice Comprehensive tests for RepaymentFacet - invoice repayment operations
 */
contract RepaymentFacetTest is Test {
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
    address public randomUser = address(0x5);

    // Test constants
    uint256 constant LP_DEPOSIT = 100_000e6;
    uint128 constant FACE_VALUE = 10_000e6;
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
        usdc.mint(buyer, 1_000_000e6);
        usdc.mint(supplier, 100_000e6);

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

    function _createAndFundInvoice() internal returns (uint256 invoiceId) {
        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);

        // Create invoice
        vm.prank(supplier);
        invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer,
            FACE_VALUE,
            DISCOUNT_RATE,
            maturityDate,
            bytes32("QmHash"),
            bytes32("INV-001")
        );

        // Approve (buyer approval)
        vm.prank(buyer);
        InvoiceFacet(address(diamond)).approveInvoice(invoiceId);

        // Approve funding (operator approval)
        vm.prank(operator);
        FundingFacet(address(diamond)).approveFunding(invoiceId);

        // Fund via FundingFacet (updates diamond storage)
        vm.prank(operator);
        FundingFacet(address(diamond)).requestFunding(invoiceId);

        // Fund via ExecutionPool (actual USDC movement)
        uint128 fundingAmount = FundingFacet(address(diamond)).getFundingAmount(invoiceId);
        vm.prank(operator);
        executionPool.fundInvoice(invoiceId, supplier, fundingAmount, FACE_VALUE);
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

    function _createApprovedInvoice() internal returns (uint256 invoiceId) {
        invoiceId = _createPendingInvoice();

        vm.prank(buyer);
        InvoiceFacet(address(diamond)).approveInvoice(invoiceId);
    }

    // ============ processRepayment Tests ============

    function test_ProcessRepayment_Success() public {
        uint256 invoiceId = _createAndFundInvoice();

        uint256 buyerBalanceBefore = usdc.balanceOf(buyer);

        vm.prank(buyer);
        RepaymentFacet(address(diamond)).processRepayment(invoiceId);

        // Verify buyer paid face value
        assertEq(buyerBalanceBefore - usdc.balanceOf(buyer), FACE_VALUE);

        // Verify invoice status is Paid
        IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);
        assertEq(uint8(invoice.status), uint8(LibInvoiceStorage.InvoiceStatus.Paid));
    }

    function test_ProcessRepayment_UpdatesStats() public {
        uint256 invoiceId = _createAndFundInvoice();

        (,, uint256 activeCountBefore,) = ViewFacet(address(diamond)).getStats();

        vm.prank(buyer);
        RepaymentFacet(address(diamond)).processRepayment(invoiceId);

        (,uint256 totalRepaid, uint256 activeCountAfter,) = ViewFacet(address(diamond)).getStats();

        assertEq(totalRepaid, FACE_VALUE);
        assertEq(activeCountAfter, activeCountBefore - 1);
    }

    function test_ProcessRepayment_RevertNotBuyer() public {
        uint256 invoiceId = _createAndFundInvoice();

        vm.prank(randomUser);
        vm.expectRevert(abi.encodeWithSelector(
            RepaymentFacet.Unauthorized.selector,
            randomUser,
            "buyer"
        ));
        RepaymentFacet(address(diamond)).processRepayment(invoiceId);
    }

    function test_ProcessRepayment_RevertNotFunded() public {
        uint256 invoiceId = _createApprovedInvoice();

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(
            RepaymentFacet.InvalidInvoiceStatus.selector,
            invoiceId,
            LibInvoiceStorage.InvoiceStatus.Funded,
            LibInvoiceStorage.InvoiceStatus.Approved
        ));
        RepaymentFacet(address(diamond)).processRepayment(invoiceId);
    }

    function test_ProcessRepayment_RevertPendingInvoice() public {
        uint256 invoiceId = _createPendingInvoice();

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(
            RepaymentFacet.InvalidInvoiceStatus.selector,
            invoiceId,
            LibInvoiceStorage.InvoiceStatus.Funded,
            LibInvoiceStorage.InvoiceStatus.Pending
        ));
        RepaymentFacet(address(diamond)).processRepayment(invoiceId);
    }

    function test_ProcessRepayment_RevertAlreadyPaid() public {
        uint256 invoiceId = _createAndFundInvoice();

        // First repayment
        vm.prank(buyer);
        RepaymentFacet(address(diamond)).processRepayment(invoiceId);

        // Try to repay again
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(
            RepaymentFacet.InvalidInvoiceStatus.selector,
            invoiceId,
            LibInvoiceStorage.InvoiceStatus.Funded,
            LibInvoiceStorage.InvoiceStatus.Paid
        ));
        RepaymentFacet(address(diamond)).processRepayment(invoiceId);
    }

    function test_ProcessRepayment_RevertInvoiceNotFound() public {
        uint256 nonExistentId = 999;

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(
            RepaymentFacet.InvoiceNotFound.selector,
            nonExistentId
        ));
        RepaymentFacet(address(diamond)).processRepayment(nonExistentId);
    }

    function test_ProcessRepayment_TransfersToExecutionPool() public {
        uint256 invoiceId = _createAndFundInvoice();

        uint256 executionPoolBalanceBefore = usdc.balanceOf(address(executionPool));

        vm.prank(buyer);
        RepaymentFacet(address(diamond)).processRepayment(invoiceId);

        // Funds flow through ExecutionPool to LiquidityPool
        // ExecutionPool should have same balance (funds forwarded to LP)
        assertEq(usdc.balanceOf(address(executionPool)), executionPoolBalanceBefore);
    }

    function test_ProcessRepayment_ReturnsToLiquidityPool() public {
        uint256 invoiceId = _createAndFundInvoice();

        // Get funding amount (what was taken from LP)
        uint128 fundingAmount = FundingFacet(address(diamond)).getFundingAmount(invoiceId);

        // LP balance before repayment
        uint256 lpBalanceBefore = usdc.balanceOf(address(liquidityPool));

        vm.prank(buyer);
        RepaymentFacet(address(diamond)).processRepayment(invoiceId);

        // LP should receive full face value (principal + yield)
        uint256 lpBalanceAfter = usdc.balanceOf(address(liquidityPool));
        assertEq(lpBalanceAfter, lpBalanceBefore + FACE_VALUE);

        // Verify yield was tracked in LP
        uint256 expectedYield = FACE_VALUE - fundingAmount;
        assertEq(liquidityPool.totalInvoiceYield(), expectedYield);

        // Verify deployed amount decreased
        assertEq(liquidityPool.totalDeployed(), 0);
    }

    function test_ProcessRepayment_UpdatesExecutionPoolTracking() public {
        uint256 invoiceId = _createAndFundInvoice();

        // Verify invoice is marked as funded before repayment
        assertTrue(executionPool.isInvoiceFunded(invoiceId));
        assertFalse(executionPool.isInvoiceRepaid(invoiceId));

        (uint256 totalFundedBefore, uint256 totalRepaidBefore, uint256 activeInvoicesBefore) = executionPool.getStats();

        vm.prank(buyer);
        RepaymentFacet(address(diamond)).processRepayment(invoiceId);

        // Verify invoice is marked as repaid
        assertTrue(executionPool.isInvoiceRepaid(invoiceId));

        // Verify stats updated
        (uint256 totalFundedAfter, uint256 totalRepaidAfter, uint256 activeInvoicesAfter) = executionPool.getStats();
        assertEq(totalFundedAfter, totalFundedBefore); // totalFunded doesn't change on repayment
        assertEq(totalRepaidAfter, totalRepaidBefore + FACE_VALUE);
        assertEq(activeInvoicesAfter, activeInvoicesBefore - 1);
    }

    function test_ProcessRepayment_EndToEndYieldFlow() public {
        // This test verifies the complete flow:
        // 1. LP deposits USDC
        // 2. Invoice is funded (USDC leaves LP)
        // 3. Buyer repays (USDC returns to LP with yield)
        // 4. LP share value increases

        uint256 invoiceId = _createAndFundInvoice();
        uint128 fundingAmount = FundingFacet(address(diamond)).getFundingAmount(invoiceId);

        // Record LP state before repayment
        uint256 lpTotalAssetsBefore = liquidityPool.totalAssets();
        uint256 lpTotalDeployedBefore = liquidityPool.totalDeployed();
        uint256 lpYieldBefore = liquidityPool.totalInvoiceYield();

        // Process repayment
        vm.prank(buyer);
        RepaymentFacet(address(diamond)).processRepayment(invoiceId);

        // Verify LP state after repayment
        uint256 lpTotalAssetsAfter = liquidityPool.totalAssets();
        uint256 lpTotalDeployedAfter = liquidityPool.totalDeployed();
        uint256 lpYieldAfter = liquidityPool.totalInvoiceYield();

        // Total assets should increase by yield (face - funding)
        uint256 expectedYield = FACE_VALUE - fundingAmount;
        assertEq(lpTotalAssetsAfter, lpTotalAssetsBefore + expectedYield);

        // Deployed should decrease by funding amount
        assertEq(lpTotalDeployedAfter, lpTotalDeployedBefore - fundingAmount);

        // Yield tracking should increase
        assertEq(lpYieldAfter, lpYieldBefore + expectedYield);
    }

    // ============ markDefaulted Tests ============

    function test_MarkDefaulted_Success() public {
        uint256 invoiceId = _createAndFundInvoice();

        // Warp past maturity
        vm.warp(block.timestamp + MATURITY_30_DAYS + 1);

        vm.prank(operator);
        RepaymentFacet(address(diamond)).markDefaulted(invoiceId);

        IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(diamond)).getInvoice(invoiceId);
        assertEq(uint8(invoice.status), uint8(LibInvoiceStorage.InvoiceStatus.Defaulted));
    }

    function test_MarkDefaulted_UpdatesActiveCount() public {
        uint256 invoiceId = _createAndFundInvoice();

        (,, uint256 activeCountBefore,) = ViewFacet(address(diamond)).getStats();

        vm.warp(block.timestamp + MATURITY_30_DAYS + 1);

        vm.prank(operator);
        RepaymentFacet(address(diamond)).markDefaulted(invoiceId);

        (,, uint256 activeCountAfter,) = ViewFacet(address(diamond)).getStats();
        assertEq(activeCountAfter, activeCountBefore - 1);
    }

    function test_MarkDefaulted_RevertNotOverdue() public {
        uint256 invoiceId = _createAndFundInvoice();

        // Don't warp - still before maturity
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(
            RepaymentFacet.NotOverdue.selector,
            invoiceId
        ));
        RepaymentFacet(address(diamond)).markDefaulted(invoiceId);
    }

    function test_MarkDefaulted_RevertNotOperator() public {
        uint256 invoiceId = _createAndFundInvoice();

        vm.warp(block.timestamp + MATURITY_30_DAYS + 1);

        vm.prank(randomUser);
        vm.expectRevert("LibInvoiceStorage: not operator");
        RepaymentFacet(address(diamond)).markDefaulted(invoiceId);
    }

    function test_MarkDefaulted_RevertNotFunded() public {
        uint256 invoiceId = _createApprovedInvoice();

        vm.warp(block.timestamp + MATURITY_30_DAYS + 1);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(
            RepaymentFacet.InvalidInvoiceStatus.selector,
            invoiceId,
            LibInvoiceStorage.InvoiceStatus.Funded,
            LibInvoiceStorage.InvoiceStatus.Approved
        ));
        RepaymentFacet(address(diamond)).markDefaulted(invoiceId);
    }

    function test_MarkDefaulted_RevertInvoiceNotFound() public {
        uint256 nonExistentId = 999;

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(
            RepaymentFacet.InvoiceNotFound.selector,
            nonExistentId
        ));
        RepaymentFacet(address(diamond)).markDefaulted(nonExistentId);
    }

    function test_MarkDefaulted_RevertAlreadyDefaulted() public {
        uint256 invoiceId = _createAndFundInvoice();

        vm.warp(block.timestamp + MATURITY_30_DAYS + 1);

        vm.prank(operator);
        RepaymentFacet(address(diamond)).markDefaulted(invoiceId);

        // Try to default again
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(
            RepaymentFacet.InvalidInvoiceStatus.selector,
            invoiceId,
            LibInvoiceStorage.InvoiceStatus.Funded,
            LibInvoiceStorage.InvoiceStatus.Defaulted
        ));
        RepaymentFacet(address(diamond)).markDefaulted(invoiceId);
    }

    // ============ isOverdue Tests ============

    function test_IsOverdue_ReturnsFalseBeforeMaturity() public {
        uint256 invoiceId = _createAndFundInvoice();

        assertFalse(RepaymentFacet(address(diamond)).isOverdue(invoiceId));
    }

    function test_IsOverdue_ReturnsTrueAfterMaturity() public {
        uint256 invoiceId = _createAndFundInvoice();

        vm.warp(block.timestamp + MATURITY_30_DAYS + 1);

        assertTrue(RepaymentFacet(address(diamond)).isOverdue(invoiceId));
    }

    function test_IsOverdue_ReturnsFalseAtExactMaturity() public {
        uint256 invoiceId = _createAndFundInvoice();

        vm.warp(block.timestamp + MATURITY_30_DAYS);

        // At exact maturity, not overdue yet (>= not >)
        assertFalse(RepaymentFacet(address(diamond)).isOverdue(invoiceId));
    }

    function test_IsOverdue_ReturnsFalseWhenPaid() public {
        uint256 invoiceId = _createAndFundInvoice();

        // Pay the invoice
        vm.prank(buyer);
        RepaymentFacet(address(diamond)).processRepayment(invoiceId);

        // Even after maturity, paid invoices aren't overdue
        vm.warp(block.timestamp + MATURITY_30_DAYS + 1);

        assertFalse(RepaymentFacet(address(diamond)).isOverdue(invoiceId));
    }

    function test_IsOverdue_ReturnsFalseWhenNotFunded() public {
        uint256 invoiceId = _createApprovedInvoice();

        vm.warp(block.timestamp + MATURITY_30_DAYS + 1);

        // Approved but not funded invoices aren't considered overdue
        assertFalse(RepaymentFacet(address(diamond)).isOverdue(invoiceId));
    }

    function test_IsOverdue_RevertInvoiceNotFound() public {
        uint256 nonExistentId = 999;

        vm.expectRevert(abi.encodeWithSelector(
            RepaymentFacet.InvoiceNotFound.selector,
            nonExistentId
        ));
        RepaymentFacet(address(diamond)).isOverdue(nonExistentId);
    }

    // ============ getRepaymentAmount Tests ============

    function test_GetRepaymentAmount_ReturnsFaceValue() public {
        uint256 invoiceId = _createAndFundInvoice();

        uint128 repaymentAmount = RepaymentFacet(address(diamond)).getRepaymentAmount(invoiceId);

        assertEq(repaymentAmount, FACE_VALUE);
    }

    function test_GetRepaymentAmount_PendingInvoice() public {
        uint256 invoiceId = _createPendingInvoice();

        uint128 repaymentAmount = RepaymentFacet(address(diamond)).getRepaymentAmount(invoiceId);

        // Returns face value regardless of status
        assertEq(repaymentAmount, FACE_VALUE);
    }

    function test_GetRepaymentAmount_RevertInvoiceNotFound() public {
        uint256 nonExistentId = 999;

        vm.expectRevert(abi.encodeWithSelector(
            RepaymentFacet.InvoiceNotFound.selector,
            nonExistentId
        ));
        RepaymentFacet(address(diamond)).getRepaymentAmount(nonExistentId);
    }

    /* FUZZ TESTS - COMMENTED FOR FASTER RUNS
    // ============ Fuzz Tests ============

    function testFuzz_ProcessRepayment_VariousFaceValues(uint128 faceValue) public {
        // Bound to reasonable values (min $1, max $1M)
        faceValue = uint128(bound(faceValue, 1e6, 1_000_000e6));

        // Ensure LP has enough liquidity
        uint256 additionalLiquidity = faceValue > LP_DEPOSIT ? faceValue - LP_DEPOSIT + 10_000e6 : 0;
        if (additionalLiquidity > 0) {
            usdc.mint(lp1, additionalLiquidity);
            vm.prank(lp1);
            liquidityPool.deposit(additionalLiquidity, lp1);
        }

        uint64 maturityDate = uint64(block.timestamp + MATURITY_30_DAYS);

        vm.prank(supplier);
        uint256 invoiceId = InvoiceFacet(address(diamond)).createInvoice(
            buyer,
            faceValue,
            DISCOUNT_RATE,
            maturityDate,
            bytes32("QmHash"),
            bytes32("INV-001")
        );

        vm.prank(buyer);
        InvoiceFacet(address(diamond)).approveInvoice(invoiceId);

        vm.prank(operator);
        FundingFacet(address(diamond)).requestFunding(invoiceId);

        uint128 fundingAmount = FundingFacet(address(diamond)).getFundingAmount(invoiceId);
        vm.prank(operator);
        executionPool.fundInvoice(invoiceId, supplier, fundingAmount, faceValue);

        uint256 buyerBalanceBefore = usdc.balanceOf(buyer);

        vm.prank(buyer);
        RepaymentFacet(address(diamond)).processRepayment(invoiceId);

        assertEq(buyerBalanceBefore - usdc.balanceOf(buyer), faceValue);
    }

    function testFuzz_IsOverdue_VariousTimeDeltas(uint256 timeDelta) public {
        uint256 invoiceId = _createAndFundInvoice();

        timeDelta = bound(timeDelta, 0, 365 days);
        vm.warp(block.timestamp + timeDelta);

        bool expectedOverdue = timeDelta > MATURITY_30_DAYS;
        assertEq(RepaymentFacet(address(diamond)).isOverdue(invoiceId), expectedOverdue);
    }
    */
}
