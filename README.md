# Seed Finance

**Decentralized Reverse Factoring Protocol on Base**

Supply chain finance infrastructure where LPs deposit USDC, invoices execute on-chain, and payouts settle through Circle Gateway.

---

## What is Reverse Factoring?

Reverse factoring (also called supply chain finance) allows suppliers to get paid early on approved invoices, while buyers maintain their payment terms. Our protocol makes this:

- **Instant** — T+0 settlement vs T+2-5 with banks
- **Global** — Cross-border without forex friction
- **Transparent** — On-chain audit trail
- **Non-custodial** — Smart contracts, not intermediaries

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SEED FINANCE (BASE L2)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  Liquidity Providers                       │  │
│  │                   (Deposit USDC)                           │  │
│  └─────────────────────────┬─────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                LiquidityPool.sol (ERC-4626)                │  │
│  │           LP Vault — sfUSDC share tokens                   │  │
│  └─────────────────────────┬─────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │    InvoiceRegistry │ ExecutionPool │ PaymentRouter         │  │
│  │        Invoice lifecycle + funding + repayment             │  │
│  └─────────────────────────┬─────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   CIRCLE GATEWAY                           │  │
│  │             USDC ↔ Fiat Settlement                         │  │
│  │      Supplier payouts │ Buyer repayments                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## How It Works

1. **LPs deposit USDC** to LiquidityPool on Base → receive sfUSDC shares
2. **Supplier creates invoice** on Base
3. **Buyer approves invoice** on Base
4. **Invoice funded** from LiquidityPool → USDC to Supplier
5. **Supplier receives fiat** via Circle Gateway (no crypto UX)
6. **Buyer repays at maturity** via Circle Gateway
7. **Yield distributed** — LP share value increases

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Blockchain | Base L2 (Coinbase) |
| Contracts | Solidity (ERC-4626 vault) |
| Fiat Rails | Circle Gateway |
| User Wallets | Circle Wallets |
| Frontend | Next.js 14, RainbowKit |

---

## Project Structure

```
seed-finance/
├── contracts/
│   └── base/             # Solidity contracts for Base
│       ├── LiquidityPool.sol
│       ├── InvoiceRegistry.sol
│       ├── ExecutionPool.sol
│       └── PaymentRouter.sol
├── apps/
│   ├── web/              # Next.js frontend
│   └── api/              # Backend API
├── packages/
│   └── shared/           # Shared types and utilities
├── docs/
│   ├── 01_architecture_analysis.md
│   └── BASE-REFERENCE.md
└── strategic-documents/
```

---

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm run test

# Deploy contracts
npm run deploy:base-sepolia
```

---

## Circle Integration

This project uses Circle tools for seamless fiat integration:

- **Circle Wallets** — Programmable wallets for buyers/suppliers
- **Circle Gateway** — Fiat on/off-ramp for settlements
- **USDC** — All internal operations in native USDC

---

## Why Base?

We chose Base for production deployment because:

- **Simple** — Single-chain deployment, single audit scope
- **Fast** — ~2 second finality, $0.001 per transaction
- **Circle-native** — Deep integration with Circle ecosystem
- **Account Abstraction** — 87% of ERC-4337 activity

See [Architecture Analysis](./docs/01_architecture_analysis.md) for the full decision rationale.

---

## Documentation

- [Technical Implementation Guide](./CLAUDE.md) — Detailed specs
- [Architecture Analysis](./docs/01_architecture_analysis.md) — Why Base-only
- [Base Reference](./docs/BASE-REFERENCE.md) — Network details
- [Strategy Document](./strategic-documents/reverse-factoring-blockchain-strategy.md)

---

## Implemented Features

- [x] Base-only architecture analysis
- [ ] Smart contract implementation
- [ ] Circle Wallet integration
- [ ] Circle Gateway integration
- [ ] Frontend dashboards
- [ ] End-to-end testing

---

## License

MIT

---

*Built for the future of supply chain finance.*
