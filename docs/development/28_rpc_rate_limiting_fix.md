# RPC Rate Limiting Fix (429 Too Many Requests)

## Overview

Fixed `429 Too Many Requests` errors from the public Arc Testnet RPC. The root cause was wagmi/React Query firing 10+ simultaneous RPC calls (balance, contract reads, etc.) on every tab focus, exceeding the public RPC rate limit.

## Changes Made

### 1. Batch JSON-RPC transport (`frontend/lib/wagmi.ts`)
- Added `http(rpcUrl, { batch: true })` transport for each chain
- Combines all simultaneous RPC calls into a single HTTP POST with a JSON array body
- Example: 10 parallel `eth_call` requests become 1 batched request

### 2. Reduced refetch aggressiveness (`frontend/app/providers.tsx`)
- `staleTime: 30s` (was 10s) — data stays fresh longer, fewer redundant refetches
- `refetchOnWindowFocus: false` — prevents burst of 10+ refetches every time user tabs back
- Data still refreshes via the 30s polling interval (`refetchInterval`)

### 3. Wired dRPC endpoint into wagmi transport (`frontend/lib/wagmi.ts`)
- Imported `rpcUrl` from `./config` which reads `NEXT_PUBLIC_RPC_URL` from environment
- Passed `rpcUrl` to `arcTestnet` and `arcMainnet` transports
- Falls back to public RPC when `NEXT_PUBLIC_RPC_URL` is unset (see `env.ts`)
- Anvil transport stays hardcoded (local dev always uses localhost)

### 4. Environment variable (`frontend/.env.local`)
- Added `NEXT_PUBLIC_RPC_URL` placeholder for dRPC endpoint
- `.env.local` is gitignored — API key stays out of the repo

## How It Works

**Before:** Each wagmi hook (`useBalance`, `useReadContract`, etc.) fired its own HTTP request to the RPC. On tab focus, React Query re-validated all queries simultaneously, producing 10+ concurrent requests that triggered the public RPC's rate limiter.

**After:**
1. **Batching** — viem's `batch: true` transport collects all pending RPC calls within a tick and sends them as a single JSON-RPC batch request
2. **Reduced frequency** — `staleTime: 30s` + `refetchOnWindowFocus: false` eliminates the tab-focus burst entirely
3. **Private RPC** — Setting `NEXT_PUBLIC_RPC_URL` routes traffic through a provider with higher rate limits (e.g., dRPC)

## Testing

1. Run `npm run dev` in frontend
2. Open browser console, tab away and back — confirm no 429 errors
3. Check Network tab — RPC calls should be batched (single POST with JSON array body)
4. Data should still refresh every 30 seconds via polling

## Related Files
- `frontend/lib/wagmi.ts` — wagmi config with batch transport
- `frontend/app/providers.tsx` — React Query defaults
- `frontend/lib/config/env.ts` — RPC URL resolution
- `frontend/.env.local` — Environment variables (gitignored)
