# Arc Testnet Deployment

## Overview

Deployment script and configuration for deploying Seed Finance contracts to Arc Testnet (chain ID 5042002). Adapted from the local Anvil deployment (`DeployLocal.s.sol`) to work with Arc's native USDC system contract and small testnet balances.

## Changes Made

- **`contracts/src/base/LiquidityPool.sol`** — Changed default `liquidityBuffer` from 100,000 USDC to 0. This removes the default capital buffer requirement so the system works with small faucet amounts. Buffer can be set post-deployment via `setLiquidityBuffer()`.
- **`contracts/script/DeployArcTestnet.s.sol`** — New Foundry deployment script for Arc Testnet. Uses real USDC at `0x3600000000000000000000000000000000000000` instead of MockUSDC. No test minting; deployer uses faucet USDC.
- **`contracts/deploy-arc-testnet.ps1`** — PowerShell wrapper script that handles environment variable loading, build verification, and forge script execution.

## How It Works

### Deployment Script (`DeployArcTestnet.s.sol`)

The script validates it's running on Arc Testnet (chain ID 5042002), then deploys:

1. **LiquidityPool** — ERC-4626 vault pointing to Arc USDC
2. **5 Facets** — InvoiceFacet, FundingFacet, RepaymentFacet, ViewFacet, AdminFacet
3. **InvoiceDiamond** — Diamond proxy wired with all facet cuts
4. **ExecutionPool** — Funding/repayment handler pointing to Arc USDC

Post-deployment configuration:
- InvoiceDiamond initialized with deployer as owner
- ExecutionPool linked to LiquidityPool and InvoiceDiamond
- ROUTER_ROLE granted to ExecutionPool in LiquidityPool
- Deployer set as operator in InvoiceDiamond

### Key Differences from Local Deployment

| Aspect | DeployLocal | DeployArcTestnet |
|--------|-------------|------------------|
| Chain ID check | 31337 (Anvil) | 5042002 (Arc Testnet) |
| USDC | Deploys MockUSDC | System contract `0x3600...0000` |
| Minting | 1M USDC to test accounts | Skipped (use faucet) |
| Buffer | Sets 10k buffer | 0 (default) |
| Accounts | Hardcoded Anvil addresses | Deployer = `msg.sender` |

## Testing

### Prerequisites

1. Install Foundry: `foundryup` (or see https://book.getfoundry.sh/getting-started/installation)
2. Get testnet USDC from [Circle Faucet](https://faucet.circle.com)
3. Set environment variables:

```powershell
$env:ARC_TESTNET_PRIVATE_KEY = "0x..."
$env:ARC_TESTNET_RPC_URL = "https://rpc.testnet.arc.network"  # optional, this is the default
$env:ARCSCAN_API_KEY = "..."  # optional, for contract verification
```

### Dry Run (Simulation)

```powershell
cd contracts
.\deploy-arc-testnet.ps1 -DryRun
```

### Live Deployment

```powershell
cd contracts
.\deploy-arc-testnet.ps1
```

### With Contract Verification

```powershell
cd contracts
.\deploy-arc-testnet.ps1 -Verify
```

### Post-Deployment Verification

1. Copy the printed contract addresses to `frontend/.env.local` and `backend/.env`
2. Deposit a small amount into LiquidityPool to confirm it works:
   - Approve USDC spending: `cast send $USDC "approve(address,uint256)" $LIQUIDITY_POOL 10000 --rpc-url $RPC --private-key $KEY`
   - Deposit: `cast send $LIQUIDITY_POOL "deposit(uint256,address)" 10000 $YOUR_ADDRESS --rpc-url $RPC --private-key $KEY`
3. Check share balance: `cast call $LIQUIDITY_POOL "balanceOf(address)" $YOUR_ADDRESS --rpc-url $RPC`

## Related Files

- `contracts/script/DeployLocal.s.sol` — Original local deployment script
- `contracts/foundry.toml` — Foundry config with Arc RPC and Etherscan endpoints
- `frontend/lib/config/chains.ts` — Frontend Arc chain definition
- `frontend/lib/config/contracts.ts` — Contract addresses config (update after deployment)
