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

// Mock
import "test/mocks/MockUSDC.sol";

/**
 * @title DeployLocal
 * @notice Deployment script for local Anvil testing
 *
 * Deploys the complete Seed Finance stack:
 * 1. MockUSDC - Test token with minting capability
 * 2. LiquidityPool - ERC-4626 vault for LP deposits
 * 3. All Facets - InvoiceFacet, FundingFacet, RepaymentFacet, ViewFacet, AdminFacet
 * 4. InvoiceDiamond - Diamond proxy with all facets
 * 5. ExecutionPool - Funding execution and repayment handling
 *
 * Post-deployment configuration:
 * - Initialize InvoiceDiamond via AdminFacet
 * - Link ExecutionPool <-> LiquidityPool <-> InvoiceDiamond
 * - Grant ROUTER_ROLE to ExecutionPool
 * - Set deployer as operator
 * - Mint 1M USDC to test accounts
 *
 * Usage:
 *   # Start Anvil first:
 *   anvil --host 0.0.0.0 --accounts 10 --balance 10000
 *
 *   # Deploy contracts:
 *   forge script script/DeployLocal.s.sol:DeployLocal \
 *     --rpc-url http://localhost:8545 \
 *     --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
 *     --broadcast
 *
 * Anvil Default Accounts (for testing):
 *   Account 0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (Deployer/Admin)
 *   Account 1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (Financier/LP)
 *   Account 2: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC (Supplier)
 *   Account 3: 0x90F79bf6EB2c4f870365E785982E1f101E93b906 (Buyer)
 */
contract DeployLocal is Script {
    // Anvil default accounts (deterministic from mnemonic)
    address constant DEPLOYER = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address constant FINANCIER = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address constant SUPPLIER = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
    address constant BUYER = 0x90F79bf6EB2c4f870365E785982E1f101E93b906;

    // Test amounts (USDC has 6 decimals)
    uint256 constant MINT_AMOUNT = 1_000_000 * 1e6; // 1M USDC each
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

    function run() public virtual {
        // Verify we're on a local chain (Anvil chain ID is 31337)
        require(block.chainid == 31337, "This script is for Anvil local testing only");

        vm.startBroadcast();

        console.log("=== Seed Finance Local Deployment ===");
        console.log("Deployer:", msg.sender);
        console.log("");

        // ===== Step 1: Deploy MockUSDC =====
        console.log("Step 1: Deploying MockUSDC...");
        usdc = new MockUSDC();
        console.log("  MockUSDC deployed at:", address(usdc));

        // ===== Step 2: Deploy LiquidityPool =====
        console.log("Step 2: Deploying LiquidityPool...");
        liquidityPool = new LiquidityPool(
            IERC20(address(usdc)),
            "Seed Finance LP Token",
            "SEED"
        );
        console.log("  LiquidityPool deployed at:", address(liquidityPool));

        // Configure LiquidityPool with lower buffer for testing
        liquidityPool.setLiquidityBuffer(MIN_LIQUIDITY_BUFFER);
        console.log("  LiquidityPool buffer set to:", MIN_LIQUIDITY_BUFFER / 1e6, "USDC");

        // ===== Step 3: Deploy Facets =====
        console.log("Step 3: Deploying Facets...");

        invoiceFacet = new InvoiceFacet();
        console.log("  InvoiceFacet deployed at:", address(invoiceFacet));

        fundingFacet = new FundingFacet();
        console.log("  FundingFacet deployed at:", address(fundingFacet));

        repaymentFacet = new RepaymentFacet();
        console.log("  RepaymentFacet deployed at:", address(repaymentFacet));

        viewFacet = new ViewFacet();
        console.log("  ViewFacet deployed at:", address(viewFacet));

        adminFacet = new AdminFacet();
        console.log("  AdminFacet deployed at:", address(adminFacet));

        // ===== Step 4: Deploy InvoiceDiamond =====
        console.log("Step 4: Deploying InvoiceDiamond...");

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

        // Deploy diamond with facets (no init function, we'll call initialize separately)
        invoiceDiamond = new InvoiceDiamond(cuts, address(0), "");
        console.log("  InvoiceDiamond deployed at:", address(invoiceDiamond));

        // Initialize the diamond
        AdminFacet(address(invoiceDiamond)).initialize(msg.sender, address(usdc));
        console.log("  InvoiceDiamond initialized with owner:", msg.sender);

        // ===== Step 5: Deploy ExecutionPool =====
        console.log("Step 5: Deploying ExecutionPool...");
        executionPool = new ExecutionPool(address(usdc));
        console.log("  ExecutionPool deployed at:", address(executionPool));

        // ===== Step 6: Configure Access Control and Links =====
        console.log("Step 6: Configuring access control and contract links...");

        // Link ExecutionPool to LiquidityPool and InvoiceDiamond
        executionPool.setLiquidityPool(address(liquidityPool));
        executionPool.setInvoiceDiamond(address(invoiceDiamond));
        console.log("  ExecutionPool linked to LiquidityPool and InvoiceDiamond");

        // Grant ROUTER_ROLE to ExecutionPool in LiquidityPool
        liquidityPool.grantRole(liquidityPool.ROUTER_ROLE(), address(executionPool));
        console.log("  Granted ROUTER_ROLE to ExecutionPool in LiquidityPool");

        // Link InvoiceDiamond to ExecutionPool and LiquidityPool via AdminFacet
        AdminFacet(address(invoiceDiamond)).setExecutionPool(address(executionPool));
        AdminFacet(address(invoiceDiamond)).setLiquidityPool(address(liquidityPool));
        console.log("  InvoiceDiamond linked to ExecutionPool and LiquidityPool");

        // Set deployer as operator in InvoiceDiamond
        AdminFacet(address(invoiceDiamond)).setOperator(msg.sender, true);
        console.log("  Deployer set as operator in InvoiceDiamond");

        // ===== Step 7: Mint Test USDC =====
        console.log("Step 7: Minting test USDC...");

        usdc.mint(FINANCIER, MINT_AMOUNT);
        console.log("  Minted", MINT_AMOUNT / 1e6, "USDC to Financier:", FINANCIER);

        usdc.mint(SUPPLIER, MINT_AMOUNT);
        console.log("  Minted", MINT_AMOUNT / 1e6, "USDC to Supplier:", SUPPLIER);

        usdc.mint(BUYER, MINT_AMOUNT);
        console.log("  Minted", MINT_AMOUNT / 1e6, "USDC to Buyer:", BUYER);

        // Also mint some to deployer for testing
        usdc.mint(msg.sender, MINT_AMOUNT);
        console.log("  Minted", MINT_AMOUNT / 1e6, "USDC to Deployer:", msg.sender);

        vm.stopBroadcast();

        // ===== Summary =====
        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("");
        console.log("Contract Addresses (copy to frontend/.env.local):");
        console.log("  NEXT_PUBLIC_USDC_ADDRESS=", address(usdc));
        console.log("  NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS=", address(liquidityPool));
        console.log("  NEXT_PUBLIC_INVOICE_DIAMOND_ADDRESS=", address(invoiceDiamond));
        console.log("  NEXT_PUBLIC_EXECUTION_POOL_ADDRESS=", address(executionPool));
        console.log("");
        console.log("Test Accounts:");
        console.log("  Deployer/Admin (Account 0):", DEPLOYER);
        console.log("  Financier/LP (Account 1):  ", FINANCIER);
        console.log("  Supplier (Account 2):      ", SUPPLIER);
        console.log("  Buyer (Account 3):         ", BUYER);
        console.log("");
        console.log("Each test account has", MINT_AMOUNT / 1e6, "USDC");
        console.log("");
        console.log("Facet Addresses:");
        console.log("  InvoiceFacet:   ", address(invoiceFacet));
        console.log("  FundingFacet:   ", address(fundingFacet));
        console.log("  RepaymentFacet: ", address(repaymentFacet));
        console.log("  ViewFacet:      ", address(viewFacet));
        console.log("  AdminFacet:     ", address(adminFacet));
    }
}

/**
 * @title DeployLocalWithSampleInvoice
 * @notice Extended deployment that also creates a sample invoice for testing
 *
 * Usage:
 *   forge script script/DeployLocal.s.sol:DeployLocalWithSampleInvoice \
 *     --rpc-url http://localhost:8545 \
 *     --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
 *     --broadcast
 */
contract DeployLocalWithSampleInvoice is DeployLocal {
    function run() public override {
        // First run the base deployment
        super.run();

        console.log("");
        console.log("=== Creating Sample Invoice ===");

        // Use Supplier's private key to create invoice
        // Account 2 private key: 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
        uint256 supplierPrivateKey = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;

        vm.startBroadcast(supplierPrivateKey);

        // Create a sample invoice: 10,000 USDC, 5% APR discount, 30 days maturity
        uint128 faceValue = 10_000 * 1e6; // 10,000 USDC
        uint16 discountRateBps = 500; // 5% APR
        uint64 maturityDate = uint64(block.timestamp + 30 days);
        bytes32 invoiceHash = keccak256("sample-invoice-001");
        bytes32 externalId = bytes32("INV-2024-001");

        uint256 invoiceId = InvoiceFacet(address(invoiceDiamond)).createInvoice(
            BUYER,
            faceValue,
            discountRateBps,
            maturityDate,
            invoiceHash,
            externalId
        );

        console.log("  Created sample invoice #", invoiceId);
        console.log("  Face Value:", faceValue / 1e6, "USDC");
        console.log("  Discount Rate:", discountRateBps, "bps (5% APR)");
        console.log("  Maturity: 30 days from now");
        console.log("  Buyer:", BUYER);
        console.log("  Supplier:", SUPPLIER);

        vm.stopBroadcast();

        console.log("");
        console.log("Sample invoice created! Buyer can now approve it.");
    }
}
