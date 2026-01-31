# 🏁 Seed Finance - Supply chain Finance product (Reverse Factoring)

**Goal:**  
Build a *working*, end-to-end DeFi reverse factoring MVP on **Sui**, with **real functionality**, where:
- Crypto-native liquidity funds invoices
- Suppliers & buyers do **not** need to understand blockchain
- The protocol is **non-custodial**
- Judges can clearly see how this scales to the real world

Time horizon: **7 days**

---

## 🧠 Core MVP Definition (lock this first)

### What the product MUST do
1. Accept liquidity (USDC) from financiers
2. Create an invoice on-chain
3. Have the buyer approve the invoice
4. Fund the invoice from the liquidity pool
5. Repay the pool at maturity
6. Show balances + state changes in the UI

### What it MUST NOT do
- ❌ Custody user funds off-chain
- ❌ Require companies to manage wallets (this is *explained*, not built)
- ❌ Build full KYC, ERP, credit scoring

---

## 🧩 Architecture (simple + defensible)

### On-chain (Sui Move)
- `Invoice` object
- `LiquidityPool` object
- Stateless funding & repayment logic

### Frontend
- React / Next.js
- Sui Wallet Kit
- 3 roles simulated with wallets:
  - Supplier
  - Buyer
  - Financier

### Off-chain (mocked)
- Invoice PDFs → JSON
- Fiat rails → comments / logs
- KYC → assumed

---

## 📅 Build Order (DO NOT CHANGE THIS)

This order maximizes **working functionality early**, so you’re never stuck with a half-demo.

---

# DAY 1 — Product lock + contract skeleton

### 1. Lock the exact MVP flow (write this down)
