# Seed Finance — Technical Implementation Guide

> **This document is the single source of truth for building Seed Finance.**
> Claude: Always read this before implementing any feature.

---

## Development Workflow (MANDATORY)

**Every implementation task MUST follow these two requirements:**

### Requirement 1: Branch-Based Development

```
1. CREATE BRANCH    → git checkout -b feature/descriptive-name
2. WRITE CODE       → Implement the feature on the branch
3. RUN TESTS        → Execute all relevant tests
4. VERIFY           → Ensure all tests pass and no regressions
5. COMMIT           → git add <files> && git commit -m "descriptive message"
6. PUSH             → git push -u origin feature/descriptive-name
7. MERGE            → git checkout master && git merge feature/descriptive-name && git push
```

**Branch naming conventions:**
- `feature/` — New functionality (e.g., `feature/lp-withdraw-flow`)
- `fix/` — Bug fixes (e.g., `fix/invoice-status-update`)
- `refactor/` — Code improvements (e.g., `refactor/diamond-storage`)
- `docs/` — Documentation only (e.g., `docs/api-endpoints`)

**Never commit directly to master. Always use a branch.**

### Requirement 2: Documentation

For every implementation, create or update a document in `/docs/development/`:

```
docs/development/
├── XX_feature_name.md    # Numbered sequentially (01, 02, 03...)
```

**Document structure:**
```markdown
# Feature Name

## Overview
Brief description of what was implemented.

## Changes Made
- List of files created/modified
- Key decisions and why

## How It Works
Technical explanation of the implementation.

## Testing
How to test this feature (commands, expected results).

## Related Files
- contracts/src/...
- frontend/app/...
- backend/services/...
```

**Update existing docs when modifying related features.**

---

## Project Overview

**Seed Finance** is a decentralized **reverse factoring** (supply chain finance) protocol on **Arc chain** (Circle's L1 for stablecoin finance). It solves a fundamental cash flow problem: suppliers typically wait 30-60 days to get paid by buyers. Seed Finance enables suppliers to receive immediate payment on approved invoices while buyers maintain their original payment terms.

### How It Works

1. **Suppliers** create invoices on-chain
2. **Buyers** approve invoices (confirming payment commitment)
3. **Liquidity Providers (LPs)** deposit USDC into an ERC-4626 vault and receive SEED share tokens
4. **Operators** (backend) trigger funding when invoices are approved
5. **Suppliers** receive immediate payment (funded from LP pool)
6. **Buyers** repay at maturity with a fee
7. **LPs** earn yield automatically through increasing share price

### Core Architecture

```
Layer 1: CAPITAL
├── LiquidityPool.sol (ERC-4626 vault for LP deposits)
├── SEED share tokens (automatic yield distribution)
└── TreasuryManager.sol (yield optimization on idle capital)

Layer 2: CREDIT
├── InvoiceDiamond.sol (Diamond proxy - EIP-2535)
│   ├── InvoiceFacet (create, approve, cancel)
│   ├── FundingFacet (request funding)
│   ├── RepaymentFacet (process repayments)
│   └── ViewFacet (read-only queries)
├── ExecutionPool.sol (USDC holding for funding/repayment)
└── PaymentRouter.sol (orchestration, batch operations)

Layer 3: SETTLEMENT
├── Circle Wallets (SCA for business users)
└── Circle Gateway (USDC ↔ Fiat on/off-ramp)
```

### Tech Stack

| Component | Technology |
|-----------|------------|
| **Blockchain** | Arc chain (Testnet / Mainnet) |
| **Contracts** | Solidity 0.8.26, Foundry, ERC-4626, EIP-2535 |
| **Frontend** | Next.js 14, Tailwind CSS, Wagmi, Viem, RainbowKit |
| **Backend** | TypeScript, ethers.js, Circle SDK |
| **Token** | USDC (6 decimals) |

### Key Addresses (Arc Testnet)

- USDC: `0x3600000000000000000000000000000000000000` (system contract, 6 decimals via ERC-20)
- USYC: `0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C`
- Explorer: https://testnet.arcscan.app
- Faucet: https://faucet.circle.com

### Project Structure

```
seed-finance/
│
├── contracts/                          # Foundry smart contracts
│   ├── src/
│   │   ├── base/
│   │   │   ├── LiquidityPool.sol           # ERC-4626 vault for LP deposits
│   │   │   └── TreasuryManager.sol         # Idle capital yield optimization
│   │   │
│   │   ├── invoice/
│   │   │   ├── InvoiceDiamond.sol          # Diamond proxy (EIP-2535)
│   │   │   ├── ExecutionPool.sol           # USDC holding for funding/repayment
│   │   │   ├── PaymentRouter.sol           # Orchestration & batch operations
│   │   │   ├── facets/
│   │   │   │   ├── InvoiceFacet.sol            # Create, approve, cancel
│   │   │   │   ├── FundingFacet.sol            # Request funding
│   │   │   │   ├── RepaymentFacet.sol          # Process repayments
│   │   │   │   ├── ViewFacet.sol               # Read-only queries
│   │   │   │   └── AdminFacet.sol              # Admin operations
│   │   │   └── libraries/
│   │   │       └── LibInvoiceStorage.sol       # Diamond storage layout
│   │   │
│   │   ├── integrations/
│   │   │   ├── CCTPReceiver.sol            # Cross-chain USDC (future)
│   │   │   └── SmartRouter.sol             # Route optimization
│   │   │
│   │   └── strategies/
│   │       ├── BaseTreasuryStrategy.sol    # Strategy interface
│   │       └── USYCStrategy.sol            # Hashnote T-Bill strategy
│   │
│   ├── test/                           # Foundry tests (140+)
│   ├── script/                         # Deployment scripts
│   └── foundry.toml                    # Foundry configuration
│
├── frontend/                           # Next.js 14 application
│   ├── app/
│   │   ├── layout.tsx                  # Root layout with providers
│   │   ├── page.tsx                    # Landing page
│   │   └── dashboard/
│   │       ├── lp/                         # LP analytics & portfolio
│   │       ├── supplier/                   # Supplier invoice management
│   │       ├── buyer/                      # Buyer approvals & repayments
│   │       └── operator/                   # Funding operations
│   │
│   ├── components/
│   │   ├── ui/                         # Reusable UI components
│   │   ├── layout/                     # Layout components
│   │   └── dashboard/                  # Dashboard-specific components
│   │
│   ├── hooks/
│   │   ├── invoice/                    # Invoice read/write hooks
│   │   └── useContract.ts              # Generic contract hooks
│   │
│   ├── lib/
│   │   ├── config/                     # Contract addresses, env config
│   │   └── utils/                      # Utility functions
│   │
│   ├── stores/                         # Zustand state stores
│   ├── types/                          # TypeScript interfaces
│   ├── abis/                           # Contract ABIs (auto-generated)
│   └── package.json
│
├── backend/                            # TypeScript services
│   ├── services/
│   │   ├── InvoiceService.ts           # Invoice lifecycle management
│   │   ├── FundingService.ts           # Funding orchestration
│   │   ├── RepaymentService.ts         # Repayment processing
│   │   ├── CircleWalletsService.ts     # Circle SCA integration
│   │   ├── CircleGatewayService.ts     # Fiat on/off-ramp
│   │   └── DepositRoutingService.ts    # LP deposit routing
│   │
│   ├── src/
│   │   └── indexer/                    # Blockchain event indexing
│   │       ├── poolIndexer.ts              # Pool events
│   │       └── userIndexer.ts              # User activity
│   │
│   ├── api/
│   │   └── webhooks/
│   │       └── circle-gateway.ts       # Circle webhook handlers
│   │
│   └── types/
│       ├── invoice.ts                  # Invoice enums, interfaces
│       ├── history.ts                  # Transaction history types
│       └── index.ts                    # Type exports
│
├── docs/                               # Documentation
│   ├── development/                    # Implementation docs (REQUIRED)
│   │   ├── 01_architecture.md
│   │   ├── 02_liquidity_pool.md
│   │   ├── 03_invoice_system.md
│   │   └── ...
│   └── *.md                            # Architecture & reference docs
│
└── strategic-documents/                # Business strategy & planning
```

### Key Files Reference

| Purpose | Location |
|---------|----------|
| Contract ABIs | `frontend/abis/*.json` |
| Contract addresses | `frontend/lib/config/contracts.ts` |
| Environment config | `frontend/.env.local`, `backend/.env` |
| Invoice types | `backend/types/invoice.ts` |
| Diamond storage | `contracts/src/invoice/libraries/LibInvoiceStorage.sol` |
| Pool configuration | `contracts/src/base/LiquidityPool.sol` |

