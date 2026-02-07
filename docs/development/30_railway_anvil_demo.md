# Railway Anvil Demo Stack

## Overview

Arc Testnet has a blocklist precompile bug (`StackUnderflow` in `isBlocklisted()`) that breaks all contract-to-contract USDC transfers. This blocks invoice funding, repayments, and treasury features — making a live demo impossible on Arc Testnet.

This setup deploys the full Seed Finance stack on Railway using Anvil (local EVM) with MockUSDC to demonstrate the complete protocol.

## Architecture

```
Railway Project
├── anvil-node      (Docker — Anvil + deploy + seed data)
├── frontend        (NIXPACKS — Next.js, NEXT_PUBLIC_ENV=local)
├── backend         (NIXPACKS — Indexer, CHAIN_ID=31337)
└── postgres        (Railway plugin — shared PostgreSQL)
```

## Changes Made

| Action | File | Purpose |
|--------|------|---------|
| Create | `contracts/script/SeedDemo.s.sol` | Seeds 10 invoices across mixed lifecycle states |
| Create | `anvil/Dockerfile` | Multi-stage Docker build for Anvil service |
| Create | `anvil/start.sh` | Startup: Anvil → deploy → seed → wait |
| Edit | `frontend/lib/config/chains.ts` | Anvil RPC URL from `NEXT_PUBLIC_RPC_URL` env var |
| Edit | `frontend/lib/wagmi.ts` | Explicit `rpcUrl` for anvil transport |
| Edit | `backend/src/indexer/poolIndexer.ts` | Anvil chain support (chain ID 31337) |
| Create | `backend/src/indexer/resetDb.ts` | Truncate stale indexer data on restart |
| Edit | `backend/package.json` | `reset-db` script |
| Edit | `backend/railway.toml` | Run `reset-db` before indexer on startup |

## How It Works

### Anvil Service

The Anvil Docker service (`anvil/Dockerfile`) uses a multi-stage build:
1. **Builder stage**: Copies `contracts/` and runs `forge build`
2. **Runtime stage**: Runs `start.sh` which:
   - Starts Anvil on `$PORT` with `--no-cors --block-time 2 --accounts 12`
   - Waits for readiness (polls `cast chain-id`)
   - Deploys all contracts via `DeployLocal.s.sol`
   - Seeds demo data via `SeedDemo.s.sol`
   - Waits on Anvil PID (keeps container alive)

### SeedDemo Script

Creates a realistic demo scenario:
- **Financier** deposits 500,000 USDC into LiquidityPool
- **10 invoices** across 3 suppliers and 2 buyers:
  - 2 **Paid** (full cycle — generates yield, populates history)
  - 3 **Funded** (active — shows pool utilization)
  - 2 **FundingApproved** (ready for supplier to trigger)
  - 2 **Approved** (awaiting operator)
  - 1 **Pending** (awaiting buyer)

### Backend Indexer

On startup, the indexer:
1. Runs `prisma db push` (ensures schema is up to date)
2. Runs `reset-db` (clears stale data from previous Anvil runs)
3. Starts the indexer from block 0

The `poolIndexer.ts` now dynamically selects the chain definition based on `CHAIN_ID`:
- `31337` → Anvil chain
- `5042002` → Arc Testnet

## Deterministic Contract Addresses

These addresses are always the same on Anvil (deterministic from Account 0 nonce):

```
USDC:             0x5FbDB2315678afecb367f032d93F642f64180aa3
LiquidityPool:    0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
InvoiceDiamond:   0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6
ExecutionPool:    0x610178dA211FEF7D417bC0e6FeD39F05609AD788
```

## Railway Deployment

### 1. Anvil Service

- **Type**: Docker builder
- **Root directory**: `/` (repo root, since Dockerfile needs `COPY contracts/`)
- **Dockerfile path**: `anvil/Dockerfile`
- **Generate public domain** (HTTPS) — this becomes the RPC URL
- **Env vars**: None needed (`$PORT` is auto-injected by Railway)

### 2. Frontend Service

```
NEXT_PUBLIC_ENV=local
NEXT_PUBLIC_RPC_URL=https://<anvil-service>.railway.app
NEXT_PUBLIC_USDC_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
NEXT_PUBLIC_INVOICE_DIAMOND_ADDRESS=0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6
NEXT_PUBLIC_EXECUTION_POOL_ADDRESS=0x610178dA211FEF7D417bC0e6FeD39F05609AD788
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<existing>
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

### 3. Backend Service

```
RPC_URL=https://<anvil-service>.railway.app
CHAIN_ID=31337
LIQUIDITY_POOL_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
START_BLOCK=0
POLLING_INTERVAL=5000
BATCH_SIZE=1000
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

## Test Accounts

Import these private keys into MetaMask to interact with the demo:

| Role | Account | Address | Private Key |
|------|---------|---------|-------------|
| Deployer/Operator | 0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| Financier (LP) | 1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| Supplier 1 | 2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |
| Supplier 2 | 3 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` |
| Supplier 3 | 4 | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | `0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a` |
| Buyer 1 | 7 | `0x14dC79964da2C08b23698B3D3cc7Ca32193d9955` | `0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356` |
| Buyer 2 | 9 | `0xa0Ee7A142d267C1f36714E4a8F75612F20a79720` | `0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6` |

### MetaMask Network Configuration

| Field | Value |
|-------|-------|
| Network Name | Anvil (Railway) |
| RPC URL | `https://<anvil-service>.railway.app` |
| Chain ID | `31337` |
| Currency Symbol | `ETH` |

## Redeploying

If the Anvil service restarts (e.g., Railway redeploy), all blockchain state is lost. The startup script automatically redeploys contracts and reseeds data. The backend's `reset-db` script clears stale PostgreSQL data on each restart.

To force a redeploy: restart the Anvil service in Railway dashboard. The backend and frontend will automatically reconnect.

## Testing

1. **Local smoke test**: Start Anvil locally, run `DeployLocal.s.sol` + `SeedDemo.s.sol`, start frontend with `NEXT_PUBLIC_ENV=local`
2. **Browser test**: Connect MetaMask to Railway Anvil URL, import a test account, verify USDC balance
3. **Dashboard verification**: Navigate all 4 dashboards (financier, supplier, buyer, operator)
4. **Live flow test**: Create new invoice → approve → fund → repay (full lifecycle)
5. **Indexer test**: Verify database populates with share price snapshots and transaction history

## Related Files

- `contracts/script/DeployLocal.s.sol` — Base deployment script
- `contracts/script/TestWorkflowExtensive.s.sol` — Full 20-invoice workflow test (reference)
- `docs/development/29_arc_blocklist_precompile_bug.md` — The bug that prompted this setup
- `docs/development/24_railway_deployment.md` — Original Railway deployment (Arc Testnet)
