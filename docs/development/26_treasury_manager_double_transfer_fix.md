# TreasuryManager Double-Transfer Bug Fix

## Overview
Fixed a push/pull mismatch in `TreasuryManager._distributeDeposit()` that caused `depositToTreasury` to fail on Arc Testnet with "ERC20: transfer amount exceeds balance".

## Root Cause
`TreasuryManager._distributeDeposit()` was PUSHing USDC to strategies via `safeTransfer()` before calling `strategy.deposit()`. However, strategies (`BaseTreasuryStrategy` and `USYCStrategy`) are designed to PULL funds via `safeTransferFrom(msg.sender, ...)` inside their `deposit()` function. This resulted in a double-transfer attempt: USDC was first sent to the strategy, then the strategy tried to pull again from TreasuryManager which no longer had the funds.

## Changes Made
- **`contracts/src/base/TreasuryManager.sol`**: Removed two `asset.safeTransfer(strategy, ...)` calls in `_distributeDeposit()` — one in the main distribution loop and one in the dust-handling block. Strategies now pull funds directly via the approval granted at `addStrategy()` time.
- **`contracts/test/mocks/MockStrategy.sol`**: Updated mock to use the pull pattern (`safeTransferFrom`) to match the real strategy implementations.

## How It Works
1. `TreasuryManager.addStrategy()` already approves each strategy for `type(uint256).max` (line 171)
2. When `_distributeDeposit()` is called, it now only calls `strategy.deposit(allocation)`
3. The strategy's `deposit()` function pulls funds from TreasuryManager via `safeTransferFrom`
4. No redundant transfer occurs — single pull transfer only

## Testing
```bash
# TreasuryManager tests (52 tests)
cd contracts && forge test --match-contract TreasuryManager -vvv

# USYCStrategy tests (46 tests)
forge test --match-contract USYCStrategy -vvv

# Full suite (410 tests pass)
forge test
```

## Related Files
- `contracts/src/base/TreasuryManager.sol` — Fixed contract
- `contracts/src/strategies/BaseTreasuryStrategy.sol` — Pull pattern (unchanged)
- `contracts/src/strategies/USYCStrategy.sol` — Pull pattern (unchanged)
- `contracts/test/mocks/MockStrategy.sol` — Updated mock
