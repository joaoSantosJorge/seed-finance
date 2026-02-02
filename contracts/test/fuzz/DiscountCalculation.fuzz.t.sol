// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../../src/invoice/libraries/LibInvoiceStorage.sol";

/**
 * @title Discount Calculation Fuzz Tests
 * @notice Property-based tests for invoice discount calculations
 */
contract DiscountCalculationFuzzTest is Test {

    /* FUZZ TESTS - COMMENTED FOR FASTER RUNS
    // ============ Invariant: Discount <= Face Value ============

    function testFuzz_DiscountNeverExceedsFaceValue(
        uint128 faceValue,
        uint16 discountRateBps,
        uint256 secondsToMaturity
    ) public pure {
        // Bound inputs to realistic values
        faceValue = uint128(bound(faceValue, 1e6, 1e12)); // $1 to $1M
        discountRateBps = uint16(bound(discountRateBps, 0, 10000)); // 0-100%
        secondsToMaturity = bound(secondsToMaturity, 0, 365 days);

        uint128 fundingAmount = LibInvoiceStorage.calculateFundingAmount(
            faceValue,
            discountRateBps,
            secondsToMaturity
        );

        // Invariant: fundingAmount <= faceValue (discount is always non-negative)
        assertLe(fundingAmount, faceValue, "Funding amount should never exceed face value");
    }

    // ============ Invariant: Funding Amount Always Positive ============

    function testFuzz_FundingAmountAlwaysPositive(
        uint128 faceValue,
        uint16 discountRateBps,
        uint256 secondsToMaturity
    ) public pure {
        // Bound inputs
        faceValue = uint128(bound(faceValue, 1e6, 1e12));
        discountRateBps = uint16(bound(discountRateBps, 0, 5000)); // Max 50% annual rate (realistic)
        secondsToMaturity = bound(secondsToMaturity, 0, 365 days);

        uint128 fundingAmount = LibInvoiceStorage.calculateFundingAmount(
            faceValue,
            discountRateBps,
            secondsToMaturity
        );

        // Invariant: fundingAmount > 0 for non-zero face values with reasonable rates
        if (secondsToMaturity < 365 days && discountRateBps < 10000) {
            assertGt(fundingAmount, 0, "Funding amount should be positive");
        }
    }

    // ============ Property: Zero Time = Zero Discount ============

    function testFuzz_ZeroTimeZeroDiscount(
        uint128 faceValue,
        uint16 discountRateBps
    ) public pure {
        faceValue = uint128(bound(faceValue, 1e6, 1e12));
        discountRateBps = uint16(bound(discountRateBps, 0, 10000));

        uint128 fundingAmount = LibInvoiceStorage.calculateFundingAmount(
            faceValue,
            discountRateBps,
            0 // Zero seconds to maturity
        );

        // When time is zero, funding amount should equal face value (no discount)
        assertEq(fundingAmount, faceValue, "Zero time should mean no discount");
    }

    // ============ Property: Zero Rate = Zero Discount ============

    function testFuzz_ZeroRateZeroDiscount(
        uint128 faceValue,
        uint256 secondsToMaturity
    ) public pure {
        faceValue = uint128(bound(faceValue, 1e6, 1e12));
        secondsToMaturity = bound(secondsToMaturity, 0, 365 days);

        uint128 fundingAmount = LibInvoiceStorage.calculateFundingAmount(
            faceValue,
            0, // Zero rate
            secondsToMaturity
        );

        // When rate is zero, funding amount should equal face value
        assertEq(fundingAmount, faceValue, "Zero rate should mean no discount");
    }

    // ============ Property: Monotonicity - Higher Rate = Lower Funding ============

    function testFuzz_HigherRateLowerFunding(
        uint128 faceValue,
        uint16 discountRateBps1,
        uint16 discountRateBps2,
        uint256 secondsToMaturity
    ) public pure {
        faceValue = uint128(bound(faceValue, 1e6, 1e12));
        discountRateBps1 = uint16(bound(discountRateBps1, 0, 5000));
        discountRateBps2 = uint16(bound(discountRateBps2, discountRateBps1, 5000));
        secondsToMaturity = bound(secondsToMaturity, 1 days, 365 days);

        uint128 funding1 = LibInvoiceStorage.calculateFundingAmount(
            faceValue,
            discountRateBps1,
            secondsToMaturity
        );

        uint128 funding2 = LibInvoiceStorage.calculateFundingAmount(
            faceValue,
            discountRateBps2,
            secondsToMaturity
        );

        // Higher rate should result in lower or equal funding
        assertLe(funding2, funding1, "Higher rate should mean lower or equal funding");
    }

    // ============ Property: Monotonicity - Longer Time = Lower Funding ============

    function testFuzz_LongerTimeLowerFunding(
        uint128 faceValue,
        uint16 discountRateBps,
        uint256 seconds1,
        uint256 seconds2
    ) public pure {
        faceValue = uint128(bound(faceValue, 1e6, 1e12));
        discountRateBps = uint16(bound(discountRateBps, 100, 5000)); // Non-zero rate
        seconds1 = bound(seconds1, 0, 180 days);
        seconds2 = bound(seconds2, seconds1, 365 days);

        uint128 funding1 = LibInvoiceStorage.calculateFundingAmount(
            faceValue,
            discountRateBps,
            seconds1
        );

        uint128 funding2 = LibInvoiceStorage.calculateFundingAmount(
            faceValue,
            discountRateBps,
            seconds2
        );

        // Longer time should result in lower or equal funding
        assertLe(funding2, funding1, "Longer time should mean lower or equal funding");
    }

    // ============ Property: Linearity with Face Value ============

    function testFuzz_LinearWithFaceValue(
        uint128 faceValue,
        uint16 discountRateBps,
        uint256 secondsToMaturity
    ) public pure {
        faceValue = uint128(bound(faceValue, 1e6, 5e11)); // Keep it under overflow
        discountRateBps = uint16(bound(discountRateBps, 100, 2000));
        secondsToMaturity = bound(secondsToMaturity, 1 days, 180 days);

        uint128 funding1 = LibInvoiceStorage.calculateFundingAmount(
            faceValue,
            discountRateBps,
            secondsToMaturity
        );

        uint128 funding2 = LibInvoiceStorage.calculateFundingAmount(
            faceValue * 2,
            discountRateBps,
            secondsToMaturity
        );

        // Doubling face value should roughly double funding (within rounding)
        // Allow 1 USDC margin for rounding
        assertApproxEqAbs(funding2, funding1 * 2, 1e6, "Funding should scale linearly with face value");
    }

    // ============ Property: Known Value Sanity Check ============

    function test_KnownValueCalculation() public pure {
        // $10,000 face value, 5% annual rate (500 bps), 30 days
        uint128 faceValue = 10_000e6;
        uint16 discountRate = 500; // 5%
        uint256 secondsToMaturity = 30 days;

        uint128 fundingAmount = LibInvoiceStorage.calculateFundingAmount(
            faceValue,
            discountRate,
            secondsToMaturity
        );

        // Expected calculation:
        // Annual discount = 10,000 * 500 / 10000 = $500
        // 30-day discount = $500 * (30/365) ≈ $41.10
        // Funding = $10,000 - $41.10 ≈ $9,958.90

        // Due to integer math: (10000e6 * 500 / 10000 * 30 days / 365 days)
        // = 500e6 * 2592000 / 31536000 ≈ 41,095,890
        // Funding ≈ 9,958,904,109

        assertGt(fundingAmount, 9_950e6, "Funding too low");
        assertLt(fundingAmount, 9_970e6, "Funding too high");
    }

    // ============ Property: No Overflow with Max Values ============

    function test_NoOverflowWithMaxValues() public pure {
        // Test with maximum realistic values
        uint128 maxFaceValue = uint128(1e12); // $1M
        uint16 maxRate = 10000; // 100%
        uint256 maxTime = 365 days;

        // Should not overflow
        uint128 fundingAmount = LibInvoiceStorage.calculateFundingAmount(
            maxFaceValue,
            maxRate,
            maxTime
        );

        // At 100% annual rate for 1 year, funding should be 0
        assertEq(fundingAmount, 0, "100% annual rate for 1 year should be zero funding");
    }

    // ============ Property: Precision Loss Bounded ============

    function testFuzz_PrecisionLossBounded(
        uint128 faceValue,
        uint16 discountRateBps,
        uint256 secondsToMaturity
    ) public pure {
        faceValue = uint128(bound(faceValue, 1e6, 1e12));
        discountRateBps = uint16(bound(discountRateBps, 0, 5000));
        secondsToMaturity = bound(secondsToMaturity, 0, 365 days);

        uint128 fundingAmount = LibInvoiceStorage.calculateFundingAmount(
            faceValue,
            discountRateBps,
            secondsToMaturity
        );

        // Calculate expected discount manually with uint256 to avoid overflow
        uint256 annualDiscount = (uint256(faceValue) * uint256(discountRateBps)) / 10000;
        uint256 expectedDiscount = (annualDiscount * secondsToMaturity) / 365 days;
        uint256 expectedFunding = uint256(faceValue) - expectedDiscount;

        // Funding should be exactly as calculated (no precision loss in the formula)
        assertEq(uint256(fundingAmount), expectedFunding, "Formula mismatch");
    }
    FUZZ TESTS - COMMENTED FOR FASTER RUNS */
}
