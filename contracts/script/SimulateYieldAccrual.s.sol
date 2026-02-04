// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";

// ============ Interfaces ============

interface ISimLiquidityPool {
    function totalAssets() external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function totalDeployed() external view returns (uint256);
    function totalInvoiceYield() external view returns (uint256);
    function availableLiquidity() external view returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256);
    function convertToShares(uint256 assets) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function deposit(uint256 assets, address receiver) external returns (uint256);
}

interface ISimERC20 {
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/**
 * @title SimulateYieldAccrual
 * @notice Script to simulate and visualize yield accrual over time
 *
 * Usage:
 *   # View current state only
 *   forge script script/SimulateYieldAccrual.s.sol:SimulateYieldAccrual \
 *     --rpc-url http://localhost:8545 \
 *     --sig "viewState(address)" <LIQUIDITY_POOL_ADDRESS>
 *
 *   # Simulate time passage (30 days)
 *   forge script script/SimulateYieldAccrual.s.sol:SimulateYieldAccrual \
 *     --rpc-url http://localhost:8545 \
 *     --sig "simulateTimePassage(address,uint256)" <LIQUIDITY_POOL_ADDRESS> 30
 *
 *   # Calculate yield for invoice
 *   forge script script/SimulateYieldAccrual.s.sol:SimulateYieldAccrual \
 *     --sig "calculateInvoiceYield(uint256,uint256,uint256)" 10000000000 500 30
 */
contract SimulateYieldAccrual is Script {
    /**
     * @notice View current state of the liquidity pool
     */
    function viewState(address poolAddress) public view {
        ISimLiquidityPool pool = ISimLiquidityPool(poolAddress);

        console.log("");
        console.log("==========================================================");
        console.log("           LIQUIDITY POOL STATE");
        console.log("==========================================================");
        console.log("");

        uint256 totalAssets = pool.totalAssets();
        uint256 totalSupply = pool.totalSupply();
        uint256 totalDeployed = pool.totalDeployed();
        uint256 totalYield = pool.totalInvoiceYield();
        uint256 availableLiquidity = pool.availableLiquidity();

        console.log("Pool Metrics:");
        console.log("  Total Assets (USDC):       ", totalAssets / 1e6);
        console.log("  Total SEED Supply:         ", totalSupply / 1e18);
        console.log("  Total Deployed (USDC):     ", totalDeployed / 1e6);
        console.log("  Total Invoice Yield (USDC):", totalYield / 1e6);
        console.log("  Available Liquidity (USDC):", availableLiquidity / 1e6);
        console.log("");

        if (totalSupply > 0) {
            uint256 sharePrice = pool.convertToAssets(1e18);
            uint256 sharesPerUsdc = pool.convertToShares(1e6);

            console.log("Share Price:");
            console.log("  1 SEED = (USDC wei):", sharePrice);
            console.log("  1 SEED = (USDC):    ", sharePrice / 1e6);
            console.log("  1 USDC = (SEED wei):", sharesPerUsdc);

            if (totalYield > 0 && totalAssets > totalYield) {
                uint256 principal = totalAssets - totalYield;
                uint256 yieldBps = (totalYield * 10000) / principal;
                console.log("  Implied Yield (bps):", yieldBps);
            }
        } else {
            console.log("Share Price: N/A (no deposits yet)");
        }

        console.log("");
        console.log("Current Block:");
        console.log("  Number:   ", block.number);
        console.log("  Timestamp:", block.timestamp);
        console.log("");
    }

    /**
     * @notice Simulate time passage and show state changes
     */
    function simulateTimePassage(address poolAddress, uint256 daysToAdvance) public {
        ISimLiquidityPool pool = ISimLiquidityPool(poolAddress);

        console.log("");
        console.log("==========================================================");
        console.log("           TIME PASSAGE SIMULATION");
        console.log("==========================================================");
        console.log("");

        console.log("BEFORE:");
        uint256 assetsBefore = pool.totalAssets();
        uint256 supplyBefore = pool.totalSupply();
        uint256 sharePriceBefore = supplyBefore > 0 ? pool.convertToAssets(1e18) : 1e6;

        console.log("  Total Assets (USDC):", assetsBefore / 1e6);
        console.log("  Share Price (wei):  ", sharePriceBefore);
        console.log("  Block Timestamp:    ", block.timestamp);
        console.log("");

        uint256 secondsToAdvance = daysToAdvance * 1 days;
        console.log("Warping forward (days):", daysToAdvance);
        vm.warp(block.timestamp + secondsToAdvance);

        console.log("");
        console.log("AFTER:");
        uint256 assetsAfter = pool.totalAssets();
        uint256 supplyAfter = pool.totalSupply();
        uint256 sharePriceAfter = supplyAfter > 0 ? pool.convertToAssets(1e18) : 1e6;

        console.log("  Total Assets (USDC):", assetsAfter / 1e6);
        console.log("  Share Price (wei):  ", sharePriceAfter);
        console.log("  Block Timestamp:    ", block.timestamp);
        console.log("");

        console.log("NOTE: Share price only increases when yield is added");
        console.log("      (i.e., when invoices are repaid with profit).");
        console.log("");
    }

    /**
     * @notice Inject yield directly into pool (for testing)
     */
    function injectYield(address poolAddress, address usdcAddress, uint256 yieldAmount) public {
        ISimLiquidityPool pool = ISimLiquidityPool(poolAddress);
        ISimERC20 usdc = ISimERC20(usdcAddress);

        console.log("");
        console.log("==========================================================");
        console.log("           YIELD INJECTION (Testing Only)");
        console.log("==========================================================");
        console.log("");

        uint256 sharePriceBefore = pool.totalSupply() > 0 ? pool.convertToAssets(1e18) : 1e6;
        console.log("Before - Share Price (wei):", sharePriceBefore);
        console.log("Before - Total Assets:     ", pool.totalAssets() / 1e6);

        console.log("");
        console.log("Injecting yield (USDC):", yieldAmount / 1e6);

        vm.startBroadcast();
        usdc.transfer(poolAddress, yieldAmount);
        vm.stopBroadcast();

        uint256 sharePriceAfter = pool.totalSupply() > 0 ? pool.convertToAssets(1e18) : 1e6;
        console.log("");
        console.log("After - Share Price (wei): ", sharePriceAfter);
        console.log("After - Total Assets:      ", pool.totalAssets() / 1e6);

        if (sharePriceBefore > 0) {
            uint256 priceIncrease = sharePriceAfter - sharePriceBefore;
            uint256 percentBps = (priceIncrease * 10000) / sharePriceBefore;
            console.log("");
            console.log("Price Increase (wei):", priceIncrease);
            console.log("Price Increase (bps):", percentBps);
        }
        console.log("");
    }

    /**
     * @notice Calculate expected yield for an invoice
     * @param faceValue Invoice face value in USDC (6 decimals)
     * @param discountRateBps Annual discount rate in basis points
     * @param daysToMaturity Days until invoice matures
     */
    function calculateInvoiceYield(
        uint256 faceValue,
        uint256 discountRateBps,
        uint256 daysToMaturity
    ) public pure returns (uint256 fundingAmount, uint256 yieldAmount) {
        uint256 secondsToMaturity = daysToMaturity * 1 days;
        uint256 annualDiscount = (faceValue * discountRateBps) / 10000;
        uint256 discount = (annualDiscount * secondsToMaturity) / 365 days;

        fundingAmount = faceValue - discount;
        yieldAmount = discount;

        console.log("");
        console.log("==========================================================");
        console.log("           INVOICE YIELD CALCULATION");
        console.log("==========================================================");
        console.log("");
        console.log("Inputs:");
        console.log("  Face Value (USDC):      ", faceValue / 1e6);
        console.log("  Discount Rate (bps):    ", discountRateBps);
        console.log("  Days to Maturity:       ", daysToMaturity);
        console.log("");
        console.log("Results:");
        console.log("  Funding Amount (USDC):  ", fundingAmount / 1e6);
        console.log("  Yield/Discount (USDC):  ", yieldAmount / 1e6);
        console.log("  Yield (bps of face):    ", (yieldAmount * 10000) / faceValue);
        console.log("");
    }

    /**
     * @notice Main entry point - shows usage guide
     */
    function run() public pure {
        console.log("");
        console.log("==========================================================");
        console.log("      SEED FINANCE - YIELD SIMULATION GUIDE");
        console.log("==========================================================");
        console.log("");
        console.log("Available Functions:");
        console.log("");
        console.log("1. viewState(address pool)");
        console.log("   View current pool state and share price");
        console.log("");
        console.log("2. simulateTimePassage(address pool, uint256 days)");
        console.log("   Warp time forward and show state changes");
        console.log("");
        console.log("3. injectYield(address pool, address usdc, uint256 amount)");
        console.log("   Directly add USDC to pool to test share price");
        console.log("");
        console.log("4. calculateInvoiceYield(uint256 faceValue, uint256 rateBps, uint256 days)");
        console.log("   Calculate expected yield for an invoice");
        console.log("");
        console.log("Example:");
        console.log("  forge script script/SimulateYieldAccrual.s.sol \\");
        console.log("    --sig 'calculateInvoiceYield(uint256,uint256,uint256)' \\");
        console.log("    10000000000 500 30");
        console.log("");
    }
}
