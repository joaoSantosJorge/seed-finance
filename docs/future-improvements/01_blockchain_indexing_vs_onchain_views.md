# 01. Blockchain Indexing vs On-Chain View Functions

## Executive Summary

The current `ViewFacet.sol` implementation uses on-chain Solidity view functions with O(n) array iteration for querying invoice data. While functional for MVP, this approach has significant scalability limitations. This document analyzes the current implementation, identifies problems, and recommends a migration path to off-chain indexing solutions.

---

## Table of Contents

1. [Current Implementation Analysis](#current-implementation-analysis)
2. [Problems & Limitations](#problems--limitations)
3. [Alternative Solutions](#alternative-solutions)
4. [Comparison Matrix](#comparison-matrix)
5. [Recommended Migration Path](#recommended-migration-path)
6. [Implementation Guide](#implementation-guide)
7. [Cost Analysis](#cost-analysis)
8. [References](#references)

---

## Current Implementation Analysis

### ViewFacet.sol Overview

**Location:** `contracts/src/invoice/facets/ViewFacet.sol`

The ViewFacet is part of the Invoice Diamond proxy (EIP-2535) and provides read-only query functions for invoice data.

### Function Inventory

| Function | Complexity | Gas Cost (est.) | Scalability |
|----------|------------|-----------------|-------------|
| `getInvoice(uint256)` | O(1) | ~2,500 | Excellent |
| `getSupplierInvoices(address)` | O(1) | ~2,500 | Excellent |
| `getBuyerInvoices(address)` | O(1) | ~2,500 | Excellent |
| `getPendingApprovals(address)` | O(n) | ~5,000 + 200*n | Poor |
| `getUpcomingRepayments(address)` | O(n) | ~5,000 + 200*n | Poor |
| `getStats()` | O(1) | ~2,500 | Excellent |
| `getContractAddresses()` | O(1) | ~2,500 | Excellent |
| `isOperator(address)` | O(1) | ~2,500 | Excellent |
| `owner()` | O(1) | ~2,500 | Excellent |

### Problematic Code Patterns

#### Pattern 1: Double Iteration for Filtering

```solidity
function getPendingApprovals(address buyer) external view returns (uint256[] memory invoiceIds) {
    LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
    uint256[] storage allInvoices = s.buyerInvoices[buyer];

    // PROBLEM: First pass - count pending (O(n))
    uint256 pendingCount = 0;
    for (uint256 i = 0; i < allInvoices.length; i++) {
        if (s.invoices[allInvoices[i]].status == LibInvoiceStorage.InvoiceStatus.Pending) {
            pendingCount++;
        }
    }

    // PROBLEM: Second pass - build array (O(n))
    invoiceIds = new uint256[](pendingCount);
    uint256 j = 0;
    for (uint256 i = 0; i < allInvoices.length; i++) {
        if (s.invoices[allInvoices[i]].status == LibInvoiceStorage.InvoiceStatus.Pending) {
            invoiceIds[j++] = allInvoices[i];
        }
    }
}
```

**Why this exists:** Solidity memory arrays require a fixed size at creation. Without knowing how many items match the filter, we must count first, then allocate.

#### Pattern 2: No Pagination

All list functions return complete arrays with no limit/offset parameters:

```solidity
// Returns ALL invoices - problematic at scale
function getSupplierInvoices(address supplier) external view returns (uint256[] memory invoiceIds) {
    return s.supplierInvoices[supplier];
}
```

### Current Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CURRENT ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Frontend (React)                                                            │
│       │                                                                      │
│       ▼                                                                      │
│  wagmi/viem hooks                                                            │
│       │                                                                      │
│       ▼                                                                      │
│  JSON-RPC call (eth_call)                                                    │
│       │                                                                      │
│       ▼                                                                      │
│  Base L2 Node                                                                │
│       │                                                                      │
│       ▼                                                                      │
│  ViewFacet.sol ──► Diamond Storage ──► Return Data                          │
│       │                                                                      │
│       │ (O(n) iteration for filtered queries)                               │
│       │                                                                      │
│       ▼                                                                      │
│  Response to Frontend                                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Problems & Limitations

### 1. O(n) Array Iteration

**Problem:** Functions like `getPendingApprovals()` iterate through ALL buyer invoices to filter by status.

**Impact by Scale:**

| Invoices per Buyer | Iterations | Estimated Gas | Response Time |
|-------------------|------------|---------------|---------------|
| 10 | 20 | ~9,000 | <100ms |
| 100 | 200 | ~45,000 | ~200ms |
| 1,000 | 2,000 | ~405,000 | ~2s |
| 10,000 | 20,000 | ~4,005,000 | ~20s |
| 100,000 | 200,000 | Timeout | Fails |

**Real-world scenario:** A large buyer (e.g., Walmart) might have 100,000+ invoices from various suppliers. Current implementation would timeout or fail.

### 2. No Historical Queries

**Problem:** Solidity views can only read current blockchain state.

**Impossible queries:**
- "Show invoices created in the last 30 days"
- "Show payment history for Q4 2025"
- "Compare this month's funding vs last month"
- "Show invoices that were overdue but are now paid"

**Why this matters:** Financial applications require extensive historical reporting for audits, analytics, and compliance.

### 3. No Complex Filtering

**Problem:** Can't combine multiple filter criteria efficiently.

**Impossible queries:**
```sql
-- Find high-value overdue invoices for a specific buyer
SELECT * FROM invoices
WHERE buyer = '0x...'
  AND status = 'Funded'
  AND face_value > 100000
  AND maturity_date < NOW()
ORDER BY face_value DESC
LIMIT 10;
```

**Current workaround:** Fetch ALL invoices to frontend, filter in JavaScript. Wasteful and slow.

### 4. No Aggregations

**Problem:** Can't compute SUM, AVG, COUNT, GROUP BY on-chain efficiently.

**Impossible queries:**
- "Total value of pending invoices by buyer"
- "Average discount rate by supplier"
- "Monthly funding volume trends"
- "Top 10 suppliers by funded amount"

**Current partial solution:** `getStats()` provides pre-computed totals, but can't slice by dimensions.

### 5. Gas Limits on Internal Calls

**Problem:** When another contract calls ViewFacet, it pays gas for the iteration.

```solidity
// In another contract - THIS COSTS GAS
uint256[] memory pending = invoiceDiamond.getPendingApprovals(buyer);
// With 1000 invoices, this could cost 400k+ gas
```

**Impact:** Composability is limited. Other contracts can't efficiently query invoice data.

### 6. Memory Array Size Limitations

**Problem:** Solidity memory arrays have practical size limits.

```solidity
// This could fail with out-of-gas for large arrays
invoiceIds = new uint256[](pendingCount);
```

**EVM constraint:** Memory expansion costs grow quadratically. Arrays >10,000 elements become prohibitively expensive.

### 7. No Real-Time Updates

**Problem:** Polling is required to detect changes.

**Current approach:**
```typescript
// Frontend polls every 30 seconds
useReadContract({
  refetchInterval: 30000, // 30s delay to see changes
});
```

**Better approach:** WebSocket subscriptions to events for instant updates.

### 8. No Full-Text Search

**Problem:** Can't search invoice metadata.

**Impossible queries:**
- "Find invoices with external ID containing 'INV-2025'"
- "Search invoices by supplier name"
- "Find invoices with specific invoice hash"

---

## Alternative Solutions

### 1. The Graph (Subgraphs)

**Overview:** Decentralized indexing protocol that listens to contract events and builds a GraphQL-queryable database.

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     THE GRAPH ARCHITECTURE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Smart Contracts (emit events)                                               │
│       │                                                                      │
│       ▼                                                                      │
│  Graph Node (listens to events)                                              │
│       │                                                                      │
│       ▼                                                                      │
│  Subgraph Mappings (AssemblyScript)                                          │
│       │                                                                      │
│       ▼                                                                      │
│  PostgreSQL (indexed data)                                                   │
│       │                                                                      │
│       ▼                                                                      │
│  GraphQL API                                                                 │
│       │                                                                      │
│       ▼                                                                      │
│  Frontend queries via Apollo/urql                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Example Subgraph Schema:**

```graphql
# schema.graphql
type Invoice @entity {
  id: ID!
  invoiceId: BigInt!
  buyer: Bytes!
  supplier: Bytes!
  faceValue: BigInt!
  fundingAmount: BigInt
  discountRateBps: Int!
  maturityDate: BigInt!
  status: InvoiceStatus!
  createdAt: BigInt!
  fundedAt: BigInt
  paidAt: BigInt
  invoiceHash: Bytes!
  externalId: Bytes!

  # Derived fields
  isOverdue: Boolean!
  daysUntilMaturity: Int!
}

enum InvoiceStatus {
  Pending
  Approved
  Funded
  Paid
  Cancelled
  Defaulted
}

type Supplier @entity {
  id: ID!
  address: Bytes!
  invoices: [Invoice!]! @derivedFrom(field: "supplier")
  totalFunded: BigInt!
  totalPaid: BigInt!
  invoiceCount: Int!
}

type Buyer @entity {
  id: ID!
  address: Bytes!
  invoices: [Invoice!]! @derivedFrom(field: "buyer")
  totalOwed: BigInt!
  overdueCount: Int!
}

type DailyStats @entity {
  id: ID!
  date: Int!
  invoicesCreated: Int!
  invoicesFunded: Int!
  invoicesPaid: Int!
  volumeFunded: BigInt!
  volumeRepaid: BigInt!
}
```

**Example Queries:**

```graphql
# Complex filtered query - impossible on-chain
query GetOverdueHighValueInvoices($buyer: Bytes!, $minValue: BigInt!) {
  invoices(
    where: {
      buyer: $buyer
      status: Funded
      faceValue_gte: $minValue
      maturityDate_lt: $currentTimestamp
    }
    orderBy: faceValue
    orderDirection: desc
    first: 10
  ) {
    id
    invoiceId
    supplier
    faceValue
    maturityDate
    daysOverdue
  }
}

# Aggregation query
query GetSupplierStats($supplier: Bytes!) {
  supplier(id: $supplier) {
    totalFunded
    totalPaid
    invoiceCount
    invoices(where: { status: Pending }) {
      id
      faceValue
    }
  }
}

# Historical query
query GetMonthlyVolume($startDate: Int!, $endDate: Int!) {
  dailyStats(
    where: { date_gte: $startDate, date_lte: $endDate }
    orderBy: date
  ) {
    date
    volumeFunded
    volumeRepaid
    invoicesFunded
  }
}
```

**Pros:**
- GraphQL with filtering, sorting, pagination
- Historical data access
- Decentralized (no single point of failure)
- Event handlers are efficient
- Active ecosystem and tooling

**Cons:**
- Sync delay (15-60 seconds typically)
- Additional infrastructure cost ($50-500/month)
- Need to emit events for all state changes
- AssemblyScript learning curve
- Subgraph deployment/maintenance overhead

### 2. Ponder

**Overview:** TypeScript-first blockchain indexer optimized for developer experience.

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PONDER ARCHITECTURE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Smart Contracts (emit events)                                               │
│       │                                                                      │
│       ▼                                                                      │
│  Ponder Sync Engine (TypeScript)                                             │
│       │                                                                      │
│       ▼                                                                      │
│  SQLite/PostgreSQL                                                           │
│       │                                                                      │
│       ▼                                                                      │
│  Auto-generated GraphQL API                                                  │
│       │                                                                      │
│       ▼                                                                      │
│  Frontend                                                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Example Ponder Config:**

```typescript
// ponder.config.ts
import { createConfig } from "@ponder/core";
import { http } from "viem";
import { InvoiceDiamondAbi } from "./abis/InvoiceDiamond";

export default createConfig({
  networks: {
    base: {
      chainId: 8453,
      transport: http(process.env.PONDER_RPC_URL_8453),
    },
  },
  contracts: {
    InvoiceDiamond: {
      network: "base",
      abi: InvoiceDiamondAbi,
      address: "0x...",
      startBlock: 1234567,
    },
  },
});
```

```typescript
// src/index.ts
import { ponder } from "@/generated";

ponder.on("InvoiceDiamond:InvoiceCreated", async ({ event, context }) => {
  const { Invoice, Supplier, Buyer } = context.db;

  await Invoice.create({
    id: event.args.invoiceId.toString(),
    invoiceId: event.args.invoiceId,
    buyer: event.args.buyer,
    supplier: event.args.supplier,
    faceValue: event.args.faceValue,
    discountRateBps: event.args.discountRateBps,
    maturityDate: event.args.maturityDate,
    status: "Pending",
    createdAt: event.block.timestamp,
  });

  // Update supplier stats
  await Supplier.upsert({
    id: event.args.supplier,
    create: { address: event.args.supplier, invoiceCount: 1, totalFunded: 0n },
    update: ({ current }) => ({ invoiceCount: current.invoiceCount + 1 }),
  });
});

ponder.on("InvoiceDiamond:InvoiceFunded", async ({ event, context }) => {
  await context.db.Invoice.update({
    id: event.args.invoiceId.toString(),
    data: {
      status: "Funded",
      fundingAmount: event.args.fundingAmount,
      fundedAt: event.block.timestamp,
    },
  });
});
```

**Pros:**
- TypeScript (same language as frontend/backend)
- Hot reloading during development
- Type-safe database queries
- Excellent local development experience
- Lower learning curve than The Graph

**Cons:**
- Centralized (self-hosted)
- Newer, smaller ecosystem
- No decentralized option
- Need to manage infrastructure

### 3. Envio HyperIndex

**Overview:** High-performance indexer with <1 second latency.

**Key Features:**
- Real-time indexing (sub-second latency)
- Automatic reorg handling
- TypeScript/ReScript handlers
- Hosted and self-hosted options

**Example Config:**

```yaml
# config.yaml
name: seed-finance-indexer
networks:
  - id: 8453
    rpc_config:
      url: https://mainnet.base.org
    start_block: 1234567
    contracts:
      - name: InvoiceDiamond
        address: "0x..."
        handler: src/handlers/invoice.ts
        events:
          - event: InvoiceCreated(uint256 indexed invoiceId, address indexed buyer, address indexed supplier, uint256 faceValue, uint256 maturityDate)
          - event: InvoiceApproved(uint256 indexed invoiceId, address indexed buyer)
          - event: InvoiceFunded(uint256 indexed invoiceId, uint256 fundingAmount)
          - event: InvoicePaid(uint256 indexed invoiceId, uint256 amountPaid)
```

**Pros:**
- Fastest sync times (<1s)
- Excellent for real-time applications
- Good documentation
- Hosted option available

**Cons:**
- Less mature than The Graph
- Smaller community
- Hosted version has usage limits

### 4. Goldsky

**Overview:** Enterprise-grade indexing with Mirror pipelines.

**Key Features:**
- Subgraph compatibility (can migrate from The Graph)
- Mirror for real-time data streaming
- Dedicated infrastructure
- 99.9% uptime SLA

**Pros:**
- Production-ready, enterprise support
- Can import existing subgraphs
- Real-time streaming option
- Managed infrastructure

**Cons:**
- Higher cost ($500+/month for production)
- Less suitable for small projects
- Vendor lock-in concerns

### 5. SQL-Based Solutions (Dune, Space and Time)

**Overview:** Query blockchain data using familiar SQL.

**Example Dune Query:**

```sql
-- Monthly invoice volume on Seed Finance
SELECT
  date_trunc('month', block_time) as month,
  COUNT(*) as invoice_count,
  SUM(face_value / 1e6) as total_volume_usdc,
  AVG(discount_rate_bps / 100.0) as avg_discount_pct
FROM seed_finance.invoice_created
WHERE block_time >= NOW() - INTERVAL '12 months'
GROUP BY 1
ORDER BY 1 DESC;
```

**Pros:**
- Familiar SQL syntax
- Great for analytics/dashboards
- No code deployment needed
- Built-in visualization

**Cons:**
- Not suitable for application backends
- Query latency (seconds to minutes)
- Cost per query
- Limited real-time capability

### 6. Hybrid Approach (Recommended)

**Overview:** Keep simple O(1) views on-chain, move complex queries to indexer.

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     HYBRID ARCHITECTURE (RECOMMENDED)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐     ┌─────────────────────────────────────────┐   │
│  │   On-Chain Views    │     │         Off-Chain Indexer              │   │
│  │   (ViewFacet.sol)   │     │         (The Graph/Ponder)              │   │
│  ├─────────────────────┤     ├─────────────────────────────────────────┤   │
│  │ • getInvoice(id)    │     │ • getPendingApprovals(buyer, limit)    │   │
│  │ • getStats()        │     │ • getUpcomingRepayments(filters)       │   │
│  │ • owner()           │     │ • getInvoiceHistory(dateRange)         │   │
│  │ • isOperator()      │     │ • getSupplierAnalytics()               │   │
│  │                     │     │ • getBuyerDashboard()                  │   │
│  │ O(1) lookups only   │     │ • searchInvoices(query)                │   │
│  └─────────────────────┘     │ • getMonthlyVolume()                   │   │
│           │                  │                                         │   │
│           │                  │ Complex filtering, sorting, pagination │   │
│           ▼                  └─────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Frontend                                     │   │
│  │  • Single invoice: On-chain (always fresh)                          │   │
│  │  • Lists/filters: Indexer (fast, complex queries)                   │   │
│  │  • Real-time: WebSocket to indexer                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Comparison Matrix

| Criteria | On-Chain Views | The Graph | Ponder | Envio | Goldsky |
|----------|---------------|-----------|--------|-------|---------|
| **Query Complexity** | Simple only | Complex | Complex | Complex | Complex |
| **Latency** | Instant | 15-60s | 5-30s | <1s | 5-30s |
| **Historical Data** | No | Yes | Yes | Yes | Yes |
| **Aggregations** | Limited | Yes | Yes | Yes | Yes |
| **Cost (monthly)** | $0 | $50-500 | $20-200 | $50-300 | $500+ |
| **Decentralized** | Yes | Yes | No | No | No |
| **TypeScript** | No | No (AS) | Yes | Yes | No (AS) |
| **Learning Curve** | Low | Medium | Low | Low | Medium |
| **Ecosystem** | N/A | Large | Growing | Growing | Medium |
| **Best For** | Simple lookups | DApps | Dev teams | Real-time | Enterprise |

---

## Recommended Migration Path

### Phase 1: Immediate (Week 1-2)

**Goal:** Add pagination to existing views, prepare for indexer.

**Changes to ViewFacet.sol:**

```solidity
// Add pagination to problematic functions
function getPendingApprovalsPaginated(
    address buyer,
    uint256 offset,
    uint256 limit
) external view returns (
    uint256[] memory invoiceIds,
    uint256 total,
    bool hasMore
) {
    LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
    uint256[] storage allInvoices = s.buyerInvoices[buyer];

    // Count pending (still O(n) but only once)
    uint256 pendingCount = 0;
    for (uint256 i = 0; i < allInvoices.length; i++) {
        if (s.invoices[allInvoices[i]].status == LibInvoiceStorage.InvoiceStatus.Pending) {
            pendingCount++;
        }
    }

    total = pendingCount;
    hasMore = offset + limit < pendingCount;

    // Calculate actual return size
    uint256 returnSize = limit;
    if (offset >= pendingCount) {
        returnSize = 0;
    } else if (offset + limit > pendingCount) {
        returnSize = pendingCount - offset;
    }

    invoiceIds = new uint256[](returnSize);
    uint256 found = 0;
    uint256 added = 0;

    for (uint256 i = 0; i < allInvoices.length && added < returnSize; i++) {
        if (s.invoices[allInvoices[i]].status == LibInvoiceStorage.InvoiceStatus.Pending) {
            if (found >= offset) {
                invoiceIds[added++] = allInvoices[i];
            }
            found++;
        }
    }
}
```

**Ensure all events are emitted:**

```solidity
// Verify these events exist and are emitted
event InvoiceCreated(
    uint256 indexed invoiceId,
    address indexed buyer,
    address indexed supplier,
    uint256 faceValue,
    uint256 discountRateBps,
    uint256 maturityDate,
    bytes32 invoiceHash,
    bytes32 externalId
);

event InvoiceApproved(uint256 indexed invoiceId, address indexed buyer, uint256 approvedAt);
event InvoiceFunded(uint256 indexed invoiceId, uint256 fundingAmount, uint256 fundedAt);
event InvoicePaid(uint256 indexed invoiceId, uint256 amountPaid, uint256 paidAt);
event InvoiceCancelled(uint256 indexed invoiceId, address cancelledBy);
event InvoiceDefaulted(uint256 indexed invoiceId, uint256 defaultedAt);
```

### Phase 2: Indexer Setup (Week 3-4)

**Goal:** Deploy The Graph subgraph or Ponder indexer.

**Recommended:** Start with Ponder for faster development, migrate to The Graph for decentralization later.

**Ponder Setup:**

```bash
# Create Ponder project
npm create ponder@latest seed-finance-indexer
cd seed-finance-indexer

# Configure for Base
# Edit ponder.config.ts with InvoiceDiamond address

# Start development
npm run dev
```

### Phase 3: Frontend Migration (Week 5-6)

**Goal:** Update frontend hooks to use indexer for complex queries.

**New hook structure:**

```typescript
// hooks/invoice/useInvoiceIndexed.ts
import { useQuery } from '@tanstack/react-query';
import { gql, request } from 'graphql-request';

const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL;

const GET_PENDING_APPROVALS = gql`
  query GetPendingApprovals($buyer: Bytes!, $first: Int!, $skip: Int!) {
    invoices(
      where: { buyer: $buyer, status: Pending }
      orderBy: createdAt
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      invoiceId
      supplier
      faceValue
      discountRateBps
      maturityDate
      createdAt
    }
  }
`;

export function usePendingApprovalsIndexed(
  buyer: string | undefined,
  page: number = 0,
  pageSize: number = 10
) {
  return useQuery({
    queryKey: ['pendingApprovals', buyer, page, pageSize],
    queryFn: async () => {
      if (!buyer) return { invoices: [], total: 0 };

      const data = await request(SUBGRAPH_URL, GET_PENDING_APPROVALS, {
        buyer: buyer.toLowerCase(),
        first: pageSize,
        skip: page * pageSize,
      });

      return data;
    },
    enabled: !!buyer,
    staleTime: 10000, // 10 seconds
  });
}
```

### Phase 4: Deprecate O(n) Views (Week 7-8)

**Goal:** Remove iteration-based views, keep only O(1) lookups.

**Final ViewFacet.sol:**

```solidity
contract ViewFacet {
    // KEEP: O(1) lookups
    function getInvoice(uint256 invoiceId) external view returns (InvoiceView memory);
    function getStats() external view returns (uint256, uint256, uint256, uint256);
    function getContractAddresses() external view returns (address, address, address);
    function isOperator(address addr) external view returns (bool);
    function owner() external view returns (address);

    // KEEP: Simple array returns (no filtering)
    function getSupplierInvoiceIds(address supplier) external view returns (uint256[] memory);
    function getBuyerInvoiceIds(address buyer) external view returns (uint256[] memory);

    // REMOVED: O(n) filtering - use indexer instead
    // function getPendingApprovals() - DEPRECATED
    // function getUpcomingRepayments() - DEPRECATED
}
```

---

## Implementation Guide

### The Graph Subgraph Implementation

**1. Create subgraph project:**

```bash
graph init --product hosted-service seed-finance/invoices
cd invoices
```

**2. Define schema (schema.graphql):**

```graphql
type Invoice @entity {
  id: ID!
  invoiceId: BigInt!
  buyer: Buyer!
  supplier: Supplier!
  faceValue: BigInt!
  fundingAmount: BigInt
  discountRateBps: Int!
  maturityDate: BigInt!
  status: InvoiceStatus!
  createdAt: BigInt!
  fundedAt: BigInt
  paidAt: BigInt
  invoiceHash: Bytes!
  externalId: Bytes!
  createdAtBlock: BigInt!
  createdAtTx: Bytes!
}

type Buyer @entity {
  id: ID!
  address: Bytes!
  invoices: [Invoice!]! @derivedFrom(field: "buyer")
  totalOwed: BigInt!
  totalPaid: BigInt!
  pendingCount: Int!
  fundedCount: Int!
  paidCount: Int!
}

type Supplier @entity {
  id: ID!
  address: Bytes!
  invoices: [Invoice!]! @derivedFrom(field: "supplier")
  totalFunded: BigInt!
  totalReceived: BigInt!
  invoiceCount: Int!
  avgDiscountRate: BigDecimal!
}

type DailySnapshot @entity {
  id: ID!
  date: Int!
  invoicesCreated: Int!
  invoicesFunded: Int!
  invoicesPaid: Int!
  volumeCreated: BigInt!
  volumeFunded: BigInt!
  volumePaid: BigInt!
  activeInvoices: Int!
  totalValueLocked: BigInt!
}

type ProtocolStats @entity {
  id: ID!
  totalInvoices: Int!
  totalFunded: BigInt!
  totalRepaid: BigInt!
  totalYieldGenerated: BigInt!
  activeInvoices: Int!
  uniqueBuyers: Int!
  uniqueSuppliers: Int!
}

enum InvoiceStatus {
  Pending
  Approved
  Funded
  Paid
  Cancelled
  Defaulted
}
```

**3. Write mappings (src/mapping.ts):**

```typescript
import { BigInt, Address, Bytes } from "@graphprotocol/graph-ts";
import {
  InvoiceCreated,
  InvoiceApproved,
  InvoiceFunded,
  InvoicePaid,
  InvoiceCancelled,
  InvoiceDefaulted,
} from "../generated/InvoiceDiamond/InvoiceDiamond";
import { Invoice, Buyer, Supplier, DailySnapshot, ProtocolStats } from "../generated/schema";

const PROTOCOL_STATS_ID = "protocol";

function getOrCreateBuyer(address: Address): Buyer {
  let id = address.toHexString();
  let buyer = Buyer.load(id);

  if (!buyer) {
    buyer = new Buyer(id);
    buyer.address = address;
    buyer.totalOwed = BigInt.zero();
    buyer.totalPaid = BigInt.zero();
    buyer.pendingCount = 0;
    buyer.fundedCount = 0;
    buyer.paidCount = 0;
    buyer.save();
  }

  return buyer;
}

function getOrCreateSupplier(address: Address): Supplier {
  let id = address.toHexString();
  let supplier = Supplier.load(id);

  if (!supplier) {
    supplier = new Supplier(id);
    supplier.address = address;
    supplier.totalFunded = BigInt.zero();
    supplier.totalReceived = BigInt.zero();
    supplier.invoiceCount = 0;
    supplier.save();
  }

  return supplier;
}

function getOrCreateProtocolStats(): ProtocolStats {
  let stats = ProtocolStats.load(PROTOCOL_STATS_ID);

  if (!stats) {
    stats = new ProtocolStats(PROTOCOL_STATS_ID);
    stats.totalInvoices = 0;
    stats.totalFunded = BigInt.zero();
    stats.totalRepaid = BigInt.zero();
    stats.totalYieldGenerated = BigInt.zero();
    stats.activeInvoices = 0;
    stats.uniqueBuyers = 0;
    stats.uniqueSuppliers = 0;
    stats.save();
  }

  return stats;
}

function getDayId(timestamp: BigInt): string {
  let dayTimestamp = timestamp.toI32() / 86400;
  return dayTimestamp.toString();
}

function getOrCreateDailySnapshot(timestamp: BigInt): DailySnapshot {
  let id = getDayId(timestamp);
  let snapshot = DailySnapshot.load(id);

  if (!snapshot) {
    snapshot = new DailySnapshot(id);
    snapshot.date = timestamp.toI32() / 86400 * 86400;
    snapshot.invoicesCreated = 0;
    snapshot.invoicesFunded = 0;
    snapshot.invoicesPaid = 0;
    snapshot.volumeCreated = BigInt.zero();
    snapshot.volumeFunded = BigInt.zero();
    snapshot.volumePaid = BigInt.zero();
    snapshot.activeInvoices = 0;
    snapshot.totalValueLocked = BigInt.zero();
    snapshot.save();
  }

  return snapshot;
}

export function handleInvoiceCreated(event: InvoiceCreated): void {
  let invoice = new Invoice(event.params.invoiceId.toString());

  let buyer = getOrCreateBuyer(event.params.buyer);
  let supplier = getOrCreateSupplier(event.params.supplier);

  invoice.invoiceId = event.params.invoiceId;
  invoice.buyer = buyer.id;
  invoice.supplier = supplier.id;
  invoice.faceValue = event.params.faceValue;
  invoice.discountRateBps = event.params.discountRateBps.toI32();
  invoice.maturityDate = event.params.maturityDate;
  invoice.status = "Pending";
  invoice.createdAt = event.block.timestamp;
  invoice.invoiceHash = event.params.invoiceHash;
  invoice.externalId = event.params.externalId;
  invoice.createdAtBlock = event.block.number;
  invoice.createdAtTx = event.transaction.hash;
  invoice.save();

  // Update buyer stats
  buyer.pendingCount = buyer.pendingCount + 1;
  buyer.save();

  // Update supplier stats
  supplier.invoiceCount = supplier.invoiceCount + 1;
  supplier.save();

  // Update protocol stats
  let stats = getOrCreateProtocolStats();
  stats.totalInvoices = stats.totalInvoices + 1;
  stats.save();

  // Update daily snapshot
  let daily = getOrCreateDailySnapshot(event.block.timestamp);
  daily.invoicesCreated = daily.invoicesCreated + 1;
  daily.volumeCreated = daily.volumeCreated.plus(event.params.faceValue);
  daily.save();
}

export function handleInvoiceApproved(event: InvoiceApproved): void {
  let invoice = Invoice.load(event.params.invoiceId.toString());
  if (!invoice) return;

  invoice.status = "Approved";
  invoice.save();
}

export function handleInvoiceFunded(event: InvoiceFunded): void {
  let invoice = Invoice.load(event.params.invoiceId.toString());
  if (!invoice) return;

  invoice.status = "Funded";
  invoice.fundingAmount = event.params.fundingAmount;
  invoice.fundedAt = event.block.timestamp;
  invoice.save();

  // Update buyer stats
  let buyer = Buyer.load(invoice.buyer);
  if (buyer) {
    buyer.pendingCount = buyer.pendingCount - 1;
    buyer.fundedCount = buyer.fundedCount + 1;
    buyer.totalOwed = buyer.totalOwed.plus(invoice.faceValue);
    buyer.save();
  }

  // Update supplier stats
  let supplier = Supplier.load(invoice.supplier);
  if (supplier) {
    supplier.totalFunded = supplier.totalFunded.plus(event.params.fundingAmount);
    supplier.save();
  }

  // Update protocol stats
  let stats = getOrCreateProtocolStats();
  stats.totalFunded = stats.totalFunded.plus(event.params.fundingAmount);
  stats.activeInvoices = stats.activeInvoices + 1;
  stats.save();

  // Update daily snapshot
  let daily = getOrCreateDailySnapshot(event.block.timestamp);
  daily.invoicesFunded = daily.invoicesFunded + 1;
  daily.volumeFunded = daily.volumeFunded.plus(event.params.fundingAmount);
  daily.activeInvoices = daily.activeInvoices + 1;
  daily.totalValueLocked = daily.totalValueLocked.plus(invoice.faceValue);
  daily.save();
}

export function handleInvoicePaid(event: InvoicePaid): void {
  let invoice = Invoice.load(event.params.invoiceId.toString());
  if (!invoice) return;

  invoice.status = "Paid";
  invoice.paidAt = event.block.timestamp;
  invoice.save();

  // Calculate yield
  let yield_ = invoice.faceValue.minus(invoice.fundingAmount!);

  // Update buyer stats
  let buyer = Buyer.load(invoice.buyer);
  if (buyer) {
    buyer.fundedCount = buyer.fundedCount - 1;
    buyer.paidCount = buyer.paidCount + 1;
    buyer.totalOwed = buyer.totalOwed.minus(invoice.faceValue);
    buyer.totalPaid = buyer.totalPaid.plus(event.params.amountPaid);
    buyer.save();
  }

  // Update supplier stats
  let supplier = Supplier.load(invoice.supplier);
  if (supplier) {
    supplier.totalReceived = supplier.totalReceived.plus(invoice.fundingAmount!);
    supplier.save();
  }

  // Update protocol stats
  let stats = getOrCreateProtocolStats();
  stats.totalRepaid = stats.totalRepaid.plus(event.params.amountPaid);
  stats.totalYieldGenerated = stats.totalYieldGenerated.plus(yield_);
  stats.activeInvoices = stats.activeInvoices - 1;
  stats.save();

  // Update daily snapshot
  let daily = getOrCreateDailySnapshot(event.block.timestamp);
  daily.invoicesPaid = daily.invoicesPaid + 1;
  daily.volumePaid = daily.volumePaid.plus(event.params.amountPaid);
  daily.activeInvoices = daily.activeInvoices - 1;
  daily.totalValueLocked = daily.totalValueLocked.minus(invoice.faceValue);
  daily.save();
}

export function handleInvoiceCancelled(event: InvoiceCancelled): void {
  let invoice = Invoice.load(event.params.invoiceId.toString());
  if (!invoice) return;

  let previousStatus = invoice.status;
  invoice.status = "Cancelled";
  invoice.save();

  // Update buyer stats if was pending
  if (previousStatus == "Pending") {
    let buyer = Buyer.load(invoice.buyer);
    if (buyer) {
      buyer.pendingCount = buyer.pendingCount - 1;
      buyer.save();
    }
  }
}

export function handleInvoiceDefaulted(event: InvoiceDefaulted): void {
  let invoice = Invoice.load(event.params.invoiceId.toString());
  if (!invoice) return;

  invoice.status = "Defaulted";
  invoice.save();

  // Update buyer stats
  let buyer = Buyer.load(invoice.buyer);
  if (buyer) {
    buyer.fundedCount = buyer.fundedCount - 1;
    buyer.save();
  }

  // Update protocol stats
  let stats = getOrCreateProtocolStats();
  stats.activeInvoices = stats.activeInvoices - 1;
  stats.save();
}
```

**4. Deploy subgraph:**

```bash
# Authenticate
graph auth --product hosted-service <ACCESS_TOKEN>

# Deploy
graph deploy --product hosted-service seed-finance/invoices
```

---

## Cost Analysis

### Current On-Chain Only

| Item | Cost |
|------|------|
| Contract deployment | One-time ~$50 |
| View function calls | $0 (free for EOA) |
| Monthly infrastructure | $0 |
| **Total Monthly** | **$0** |

### With The Graph (Hosted)

| Item | Cost |
|------|------|
| Subgraph deployment | Free |
| Query fees | ~$50-100/month for moderate usage |
| Development time | 40-60 hours |
| **Total Monthly** | **$50-100** |

### With The Graph (Decentralized)

| Item | Cost |
|------|------|
| GRT staking | ~$500-1000 one-time |
| Query fees | ~$100-300/month |
| Indexer rewards | Varies |
| **Total Monthly** | **$100-300** |

### With Ponder (Self-Hosted)

| Item | Cost |
|------|------|
| Server (2GB RAM) | ~$20/month |
| RPC calls | ~$50-100/month |
| Development time | 20-40 hours |
| **Total Monthly** | **$70-120** |

### ROI Analysis

| Metric | On-Chain Only | With Indexer |
|--------|---------------|--------------|
| Query response time | 100ms-20s | 50-200ms |
| Max invoices/buyer | ~1,000 | Unlimited |
| Complex queries | No | Yes |
| Historical data | No | Yes |
| Developer productivity | Low | High |
| User experience | Poor at scale | Excellent |

**Break-even:** At ~500 invoices per buyer, indexer ROI becomes positive due to:
- Faster queries = better UX = higher retention
- Complex queries = better analytics = better decisions
- Developer time saved on workarounds

---

## References

### Documentation
- [The Graph Documentation](https://thegraph.com/docs/)
- [Ponder Documentation](https://ponder.sh/docs)
- [Envio Documentation](https://docs.envio.dev/)
- [Goldsky Documentation](https://docs.goldsky.com/)

### Articles
- [Best Blockchain Indexers 2025](https://blog.ormilabs.com/best-blockchain-indexers-in-2025-real-time-web3-data-and-subgraph-platforms-compared/)
- [Solidity Gas Optimization](https://www.alchemy.com/overviews/solidity-gas-optimization)
- [Memory Array Building Pattern](https://fravoll.github.io/solidity-patterns/memory_array_building.html)
- [The Graph Chainlink Integration](https://thegraph.com/blog/the-graph-chainlink-oracles/)

### Tools
- [Graph Explorer](https://thegraph.com/explorer)
- [Subgraph Studio](https://thegraph.com/studio)
- [Ponder Playground](https://ponder.sh/playground)

---

## Appendix: Event Requirements

For any indexer to work, the smart contracts MUST emit events for all state changes. Current InvoiceFacet events:

```solidity
// Required events (verify these are emitted)
event InvoiceCreated(
    uint256 indexed invoiceId,
    address indexed buyer,
    address indexed supplier,
    uint256 faceValue,
    uint256 discountRateBps,
    uint256 maturityDate,
    bytes32 invoiceHash,
    bytes32 externalId
);

event InvoiceApproved(
    uint256 indexed invoiceId,
    address indexed buyer,
    uint256 approvedAt
);

event InvoiceFunded(
    uint256 indexed invoiceId,
    uint256 fundingAmount,
    uint256 fundedAt
);

event InvoicePaid(
    uint256 indexed invoiceId,
    uint256 amountPaid,
    uint256 paidAt
);

event InvoiceCancelled(
    uint256 indexed invoiceId,
    address cancelledBy
);

event InvoiceDefaulted(
    uint256 indexed invoiceId,
    uint256 defaultedAt
);
```

**Note:** If any events are missing indexed parameters or additional data, the contracts may need updating before deploying an indexer.
