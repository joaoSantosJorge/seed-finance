# Railway Deployment

## Overview

Deploy Seed Finance (frontend, backend indexer, PostgreSQL) to Railway for public access. Railway provides a single platform with $5/mo free credit — if total usage stays under $5, you pay $0.

## Changes Made

- `frontend/package.json` — Added `postinstall` script for `prisma generate`
- `backend/package.json` — Added `postinstall` and `start` scripts
- `frontend/railway.toml` — Railway build/deploy configuration
- `backend/railway.toml` — Railway build/deploy configuration
- `frontend/.env.example` — Updated with all required env vars including DATABASE_URL
- `backend/.env.example` — Updated with Arc Testnet defaults and production polling interval

## Architecture

```
Railway Project
├── PostgreSQL (managed database)
├── Frontend (Next.js 14 web service, port 3000)
│   ├── Landing page + dashboards
│   └── API routes (/api/pool/*, /api/user/*) → PostgreSQL
└── Indexer (backend worker, no public URL)
    ├── Polls Arc Testnet for blockchain events
    └── Writes pool/user data → PostgreSQL
```

Both frontend API routes and backend indexer share the same PostgreSQL database.

## How It Works

### Services

| Service | Type | Root Dir | Build Command | Start Command |
|---------|------|----------|---------------|---------------|
| PostgreSQL | Database | — | — | — |
| Frontend | Web | `frontend` | `npm install && npx prisma generate && npm run build` | `npm start` |
| Indexer | Worker | `backend` | `npm install && npx prisma generate` | `npm run indexer` |

### Environment Variables

**Frontend:**
```
NEXT_PUBLIC_ENV=testnet
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<from cloud.walletconnect.com>
NEXT_PUBLIC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS=0xb67db96eebf1d30d95a382535afbb2375ecf0219
NEXT_PUBLIC_INVOICE_DIAMOND_ADDRESS=0xe73911fbe91a0f76b20b53a8bd7d4c84c5532da6
NEXT_PUBLIC_EXECUTION_POOL_ADDRESS=0xf1389407cb618990b838d549c226de9ec2d447f0
DATABASE_URL=${{Postgres.DATABASE_URL}}
PORT=3000
```

**Indexer:**
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
RPC_URL=https://rpc.testnet.arc.network
CHAIN_ID=5042002
LIQUIDITY_POOL_ADDRESS=0xb67db96eebf1d30d95a382535afbb2375ecf0219
START_BLOCK=0
POLLING_INTERVAL=15000
BATCH_SIZE=1000
```

Note: `${{Postgres.DATABASE_URL}}` is Railway's internal reference syntax to link services.

## Deployment Steps

### 1. Create Railway Account & Project

1. Go to railway.com → Sign up with GitHub
2. Add credit card (required for Hobby plan, $5 free credit)
3. Click "New Project"

### 2. Add PostgreSQL

1. Click "+ Add Service" → "Database" → PostgreSQL
2. Wait for provisioning (~30 seconds)
3. Initialize schema from local machine:
   ```powershell
   cd C:\projects\seed-finance\frontend
   $env:DATABASE_URL = "postgresql://..."  # paste Railway's DATABASE_URL
   npx prisma db push
   ```

### 3. Deploy Frontend

1. "+ Add Service" → "GitHub Repo" → select `seed-finance`
2. Set Root Directory: `frontend`
3. Add environment variables (see above)
4. Settings → Networking → "Generate Domain"
5. Settings → Source → Branch: `arc-chain`

### 4. Deploy Indexer

1. "+ Add Service" → "GitHub Repo" → select `seed-finance`
2. Set Root Directory: `backend`
3. Add environment variables (see above)
4. Do NOT generate a domain (worker service)
5. Settings → Source → Branch: `arc-chain`

### 5. Get WalletConnect Project ID

1. Go to cloud.walletconnect.com → Create account → New Project
2. Copy Project ID
3. Update `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` in Railway frontend vars

## Testing

1. Open Railway-generated frontend URL — landing page loads with styles
2. Connect MetaMask — prompts to add Arc Testnet (chain 5042002)
3. Navigate to any dashboard — on-chain data loads
4. Check Railway indexer logs — shows `[Indexer] Polling block...` messages
5. Check analytics pages — historical data populates as indexer runs

## Cost Optimization

- `POLLING_INTERVAL=15000` (15s) reduces indexer CPU usage
- Estimated monthly cost: ~$2-4 (within $5 free credit)
- If usage exceeds $5, you only pay the delta

## Related Files

- `frontend/railway.toml` — Frontend Railway config
- `backend/railway.toml` — Indexer Railway config
- `frontend/.env.example` — Frontend env template
- `backend/.env.example` — Backend env template
- `frontend/prisma/schema.prisma` — Database schema
- `backend/prisma/schema.prisma` — Database schema (copy)
