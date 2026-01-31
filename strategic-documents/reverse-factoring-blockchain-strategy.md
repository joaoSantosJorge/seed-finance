# Seed Finance — Strategic Product Blueprint

## Decentralized Reverse Factoring on Sui + Arc

**Version 2.0 | January 2026**

---

## Executive Summary

Seed Finance is a decentralized reverse factoring protocol built on a dual-chain architecture:

- **Arc (Circle L1)** — Chain-abstracted USDC liquidity hub
- **Sui** — Credit execution layer for invoice lifecycle

This architecture enables us to:
1. Aggregate liquidity from any chain via Arc
2. Execute complex credit logic efficiently on Sui
3. Settle payouts to fiat via Circle Gateway
4. Abstract crypto complexity for business users via Circle Wallets

**Target Market:** $739B reverse factoring market (2026), growing at 10.9% CAGR to $1.89T by 2035.

---

## Part 1: Why This Architecture

### Why Arc?

Arc is Circle's purpose-built L1 blockchain — the "Economic OS for the internet." It provides:

| Feature | Benefit for Seed Finance |
|---------|-------------------------|
| **Native USDC** | No wrapped tokens, direct stablecoin operations |
| **Chain Abstraction** | LPs deposit from any chain, unified liquidity |
| **EVM Compatible** | Familiar Solidity tooling, fast development |
| **Circle Ecosystem** | Native Gateway, Wallets, CCTP integration |
| **Enterprise Grade** | Built for institutional capital markets |

**Arc's Role:** Liquidity aggregation, LP accounting, yield distribution, bridge routing.

### Why Sui?

Sui's object-centric model is ideal for invoice finance:

| Feature | Benefit for Seed Finance |
|---------|-------------------------|
| **Object Model** | Invoices as first-class objects with clear ownership |
| **Fast Finality** | Sub-second confirmation for approval workflows |
| **Move Language** | Strong type safety for financial logic |
| **Parallel Execution** | Handle thousands of invoices concurrently |
| **Low Costs** | Affordable for small invoice amounts |

**Sui's Role:** Invoice registry, approval workflow, credit scoring, funding execution.

### Why Not Single Chain?

| Approach | Problem |
|----------|---------|
| Arc only | Move's object model superior for invoice logic |
| Sui only | Lacks Circle's USDC ecosystem depth |
| EVM L2s | Miss both Arc's abstraction and Sui's object model |

**Dual-chain maximizes strengths of each platform.**

---

## Part 2: System Architecture

### 2.1 Layer Responsibilities

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SEED FINANCE LAYERS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     LAYER 1: CAPITAL (Arc)                             │  │
│  │  • LiquidityPool.sol — ERC-4626 vault for LP deposits                 │  │
│  │  • YieldDistributor.sol — Calculates and distributes yield            │  │
│  │  • BridgeRouter.sol — Routes USDC to Sui via CCTP                     │  │
│  │  • Aggregates USDC from Ethereum, Polygon, Base, Arbitrum...          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      │ CCTP Bridge                           │
│                                      ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     LAYER 2: CREDIT (Sui)                              │  │
│  │  • invoice.move — Invoice object lifecycle                            │  │
│  │  • execution_pool.move — Temporary USDC holding                       │  │
│  │  • payment_router.move — Funding and repayment logic                  │  │
│  │  • credit_oracle.move — On-chain credit scoring                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      │ Circle SDK                            │
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

### 2.2 Complete Transaction Flow

```
PHASE 1: LIQUIDITY DEPOSIT
──────────────────────────
LP (Ethereum)  ─┐
LP (Polygon)   ─┼──► Bridge Kit ──► Arc LiquidityPool ──► sfUSDC tokens
LP (Base)      ─┘

PHASE 2: INVOICE CREATION
─────────────────────────
Supplier ──► Circle Wallet ──► Sui: invoice::create()
                                    │
                                    ▼
                            Invoice Object (PENDING)
                            • buyer address
                            • supplier address
                            • face_value
                            • maturity_date
                            • discount_rate

PHASE 3: BUYER APPROVAL
───────────────────────
Buyer ──► Circle Wallet ──► Sui: invoice::approve()
                                 │
                                 ▼
                         Invoice status: APPROVED
                         Event: InvoiceApproved

PHASE 4: FUNDING TRIGGER
────────────────────────
Backend (event listener) ◄── InvoiceApproved
         │
         ▼
Arc: BridgeRouter.routeToSui(amount, invoiceId)
         │
         ▼ (CCTP transfer)
Sui: execution_pool::receive_from_arc()
         │
         ▼
Sui: payment_router::fund_invoice()
         │
         ▼
Invoice status: FUNDED
USDC ──► Supplier's Circle Wallet

PHASE 5: SUPPLIER PAYOUT
────────────────────────
Supplier's Circle Wallet ──► Circle Gateway ──► Bank Account
                            (USDC → Fiat)

PHASE 6: BUYER REPAYMENT (at maturity)
──────────────────────────────────────
Buyer's Bank ──► Circle Gateway ──► Buyer's Circle Wallet
               (Fiat → USDC)
                                          │
                                          ▼
                            Sui: payment_router::repay()
                                          │
                                          ▼
                            Invoice status: PAID

PHASE 7: CAPITAL RETURN
───────────────────────
Sui: execution_pool::return_to_arc()
         │
         ▼ (CCTP transfer)
Arc: LiquidityPool receives (principal + yield)
         │
         ▼
sfUSDC share value increases
LPs earn yield
```

---

## Part 3: Smart Contract Design

### 3.1 Arc Contracts (Solidity)

#### LiquidityPool.sol — Core Vault

```
Purpose: Hold aggregated USDC from all chains
Standard: ERC-4626 (tokenized vault)

Functions:
├── deposit(uint256 assets) → uint256 shares
├── withdraw(uint256 shares) → uint256 assets
├── routeToSui(uint256 amount, bytes32 invoiceId)
├── receiveFromSui(uint256 principal, uint256 yield)
├── availableLiquidity() → uint256
└── utilizationRate() → uint256

State:
├── totalDeployed: USDC currently on Sui
├── totalYieldEarned: Cumulative yield
└── pendingTransfers: In-flight bridge transactions

Events:
├── LiquidityRouted(amount, invoiceId, suiDestination)
├── LiquidityReturned(principal, yield, invoiceId)
└── YieldDistributed(amount, timestamp)
```

#### BridgeRouter.sol — Cross-Chain Routing

```
Purpose: Route USDC between Arc and Sui
Integration: Circle CCTP

Functions:
├── routeToSui(bytes32 invoiceId, uint256 amount, bytes32 suiRecipient)
├── confirmArrival(bytes32 messageHash)
└── handleReturn(bytes32 messageHash, uint256 amount)

Workflow:
1. Pull USDC from LiquidityPool
2. Approve CCTP TokenMessenger
3. Call depositForBurn (Arc → Sui)
4. Store pending transfer
5. Confirm on Sui arrival event
```

### 3.2 Sui Contracts (Move)

#### invoice.move — Invoice Lifecycle

```
Purpose: Manage invoice objects
Model: Shared objects with access control

Structs:
└── Invoice
    ├── id: UID
    ├── buyer: address
    ├── supplier: address
    ├── face_value: u64
    ├── discount_rate_bps: u64
    ├── maturity_date: u64
    ├── invoice_hash: vector<u8> (IPFS CID)
    ├── status: u8
    └── timestamps (created, funded, paid)

Status Flow:
PENDING → APPROVED → FUNDED → PAID
              ↓
         CANCELLED

Entry Functions:
├── create() — Supplier creates invoice
├── approve() — Buyer approves
├── cancel() — Either party cancels (if PENDING)

Internal Functions:
├── mark_funded() — Called by execution_pool
└── mark_paid() — Called by payment_router

Events:
├── InvoiceCreated { invoice_id, buyer, supplier, face_value }
├── InvoiceApproved { invoice_id, buyer, approved_at }
├── InvoiceFunded { invoice_id, amount, discount }
└── InvoicePaid { invoice_id, amount, paid_at }
```

#### execution_pool.move — USDC Holding

```
Purpose: Temporary USDC holding on Sui
Pattern: Shared singleton

Structs:
└── ExecutionPool
    ├── id: UID
    ├── balance: Balance<USDC>
    ├── admin: address
    └── tracking (total_funded, total_repaid, active_invoices)

Entry Functions:
├── receive_from_arc(funds: Coin<USDC>)
├── fund_invoice(invoice: &mut Invoice)
├── receive_repayment(invoice: &mut Invoice, payment: Coin<USDC>)
└── return_to_arc(amount, yield_amount)

Workflow:
1. Receive USDC from Arc bridge
2. Hold until invoice ready to fund
3. Transfer to supplier on funding
4. Receive repayment from buyer
5. Return principal + yield to Arc
```

---

## Part 4: Circle Integration

### 4.1 Circle Wallets

**Purpose:** Abstract crypto for business users

```
User Registration:
1. User signs up with email
2. Backend creates Circle Wallet
3. Wallet address stored in user profile
4. All transactions signed by Circle (custodial)

Wallet Types:
├── Buyer Wallet — Holds USDC for repayments
├── Supplier Wallet — Receives funding, off-ramps to fiat
└── LP Wallet — (Optional) Non-custodial via RainbowKit
```

### 4.2 Circle Gateway

**Purpose:** Fiat on/off-ramp

```
On-Ramp (Buyer Repayment):
1. Buyer initiates bank transfer
2. Gateway converts USD → USDC
3. USDC deposited to Buyer's Circle Wallet
4. Backend triggers repayment on Sui

Off-Ramp (Supplier Payout):
1. Supplier's Circle Wallet holds USDC
2. Supplier requests payout
3. Gateway converts USDC → USD
4. Wire transfer to Supplier's bank

Supported Methods:
├── Wire (ACH, SEPA)
├── Cards (coming soon)
└── Crypto (USDC direct)
```

### 4.3 Circle CCTP

**Purpose:** Cross-chain USDC transfer (Arc ↔ Sui)

```
Arc → Sui:
1. BridgeRouter calls TokenMessenger.depositForBurn()
2. USDC burned on Arc
3. Attestation generated
4. USDC minted on Sui
5. execution_pool receives funds

Sui → Arc:
1. execution_pool initiates return
2. USDC burned on Sui
3. Attestation generated
4. USDC minted on Arc
5. LiquidityPool receives funds

Latency: ~15-20 minutes (attestation + confirmation)
Cost: Gas on both chains only, no bridge fee
```

---

## Part 5: Competitive Advantages

### 5.1 vs Traditional Banks

| Metric | Banks | Seed Finance |
|--------|-------|--------------|
| Settlement | T+2-5 | T+0 |
| Min Invoice | $50K+ | $1K |
| Cross-Border | 2-3% forex | 0.1% |
| Hours | Business | 24/7/365 |
| Transparency | Opaque | Full on-chain |
| Access | Large corps only | Anyone |

### 5.2 vs Fintech Competitors

| Metric | Fintechs | Seed Finance |
|--------|----------|--------------|
| Custody | Custodial | Non-custodial |
| Lock-in | High | Portable credit |
| Fees | 2-4% | 0.5-1.5% |
| Composability | None | Full DeFi |
| Audit | Trust us | Verify on-chain |

### 5.3 Unique Blockchain Advantages

1. **Immutable Invoice Registry** — Zero double-financing fraud
2. **Programmable Payments** — Auto-execute at maturity
3. **Composable LP Tokens** — Use sfUSDC as collateral elsewhere
4. **Portable Credit History** — On-chain reputation
5. **Global Liquidity** — Access $40B+ DeFi ecosystem

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

## Part 8: MVP Development (7 Days)

### Day 1-2: Contracts
- [ ] Arc: LiquidityPool.sol
- [ ] Arc: BridgeRouter.sol
- [ ] Sui: invoice.move
- [ ] Sui: execution_pool.move

### Day 3-4: Integration
- [ ] CCTP bridge integration
- [ ] Circle Wallet SDK
- [ ] Circle Gateway API
- [ ] Backend event listeners

### Day 5: Frontend
- [ ] Buyer dashboard
- [ ] Supplier dashboard
- [ ] Financier dashboard

### Day 6: Testing
- [ ] Unit tests
- [ ] Integration tests
- [ ] Testnet deployment

### Day 7: Polish
- [ ] Bug fixes
- [ ] Demo video
- [ ] Architecture diagram
- [ ] Documentation

---

## Part 9: Prize Alignment

### Best Chain-Abstracted USDC Apps ($5,000)

**Qualification:**
- [x] Uses Arc as liquidity hub
- [x] Multi-chain LP deposits
- [x] Cross-chain capital routing
- [x] Seamless UX for end users
- [x] Real credit/payment use case

**Required Tools:**
- Arc ✓
- Circle Gateway ✓
- USDC ✓
- Circle Wallets ✓

### Build Global Payouts ($2,500)

**Qualification:**
- [x] Global payout system
- [x] Automated payout logic
- [x] Multi-recipient settlement
- [x] Policy-based payouts

**Required Tools:**
- Arc ✓
- Circle Gateway ✓
- Circle Wallets ✓
- Bridge Kit ✓

---

## Conclusion

Seed Finance leverages the unique strengths of both Arc and Sui:

- **Arc** provides chain-abstracted USDC liquidity and Circle ecosystem integration
- **Sui** provides efficient credit execution with its object model

This dual-chain approach creates structural advantages that single-chain solutions cannot match:

1. **Best of both worlds** — EVM liquidity + Move efficiency
2. **Circle native** — Deep integration with Gateway, Wallets, CCTP
3. **Non-custodial** — Smart contracts only, no intermediary custody
4. **Global scale** — Cross-border without friction

**The result:** A reverse factoring protocol that's faster, cheaper, and more transparent than any alternative.

---

*Document Version 2.0*
*Updated January 2026*
*Sui + Arc Architecture*
