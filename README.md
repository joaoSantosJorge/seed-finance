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
│  │           LP Vault — SEED share tokens                   │  │
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

1. **LPs deposit USDC** to LiquidityPool on Base → receive SEED shares
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
| Frontend | Vite + React 19, Tailwind CSS |

---

## Project Structure

```
seed-finance/
├── dashboard/              # Vite + React frontend
│   └── src/
│       └── ReverseFactoringDashboard.jsx
├── docs/
│   ├── 01_architecture_analysis.md
│   ├── BASE-REFERENCE.md
│   └── archive/
│       └── ARC-REFERENCE.md  # Historical reference
├── strategic-documents/
│   └── reverse-factoring-blockchain-strategy.md
├── CLAUDE.md               # Technical implementation guide
└── README.md
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

### Development Guides

- [Liquidity Pool & Treasury Manager](./docs/development/03_liquidity_pool_treasury_manager.md) — Smart contract design
- [Financier Dashboard UI](./docs/development/04_financier_lp_dashboard_ui.md) — UI/UX specification
- [Environment Configuration](./docs/development/05_centralized_env_config.md) — Local/testnet/production setup
- [Manual Testing Guide](./docs/development/06_financier_dashboard_manual_testing.md) — LP Dashboard testing checklist

---

## Implemented Features

- [x] Base-only architecture analysis
- [x] LiquidityPool and TreasuryManager smart contracts (Foundry)
- [x] Financier (LP) Dashboard UI (Next.js 14 + RainbowKit)
- [x] Centralized environment configuration (local/testnet/production)
- [x] Manual testing guide for LP Dashboard
- [ ] Circle Wallet integration
- [ ] Circle Gateway integration
- [ ] InvoiceRegistry, ExecutionPool, PaymentRouter contracts
- [ ] Buyer/Supplier dashboards
- [ ] End-to-end testing

---

## License

MIT

---

*Built for the future of supply chain finance.*
