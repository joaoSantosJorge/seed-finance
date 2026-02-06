# Arc Testnet Blocklist Precompile Bug

## Overview

The `depositToTreasury` function on LiquidityPool fails on Arc Testnet due to a bug in Arc's USDC blocklist precompile (`0x1800000000000000000000000000000000000001`). The precompile's `isBlocklisted()` function returns a `StackUnderflow` EVM error when called during contract-to-contract USDC `transferFrom` operations, causing the entire transaction to revert.

**Discovered:** 2026-02-06
**Status:** Blocked — no workaround available
**Impact:** All treasury management features (yield optimization on idle capital) are non-functional

---

## Problem Summary

When calling `depositToTreasury(amount)` on the LiquidityPool contract, the transaction reverts with an empty revert reason (`0x`). The root cause is that Arc's USDC system contract (`0x3600...`) performs a blocklist check via a precompile before every transfer. This precompile hits a `StackUnderflow` EVM error, causing the transfer — and the entire transaction — to revert.

**User-visible symptom:** Calling `depositToTreasury` from the operator dashboard or directly via `cast send` always fails. The transaction either fails gas estimation or, when gas is manually specified, lands on-chain with `status: 0 (failed)`.

---

## Affected Functionality

| Feature | Status | Reason |
|---------|--------|--------|
| LP deposits (EOA → LiquidityPool) | **Working** | User-to-contract USDC transfers succeed |
| `depositToTreasury` (Pool → TreasuryManager) | **Broken** | Contract-to-contract `transferFrom` triggers blocklist precompile bug |
| Treasury yield optimization (USYC) | **Broken** | Cannot move funds to TreasuryManager |
| `withdrawFromTreasury` | **Likely broken** | Same contract-to-contract transfer pattern |
| Any contract-to-contract USDC `transferFrom` | **Likely broken** | Same root cause |

---

## Contract Addresses (Arc Testnet)

| Contract | Address |
|----------|---------|
| LiquidityPool | `0xB67db96eEbf1D30D95a382535afBB2375ECf0219` |
| TreasuryManager | `0x61AD0D0E1fe544303F9d60D966A983052eFa46e9` |
| USYCStrategy | `0x29185ab3155eFE0209a78727B2fb70D98c101426` |
| USDC (system contract) | `0x3600000000000000000000000000000000000000` |
| USDC (implementation) | `0x3910B7cbb3341f1F4bF4cEB66e4A2C8f204FE2b8` |
| Blocklist precompile | `0x1800000000000000000000000000000000000001` |
| USYC token | `0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C` |
| Deployer EOA | `0xe4d0af6510D9657Be73205128F4A94AbC8eBA482` |

---

## Full Call Trace

The following trace was obtained via `cast call --trace`, simulating `depositToTreasury(1000000)` (1 USDC):

```
cast call 0xb67db96eebf1d30d95a382535afbb2375ecf0219 \
  "depositToTreasury(uint256)" 1000000 \
  --from 0xe4d0af6510D9657Be73205128F4A94AbC8eBA482 \
  --rpc-url https://rpc.testnet.arc.network \
  --trace
```

```
Traces:
  [17320563791401826924] 0xB67db96eEbf1D30D95a382535afBB2375ECf0219::depositToTreasury(1000000)
    ├─ [7876] 0x3600000000000000000000000000000000000000::balanceOf(0xB67db96eEbf1D30D95a382535afBB2375ECf0219) [staticcall]
    │   ├─ [679] 0x3910B7cbb3341f1F4bF4cEB66e4A2C8f204FE2b8::balanceOf(0xB67db96eEbf1D30D95a382535afBB2375ECf0219) [delegatecall]
    │   │   └─ ← [Return] 0x...003d0900     (= 4,000,000 = 4 USDC)
    │   └─ ← [Return] 0x...003d0900
    ├─ [17320563791401803057] 0x61AD0D0E1fe544303F9d60D966A983052eFa46e9::deposit(1000000)
    │   ├─ [17320563791401794963] 0x3600000000000000000000000000000000000000::transferFrom(LiquidityPool, TreasuryManager, 1000000)
    │   │   ├─ [17320563791401794291] 0x3910B7cbb3341f1F4bF4cEB66e4A2C8f204FE2b8::transferFrom(...) [delegatecall]
    │   │   │   ├─ [3] 0x1800000000000000000000000000000000000001::isBlocklisted(0x61AD...) [staticcall]
    │   │   │   │   └─ ← [StackUnderflow] EvmError: StackUnderflow    ◄── FAILURE POINT
    │   │   │   └─ ← [Revert] EvmError: Revert
    │   │   └─ ← [Revert] EvmError: Revert
    │   └─ ← [Revert] EvmError: Revert
    └─ ← [Revert] EvmError: Revert
```

### Call chain in code

1. **LiquidityPool.depositToTreasury(amount)** (`LiquidityPool.sol:238`)
   - Checks `treasuryManager != address(0)`, `amount > 0`, `availableLiquidity() >= amount`
2. **LiquidityPool._depositToTreasury(amount)** (`LiquidityPool.sol:436`)
   - Calls `ITreasuryManager(treasuryManager).deposit(amount)` (line 445)
3. **TreasuryManager.deposit(amount)** (`TreasuryManager.sol:258`)
   - Calls `asset.safeTransferFrom(msg.sender, address(this), amount)` (line 262) — **USDC pull from LiquidityPool to TreasuryManager**
4. **USDC system contract** (`0x3600...`) → delegatecalls to implementation (`0x3910...`)
5. **USDC implementation.transferFrom()** calls **blocklist precompile** (`0x1800...0001`)
   - `isBlocklisted(TreasuryManager_address)` → **StackUnderflow**

The transfer never completes. The funds that would flow to USYCStrategy (step 4 in the normal flow) are never reached.

---

## Root Cause Analysis

Arc's USDC is a **system contract** at `0x3600000000000000000000000000000000000000` that delegates to an implementation contract at `0x3910B7cbb3341f1F4bF4cEB66e4A2C8f204FE2b8`. Before executing any `transfer` or `transferFrom`, the USDC implementation checks whether the sender or recipient is on a blocklist by calling a **precompile** at:

```
0x1800000000000000000000000000000000000001
```

The precompile's `isBlocklisted(address)` function is supposed to return a boolean. Instead, it returns a `StackUnderflow` EVM error. This is a low-level EVM execution error indicating the precompile's bytecode (or the EVM's handling of it) attempts to pop a value from an empty stack.

**Key observation:** The `isBlocklisted` call only used 3 gas before failing, which suggests the precompile execution never even started properly — it hit `StackUnderflow` immediately.

This is **not** a contract code issue. The contracts are correctly configured with proper approvals and roles. The bug is in the Arc Testnet's precompile infrastructure.

---

## Evidence

### On-Chain Failed Transactions

1. **Transaction 1** (from block explorer):
   ```
   0xc4245ada79a84cdcf7b86fac15b8748807c5c5d3669a7a68dea995047164b466
   ```
   Explorer: `https://testnet.arcscan.app/tx/0xc4245ada79a84cdcf7b86fac15b8748807c5c5d3669a7a68dea995047164b466`

2. **Transaction 2** (sent during investigation with explicit `--gas-limit 500000`):
   ```
   0xa9e46dcf822c607119587b69fec180c49e7388ce1dfdc2b6565042c447afd863
   ```
   - Block: 25657630
   - Gas used: 148,234
   - Status: `0` (failed)
   - Logs: none (reverted before any events)

   Explorer: `https://testnet.arcscan.app/tx/0xa9e46dcf822c607119587b69fec180c49e7388ce1dfdc2b6565042c447afd863`

### Gas Estimation Failure

Without an explicit `--gas-limit`, `cast send` fails before even submitting the transaction:

```
Error: Failed to estimate gas: server returned an error response: error code 3: execution reverted
```

This is because `eth_estimateGas` simulates the call and hits the same precompile bug.

---

## On-Chain Verification: All Setup Is Correct

Every prerequisite for `depositToTreasury` was verified on-chain:

| Check | Command | Result |
|-------|---------|--------|
| LiquidityPool → TreasuryManager pointer | `treasuryManager()` | `0x61AD0D0E1fe544303F9d60D966A983052eFa46e9` ✓ |
| USDC allowance: Pool → TreasuryManager | `allowance(Pool, TM)` | `type(uint256).max` (infinite) ✓ |
| USDC allowance: TreasuryManager → USYCStrategy | `allowance(TM, Strategy)` | `type(uint256).max` (infinite) ✓ |
| USDC allowance: USYCStrategy → USYC | `allowance(Strategy, USYC)` | `type(uint256).max` (infinite) ✓ |
| TreasuryManager paused | `paused()` | `false` ✓ |
| TreasuryManager strategy count | `strategyCount()` | `1` ✓ |
| TreasuryManager total weight | `totalWeight()` | `10000` (100%) ✓ |
| Strategy address | `strategies(0)` | `0x29185ab3155eFE0209a78727B2fb70D98c101426` ✓ |
| Strategy asset | `asset()` on USYCStrategy | `0x3600000000000000000000000000000000000000` (USDC) ✓ |
| Available liquidity | `availableLiquidity()` | `4,000,000` (4 USDC) ✓ |

---

## What Works vs What Doesn't

### Working

- **LP deposits** (EOA → LiquidityPool): Users can deposit USDC into the vault and receive SEED tokens. This uses `USDC.transferFrom(user_EOA, LiquidityPool, amount)`, which apparently does not trigger the same precompile issue (or the precompile handles EOA addresses correctly).
- **All read operations**: `balanceOf`, `allowance`, `availableLiquidity`, `treasuryManager`, `paused`, `strategyCount`, `totalWeight`, `strategies(0)`, `asset()` all return correct values.

### Not Working

- **`depositToTreasury()`**: Fails because `USDC.transferFrom(LiquidityPool → TreasuryManager)` triggers the blocklist precompile bug.
- **Any contract-to-contract USDC `transferFrom`**: The precompile `isBlocklisted()` call on the recipient contract address causes `StackUnderflow`.
- **`getActiveStrategies()` on TreasuryManager**: Reverts (possibly related or a separate view function issue).
- **`yieldToken()` on USYCStrategy**: Reverts (possibly related or a separate view function issue).

### Hypothesis: EOA vs Contract Address

LP deposits from an EOA wallet work, but contract-to-contract transfers fail. This suggests the blocklist precompile may have a bug specifically when checking contract addresses, or when the `isBlocklisted` call is made in a nested call context (contract calling contract calling precompile).

---

## Impact

| Feature | Impact |
|---------|--------|
| Treasury yield optimization | **Fully blocked** — cannot deposit idle LP capital into USYC strategy |
| LP yield from treasury | **Blocked** — no treasury returns means lower yield for LPs |
| TreasuryManager withdraw | **Likely blocked** — same transfer pattern |
| Protocol revenue | **Reduced** — idle capital earns no yield |

**Severity:** High — core protocol feature (treasury management / yield optimization) is completely non-functional.

**Workaround:** None available. The blocklist check is embedded in Arc's USDC system contract and cannot be bypassed or overridden by application-level contracts.

---

## Recommended Action

1. **Report to Circle/Arc team** with:
   - This document
   - Failed tx hashes: `0xa9e46dcf...` and `0xc4245ada...`
   - The `cast call --trace` output showing the `StackUnderflow` at `0x1800000000000000000000000000000000000001::isBlocklisted()`
   - Explanation that contract-to-contract USDC transfers are broken while EOA-to-contract transfers work

2. **Request clarification on:**
   - Is this a known issue on Arc Testnet?
   - Is there a timeline for a fix?
   - Are contract-to-contract USDC transfers expected to work on Arc?

3. **Monitor:** Re-test `depositToTreasury` periodically or after Arc Testnet upgrades.

---

## Related Files

- `contracts/src/base/LiquidityPool.sol` — `depositToTreasury()`, `_depositToTreasury()`
- `contracts/src/base/TreasuryManager.sol` — `deposit()`, `_distributeDeposit()`
- `contracts/src/strategies/USYCStrategy.sol` — `deposit()`
- `docs/development/25_treasury_manager_deployment.md` — TreasuryManager deployment docs
- `docs/development/26_treasury_manager_double_transfer_fix.md` — Related fix to deposit flow
