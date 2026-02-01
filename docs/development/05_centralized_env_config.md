# 05 - Centralized Environment Configuration

## Summary

A centralized configuration system that makes switching between environments trivial:
- **One env var** (`NEXT_PUBLIC_ENV=local|testnet|production`) controls everything
- **One source of truth** for chains, contracts, RPCs, and feature flags
- **Type-safe** with full TypeScript support
- **Easy to extend** with new environments

## Environments

| Environment | Chain | Chain ID | Use Case |
|-------------|-------|----------|----------|
| `local` | Anvil | 31337 | Local development with instant txns |
| `testnet` | Base Sepolia | 84532 | Integration testing, demos |
| `production` | Base Mainnet | 8453 | Live deployment |

## File Structure

```
frontend/lib/config/
├── index.ts        # Main export
├── types.ts        # Type definitions
├── chains.ts       # Chain definitions (Anvil, Base Sepolia, Base Mainnet)
├── contracts.ts    # Contract addresses per environment
└── env.ts          # Environment detection + singleton appConfig
```

## Implementation Details

### Types (`types.ts`)
- `Environment`: Union type for 'local' | 'testnet' | 'production'
- `ContractAddresses`: USDC, LiquidityPool, TreasuryManager addresses
- `EnvironmentConfig`: Full config with chain, RPC, explorer, feature flags
- `AppConfig`: Runtime singleton with computed properties

### Chains (`chains.ts`)
- `anvil`: Local development chain (31337)
- `baseSepolia`: Testnet chain (84532)
- `baseMainnet`: Production chain (8453)

### Contracts (`contracts.ts`)
- Default addresses per environment (USDC hardcoded, others from env vars)
- `getContractAddresses(env)`: Get addresses for an environment
- `USDC_DECIMALS = 6`, `SFUSDC_DECIMALS = 18`

### Environment (`env.ts`)
- `appConfig`: Singleton with all config
- Exported helpers: `environment`, `chain`, `chainId`, `contracts`, `rpcUrl`, `explorerUrl`, `isLocal`, `isTestnet`, `isProduction`

## Backward Compatibility

The existing `frontend/lib/contracts.ts` was converted to a wrapper that:
- Exports `USDC_DECIMALS` and `SFUSDC_DECIMALS` from config
- Provides `getContractAddresses(chainId?)` that ignores chainId and uses appConfig
- Provides overloaded `getExplorerTxUrl` and `getExplorerAddressUrl` functions that work with both old (chainId, hash) and new (hash-only) signatures

The old `frontend/lib/chains.ts` was deleted (replaced by `config/chains.ts`).

## Usage

### Switching Environments

```bash
# Local Anvil development
NEXT_PUBLIC_ENV=local npm run dev

# Testnet
NEXT_PUBLIC_ENV=testnet npm run dev

# Production build
NEXT_PUBLIC_ENV=production npm run build
```

### In Code

```typescript
import { appConfig, contracts, isLocal } from '@/lib/config';

// Access config
console.log(appConfig.config.displayName);  // "Local (Anvil)"
console.log(contracts.liquidityPool);        // Address

// Feature flags
if (appConfig.config.features.debugMode) {
  console.log('Debug mode enabled');
}

// Boolean helpers
if (isLocal) {
  console.log('Running on Anvil');
}
```

## Environment Files

### `.env.example`
```env
# Environment: local | testnet | production
NEXT_PUBLIC_ENV=testnet

# WalletConnect Project ID (get from https://cloud.walletconnect.com)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

# Contract addresses (override defaults)
# NEXT_PUBLIC_USDC_ADDRESS=
# NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS=
# NEXT_PUBLIC_TREASURY_MANAGER_ADDRESS=

# Custom RPC (optional)
# NEXT_PUBLIC_RPC_URL=
```

### `.env.local` (for Anvil testing)
```env
NEXT_PUBLIC_ENV=local
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=demo-project-id

# Populate after running: ./contracts/test/anvil/test-contracts.sh
NEXT_PUBLIC_USDC_ADDRESS=
NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS=
NEXT_PUBLIC_TREASURY_MANAGER_ADDRESS=
```

## Testing Workflow

### One-Time Setup
1. Import Anvil LP user into MetaMask:
   - Private Key: `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`
   - Address: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`

2. Add Anvil network to MetaMask:
   - Name: Anvil Local
   - RPC: http://127.0.0.1:8545
   - Chain ID: 31337
   - Symbol: ETH

### Each Session

```bash
# Terminal 1: Start Anvil
anvil

# Terminal 2: Deploy contracts
cd contracts && ./test/anvil/test-contracts.sh

# Copy addresses to .env.local

# Terminal 3: Start frontend
cd frontend && npm run dev
```

## Adding New Environments

1. Add to `Environment` type in `types.ts`
2. Add contract defaults in `contracts.ts`
3. Add config in `env.ts`
4. Update chain selection in `wagmi.ts`

## Status: ✅ Implemented

- [x] Created `frontend/lib/config/types.ts`
- [x] Created `frontend/lib/config/chains.ts`
- [x] Created `frontend/lib/config/contracts.ts`
- [x] Created `frontend/lib/config/env.ts`
- [x] Created `frontend/lib/config/index.ts`
- [x] Updated `frontend/lib/wagmi.ts` to use new config
- [x] Updated `frontend/lib/contracts.ts` as backward-compatible wrapper
- [x] Deleted old `frontend/lib/chains.ts`
- [x] Updated `.env.example`
- [x] Created `.env.local` for Anvil development
- [x] Verified build succeeds
- [x] Verified contract tests pass
