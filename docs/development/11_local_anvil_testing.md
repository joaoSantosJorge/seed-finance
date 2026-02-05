# Local Anvil Testing Setup Guide

This guide provides complete instructions for testing the Seed Finance protocol locally using Anvil (Foundry's local Ethereum node).

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Quick Start](#2-quick-start)
3. [Starting Anvil](#3-starting-anvil)
4. [Deploying Contracts](#4-deploying-contracts)
5. [Configuring the Frontend](#5-configuring-the-frontend)
6. [Test Wallet Setup](#6-test-wallet-setup)
7. [Testing Workflow](#7-testing-workflow)
8. [Using Cast for Direct Contract Interaction](#8-using-cast-for-direct-contract-interaction)
9. [Time Manipulation for Maturity Testing](#9-time-manipulation-for-maturity-testing)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

### 1.1 Required Software

| Software | Version | Installation |
|----------|---------|--------------|
| **Foundry** | Latest | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| **Node.js** | 18+ | [https://nodejs.org](https://nodejs.org) |
| **MetaMask** | Latest | Browser extension |

### 1.2 Verify Installation

```bash
# Check Foundry installation
forge --version
anvil --version
cast --version

# Check Node.js
node --version
npm --version
```

### 1.3 Clone and Install Dependencies

```bash
# Install contract dependencies
cd contracts
forge install

# Install frontend dependencies
cd ../frontend
npm install
```

---

## 2. Quick Start

For experienced users, here's the complete setup in one terminal session:

```bash
# Terminal 1: Start Anvil
cd contracts
anvil --host 0.0.0.0 --accounts 15 --balance 10000 --state state.json

# Terminal 2: Deploy contracts
cd contracts
forge script script/DeployLocal.s.sol:DeployLocal \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast

# Terminal 3: Start frontend (after updating .env.local with deployed addresses)
cd frontend
npm run dev
```

Then open `http://localhost:3000/dashboard/financier` in your browser.

---

## 3. Starting Anvil

### 3.1 Basic Start

```bash
cd contracts
anvil --host 0.0.0.0 --accounts 10 --balance 10000
```

**Flags explained:**
- `--host 0.0.0.0`: Allow connections from any interface (needed for some setups)
- `--accounts 10`: Create 10 test accounts
- `--balance 10000`: Each account starts with 10,000 ETH

### 3.2 Anvil Output

When Anvil starts, you'll see:

```
                             _   _
                            (_) | |
      __ _   _ __   __   __  _  | |
     / _` | | '_ \  \ \ / / | | | |
    | (_| | | | | |  \ V /  | | | |
     \__,_| |_| |_|   \_/   |_| |_|

    0.2.0 (...)

Available Accounts
==================
(0) 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000.000000000000000000 ETH)
(1) 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (10000.000000000000000000 ETH)
(2) 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC (10000.000000000000000000 ETH)
(3) 0x90F79bf6EB2c4f870365E785982E1f101E93b906 (10000.000000000000000000 ETH)
...

Private Keys
==================
(0) 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
(1) 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
(2) 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
(3) 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
...

Listening on 0.0.0.0:8545
```

### 3.3 Keeping Anvil Persistent

By default, Anvil resets when restarted. To persist state across restarts:

```bash
cd contracts
anvil --host 0.0.0.0 --accounts 15 --balance 10000 --load-state anvil-state.json
```

This saves blockchain state to `contracts/state.json` and reloads it on restart.

**Important:**
- Always run Anvil from the `contracts/` directory
- Use `Ctrl+C` for graceful shutdown (waits for state to save)
- See `docs/development/13_anvil_state_management.md` for detailed state management guide

---

## 4. Deploying Contracts

### 4.1 Run Deployment Script

In a new terminal:

```bash
cd contracts
forge script script/DeployLocal.s.sol:DeployLocal \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast
```

### 4.2 Deployment Output

The script will output all deployed contract addresses:

```
=== Seed Finance Local Deployment ===
Deployer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

Step 1: Deploying MockUSDC...
  MockUSDC deployed at: 0x5FbDB2315678afecb367f032d93F642f64180aa3

Step 2: Deploying LiquidityPool...
  LiquidityPool deployed at: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
  LiquidityPool buffer set to: 10000 USDC

Step 3: Deploying Facets...
  InvoiceFacet deployed at: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
  FundingFacet deployed at: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
  RepaymentFacet deployed at: 0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
  ViewFacet deployed at: 0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
  AdminFacet deployed at: 0x0165878A594ca255338adfa4d48449f69242Eb8F

Step 4: Deploying InvoiceDiamond...
  InvoiceDiamond deployed at: 0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
  InvoiceDiamond initialized with owner: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

Step 5: Deploying ExecutionPool...
  ExecutionPool deployed at: 0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6

Step 6: Configuring access control and contract links...
  ExecutionPool linked to LiquidityPool and InvoiceDiamond
  Granted ROUTER_ROLE to ExecutionPool in LiquidityPool
  InvoiceDiamond linked to ExecutionPool and LiquidityPool
  Deployer set as operator in InvoiceDiamond

Step 7: Minting test USDC...
  Minted 1000000 USDC to Financier: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
  Minted 1000000 USDC to Supplier: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
  Minted 1000000 USDC to Buyer: 0x90F79bf6EB2c4f870365E785982E1f101E93b906
  Minted 1000000 USDC to Deployer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

=== Deployment Complete ===

Contract Addresses (copy to frontend/.env.local):
  NEXT_PUBLIC_USDC_ADDRESS= 0x5FbDB2315678afecb367f032d93F642f64180aa3
  NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS= 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
  NEXT_PUBLIC_INVOICE_DIAMOND_ADDRESS= 0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
  NEXT_PUBLIC_EXECUTION_POOL_ADDRESS= 0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6

Test Accounts:
  Deployer/Admin (Account 0): 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  Financier/LP (Account 1):   0x70997970C51812dc3A010C7d01b50e0d17dc79C8
  Supplier (Account 2):       0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
  Buyer (Account 3):          0x90F79bf6EB2c4f870365E785982E1f101E93b906

Each test account has 1000000 USDC
```

### 4.3 Alternative: Deploy with Sample Invoice

To also create a sample invoice for testing:

```bash
forge script script/DeployLocal.s.sol:DeployLocalWithSampleInvoice \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast
```

This creates a sample invoice ($10,000 USDC, 5% APR, 30 days maturity) from Supplier to Buyer.

---

## 5. Configuring the Frontend

### 5.1 Create Environment File

Copy the template and fill in deployed addresses:

```bash
cd frontend
cp .env.local.example .env.local
```

### 5.2 Update .env.local

Edit `frontend/.env.local` with the addresses from deployment output:

```env
# Environment
NEXT_PUBLIC_ENV=local

# WalletConnect (use any project ID for local testing)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=demo-project-id

# Deployed Contract Addresses (from DeployLocal.s.sol output)
NEXT_PUBLIC_USDC_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
NEXT_PUBLIC_INVOICE_DIAMOND_ADDRESS=0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
NEXT_PUBLIC_EXECUTION_POOL_ADDRESS=0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6

# Optional (not needed for basic testing)
NEXT_PUBLIC_TREASURY_MANAGER_ADDRESS=
NEXT_PUBLIC_LIFI_RECEIVER_ADDRESS=
```

### 5.3 Start Frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 6. Test Wallet Setup

### 6.1 Anvil Test Accounts

The deployment script configures these accounts:

| Role | Account | Address | Private Key |
|------|---------|---------|-------------|
| **Deployer/Admin** | 0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec...f2ff80` |
| **Financier (LP)** | 1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e9...b78690d` |
| **Supplier** | 2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111af...ab365a` |
| **Buyer** | 3 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | `0x7c852118...007a6` |

**Full private keys:**
- Account 0: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
- Account 1: `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`
- Account 2: `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a`
- Account 3: `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6`

### 6.2 Add Anvil Network to MetaMask

1. Open MetaMask
2. Click the network dropdown (top left)
3. Click "Add network" > "Add a network manually"
4. Enter these settings:

| Field | Value |
|-------|-------|
| Network Name | Anvil Local |
| RPC URL | `http://localhost:8545` |
| Chain ID | `31337` |
| Currency Symbol | `ETH` |

5. Click "Save"

### 6.3 Import Test Account to MetaMask

1. In MetaMask, click account icon (top right)
2. Click "Add account or hardware wallet"
3. Click "Import account"
4. Paste the private key for the role you want to test:
   - For LP testing: Use Account 1 (Financier)
   - For Supplier testing: Use Account 2
   - For Buyer testing: Use Account 3
5. Click "Import"

### 6.4 Add USDC Token to MetaMask

1. In MetaMask, click "Import tokens"
2. Enter the MockUSDC contract address (from deployment output)
3. Symbol: `mUSDC` (or `USDC`)
4. Decimals: `6`
5. Click "Add custom token"

---

## 7. Testing Workflow

### 7.1 Complete Invoice Financing Flow

Here's the full flow to test the protocol:

#### Step 1: Financier Deposits USDC to Pool

1. Import Account 1 (Financier) to MetaMask
2. Go to `http://localhost:3000/dashboard/financier/deposit`
3. Enter amount (e.g., 100,000 USDC)
4. Click "Approve USDC" and confirm in MetaMask
5. Click "Deposit" and confirm in MetaMask
6. Verify SEED shares received in wallet and dashboard

#### Step 2: Supplier Creates Invoice

1. Switch to Account 2 (Supplier) in MetaMask
2. Go to `http://localhost:3000/dashboard/supplier` (or use cast command below)
3. Create an invoice for the Buyer:
   - Face Value: 10,000 USDC
   - Discount Rate: 5% APR (500 bps)
   - Maturity: 30 days

Using cast:
```bash
# Create invoice from Supplier (Account 2)
cast send <INVOICE_DIAMOND_ADDRESS> \
  "createInvoice(address,uint128,uint16,uint64,bytes32,bytes32)" \
  0x90F79bf6EB2c4f870365E785982E1f101E93b906 \
  10000000000 \
  500 \
  $(cast --to-uint256 $(($(date +%s) + 2592000))) \
  $(cast --to-bytes32 "invoice-001") \
  $(cast --to-bytes32 "INV-2024-001") \
  --rpc-url http://localhost:8545 \
  --private-key 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
```

#### Step 3: Buyer Approves Invoice

1. Switch to Account 3 (Buyer) in MetaMask
2. Go to `http://localhost:3000/dashboard/buyer` (or use cast)
3. Find the pending invoice and approve it

Using cast:
```bash
# Approve invoice (Invoice ID = 1)
cast send <INVOICE_DIAMOND_ADDRESS> \
  "approveInvoice(uint256)" 1 \
  --rpc-url http://localhost:8545 \
  --private-key 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
```

#### Step 4: Operator Funds Invoice

The operator (deployer) triggers funding:

```bash
# Fund invoice (as operator - Account 0)
cast send <EXECUTION_POOL_ADDRESS> \
  "fundInvoice(uint256,address,uint128,uint128)" \
  1 \
  0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC \
  9958904109 \
  10000000000 \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

**Note:** The funding amount (9958904109) is calculated as face value minus discount for 30 days at 5% APR.

#### Step 5: Verify Supplier Received USDC

```bash
# Check Supplier's USDC balance
cast call <USDC_ADDRESS> \
  "balanceOf(address)(uint256)" \
  0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC \
  --rpc-url http://localhost:8545
```

#### Step 6: Buyer Repays at Maturity

1. Fast-forward time (see Section 9)
2. Buyer approves USDC spending and repays:

```bash
# Approve USDC for repayment
cast send <USDC_ADDRESS> \
  "approve(address,uint256)" \
  <EXECUTION_POOL_ADDRESS> \
  10000000000 \
  --rpc-url http://localhost:8545 \
  --private-key 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6

# Repay invoice
cast send <EXECUTION_POOL_ADDRESS> \
  "repayInvoice(uint256)" 1 \
  --rpc-url http://localhost:8545 \
  --private-key 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
```

#### Step 7: Verify Yield in LiquidityPool

1. Switch to Financier account
2. Check dashboard - share price should have increased
3. Verify yield was distributed to pool

---

## 8. Using Cast for Direct Contract Interaction

### 8.1 Useful Read Commands

```bash
# Check pool TVL
cast call <LIQUIDITY_POOL_ADDRESS> "totalAssets()(uint256)" --rpc-url http://localhost:8545

# Check available liquidity
cast call <LIQUIDITY_POOL_ADDRESS> "availableLiquidity()(uint256)" --rpc-url http://localhost:8545

# Check share price
cast call <LIQUIDITY_POOL_ADDRESS> "convertToAssets(uint256)(uint256)" 1000000000000000000 --rpc-url http://localhost:8545

# Get invoice details
cast call <INVOICE_DIAMOND_ADDRESS> "getInvoice(uint256)" 1 --rpc-url http://localhost:8545

# Get invoice stats
cast call <INVOICE_DIAMOND_ADDRESS> "getStats()(uint256,uint256,uint256,uint256)" --rpc-url http://localhost:8545

# Check if address is operator
cast call <INVOICE_DIAMOND_ADDRESS> "isOperator(address)(bool)" 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --rpc-url http://localhost:8545
```

### 8.2 Useful Write Commands

```bash
# Mint more test USDC
cast send <USDC_ADDRESS> \
  "mint(address,uint256)" \
  0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
  1000000000000 \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Grant operator role (admin only)
cast send <INVOICE_DIAMOND_ADDRESS> \
  "setOperator(address,bool)" \
  0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
  true \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

---

## 9. Time Manipulation for Maturity Testing

Anvil allows manipulating blockchain time, which is essential for testing invoice maturity.

### 9.1 Skip Time Forward

```bash
# Skip 30 days forward (in seconds: 30 * 24 * 60 * 60 = 2592000)
cast rpc anvil_increaseTime 2592000 --rpc-url http://localhost:8545

# Mine a new block to apply the time change
cast rpc anvil_mine 1 --rpc-url http://localhost:8545
```

### 9.2 Set Specific Timestamp

```bash
# Set to specific Unix timestamp
cast rpc anvil_setBlockTimestampInterval 1 --rpc-url http://localhost:8545
cast rpc evm_setNextBlockTimestamp 1735689600 --rpc-url http://localhost:8545
cast rpc anvil_mine 1 --rpc-url http://localhost:8545
```

### 9.3 Check Current Block Timestamp

```bash
cast block latest --rpc-url http://localhost:8545 | grep timestamp
```

---

## 10. Troubleshooting

### 10.1 Anvil Connection Issues

**Symptom:** Cannot connect to `http://localhost:8545`

**Solutions:**
```bash
# Check if Anvil is running
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'

# Expected response:
# {"jsonrpc":"2.0","id":1,"result":"0x7a69"}  (31337 in hex)

# If using WSL, try:
anvil --host 127.0.0.1 --accounts 10 --balance 10000
```

### 10.2 MetaMask "Nonce Too Low" Error

**Cause:** MetaMask caches nonces, but Anvil resets on restart.

**Solution:**
1. In MetaMask, click account menu > Settings
2. Go to Advanced
3. Click "Clear activity tab data"
4. Reconnect to Anvil

### 10.3 Contract Addresses Changed After Restart

**Cause:** Anvil resets state on restart (unless using `--state`).

**Solution:**
1. Re-run the deployment script
2. Update `frontend/.env.local` with new addresses
3. Restart the frontend dev server

### 10.4 Transaction Failing with "Insufficient Funds"

**Cause:** Account doesn't have enough ETH for gas or USDC for the transaction.

**Check balances:**
```bash
# Check ETH balance
cast balance 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 --rpc-url http://localhost:8545

# Check USDC balance
cast call <USDC_ADDRESS> "balanceOf(address)(uint256)" 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 --rpc-url http://localhost:8545
```

### 10.5 "Unauthorized" Error from Contract

**Cause:** Caller doesn't have required role (e.g., OPERATOR_ROLE, ROUTER_ROLE).

**Check and grant role:**
```bash
# Check if address is operator
cast call <INVOICE_DIAMOND_ADDRESS> "isOperator(address)(bool)" <ADDRESS> --rpc-url http://localhost:8545

# Grant operator role (as owner)
cast send <INVOICE_DIAMOND_ADDRESS> \
  "setOperator(address,bool)" <ADDRESS> true \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### 10.6 Frontend Shows Wrong Network

**Cause:** MetaMask is connected to a different network.

**Solution:**
1. Check MetaMask is on "Anvil Local" network (Chain ID 31337)
2. If not, switch networks
3. If Anvil Local not listed, add it manually (see Section 6.2)

### 10.7 SEED Token Not Showing in Wallet

**Solution:** Add SEED token to MetaMask:
1. Click "Import tokens"
2. Enter LiquidityPool address (this is the SEED token contract)
3. Symbol: `SEED`
4. Decimals: `6`

---

## Verification Checklist

After completing setup, verify:

- [ ] Anvil running on `http://localhost:8545`
- [ ] All contracts deployed (5 main contracts + 5 facets)
- [ ] Frontend connected to Anvil (Chain ID 31337)
- [ ] Test accounts imported to MetaMask
- [ ] Test accounts have USDC balance (1M each)
- [ ] Financier can deposit USDC and receive SEED
- [ ] Supplier can create invoices
- [ ] Buyer can approve invoices
- [ ] Operator can fund invoices
- [ ] Buyer can repay invoices
- [ ] Financier sees yield in increased share price

---

**Document Version:** 1.1
**Last Updated:** 2026-02-03
**Related Documents:**
- `13_anvil_state_management.md` - Detailed guide on state persistence
- `06_financier_dashboard_manual_testing.md` - Comprehensive UI testing guide
- `05_centralized_env_config.md` - Environment configuration
- `contracts/script/DeployLocal.s.sol` - Deployment script source
