# Arc Chain Migration

## Overview

Migrated all chain configuration from Base L2 (Sepolia/Mainnet) to Arc chain (Circle's L1 for stablecoin finance). Arc uses USDC as the native gas token with sub-second deterministic finality and the Prague EVM hard fork.

## Changes Made

### Contracts

| File | Change |
|------|--------|
| `contracts/foundry.toml` | Changed `evm_version` from `cancun` to `prague`; replaced Base RPC/explorer config with Arc |
| `contracts/src/base/LiquidityPool.sol` | Added Arc USDC decimal safety comment (18 native vs 6 ERC-20) |
| `contracts/src/invoice/ExecutionPool.sol` | Added Arc USDC decimal safety comment |
| `contracts/src/strategies/USYCStrategy.sol` | Updated USYC address comment to Arc (`0xe9185...`), added USDC decimal note |
| `contracts/script/DeployLiFiReceiver.s.sol` | Replaced Base USDC addresses with Arc system contract, updated chain ID checks (5042002/1243) |

### Frontend

| File | Change |
|------|--------|
| `frontend/lib/config/chains.ts` | Replaced `baseSepolia`/`baseMainnet` with `arcTestnet`/`arcMainnet` definitions |
| `frontend/lib/config/contracts.ts` | Updated testnet/production USDC to `0x3600...000` |
| `frontend/lib/config/env.ts` | Updated imports, display names, RPCs, and explorers for Arc |
| `frontend/lib/wagmi.ts` | Updated imports to use Arc chains |
| `frontend/lib/lifi/config.ts` | Updated chain IDs, USDC addresses; `isLiFiBridgingAvailable()` returns false (LiFi doesn't support Arc yet) |
| `frontend/.env.example` | Updated comments to reference Arc |
| `frontend/.env.local.example` | Updated header comment |

### Backend

| File | Change |
|------|--------|
| `backend/.env` / `backend/.env.example` | Added Arc RPC/chain ID comments |
| `backend/services/CircleWalletsService.ts` | Added `ARC-TESTNET` blockchain and USDC address; changed default to `ARC-TESTNET` |
| `backend/services/DepositRoutingService.ts` | Added Arc testnet to supported chains; updated destination chains to Arc; gas estimates in USDC instead of ETH |
| `backend/services/CircleGatewayService.ts` | Updated comments from "Base" to "Arc" |
| `backend/src/indexer/poolIndexer.ts` | Replaced `base`/`baseSepolia` imports with inline `arcTestnet` definition via `defineChain` |

### Documentation

| File | Change |
|------|--------|
| `docs/ARC-REFERENCE.md` | New file — Arc network reference (addresses, config, deployment instructions) |
| `docs/development/20_arc_chain_migration.md` | This file |
| `CLAUDE.md` | Updated "Base L2" references to "Arc chain", key addresses, tech stack |

## How It Works

### Arc vs Base — Key Differences

1. **Gas token**: Arc uses USDC natively (18 decimals at protocol level). Our contracts use the ERC-20 interface (6 decimals) so no code changes needed beyond comments.
2. **EVM version**: Prague vs Cancun — `foundry.toml` updated accordingly.
3. **Finality**: Sub-second deterministic on Arc vs ~2s on Base.
4. **LI.FI**: Not yet supported on Arc — `isLiFiBridgingAvailable()` returns false.
5. **CCTP**: V2 deployed on Arc with different contract addresses.

### What Didn't Change

- Solidity contract logic (USDC ERC-20 interface is identical)
- Frontend UI components
- Backend business logic (only chain config)
- Local Anvil development setup (chain ID 31337)

## Testing

```bash
# Verify contracts compile with Prague EVM
cd contracts && forge build

# Verify frontend builds
cd frontend && npm run build

# Check no stale Base references in source code
grep -r "84532\|8453\|baseSepolia\|baseMainnet\|base\.org" \
  --include="*.ts" --include="*.tsx" --include="*.toml" \
  --exclude-dir=node_modules --exclude-dir=.git
# Should only return results in historical docs or cross-chain source chain lists
```

## Related Files

- `docs/ARC-REFERENCE.md` — Full Arc network reference
- `docs/BASE-REFERENCE.md` — Historical Base reference (kept for cross-chain context)
- `CLAUDE.md` — Updated project overview
