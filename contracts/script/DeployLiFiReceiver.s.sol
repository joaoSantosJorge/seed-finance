// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "src/integrations/LiFiReceiver.sol";

/**
 * @title DeployLiFiReceiver
 * @notice Deployment script for LiFiReceiver contract
 *
 * Usage:
 *   # Dry run on Arc Testnet
 *   forge script script/DeployLiFiReceiver.s.sol:DeployLiFiReceiver \
 *     --rpc-url $ARC_TESTNET_RPC_URL \
 *     --private-key $PRIVATE_KEY
 *
 *   # Deploy and verify on Arc Testnet
 *   forge script script/DeployLiFiReceiver.s.sol:DeployLiFiReceiver \
 *     --rpc-url $ARC_TESTNET_RPC_URL \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     --verify \
 *     --etherscan-api-key $ARCSCAN_API_KEY
 *
 * Environment Variables:
 *   - USDC_ADDRESS: USDC token address
 *   - LIQUIDITY_POOL_ADDRESS: LiquidityPool contract address
 *   - MIN_DEPOSIT_AMOUNT: Minimum deposit in USDC (with 6 decimals)
 *   - LIFI_EXECUTOR: (Optional) LI.FI executor address to authorize
 */
contract DeployLiFiReceiver is Script {
    // Arc Testnet USDC (system contract)
    address constant ARC_TESTNET_USDC = 0x3600000000000000000000000000000000000000;

    // Arc Mainnet USDC (same system contract, mainnet TBD)
    address constant ARC_MAINNET_USDC = 0x3600000000000000000000000000000000000000;

    // Default minimum deposit: 10 USDC
    uint256 constant DEFAULT_MIN_DEPOSIT = 10e6;

    // Known LI.FI executor addresses (these may need updating)
    // See: https://docs.li.fi/integrate-li.fi-sdk/technical-reference/addresses
    address constant LIFI_DIAMOND_BASE = 0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE;

    function run() external {
        // Get configuration from environment
        address usdc = vm.envOr("USDC_ADDRESS", _getDefaultUsdc());
        address liquidityPool = vm.envAddress("LIQUIDITY_POOL_ADDRESS");
        uint256 minDeposit = vm.envOr("MIN_DEPOSIT_AMOUNT", DEFAULT_MIN_DEPOSIT);
        address lifiExecutor = vm.envOr("LIFI_EXECUTOR", LIFI_DIAMOND_BASE);

        console.log("Deploying LiFiReceiver with:");
        console.log("  USDC:", usdc);
        console.log("  LiquidityPool:", liquidityPool);
        console.log("  Min Deposit:", minDeposit);
        console.log("  LI.FI Executor:", lifiExecutor);

        vm.startBroadcast();

        // Deploy LiFiReceiver
        LiFiReceiver receiver = new LiFiReceiver(
            usdc,
            liquidityPool,
            minDeposit
        );

        console.log("LiFiReceiver deployed at:", address(receiver));

        // Authorize LI.FI executor if provided
        if (lifiExecutor != address(0)) {
            receiver.setExecutor(lifiExecutor, true);
            console.log("Authorized LI.FI executor:", lifiExecutor);
        }

        vm.stopBroadcast();

        // Log verification command
        console.log("\nVerification command:");
        console.log(
            string.concat(
                "forge verify-contract ",
                vm.toString(address(receiver)),
                " src/integrations/LiFiReceiver.sol:LiFiReceiver ",
                "--constructor-args $(cast abi-encode 'constructor(address,address,uint256)' ",
                vm.toString(usdc),
                " ",
                vm.toString(liquidityPool),
                " ",
                vm.toString(minDeposit),
                ")"
            )
        );
    }

    function _getDefaultUsdc() internal view returns (address) {
        // Auto-detect network based on chain ID
        if (block.chainid == 5042002) {
            // Arc Testnet
            return ARC_TESTNET_USDC;
        } else if (block.chainid == 1243) {
            // Arc Mainnet (placeholder)
            return ARC_MAINNET_USDC;
        } else {
            revert("Unknown chain ID - please set USDC_ADDRESS");
        }
    }
}

/**
 * @title DeployLiFiReceiverTestnet
 * @notice Simplified deployment for testnet with mock executor
 *
 * Usage:
 *   forge script script/DeployLiFiReceiver.s.sol:DeployLiFiReceiverTestnet \
 *     --rpc-url $ARC_TESTNET_RPC_URL \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast
 */
contract DeployLiFiReceiverTestnet is Script {
    function run() external {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address liquidityPool = vm.envAddress("LIQUIDITY_POOL_ADDRESS");

        console.log("Deploying LiFiReceiver (testnet) with:");
        console.log("  USDC:", usdc);
        console.log("  LiquidityPool:", liquidityPool);

        vm.startBroadcast();

        // Deploy with low minimum for testing
        LiFiReceiver receiver = new LiFiReceiver(
            usdc,
            liquidityPool,
            1e6 // 1 USDC minimum for testing
        );

        console.log("LiFiReceiver deployed at:", address(receiver));

        // On testnet, authorize deployer as executor for testing
        receiver.setExecutor(msg.sender, true);
        console.log("Authorized deployer as executor for testing");

        vm.stopBroadcast();
    }
}
