# Seed Finance

**Decentralized Reverse Factoring Protocol on Arc Chain**

On-chain supply chain finance — suppliers get paid instantly, buyers keep their payment terms, LPs earn yield on USDC.

![Solidity](https://img.shields.io/badge/Solidity-0.8.26-363636?logo=solidity)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=next.js)
![Foundry](https://img.shields.io/badge/Foundry-Testing-orange)
![USDC](https://img.shields.io/badge/USDC-Settlement-2775CA?logo=circle)
![Arc Chain](https://img.shields.io/badge/Arc-Chain-00D4AA)

---

## What is Seed Finance?

Suppliers typically wait **30–60 days** to get paid after delivering goods. This cash flow gap kills small businesses and slows supply chains globally.

Seed Finance solves this with **on-chain reverse factoring**: once a buyer approves an invoice, the supplier can receive immediate USDC payment from a liquidity pool — no banks, no intermediaries, no 5-day settlement windows.

| Participant | What They Get |
|---|---|
| **Suppliers** | Instant payment on approved invoices (T+0 instead of T+30-60) |
| **Buyers** | Keep original payment terms — pay at maturity as usual |
| **Liquidity Providers** | Earn yield on USDC through automatic share price appreciation |
| **Operators** | Approve and fund invoices, manage pool parameters, earn protocol fees |

---

## How It Works

```
Supplier creates invoice → Buyer approves → Pool funds supplier → Buyer repays at maturity
```

**Concrete example — a $50,000 invoice with 30-day terms and 1% discount:**

| Step | Action | USDC Flow |
|------|--------|-----------|
| 1 | Supplier creates invoice for $50,000 | — |
| 2 | Buyer approves the invoice on-chain | — |
| 3 | Operator triggers funding from LP pool | 49,500 USDC → Supplier |
| 4 | Supplier receives early payment (minus discount) | Supplier has 49,500 USDC |
| 5 | Buyer repays at maturity (Day 30) | 50,000 USDC → Pool |
| 6 | LPs earn the $500 discount via share price increase | SEED shares worth more |

The LP vault uses the **ERC-4626** standard — depositors receive SEED share tokens that automatically appreciate as fees accumulate. No manual claiming needed.

---

## User Roles

### Supplier
Creates invoices for delivered goods/services. Once a buyer approves, the supplier can receive immediate payment from the liquidity pool instead of waiting for payment terms.

### Buyer
Reviews and approves supplier invoices on-chain. Approval signals creditworthiness to the pool. The buyer repays the original invoice amount at the maturity date — no extra fees.

### Liquidity Provider (Financier)
Deposits USDC into the ERC-4626 vault and receives SEED share tokens. Earns yield from invoice discount fees. Can withdraw at any time (subject to available liquidity).

### Operator
Approves invoices for funding, triggers funding operations, manages pool parameters, and oversees treasury strategy allocation. The operational backbone of the protocol.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SEED FINANCE (ARC CHAIN)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 1: CAPITAL                                               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  LiquidityPool (ERC-4626)  │  TreasuryManager  │  SEED    │ │
│  │  LP deposits & withdrawals │  Yield strategies  │  Shares  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            │                                    │
│                            ▼                                    │
│  Layer 2: CREDIT                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  InvoiceDiamond (EIP-2535)  │  ExecutionPool  │  Router    │ │
│  │  Invoice lifecycle mgmt     │  USDC holding    │  Batching │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            │                                    │
│                            ▼                                    │
│  Layer 3: SETTLEMENT                                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Circle Wallets (SCA)  │  Circle Gateway  │  CCTP Bridge   │ │
│  │  Business accounts     │  Fiat on/off-ramp │  Cross-chain  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Layer 1 — Capital:** LPs deposit USDC into an ERC-4626 vault. Idle capital is routed to yield strategies (e.g., Hashnote USYC T-Bills) via the TreasuryManager.

**Layer 2 — Credit:** Invoices are managed through a Diamond proxy (EIP-2535) with modular facets. The ExecutionPool holds USDC for active funding/repayment operations. The PaymentRouter orchestrates batch operations.

**Layer 3 — Settlement:** Circle Wallets provide developer-controlled smart contract accounts for business users. Circle Gateway enables fiat on/off-ramp. CCTP enables cross-chain USDC deposits from Ethereum, Arbitrum, Polygon, and other chains.

---

## Circle Integrations

| Integration | Purpose |
|---|---|
| **USDC** | Native settlement currency on Arc chain (6 decimals ERC-20) |
| **CCTP** | Cross-chain USDC deposits — burn on source chain, mint on Arc |
| **Circle Gateway** | Bank ↔ USDC fiat on/off-ramp for businesses |
| **Circle Wallets** | Developer-controlled smart contract accounts (SCA) for buyers/suppliers |

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Blockchain** | Arc chain (Circle's L1 for stablecoin finance) |
| **Contracts** | Solidity 0.8.26, Foundry, ERC-4626, EIP-2535 Diamond |
| **Frontend** | Next.js 14, React 18, Tailwind CSS, Wagmi, Viem, RainbowKit |
| **Backend** | TypeScript, Viem, Prisma, Circle SDK |
| **Database** | PostgreSQL (via Prisma) |
| **Token** | USDC (6 decimals) |

---

## Project Structure

```
seed-finance/
├── contracts/                      # Foundry smart contracts
│   ├── src/
│   │   ├── base/                       # LiquidityPool, TreasuryManager
│   │   ├── invoice/                    # InvoiceDiamond, ExecutionPool, PaymentRouter
│   │   │   ├── facets/                     # Invoice, Funding, Repayment, View, Admin
│   │   │   └── libraries/                  # Diamond storage
│   │   ├── integrations/               # CCTPReceiver, SmartRouter
│   │   ├── interfaces/                 # Contract interfaces
│   │   └── strategies/                 # USYCStrategy, CrossChain strategies
│   ├── test/                           # 20 test files (unit, fuzz, invariant, integration)
│   └── script/                         # Deployment & test workflow scripts
│
├── frontend/                       # Next.js 14 application
│   ├── app/
│   │   ├── dashboard/
│   │   │   ├── financier/                  # LP: deposit, withdraw, portfolio, analytics
│   │   │   ├── supplier/                   # Create & track invoices
│   │   │   ├── buyer/                      # Approve invoices, repayments, history
│   │   │   └── operator/                   # Funding ops, pool admin, treasury
│   │   └── api/                            # Pool & user data API routes
│   ├── abis/                           # Contract ABIs
│   ├── components/                     # UI, layout, dashboard, CCTP, charts
│   ├── hooks/                          # Contract, invoice, operator, CCTP hooks
│   ├── lib/config/                     # Chain config, contract addresses, env
│   ├── stores/                         # Zustand state management
│   └── types/                          # TypeScript interfaces
│
├── backend/                        # TypeScript services
│   ├── services/                       # Invoice, Funding, Repayment, Circle integrations
│   ├── src/indexer/                    # Blockchain event indexer (pool, user)
│   ├── api/webhooks/                   # Circle Gateway webhook handlers
│   └── types/                          # Shared type definitions
│
├── docs/
│   └── development/                    # 30 implementation guides (numbered)
│
└── strategic-documents/            # Business strategy & planning
```

---

## Smart Contracts

### Layer 1 — Capital

| Contract | Description |
|----------|-------------|
| `LiquidityPool.sol` | ERC-4626 vault — LP deposits, SEED share tokens, yield distribution |
| `TreasuryManager.sol` | Routes idle capital to yield strategies, manages allocations |
| `USYCStrategy.sol` | Hashnote USYC (T-Bill) yield strategy for idle capital |
| `BaseTreasuryStrategy.sol` | Abstract base for all treasury strategies |

### Layer 2 — Credit

| Contract | Description |
|----------|-------------|
| `InvoiceDiamond.sol` | Diamond proxy (EIP-2535) — upgradeable invoice management |
| `InvoiceFacet.sol` | Create, approve, cancel invoices |
| `FundingFacet.sol` | Request and process invoice funding |
| `RepaymentFacet.sol` | Process buyer repayments at maturity |
| `ViewFacet.sol` | Read-only queries for invoice data |
| `AdminFacet.sol` | Admin operations and configuration |
| `ExecutionPool.sol` | Holds USDC during active funding/repayment operations |
| `PaymentRouter.sol` | Orchestration and batch operations |

### Layer 3 — Settlement

| Contract | Description |
|----------|-------------|
| `CCTPReceiver.sol` | Receives cross-chain USDC transfers via Circle CCTP |
| `SmartRouter.sol` | Route optimization for deposits and settlements |

---

## Frontend Dashboards

### Financier (LP) Dashboard
Deposit USDC, withdraw shares, view portfolio breakdown, track share price history, and analyze pool performance with charts.

**Pages:** Overview · Deposit · Withdraw · Portfolio · Analytics · Transactions

### Supplier Dashboard
Create invoices for delivered goods, track invoice status through the lifecycle, and view payment details.

**Pages:** Overview · Invoice List · Create Invoice · Invoice Detail

### Buyer Dashboard
Review pending invoices, approve for funding, track repayment obligations, and view payment history.

**Pages:** Overview · Invoices · Repayments · History

### Operator Dashboard
Trigger funding for approved invoices, manage pool parameters, configure treasury strategy allocations, and monitor system config.

**Pages:** Overview · Invoices · Invoice Detail · Pool · Treasury · Config

---

## Backend Services

| Service | Responsibility |
|---------|---------------|
| `InvoiceService` | Invoice lifecycle management and state tracking |
| `FundingService` | Funding orchestration — moves USDC from pool to supplier |
| `RepaymentService` | Repayment processing at invoice maturity |
| `CircleWalletsService` | Circle developer-controlled wallet (SCA) integration |
| `CircleGatewayService` | Fiat on/off-ramp via Circle Gateway |
| `DepositRoutingService` | Routes LP deposits, handles cross-chain CCTP flows |

**Indexer:** Blockchain event listener that indexes pool state changes and user activity into PostgreSQL for fast API queries.

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 20.0.0
- **Foundry** ([install](https://book.getfoundry.sh/getting-started/installation))
- **PostgreSQL** (for indexer/API)

### Install & Run

```bash
# Clone
git clone https://github.com/your-org/seed-finance.git
cd seed-finance

# Contracts — build & test
cd contracts
forge install
forge build
forge test

# Frontend — development server
cd ../frontend
npm install
npm run dev          # http://localhost:3000

# Backend — indexer
cd ../backend
npm install
cp .env.example .env # Edit with your values
npx tsx src/indexer/runIndexer.ts
```

### Environment Variables

**Frontend** (`frontend/.env.local`):
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/seed_finance
```

**Backend** (`backend/.env`):
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/seed_finance
RPC_URL=https://rpc.testnet.arc.network
CHAIN_ID=5042002
LIQUIDITY_POOL_ADDRESS=0xb67db96eebf1d30d95a382535afbb2375ecf0219
USDC_ADDRESS=0x3600000000000000000000000000000000000000
INVOICE_DIAMOND_ADDRESS=0xe73911fbe91a0f76b20b53a8bd7d4c84c5532da6
EXECUTION_POOL_ADDRESS=0xf1389407cb618990b838d549c226de9ec2d447f0
```

---

## Testing

The contracts have **20 test files** covering unit, integration, fuzz, and invariant tests.

```bash
cd contracts

# Run all tests
forge test

# Run with verbosity
forge test -vvv

# Run specific test file
forge test --match-path test/LiquidityPool.t.sol

# Run fuzz tests
forge test --match-path test/fuzz/

# Run invariant tests
forge test --match-path test/invariant/

# Gas report
forge test --gas-report
```

**Test categories:**
- **Unit tests** — Individual contract functions (LiquidityPool, InvoiceFacet, FundingFacet, etc.)
- **Integration tests** — Full invoice lifecycle end-to-end
- **Fuzz tests** — Randomized inputs for discount calculation, share price, invoice lifecycle
- **Invariant tests** — System-wide invariants for pool and invoice state
- **Cross-chain tests** — CCTP and cross-chain treasury operations

### Local Anvil Setup

```bash
# Start local fork
anvil

# Deploy locally
forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

# Run full test workflow
forge script script/TestWorkflowExtensive.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

---

## Key Addresses (Arc Testnet)

| Resource | Value |
|----------|-------|
| **USDC** | `0x3600000000000000000000000000000000000000` |
| **USYC** | `0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C` |
| **LiquidityPool** | `0xb67db96eebf1d30d95a382535afbb2375ecf0219` |
| **TreasuryManager** | `0x61AD0D0E1fe544303F9d60D966A983052eFa46e9` |
| **InvoiceDiamond** | `0xe73911fbe91a0f76b20b53a8bd7d4c84c5532da6` |
| **ExecutionPool** | `0xf1389407cb618990b838d549c226de9ec2d447f0` |
| **Chain ID** | 5042002 |
| **RPC** | `https://rpc.testnet.arc.network` |
| **Explorer** | [testnet.arcscan.app](https://testnet.arcscan.app) |
| **Faucet** | [faucet.circle.com](https://faucet.circle.com) |

---

## Documentation

- [Technical Implementation Guide](./CLAUDE.md) — Architecture specs and development workflow
- [Development Guides](./docs/development/) — 30 numbered implementation docs covering every feature

Key development docs:
- [Architecture](./docs/development/03_liquidity_pool_treasury_manager.md) — Pool & treasury design
- [Invoice System](./docs/development/10_supplier_buyer_invoice_system.md) — Invoice lifecycle
- [CCTP Integration](./docs/development/09_circle_cctp_integration.md) — Cross-chain deposits
- [Arc Migration](./docs/development/20_arc_chain_migration.md) — Migration from Base to Arc
- [Arc Testnet Deployment](./docs/development/22_arc_testnet_deployment.md) — Deployment guide
- [Operator Dashboard](./docs/development/06_operator_dashboard.md) — Funding operations UI

---

## License

MIT

---

*Built for the future of supply chain finance — on Arc chain.*
