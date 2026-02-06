// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "src/base/LiquidityPool.sol";
import "src/base/TreasuryManager.sol";
import "src/strategies/USYCStrategy.sol";

/**
 * @title DeployTreasury
 * @notice Deployment script for TreasuryManager + USYCStrategy on Arc Testnet
 *
 * Deploys and links the treasury layer to the existing LiquidityPool:
 * 1. TreasuryManager - Manages idle capital across yield strategies
 * 2. USYCStrategy - Hashnote USYC T-Bill yield strategy
 * 3. Links TreasuryManager to LiquidityPool (setTreasuryManager)
 * 4. Registers USYCStrategy in TreasuryManager (addStrategy)
 *
 * Prerequisites:
 * - LiquidityPool must already be deployed (from DeployArcTestnet)
 * - Deployer must have DEFAULT_ADMIN_ROLE on LiquidityPool
 *
 * Usage:
 *   # Dry run (simulation):
 *   forge script script/DeployTreasury.s.sol:DeployTreasury \
 *     --rpc-url https://rpc.testnet.arc.network \
 *     --account arc-deployer
 *
 *   # Live deployment:
 *   forge script script/DeployTreasury.s.sol:DeployTreasury \
 *     --rpc-url https://rpc.testnet.arc.network \
 *     --account arc-deployer \
 *     --broadcast \
 *     --verify --etherscan-api-key $ARCSCAN_API_KEY
 */
contract DeployTreasury is Script {
    // Arc Testnet USDC (system contract, 6 decimals via ERC-20)
    address constant ARC_USDC = 0x3600000000000000000000000000000000000000;

    // Arc Testnet USYC (Hashnote yield-bearing T-Bill token)
    address constant ARC_USYC = 0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C;

    // Arc Testnet chain ID
    uint256 constant ARC_TESTNET_CHAIN_ID = 5042002;

    // Existing deployed LiquidityPool on Arc Testnet
    address payable constant LIQUIDITY_POOL = payable(0xB67db96eEbf1D30D95a382535afBB2375ECf0219);

    // USYCStrategy weight (10000 = 100% of treasury allocation)
    uint256 constant USYC_WEIGHT = 10000;

    // Deployed contracts
    TreasuryManager public treasuryManager;
    USYCStrategy public usycStrategy;

    function run() public {
        // Verify we're on Arc Testnet
        require(
            block.chainid == ARC_TESTNET_CHAIN_ID,
            "This script is for Arc Testnet (chain ID 5042002) only"
        );

        vm.startBroadcast();

        console.log("=== Seed Finance Treasury Deployment (Arc Testnet) ===");
        console.log("Chain ID:", block.chainid);
        console.log("USDC:", ARC_USDC);
        console.log("USYC:", ARC_USYC);
        console.log("LiquidityPool:", LIQUIDITY_POOL);
        console.log("");

        // ===== Step 1: Deploy TreasuryManager =====
        console.log("Step 1: Deploying TreasuryManager...");
        treasuryManager = new TreasuryManager(ARC_USDC, LIQUIDITY_POOL);
        console.log("  TreasuryManager deployed at:", address(treasuryManager));

        // ===== Step 2: Deploy USYCStrategy =====
        console.log("Step 2: Deploying USYCStrategy...");
        usycStrategy = new USYCStrategy(ARC_USDC, ARC_USYC, address(treasuryManager));
        console.log("  USYCStrategy deployed at:", address(usycStrategy));

        // ===== Step 3: Link TreasuryManager to LiquidityPool =====
        console.log("Step 3: Linking TreasuryManager to LiquidityPool...");
        LiquidityPool(LIQUIDITY_POOL).setTreasuryManager(address(treasuryManager));
        console.log("  LiquidityPool.setTreasuryManager() called");

        // ===== Step 4: Register USYCStrategy in TreasuryManager =====
        console.log("Step 4: Registering USYCStrategy...");
        treasuryManager.addStrategy(address(usycStrategy), USYC_WEIGHT);
        console.log("  USYCStrategy registered with weight:", USYC_WEIGHT);

        vm.stopBroadcast();

        // ===== Summary =====
        console.log("");
        console.log("=== Treasury Deployment Complete ===");
        console.log("");
        console.log("Contract Addresses:");
        console.log("  NEXT_PUBLIC_TREASURY_MANAGER_ADDRESS=", address(treasuryManager));
        console.log("  USYCStrategy:                        ", address(usycStrategy));
        console.log("");
        console.log("Configuration:");
        console.log("  Strategy weight: ", USYC_WEIGHT, " (100% to USYC)");
        console.log("  Estimated APY:    ~4.5% (T-Bill rate)");
        console.log("");
        console.log("Next steps:");
        console.log("  1. Update frontend/.env.local with NEXT_PUBLIC_TREASURY_MANAGER_ADDRESS");
        console.log("  2. Update backend/.env if applicable");
        console.log("  3. Redeploy frontend to pick up the new address");
        console.log("  4. Verify on https://testnet.arcscan.app");
    }
}
