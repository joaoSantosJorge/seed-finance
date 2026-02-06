# Treasury Manager Deployment

## Overview
Deployed TreasuryManager and USYCStrategy contracts to Arc Testnet, enabling the treasury yield layer for idle capital in the LiquidityPool.

## Changes Made
- Created `contracts/script/DeployTreasury.s.sol` — standalone deployment script for treasury layer
- Updated `frontend/lib/config/contracts.ts` — added TreasuryManager testnet address
- Updated `frontend/.env.local` — set `NEXT_PUBLIC_TREASURY_MANAGER_ADDRESS`

## Deployed Contracts (Arc Testnet)

| Contract | Address |
|----------|---------|
| TreasuryManager | `0x4815708E786d7355D460CcA07158866B28338885` |
| USYCStrategy | `0x6D0fE2C06878C08F2a1bdb4d3bA5245e017e36ae` |

Both contracts verified on Sourcify (exact match).

## How It Works

1. **DeployTreasury.s.sol** deploys TreasuryManager and USYCStrategy in a single script
2. It links TreasuryManager to the existing LiquidityPool via `setTreasuryManager()`
3. It registers USYCStrategy in TreasuryManager via `addStrategy()` at 100% weight
4. The frontend reads the treasury manager address from the LiquidityPool contract on-chain via `useTreasuryManager()` hook
5. The operator treasury page checks if the address is non-zero to show treasury features

### Architecture
```
LiquidityPool (existing)
  └── setTreasuryManager() ──► TreasuryManager (new)
                                  └── addStrategy() ──► USYCStrategy (new)
                                                          └── deposits into USYC token
```

### Access Control
- Deployer gets: `DEFAULT_ADMIN_ROLE`, `STRATEGIST_ROLE`, `PAUSER_ROLE` on TreasuryManager
- LiquidityPool gets: `POOL_ROLE` on TreasuryManager (can call deposit/withdraw)
- Deployer is owner of USYCStrategy

## Testing

```bash
# Verify TreasuryManager is linked to LiquidityPool
cast call 0xB67db96eEbf1D30D95a382535afBB2375ECf0219 "treasuryManager()(address)" --rpc-url https://rpc.testnet.arc.network

# Verify USYCStrategy is registered
cast call 0x4815708E786d7355D460CcA07158866B28338885 "strategyCount()(uint256)" --rpc-url https://rpc.testnet.arc.network

# Check total value (should be 0 initially)
cast call 0x4815708E786d7355D460CcA07158866B28338885 "totalValue()(uint256)" --rpc-url https://rpc.testnet.arc.network
```

## Related Files
- `contracts/script/DeployTreasury.s.sol` — Deployment script
- `contracts/src/base/TreasuryManager.sol` — Treasury manager contract
- `contracts/src/strategies/USYCStrategy.sol` — USYC yield strategy
- `contracts/src/base/LiquidityPool.sol` — Existing pool (linked via setTreasuryManager)
- `frontend/lib/config/contracts.ts` — Frontend address config
- `frontend/hooks/operator/useTreasuryAdmin.ts` — Treasury admin hooks
- `frontend/app/dashboard/operator/treasury/page.tsx` — Treasury UI page
