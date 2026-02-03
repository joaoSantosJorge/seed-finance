# 12. Repayment Flow Fix

## Summary

Fixed the buyer repayment functionality which was broken because `RepaymentFacet.processRepayment()` transferred USDC to ExecutionPool but never called `ExecutionPool.receiveRepayment()`. This caused USDC to get stuck in ExecutionPool, preventing funds from returning to LiquidityPool.

## Problem

### Broken Flow (Before Fix)
```
Buyer -> InvoiceDiamond.processRepayment()
  -> USDC from buyer to Diamond
  -> USDC from Diamond to ExecutionPool
  -> STOP! USDC stuck in ExecutionPool
```

### Impact
- USDC got stuck in ExecutionPool
- Funds never returned to LiquidityPool
- LPs never received their principal + yield back
- Yield tracking was broken
- `totalDeployed` in LiquidityPool never decreased

## Solution

### Fixed Flow (After Fix)
```
Buyer -> InvoiceDiamond.processRepayment()
  -> USDC from buyer to Diamond
  -> USDC from Diamond to ExecutionPool
  -> ExecutionPool.receiveRepayment() called
    -> USDC to LiquidityPool
    -> LiquidityPool.receiveRepayment() for yield tracking
```

## Implementation

### 1. Created IExecutionPool Interface

**File:** `contracts/src/invoice/interfaces/IExecutionPool.sol`

```solidity
interface IExecutionPool {
    function receiveRepayment(uint256 invoiceId, address buyer) external;
    function isInvoiceFunded(uint256 invoiceId) external view returns (bool);
    function isInvoiceRepaid(uint256 invoiceId) external view returns (bool);
}
```

### 2. Fixed RepaymentFacet.sol

**File:** `contracts/src/invoice/facets/RepaymentFacet.sol`

Added import:
```solidity
import "../interfaces/IExecutionPool.sol";
```

Modified `processRepayment()` to call ExecutionPool after USDC transfer:
```solidity
// If ExecutionPool is set, transfer to it and trigger repayment flow
// This ensures funds return to LiquidityPool with proper yield tracking
if (s.executionPool != address(0)) {
    IERC20(s.usdc).safeTransfer(s.executionPool, repaymentAmount);
    IExecutionPool(s.executionPool).receiveRepayment(invoiceId, msg.sender);
}
```

### 3. Added Tests

**File:** `contracts/test/RepaymentFacet.t.sol`

New tests added:
- `test_ProcessRepayment_ReturnsToLiquidityPool` - Verifies funds return to LP with yield
- `test_ProcessRepayment_UpdatesExecutionPoolTracking` - Verifies ExecutionPool state updates
- `test_ProcessRepayment_EndToEndYieldFlow` - Comprehensive end-to-end test

## Files Modified

| File | Action |
|------|--------|
| `contracts/src/invoice/interfaces/IExecutionPool.sol` | Created |
| `contracts/src/invoice/facets/RepaymentFacet.sol` | Modified |
| `contracts/test/RepaymentFacet.t.sol` | Modified |

## Testing

```bash
cd contracts && forge test --match-contract RepaymentFacet -vvv
```

## Notes

- The InvoiceDiamond already has `DIAMOND_ROLE` on ExecutionPool (granted by `setInvoiceDiamond()`)
- No frontend changes needed - hooks and UI are already correct
- Gas increase is minimal (~2-5k for one additional external call)
- The fix ensures proper yield distribution to LPs via ERC-4626 share value increase

## Status

- [x] Implemented
- [x] Tests added
- [x] All 420 tests passing
- [ ] Deployed to testnet
- [ ] Verified on mainnet
