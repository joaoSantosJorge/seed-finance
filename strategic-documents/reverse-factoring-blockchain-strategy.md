# Seed Finance — Strategic Product Blueprint

## Decentralized Reverse Factoring on Base L2

**Version 4.0 | January 2026**

---

## Executive Summary

Seed Finance is a decentralized reverse factoring protocol built on **Base L2** with Circle integration:

- **Single-chain deployment** on Base for simplicity and speed to market
- **Circle Wallets** for business user abstraction
- **Circle Gateway** for fiat on/off-ramp settlement
- **ERC-4626 vault** for LP deposits with automatic yield distribution

**Target Market:** $739B reverse factoring market (2026), growing at 10.9% CAGR to $1.89T by 2035.

---

## Part 1: Why Base-Only Architecture

### Architecture Evolution

| Version | Design | Reason |
|---------|--------|--------|
| V1 | Sui + Arc | Move language exploration |
| V2 | Arc + Base | Hackathon prize alignment |
| V3 | Arc + Base | Dual-chain with CCTP V2 |
| **V4** | **Base only** | **Production optimization** |

### Why We Chose Base-Only

| Factor | Arc + Base | Base Only | Winner |
|--------|------------|-----------|--------|
| Dev Time | 6-8 weeks | 2-3 weeks | Base |
| Audit Scope | 2 chains | 1 chain | Base |
| Bridge Risk | CCTP dependency | None | Base |
| Circle Tools | Both have | Both have | Tie |
| Complexity | Higher | Lower | Base |

**Conclusion:** Base-only delivers the same functionality with lower risk and faster time to market.

See [Architecture Analysis](../docs/01_architecture_analysis.md) for detailed rationale.

---

## Part 2: System Architecture

### Layer Responsibilities

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SEED FINANCE LAYERS (BASE L2)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     LAYER 1: CAPITAL (Base)                            │  │
│  │  • LiquidityPool.sol — ERC-4626 vault for LP deposits                 │  │
│  │  • SEED share tokens — Automatic yield distribution                 │  │
│  │  • TreasuryManager.sol — USYC yield optimization (optional)          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     LAYER 2: CREDIT (Base)                             │  │
│  │  • InvoiceRegistry.sol — Invoice lifecycle management                 │  │
│  │  • ExecutionPool.sol — USDC holding for funding                       │  │
│  │  • PaymentRouter.sol — Funding and repayment logic                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                   LAYER 3: SETTLEMENT (Circle)                         │  │
│  │  • Circle Gateway — USDC ↔ Fiat conversion                            │  │
│  │  • Circle Wallets — Programmable wallets for companies                │  │
│  │  • No crypto UX for buyers/suppliers                                  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Complete Transaction Flow

```
PHASE 1: LIQUIDITY DEPOSIT
──────────────────────────
LP deposits USDC → Base LiquidityPool → SEED tokens

PHASE 2: INVOICE CREATION
─────────────────────────
Supplier → Circle Wallet → Base: InvoiceRegistry.createInvoice()
                                 │
                                 ▼
                         Invoice Created (PENDING)

PHASE 3: BUYER APPROVAL
───────────────────────
Buyer → Circle Wallet → Base: InvoiceRegistry.approveInvoice()
                              │
                              ▼
                      Invoice status: APPROVED
                      Event: InvoiceApproved

PHASE 4: FUNDING
────────────────
Backend detects InvoiceApproved event
        │
        ▼
Base: PaymentRouter.requestFunding()
        │
        ▼
LiquidityPool.deployForFunding() → ExecutionPool
        │
        ▼
ExecutionPool.fundInvoice() → USDC to Supplier
        │
        ▼
Invoice status: FUNDED

PHASE 5: SUPPLIER PAYOUT
────────────────────────
Supplier's Circle Wallet → Circle Gateway → Bank Account
                          (USDC → Fiat)

PHASE 6: BUYER REPAYMENT (at maturity)
──────────────────────────────────────
Buyer's Bank → Circle Gateway → Buyer's Circle Wallet
              (Fiat → USDC)
                                       │
                                       ▼
                       Base: ExecutionPool.receiveRepayment()
                                       │
                                       ▼
                       Invoice status: PAID

PHASE 7: YIELD DISTRIBUTION
───────────────────────────
ExecutionPool → LiquidityPool.receiveRepayment(principal, yield)
                       │
                       ▼
               SEED share value increases
               LPs earn yield automatically
```

---

## Part 3: Smart Contract Design

### Contract Overview

| Contract | Purpose |
|----------|---------|
| `LiquidityPool.sol` | ERC-4626 vault for LP deposits, yield distribution |
| `InvoiceRegistry.sol` | Invoice CRUD, status lifecycle, access control |
| `ExecutionPool.sol` | USDC holding, funding, repayment processing |
| `PaymentRouter.sol` | Orchestration, batch operations, fee management |
| `TreasuryManager.sol` | USYC yield for idle capital (Phase 2) |

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| ERC-4626 vault | Standard interface, automatic yield via share price |
| Access control | Role-based (EXECUTOR_ROLE, ROUTER_ROLE, OPERATOR_ROLE) |
| Events for everything | Backend integration via event listeners |
| Single-chain | Eliminates bridge complexity and risk |

---

## Part 4: Circle Integration

### Circle Wallets

**Purpose:** Abstract crypto for business users

```
User Registration:
1. User signs up with email
2. Backend creates Circle Wallet (SCA - Smart Contract Account)
3. Wallet address stored in user profile
4. All transactions signed by Circle (developer-controlled)

Wallet Types:
├── Buyer Wallet — Holds USDC for repayments
├── Supplier Wallet — Receives funding, off-ramps to fiat
└── LP Wallet — (Optional) Non-custodial via RainbowKit
```

### Circle Gateway

**Purpose:** Fiat on/off-ramp

```
On-Ramp (Buyer Repayment):
1. Buyer initiates bank transfer
2. Gateway converts USD → USDC
3. USDC deposited to Buyer's Circle Wallet
4. Backend triggers repayment on Base

Off-Ramp (Supplier Payout):
1. Supplier's Circle Wallet holds USDC
2. Supplier requests payout
3. Gateway converts USDC → USD
4. Wire transfer to Supplier's bank
```

---

## Part 5: Competitive Advantages

### vs Traditional Banks

| Metric | Banks | Seed Finance |
|--------|-------|--------------|
| Settlement | T+2-5 | T+0 |
| Min Invoice | $50K+ | $1K |
| Cross-Border | 2-3% forex | 0.1% |
| Hours | Business | 24/7/365 |
| Transparency | Opaque | Full on-chain |
| Access | Large corps only | Anyone |

### vs Fintech Competitors

| Metric | Fintechs | Seed Finance |
|--------|----------|--------------|
| Custody | Custodial | Non-custodial |
| Lock-in | High | Portable credit |
| Fees | 2-4% | 0.5-1.5% |
| Composability | None | Full DeFi |
| Audit | Trust us | Verify on-chain |

### Unique Blockchain Advantages

1. **Immutable Invoice Registry** — Zero double-financing fraud
2. **Programmable Payments** — Auto-execute at maturity
3. **Composable LP Tokens** — Use SEED as collateral elsewhere
4. **Portable Credit History** — On-chain reputation
5. **Global Liquidity** — Access DeFi ecosystem

---

## Part 6: Go-to-Market Strategy

### Phase 1: Crypto-Native (MVP Launch)

**Target:** DAOs, crypto exchanges, Web3 companies
**Why:** Already have USDC, understand crypto
**Approach:**
- Partner with DAO treasuries
- Integrate with crypto payroll
- Target exchange supplier payments

### Phase 2: SME Networks (6-12 months)

**Target:** E-commerce, gig platforms, SaaS
**Why:** High invoice volume, underserved
**Approach:**
- Shopify/Stripe partnerships
- Fiat on/off-ramps (Circle Gateway)
- Simplified UX (Circle Wallets)

### Phase 3: Enterprise (12-24 months)

**Target:** Mid-market companies ($100M-$1B)
**Why:** Large invoice volumes, ESG mandates
**Approach:**
- ERP integrations (SAP, Oracle)
- Compliance certifications
- White-label partnerships

---

## Part 7: Revenue Model

### Fee Structure

| Fee Type | Amount | Split |
|----------|--------|-------|
| Financing Fee | 0.5-2% of invoice | 80% LPs, 20% protocol |
| Early Payment Fee | 0.1% | 100% protocol |
| Settlement Fee | 0.05% | 100% protocol |

### Example Transaction

```
Invoice: $100,000
Terms: Net 60, Early payment Day 10
Annual Rate: 8%

Supplier Receives:
├── Days Financed: 50
├── Discount: 8% × (50/365) = 1.1%
├── Amount: $100,000 - $1,100 = $98,900

Fee Distribution:
├── LPs: $880 (80% of $1,100)
├── Protocol: $220 (20% of $1,100)
└── Settlement: $50 (0.05%)
```

### Projections

| Year | Invoice Volume | Revenue |
|------|----------------|---------|
| 1 | $50M | $600K |
| 2 | $500M | $5M |
| 3 | $2B | $16M |
| 4 | $10B | $70M |

---

## Part 8: Development Phases

### Phase 1: MVP (2-3 weeks)
- [ ] Set up monorepo (Turborepo)
- [ ] Deploy Base contracts to Sepolia
- [ ] Set up Circle SDK integration
- [ ] Basic API structure
- [ ] Invoice creation + approval flow
- [ ] LP deposit/withdraw flow
- [ ] Circle Wallet integration
- [ ] Frontend dashboards

### Phase 2: Production Polish (2-3 weeks)
- [ ] Circle Gateway integration (fiat on/off-ramp)
- [ ] End-to-end testing
- [ ] Security audit
- [ ] Mainnet deployment

### Phase 3: Optimization (If Needed)
- [ ] TreasuryManager for USYC yield
- [ ] CCTP integration for multi-chain LPs
- [ ] Advanced credit scoring

---

## Part 9: Key Metrics

### Success Indicators

| Metric | MVP Target | 6-Month Target |
|--------|------------|----------------|
| TVL | $100K | $5M |
| Invoices Funded | 10 | 500 |
| Unique Suppliers | 5 | 100 |
| Unique Buyers | 5 | 50 |
| LP Count | 10 | 100 |
| Default Rate | <2% | <1% |

### Technical Metrics

| Metric | Target |
|--------|--------|
| Transaction Finality | <5 seconds |
| Gas Cost per TX | <$0.01 |
| Uptime | 99.9% |
| API Response Time | <200ms |

---

## Conclusion

Seed Finance leverages Base L2 and Circle's infrastructure to deliver a superior reverse factoring experience:

1. **Single-chain simplicity** — All contracts on Base, no bridge risk
2. **Circle integration** — Wallets, Gateway, USDC natively supported
3. **Non-custodial** — Smart contracts only, no intermediary custody
4. **Global scale** — Cross-border without friction
5. **Fast to market** — 2-3 weeks to MVP

**The result:** A reverse factoring protocol that's faster, cheaper, and more transparent than any alternative.

---

*Document Version 4.0*
*Updated January 2026*
*Base-Only Production Architecture*
