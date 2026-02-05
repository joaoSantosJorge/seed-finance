// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";

// Core contracts
import "src/base/LiquidityPool.sol";
import "src/invoice/ExecutionPool.sol";
import "src/invoice/InvoiceDiamond.sol";

// Facets
import "src/invoice/facets/InvoiceFacet.sol";
import "src/invoice/facets/FundingFacet.sol";
import "src/invoice/facets/RepaymentFacet.sol";
import "src/invoice/facets/ViewFacet.sol";
import "src/invoice/facets/AdminFacet.sol";

// Interfaces
import "src/invoice/interfaces/IInvoiceDiamond.sol";
import "src/invoice/libraries/LibInvoiceStorage.sol";

// Mock
import "test/mocks/MockUSDC.sol";

/**
 * @title TestWorkflow
 * @notice Full workflow test script for the invoice financing lifecycle on Anvil
 *
 * Tests the complete two-step funding flow:
 * 1. Financier deposits 100,000 USDC → LiquidityPool
 * 2. Supplier creates 10,000 USDC invoice (30 days maturity)
 * 3. Buyer approves invoice (Pending → Approved)
 * 4. Operator approves funding (Approved → FundingApproved)
 * 5. Supplier triggers funding (FundingApproved → Funded) + receives USDC
 * 6. Time moves forward 30 days + 1 block
 * 7. Buyer repays invoice at maturity (Funded → Paid)
 *
 * Usage:
 *   # Terminal 1: Start fresh Anvil
 *   anvil --host 0.0.0.0 --accounts 10 --balance 10000
 *
 *   # Terminal 2: Run workflow test
 *   forge script script/TestWorkflow.s.sol:TestWorkflow \
 *     --rpc-url http://localhost:8545 \
 *     --broadcast
 *
 * Anvil Default Accounts:
 *   Account 0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (Deployer/Operator)
 *   Account 1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (Financier/LP)
 *   Account 2: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC (Supplier)
 *   Account 3: 0x90F79bf6EB2c4f870365E785982E1f101E93b906 (Buyer)
 */
contract TestWorkflow is Script {
    // Anvil default accounts (deterministic from mnemonic)
    address constant DEPLOYER = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address constant FINANCIER = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address constant SUPPLIER = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
    address constant BUYER = 0x90F79bf6EB2c4f870365E785982E1f101E93b906;

    // Anvil default private keys
    uint256 constant DEPLOYER_PK = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    uint256 constant FINANCIER_PK = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    uint256 constant SUPPLIER_PK = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;
    uint256 constant BUYER_PK = 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6;

    // Test amounts (USDC has 6 decimals)
    uint256 constant MINT_AMOUNT = 1_000_000 * 1e6; // 1M USDC each
    uint256 constant LP_DEPOSIT = 100_000 * 1e6; // 100k USDC
    uint128 constant INVOICE_FACE_VALUE = 10_000 * 1e6; // 10k USDC
    uint16 constant DISCOUNT_RATE_BPS = 500; // 5% APR
    uint256 constant MIN_LIQUIDITY_BUFFER = 10_000 * 1e6; // 10k USDC

    // Deployed contracts
    MockUSDC public usdc;
    LiquidityPool public liquidityPool;
    InvoiceDiamond public invoiceDiamond;
    ExecutionPool public executionPool;

    // Facets
    InvoiceFacet public invoiceFacet;
    FundingFacet public fundingFacet;
    RepaymentFacet public repaymentFacet;
    ViewFacet public viewFacet;
    AdminFacet public adminFacet;

    function run() public {
        // Verify we're on a local chain (Anvil chain ID is 31337)
        require(block.chainid == 31337, "This script is for Anvil local testing only");

        console.log("");
        console.log("==========================================================");
        console.log("      SEED FINANCE - FULL WORKFLOW TEST ON ANVIL");
        console.log("==========================================================");
        console.log("");

        // ===== STEP 0: Deploy all contracts =====
        _deployContracts();

        // ===== STEP 1: Financier deposits USDC =====
        _step1_financierDeposit();

        // ===== STEP 2: Supplier creates invoice =====
        uint256 invoiceId = _step2_supplierCreatesInvoice();

        // ===== STEP 3: Buyer approves invoice =====
        _step3_buyerApprovesInvoice(invoiceId);

        // ===== STEP 4: Operator approves funding =====
        _step4_operatorApprovesFunding(invoiceId);

        // ===== STEP 5: Supplier triggers funding =====
        _step5_supplierTriggersFunding(invoiceId);

        // ===== STEP 6: Time warp to maturity =====
        _step6_timeWarpToMaturity();

        // ===== STEP 7: Buyer repays invoice =====
        _step7_buyerRepaysInvoice(invoiceId);

        // ===== Final Summary =====
        _printFinalSummary();
    }

    // ============ Deployment ============

    function _deployContracts() internal {
        console.log("STEP 0: Deploying contracts...");
        console.log("----------------------------------------------------------");

        vm.startBroadcast(DEPLOYER_PK);

        // Deploy MockUSDC
        usdc = new MockUSDC();
        console.log("  MockUSDC deployed at:", address(usdc));

        // Deploy LiquidityPool
        liquidityPool = new LiquidityPool(
            IERC20(address(usdc)),
            "Seed Finance LP Token",
            "SEED"
        );
        liquidityPool.setLiquidityBuffer(MIN_LIQUIDITY_BUFFER);
        console.log("  LiquidityPool deployed at:", address(liquidityPool));

        // Deploy Facets
        invoiceFacet = new InvoiceFacet();
        fundingFacet = new FundingFacet();
        repaymentFacet = new RepaymentFacet();
        viewFacet = new ViewFacet();
        adminFacet = new AdminFacet();
        console.log("  All facets deployed");

        // Build FacetCut array
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

        // FundingFacet selectors (8 total for two-step funding flow)
        bytes4[] memory fundingSelectors = new bytes4[](8);
        fundingSelectors[0] = FundingFacet.approveFunding.selector;
        fundingSelectors[1] = FundingFacet.batchApproveFunding.selector;
        fundingSelectors[2] = FundingFacet.canApproveFunding.selector;
        fundingSelectors[3] = FundingFacet.supplierRequestFunding.selector;
        fundingSelectors[4] = FundingFacet.requestFunding.selector;
        fundingSelectors[5] = FundingFacet.batchFund.selector;
        fundingSelectors[6] = FundingFacet.canFundInvoice.selector;
        fundingSelectors[7] = FundingFacet.getFundingAmount.selector;

        cuts[1] = InvoiceDiamond.FacetCut({
            facetAddress: address(fundingFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: fundingSelectors
        });

        // RepaymentFacet selectors
        bytes4[] memory repaymentSelectors = new bytes4[](4);
        repaymentSelectors[0] = RepaymentFacet.processRepayment.selector;
        repaymentSelectors[1] = RepaymentFacet.markDefaulted.selector;
        repaymentSelectors[2] = RepaymentFacet.getRepaymentAmount.selector;
        repaymentSelectors[3] = RepaymentFacet.isOverdue.selector;

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
        invoiceDiamond = new InvoiceDiamond(cuts, address(0), "");
        AdminFacet(address(invoiceDiamond)).initialize(DEPLOYER, address(usdc));
        console.log("  InvoiceDiamond deployed at:", address(invoiceDiamond));

        // Deploy ExecutionPool
        executionPool = new ExecutionPool(address(usdc));
        console.log("  ExecutionPool deployed at:", address(executionPool));

        // Configure access control and links
        executionPool.setLiquidityPool(address(liquidityPool));
        executionPool.setInvoiceDiamond(address(invoiceDiamond));
        liquidityPool.grantRole(liquidityPool.ROUTER_ROLE(), address(executionPool));
        AdminFacet(address(invoiceDiamond)).setExecutionPool(address(executionPool));
        AdminFacet(address(invoiceDiamond)).setLiquidityPool(address(liquidityPool));
        AdminFacet(address(invoiceDiamond)).setOperator(DEPLOYER, true);
        console.log("  Access control configured");

        // Mint test USDC
        usdc.mint(FINANCIER, MINT_AMOUNT);
        usdc.mint(SUPPLIER, MINT_AMOUNT);
        usdc.mint(BUYER, MINT_AMOUNT);
        console.log("  Minted 1M USDC to each test account");

        vm.stopBroadcast();

        console.log("");
        console.log("  Deployment complete!");
        console.log("");
    }

    // ============ Workflow Steps ============

    function _step1_financierDeposit() internal {
        console.log("STEP 1: Financier deposits USDC to LiquidityPool");
        console.log("----------------------------------------------------------");

        uint256 balanceBefore = usdc.balanceOf(FINANCIER);
        console.log("  Financier USDC balance before:", balanceBefore / 1e6, "USDC");

        vm.startBroadcast(FINANCIER_PK);

        // Approve and deposit
        usdc.approve(address(liquidityPool), LP_DEPOSIT);
        uint256 shares = liquidityPool.deposit(LP_DEPOSIT, FINANCIER);

        vm.stopBroadcast();

        uint256 balanceAfter = usdc.balanceOf(FINANCIER);
        uint256 shareBalance = liquidityPool.balanceOf(FINANCIER);

        console.log("  Deposited:", LP_DEPOSIT / 1e6, "USDC");
        console.log("  SEED shares received:", shares);
        console.log("  Financier USDC balance after:", balanceAfter / 1e6, "USDC");
        console.log("  LiquidityPool totalAssets:", liquidityPool.totalAssets() / 1e6, "USDC");
        console.log("  LiquidityPool availableLiquidity:", liquidityPool.availableLiquidity() / 1e6, "USDC");
        console.log("");

        require(shareBalance == shares, "Share balance mismatch");
        require(liquidityPool.totalAssets() == LP_DEPOSIT, "Total assets mismatch");
    }

    function _step2_supplierCreatesInvoice() internal returns (uint256 invoiceId) {
        console.log("STEP 2: Supplier creates invoice");
        console.log("----------------------------------------------------------");

        uint64 maturityDate = uint64(block.timestamp + 30 days);

        vm.startBroadcast(SUPPLIER_PK);

        invoiceId = InvoiceFacet(address(invoiceDiamond)).createInvoice(
            BUYER,
            INVOICE_FACE_VALUE,
            DISCOUNT_RATE_BPS,
            maturityDate,
            keccak256("sample-invoice-doc"),
            bytes32("INV-2024-001")
        );

        vm.stopBroadcast();

        IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(invoiceDiamond)).getInvoice(invoiceId);

        console.log("  Invoice ID:", invoiceId);
        console.log("  Face Value:", INVOICE_FACE_VALUE / 1e6, "USDC");
        console.log("  Discount Rate:", DISCOUNT_RATE_BPS, "bps (5% APR)");
        console.log("  Maturity: 30 days from now");
        console.log("  Status:", _statusToString(invoice.status));
        console.log("  Supplier:", SUPPLIER);
        console.log("  Buyer:", BUYER);
        console.log("");

        require(invoice.status == LibInvoiceStorage.InvoiceStatus.Pending, "Invoice should be Pending");
    }

    function _step3_buyerApprovesInvoice(uint256 invoiceId) internal {
        console.log("STEP 3: Buyer approves invoice");
        console.log("----------------------------------------------------------");

        vm.startBroadcast(BUYER_PK);
        InvoiceFacet(address(invoiceDiamond)).approveInvoice(invoiceId);
        vm.stopBroadcast();

        IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(invoiceDiamond)).getInvoice(invoiceId);

        console.log("  Invoice ID:", invoiceId);
        console.log("  New Status:", _statusToString(invoice.status));
        console.log("  canApproveFunding:", FundingFacet(address(invoiceDiamond)).canApproveFunding(invoiceId));
        console.log("");

        require(invoice.status == LibInvoiceStorage.InvoiceStatus.Approved, "Invoice should be Approved");
    }

    function _step4_operatorApprovesFunding(uint256 invoiceId) internal {
        console.log("STEP 4: Operator approves funding");
        console.log("----------------------------------------------------------");

        vm.startBroadcast(DEPLOYER_PK);
        FundingFacet(address(invoiceDiamond)).approveFunding(invoiceId);
        vm.stopBroadcast();

        IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(invoiceDiamond)).getInvoice(invoiceId);

        console.log("  Invoice ID:", invoiceId);
        console.log("  New Status:", _statusToString(invoice.status));
        console.log("  canFundInvoice:", FundingFacet(address(invoiceDiamond)).canFundInvoice(invoiceId));
        console.log("");

        require(invoice.status == LibInvoiceStorage.InvoiceStatus.FundingApproved, "Invoice should be FundingApproved");
    }

    function _step5_supplierTriggersFunding(uint256 invoiceId) internal {
        console.log("STEP 5: Supplier triggers funding");
        console.log("----------------------------------------------------------");

        uint128 fundingAmount = FundingFacet(address(invoiceDiamond)).getFundingAmount(invoiceId);
        uint256 supplierBalanceBefore = usdc.balanceOf(SUPPLIER);

        console.log("  Funding amount (after discount):", fundingAmount / 1e6, "USDC");
        console.log("  Discount:", (INVOICE_FACE_VALUE - fundingAmount) / 1e6, "USDC");
        console.log("  Supplier USDC before:", supplierBalanceBefore / 1e6, "USDC");

        // Step 5a: Supplier triggers funding via Diamond (updates status)
        vm.startBroadcast(SUPPLIER_PK);
        FundingFacet(address(invoiceDiamond)).supplierRequestFunding(invoiceId);
        vm.stopBroadcast();

        // Step 5b: Execute actual USDC transfer via ExecutionPool (supplier can call this directly)
        vm.startBroadcast(SUPPLIER_PK);
        executionPool.fundInvoice(invoiceId, SUPPLIER, fundingAmount, INVOICE_FACE_VALUE);
        vm.stopBroadcast();

        uint256 supplierBalanceAfter = usdc.balanceOf(SUPPLIER);
        IInvoiceDiamond.InvoiceView memory invoice = ViewFacet(address(invoiceDiamond)).getInvoice(invoiceId);

        console.log("  Supplier USDC after:", supplierBalanceAfter / 1e6, "USDC");
        console.log("  Supplier received:", (supplierBalanceAfter - supplierBalanceBefore) / 1e6, "USDC");
        console.log("  Diamond status:", _statusToString(invoice.status));
        console.log("  Pool totalDeployed:", liquidityPool.totalDeployed() / 1e6, "USDC");
        console.log("  Pool availableLiquidity:", liquidityPool.availableLiquidity() / 1e6, "USDC");
        console.log("  ExecutionPool activeInvoices:", executionPool.activeInvoices());
        console.log("");

        require(invoice.status == LibInvoiceStorage.InvoiceStatus.Funded, "Invoice should be Funded");
        require(supplierBalanceAfter - supplierBalanceBefore == fundingAmount, "Supplier should receive funding amount");
    }

    function _step6_timeWarpToMaturity() internal {
        console.log("STEP 6: Time warp to maturity (30 days + 1 second)");
        console.log("----------------------------------------------------------");

        uint256 currentTime = block.timestamp;
        uint256 targetTime = currentTime + 30 days + 1;

        vm.warp(targetTime);

        console.log("  Original timestamp:", currentTime);
        console.log("  Warped to timestamp:", block.timestamp);
        console.log("  Time advanced: 30 days + 1 second");
        console.log("");
    }

    function _step7_buyerRepaysInvoice(uint256 invoiceId) internal {
        console.log("STEP 7: Buyer repays invoice at maturity");
        console.log("----------------------------------------------------------");

        uint256 buyerBalanceBefore = usdc.balanceOf(BUYER);
        uint256 poolAssetsBefore = liquidityPool.totalAssets();

        console.log("  Buyer USDC before:", buyerBalanceBefore / 1e6, "USDC");
        console.log("  Pool totalAssets before:", poolAssetsBefore / 1e6, "USDC");

        // NOTE: Must go through InvoiceDiamond.processRepayment() to update both
        // the Diamond's invoice status AND the ExecutionPool's funding record
        vm.startBroadcast(BUYER_PK);
        // Approve the Diamond (not ExecutionPool) - it transfers USDC to ExecutionPool
        usdc.approve(address(invoiceDiamond), INVOICE_FACE_VALUE);
        // Call processRepayment through the Diamond to update invoice status to Paid
        RepaymentFacet(address(invoiceDiamond)).processRepayment(invoiceId);
        vm.stopBroadcast();

        uint256 buyerBalanceAfter = usdc.balanceOf(BUYER);
        uint256 poolAssetsAfter = liquidityPool.totalAssets();
        uint256 totalYield = liquidityPool.totalInvoiceYield();

        console.log("  Buyer USDC after:", buyerBalanceAfter / 1e6, "USDC");
        console.log("  Buyer paid:", (buyerBalanceBefore - buyerBalanceAfter) / 1e6, "USDC");
        console.log("  Pool totalAssets after:", poolAssetsAfter / 1e6, "USDC");
        console.log("  Pool totalDeployed:", liquidityPool.totalDeployed() / 1e6, "USDC");
        console.log("  Pool totalInvoiceYield:", totalYield / 1e6, "USDC");
        console.log("  ExecutionPool activeInvoices:", executionPool.activeInvoices());
        console.log("");

        require(buyerBalanceBefore - buyerBalanceAfter == INVOICE_FACE_VALUE, "Buyer should pay face value");
        require(executionPool.activeInvoices() == 0, "No active invoices should remain");
        require(liquidityPool.totalDeployed() == 0, "No capital should be deployed");

        // Verify invoice status was updated to Paid in the Diamond
        IInvoiceDiamond.InvoiceView memory paidInvoice = ViewFacet(address(invoiceDiamond)).getInvoice(invoiceId);
        require(paidInvoice.status == LibInvoiceStorage.InvoiceStatus.Paid, "Invoice status should be Paid");
        require(paidInvoice.paidAt > 0, "Invoice paidAt should be set");
        console.log("  Invoice status: Paid (verified)");
    }

    function _printFinalSummary() internal view {
        console.log("==========================================================");
        console.log("                    FINAL SUMMARY");
        console.log("==========================================================");
        console.log("");

        uint256 lpShares = liquidityPool.balanceOf(FINANCIER);
        uint256 lpShareValue = liquidityPool.convertToAssets(lpShares);
        uint256 profit = lpShareValue - LP_DEPOSIT;
        uint256 totalYield = liquidityPool.totalInvoiceYield();

        console.log("LiquidityPool State:");
        console.log("  Total Assets:", liquidityPool.totalAssets() / 1e6, "USDC");
        console.log("  Total Deployed:", liquidityPool.totalDeployed() / 1e6, "USDC");
        console.log("  Available Liquidity:", liquidityPool.availableLiquidity() / 1e6, "USDC");
        console.log("  Total Invoice Yield:", totalYield / 1e6, "USDC");
        console.log("");

        console.log("Financier Position:");
        console.log("  SEED Shares:", lpShares);
        console.log("  Share Value:", lpShareValue / 1e6, "USDC");
        console.log("  Initial Deposit:", LP_DEPOSIT / 1e6, "USDC");
        console.log("  Profit:", profit / 1e6, "USDC");
        console.log("");

        console.log("ExecutionPool State:");
        console.log("  Total Funded:", executionPool.totalFunded() / 1e6, "USDC");
        console.log("  Total Repaid:", executionPool.totalRepaid() / 1e6, "USDC");
        console.log("  Active Invoices:", executionPool.activeInvoices());
        console.log("");

        console.log("==========================================================");
        console.log("           WORKFLOW TEST COMPLETED SUCCESSFULLY!");
        console.log("==========================================================");
        console.log("");
    }

    // ============ Helpers ============

    function _statusToString(LibInvoiceStorage.InvoiceStatus status) internal pure returns (string memory) {
        if (status == LibInvoiceStorage.InvoiceStatus.Pending) return "Pending";
        if (status == LibInvoiceStorage.InvoiceStatus.Approved) return "Approved";
        if (status == LibInvoiceStorage.InvoiceStatus.FundingApproved) return "FundingApproved";
        if (status == LibInvoiceStorage.InvoiceStatus.Funded) return "Funded";
        if (status == LibInvoiceStorage.InvoiceStatus.Paid) return "Paid";
        if (status == LibInvoiceStorage.InvoiceStatus.Cancelled) return "Cancelled";
        if (status == LibInvoiceStorage.InvoiceStatus.Defaulted) return "Defaulted";
        return "Unknown";
    }
}
