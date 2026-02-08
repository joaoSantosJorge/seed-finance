# Seed Finance — Presentation Scripts

---

# Script 1: Business Presentation

**Target audience:** Investors, executives, partners
**Duration:** ~8-10 minutes

---

## SLIDE 1 — Opening Hook

> "Every day, millions of suppliers around the world deliver goods and services — and then wait. 30 days. 60 days. Sometimes 90 days to get paid. Meanwhile, they struggle to cover payroll, buy materials, or grow their business. This is the $739 billion reverse factoring problem — and we're solving it with Seed Finance."

## SLIDE 2 — The Problem

> "Let me put this in concrete terms. A supplier delivers $100,000 worth of goods to a large buyer. The buyer's payment terms say 60 days. That supplier now has a $100,000 hole in their cash flow for two months.
>
> Today, the options are bad. Go to a bank — they'll charge 2 to 4%, require a minimum of $50,000, and take 2 to 5 business days to settle. Use a traditional factoring company — even worse rates, and you lose the relationship with your buyer. Or just wait and hope your business survives.
>
> This is a global problem affecting every industry, every supply chain. And the existing solutions are slow, expensive, and opaque."

## SLIDE 3 — The Solution

> "Seed Finance is a decentralized reverse factoring protocol. In plain English: we let suppliers get paid instantly on approved invoices, while buyers keep their original payment terms. Nobody loses. Everyone wins.
>
> Here's how it works in 4 steps:
> 1. A supplier creates an invoice on our platform.
> 2. The buyer approves it — confirming 'yes, I owe this and I'll pay at maturity.'
> 3. The moment it's approved, the supplier can request immediate funding. The money comes from a liquidity pool — funded by investors earning yield.
> 4. At maturity, the buyer pays the full amount. The pool gets replenished. The investors earn their return.
>
> Settlement is instant. Not T+2. Not T+5. T+0. The supplier has money in their account the same moment funding is approved."

## SLIDE 4 — Why Blockchain?

> "You might ask — why does this need to be on-chain? Three reasons:
>
> **First, transparency.** Every invoice, every approval, every payment is recorded on a public ledger. No disputes about what was agreed. No hidden fees. Full audit trail.
>
> **Second, automation.** Smart contracts enforce the rules. When a buyer approves, the supplier can fund. When maturity hits, repayment flows back automatically. No intermediaries taking a cut for shuffling papers.
>
> **Third, global access.** A supplier in Brazil and a buyer in Germany can transact with the same ease as two companies in the same city. We use USDC — a fully regulated, dollar-backed stablecoin — so there's no crypto volatility. And with Circle's fiat on/off-ramps, users move between dollars and USDC seamlessly. It feels like traditional banking."

## SLIDE 5 — The Numbers

> "Let's talk economics. On a $100,000 invoice with 50 days of financing at an 8% annual rate:
> - The discount is roughly $1,095
> - The supplier receives $98,905 — immediately
> - Of that $1,095: 80% goes to liquidity providers as yield, 20% is protocol revenue
>
> Compare that to a bank charging 3% — that's $3,000. We're saving the supplier almost $2,000 on a single invoice.
>
> For liquidity providers, this is real-world yield backed by actual commerce. Not speculation. Not ponzinomics. Real invoices, real buyers, real payments."

## SLIDE 6 — Market Opportunity

> "The global reverse factoring market is $739 billion today, growing at 10.9% annually — projected to reach $1.89 trillion by 2035.
>
> Traditional players — banks, factoring companies — are slow to innovate. Their infrastructure is decades old. We're purpose-built for this with modern technology.
>
> Our competitive advantages:
> - Fees: 0.5 to 1.5% versus 2 to 4% at banks
> - Minimums: $1,000 versus $50,000+
> - Settlement: instant versus days
> - Hours: 24/7/365 versus business hours only
> - Cross-border: 0.1% versus 2 to 3% forex fees"

## SLIDE 7 — Revenue Projections

> "Our revenue comes from transaction fees on every invoice financed:
> - Year 1, $50 million in volume — $600K in revenue
> - Year 2, $500 million — $5 million
> - Year 3, $2 billion — $16 million
> - Year 4, $10 billion — $70 million
>
> This is a volume business with strong unit economics and near-zero marginal cost per transaction."

## SLIDE 8 — Technology & Infrastructure

> "We're built on Arc — Circle's new Layer 1 blockchain designed specifically for stablecoin finance. USDC is the native gas token, meaning our users never need to buy or manage a separate cryptocurrency. It's USDC all the way down.
>
> Our smart contracts have 140+ tests passing. The architecture uses a Diamond proxy pattern — the same pattern used by Aavegotchi and other production DeFi protocols — which means we can upgrade and extend functionality without disrupting existing users.
>
> For end users, we integrate Circle Wallets — so there are no seed phrases, no MetaMask popups. And Circle Gateway handles the fiat conversion. A traditional CFO can use this without ever knowing there's a blockchain underneath."

## SLIDE 9 — Current Status & Roadmap

> "Where we are today:
> - Full smart contract suite deployed and verified on Arc Testnet
> - Frontend dashboards for all four user roles — suppliers, buyers, investors, and operators
> - Backend services for event processing and orchestration
> - 140+ automated tests, all passing
>
> Next steps:
> - Security audit
> - Mainnet deployment
> - Pilot with first set of supplier-buyer pairs
> - Scale to broader market"

## SLIDE 10 — Close

> "Seed Finance is building the financial infrastructure that global supply chains need. We're making it possible for any supplier to get paid instantly, any investor to earn real-world yield, and any buyer to maintain their payment terms — all transparently, all on-chain.
>
> We're not competing with banks. We're building what banks can't build. Thank you."

---

---

# Script 2: Technical Demo

**Target audience:** Developers, technical evaluators, hackathon judges
**Duration:** ~10-12 minutes

---

## Part 1 — Architecture Overview (2 min)

> "Let me walk you through how Seed Finance works under the hood.
>
> The architecture has three layers:"

**[Show architecture diagram]**

```
┌──────────────────────────────────────────────────────────────────┐
│                    LAYER 1: CAPITAL (Arc)                         │
│  LiquidityPool.sol (ERC-4626 vault for LP deposits)              │
│  SEED tokens (automatic yield distribution via share price)       │
│  TreasuryManager.sol (yield optimization on idle capital)         │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                    LAYER 2: CREDIT (Arc)                          │
│  InvoiceDiamond.sol (EIP-2535 Diamond Proxy)                     │
│    └─ InvoiceFacet: create, approve, cancel invoices             │
│    └─ FundingFacet: request and approve funding                  │
│    └─ RepaymentFacet: process repayments, mark defaulted         │
│    └─ ViewFacet: read-only queries                               │
│    └─ AdminFacet: configuration and access control               │
│  ExecutionPool.sol (USDC holding, funding/repayment processor)    │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│              LAYER 3: SETTLEMENT (Circle Tools)                   │
│  Circle Wallets (SCA for business users - abstract crypto)        │
│  Circle Gateway (USDC ↔ Fiat on/off-ramps)                       │
└──────────────────────────────────────────────────────────────────┘
```

> "**Layer 1: Capital.** This is a LiquidityPool contract — an ERC-4626 vault. LPs deposit USDC and receive SEED share tokens. The vault's share price increases automatically as yield accrues from invoice financing. There's also a TreasuryManager that deploys idle capital into yield strategies — like Hashnote's USYC tokenized T-bills — so money that's not currently funding invoices still earns.
>
> **Layer 2: Credit.** The core is an InvoiceDiamond — an EIP-2535 Diamond proxy with 5 facets: InvoiceFacet for creation and approval, FundingFacet for funding logic, RepaymentFacet for processing payments, ViewFacet for reads, and AdminFacet for configuration. Alongside it, the ExecutionPool holds USDC during funding and repayment transitions.
>
> **Layer 3: Settlement.** This uses Circle's infrastructure — Circle Wallets for smart contract accounts (no private keys for users) and Circle Gateway for USDC-to-fiat conversion.
>
> We chose the Diamond pattern because invoices have complex lifecycle states — Pending, Approved, FundingApproved, Funded, Paid, Defaulted, Cancelled — and we need the ability to add new facets without redeploying. For example, a future PenaltyFacet for late payments or an ExtensionFacet for maturity extensions."

## Part 2 — Smart Contracts Deep Dive (2 min)

> "Let me highlight some key design decisions.
>
> **ERC-4626 Vault:** The LiquidityPool tracks `totalAssets()` which includes both available USDC and deployed capital. When we fund an invoice, we call `deployForFunding()` which moves USDC out but tracks it as deployed. When repayment comes in, the yield increases `totalAssets` — which automatically increases the share price for all SEED holders. No claiming, no harvesting.
>
> **Diamond Storage:** Each facet uses `LibInvoiceStorage` with a unique storage slot to prevent collisions. The storage struct holds the invoice mapping, counters, operator permissions, and pool references.
>
> **Access Control:** We have role-based permissions — operators can approve funding, only the linked buyer can approve invoices, and admin functions are owner-only. The ExecutionPool is the only contract authorized to call `deployForFunding()` on the pool.
>
> Everything is in Solidity 0.8.26 using Foundry for compilation, testing, and deployment."

## Part 3 — Live Demo (6-8 min)

> "Now let me show you the full lifecycle. I'm going to run through the complete flow."

### Step 1: Show the Test Suite

> "First, let's verify everything works. 140+ tests."

**[Run in terminal]:**
```
cd contracts && forge test --summary
```

> "All green. These cover unit tests for each facet, integration tests for the full lifecycle, edge cases like double-funding prevention, and access control."

### Step 2: Run the Full Workflow Script

> "Now let me run the end-to-end workflow. This script deploys all contracts and simulates a complete invoice lifecycle."

**[Run in terminal]:**
```
forge script script/TestWorkflow.s.sol:TestWorkflow --rpc-url http://localhost:8545 --broadcast
```

> "Watch the output. Here's what's happening step by step:
>
> **Step 1** — LP deposits 100,000 USDC into the pool. Receives 100,000 SEED shares. Share price is 1:1 at this point.
>
> **Step 2** — Supplier creates a $10,000 invoice. 30-day maturity, 5% annual discount rate. Status: Pending.
>
> **Step 3** — Buyer approves the invoice. This is the buyer confirming 'I acknowledge this invoice and will pay at maturity.' Status moves to Approved.
>
> **Step 4** — Operator approves funding. In production, this is our backend service validating credit risk. Status: FundingApproved.
>
> **Step 5** — Supplier requests funding. The contract calculates the discount: $10,000 times 5% times 30/365 = $41. Supplier receives $9,959 USDC. The pool's deployed balance increases by $10,000. Status: Funded.
>
> **Step 6** — We fast-forward 30 days. In production, this is just... waiting.
>
> **Step 7** — Buyer repays $10,000 USDC. The pool receives the full face value. The $41 difference between what was deployed and what came back is yield. Status: Paid.
>
> **Final state:** Pool has 100,041 USDC in total assets. The LP's 100,000 SEED shares are now worth 100,041 USDC. Yield distributed automatically through share price appreciation."

### Step 3: Show the Frontend

> "Let me switch to the frontend."

**[Open browser to localhost:3000]**

> "This is our landing page. 'Earn Yield on Invoice Financing' — straightforward value prop. Live stats pulled from the contracts."

**[Navigate to /dashboard/financier]**

> "Here's the LP dashboard. You can see the position card — SEED balance and current value. The pool allocation chart shows how capital is split between available liquidity, deployed for invoices, and in treasury strategies. The share price chart shows 30-day yield history.
>
> Depositing is simple — enter the USDC amount, approve, deposit. You get SEED tokens back. Withdrawing burns your SEED and returns USDC at the current share price."

**[Navigate to /dashboard/supplier]**

> "Supplier view. They see their invoices with status indicators — color-coded by state. Creating an invoice: they enter face value, buyer address, maturity date, and the discount rate. One transaction, it's on-chain."

**[Navigate to /dashboard/buyer]**

> "Buyer dashboard. The key metric is 'Pending Approvals' — invoices waiting for their signature. They can review each invoice, and approve with one click. They also see upcoming repayments and any overdue items with warnings."

**[Navigate to /dashboard/operator]**

> "Finally, the operator view. This is the control center. System health card shows pool status and TVL. Pending funding queue shows invoices ready to be funded — operators can fund individually or batch-fund multiple invoices in one transaction. There are also circuit breakers — pause and unpause the pool if needed."

### Step 4: Show Contract Verification

> "All contracts are verified on Arc's explorer."

**[Open browser to testnet.arcscan.app, navigate to a contract]**

> "You can read the contract source, interact with read functions, and verify everything matches what I've shown. Full transparency."

## Part 4 — Wrap Up (1 min)

> "To summarize the technical stack:
> - **Contracts:** Solidity 0.8.26, Diamond proxy (EIP-2535), ERC-4626 vault, 140+ tests
> - **Frontend:** Next.js 14, TypeScript, wagmi/viem, RainbowKit
> - **Backend:** TypeScript services, event indexing, Circle SDK integration
> - **Chain:** Arc by Circle — USDC as native gas, deep Circle ecosystem integration
>
> The protocol is fully functional on testnet. Every line of code is tested. The frontend connects to live contracts. And the entire deployment — from zero to fully operational — runs with a single Foundry script.
>
> Questions?"




## Extra text

Supply chain finance is a broad set of financing techniques that optimize cash flow between buyers and suppliers in a trade relationship. The core tension it addresses: buyers want to pay as late as possible (to preserve their own working capital), while suppliers want to get paid as soon as possible (for the same reason). These competing interests create friction, especially when there's a power imbalance — large buyers can impose long payment terms (60, 90, even 120 days) on smaller suppliers who can't easily absorb that delay.
Reverse factoring (also called approved payables finance or supplier finance) is one of the most important tools within supply chain finance. Here's how it works and what problem it solves:
In a traditional setup, a supplier delivers goods, issues an invoice with (say) 90-day terms, and waits. If the supplier needs cash sooner, they can try to factor that invoice — selling it to a bank at a discount. But the discount rate is based on the supplier's credit risk, which for a small supplier can be quite high, making it expensive.
Reverse factoring flips this. The buyer (typically a large, creditworthy company) sets up a program with a bank or platform. Once the buyer approves an invoice, the supplier can request early payment from the bank. The critical difference is that the financing is priced based on the buyer's credit rating, not the supplier's. Since the buyer is usually a much stronger credit, the discount rate is significantly lower.
The result is a win for all three parties. The supplier gets paid early and cheaply, improving their liquidity and reducing their risk of cash shortfalls. The buyer can maintain or even extend their payment terms without squeezing suppliers — and may strengthen supplier relationships and supply chain stability. The bank earns a fee on low-risk, short-duration financing backed by a creditworthy obligor.
The core problem reverse factoring solves is the credit asymmetry problem in trade finance: small suppliers historically couldn't access affordable short-term financing because their own credit profile didn't justify it, even though they were owed money by highly creditworthy counterparties. Reverse factoring lets the buyer's creditworthiness flow through to benefit the supplier, unlocking cheaper capital throughout the supply chain.
One caveat worth noting: reverse factoring attracted scrutiny after the Greensill Capital collapse and some high-profile accounting concerns (like with Carillion). The main risk is that if these programs are used aggressively to stretch payment terms far beyond normal, they can mask a buyer's true liabilities — the payables may look like ordinary trade payables on the balance sheet when they're functionally more like bank debt.


