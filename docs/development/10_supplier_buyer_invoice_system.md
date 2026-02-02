# 10. Supplier and Buyer Invoice Financing System

## Overview

Implementation of the core invoice financing system for suppliers and buyers, using the **Diamond Proxy (EIP-2535)** pattern for extensibility. The system integrates with the existing LiquidityPool infrastructure to provide early payment for suppliers and manage repayments from buyers.

## Architecture

### Diamond Proxy Pattern

The invoice system uses EIP-2535 (Diamond Standard) for modular contract architecture:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        InvoiceDiamond.sol                                    │
│  (Proxy with facet routing via fallback)                                    │
│  Storage: keccak256("seedfinance.invoice.diamond.storage")                  │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────────────┐
        ▼                       ▼                               ▼
┌───────────────┐    ┌───────────────────┐    ┌────────────────────┐
│ Core Facets   │    │ Admin Facets      │    │ Future Facets      │
├───────────────┤    ├───────────────────┤    ├────────────────────┤
│InvoiceFacet   │    │AdminFacet         │    │PenaltyFacet        │
│FundingFacet   │    │                   │    │RebateFacet         │
│RepaymentFacet │    │                   │    │ExtensionFacet      │
│ViewFacet      │    │                   │    │                    │
└───────────────┘    └───────────────────┘    └────────────────────┘
```

### Invoice Lifecycle

```
1. CREATION (Supplier)
   Supplier → InvoiceFacet.createInvoice()
   → Invoice stored with status: Pending

2. APPROVAL (Buyer)
   Buyer → InvoiceFacet.approveInvoice()
   → Invoice status: Approved

3. FUNDING (Operator)
   Operator → FundingFacet.requestFunding()
   → ExecutionPool.fundInvoice()
   → LiquidityPool.deployForFunding()
   → USDC transferred to Supplier
   → Invoice status: Funded

4. REPAYMENT (Buyer at maturity)
   Buyer → RepaymentFacet.processRepayment()
   → USDC from Buyer → ExecutionPool
   → ExecutionPool → LiquidityPool.receiveRepayment()
   → Invoice status: Paid
```

## Files Created

### Smart Contracts

| File | Description |
|------|-------------|
| `contracts/src/invoice/libraries/LibInvoiceStorage.sol` | Diamond storage pattern with Invoice struct |
| `contracts/src/invoice/interfaces/IInvoiceDiamond.sol` | Combined interface for all facets |
| `contracts/src/invoice/facets/InvoiceFacet.sol` | Create, approve, cancel invoices |
| `contracts/src/invoice/facets/FundingFacet.sol` | Request funding, batch fund |
| `contracts/src/invoice/facets/RepaymentFacet.sol` | Process repayments, mark defaulted |
| `contracts/src/invoice/facets/ViewFacet.sol` | Read-only queries |
| `contracts/src/invoice/facets/AdminFacet.sol` | Configuration and access control |
| `contracts/src/invoice/InvoiceDiamond.sol` | Main Diamond proxy with facet routing |
| `contracts/src/invoice/ExecutionPool.sol` | USDC handling for funding/repayment |

### Contract Tests

| File | Tests |
|------|-------|
| `contracts/test/InvoiceFacet.t.sol` | 19 tests - invoice lifecycle |
| `contracts/test/ExecutionPool.t.sol` | 16 tests - funding and repayment |
| `contracts/test/integration/InvoiceLifecycle.t.sol` | 5 tests - full lifecycle integration |

### Backend Services

| File | Description |
|------|-------------|
| `backend/types/invoice.ts` | TypeScript types for invoices |
| `backend/services/InvoiceService.ts` | Invoice CRUD operations |
| `backend/services/FundingService.ts` | Funding request operations |
| `backend/services/RepaymentService.ts` | Repayment processing |

### Frontend

| File | Description |
|------|-------------|
| `frontend/abis/InvoiceDiamond.ts` | ABI for all invoice facets |
| `frontend/hooks/invoice/useInvoice.ts` | Single invoice read hooks |
| `frontend/hooks/invoice/useInvoiceList.ts` | Invoice list hooks |
| `frontend/hooks/invoice/useInvoiceActions.ts` | Write action hooks |
| `frontend/hooks/invoice/index.ts` | Exports |
| `frontend/app/dashboard/supplier/layout.tsx` | Supplier layout |
| `frontend/app/dashboard/supplier/page.tsx` | Supplier dashboard |
| `frontend/app/dashboard/supplier/invoices/page.tsx` | Invoice list |
| `frontend/app/dashboard/supplier/invoices/create/page.tsx` | Create invoice form |
| `frontend/app/dashboard/buyer/layout.tsx` | Buyer layout |
| `frontend/app/dashboard/buyer/page.tsx` | Buyer dashboard |
| `frontend/app/dashboard/buyer/invoices/page.tsx` | Pending approvals |
| `frontend/app/dashboard/buyer/repayments/page.tsx` | Repayment list |

### Configuration Updates

| File | Changes |
|------|---------|
| `frontend/lib/config/types.ts` | Added `invoiceDiamond` and `executionPool` to ContractAddresses |
| `frontend/lib/config/contracts.ts` | Added contract address mappings and env var support |

## Key Implementation Details

### Diamond Storage Pattern

```solidity
library LibInvoiceStorage {
    bytes32 constant STORAGE_SLOT = keccak256("seedfinance.invoice.diamond.storage");

    enum InvoiceStatus { Pending, Approved, Funded, Paid, Cancelled, Defaulted }

    struct Invoice {
        address buyer;           // 20 bytes
        address supplier;        // 20 bytes
        uint128 faceValue;       // 16 bytes
        uint128 fundingAmount;   // 16 bytes
        uint64 maturityDate;     // 8 bytes
        uint64 createdAt;        // 8 bytes
        uint64 fundedAt;         // 8 bytes
        uint64 paidAt;           // 8 bytes
        uint16 discountRateBps;  // 2 bytes
        InvoiceStatus status;    // 1 byte
        bytes32 invoiceHash;     // IPFS CID
        bytes32 externalId;      // External reference
    }

    struct Storage {
        mapping(uint256 => Invoice) invoices;
        mapping(address => uint256[]) supplierInvoices;
        mapping(address => uint256[]) buyerInvoices;
        uint256 nextInvoiceId;
        uint256 totalFunded;
        uint256 totalRepaid;
        address executionPool;
        address liquidityPool;
        address usdc;
        address owner;
        mapping(address => bool) operators;
    }
}
```

### Discount Calculation

Simple interest formula:
```
discount = faceValue × (discountRateBps / 10000) × (secondsToMaturity / 365 days)
fundingAmount = faceValue - discount
```

### Access Control

- **Owner**: Full admin access, can add operators
- **Operators**: Can trigger funding operations
- **Suppliers**: Can create and cancel pending invoices
- **Buyers**: Can approve invoices and process repayments

## Testing

All 140 tests pass:

```bash
cd contracts && forge test --summary

╭----------------------+--------+--------+---------╮
| Test Suite           | Passed | Failed | Skipped |
+==================================================+
| InvoiceFacetTest     | 19     | 0      | 0       |
| ExecutionPoolTest    | 16     | 0      | 0       |
| InvoiceLifecycleTest | 5      | 0      | 0       |
| ... (other tests)    | ...    | ...    | ...     |
╰----------------------+--------+--------+---------╯
```

### Key Integration Test: Full Invoice Lifecycle

1. LP deposits 100,000 USDC
2. Supplier creates invoice (10,000 USDC face value, 5% discount, 30 days)
3. Buyer approves invoice
4. Operator triggers funding → Supplier receives ~9,958 USDC
5. Time warps to maturity
6. Buyer repays 10,000 USDC
7. LP withdraws → receives 100,041 USDC (original + yield)

## Deployment

### Environment Variables

```env
NEXT_PUBLIC_INVOICE_DIAMOND_ADDRESS=0x...
NEXT_PUBLIC_EXECUTION_POOL_ADDRESS=0x...
```

### Deployment Order

1. Deploy all facets (InvoiceFacet, FundingFacet, RepaymentFacet, ViewFacet, AdminFacet)
2. Deploy InvoiceDiamond with facet addresses
3. Deploy ExecutionPool with (USDC, InvoiceDiamond, LiquidityPool)
4. Call AdminFacet.initialize() to set executionPool, liquidityPool, USDC
5. Grant ROUTER_ROLE on LiquidityPool to ExecutionPool
6. Add backend address as operator

## Future Extensions

The Diamond pattern allows adding new facets without redeployment:

- **PenaltyFacet**: Late payment penalties
- **RebateFacet**: Early payment rebates
- **ExtensionFacet**: Payment date extensions
- **BuybackFacet**: Protocol buyback mechanism

Each extension uses isolated Diamond Storage slots to prevent collision.

## Status

**Implemented**: 2026-02-02
