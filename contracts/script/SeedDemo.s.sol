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
 * @title SeedDemo
 * @notice Seeds demo data after DeployLocal.s.sol has deployed contracts
 *
 * Creates a realistic demo scenario with:
 * - 3 Suppliers (Accounts 2, 3, 4)
 * - 2 Buyers (Accounts 7, 8)
 * - 1 Financier (Account 1) deposits 500k USDC
 * - 10 invoices with mixed lifecycle states:
 *   - 2 Paid (full cycle — generates yield, populates history)
 *   - 3 Funded (active — shows pool utilization, upcoming repayments)
 *   - 2 FundingApproved (ready for supplier to trigger)
 *   - 2 Approved (awaiting operator)
 *   - 1 Pending (awaiting buyer)
 *
 * Uses deterministic contract addresses from DeployLocal.s.sol.
 *
 * Usage:
 *   # After running DeployLocal.s.sol:
 *   forge script script/SeedDemo.s.sol:SeedDemo \
 *     --rpc-url http://localhost:8545 \
 *     --broadcast
 */
contract SeedDemo is Script {
    // ============ Anvil Accounts ============

    // Deployer/Operator (Account 0)
    uint256 constant DEPLOYER_PK = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    address constant DEPLOYER = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;

    // Financier (Account 1)
    uint256 constant FINANCIER_PK = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    address constant FINANCIER = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;

    // Suppliers (Accounts 2, 3, 4)
    address[3] internal SUPPLIERS = [
        0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC, // Account 2
        0x90F79bf6EB2c4f870365E785982E1f101E93b906, // Account 3
        0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65  // Account 4
    ];

    uint256[3] internal SUPPLIER_PKS = [
        0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a,
        0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6,
        0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a
    ];

    // Buyers (Accounts 7, 8)
    address[2] internal BUYERS = [
        0x14dC79964da2C08b23698B3D3cc7Ca32193d9955, // Account 7
        0xa0Ee7A142d267C1f36714E4a8F75612F20a79720  // Account 9
    ];

    uint256[2] internal BUYER_PKS = [
        0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356,
        0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6
    ];

    // ============ Test Parameters ============

    uint256 constant MINT_AMOUNT = 1_000_000 * 1e6; // 1M USDC each
    uint256 constant LP_DEPOSIT = 500_000 * 1e6;     // 500k USDC

    // ============ Deterministic Contract Addresses ============
    // Deterministic from DeployLocal.s.sol deploying from Account 0 on Anvil.
    // These never change because Anvil always starts at nonce 0 with the same mnemonic.

    address constant USDC_ADDR = 0x5FbDB2315678afecb367f032d93F642f64180aa3;
    address constant LP_ADDR = 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512;
    address constant DIAMOND_ADDR = 0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6;
    address constant EP_ADDR = 0x610178dA211FEF7D417bC0e6FeD39F05609AD788;

    MockUSDC public usdc;
    LiquidityPool public liquidityPool;
    InvoiceDiamond public invoiceDiamond;
    ExecutionPool public executionPool;

    // ============ Invoice Tracking ============

    struct InvoiceSpec {
        uint256 supplierIdx;    // Index into SUPPLIERS array
        uint256 buyerIdx;       // Index into BUYERS array
        uint128 faceValue;
        uint16 discountRateBps;
        uint64 maturityDays;
        string targetStatus;    // "Pending", "Approved", "FundingApproved", "Funded", "Paid"
    }

    // Track created invoice IDs
    uint256[] public invoiceIds;

    // ============ Main Entry ============

    function run() public {
        require(block.chainid == 31337, "This script is for Anvil local testing only");

        console.log("");
        console.log("==========================================================");
        console.log("    SEED FINANCE - DEMO DATA SEEDER");
        console.log("==========================================================");
        console.log("");

        // Resolve deterministic contract addresses from chain
        _resolveContracts();

        // Phase 1: Mint USDC to additional accounts (DeployLocal only mints to 0-3)
        _phase1_mintUsdc();

        // Phase 2: Financier deposits into LiquidityPool
        _phase2_financierDeposit();

        // Phase 3: Create and progress invoices to target states
        _phase3_seedInvoices();

        _printSummary();
    }

    // ============ Contract Resolution ============

    function _resolveContracts() internal {
        usdc = MockUSDC(USDC_ADDR);
        liquidityPool = LiquidityPool(payable(LP_ADDR));
        invoiceDiamond = InvoiceDiamond(payable(DIAMOND_ADDR));
        executionPool = ExecutionPool(EP_ADDR);

        // Verify contracts exist by checking a known function
        require(usdc.decimals() == 6, "MockUSDC not found at expected address");

        console.log("Resolved contract addresses:");
        console.log("  MockUSDC:        ", address(usdc));
        console.log("  LiquidityPool:   ", address(liquidityPool));
        console.log("  InvoiceDiamond:  ", address(invoiceDiamond));
        console.log("  ExecutionPool:   ", address(executionPool));
        console.log("");
    }

    // ============ Phase 1: Mint USDC ============

    function _phase1_mintUsdc() internal {
        console.log("PHASE 1: Minting USDC to demo accounts");
        console.log("----------------------------------------------------------");

        vm.startBroadcast(DEPLOYER_PK);

        // Accounts 4-11 need USDC (DeployLocal mints to accounts 0-3)
        // We specifically need accounts 4 (supplier 3) and 7, 9 (buyers)
        for (uint256 i = 0; i < 3; i++) {
            usdc.mint(SUPPLIERS[i], MINT_AMOUNT);
        }
        for (uint256 i = 0; i < 2; i++) {
            usdc.mint(BUYERS[i], MINT_AMOUNT);
        }

        vm.stopBroadcast();

        console.log("  Minted 1M USDC to 3 suppliers and 2 buyers");
        console.log("");
    }

    // ============ Phase 2: Financier Deposit ============

    function _phase2_financierDeposit() internal {
        console.log("PHASE 2: Financier deposits 500,000 USDC");
        console.log("----------------------------------------------------------");

        vm.startBroadcast(FINANCIER_PK);

        usdc.approve(address(liquidityPool), LP_DEPOSIT);
        uint256 shares = liquidityPool.deposit(LP_DEPOSIT, FINANCIER);

        vm.stopBroadcast();

        console.log("  SEED shares received:", shares);
        console.log("  Pool totalAssets:", liquidityPool.totalAssets() / 1e6, "USDC");
        console.log("");
    }

    // ============ Phase 3: Seed Invoices ============

    function _phase3_seedInvoices() internal {
        console.log("PHASE 3: Creating and progressing 10 invoices");
        console.log("----------------------------------------------------------");

        // Define 10 invoices with target states
        // Format: supplierIdx, buyerIdx, faceValue, discountBps, maturityDays, targetStatus

        // --- 2 Paid invoices (full lifecycle) ---
        _createAndProgress(0, 0, 15_000 * 1e6, 500, 30, "Paid");   // Invoice 1
        _createAndProgress(1, 1, 20_000 * 1e6, 400, 45, "Paid");   // Invoice 2

        // --- 3 Funded invoices (active) ---
        _createAndProgress(0, 1, 10_000 * 1e6, 350, 60, "Funded"); // Invoice 3
        _createAndProgress(2, 0, 25_000 * 1e6, 600, 30, "Funded"); // Invoice 4
        _createAndProgress(1, 0, 8_000 * 1e6, 450, 45, "Funded");  // Invoice 5

        // --- 2 FundingApproved invoices ---
        _createAndProgress(2, 1, 12_000 * 1e6, 500, 30, "FundingApproved"); // Invoice 6
        _createAndProgress(0, 0, 18_000 * 1e6, 300, 15, "FundingApproved"); // Invoice 7

        // --- 2 Approved invoices ---
        _createAndProgress(1, 1, 7_000 * 1e6, 700, 20, "Approved"); // Invoice 8
        _createAndProgress(2, 0, 5_000 * 1e6, 550, 40, "Approved"); // Invoice 9

        // --- 1 Pending invoice ---
        _createAndProgress(0, 1, 22_000 * 1e6, 350, 50, "Pending"); // Invoice 10

        console.log("");
        console.log("  Total invoices created: 10");
        console.log("");
    }

    // ============ Invoice Lifecycle Helper ============

    function _createAndProgress(
        uint256 supplierIdx,
        uint256 buyerIdx,
        uint128 faceValue,
        uint16 discountRateBps,
        uint64 maturityDays,
        string memory targetStatus
    ) internal {
        uint64 maturityDate = uint64(block.timestamp + maturityDays * 1 days);
        uint256 invoiceNum = invoiceIds.length + 1;

        // Step 1: Supplier creates invoice
        vm.startBroadcast(SUPPLIER_PKS[supplierIdx]);
        uint256 invoiceId = InvoiceFacet(address(invoiceDiamond)).createInvoice(
            BUYERS[buyerIdx],
            faceValue,
            discountRateBps,
            maturityDate,
            keccak256(abi.encodePacked("demo-invoice-", invoiceNum)),
            bytes32(abi.encodePacked("DEMO-", invoiceNum))
        );
        vm.stopBroadcast();

        invoiceIds.push(invoiceId);
        console.log("  Invoice #%d created (target: %s, face: %d USDC)", invoiceNum, targetStatus, faceValue / 1e6);

        // Stop here for Pending
        if (_strEq(targetStatus, "Pending")) return;

        // Step 2: Buyer approves
        vm.startBroadcast(BUYER_PKS[buyerIdx]);
        InvoiceFacet(address(invoiceDiamond)).approveInvoice(invoiceId);
        vm.stopBroadcast();

        // Stop here for Approved
        if (_strEq(targetStatus, "Approved")) return;

        // Step 3: Operator approves funding
        vm.startBroadcast(DEPLOYER_PK);
        FundingFacet(address(invoiceDiamond)).approveFunding(invoiceId);
        vm.stopBroadcast();

        // Stop here for FundingApproved
        if (_strEq(targetStatus, "FundingApproved")) return;

        // Step 4: Supplier requests funding (updates Diamond status to Funded)
        vm.startBroadcast(SUPPLIER_PKS[supplierIdx]);
        FundingFacet(address(invoiceDiamond)).supplierRequestFunding(invoiceId);
        vm.stopBroadcast();

        // Step 5: Execute actual USDC transfer via ExecutionPool
        uint128 fundingAmount = FundingFacet(address(invoiceDiamond)).getFundingAmount(invoiceId);
        vm.startBroadcast(SUPPLIER_PKS[supplierIdx]);
        executionPool.fundInvoice(invoiceId, SUPPLIERS[supplierIdx], fundingAmount, faceValue);
        vm.stopBroadcast();

        // Stop here for Funded
        if (_strEq(targetStatus, "Funded")) return;

        // Step 6: Buyer repays (no maturity check in processRepayment)
        vm.startBroadcast(BUYER_PKS[buyerIdx]);
        usdc.approve(address(invoiceDiamond), faceValue);
        RepaymentFacet(address(invoiceDiamond)).processRepayment(invoiceId);
        vm.stopBroadcast();

        // Paid status reached
    }

    // ============ Summary ============

    function _printSummary() internal view {
        console.log("==========================================================");
        console.log("                    DEMO DATA SUMMARY");
        console.log("==========================================================");
        console.log("");
        console.log("Pool State:");
        console.log("  Total Assets:", liquidityPool.totalAssets() / 1e6, "USDC");
        console.log("  Total Deployed:", liquidityPool.totalDeployed() / 1e6, "USDC");
        console.log("  Available Liquidity:", liquidityPool.availableLiquidity() / 1e6, "USDC");
        console.log("  Total Invoice Yield:", liquidityPool.totalInvoiceYield() / 1e6, "USDC");
        console.log("");
        console.log("Execution Pool:");
        console.log("  Active Invoices:", executionPool.activeInvoices());
        console.log("  Total Funded:", executionPool.totalFunded() / 1e6, "USDC");
        console.log("  Total Repaid:", executionPool.totalRepaid() / 1e6, "USDC");
        console.log("");
        console.log("Financier Position:");
        uint256 shares = liquidityPool.balanceOf(FINANCIER);
        uint256 shareValue = liquidityPool.convertToAssets(shares);
        console.log("  SEED Shares:", shares);
        console.log("  Share Value:", shareValue / 1e6, "USDC");
        console.log("  Profit:", (shareValue - LP_DEPOSIT) / 1e6, "USDC");
        console.log("");
        console.log("Invoice Status Distribution:");
        console.log("  Paid: 2, Funded: 3, FundingApproved: 2, Approved: 2, Pending: 1");
        console.log("");
        console.log("==========================================================");
        console.log("       DEMO DATA SEEDING COMPLETE!");
        console.log("==========================================================");
    }

    // ============ Utility ============

    function _strEq(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}
