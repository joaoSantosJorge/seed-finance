# 05. Testing Improvements

## Executive Summary

This document outlines a comprehensive testing strategy for Seed Finance, covering smart contract testing, backend service testing, integration testing, and security testing. Current test coverage is approximately 70%; target is 95%+.

---

## Table of Contents

1. [Current Testing Analysis](#current-testing-analysis)
2. [Smart Contract Testing](#smart-contract-testing)
3. [Backend Testing](#backend-testing)
4. [Integration Testing](#integration-testing)
5. [Security Testing](#security-testing)
6. [Test Infrastructure](#test-infrastructure)
7. [Implementation Plan](#implementation-plan)

---

## Current Testing Analysis

### Existing Test Coverage

| Component | Current Coverage | Target | Gap |
|-----------|-----------------|--------|-----|
| InvoiceFacet | 85% | 95% | 10% |
| FundingFacet | 80% | 95% | 15% |
| RepaymentFacet | 75% | 95% | 20% |
| ExecutionPool | 85% | 95% | 10% |
| LiquidityPool | 90% | 95% | 5% |
| TreasuryManager | 85% | 95% | 10% |
| CCTPReceiver | 90% | 95% | 5% |
| Backend Services | 30% | 90% | 60% |
| Integration Tests | 40% | 80% | 40% |

### Missing Test Categories

1. **Fuzz Testing**: Limited coverage of edge cases
2. **Invariant Testing**: No invariant tests
3. **Fork Testing**: No mainnet fork tests
4. **Security Tests**: No explicit security test suite
5. **Load Testing**: No performance/stress tests
6. **Backend Unit Tests**: Minimal service tests
7. **E2E Tests**: No end-to-end tests

---

## Smart Contract Testing

### 1. Enhanced Unit Tests

#### Invoice Lifecycle Edge Cases

```solidity
// contracts/test/InvoiceFacet.edge.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/invoice/InvoiceDiamond.sol";

contract InvoiceFacetEdgeCasesTest is Test {
    // ... setup ...

    // ============ Boundary Tests ============

    function test_CreateInvoice_MinimumFaceValue() public {
        // Test with 1 wei (0.000001 USDC)
        uint128 minValue = 1;

        vm.prank(supplier);
        uint256 invoiceId = invoiceFacet.createInvoice(
            buyer,
            minValue,
            500, // 5%
            uint64(block.timestamp + 30 days),
            bytes32(0),
            bytes32(0)
        );

        assertEq(invoiceFacet.getInvoice(invoiceId).faceValue, minValue);
    }

    function test_CreateInvoice_MaximumFaceValue() public {
        // Test with max uint128 value
        uint128 maxValue = type(uint128).max;

        vm.prank(supplier);
        uint256 invoiceId = invoiceFacet.createInvoice(
            buyer,
            maxValue,
            500,
            uint64(block.timestamp + 30 days),
            bytes32(0),
            bytes32(0)
        );

        assertEq(invoiceFacet.getInvoice(invoiceId).faceValue, maxValue);
    }

    function test_CreateInvoice_MaturityOneSecondAway() public {
        vm.prank(supplier);
        uint256 invoiceId = invoiceFacet.createInvoice(
            buyer,
            1000e6,
            500,
            uint64(block.timestamp + 1), // 1 second
            bytes32(0),
            bytes32(0)
        );

        // Should have near-zero discount
        uint128 funding = fundingFacet.getFundingAmount(invoiceId);
        assertApproxEqAbs(funding, 1000e6, 1); // Within 1 wei
    }

    function test_CreateInvoice_MaturityMaxDays() public {
        vm.prank(supplier);
        uint256 invoiceId = invoiceFacet.createInvoice(
            buyer,
            1000e6,
            500, // 5%
            uint64(block.timestamp + 365 days),
            bytes32(0),
            bytes32(0)
        );

        // Should have full annual discount
        uint128 funding = fundingFacet.getFundingAmount(invoiceId);
        // Expected: 1000 - (1000 * 0.05) = 950 USDC
        assertApproxEqRel(funding, 950e6, 0.001e18); // Within 0.1%
    }

    function test_CreateInvoice_ZeroDiscountRate() public {
        vm.prank(supplier);
        uint256 invoiceId = invoiceFacet.createInvoice(
            buyer,
            1000e6,
            0, // 0% discount
            uint64(block.timestamp + 30 days),
            bytes32(0),
            bytes32(0)
        );

        // Funding should equal face value
        uint128 funding = fundingFacet.getFundingAmount(invoiceId);
        assertEq(funding, 1000e6);
    }

    function test_CreateInvoice_MaxDiscountRate() public {
        vm.prank(supplier);
        uint256 invoiceId = invoiceFacet.createInvoice(
            buyer,
            1000e6,
            10000, // 100% annual (max allowed)
            uint64(block.timestamp + 365 days),
            bytes32(0),
            bytes32(0)
        );

        // Funding should be 0 (100% discount over 1 year)
        uint128 funding = fundingFacet.getFundingAmount(invoiceId);
        assertEq(funding, 0);
    }

    // ============ Concurrent Access Tests ============

    function test_ConcurrentApprovals() public {
        // Create multiple invoices
        uint256[] memory invoiceIds = new uint256[](10);
        for (uint256 i = 0; i < 10; i++) {
            vm.prank(supplier);
            invoiceIds[i] = invoiceFacet.createInvoice(
                buyer,
                1000e6,
                500,
                uint64(block.timestamp + 30 days),
                bytes32(0),
                bytes32(0)
            );
        }

        // Approve all in same block
        vm.startPrank(buyer);
        for (uint256 i = 0; i < 10; i++) {
            invoiceFacet.approveInvoice(invoiceIds[i]);
        }
        vm.stopPrank();

        // All should be approved
        for (uint256 i = 0; i < 10; i++) {
            assertEq(
                uint8(invoiceFacet.getInvoice(invoiceIds[i]).status),
                uint8(LibInvoiceStorage.InvoiceStatus.Approved)
            );
        }
    }

    // ============ State Transition Tests ============

    function test_CannotApproveAlreadyFunded() public {
        uint256 invoiceId = _createAndFundInvoice();

        vm.prank(buyer);
        vm.expectRevert(InvoiceFacet.InvalidInvoiceStatus.selector);
        invoiceFacet.approveInvoice(invoiceId);
    }

    function test_CannotCancelFundedInvoice() public {
        uint256 invoiceId = _createAndFundInvoice();

        vm.prank(supplier);
        vm.expectRevert(InvoiceFacet.InvalidInvoiceStatus.selector);
        invoiceFacet.cancelInvoice(invoiceId);
    }

    function test_CannotRepayPaidInvoice() public {
        uint256 invoiceId = _createFundAndRepayInvoice();

        vm.prank(buyer);
        vm.expectRevert(RepaymentFacet.InvalidInvoiceStatus.selector);
        repaymentFacet.processRepayment(invoiceId);
    }

    // ============ Gas Limit Tests ============

    function test_BatchFund_GasLimit() public {
        // Create 100 invoices
        uint256[] memory invoiceIds = new uint256[](100);
        for (uint256 i = 0; i < 100; i++) {
            vm.prank(supplier);
            invoiceIds[i] = invoiceFacet.createInvoice(
                buyer,
                1000e6,
                500,
                uint64(block.timestamp + 30 days),
                bytes32(0),
                bytes32(0)
            );

            vm.prank(buyer);
            invoiceFacet.approveInvoice(invoiceIds[i]);
        }

        // Batch fund should work within gas limit
        uint256 gasBefore = gasleft();
        vm.prank(operator);
        fundingFacet.batchFund(invoiceIds);
        uint256 gasUsed = gasBefore - gasleft();

        // Should use less than 10M gas (well under block limit)
        assertLt(gasUsed, 10_000_000);
        emit log_named_uint("Gas used for 100 invoices", gasUsed);
        emit log_named_uint("Gas per invoice", gasUsed / 100);
    }
}
```

### 2. Fuzz Testing

```solidity
// contracts/test/InvoiceFacet.fuzz.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";

contract InvoiceFacetFuzzTest is Test {
    // ... setup ...

    function testFuzz_CreateInvoice(
        uint128 faceValue,
        uint16 discountRateBps,
        uint32 maturityDays
    ) public {
        // Bound inputs to valid ranges
        faceValue = uint128(bound(faceValue, 1, type(uint128).max));
        discountRateBps = uint16(bound(discountRateBps, 0, 10000));
        maturityDays = uint32(bound(maturityDays, 1, 365));

        uint64 maturityDate = uint64(block.timestamp + uint256(maturityDays) * 1 days);

        vm.prank(supplier);
        uint256 invoiceId = invoiceFacet.createInvoice(
            buyer,
            faceValue,
            discountRateBps,
            maturityDate,
            bytes32(0),
            bytes32(0)
        );

        // Verify invoice was created correctly
        IInvoiceDiamond.InvoiceView memory inv = invoiceFacet.getInvoice(invoiceId);
        assertEq(inv.faceValue, faceValue);
        assertEq(inv.discountRateBps, discountRateBps);
        assertEq(inv.maturityDate, maturityDate);
    }

    function testFuzz_FundingAmountNeverExceedsFaceValue(
        uint128 faceValue,
        uint16 discountRateBps,
        uint32 maturitySeconds
    ) public {
        // Bound inputs
        faceValue = uint128(bound(faceValue, 1e6, 1e15)); // 1 to 1B USDC
        discountRateBps = uint16(bound(discountRateBps, 0, 10000));
        maturitySeconds = uint32(bound(maturitySeconds, 1, 365 days));

        uint64 maturityDate = uint64(block.timestamp + maturitySeconds);

        vm.prank(supplier);
        uint256 invoiceId = invoiceFacet.createInvoice(
            buyer,
            faceValue,
            discountRateBps,
            maturityDate,
            bytes32(0),
            bytes32(0)
        );

        uint128 fundingAmount = fundingFacet.getFundingAmount(invoiceId);

        // INVARIANT: Funding amount must never exceed face value
        assertLe(fundingAmount, faceValue, "Funding exceeds face value");

        // INVARIANT: Funding amount must be non-negative (always true for uint)
        assertGe(fundingAmount, 0, "Funding is negative");
    }

    function testFuzz_DiscountCalculationPrecision(
        uint128 faceValue,
        uint16 discountRateBps,
        uint32 maturitySeconds
    ) public {
        faceValue = uint128(bound(faceValue, 1e6, 1e15));
        discountRateBps = uint16(bound(discountRateBps, 1, 5000)); // Non-zero
        maturitySeconds = uint32(bound(maturitySeconds, 1 days, 365 days));

        uint64 maturityDate = uint64(block.timestamp + maturitySeconds);

        vm.prank(supplier);
        uint256 invoiceId = invoiceFacet.createInvoice(
            buyer,
            faceValue,
            discountRateBps,
            maturityDate,
            bytes32(0),
            bytes32(0)
        );

        uint128 fundingAmount = fundingFacet.getFundingAmount(invoiceId);
        uint128 discount = faceValue - fundingAmount;

        // Calculate expected discount
        uint256 expectedDiscount = (uint256(faceValue) * discountRateBps * maturitySeconds) /
            (10000 * 365 days);

        // INVARIANT: Discount should be within 1 wei of expected
        assertApproxEqAbs(discount, expectedDiscount, 1, "Discount calculation error");
    }
}
```

### 3. Invariant Testing

```solidity
// contracts/test/InvoiceInvariant.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "forge-std/StdInvariant.sol";

contract InvoiceInvariantTest is StdInvariant, Test {
    InvoiceHandler handler;

    function setUp() public {
        // Deploy contracts
        // ...

        // Create handler
        handler = new InvoiceHandler(invoiceFacet, fundingFacet, repaymentFacet);

        // Set handler as target
        targetContract(address(handler));
    }

    // INVARIANT: Total repaid <= Total funded
    function invariant_RepaidNeverExceedsFunded() public {
        (uint256 totalFunded, uint256 totalRepaid, , ) = viewFacet.getStats();
        assertLe(totalRepaid, totalFunded, "Repaid exceeds funded");
    }

    // INVARIANT: Active invoices count is accurate
    function invariant_ActiveInvoiceCountAccurate() public {
        (, , uint256 activeCount, uint256 nextId) = viewFacet.getStats();

        uint256 calculatedActive = 0;
        for (uint256 i = 1; i < nextId; i++) {
            try viewFacet.getInvoice(i) returns (IInvoiceDiamond.InvoiceView memory inv) {
                if (inv.status == LibInvoiceStorage.InvoiceStatus.Funded) {
                    calculatedActive++;
                }
            } catch {}
        }

        assertEq(activeCount, calculatedActive, "Active count mismatch");
    }

    // INVARIANT: LP shares accurately reflect total assets
    function invariant_SharePriceConsistent() public {
        uint256 totalAssets = liquidityPool.totalAssets();
        uint256 totalShares = liquidityPool.totalSupply();

        if (totalShares > 0) {
            uint256 sharePrice = (totalAssets * 1e6) / totalShares;
            // Share price should be >= 1 (can increase with yield, never decrease below 1)
            assertGe(sharePrice, 1e6, "Share price below 1");
        }
    }
}

// Handler contract that performs random actions
contract InvoiceHandler is Test {
    InvoiceFacet invoiceFacet;
    FundingFacet fundingFacet;
    RepaymentFacet repaymentFacet;

    address[] suppliers;
    address[] buyers;
    uint256[] createdInvoices;
    uint256[] approvedInvoices;
    uint256[] fundedInvoices;

    constructor(
        InvoiceFacet _invoiceFacet,
        FundingFacet _fundingFacet,
        RepaymentFacet _repaymentFacet
    ) {
        invoiceFacet = _invoiceFacet;
        fundingFacet = _fundingFacet;
        repaymentFacet = _repaymentFacet;

        // Create test actors
        for (uint256 i = 0; i < 5; i++) {
            suppliers.push(makeAddr(string.concat("supplier", vm.toString(i))));
            buyers.push(makeAddr(string.concat("buyer", vm.toString(i))));
        }
    }

    function createInvoice(
        uint256 supplierSeed,
        uint256 buyerSeed,
        uint128 faceValue,
        uint16 discountRateBps
    ) public {
        address supplier = suppliers[supplierSeed % suppliers.length];
        address buyer = buyers[buyerSeed % buyers.length];
        faceValue = uint128(bound(faceValue, 1e6, 1e12));
        discountRateBps = uint16(bound(discountRateBps, 100, 5000));

        vm.prank(supplier);
        uint256 invoiceId = invoiceFacet.createInvoice(
            buyer,
            faceValue,
            discountRateBps,
            uint64(block.timestamp + 30 days),
            bytes32(0),
            bytes32(0)
        );

        createdInvoices.push(invoiceId);
    }

    function approveInvoice(uint256 indexSeed) public {
        if (createdInvoices.length == 0) return;

        uint256 index = indexSeed % createdInvoices.length;
        uint256 invoiceId = createdInvoices[index];

        IInvoiceDiamond.InvoiceView memory inv = invoiceFacet.getInvoice(invoiceId);
        if (inv.status != LibInvoiceStorage.InvoiceStatus.Pending) return;

        vm.prank(inv.buyer);
        invoiceFacet.approveInvoice(invoiceId);

        approvedInvoices.push(invoiceId);
    }

    function fundInvoice(uint256 indexSeed) public {
        if (approvedInvoices.length == 0) return;

        uint256 index = indexSeed % approvedInvoices.length;
        uint256 invoiceId = approvedInvoices[index];

        IInvoiceDiamond.InvoiceView memory inv = invoiceFacet.getInvoice(invoiceId);
        if (inv.status != LibInvoiceStorage.InvoiceStatus.Approved) return;

        fundingFacet.requestFunding(invoiceId);

        fundedInvoices.push(invoiceId);
    }

    function repayInvoice(uint256 indexSeed) public {
        if (fundedInvoices.length == 0) return;

        uint256 index = indexSeed % fundedInvoices.length;
        uint256 invoiceId = fundedInvoices[index];

        IInvoiceDiamond.InvoiceView memory inv = invoiceFacet.getInvoice(invoiceId);
        if (inv.status != LibInvoiceStorage.InvoiceStatus.Funded) return;

        // Warp to maturity
        vm.warp(inv.maturityDate);

        // Mint USDC for buyer
        deal(address(usdc), inv.buyer, inv.faceValue);

        vm.startPrank(inv.buyer);
        usdc.approve(address(repaymentFacet), inv.faceValue);
        repaymentFacet.processRepayment(invoiceId);
        vm.stopPrank();
    }
}
```

### 4. Fork Testing

```solidity
// contracts/test/fork/MainnetFork.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";

contract MainnetForkTest is Test {
    // Real mainnet addresses
    address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant USDC_WHALE = 0x...; // Known USDC holder

    function setUp() public {
        // Fork Base mainnet
        vm.createSelectFork(vm.envString("BASE_MAINNET_RPC"), 12345678);

        // Deploy contracts on fork
        // ...
    }

    function test_RealUSDCDeposit() public {
        // Impersonate whale
        vm.startPrank(USDC_WHALE);

        uint256 depositAmount = 10_000e6; // 10,000 USDC
        IERC20(USDC_BASE).approve(address(liquidityPool), depositAmount);
        liquidityPool.deposit(depositAmount, USDC_WHALE);

        // Verify
        assertGt(liquidityPool.balanceOf(USDC_WHALE), 0);

        vm.stopPrank();
    }

    function test_FullLifecycleOnFork() public {
        // Test full invoice lifecycle with real USDC
        // ...
    }
}
```

---

## Backend Testing

### 1. Service Unit Tests

```typescript
// backend/tests/services/InvoiceService.test.ts
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { InvoiceService } from '../../services/InvoiceService';
import { CircleWalletsService } from '../../services/CircleWalletsService';
import { InvoiceStatus } from '../../types/invoice';

describe('InvoiceService', () => {
  let invoiceService: InvoiceService;
  let mockWalletService: jest.Mocked<CircleWalletsService>;
  let mockContract: any;

  beforeEach(() => {
    // Create mocks
    mockWalletService = {
      executeTransaction: jest.fn(),
      getWalletBalance: jest.fn(),
    } as any;

    mockContract = {
      getInvoice: jest.fn(),
      getSupplierInvoices: jest.fn(),
      getBuyerInvoices: jest.fn(),
    };

    invoiceService = new InvoiceService(
      {
        invoiceDiamondAddress: '0x1234567890123456789012345678901234567890',
        rpcUrl: 'http://localhost:8545',
      } as any,
      mockWalletService
    );

    // Inject mock contract
    (invoiceService as any).contract = mockContract;
  });

  describe('getInvoice', () => {
    it('should return invoice when found', async () => {
      const mockInvoiceData = {
        buyer: '0xBuyer',
        supplier: '0xSupplier',
        faceValue: BigInt(1000e6),
        fundingAmount: BigInt(950e6),
        maturityDate: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
        createdAt: BigInt(Math.floor(Date.now() / 1000)),
        fundedAt: BigInt(0),
        paidAt: BigInt(0),
        discountRateBps: 500,
        status: 0,
        invoiceHash: '0x' + '0'.repeat(64),
        externalId: '0x' + '0'.repeat(64),
      };

      mockContract.getInvoice.mockResolvedValue(mockInvoiceData);

      const result = await invoiceService.getInvoice(BigInt(1));

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(BigInt(1));
        expect(result.data.status).toBe(InvoiceStatus.Pending);
        expect(result.data.faceValue).toBe(BigInt(1000e6));
      }
    });

    it('should return error when invoice not found', async () => {
      mockContract.getInvoice.mockResolvedValue({
        buyer: '0x0000000000000000000000000000000000000000',
        createdAt: BigInt(0),
      });

      const result = await invoiceService.getInvoice(BigInt(999));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('createInvoice', () => {
    it('should validate buyer address', async () => {
      const result = await invoiceService.createInvoice('wallet-123', {
        buyerAddress: 'invalid-address',
        faceValue: BigInt(1000e6),
        discountRateBps: 500,
        maturityDate: new Date(Date.now() + 86400000 * 30),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('address');
      }
    });

    it('should validate face value is positive', async () => {
      const result = await invoiceService.createInvoice('wallet-123', {
        buyerAddress: '0x1234567890123456789012345678901234567890',
        faceValue: BigInt(0),
        discountRateBps: 500,
        maturityDate: new Date(Date.now() + 86400000 * 30),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('positive');
      }
    });

    it('should validate maturity date is in future', async () => {
      const result = await invoiceService.createInvoice('wallet-123', {
        buyerAddress: '0x1234567890123456789012345678901234567890',
        faceValue: BigInt(1000e6),
        discountRateBps: 500,
        maturityDate: new Date(Date.now() - 86400000), // Yesterday
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('future');
      }
    });

    it('should call wallet service on valid input', async () => {
      mockWalletService.executeTransaction.mockResolvedValue({
        hash: '0xTxHash',
        status: 'confirmed',
      });

      const result = await invoiceService.createInvoice('wallet-123', {
        buyerAddress: '0x1234567890123456789012345678901234567890',
        faceValue: BigInt(1000e6),
        discountRateBps: 500,
        maturityDate: new Date(Date.now() + 86400000 * 30),
      });

      expect(mockWalletService.executeTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          walletId: 'wallet-123',
          functionSignature: expect.stringContaining('createInvoice'),
        })
      );
    });
  });

  describe('getSupplierInvoices', () => {
    it('should handle partial failures gracefully', async () => {
      mockContract.getSupplierInvoices.mockResolvedValue([
        BigInt(1),
        BigInt(2),
        BigInt(3),
      ]);

      // Invoice 1 and 3 succeed, invoice 2 fails
      mockContract.getInvoice
        .mockResolvedValueOnce({
          buyer: '0xBuyer',
          supplier: '0xSupplier',
          faceValue: BigInt(1000e6),
          createdAt: BigInt(1000),
          status: 0,
        })
        .mockRejectedValueOnce(new Error('RPC timeout'))
        .mockResolvedValueOnce({
          buyer: '0xBuyer',
          supplier: '0xSupplier',
          faceValue: BigInt(2000e6),
          createdAt: BigInt(2000),
          status: 0,
        });

      const result = await invoiceService.getSupplierInvoices('0xSupplier');

      expect(result.success).toBe(true);
      if (result.success) {
        // Should return 2 invoices, not fail completely
        expect(result.data.length).toBe(2);
      }
    });
  });
});
```

### 2. Webhook Handler Tests

```typescript
// backend/tests/api/webhooks/circle-gateway.test.ts
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

describe('Circle Gateway Webhook', () => {
  const webhookSecret = 'test-webhook-secret-key';

  function createValidSignature(payload: string, timestamp: number): string {
    const signedPayload = `${timestamp}.${payload}`;
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload, 'utf8')
      .digest('hex');
    return `t=${timestamp},v1=${signature}`;
  }

  function createRequest(
    payload: object,
    signature?: string,
    timestamp?: number
  ): NextRequest {
    const body = JSON.stringify(payload);
    timestamp = timestamp || Math.floor(Date.now() / 1000);
    signature = signature || createValidSignature(body, timestamp);

    return new NextRequest('http://localhost/api/webhooks/circle-gateway', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'circle-signature': signature,
        'x-webhook-id': 'webhook-123',
      },
      body,
    });
  }

  describe('Signature Verification', () => {
    it('should accept valid signatures', async () => {
      const payload = { type: 'deposit.complete', data: { amount: '1000' } };
      const request = createRequest(payload);

      const response = await POST(request);

      expect(response.status).not.toBe(401);
    });

    it('should reject invalid signatures', async () => {
      const payload = { type: 'deposit.complete', data: { amount: '1000' } };
      const request = createRequest(payload, 't=123,v1=invalidsignature');

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should reject expired signatures', async () => {
      const payload = { type: 'deposit.complete', data: { amount: '1000' } };
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
      const request = createRequest(
        payload,
        createValidSignature(JSON.stringify(payload), oldTimestamp),
        oldTimestamp
      );

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should reject tampered payloads', async () => {
      const originalPayload = { type: 'deposit.complete', data: { amount: '1000' } };
      const tamperedPayload = { type: 'deposit.complete', data: { amount: '1000000' } };

      const timestamp = Math.floor(Date.now() / 1000);
      const signature = createValidSignature(JSON.stringify(originalPayload), timestamp);

      const request = new NextRequest(
        'http://localhost/api/webhooks/circle-gateway',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'circle-signature': signature,
          },
          body: JSON.stringify(tamperedPayload),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  describe('Idempotency', () => {
    it('should process webhook only once', async () => {
      const payload = { type: 'deposit.complete', data: { amount: '1000' } };
      const request1 = createRequest(payload);
      const request2 = createRequest(payload); // Same webhook ID

      const response1 = await POST(request1);
      const response2 = await POST(request2);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      const body2 = await response2.json();
      expect(body2.status).toBe('already_processed');
    });
  });

  describe('Event Processing', () => {
    it('should handle deposit.complete events', async () => {
      const payload = {
        type: 'deposit.complete',
        data: {
          id: 'deposit-123',
          amount: '1000000000', // 1000 USDC
          beneficiary: '0x1234567890123456789012345678901234567890',
        },
      };

      const request = createRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(200);
      // Verify deposit was processed
    });

    it('should handle withdrawal.complete events', async () => {
      const payload = {
        type: 'withdrawal.complete',
        data: {
          id: 'withdrawal-123',
          amount: '500000000', // 500 USDC
          destination: 'bank-account-123',
        },
      };

      const request = createRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should handle unknown event types gracefully', async () => {
      const payload = {
        type: 'unknown.event',
        data: {},
      };

      const request = createRequest(payload);
      const response = await POST(request);

      // Should acknowledge but not fail
      expect(response.status).toBe(200);
    });
  });
});
```

---

## Integration Testing

### End-to-End Test Suite

```typescript
// backend/tests/e2e/invoice-lifecycle.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createPublicClient, createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

describe('Invoice Lifecycle E2E', () => {
  let publicClient: any;
  let supplierClient: any;
  let buyerClient: any;
  let operatorClient: any;
  let lpClient: any;

  const contracts = {
    usdc: process.env.USDC_ADDRESS as `0x${string}`,
    invoiceDiamond: process.env.INVOICE_DIAMOND_ADDRESS as `0x${string}`,
    liquidityPool: process.env.LIQUIDITY_POOL_ADDRESS as `0x${string}`,
    executionPool: process.env.EXECUTION_POOL_ADDRESS as `0x${string}`,
  };

  beforeAll(async () => {
    // Set up clients
    publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(process.env.RPC_URL),
    });

    supplierClient = createWalletClient({
      account: privateKeyToAccount(process.env.SUPPLIER_PRIVATE_KEY as `0x${string}`),
      chain: baseSepolia,
      transport: http(process.env.RPC_URL),
    });

    buyerClient = createWalletClient({
      account: privateKeyToAccount(process.env.BUYER_PRIVATE_KEY as `0x${string}`),
      chain: baseSepolia,
      transport: http(process.env.RPC_URL),
    });

    // ... more setup
  });

  it('should complete full invoice lifecycle', async () => {
    // 1. LP deposits liquidity
    const depositAmount = parseUnits('10000', 6);
    await lpClient.writeContract({
      address: contracts.usdc,
      abi: erc20Abi,
      functionName: 'approve',
      args: [contracts.liquidityPool, depositAmount],
    });

    const depositTx = await lpClient.writeContract({
      address: contracts.liquidityPool,
      abi: liquidityPoolAbi,
      functionName: 'deposit',
      args: [depositAmount, lpClient.account.address],
    });

    await publicClient.waitForTransactionReceipt({ hash: depositTx });

    // 2. Supplier creates invoice
    const faceValue = parseUnits('1000', 6);
    const createTx = await supplierClient.writeContract({
      address: contracts.invoiceDiamond,
      abi: invoiceDiamondAbi,
      functionName: 'createInvoice',
      args: [
        buyerClient.account.address,
        faceValue,
        500, // 5% discount
        BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
        '0x' + '0'.repeat(64),
        '0x' + '0'.repeat(64),
      ],
    });

    const createReceipt = await publicClient.waitForTransactionReceipt({
      hash: createTx,
    });

    // Parse invoice ID from event
    const invoiceCreatedEvent = createReceipt.logs.find(
      (log: any) => log.topics[0] === invoiceCreatedTopic
    );
    const invoiceId = BigInt(invoiceCreatedEvent.topics[1]);

    // 3. Buyer approves invoice
    const approveTx = await buyerClient.writeContract({
      address: contracts.invoiceDiamond,
      abi: invoiceDiamondAbi,
      functionName: 'approveInvoice',
      args: [invoiceId],
    });

    await publicClient.waitForTransactionReceipt({ hash: approveTx });

    // 4. Operator funds invoice
    const fundTx = await operatorClient.writeContract({
      address: contracts.invoiceDiamond,
      abi: invoiceDiamondAbi,
      functionName: 'requestFunding',
      args: [invoiceId],
    });

    await publicClient.waitForTransactionReceipt({ hash: fundTx });

    // 5. Verify supplier received funds
    const supplierBalance = await publicClient.readContract({
      address: contracts.usdc,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [supplierClient.account.address],
    });

    expect(supplierBalance).toBeGreaterThan(0n);

    // 6. Buyer repays at maturity
    // ... time warp in test environment or wait

    const repayTx = await buyerClient.writeContract({
      address: contracts.invoiceDiamond,
      abi: invoiceDiamondAbi,
      functionName: 'processRepayment',
      args: [invoiceId],
    });

    await publicClient.waitForTransactionReceipt({ hash: repayTx });

    // 7. Verify invoice is paid
    const invoice = await publicClient.readContract({
      address: contracts.invoiceDiamond,
      abi: invoiceDiamondAbi,
      functionName: 'getInvoice',
      args: [invoiceId],
    });

    expect(invoice.status).toBe(3); // Paid

    // 8. Verify LP can withdraw with yield
    const lpShares = await publicClient.readContract({
      address: contracts.liquidityPool,
      abi: liquidityPoolAbi,
      functionName: 'balanceOf',
      args: [lpClient.account.address],
    });

    const withdrawTx = await lpClient.writeContract({
      address: contracts.liquidityPool,
      abi: liquidityPoolAbi,
      functionName: 'redeem',
      args: [lpShares, lpClient.account.address, lpClient.account.address],
    });

    await publicClient.waitForTransactionReceipt({ hash: withdrawTx });

    const finalBalance = await publicClient.readContract({
      address: contracts.usdc,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [lpClient.account.address],
    });

    // LP should have earned yield
    expect(finalBalance).toBeGreaterThan(depositAmount);
  }, 120000); // 2 minute timeout
});
```

---

## Security Testing

### Security Test Suite

```solidity
// contracts/test/security/SecurityTests.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";

contract SecurityTests is Test {
    // ... setup ...

    // ============ Access Control Tests ============

    function test_OnlyOperatorCanFund() public {
        uint256 invoiceId = _createAndApproveInvoice();

        vm.prank(attacker);
        vm.expectRevert(FundingFacet.NotOperator.selector);
        fundingFacet.requestFunding(invoiceId);
    }

    function test_OnlyBuyerCanApprove() public {
        uint256 invoiceId = _createInvoice();

        vm.prank(attacker);
        vm.expectRevert(InvoiceFacet.NotBuyer.selector);
        invoiceFacet.approveInvoice(invoiceId);
    }

    function test_OnlyBuyerCanRepay() public {
        uint256 invoiceId = _createAndFundInvoice();

        vm.prank(attacker);
        vm.expectRevert(RepaymentFacet.NotBuyer.selector);
        repaymentFacet.processRepayment(invoiceId);
    }

    function test_OnlyOwnerCanAddOperator() public {
        vm.prank(attacker);
        vm.expectRevert(AdminFacet.NotOwner.selector);
        adminFacet.setOperator(attacker, true);
    }

    // ============ Reentrancy Tests ============

    function test_ReentrancyOnFunding() public {
        // Deploy reentrancy attacker
        ReentrancyAttacker attackerContract = new ReentrancyAttacker(
            address(fundingFacet)
        );

        uint256 invoiceId = _createAndApproveInvoiceForAttacker(
            address(attackerContract)
        );

        // Attempt reentrancy attack
        vm.expectRevert(); // Should fail due to nonReentrant
        attackerContract.attack(invoiceId);
    }

    function test_ReentrancyOnRepayment() public {
        ReentrancyAttacker attackerContract = new ReentrancyAttacker(
            address(repaymentFacet)
        );

        uint256 invoiceId = _createAndFundInvoiceForBuyer(
            address(attackerContract)
        );

        vm.expectRevert();
        attackerContract.attackRepayment(invoiceId);
    }

    // ============ Front-Running Tests ============

    function test_FrontRunApproval() public {
        uint256 invoiceId = _createInvoice();

        // Attacker tries to approve before buyer
        vm.prank(attacker);
        vm.expectRevert(InvoiceFacet.NotBuyer.selector);
        invoiceFacet.approveInvoice(invoiceId);

        // Legitimate buyer can still approve
        vm.prank(buyer);
        invoiceFacet.approveInvoice(invoiceId);

        assertEq(
            uint8(invoiceFacet.getInvoice(invoiceId).status),
            uint8(LibInvoiceStorage.InvoiceStatus.Approved)
        );
    }

    // ============ Overflow/Underflow Tests ============

    function test_NoOverflowInDiscount() public {
        // Max face value with max discount rate
        uint128 maxFaceValue = type(uint128).max;
        uint16 maxDiscount = 10000;

        vm.prank(supplier);
        uint256 invoiceId = invoiceFacet.createInvoice(
            buyer,
            maxFaceValue,
            maxDiscount,
            uint64(block.timestamp + 365 days),
            bytes32(0),
            bytes32(0)
        );

        // Should not overflow
        uint128 funding = fundingFacet.getFundingAmount(invoiceId);
        assertLe(funding, maxFaceValue);
    }

    // ============ Flash Loan Attack Tests ============

    function test_FlashLoanDepositWithdraw() public {
        // Simulate flash loan attack
        FlashLoanAttacker attacker = new FlashLoanAttacker(
            address(liquidityPool),
            address(usdc)
        );

        // Give attacker some initial USDC
        deal(address(usdc), address(attacker), 1e6);

        // Attempt flash loan exploit
        vm.expectRevert(); // Should fail
        attacker.attack(1_000_000e6);
    }

    // ============ Denial of Service Tests ============

    function test_CannotBlockFunding() public {
        // Create many invoices
        for (uint256 i = 0; i < 100; i++) {
            _createAndApproveInvoice();
        }

        // Should still be able to fund
        uint256 invoiceId = _createAndApproveInvoice();

        vm.prank(operator);
        fundingFacet.requestFunding(invoiceId);

        assertEq(
            uint8(invoiceFacet.getInvoice(invoiceId).status),
            uint8(LibInvoiceStorage.InvoiceStatus.Funded)
        );
    }
}

// Attacker contracts
contract ReentrancyAttacker {
    address target;
    uint256 attackInvoiceId;
    bool attacking;

    constructor(address _target) {
        target = _target;
    }

    function attack(uint256 invoiceId) external {
        attackInvoiceId = invoiceId;
        attacking = true;
        FundingFacet(target).requestFunding(invoiceId);
    }

    receive() external payable {
        if (attacking) {
            attacking = false;
            FundingFacet(target).requestFunding(attackInvoiceId);
        }
    }
}

contract FlashLoanAttacker {
    address pool;
    address usdc;

    constructor(address _pool, address _usdc) {
        pool = _pool;
        usdc = _usdc;
    }

    function attack(uint256 amount) external {
        // Simulate flash loan
        // Deposit huge amount
        IERC20(usdc).approve(pool, amount);
        LiquidityPool(pool).deposit(amount, address(this));

        // Immediately withdraw
        uint256 shares = LiquidityPool(pool).balanceOf(address(this));
        LiquidityPool(pool).redeem(shares, address(this), address(this));
    }
}
```

---

## Test Infrastructure

### CI/CD Configuration

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  contracts:
    name: Smart Contract Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive

      - name: Install Foundry
        uses: foundry-rs/foundry-toolchain@v1

      - name: Run tests
        working-directory: ./contracts
        run: forge test -vvv

      - name: Run coverage
        working-directory: ./contracts
        run: forge coverage --report lcov

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./contracts/lcov.info

  backend:
    name: Backend Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        working-directory: ./backend
        run: npm ci

      - name: Run tests
        working-directory: ./backend
        run: npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: [contracts, backend]
    steps:
      - uses: actions/checkout@v4

      - name: Start local node
        run: |
          anvil --fork-url ${{ secrets.BASE_SEPOLIA_RPC }} &
          sleep 5

      - name: Deploy contracts
        working-directory: ./contracts
        run: forge script script/Deploy.s.sol --rpc-url http://localhost:8545

      - name: Run E2E tests
        working-directory: ./backend
        run: npm run test:e2e
```

---

## Implementation Plan

| Phase | Tasks | Duration |
|-------|-------|----------|
| **Phase 1** | Enhanced unit tests, edge cases | 1 week |
| **Phase 2** | Fuzz testing, invariant tests | 1 week |
| **Phase 3** | Fork testing, security tests | 1 week |
| **Phase 4** | Backend unit tests | 1 week |
| **Phase 5** | E2E tests, CI/CD setup | 1 week |
| **Total** | | **5 weeks** |

---

## References

- [Foundry Book - Testing](https://book.getfoundry.sh/forge/tests)
- [Foundry Book - Fuzz Testing](https://book.getfoundry.sh/forge/fuzz-testing)
- [Foundry Book - Invariant Testing](https://book.getfoundry.sh/forge/invariant-testing)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Viem Testing Guide](https://viem.sh/docs/actions/test/introduction)
