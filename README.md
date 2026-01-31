# Seed Finance

**Decentralized Reverse Factoring Protocol**

Supply chain finance infrastructure where USDC liquidity is chain-abstracted via Arc, invoices execute on Sui, and payouts settle through Circle Gateway.

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
                    ┌─────────────────────┐
                    │  Liquidity Providers │
                    │   (Deposit USDC)     │
                    └──────────┬──────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────┐
│                    ARC (Circle L1)                    │
│          Chain-Abstracted USDC Liquidity Hub         │
└──────────────────────────┬───────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │    Cross-Chain Bridge    │
              │     (Circle CCTP)        │
              └────────────┬────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────┐
│                   SUI BLOCKCHAIN                      │
│           Credit Execution Layer (Move)              │
│    Invoice Objects | Approvals | Funding Logic       │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────┐
│                  CIRCLE GATEWAY                       │
│           USDC ↔ Fiat Settlement                     │
│    Supplier bank payouts | Buyer repayments          │
└──────────────────────────────────────────────────────┘
```

---

## How It Works

1. **LPs deposit USDC** on Arc (from any chain)
2. **Supplier creates invoice** on Sui
3. **Buyer approves invoice** on Sui
4. **Capital routes from Arc → Sui** to fund invoice
5. **Supplier receives fiat** via Circle Gateway (no crypto UX)
6. **Buyer repays at maturity** via Circle Gateway
7. **Capital returns to Arc** with yield for LPs

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Liquidity Hub | Arc (Circle L1) — Solidity |
| Credit Logic | Sui — Move |
| Bridging | Circle CCTP |
| Fiat Rails | Circle Gateway |
| User Wallets | Circle Wallets |
| Frontend | Next.js 14, RainbowKit |

---

## Project Structure

```
seed-finance/
├── contracts/
│   ├── arc/          # Solidity contracts for Arc
│   └── sui/          # Move contracts for Sui
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # Backend API
├── packages/
│   └── shared/       # Shared types and utilities
├── dashboard/        # Strategy visualization
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
npm run deploy:arc-testnet
npm run deploy:sui-devnet
```

---

## Circle Prize Submission

This project targets:

- **Best Chain-Abstracted USDC Apps Using Arc as a Liquidity Hub** ($5,000)
- **Build Global Payouts and Treasury Systems with USDC on Arc** ($2,500)

### Required Circle Tools Used:
- Arc — Liquidity aggregation
- Circle Gateway — Fiat on/off-ramp
- Circle Wallets — User abstraction
- USDC — All internal operations
- Bridge Kit — Multi-chain LP deposits

---

## Documentation

- [Technical Implementation Guide](./CLAUDE.md) — Detailed specs
- [Strategy Document](./strategic-documents/reverse-factoring-blockchain-strategy.md)
- [Interactive Dashboard](./dashboard/) — Visual architecture

---

## License

MIT

---

*Built for the future of supply chain finance.*
