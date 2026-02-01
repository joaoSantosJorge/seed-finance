# Financier (LP) Dashboard - Manual Testing Guide

This document provides a comprehensive checklist for manually testing every page and interaction in the Seed Finance Financier (LP) Dashboard.

---

## Table of Contents
1. [Pre-Testing Setup](#1-pre-testing-setup)
2. [Test Accounts & Wallet Setup](#2-test-accounts--wallet-setup)
3. [Dashboard Overview Page](#3-dashboard-overview-page)
4. [Deposit Page](#4-deposit-page)
5. [Withdraw Page](#5-withdraw-page)
6. [Portfolio Page](#6-portfolio-page)
7. [Analytics Page](#7-analytics-page)
8. [Transaction History Page](#8-transaction-history-page)
9. [Navigation & Layout](#9-navigation--layout)
10. [Wallet Connection States](#10-wallet-connection-states)
11. [Edge Cases & Error Handling](#11-edge-cases--error-handling)
12. [Mobile Responsiveness](#12-mobile-responsiveness)

---

## 1. Pre-Testing Setup

### 1.1 Start Local Environment

**Terminal 1 - Start Anvil:**
```bash
cd /home/joaosantosjorge/seed-finance/contracts
anvil
```
Expected: Anvil running on `http://localhost:8545` with 10 test accounts displayed.

**Terminal 2 - Deploy Contracts:**
```bash
cd /home/joaosantosjorge/seed-finance/contracts
./test/anvil/test-contracts.sh
```
Expected: Contracts deployed, addresses printed to console.

**Terminal 3 - Start Frontend:**
```bash
cd /home/joaosantosjorge/seed-finance/frontend
npm run dev
```
Expected: Next.js dev server on `http://localhost:3000`.

### 1.2 Update Environment Variables

Copy contract addresses from deploy output to `.env.local`:
```env
NEXT_PUBLIC_ENV=local
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=demo-project-id
NEXT_PUBLIC_USDC_ADDRESS=<MockUSDC address>
NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS=<LiquidityPool address>
NEXT_PUBLIC_TREASURY_MANAGER_ADDRESS=<TreasuryManager address>
```

### 1.3 Fund Test Wallet with USDC

```bash
# Mint 1,000,000 USDC to LP test account
cast send <MOCK_USDC_ADDRESS> "mint(address,uint256)" \
  0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
  1000000000000 \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

---

## 2. Test Accounts & Wallet Setup

### 2.1 Import Test Account to MetaMask

| Field | Value |
|-------|-------|
| **Account Name** | LP Test Account |
| **Address** | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` |
| **Private Key** | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |

### 2.2 Add Anvil Network to MetaMask

| Field | Value |
|-------|-------|
| **Network Name** | Anvil Local |
| **RPC URL** | `http://localhost:8545` |
| **Chain ID** | `31337` |
| **Currency Symbol** | `ETH` |

### 2.3 Add USDC Token to MetaMask

- Click "Import Token"
- Paste the MockUSDC contract address
- Verify: Symbol = `USDC`, Decimals = `6`

---

## 3. Dashboard Overview Page

**URL:** `/dashboard/financier`

### 3.1 Page Load Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 3.1.1 | Page loads without wallet | Navigate to page without connecting wallet | "Connect wallet" prompt displayed |
| 3.1.2 | Page loads with wallet connected | Connect wallet, navigate to page | Full dashboard displayed |
| 3.1.3 | Loading states | Refresh page while connected | Skeleton loaders appear briefly, then data loads |

### 3.2 Position Card Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 3.2.1 | No position state | Connect wallet with 0 sfUSDC | Shows "$0.00" position value |
| 3.2.2 | With position | After depositing | Shows correct position value in USDC |
| 3.2.3 | Unrealized gain display | After share price increases | Shows gain amount with green up arrow |
| 3.2.4 | Share balance | Check sfUSDC display | Matches wallet's sfUSDC balance |
| 3.2.5 | Share price | Check current price | Shows USDC per sfUSDC (e.g., "1.0234") |
| 3.2.6 | APY display | Check estimated APY | Shows percentage (e.g., "7.42%") |
| 3.2.7 | Monthly yield estimate | Check monthly projection | Calculated as (position × APY / 12) |

### 3.3 Pool Metrics Cards Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 3.3.1 | TVL display | Check Total Value Locked | Shows total USDC in pool |
| 3.3.2 | Utilization rate | Check deployment percentage | Shows % of capital in invoices |
| 3.3.3 | Treasury allocation | Check treasury percentage | Shows % in USYC/treasury |
| 3.3.4 | Share price card | Check price display | Matches Position Card share price |

### 3.4 Utilization Bar Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 3.4.1 | Three segments visible | View utilization bar | Shows Deployed (blue), Treasury (green), Available (gray) |
| 3.4.2 | Hover tooltips | Hover over each segment | Shows value and percentage for each |
| 3.4.3 | Legend accuracy | Compare legend to bar | Legend percentages match bar widths |
| 3.4.4 | Empty pool state | When TVL is 0 | Shows 100% Available |

### 3.5 Yield Performance Chart Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 3.5.1 | Chart renders | View 30-day yield chart | Area chart displays with data |
| 3.5.2 | Data points | Hover over chart points | Shows date and yield value |

### 3.6 Quick Actions Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 3.6.1 | Deposit link | Click "Deposit USDC" | Navigates to `/dashboard/financier/deposit` |
| 3.6.2 | Withdraw link | Click "Withdraw" | Navigates to `/dashboard/financier/withdraw` |
| 3.6.3 | Analytics link | Click "View Analytics" | Navigates to `/dashboard/financier/analytics` |

### 3.7 Recent Activity Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 3.7.1 | Activity list displays | View recent activity section | Shows list of recent events |
| 3.7.2 | Activity icons | Check icon colors | Green for yield, blue for invoices, orange for rebalance |
| 3.7.3 | View All link | Click "View All" | Navigates to `/dashboard/financier/transactions` |

---

## 4. Deposit Page

**URL:** `/dashboard/financier/deposit`

### 4.1 Page Access Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 4.1.1 | Access without wallet | Navigate without connecting | "Connect wallet" prompt shown |
| 4.1.2 | Access with wallet | Navigate while connected | Full deposit form displayed |
| 4.1.3 | Back navigation | Click back arrow | Returns to `/dashboard/financier` |

### 4.2 Wallet Balance Card Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 4.2.1 | Balance displays | View "Your Wallet" card | Shows current USDC balance |
| 4.2.2 | Balance updates | After receiving USDC | Balance refreshes automatically |
| 4.2.3 | Zero balance | Wallet with 0 USDC | Shows "0.00 USDC" |

### 4.3 Amount Input Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 4.3.1 | Manual entry | Type "1000" | Input shows "1000" |
| 4.3.2 | Decimal entry | Type "1000.50" | Input accepts decimals (max 6) |
| 4.3.3 | Invalid characters | Type "abc" | Input rejects non-numeric |
| 4.3.4 | Exceeds balance | Enter amount > balance | Error message "Insufficient balance" |
| 4.3.5 | Clear input | Delete all text | Input empty, preview hidden |

### 4.4 Quick Amount Button Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 4.4.1 | 25% button | Click "25%" | Input = 25% of USDC balance |
| 4.4.2 | 50% button | Click "50%" | Input = 50% of USDC balance |
| 4.4.3 | 75% button | Click "75%" | Input = 75% of USDC balance |
| 4.4.4 | MAX button | Click "MAX" | Input = 100% of USDC balance |
| 4.4.5 | Button with 0 balance | Click any button with 0 USDC | Input shows "0" |

### 4.5 Preview Card Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 4.5.1 | Preview appears | Enter amount > 0 | "You Will Receive" card appears |
| 4.5.2 | Shares calculation | Enter 1000 USDC | Shows expected sfUSDC shares |
| 4.5.3 | Share price shown | View preview | Shows current share price |
| 4.5.4 | APY shown | View preview | Shows estimated APY (e.g., "7.42%") |
| 4.5.5 | Monthly yield | View preview | Shows calculated monthly yield |
| 4.5.6 | Pool info | View preview | Shows utilization, avg duration, default rate |

### 4.6 Transaction Steps Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 4.6.1 | Steps appear | Enter valid amount | Transaction steps card appears |
| 4.6.2 | Initial state | Before any action | Step 1: circle, Step 2: circle |
| 4.6.3 | No approval needed | If allowance sufficient | Step 1 shows "Done" checkmark |
| 4.6.4 | Approval needed | If allowance insufficient | Step 1 shows "Pending" |

### 4.7 Approval Flow Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 4.7.1 | Approve button visible | When approval needed | "Approve USDC" button shown |
| 4.7.2 | Click approve | Click "Approve USDC" | MetaMask popup opens |
| 4.7.3 | Reject approval | Reject in MetaMask | Error shown, button resets |
| 4.7.4 | Confirm approval | Confirm in MetaMask | Button shows "Confirming..." |
| 4.7.5 | Approval success | Wait for confirmation | Step 1 shows checkmark, button changes to "Deposit" |

### 4.8 Deposit Flow Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 4.8.1 | Deposit button visible | After approval | "Deposit" button shown |
| 4.8.2 | Click deposit | Click "Deposit" | MetaMask popup opens |
| 4.8.3 | Reject deposit | Reject in MetaMask | Error shown, button resets |
| 4.8.4 | Confirm deposit | Confirm in MetaMask | Button shows "Confirming..." |
| 4.8.5 | Deposit success | Wait for confirmation | Success message, tx hash displayed |
| 4.8.6 | View on explorer | Click tx hash link | Opens block explorer in new tab |

### 4.9 Post-Deposit Verification

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 4.9.1 | USDC balance decreased | Check wallet | USDC reduced by deposit amount |
| 4.9.2 | sfUSDC received | Check wallet | sfUSDC tokens received |
| 4.9.3 | Dashboard updated | Return to dashboard | Position value increased |

---

## 5. Withdraw Page

**URL:** `/dashboard/financier/withdraw`

### 5.1 Page Access Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 5.1.1 | Access without wallet | Navigate without connecting | "Connect wallet" prompt shown |
| 5.1.2 | Access with wallet | Navigate while connected | Full withdraw form displayed |
| 5.1.3 | Access with no position | Connect wallet with 0 sfUSDC | "No position" message shown |
| 5.1.4 | Back navigation | Click back arrow | Returns to `/dashboard/financier` |

### 5.2 Position Card Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 5.2.1 | sfUSDC balance | View position card | Shows current sfUSDC balance |
| 5.2.2 | Current value | View position card | Shows USDC value of shares |
| 5.2.3 | Loading state | Refresh page | Skeleton loader, then data |

### 5.3 Withdrawal Mode Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 5.3.1 | Default mode | Load page | "Withdraw by USDC amount" selected |
| 5.3.2 | Switch to shares | Click "Withdraw by share amount" | Mode switches, input clears |
| 5.3.3 | Switch to all | Click "Withdraw ALL" | Mode switches, input hidden |
| 5.3.4 | Mode indicators | Toggle modes | Radio button highlights correctly |

### 5.4 USDC Amount Mode Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 5.4.1 | Enter USDC amount | Type "500" | Input accepts, preview shows shares to burn |
| 5.4.2 | Quick buttons | Click 25/50/75/MAX | Fills input with % of max withdrawable |
| 5.4.3 | Exceeds max | Enter more than max | Error "Insufficient shares" |
| 5.4.4 | Preview shows shares | Enter valid amount | Shows sfUSDC to burn |

### 5.5 Share Amount Mode Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 5.5.1 | Enter share amount | Type "100" | Input accepts (18 decimals allowed) |
| 5.5.2 | Quick buttons | Click 25/50/75/MAX | Fills with % of sfUSDC balance |
| 5.5.3 | Exceeds balance | Enter more than owned | Error "Insufficient shares" |
| 5.5.4 | Preview shows USDC | Enter valid amount | Shows USDC to receive |

### 5.6 Withdraw ALL Mode Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 5.6.1 | No input field | Select Withdraw ALL | Amount input hidden |
| 5.6.2 | Preview full position | View preview | Shows all shares and full USDC value |
| 5.6.3 | Remaining position | View preview | Shows "0 sfUSDC" remaining |

### 5.7 Preview Card Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 5.7.1 | Shares to burn | Enter amount | Shows sfUSDC being burned |
| 5.7.2 | USDC to receive | Enter amount | Shows USDC after withdrawal |
| 5.7.3 | Remaining position | Enter partial | Shows remaining shares and value |
| 5.7.4 | Full withdrawal preview | Enter MAX | Remaining shows 0 |

### 5.8 Liquidity Warning Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 5.8.1 | Instant withdrawal | Amount < available liquidity | "Instant" badge shown |
| 5.8.2 | Treasury redemption needed | Amount > available liquidity | Warning message appears |
| 5.8.3 | Warning content | View warning | Explains treasury redemption may be needed |
| 5.8.4 | Available liquidity | View preview | Shows instant liquidity amount |

### 5.9 Withdraw Button Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 5.9.1 | Button disabled - no amount | No amount entered | Button disabled with "Enter amount" |
| 5.9.2 | Button disabled - exceeds | Amount > balance | Button disabled with "Insufficient shares" |
| 5.9.3 | Button enabled | Valid amount | "Withdraw" button clickable |
| 5.9.4 | Click withdraw | Click button | MetaMask popup opens |

### 5.10 Withdraw Flow Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 5.10.1 | Reject withdrawal | Reject in MetaMask | Error shown, button resets |
| 5.10.2 | Confirm withdrawal | Confirm in MetaMask | "Confirming..." state |
| 5.10.3 | Withdrawal success | Wait for confirmation | Success message, tx hash |
| 5.10.4 | View on explorer | Click tx hash | Opens block explorer |

### 5.11 Post-Withdrawal Verification

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 5.11.1 | USDC received | Check wallet | USDC balance increased |
| 5.11.2 | sfUSDC burned | Check wallet | sfUSDC balance decreased |
| 5.11.3 | Dashboard updated | Return to dashboard | Position value decreased |

---

## 6. Portfolio Page

**URL:** `/dashboard/financier/portfolio`

### 6.1 Page Access Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 6.1.1 | Access without wallet | Navigate without connecting | "Connect wallet" prompt |
| 6.1.2 | Access with no position | Connect with 0 sfUSDC | "No position yet" message |
| 6.1.3 | Access with position | Connect with sfUSDC | Full portfolio view |

### 6.2 Position Summary Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 6.2.1 | Total value | View summary | Shows USDC value of position |
| 6.2.2 | Shares owned | View summary | Shows sfUSDC balance with tooltip |
| 6.2.3 | Share price | View summary | Current price in USDC |
| 6.2.4 | Share price change | View summary | Shows % change (e.g., "+3.92% ATH") |
| 6.2.5 | Cost basis | View summary | Shows net deposits |
| 6.2.6 | Unrealized gain | View summary | Shows gain amount and % |
| 6.2.7 | Pool ownership | View summary | Shows % of pool owned |

### 6.3 Capital Allocation Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 6.3.1 | Pie chart renders | View allocation card | Donut chart displays |
| 6.3.2 | Three segments | View chart | Invoice (blue), Treasury (green), Liquid (gray) |
| 6.3.3 | Legend accuracy | Compare legend to chart | Percentages and amounts match |
| 6.3.4 | Proportional to position | Compare to pool metrics | User's share of each allocation |

### 6.4 Share Price History Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 6.4.1 | Chart renders | View history card | Line chart with 90-day data |
| 6.4.2 | Axis labels | Check axes | Y: Share price, X: Date labels |
| 6.4.3 | Hover interaction | Hover on data points | Shows date and price |

### 6.5 Yield Sources Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 6.5.1 | Table displays | View yield sources | Shows breakdown table |
| 6.5.2 | Invoice yield | Check row | Shows amount and % of total |
| 6.5.3 | Treasury yield | Check row | Shows amount and % of total |
| 6.5.4 | Total yield | Check row | Sum of invoice + treasury yields |

---

## 7. Analytics Page

**URL:** `/dashboard/financier/analytics`

### 7.1 Page Access Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 7.1.1 | Access without wallet | Navigate without connecting | Page loads (no wallet required) |
| 7.1.2 | Loading states | Refresh page | Skeletons, then data |

### 7.2 Time Period Tabs Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 7.2.1 | Default selection | Load page | "30D" tab selected |
| 7.2.2 | Switch to 7D | Click "7D" | Metrics update for 7-day period |
| 7.2.3 | Switch to 90D | Click "90D" | Metrics update for 90-day period |
| 7.2.4 | Switch to 1Y | Click "1Y" | Metrics update for 1-year period |
| 7.2.5 | Switch to ALL | Click "ALL" | Metrics update for all-time |
| 7.2.6 | Tab highlight | Click tabs | Active tab visually highlighted |

### 7.3 Key Metrics Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 7.3.1 | Period APY | View metric card | Shows APY for selected period |
| 7.3.2 | Period Yield | View metric card | Shows total yield in period |
| 7.3.3 | Projected Annual | View metric card | Extrapolated annual at current rate |
| 7.3.4 | Metrics change | Switch periods | All metrics update accordingly |

### 7.4 Yield Over Time Chart Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 7.4.1 | Chart renders | View main chart | Green area chart displayed |
| 7.4.2 | Stacked data | View chart layers | Invoice vs treasury yield stacked |
| 7.4.3 | Hover interaction | Hover on chart | Shows date and values |

### 7.5 Pool Utilization History Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 7.5.1 | Chart renders | View utilization chart | Blue area chart displayed |
| 7.5.2 | Y-axis | Check axis | Shows 0-100% deployment |

### 7.6 Treasury APY Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 7.6.1 | Rate displays | View treasury card | Shows current USYC rate (e.g., "5.20%") |

### 7.7 APY Comparison Chart Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 7.7.1 | Chart renders | View comparison | Horizontal bar chart displayed |
| 7.7.2 | Seed Finance bar | Check first bar | Shows Seed Finance LP APY |
| 7.7.3 | Comparison bars | Check other bars | Shows Treasury Bills, Aave, Compound |
| 7.7.4 | Visual comparison | Compare bars | Seed Finance should be highest |

### 7.8 Pool Health Metrics Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 7.8.1 | Grid displays | View health section | 6 metric cards in grid |
| 7.8.2 | TVL | Check metric | Shows Total Value Locked |
| 7.8.3 | Active invoices | Check metric | Shows count of active invoices |
| 7.8.4 | Avg invoice size | Check metric | Shows average in USDC |
| 7.8.5 | Avg maturity | Check metric | Shows days to maturity |
| 7.8.6 | Default rate | Check metric | Shows all-time default % |
| 7.8.7 | Unique buyers | Check metric | Shows count of buyers |

---

## 8. Transaction History Page

**URL:** `/dashboard/financier/transactions`

### 8.1 Page Access Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 8.1.1 | Access without wallet | Navigate without connecting | "Connect wallet" prompt |
| 8.1.2 | Access with wallet | Navigate while connected | Transaction list displayed |

### 8.2 Filter Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 8.2.1 | Default filter | Load page | "All Types" selected |
| 8.2.2 | Filter by deposit | Click deposit filter | Only deposits shown |
| 8.2.3 | Filter by withdrawal | Click withdrawal filter | Only withdrawals shown |
| 8.2.4 | Filter by yield | Click yield filter | Only yield events shown |
| 8.2.5 | Filter by pool event | Click pool event filter | Only rebalance events shown |
| 8.2.6 | Clear filter | Click "All Types" | All transactions shown |
| 8.2.7 | Filter highlight | Click filters | Active filter visually highlighted |

### 8.3 Transaction List Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 8.3.1 | List renders | View transactions | Cards with transaction info |
| 8.3.2 | Deposit display | View deposit tx | Green icon, "+X USDC → Y sfUSDC" |
| 8.3.3 | Withdrawal display | View withdrawal tx | Blue icon, "-X sfUSDC → Y USDC" |
| 8.3.4 | Yield display | View yield tx | Green trending icon, yield amount |
| 8.3.5 | Pool event display | View rebalance tx | Orange refresh icon |
| 8.3.6 | Timestamp | Check time | Shows relative time (e.g., "2 hours ago") |
| 8.3.7 | Transaction hash | Check hash | Truncated hash with link |
| 8.3.8 | Explorer link | Click hash | Opens block explorer in new tab |

### 8.4 Pagination Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 8.4.1 | Page info | View pagination | Shows "Showing X-Y of Z transactions" |
| 8.4.2 | Previous button | Check button | Disabled on first page |
| 8.4.3 | Next button | Check button | Disabled on last page (MVP) |

### 8.5 Summary Statistics Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 8.5.1 | Total deposited | View summary | Sum of all deposits |
| 8.5.2 | Total withdrawn | View summary | Sum of all withdrawals |
| 8.5.3 | Net deposits | View summary | Deposited - Withdrawn |
| 8.5.4 | Yield earned | View summary | Total yield (green text) |
| 8.5.5 | Export CSV button | View button | Button with download icon |
| 8.5.6 | Click export | Click "Export CSV" | Feature not implemented (MVP) |

---

## 9. Navigation & Layout

### 9.1 Sidebar Tests (Desktop)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 9.1.1 | Sidebar visible | View at 1024px+ width | Left sidebar displayed |
| 9.1.2 | Logo | Check top | "SEED FINANCE v1.0" ASCII art |
| 9.1.3 | Nav items | Check menu | Dashboard, Deposit, Withdraw, Portfolio, Analytics, History |
| 9.1.4 | Active highlighting | Navigate pages | Current page highlighted |
| 9.1.5 | Keyboard shortcuts | Check nav items | Shows shortcuts (1-6) |
| 9.1.6 | Settings link | Check bottom | Settings link present |
| 9.1.7 | Help link | Check bottom | Help/? link present |
| 9.1.8 | Connection status | Check bottom | Shows wallet connection status |
| 9.1.9 | Network display | Check bottom | Shows current network |

### 9.2 Keyboard Navigation Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 9.2.1 | Press "1" | Press 1 key | Navigates to Dashboard |
| 9.2.2 | Press "2" | Press 2 key | Navigates to Deposit |
| 9.2.3 | Press "3" | Press 3 key | Navigates to Withdraw |
| 9.2.4 | Press "4" | Press 4 key | Navigates to Portfolio |
| 9.2.5 | Press "5" | Press 5 key | Navigates to Analytics |
| 9.2.6 | Press "6" | Press 6 key | Navigates to History |
| 9.2.7 | Press "S" | Press S key | Navigates to Settings |
| 9.2.8 | Press "?" | Press ? key | Opens Help |

### 9.3 Header Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 9.3.1 | Header visible | View any page | Header at top |
| 9.3.2 | Wallet button | Check right side | RainbowKit connect button |
| 9.3.3 | Connected state | When connected | Shows address/ENS |
| 9.3.4 | Disconnected state | When disconnected | Shows "Connect Wallet" |

### 9.4 Mobile Navigation Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 9.4.1 | Bottom nav visible | View at < 768px | Bottom navigation bar |
| 9.4.2 | Labels | Check nav items | [HOME], [IN], [OUT], [DATA], [LOG] |
| 9.4.3 | Active state | Navigate pages | Current page highlighted |
| 9.4.4 | Tap navigation | Tap each item | Navigates correctly |

---

## 10. Wallet Connection States

### 10.1 RainbowKit Modal Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 10.1.1 | Open modal | Click "Connect Wallet" | RainbowKit modal opens |
| 10.1.2 | Wallet options | View modal | Shows MetaMask, WalletConnect, etc. |
| 10.1.3 | Select MetaMask | Click MetaMask | MetaMask popup or redirect |
| 10.1.4 | Close modal | Click outside/X | Modal closes |

### 10.2 Connection Flow Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 10.2.1 | Connect wallet | Complete connection | Header shows address |
| 10.2.2 | Wrong network | Connect on wrong chain | Network switch prompt |
| 10.2.3 | Switch network | Confirm switch | Connects to Anvil/Base |
| 10.2.4 | Reject connection | Reject in wallet | Error message, stays disconnected |

### 10.3 Disconnect Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 10.3.1 | Open wallet menu | Click connected address | Dropdown/modal opens |
| 10.3.2 | Disconnect | Click "Disconnect" | Returns to disconnected state |
| 10.3.3 | Pages update | After disconnect | Pages show "Connect wallet" prompts |

---

## 11. Edge Cases & Error Handling

### 11.1 Network Errors

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 11.1.1 | Anvil stopped | Stop anvil while connected | Error handling, retry options |
| 11.1.2 | RPC timeout | Simulate slow network | Loading states, eventual timeout |
| 11.1.3 | Transaction revert | Force a failing tx | Error message displayed |

### 11.2 Input Validation Errors

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 11.2.1 | Negative amount | Try entering "-100" | Input rejects negative |
| 11.2.2 | Too many decimals | Enter "100.1234567" | Truncates to 6 decimals |
| 11.2.3 | Very large amount | Enter "999999999999999" | Handles gracefully |
| 11.2.4 | Zero amount | Enter "0" | Button disabled or warning |

### 11.3 Contract Interaction Errors

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 11.3.1 | Insufficient gas | Set gas too low | Clear error message |
| 11.3.2 | User rejection | Click reject in wallet | Shows "Transaction rejected" |
| 11.3.3 | Nonce too low | Rapid transactions | Handles nonce issues |

### 11.4 State Inconsistencies

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 11.4.1 | Balance mismatch | External tx while on page | Balances refresh |
| 11.4.2 | Stale data | Wait 60+ seconds | Data auto-refreshes |
| 11.4.3 | Multiple tabs | Open same page in 2 tabs | Both update correctly |

---

## 12. Mobile Responsiveness

### 12.1 Viewport Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 12.1.1 | Mobile (375px) | Resize to 375px | Single column, bottom nav |
| 12.1.2 | Tablet (768px) | Resize to 768px | Adjusted layout, may have sidebar |
| 12.1.3 | Desktop (1024px+) | Resize to 1024px+ | Full sidebar, multi-column |

### 12.2 Touch Interaction Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 12.2.1 | Button taps | Tap buttons on mobile | Responsive, no double-tap needed |
| 12.2.2 | Input fields | Tap input on mobile | Keyboard appears, input focused |
| 12.2.3 | Scroll | Scroll long pages | Smooth scrolling |

### 12.3 Layout Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 12.3.1 | Charts on mobile | View charts at 375px | Charts resize, remain readable |
| 12.3.2 | Cards on mobile | View cards at 375px | Stack vertically |
| 12.3.3 | Forms on mobile | View forms at 375px | Full width inputs |
| 12.3.4 | Tables on mobile | View tables at 375px | Horizontal scroll or stack |

---

## Test Execution Checklist

Use this checklist to track your testing progress:

### Quick Start
- [ ] Environment set up (Anvil + Frontend running)
- [ ] Contracts deployed
- [ ] Test wallet funded with USDC
- [ ] MetaMask configured with Anvil network

### Pages Tested
- [ ] Dashboard Overview (Section 3)
- [ ] Deposit Page (Section 4)
- [ ] Withdraw Page (Section 5)
- [ ] Portfolio Page (Section 6)
- [ ] Analytics Page (Section 7)
- [ ] Transaction History (Section 8)

### Flows Tested
- [ ] First deposit flow (new LP)
- [ ] Partial withdrawal
- [ ] Full position exit
- [ ] Multiple deposits
- [ ] Wallet connect/disconnect

### Edge Cases Tested
- [ ] Error handling
- [ ] Mobile responsive
- [ ] Keyboard navigation

---

## Troubleshooting Common Issues

### Anvil Connection Issues
```bash
# If Anvil connection fails, check:
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
# Expected: {"jsonrpc":"2.0","id":1,"result":"0x7a69"} (31337 in hex)
```

### MetaMask Network Not Switching
1. Remove Anvil network from MetaMask
2. Re-add with correct settings
3. Restart browser if needed

### Contract Addresses Changed
After restarting Anvil, contracts need redeployment:
```bash
cd contracts && ./test/anvil/test-contracts.sh
# Then update .env.local with new addresses
```

### USDC Balance Not Showing
1. Verify MockUSDC contract address is correct
2. Re-import token in MetaMask
3. Check mint transaction succeeded:
```bash
cast call <MOCK_USDC_ADDRESS> "balanceOf(address)(uint256)" \
  0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
  --rpc-url http://127.0.0.1:8545
```

---

**Document Version:** 1.0
**Last Updated:** 2026-02-01
**Related Documents:**
- `04_financier_lp_dashboard_ui.md` - UI Design Specification
- `05_centralized_env_config.md` - Environment Configuration
- `contracts/test/anvil/README.md` - Contract Testing Guide
