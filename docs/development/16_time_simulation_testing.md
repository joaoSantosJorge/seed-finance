# Time Simulation for Testing

## Overview

This document describes the time simulation infrastructure added to Seed Finance for testing time-dependent features like yield accrual, invoice maturity, and share price changes.

## Problem

When testing locally with Anvil, the backend uses system time (`new Date()`) while the blockchain uses manipulated time (`vm.warp()` or `evm_increaseTime`). This causes time calculations (e.g., `daysToMaturity`, `isOverdue`) to be incorrect after advancing Anvil's time.

## Solution

A time provider that can switch between system time (production) and blockchain time (local testing), keeping the backend synchronized with Anvil's manipulated time.

## Changes Made

### Backend

1. **`backend/lib/timeProvider.ts`** - Core time provider utility
   - Supports `system` and `blockchain` time sources
   - Caches blockchain time to reduce RPC calls
   - Provides both sync and async methods

2. **`backend/lib/index.ts`** - Library exports

3. **`backend/types/invoice.ts`** - Updated to use time provider
   - `addInvoiceDetails()` now uses `timeProvider.nowSync()`
   - Added `addInvoiceDetailsAsync()` for accurate time calculations

4. **`backend/scripts/advanceTime.ts`** - CLI script to advance Anvil time
   - Supports days, hours, minutes, seconds
   - Mines blocks after time advance
   - Clears time provider cache

5. **`backend/scripts/simulateYieldWorkflow.ts`** - Example workflow script
   - Demonstrates yield calculation
   - Shows how to use time provider

### Contracts

1. **`contracts/script/SimulateYieldAccrual.s.sol`** - Foundry script for yield simulation
   - `viewState(address)` - View pool state
   - `simulateTimePassage(address, uint256)` - Warp time
   - `injectYield(address, address, uint256)` - Test share price changes
   - `calculateInvoiceYield(uint256, uint256, uint256)` - Calculate expected yield

## How It Works

### Time Provider

```typescript
import { timeProvider } from './lib/timeProvider';

// For local testing with Anvil:
timeProvider.useBlockchainTime('http://localhost:8545');

// Get current time (fetches from blockchain):
const now = await timeProvider.now();

// After advancing Anvil time:
timeProvider.clearCache();

// For production:
timeProvider.useSystemTime();
```

### Advancing Anvil Time

```bash
# Using the script (recommended)
npx ts-node backend/scripts/advanceTime.ts 30           # 30 days
npx ts-node backend/scripts/advanceTime.ts 1 --hours   # 1 hour
npx ts-node backend/scripts/advanceTime.ts 30 --mine 5 # 30 days, mine 5 blocks

# Using cast directly
cast rpc evm_increaseTime 2592000 --rpc-url http://localhost:8545
cast rpc evm_mine --rpc-url http://localhost:8545
```

### Yield Simulation with Foundry

```bash
# Calculate yield for 10k USDC invoice at 5% for 30 days
forge script script/SimulateYieldAccrual.s.sol \
  --sig 'calculateInvoiceYield(uint256,uint256,uint256)' \
  10000000000 500 30

# View pool state
forge script script/SimulateYieldAccrual.s.sol \
  --rpc-url http://localhost:8545 \
  --sig 'viewState(address)' <POOL_ADDRESS>
```

### Full Workflow Test

The existing `TestWorkflow.s.sol` already demonstrates the complete cycle:

```bash
# Start Anvil
anvil --host 0.0.0.0

# Run full workflow with time warp
forge script script/TestWorkflow.s.sol \
  --rpc-url http://localhost:8545 \
  --broadcast
```

This script:
1. Deploys all contracts
2. LP deposits 100,000 USDC
3. Creates 10,000 USDC invoice at 5% APR
4. Funds invoice (supplier gets ~9,959 USDC)
5. Warps 30 days forward
6. Processes repayment (buyer pays 10,000 USDC)
7. Shows yield accrual (~41 USDC profit)

## Yield Calculation

The discount/yield is calculated using simple interest:

```
secondsToMaturity = maturityDate - currentTimestamp
annualDiscount = faceValue * discountRateBps / 10000
discount = annualDiscount * secondsToMaturity / 365 days
fundingAmount = faceValue - discount
yield = discount
```

Example for 10,000 USDC at 5% APR for 30 days:
- Annual discount: 10,000 * 500 / 10000 = 500 USDC
- 30-day discount: 500 * (30/365) = ~41.10 USDC
- Funding amount: 10,000 - 41.10 = ~9,958.90 USDC

## Testing

### Contract Tests

Existing tests in `contracts/test/` use `vm.warp()` for time manipulation:

```solidity
// Warp 30 days forward
vm.warp(block.timestamp + 30 days);

// Then process repayment, check yield, etc.
```

### Backend Tests

```typescript
import { timeProvider } from './lib/timeProvider';

// Setup: use blockchain time
timeProvider.useBlockchainTime('http://localhost:8545');

// After advancing time with advanceTime.ts:
timeProvider.clearCache();

// Now backend calculations use the new blockchain time
const invoice = await getInvoice(1n);
const details = await addInvoiceDetailsAsync(invoice);
console.log(details.daysToMaturity); // Reflects blockchain time
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TIME_SOURCE` | `system` or `blockchain` | `system` |
| `RPC_URL` | Anvil RPC endpoint | `http://127.0.0.1:8545` |
| `CHAIN_ID` | Chain ID | `31337` |

## Related Files

- `backend/lib/timeProvider.ts` - Time provider utility
- `backend/scripts/advanceTime.ts` - Time advance script
- `backend/scripts/simulateYieldWorkflow.ts` - Example workflow
- `backend/types/invoice.ts` - Invoice types with time-aware calculations
- `contracts/script/SimulateYieldAccrual.s.sol` - Foundry yield simulation
- `contracts/script/TestWorkflow.s.sol` - Full workflow test
- `contracts/test/integration/InvoiceLifecycle.t.sol` - Integration tests with time warp
