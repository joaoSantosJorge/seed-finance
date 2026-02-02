# 03. Gas Optimization Improvements

## Executive Summary

This document identifies gas optimization opportunities across the Seed Finance smart contracts. Optimizations are prioritized by potential savings and implementation complexity. Total estimated savings: **15-30% reduction in average transaction costs**.

---

## Table of Contents

1. [Gas Cost Analysis](#gas-cost-analysis)
2. [High-Impact Optimizations](#high-impact-optimizations)
3. [Medium-Impact Optimizations](#medium-impact-optimizations)
4. [Low-Impact Optimizations](#low-impact-optimizations)
5. [Benchmarking Strategy](#benchmarking-strategy)
6. [Implementation Guide](#implementation-guide)

---

## Gas Cost Analysis

### Current Gas Usage by Operation

| Operation | Current Gas | Target Gas | Potential Savings |
|-----------|------------|------------|-------------------|
| Create Invoice | ~250,000 | ~200,000 | 20% |
| Approve Invoice | ~80,000 | ~65,000 | 19% |
| Fund Invoice | ~350,000 | ~280,000 | 20% |
| Repay Invoice | ~300,000 | ~250,000 | 17% |
| LP Deposit | ~150,000 | ~130,000 | 13% |
| LP Withdraw | ~180,000 | ~150,000 | 17% |
| Treasury Rebalance | ~500,000+ | ~350,000 | 30% |

### Gas Cost Breakdown by Contract

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     GAS COST DISTRIBUTION                                   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  InvoiceDiamond (per operation)                                            │
│  ├── Facet lookup via fallback: ~2,500 gas                                 │
│  ├── Storage reads (SLOAD): ~2,100 gas each                                │
│  ├── Storage writes (SSTORE): ~5,000-20,000 gas each                       │
│  ├── Event emissions: ~375 + 256*topics + 8*data_bytes                     │
│  └── External calls: ~2,600 + execution cost                               │
│                                                                             │
│  LiquidityPool (deposit)                                                    │
│  ├── ERC20 transferFrom: ~50,000 gas                                       │
│  ├── Share calculation: ~5,000 gas                                         │
│  ├── Mint shares: ~50,000 gas                                              │
│  ├── Treasury deposit: ~40,000 gas                                         │
│  └── Events: ~5,000 gas                                                    │
│                                                                             │
│  TreasuryManager (rebalance)                                                │
│  ├── Loop overhead: ~200 gas per iteration                                 │
│  ├── Strategy calls: ~50,000 gas each                                      │
│  ├── Balance recalculation: ~10,000 gas                                    │
│  └── Distribution: ~100,000+ gas                                           │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## High-Impact Optimizations

### 1. Storage Packing in Invoice Struct

**Location:** `contracts/src/invoice/libraries/LibInvoiceStorage.sol`

**Current Implementation:**
```solidity
struct Invoice {
    address buyer;           // 20 bytes, slot 0
    address supplier;        // 20 bytes, slot 1
    uint128 faceValue;       // 16 bytes, slot 2
    uint128 fundingAmount;   // 16 bytes, slot 2 (packed)
    uint64 maturityDate;     // 8 bytes, slot 3
    uint64 createdAt;        // 8 bytes, slot 3 (packed)
    uint64 fundedAt;         // 8 bytes, slot 3 (packed)
    uint64 paidAt;           // 8 bytes, slot 4
    uint16 discountRateBps;  // 2 bytes, slot 4 (packed)
    InvoiceStatus status;    // 1 byte, slot 4 (packed)
    bytes32 invoiceHash;     // 32 bytes, slot 5
    bytes32 externalId;      // 32 bytes, slot 6
}
// Total: 7 storage slots
```

**Optimized Implementation:**
```solidity
struct Invoice {
    // Slot 0: buyer (20 bytes) + status (1 byte) + discountRateBps (2 bytes) = 23 bytes
    address buyer;
    InvoiceStatus status;
    uint16 discountRateBps;

    // Slot 1: supplier (20 bytes) + padding (12 bytes)
    address supplier;

    // Slot 2: faceValue (16 bytes) + fundingAmount (16 bytes) = 32 bytes
    uint128 faceValue;
    uint128 fundingAmount;

    // Slot 3: all timestamps packed (8+8+8+8 = 32 bytes)
    uint64 maturityDate;
    uint64 createdAt;
    uint64 fundedAt;
    uint64 paidAt;

    // Slot 4: invoiceHash
    bytes32 invoiceHash;

    // Slot 5: externalId
    bytes32 externalId;
}
// Total: 6 storage slots (14% reduction)
```

**Gas Savings:**
- Per invoice creation: ~5,000 gas (one less SSTORE)
- Per invoice read: ~2,100 gas (one less SLOAD)

**Implementation:**
```solidity
// contracts/src/invoice/libraries/LibInvoiceStorageV2.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

library LibInvoiceStorageV2 {
    bytes32 constant STORAGE_SLOT = keccak256("seedfinance.invoice.storage.v2");

    enum InvoiceStatus { Pending, Approved, Funded, Paid, Cancelled, Defaulted }

    // Optimally packed struct
    struct Invoice {
        // Slot 0: 20 + 1 + 2 + 9 padding = 32 bytes
        address buyer;
        InvoiceStatus status;
        uint16 discountRateBps;
        // 9 bytes padding

        // Slot 1: 20 + 12 padding = 32 bytes
        address supplier;
        // 12 bytes padding

        // Slot 2: 16 + 16 = 32 bytes
        uint128 faceValue;
        uint128 fundingAmount;

        // Slot 3: 8 + 8 + 8 + 8 = 32 bytes
        uint64 maturityDate;
        uint64 createdAt;
        uint64 fundedAt;
        uint64 paidAt;

        // Slot 4
        bytes32 invoiceHash;

        // Slot 5
        bytes32 externalId;
    }

    struct Storage {
        mapping(uint256 => Invoice) invoices;
        mapping(address => uint256[]) supplierInvoices;
        mapping(address => uint256[]) buyerInvoices;

        // Pack counters together
        uint128 nextInvoiceId;
        uint128 activeInvoiceCount;

        // Pack totals together
        uint128 totalFunded;
        uint128 totalRepaid;

        address executionPool;
        address liquidityPool;
        address usdc;
        address owner;

        mapping(address => bool) operators;
    }

    function getStorage() internal pure returns (Storage storage s) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            s.slot := slot
        }
    }
}
```

---

### 2. Batch Operations for Multiple Invoices

**Location:** `contracts/src/invoice/facets/FundingFacet.sol`

**Current Implementation:**
```solidity
// Each invoice funded separately - high overhead
function requestFunding(uint256 invoiceId) external onlyOperator {
    // Full function overhead for each invoice
}
```

**Optimized Implementation:**
```solidity
// contracts/src/invoice/facets/FundingFacetV2.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract FundingFacetV2 {
    // Batch funding with single external call to ExecutionPool
    function batchFund(uint256[] calldata invoiceIds) external onlyOperator {
        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();

        uint256 totalFunding = 0;
        uint256 validCount = 0;

        // First pass: validate and calculate totals
        for (uint256 i = 0; i < invoiceIds.length; i++) {
            LibInvoiceStorage.Invoice storage inv = s.invoices[invoiceIds[i]];

            if (inv.status != LibInvoiceStorage.InvoiceStatus.Approved) {
                continue; // Skip invalid, don't revert
            }

            uint128 fundingAmount = LibInvoiceStorage.calculateFundingAmount(
                inv.faceValue,
                inv.discountRateBps,
                inv.maturityDate
            );

            totalFunding += fundingAmount;
            validCount++;
        }

        if (validCount == 0) revert NoValidInvoices();

        // Single external call to get all funds
        ILiquidityPool(s.liquidityPool).deployForFunding(totalFunding);

        // Second pass: update states and transfer
        for (uint256 i = 0; i < invoiceIds.length; i++) {
            LibInvoiceStorage.Invoice storage inv = s.invoices[invoiceIds[i]];

            if (inv.status != LibInvoiceStorage.InvoiceStatus.Approved) {
                continue;
            }

            uint128 fundingAmount = LibInvoiceStorage.calculateFundingAmount(
                inv.faceValue,
                inv.discountRateBps,
                inv.maturityDate
            );

            inv.status = LibInvoiceStorage.InvoiceStatus.Funded;
            inv.fundingAmount = fundingAmount;
            inv.fundedAt = uint64(block.timestamp);

            // Transfer to supplier
            IERC20(s.usdc).transfer(inv.supplier, fundingAmount);

            emit InvoiceFunded(invoiceIds[i], fundingAmount, block.timestamp);
        }

        s.activeInvoiceCount += uint128(validCount);
        s.totalFunded += uint128(totalFunding);
    }

    // Optimized single funding with minimal storage access
    function requestFundingOptimized(uint256 invoiceId) external onlyOperator {
        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        LibInvoiceStorage.Invoice storage inv = s.invoices[invoiceId];

        // Cache storage reads
        LibInvoiceStorage.InvoiceStatus status = inv.status;
        uint128 faceValue = inv.faceValue;
        uint16 discountRateBps = inv.discountRateBps;
        uint64 maturityDate = inv.maturityDate;
        address supplier = inv.supplier;

        if (status != LibInvoiceStorage.InvoiceStatus.Approved) {
            revert InvalidInvoiceStatus(invoiceId, status);
        }

        uint128 fundingAmount = LibInvoiceStorage.calculateFundingAmount(
            faceValue,
            discountRateBps,
            maturityDate
        );

        // Single storage write with packed data
        inv.status = LibInvoiceStorage.InvoiceStatus.Funded;
        inv.fundingAmount = fundingAmount;
        inv.fundedAt = uint64(block.timestamp);

        // External calls
        ILiquidityPool(s.liquidityPool).deployForFunding(fundingAmount);
        IERC20(s.usdc).transfer(supplier, fundingAmount);

        // Update counters
        unchecked {
            s.activeInvoiceCount++;
            s.totalFunded += fundingAmount;
        }

        emit InvoiceFunded(invoiceId, fundingAmount, block.timestamp);
    }
}
```

**Gas Savings:**
- Batch of 10 invoices: ~40% savings vs individual calls
- Single optimized: ~15% savings vs current

---

### 3. Treasury Manager Rebalance Optimization

**Location:** `contracts/src/base/TreasuryManager.sol`

**Current Implementation:**
```solidity
function rebalance() external onlyOwner {
    uint256 totalBalance = asset.balanceOf(address(this));

    // Problem: Withdraws from ALL strategies first
    for (uint256 i = 0; i < strategies.length; i++) {
        if (_strategyInfo[strategies[i]].isActive) {
            ITreasuryStrategy(strategies[i]).withdrawAll();
        }
    }

    // Then redistributes
    _distributeDeposit(totalBalance + /* withdrawn amounts */);
}
```

**Optimized Implementation:**
```solidity
// contracts/src/base/TreasuryManagerV2.sol
function rebalanceOptimized() external onlyOwner nonReentrant {
    uint256 totalValue = totalValue();
    uint256 strategyCount = strategies.length;

    // Calculate target allocations first (no external calls)
    uint256[] memory targetAmounts = new uint256[](strategyCount);
    uint256[] memory currentAmounts = new uint256[](strategyCount);
    int256[] memory deltas = new int256[](strategyCount);

    uint256 totalWeight = 0;
    for (uint256 i = 0; i < strategyCount; i++) {
        if (_strategyInfo[strategies[i]].isActive) {
            totalWeight += _strategyInfo[strategies[i]].weight;
        }
    }

    // Calculate deltas (what needs to move where)
    for (uint256 i = 0; i < strategyCount; i++) {
        StrategyInfo storage info = _strategyInfo[strategies[i]];
        if (!info.isActive) continue;

        currentAmounts[i] = ITreasuryStrategy(strategies[i]).totalValue();
        targetAmounts[i] = (totalValue * info.weight) / totalWeight;
        deltas[i] = int256(targetAmounts[i]) - int256(currentAmounts[i]);
    }

    // First: withdraw from strategies that have excess
    uint256 withdrawnTotal = 0;
    for (uint256 i = 0; i < strategyCount; i++) {
        if (deltas[i] < 0) {
            uint256 withdrawAmount = uint256(-deltas[i]);
            ITreasuryStrategy(strategies[i]).withdraw(withdrawAmount);
            withdrawnTotal += withdrawAmount;
        }
    }

    // Then: deposit to strategies that need more
    uint256 availableBalance = asset.balanceOf(address(this));
    for (uint256 i = 0; i < strategyCount; i++) {
        if (deltas[i] > 0) {
            uint256 depositAmount = uint256(deltas[i]);
            if (depositAmount > availableBalance) {
                depositAmount = availableBalance;
            }
            if (depositAmount > 0) {
                asset.approve(strategies[i], depositAmount);
                ITreasuryStrategy(strategies[i]).deposit(depositAmount);
                availableBalance -= depositAmount;
            }
        }
    }

    emit Rebalanced(totalValue, block.timestamp);
}
```

**Gas Savings:**
- Only moves funds that need to move (vs withdrawAll + redistribute)
- ~30-50% savings depending on imbalance

---

### 4. USDC Approval Optimization

**Location:** Multiple contracts

**Current Implementation:**
```solidity
// Every time, sets max approval
asset.approve(strategy, type(uint256).max);
```

**Problem:** Max approval costs more gas and is a security risk.

**Optimized Implementation:**
```solidity
// contracts/src/libraries/SafeApprove.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library SafeApprove {
    /// @notice Approve exact amount, handling tokens that require zero-first
    function safeApproveExact(
        IERC20 token,
        address spender,
        uint256 amount
    ) internal {
        uint256 currentAllowance = token.allowance(address(this), spender);

        if (currentAllowance < amount) {
            // Some tokens (USDT) require setting to 0 first
            if (currentAllowance > 0) {
                token.approve(spender, 0);
            }
            token.approve(spender, amount);
        }
        // If currentAllowance >= amount, no action needed
    }

    /// @notice Increase allowance only by needed amount
    function safeIncreaseAllowance(
        IERC20 token,
        address spender,
        uint256 amount
    ) internal {
        uint256 currentAllowance = token.allowance(address(this), spender);
        uint256 newAllowance = currentAllowance + amount;
        token.approve(spender, newAllowance);
    }
}

// Usage in TreasuryManager
function deposit(uint256 amount) external onlyLiquidityPool nonReentrant {
    // ... validation ...

    for (uint256 i = 0; i < strategies.length; i++) {
        uint256 strategyAmount = (amount * weights[i]) / totalWeight;
        if (strategyAmount > 0) {
            // Only approve exact amount needed
            SafeApprove.safeApproveExact(asset, strategies[i], strategyAmount);
            ITreasuryStrategy(strategies[i]).deposit(strategyAmount);
        }
    }
}
```

**Gas Savings:** ~5,000 gas per approval operation

---

## Medium-Impact Optimizations

### 5. Use `unchecked` for Safe Math Operations

**Locations:** Multiple contracts where overflow is impossible

```solidity
// Before
s.nextInvoiceId = s.nextInvoiceId + 1;
s.totalFunded = s.totalFunded + fundingAmount;

// After (when overflow is impossible)
unchecked {
    s.nextInvoiceId++;  // Can never overflow in practice
    s.totalFunded += fundingAmount;  // Bounded by total USDC supply
}
```

**Gas Savings:** ~50 gas per operation

---

### 6. Cache Storage Variables in Memory

**Current:**
```solidity
function getInvoice(uint256 invoiceId) external view returns (InvoiceView memory) {
    LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
    LibInvoiceStorage.Invoice storage inv = s.invoices[invoiceId];

    // Multiple SLOAD operations
    return InvoiceView({
        id: invoiceId,
        buyer: inv.buyer,        // SLOAD
        supplier: inv.supplier,  // SLOAD
        faceValue: inv.faceValue,  // SLOAD
        // ... more SLOADs
    });
}
```

**Optimized:**
```solidity
function getInvoice(uint256 invoiceId) external view returns (InvoiceView memory invoice) {
    LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();

    // Single storage pointer, compiler optimizes reads
    LibInvoiceStorage.Invoice storage inv = s.invoices[invoiceId];

    // Cache to memory in one operation
    invoice.id = invoiceId;
    invoice.buyer = inv.buyer;
    invoice.supplier = inv.supplier;
    invoice.faceValue = inv.faceValue;
    invoice.fundingAmount = inv.fundingAmount;
    invoice.maturityDate = inv.maturityDate;
    invoice.createdAt = inv.createdAt;
    invoice.fundedAt = inv.fundedAt;
    invoice.paidAt = inv.paidAt;
    invoice.discountRateBps = inv.discountRateBps;
    invoice.status = inv.status;
    invoice.invoiceHash = inv.invoiceHash;
    invoice.externalId = inv.externalId;
}
```

---

### 7. Short-Circuit Event Emissions

**Current:**
```solidity
function createInvoice(...) external returns (uint256 invoiceId) {
    // ... logic ...

    // Always emit full event
    emit InvoiceCreated(
        invoiceId,
        buyer,
        supplier,
        faceValue,
        discountRateBps,
        maturityDate,
        invoiceHash,
        externalId
    );
}
```

**Optimized:**
```solidity
// Use indexed parameters for filtering, minimal non-indexed data
event InvoiceCreated(
    uint256 indexed invoiceId,
    address indexed buyer,
    address indexed supplier,
    uint256 faceValue  // Only essential non-indexed data
);

// Separate event for full details if needed
event InvoiceDetails(
    uint256 indexed invoiceId,
    uint16 discountRateBps,
    uint64 maturityDate,
    bytes32 invoiceHash,
    bytes32 externalId
);

function createInvoice(...) external returns (uint256 invoiceId) {
    // ... logic ...

    // Emit minimal event
    emit InvoiceCreated(invoiceId, buyer, supplier, faceValue);

    // Optionally emit details (can be skipped for gas savings)
    if (invoiceHash != bytes32(0) || externalId != bytes32(0)) {
        emit InvoiceDetails(invoiceId, discountRateBps, maturityDate, invoiceHash, externalId);
    }
}
```

**Gas Savings:** ~2,000-5,000 gas per event

---

### 8. Diamond Facet Lookup Optimization

**Current Implementation in fallback:**
```solidity
fallback() external payable {
    address facet = s.selectorToFacet[msg.sig];
    require(facet != address(0), "Function not found");
    // ... delegatecall
}
```

**Optimized with Assembly:**
```solidity
fallback() external payable {
    // Inline assembly for minimal overhead
    assembly {
        // Load facet address from storage
        // Storage slot = keccak256(selector . selectorToFacet.slot)
        let selector := shr(224, calldataload(0))

        // Compute storage slot for mapping
        mstore(0x00, selector)
        mstore(0x20, selectorToFacet.slot)
        let slot := keccak256(0x00, 0x40)

        let facet := sload(slot)

        // Check facet exists
        if iszero(facet) {
            revert(0, 0)
        }

        // Copy calldata
        calldatacopy(0, 0, calldatasize())

        // Delegatecall
        let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)

        // Copy return data
        returndatacopy(0, 0, returndatasize())

        switch result
        case 0 { revert(0, returndatasize()) }
        default { return(0, returndatasize()) }
    }
}
```

**Gas Savings:** ~500-1,000 gas per call

---

## Low-Impact Optimizations

### 9. Use `calldata` Instead of `memory` for View Functions

```solidity
// Before
function getInvoice(uint256 invoiceId) external view returns (InvoiceView memory)

// After (if not modifying the return value)
// Note: Return values can't use calldata, but input parameters can
function batchGetInvoices(uint256[] calldata invoiceIds) external view
```

### 10. Minimize String Usage in Errors

```solidity
// Before
require(amount > 0, "Amount must be greater than zero");

// After
error ZeroAmount();
if (amount == 0) revert ZeroAmount();
```

**Gas Savings:** ~200 gas per error

### 11. Use Bit Flags for Status

```solidity
// Before: Enum uses full uint8
enum InvoiceStatus { Pending, Approved, Funded, Paid, Cancelled, Defaulted }

// After: Bit flags allow combining states
uint8 constant STATUS_PENDING = 1;    // 0b000001
uint8 constant STATUS_APPROVED = 2;   // 0b000010
uint8 constant STATUS_FUNDED = 4;     // 0b000100
uint8 constant STATUS_PAID = 8;       // 0b001000
uint8 constant STATUS_CANCELLED = 16; // 0b010000
uint8 constant STATUS_DEFAULTED = 32; // 0b100000

// Can check multiple states at once
function isFundable(uint8 status) pure returns (bool) {
    return status == STATUS_APPROVED; // Single comparison
}
```

---

## Benchmarking Strategy

### Gas Profiling Script

```solidity
// contracts/test/GasBenchmark.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";

contract GasBenchmark is Test {
    // ... setup ...

    function testGas_CreateInvoice() public {
        uint256 gasBefore = gasleft();

        invoiceFacet.createInvoice(
            buyer,
            10_000e6,
            500,
            uint64(block.timestamp + 30 days),
            bytes32(0),
            bytes32(0)
        );

        uint256 gasUsed = gasBefore - gasleft();
        emit log_named_uint("CreateInvoice gas", gasUsed);

        // Assert gas is within expected range
        assertLt(gasUsed, 250_000, "CreateInvoice too expensive");
    }

    function testGas_BatchFund10() public {
        // Create 10 invoices first
        uint256[] memory ids = new uint256[](10);
        for (uint256 i = 0; i < 10; i++) {
            ids[i] = _createAndApproveInvoice();
        }

        uint256 gasBefore = gasleft();
        fundingFacet.batchFund(ids);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("BatchFund 10 invoices gas", gasUsed);
        emit log_named_uint("Per invoice gas", gasUsed / 10);
    }
}
```

### Running Benchmarks

```bash
# Run gas report
forge test --gas-report

# Run specific benchmark
forge test --match-test testGas_ -vvv

# Compare before/after
forge snapshot
# ... make changes ...
forge snapshot --diff
```

---

## Implementation Guide

### Phase 1: Storage Optimizations (Week 1)

1. Implement `LibInvoiceStorageV2` with packed struct
2. Write migration script for existing data
3. Update all facets to use new storage
4. Benchmark gas savings

### Phase 2: Batch Operations (Week 2)

1. Implement `batchFund` function
2. Implement `batchRepay` function
3. Update frontend to use batch operations
4. Test with various batch sizes

### Phase 3: Treasury Optimization (Week 3)

1. Implement delta-based rebalancing
2. Implement safe approval pattern
3. Add rebalance gas limit parameter
4. Benchmark under various conditions

### Phase 4: Minor Optimizations (Week 4)

1. Add `unchecked` blocks where safe
2. Optimize event emissions
3. Improve fallback assembly
4. Final benchmarking and documentation

---

## Expected Results

| Optimization | Implementation Effort | Gas Savings |
|--------------|----------------------|-------------|
| Storage Packing | Medium | 10-15% |
| Batch Operations | Medium | 30-40% (for batches) |
| Treasury Rebalance | High | 30-50% |
| Approval Optimization | Low | 5-10% |
| Unchecked Math | Low | 2-5% |
| Assembly Fallback | Medium | 3-5% |
| **Total (avg transaction)** | | **15-30%** |

---

## References

- [Solidity Gas Optimization Tips](https://www.alchemy.com/overviews/solidity-gas-optimization)
- [EVM Opcodes Gas Costs](https://www.evm.codes/)
- [Foundry Gas Reports](https://book.getfoundry.sh/forge/gas-reports)
- [OpenZeppelin Gas Optimization Patterns](https://docs.openzeppelin.com/contracts/4.x/api/utils#math)
