# README Fixes & Railway Build Fix

## Overview
Fixed factual errors in README.md about the reverse factoring fee model and resolved a Railway deployment build crash caused by a missing README file path.

## Changes Made
- `README.md` — Corrected 3 factual errors (discount vs fee, buyer role, operator role)
- `CLAUDE.md` — Updated buyer repayment description to match corrected model
- `frontend/README.md` — New file, copy of root README for Railway Docker context
- `frontend/app/page.tsx` — Added try/catch fallback chain for README path resolution

## How It Works

### Content Fixes
The README incorrectly described a fee-based model where the buyer pays extra at maturity. In reality, Seed Finance uses a **discount model**:
- Supplier receives **less than face value** (e.g., $49,500 on a $50,000 invoice with 1% discount)
- Buyer repays the **original invoice amount** ($50,000) — no extra fees
- LPs earn the **$500 spread** between what was funded and what was repaid

### Railway Build Fix
Railway deploys only the `frontend/` subdirectory. The old code used `path.join(process.cwd(), '..', 'README.md')` which resolved to `/README.md` in the container — a path that doesn't exist.

The fix:
1. Copies `README.md` into `frontend/README.md` so it's available in the Docker image
2. Updates `page.tsx` to try `process.cwd()/README.md` first (Railway), then `../README.md` (local dev), with a fallback message if neither exists

## Testing
- `cd frontend && npx next build` — succeeds with no ENOENT errors
- Landing page at `http://localhost:3000` renders the corrected README content
- Verify the "How It Works" table shows supplier receiving $49,500, buyer repaying $50,000

## Related Files
- `README.md` — Root README
- `CLAUDE.md` — Technical implementation guide
- `frontend/README.md` — Copy for Railway deployment
- `frontend/app/page.tsx` — Landing page server component
