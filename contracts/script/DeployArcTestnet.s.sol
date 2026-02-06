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

// Storage library (for DiamondInit)
import "src/invoice/libraries/LibInvoiceStorage.sol";

/**
 * @title DiamondInit
 * @notice Initialization contract for the InvoiceDiamond
 * @dev Uses msg.sender from the delegatecall context (the actual deployer EOA)
 *      instead of a parameter, avoiding Foundry's msg.sender mismatch between
 *      script-level code and EVM-level execution.
 */
contract DiamondInit {
    function init(address _usdc) external {
        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();

        require(s.owner == address(0), "Already initialized");
        require(_usdc != address(0), "Invalid USDC");

        // msg.sender here is the actual deployer (from delegatecall in constructor)
        s.owner = msg.sender;
        s.usdc = _usdc;
        s.nextInvoiceId = 1;
    }
}

/**
 * @title DeployArcTestnet
 * @notice Deployment script for Arc Testnet (chain ID 5042002)
 *
 * Deploys the complete Seed Finance stack using Arc's native USDC:
 * 1. LiquidityPool - ERC-4626 vault for LP deposits
 * 2. All Facets - InvoiceFacet, FundingFacet, RepaymentFacet, ViewFacet, AdminFacet
 * 3. InvoiceDiamond - Diamond proxy with all facets
 * 4. ExecutionPool - Funding execution and repayment handling
 *
 * Key differences from DeployLocal:
 * - Uses Arc system USDC at 0x3600000000000000000000000000000000000000
 * - No mock minting (use Circle faucet: https://faucet.circle.com)
 * - Liquidity buffer set to 0 for small-amount testing
 * - Uses DiamondInit helper to correctly set owner from EVM context
 *
 * Usage:
 *   # Dry run (simulation):
 *   forge script script/DeployArcTestnet.s.sol:DeployArcTestnet \
 *     --rpc-url https://rpc.testnet.arc.network \
 *     --account arc-deployer
 *
 *   # Live deployment:
 *   forge script script/DeployArcTestnet.s.sol:DeployArcTestnet \
 *     --rpc-url https://rpc.testnet.arc.network \
 *     --account arc-deployer \
 *     --broadcast \
 *     --verify --etherscan-api-key $ARCSCAN_API_KEY
 */
contract DeployArcTestnet is Script {
    // Arc Testnet USDC (system contract, 6 decimals via ERC-20)
    address constant ARC_USDC = 0x3600000000000000000000000000000000000000;

    // Arc Testnet chain ID
    uint256 constant ARC_TESTNET_CHAIN_ID = 5042002;

    // Deployed contracts
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
        // Verify we're on Arc Testnet
        require(
            block.chainid == ARC_TESTNET_CHAIN_ID,
            "This script is for Arc Testnet (chain ID 5042002) only"
        );

        vm.startBroadcast();

        console.log("=== Seed Finance Arc Testnet Deployment ===");
        console.log("Chain ID:", block.chainid);
        console.log("USDC:", ARC_USDC);
        console.log("");

        // ===== Step 1: Deploy LiquidityPool =====
        console.log("Step 1: Deploying LiquidityPool...");
        liquidityPool = new LiquidityPool(
            IERC20(ARC_USDC),
            "Seed Finance LP Token",
            "SEED"
        );
        console.log("  LiquidityPool deployed at:", address(liquidityPool));
        console.log("  LiquidityPool buffer: 0 (testnet mode)");

        // ===== Step 2: Deploy Facets =====
        console.log("Step 2: Deploying Facets...");

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

        // ===== Step 3: Deploy InvoiceDiamond =====
        console.log("Step 3: Deploying InvoiceDiamond...");

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

        // Deploy DiamondInit helper — uses msg.sender from EVM delegatecall context
        // (the real EOA), not Foundry's script-level msg.sender (DefaultSender)
        DiamondInit diamondInit = new DiamondInit();

        // Deploy diamond with facets + atomic initialization
        invoiceDiamond = new InvoiceDiamond(
            cuts,
            address(diamondInit),
            abi.encodeWithSelector(DiamondInit.init.selector, ARC_USDC)
        );
        console.log("  InvoiceDiamond deployed at:", address(invoiceDiamond));

        // Log the actual owner set by DiamondInit (the real EOA)
        address diamondOwner = ViewFacet(address(invoiceDiamond)).owner();
        console.log("  InvoiceDiamond owner:", diamondOwner);

        // ===== Step 4: Deploy ExecutionPool =====
        console.log("Step 4: Deploying ExecutionPool...");
        executionPool = new ExecutionPool(ARC_USDC);
        console.log("  ExecutionPool deployed at:", address(executionPool));

        // ===== Step 5: Configure Access Control and Links =====
        console.log("Step 5: Configuring access control and contract links...");

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
        AdminFacet(address(invoiceDiamond)).setOperator(diamondOwner, true);
        console.log("  Deployer set as operator in InvoiceDiamond");

        vm.stopBroadcast();

        // ===== Summary =====
        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("");
        console.log("Contract Addresses (copy to frontend/.env.local and backend/.env):");
        console.log("  NEXT_PUBLIC_USDC_ADDRESS=", ARC_USDC);
        console.log("  NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS=", address(liquidityPool));
        console.log("  NEXT_PUBLIC_INVOICE_DIAMOND_ADDRESS=", address(invoiceDiamond));
        console.log("  NEXT_PUBLIC_EXECUTION_POOL_ADDRESS=", address(executionPool));
        console.log("");
        console.log("Facet Addresses:");
        console.log("  InvoiceFacet:   ", address(invoiceFacet));
        console.log("  FundingFacet:   ", address(fundingFacet));
        console.log("  RepaymentFacet: ", address(repaymentFacet));
        console.log("  ViewFacet:      ", address(viewFacet));
        console.log("  AdminFacet:     ", address(adminFacet));
        console.log("");
        console.log("Next steps:");
        console.log("  1. Get testnet USDC from https://faucet.circle.com");
        console.log("  2. Update frontend/.env.local with contract addresses above");
        console.log("  3. Update backend/.env with contract addresses above");
        console.log("  4. Test with a small deposit (e.g., 0.01 USDC = 10000 units)");
    }
}
