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
 * @title TestWorkflowExtensive
 * @notice Extensive multi-party workflow test for the invoice financing lifecycle on Anvil
 *
 * Tests the complete workflow with:
 * - 5 Suppliers (Accounts 2-6)
 * - 5 Buyers (Accounts 7-11)
 * - 20 Invoices total (4 per supplier)
 * - 1 Financier (Account 1)
 * - 1 Deployer/Operator (Account 0)
 *
 * Usage:
 *   # Terminal 1: Start fresh Anvil with 12 accounts
 *   anvil --host 0.0.0.0 --accounts 12 --balance 10000
 *
 *   # Terminal 2: Run extensive workflow test
 *   forge script script/TestWorkflowExtensive.s.sol:TestWorkflowExtensive \
 *     --rpc-url http://localhost:8545 \
 *     --broadcast
 */
contract TestWorkflowExtensive is Script {
    // ============ Anvil Accounts ============

    // Deployer/Operator (Account 0)
    address constant DEPLOYER = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    uint256 constant DEPLOYER_PK = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    // Financier (Account 1)
    address constant FINANCIER = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    uint256 constant FINANCIER_PK = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;

    // Suppliers (Accounts 2-6)
    address[5] internal SUPPLIERS = [
        0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC, // Account 2
        0x90F79bf6EB2c4f870365E785982E1f101E93b906, // Account 3
        0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65, // Account 4
        0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc, // Account 5
        0x976EA74026E726554dB657fA54763abd0C3a0aa9  // Account 6
    ];

    uint256[5] internal SUPPLIER_PKS = [
        0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a,
        0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6,
        0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a,
        0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba,
        0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e
    ];

    // Buyers (Accounts 7-11)
    address[5] internal BUYERS = [
        0x14dC79964da2C08b23698B3D3cc7Ca32193d9955, // Account 7
        0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f, // Account 8
        0xa0Ee7A142d267C1f36714E4a8F75612F20a79720, // Account 9
        0xBcd4042DE499D14e55001CcbB24a551F3b954096, // Account 10
        0x71bE63f3384f5fb98995898A86B02Fb2426c5788  // Account 11
    ];

    uint256[5] internal BUYER_PKS = [
        0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356,
        0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97,
        0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6,
        0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897,
        0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82
    ];

    // ============ Test Parameters ============

    uint256 constant MINT_AMOUNT = 1_000_000 * 1e6; // 1M USDC each
    uint256 constant LP_DEPOSIT = 500_000 * 1e6;    // 500k USDC (enough for all invoices)
    uint256 constant MIN_LIQUIDITY_BUFFER = 10_000 * 1e6; // 10k USDC

    // Invoice face values (in USDC with 6 decimals) - varied amounts
    // 4 invoices per supplier x 5 suppliers = 20 invoices
    uint128[4][5] internal FACE_VALUES = [
        [uint128(5_000 * 1e6), uint128(8_000 * 1e6), uint128(12_000 * 1e6), uint128(7_000 * 1e6)],  // Supplier 1
        [uint128(6_000 * 1e6), uint128(9_000 * 1e6), uint128(11_000 * 1e6), uint128(8_000 * 1e6)],  // Supplier 2
        [uint128(7_000 * 1e6), uint128(10_000 * 1e6), uint128(6_000 * 1e6), uint128(9_000 * 1e6)],  // Supplier 3
        [uint128(8_000 * 1e6), uint128(7_000 * 1e6), uint128(13_000 * 1e6), uint128(10_000 * 1e6)], // Supplier 4
        [uint128(9_000 * 1e6), uint128(11_000 * 1e6), uint128(5_000 * 1e6), uint128(8_000 * 1e6)]   // Supplier 5
    ];

    // Discount rates in basis points (varied: 300-700 bps = 3-7% APR)
    uint16[4][5] internal DISCOUNT_RATES = [
        [uint16(300), uint16(400), uint16(500), uint16(350)],  // Supplier 1
        [uint16(450), uint16(350), uint16(600), uint16(400)],  // Supplier 2
        [uint16(500), uint16(550), uint16(300), uint16(450)],  // Supplier 3
        [uint16(400), uint16(700), uint16(350), uint16(500)],  // Supplier 4
        [uint16(550), uint16(400), uint16(650), uint16(300)]   // Supplier 5
    ];

    // Maturity days (varied: 15-60 days)
    uint64[4][5] internal MATURITY_DAYS = [
        [uint64(30), uint64(45), uint64(60), uint64(20)],  // Supplier 1
        [uint64(15), uint64(30), uint64(45), uint64(25)],  // Supplier 2
        [uint64(40), uint64(35), uint64(20), uint64(50)],  // Supplier 3
        [uint64(25), uint64(55), uint64(30), uint64(40)],  // Supplier 4
        [uint64(35), uint64(20), uint64(45), uint64(60)]   // Supplier 5
    ];

    // Buyer assignment: each supplier's 4 invoices go to different buyers (rotating)
    // Supplier 1: Buyer 1, 2, 3, 4
    // Supplier 2: Buyer 2, 3, 4, 5
    // etc. (rotating pattern)
    uint8[4][5] internal BUYER_INDICES = [
        [uint8(0), uint8(1), uint8(2), uint8(3)],  // Supplier 1 → Buyers 1,2,3,4
        [uint8(1), uint8(2), uint8(3), uint8(4)],  // Supplier 2 → Buyers 2,3,4,5
        [uint8(2), uint8(3), uint8(4), uint8(0)],  // Supplier 3 → Buyers 3,4,5,1
        [uint8(3), uint8(4), uint8(0), uint8(1)],  // Supplier 4 → Buyers 4,5,1,2
        [uint8(4), uint8(0), uint8(1), uint8(2)]   // Supplier 5 → Buyers 5,1,2,3
    ];

    // ============ Structs ============

    struct InvoiceData {
        uint256 id;
        uint256 supplierIndex;
        uint256 buyerIndex;
        uint128 faceValue;
        uint128 fundingAmount;
        uint16 discountRateBps;
        uint64 maturityDate;
    }

    // ============ Storage ============

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

    // Track all invoices
    InvoiceData[] public allInvoices;
    uint256 public totalFaceValue;
    uint256 public totalFundingAmount;

    // ============ Main Entry ============

    function run() public {
        require(block.chainid == 31337, "This script is for Anvil local testing only");

        console.log("");
        console.log("==========================================================");
        console.log("    SEED FINANCE - EXTENSIVE MULTI-PARTY TEST ON ANVIL");
        console.log("==========================================================");
        console.log("");
        console.log("Participants: 5 Suppliers, 5 Buyers, 1 Financier");
        console.log("Total Invoices: 20 (4 per supplier)");
        console.log("");

        // Phase 1: Deploy all contracts
        _phase1_deploy();

        // Phase 2: Financier deposits
        _phase2_financierDeposit();

        // Phase 3: Create all invoices
        _phase3_createInvoices();

        // Phase 4: Buyers approve invoices
        _phase4_buyerApprovals();

        // Phase 5: Operator batch approves funding
        _phase5_operatorApprovesFunding();

        // Phase 6: Suppliers trigger funding
        _phase6_suppliersFund();

        // Phase 7: Time warp to longest maturity
        _phase7_timeWarp();

        // Phase 8: Buyers repay
        _phase8_buyerRepayments();

        // Final summary
        _printFinalSummary();
    }

    // ============ Phase 1: Deployment ============

    function _phase1_deploy() internal {
        console.log("PHASE 1: Deploying contracts");
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

        // FundingFacet selectors
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

        // Configure access control
        executionPool.setLiquidityPool(address(liquidityPool));
        executionPool.setInvoiceDiamond(address(invoiceDiamond));
        liquidityPool.grantRole(liquidityPool.ROUTER_ROLE(), address(executionPool));
        AdminFacet(address(invoiceDiamond)).setExecutionPool(address(executionPool));
        AdminFacet(address(invoiceDiamond)).setLiquidityPool(address(liquidityPool));
        AdminFacet(address(invoiceDiamond)).setOperator(DEPLOYER, true);
        console.log("  Access control configured");

        // Mint USDC to all participants
        usdc.mint(FINANCIER, MINT_AMOUNT);
        console.log("  Minted 1M USDC to Financier");

        for (uint256 i = 0; i < 5; i++) {
            usdc.mint(SUPPLIERS[i], MINT_AMOUNT);
            usdc.mint(BUYERS[i], MINT_AMOUNT);
        }
        console.log("  Minted 1M USDC to each Supplier and Buyer");

        vm.stopBroadcast();

        console.log("  Deployment complete!");
        console.log("");
    }

    // ============ Phase 2: Financier Deposit ============

    function _phase2_financierDeposit() internal {
        console.log("PHASE 2: Financier deposits", LP_DEPOSIT / 1e6, "USDC");
        console.log("----------------------------------------------------------");

        vm.startBroadcast(FINANCIER_PK);

        usdc.approve(address(liquidityPool), LP_DEPOSIT);
        uint256 shares = liquidityPool.deposit(LP_DEPOSIT, FINANCIER);

        vm.stopBroadcast();

        console.log("  SEED shares received:", shares);
        console.log("  LiquidityPool totalAssets:", liquidityPool.totalAssets() / 1e6, "USDC");
        console.log("  LiquidityPool availableLiquidity:", liquidityPool.availableLiquidity() / 1e6, "USDC");
        console.log("");
    }

    // ============ Phase 3: Create Invoices ============

    function _phase3_createInvoices() internal {
        console.log("PHASE 3: Creating 20 invoices (4 per supplier)");
        console.log("----------------------------------------------------------");

        for (uint256 s = 0; s < 5; s++) {
            vm.startBroadcast(SUPPLIER_PKS[s]);

            for (uint256 i = 0; i < 4; i++) {
                uint256 buyerIndex = BUYER_INDICES[s][i];
                uint64 maturityDate = uint64(block.timestamp + MATURITY_DAYS[s][i] * 1 days);

                uint256 invoiceId = InvoiceFacet(address(invoiceDiamond)).createInvoice(
                    BUYERS[buyerIndex],
                    FACE_VALUES[s][i],
                    DISCOUNT_RATES[s][i],
                    maturityDate,
                    keccak256(abi.encodePacked("invoice-doc-", s, "-", i)),
                    bytes32(abi.encodePacked("INV-", s, "-", i))
                );

                // Track invoice data
                allInvoices.push(InvoiceData({
                    id: invoiceId,
                    supplierIndex: s,
                    buyerIndex: buyerIndex,
                    faceValue: FACE_VALUES[s][i],
                    fundingAmount: 0, // Will be set after funding
                    discountRateBps: DISCOUNT_RATES[s][i],
                    maturityDate: maturityDate
                }));

                totalFaceValue += FACE_VALUES[s][i];
            }

            vm.stopBroadcast();

            console.log("  Supplier", s + 1, "created 4 invoices");
        }

        console.log("");
        console.log("  Total invoices created: 20");
        console.log("  Total face value:", totalFaceValue / 1e6, "USDC");
        console.log("");
    }

    // ============ Phase 4: Buyer Approvals ============

    function _phase4_buyerApprovals() internal {
        console.log("PHASE 4: Buyers approve all 20 invoices");
        console.log("----------------------------------------------------------");

        // Group invoices by buyer for efficiency
        for (uint256 b = 0; b < 5; b++) {
            uint256 approvedCount = 0;

            vm.startBroadcast(BUYER_PKS[b]);

            for (uint256 i = 0; i < allInvoices.length; i++) {
                if (allInvoices[i].buyerIndex == b) {
                    InvoiceFacet(address(invoiceDiamond)).approveInvoice(allInvoices[i].id);
                    approvedCount++;
                }
            }

            vm.stopBroadcast();

            console.log("  Buyer %d approved %d invoices", b + 1, approvedCount);
        }

        console.log("");
    }

    // ============ Phase 5: Operator Approves Funding ============

    function _phase5_operatorApprovesFunding() internal {
        console.log("PHASE 5: Operator batch-approves funding for 20 invoices");
        console.log("----------------------------------------------------------");

        // Build array of all invoice IDs
        uint256[] memory invoiceIds = new uint256[](allInvoices.length);
        for (uint256 i = 0; i < allInvoices.length; i++) {
            invoiceIds[i] = allInvoices[i].id;
        }

        vm.startBroadcast(DEPLOYER_PK);
        FundingFacet(address(invoiceDiamond)).batchApproveFunding(invoiceIds);
        vm.stopBroadcast();

        console.log("  All 20 invoices now have FundingApproved status");
        console.log("");
    }

    // ============ Phase 6: Suppliers Trigger Funding ============

    function _phase6_suppliersFund() internal {
        console.log("PHASE 6: Suppliers trigger funding for their invoices");
        console.log("----------------------------------------------------------");

        uint256[5] memory supplierFunded;

        for (uint256 i = 0; i < allInvoices.length; i++) {
            InvoiceData storage inv = allInvoices[i];
            uint256 s = inv.supplierIndex;

            // Get funding amount
            uint128 fundingAmount = FundingFacet(address(invoiceDiamond)).getFundingAmount(inv.id);
            inv.fundingAmount = fundingAmount;
            totalFundingAmount += fundingAmount;
            supplierFunded[s] += fundingAmount;

            // Step 1: Supplier triggers funding via Diamond (updates status)
            vm.startBroadcast(SUPPLIER_PKS[s]);
            FundingFacet(address(invoiceDiamond)).supplierRequestFunding(inv.id);
            vm.stopBroadcast();

            // Step 2: Execute actual USDC transfer via ExecutionPool
            vm.startBroadcast(SUPPLIER_PKS[s]);
            executionPool.fundInvoice(inv.id, SUPPLIERS[s], fundingAmount, inv.faceValue);
            vm.stopBroadcast();
        }

        // Log per-supplier totals
        for (uint256 s = 0; s < 5; s++) {
            console.log("  Supplier %d received: %d USDC", s + 1, supplierFunded[s] / 1e6);
        }

        console.log("");
        console.log("  Total funding amount:", totalFundingAmount / 1e6, "USDC");
        console.log("  Pool totalDeployed:", liquidityPool.totalDeployed() / 1e6, "USDC");
        console.log("  Pool availableLiquidity:", liquidityPool.availableLiquidity() / 1e6, "USDC");
        console.log("  ExecutionPool activeInvoices:", executionPool.activeInvoices());
        console.log("");
    }

    // ============ Phase 7: Time Warp ============

    function _phase7_timeWarp() internal {
        console.log("PHASE 7: Time warp to longest maturity (60 days + 1)");
        console.log("----------------------------------------------------------");

        uint256 currentTime = block.timestamp;
        uint256 targetTime = currentTime + 60 days + 1;

        vm.warp(targetTime);

        console.log("  Original timestamp:", currentTime);
        console.log("  Warped to timestamp:", block.timestamp);
        console.log("  Time advanced: 60 days + 1 second");
        console.log("  All invoices now at or past maturity");
        console.log("");
    }

    // ============ Phase 8: Buyer Repayments ============

    function _phase8_buyerRepayments() internal {
        console.log("PHASE 8: Buyers repay all 20 invoices");
        console.log("----------------------------------------------------------");

        uint256[5] memory buyerRepaid;

        // Group repayments by buyer for efficiency
        // NOTE: Must go through InvoiceDiamond.processRepayment() to update both
        // the Diamond's invoice status AND the ExecutionPool's funding record
        for (uint256 b = 0; b < 5; b++) {
            vm.startBroadcast(BUYER_PKS[b]);

            for (uint256 i = 0; i < allInvoices.length; i++) {
                if (allInvoices[i].buyerIndex == b) {
                    // Approve the Diamond (not ExecutionPool) - it transfers USDC to ExecutionPool
                    usdc.approve(address(invoiceDiamond), allInvoices[i].faceValue);
                    // Call processRepayment through the Diamond to update invoice status to Paid
                    RepaymentFacet(address(invoiceDiamond)).processRepayment(allInvoices[i].id);
                    buyerRepaid[b] += allInvoices[i].faceValue;
                }
            }

            vm.stopBroadcast();

            console.log("  Buyer %d repaid: %d USDC", b + 1, buyerRepaid[b] / 1e6);
        }

        console.log("");
        console.log("  Total repaid:", totalFaceValue / 1e6, "USDC");
        console.log("  ExecutionPool activeInvoices:", executionPool.activeInvoices());

        // Verify all invoice statuses were updated to Paid in the Diamond
        uint256 paidCount = 0;
        for (uint256 i = 0; i < allInvoices.length; i++) {
            IInvoiceDiamond.InvoiceView memory inv = ViewFacet(address(invoiceDiamond)).getInvoice(allInvoices[i].id);
            if (inv.status == LibInvoiceStorage.InvoiceStatus.Paid && inv.paidAt > 0) {
                paidCount++;
            }
        }
        console.log("  Invoices with Paid status:", paidCount, "/ 20");
        require(paidCount == 20, "All 20 invoices should have Paid status");
        console.log("");
    }

    // ============ Final Summary ============

    function _printFinalSummary() internal view {
        console.log("==========================================================");
        console.log("                    FINAL SUMMARY");
        console.log("==========================================================");
        console.log("");

        uint256 lpShares = liquidityPool.balanceOf(FINANCIER);
        uint256 lpShareValue = liquidityPool.convertToAssets(lpShares);
        uint256 profit = lpShareValue - LP_DEPOSIT;
        uint256 totalYield = liquidityPool.totalInvoiceYield();
        uint256 expectedYield = totalFaceValue - totalFundingAmount;

        console.log("SCALE:");
        console.log("  Suppliers:", uint256(5));
        console.log("  Buyers:", uint256(5));
        console.log("  Total Invoices:", allInvoices.length);
        console.log("");

        console.log("INVOICE TOTALS:");
        console.log("  Total Face Value:", totalFaceValue / 1e6, "USDC");
        console.log("  Total Funding Amount:", totalFundingAmount / 1e6, "USDC");
        console.log("  Expected Yield:", expectedYield / 1e6, "USDC");
        console.log("");

        console.log("LIQUIDITY POOL STATE:");
        console.log("  Total Assets:", liquidityPool.totalAssets() / 1e6, "USDC");
        console.log("  Total Deployed:", liquidityPool.totalDeployed() / 1e6, "USDC");
        console.log("  Available Liquidity:", liquidityPool.availableLiquidity() / 1e6, "USDC");
        console.log("  Total Invoice Yield:", totalYield / 1e6, "USDC");
        console.log("");

        console.log("FINANCIER POSITION:");
        console.log("  SEED Shares:", lpShares);
        console.log("  Share Value:", lpShareValue / 1e6, "USDC");
        console.log("  Initial Deposit:", LP_DEPOSIT / 1e6, "USDC");
        console.log("  Profit:", profit / 1e6, "USDC");
        console.log("");

        console.log("EXECUTION POOL STATE:");
        console.log("  Total Funded:", executionPool.totalFunded() / 1e6, "USDC");
        console.log("  Total Repaid:", executionPool.totalRepaid() / 1e6, "USDC");
        console.log("  Active Invoices:", executionPool.activeInvoices());
        console.log("");

        // Verification
        bool allPassed = true;

        if (executionPool.activeInvoices() != 0) {
            console.log("FAIL: Active invoices should be 0");
            allPassed = false;
        }

        if (liquidityPool.totalDeployed() != 0) {
            console.log("FAIL: Total deployed should be 0");
            allPassed = false;
        }

        if (profit == 0) {
            console.log("FAIL: Financier profit should be > 0");
            allPassed = false;
        }

        if (allPassed) {
            console.log("==========================================================");
            console.log("       EXTENSIVE WORKFLOW TEST COMPLETED SUCCESSFULLY!");
            console.log("==========================================================");
        } else {
            console.log("==========================================================");
            console.log("       WORKFLOW TEST COMPLETED WITH FAILURES");
            console.log("==========================================================");
        }
        console.log("");
    }
}
