# Database, Indexer & API Implementation

## Overview

This document describes the implementation of the database layer, blockchain indexer, and API routes that power the financier dashboard's historical data features.

## Architecture

```
Frontend Hooks ──> Next.js API Routes ──> Prisma ──> PostgreSQL
                                                        ↑
Backend Indexer (long-running process) ─────────────────┘
```

## Changes Made

### Phase 1: Database Setup

**Files Created:**
- `frontend/prisma/schema.prisma` - Database schema with tables for historical data
- `frontend/lib/db/prisma.ts` - Prisma client singleton

**Files Modified:**
- `frontend/package.json` - Added `@prisma/client` and `prisma` dependencies
- `frontend/.env.local` - Added `DATABASE_URL` environment variable

**Database Tables:**
| Table | Purpose |
|-------|---------|
| `share_price_snapshots` | Historical share price data for charts |
| `pool_state_snapshots` | Full pool state (utilization, yields, etc.) |
| `yield_events` | Individual invoice and treasury yield events |
| `user_transactions` | User deposit/withdraw history |
| `user_positions` | Aggregate user position with cost basis |
| `user_share_lots` | FIFO share lot tracking for cost basis |
| `indexer_state` | Indexer resumability tracking |

### Phase 2: API Routes

**Files Created:**
- `frontend/app/api/pool/share-price-history/route.ts` - Share price history endpoint
- `frontend/app/api/pool/state-history/route.ts` - Pool state history endpoint
- `frontend/app/api/user/[address]/transactions/route.ts` - User transaction history
- `frontend/app/api/user/[address]/position/route.ts` - User position and cost basis

**API Endpoints:**
| Endpoint | Method | Parameters | Response |
|----------|--------|------------|----------|
| `/api/pool/share-price-history` | GET | `period=7d\|30d\|90d\|all` | Share price data points + change |
| `/api/pool/state-history` | GET | `period=7d\|30d\|90d\|all` | Pool state data points + yield change |
| `/api/user/:address/transactions` | GET | `limit`, `offset`, `type` | Paginated transactions |
| `/api/user/:address/position` | GET | - | Cost basis, gains, shares |

### Phase 3: Indexer Integration

**Files Created:**
- `backend/package.json` - Backend dependencies (Prisma, viem, tsx)
- `backend/tsconfig.json` - TypeScript configuration
- `backend/.env` - Backend environment variables
- `backend/src/indexer/dbStorage.ts` - Database storage callbacks
- `backend/src/indexer/runIndexer.ts` - Indexer runner script

**Key Features:**
- Connects existing `PoolIndexer` and `UserPositionTracker` to PostgreSQL
- FIFO cost basis tracking via share lots
- Graceful shutdown handling
- Resumable from last processed block

### Phase 4: Frontend Integration

**Files Modified:**
- `frontend/hooks/usePoolHistory.ts` - Connected hooks to API endpoints
- `frontend/app/dashboard/financier/page.tsx` - Uses real share price + activity data
- `frontend/app/dashboard/financier/portfolio/page.tsx` - Uses real share price history
- `frontend/app/dashboard/financier/analytics/page.tsx` - Uses real yield and utilization history

**New Hooks:**
| Hook | Purpose |
|------|---------|
| `useSharePriceHistory(period)` | Fetch share price chart data |
| `usePoolStateHistory(period)` | Fetch pool state chart data (utilization, yield) |
| `useUserTransactionHistory(limit)` | Fetch user's deposit/withdraw history |
| `useUserCostBasis()` | Fetch user's cost basis and gains |

## How It Works

### Data Flow

1. **Events Emitted**: LiquidityPool emits `Deposit`, `Withdraw`, `LiquidityReturned`, `TreasuryYieldAccrued`
2. **Indexer Processes**: `PoolIndexer` polls for new blocks, processes events
3. **Storage Callbacks**: `dbStorage.ts` saves data to PostgreSQL via Prisma
4. **API Serves**: Next.js API routes query Prisma and return formatted data
5. **Hooks Fetch**: React hooks fetch from API routes
6. **Components Render**: Dashboard components display charts with real data

### Cost Basis Calculation (FIFO)

When a user deposits:
1. A new `UserShareLot` is created with shares and cost per share
2. `UserPosition.costBasis` is updated

When a user withdraws:
1. Share lots are consumed in FIFO order
2. Realized gain = assets received - cost basis of consumed shares
3. `UserPosition.realizedGain` is updated

## Setup

### 1. Install Dependencies

```bash
# Frontend
cd frontend && npm install

# Backend
cd ../backend && npm install
```

### 2. Database Setup

```bash
# Create PostgreSQL database
createdb seed_finance

# Generate Prisma client and push schema
cd frontend
npx prisma generate
npx prisma db push
```

### 3. Configure Environment

**frontend/.env.local:**
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/seed_finance
```

**backend/.env:**
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/seed_finance
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337
LIQUIDITY_POOL_ADDRESS=0x...
START_BLOCK=0
POLLING_INTERVAL=5000
BATCH_SIZE=1000
```

### 4. Run Indexer

```bash
cd backend
npm run indexer
```

## Testing

### Verify Database

```bash
cd frontend
npx prisma studio  # Opens database browser at localhost:5555
```

### Test API Endpoints

```bash
# Share price history
curl http://localhost:3000/api/pool/share-price-history?period=7d

# Pool state history
curl http://localhost:3000/api/pool/state-history?period=30d

# User transactions
curl http://localhost:3000/api/user/0x.../transactions?limit=10

# User position
curl http://localhost:3000/api/user/0x.../position
```

### End-to-End Test

1. Start Anvil with deployed contracts
2. Start the indexer: `npm run indexer`
3. Start the frontend: `npm run dev`
4. Make a deposit via the UI
5. Wait for indexer to process (check console logs)
6. Verify transaction appears in `/dashboard/financier/transactions`
7. Verify charts update on portfolio and analytics pages

## Related Files

| Category | Files |
|----------|-------|
| Database | `frontend/prisma/schema.prisma`, `frontend/lib/db/prisma.ts` |
| API Routes | `frontend/app/api/pool/*`, `frontend/app/api/user/*` |
| Indexer | `backend/src/indexer/dbStorage.ts`, `backend/src/indexer/runIndexer.ts` |
| Hooks | `frontend/hooks/usePoolHistory.ts` |
| Dashboard | `frontend/app/dashboard/financier/*.tsx` |
| Types | `backend/types/history.ts` |
