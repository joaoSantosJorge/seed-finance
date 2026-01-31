# 🏁 Seed Finance - Supply chain Finance product (Reverse Factoring)
**Goal:**  
Build a *functional*, end-to-end **DeFi reverse factoring MVP** that:
- Uses **Sui** for invoice + credit logic
- Uses **Circle Arc** as a **chain-abstracted USDC liquidity hub**
- Uses **Circle Gateway** for payouts / settlement abstraction
- Is **non-custodial**
- Clearly qualifies for **Circle’s “Best Chain-Abstracted USDC Apps” prize**

Time horizon: **7 days**

---

## 🧠 Locked Product Definition (updated)

### What the product DOES
1. Crypto-native LPs deposit USDC **on any chain**
2. Arc aggregates USDC as a **single liquidity surface**
3. Invoices are created & approved on **Sui**
4. When funding is needed:
   - USDC is routed **from Arc → Sui**
   - Supplier gets paid
5. Buyer repays at maturity
6. USDC flows **back to Arc**
7. LPs earn yield

### What companies see
- Upload invoice
- Get paid to bank (abstracted)
- No wallets
- No crypto UX

---

## 🧩 Architecture (Circle-aligned)

### On-chain
- **Sui**
  - Invoice objects
  - Funding & repayment logic

### Cross-chain liquidity
- **Arc**
  - Aggregates USDC from multiple chains
  - Routes liquidity where needed

### Payments
- **Circle Gateway**
  - On/off-ramp abstraction
  - Settlement to suppliers & LPs

---

## 📅 Build Order (UPDATED with Circle steps)

---

# DAY 1 — Product lock + contract skeleton

### 1. Lock the full Circle-aligned flow




LP deposits USDC (any chain)
↓
Arc
(Chain-abstracted liquidity)
↓
Sui Invoice Contract
↓
Supplier payout (via Circle Gateway)


### 2. Create Move package (Sui)
- Invoice struct
- Pool struct (Sui-side pool balance)

### 3. Define enums & states
- CREATED
- APPROVED
- FUNDED
- PAID

**Goal:** Contracts compile, no logic yet.

---

# DAY 2 — Sui liquidity pool (execution layer)

> ⚠️ Important: This is the **execution pool**, not the capital source.

### 1. Create pool on Sui
- Holds USDC temporarily
- Receives liquidity **from Arc**

### 2. Implement:
- `receive_liquidity_from_arc()`
- `get_pool_balance()`

No LP accounting yet.

**Goal:** Sui is ready to accept routed USDC.

---

# DAY 3 — Invoice lifecycle (unchanged)

### 1. Create invoice (supplier)
### 2. Approve invoice (buyer)
### 3. Query invoices by role

**Goal:** Invoice objects work end-to-end.

---

# DAY 4 — Circle Arc integration (KEY DAY)

### 1. Arc liquidity abstraction
- Treat Arc as:
  - “Unified USDC vault”
- Simulate:
  - LP deposits on multiple chains
  - Arc exposes total available USDC

### 2. Funding trigger logic
When invoice is approved:
- Check Arc liquidity
- Request USDC routing → Sui pool

> For hackathon:
> - Real Arc SDK calls OR
> - Minimal functional mock clearly labeled

**Goal:** Capital is no longer chain-specific.

---

# DAY 5 — Funding + payout (Circle Gateway)

### 1. Fund invoice
- USDC arrives on Sui
- Pool → supplier

### 2. Circle Gateway payout
- USDC → Circle Gateway
- Gateway → “bank account” (mocked)

**Important:**
- Show Gateway integration in code
- Fiat leg can be simulated

**Goal:** “Supplier doesn’t touch crypto” story is real.

---

# DAY 6 — Repayment loop + LP settlement

### 1. Buyer repayment
- Buyer pays (mocked fiat)
- Circle Gateway → USDC

### 2. USDC return
- USDC → Arc
- Arc balance increases

### 3. Yield visible
- Arc liquidity > initial deposits

**Goal:** Full capital loop closes.

---

# DAY 7 — Frontend + pitch polish

### Frontend pages



/financier

view Arc liquidity

deposit USDC (simulated multi-chain)

/supplier

create invoice

see payout status

/buyer

approve invoice

repay invoice


### Deliverables
- Working UI
- Architecture diagram
- README
- 2–3 min demo video

---

## 🏗️ Architecture Diagram — REQUIRED LABELS (Circle expects these)

Use **these exact concepts and labels** in your diagram.

---

### Actors
- **Liquidity Providers (Crypto-native)**
- **Suppliers (Off-chain companies)**
- **Buyers (Off-chain companies)**

---

### Components (label exactly)

#### 🔵 Arc — Liquidity Hub
- “Chain-abstracted USDC liquidity”
- “Aggregates USDC across chains”
- “Routes capital where needed”

#### 🟣 Sui — Credit Execution Layer
- “Invoice objects”
- “Buyer approval”
- “Funding & repayment logic”
- “Non-custodial smart contracts”

#### 🟢 Circle Gateway — Settlement Layer
- “On/off-ramp abstraction”
- “USDC ↔ fiat settlement”
- “Enterprise-grade payouts”

---

### Data flows (arrow labels)

1. **USDC Deposit**
   - “USDC deposited from multiple chains → Arc”

2. **Liquidity Routing**
   - “Arc routes USDC → Sui for invoice funding”

3. **Invoice Funding**
   - “Sui smart contract funds approved invoice”

4. **Supplier Payout**
   - “USDC → Circle Gateway → Bank account (abstracted)”

5. **Buyer Repayment**
   - “Fiat → Circle Gateway → USDC”

6. **Capital Return**
   - “USDC returned to Arc liquidity pool”

---

### Trust & Custody annotations (important)

- “Protocol is non-custodial”
- “No private keys held by backend”
- “Smart contracts only route funds”

Judges *look* for this.

---

## 🎯 Circle Prize Alignment (explicit)

### Target prize
🏆 **Best Chain-Abstracted USDC Apps Using Arc as a Liquidity Hub**

### Why this qualifies
- Uses Arc as unified liquidity surface
- Demonstrates cross-chain capital routing
- Abstracts complexity from end users
- Real DeFi credit use-case

---

## 🚫 What NOT to overbuild

- ❌ Full Bridge Kit flows
- ❌ Real bank accounts
- ❌ Full Circle Wallet infra
- ❌ LP share tokens

Show intent + functionality.

---

## 🎤 One-liner (final)

> “We built a non-custodial reverse factoring protocol where USDC liquidity is chain-abstracted via Arc, invoices execute on Sui, and payouts settle through Circle Gateway — companies never touch crypto.”

---

**If it moves USDC, changes state, and closes the loop — it’s real.**
