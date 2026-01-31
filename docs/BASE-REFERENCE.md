# Base Network Reference

> Primary reference for Seed Finance development on Base L2

---

## Network Configuration

### Base Sepolia (Testnet)

| Property | Value |
|----------|-------|
| **Network Name** | Base Sepolia |
| **Chain ID** | 84532 |
| **RPC Endpoint** | https://sepolia.base.org |
| **WebSocket** | wss://sepolia.base.org |
| **Explorer** | https://sepolia.basescan.org |
| **Faucet** | https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet |
| **Native Currency** | ETH |
| **CCTP Domain ID** | 6 |

### Base Mainnet

| Property | Value |
|----------|-------|
| **Network Name** | Base |
| **Chain ID** | 8453 |
| **RPC Endpoint** | https://mainnet.base.org |
| **WebSocket** | wss://mainnet.base.org |
| **Explorer** | https://basescan.org |
| **Native Currency** | ETH |
| **CCTP Domain ID** | 6 |

### Alternative RPC Endpoints (Mainnet)
- https://base.llamarpc.com
- https://base-mainnet.public.blastapi.io
- https://base.meowrpc.com

---

## Contract Addresses

### Base Sepolia (Testnet)

| Contract | Address |
|----------|---------|
| **USDC** | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| **CCTP TokenMessenger** | `0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5` |
| **CCTP MessageTransmitter** | `0x7865fAfC2db2093669d92c0F33AeEF291086BEFD` |

### Base Mainnet

| Contract | Address |
|----------|---------|
| **USDC** | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| **CCTP TokenMessenger** | `0x1682Ae6375C4E4A97e4B583BC394c861A46D8962` |
| **CCTP MessageTransmitter** | `0xAD09780d193884d503182aD4588450C416D6F9D4` |

### USDC Details

| Property | Testnet | Mainnet |
|----------|---------|---------|
| **Symbol** | USDC | USDC |
| **Decimals** | 6 | 6 |
| **Type** | Native (Circle-issued) | Native (Circle-issued) |

---

## Why Base for Seed Finance?

### 1. Single-Chain Simplicity

Base provides everything needed for invoice financing in one place:
- Native USDC (not bridged)
- Deep DeFi ecosystem
- Circle tool compatibility
- Account abstraction leadership

### 2. Fast & Cheap

| Metric | Base | Ethereum L1 |
|--------|------|-------------|
| Avg Gas Price | ~0.001 gwei | ~20 gwei |
| Transfer Cost | ~$0.001 | ~$2 |
| Block Time | 2 seconds | 12 seconds |
| Finality | ~2 seconds | ~15 minutes |

### 3. Account Abstraction Leadership

Base leads in ERC-4337 adoption:
- 87% of all ERC-4337 activity
- Smart Contract Accounts for users
- Gasless transactions possible
- Perfect for Circle Wallets integration

### 4. Circle Alignment

Base is Coinbase's L2, deeply integrated with Circle:
- Native USDC (not bridged)
- Circle partnership
- Enterprise-grade infrastructure
- Circle Wallets + Gateway work natively

---

## SDK Packages

```bash
# Core packages for Base development
npm install ethers@^6.0.0           # Ethereum library
npm install @openzeppelin/contracts # Standard contracts
npm install hardhat                  # Development framework

# Circle Integration
npm install @circle-fin/developer-controlled-wallets
npm install @circle-fin/smart-contract-platform

# Optional: Multi-chain LP deposits (Phase 2)
npm install @circle-fin/bridge-kit
npm install @circle-fin/adapter-circle-wallets
```

---

## Hardhat Configuration

```javascript
// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.20",
  networks: {
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      chainId: 84532,
      accounts: [process.env.PRIVATE_KEY],
    },
    baseMainnet: {
      url: process.env.BASE_MAINNET_RPC_URL || "https://mainnet.base.org",
      chainId: 8453,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      baseSepolia: process.env.BASESCAN_API_KEY,
      base: process.env.BASESCAN_API_KEY,
    },
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
    ],
  },
};
```

---

## Seed Finance Contract Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BASE L2 CONTRACTS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    LiquidityPool.sol (ERC-4626)                         │ │
│  │  • LP deposits USDC, receives sfUSDC shares                            │ │
│  │  • Tracks deployed capital vs available liquidity                      │ │
│  │  • Automatic yield distribution via share price increase               │ │
│  │  • Optional: USYC treasury integration for idle capital yield          │ │
│  └────────────────────────────────┬───────────────────────────────────────┘ │
│                                   │                                          │
│                                   ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    InvoiceRegistry.sol                                  │ │
│  │  • Invoice CRUD operations                                             │ │
│  │  • Status lifecycle (PENDING → APPROVED → FUNDED → PAID)               │ │
│  │  • Access control (buyer, supplier modifiers)                          │ │
│  │  • Events for backend integration                                      │ │
│  └────────────────────────────────┬───────────────────────────────────────┘ │
│                                   │                                          │
│                                   ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    ExecutionPool.sol                                    │ │
│  │  • Receives USDC from LiquidityPool for funding                        │ │
│  │  • Funds approved invoices                                             │ │
│  │  • Receives repayments from buyers                                     │ │
│  │  • Returns capital + yield to LiquidityPool                            │ │
│  └────────────────────────────────┬───────────────────────────────────────┘ │
│                                   │                                          │
│                                   ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    PaymentRouter.sol                                    │ │
│  │  • Orchestrates funding requests                                       │ │
│  │  • Processes repayments                                                │ │
│  │  • Coordinates between all contracts                                   │ │
│  │  • Protocol fee management                                             │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    TreasuryManager.sol (Optional - Phase 2)            │ │
│  │  • Deposits idle USDC to USYC for Treasury yield                       │ │
│  │  • Redeems USYC instantly when funding needed                          │ │
│  │  • Dual-yield: Treasury rate on idle + invoice spread on deployed      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Deployment Order

1. Deploy `InvoiceRegistry.sol`
2. Deploy `LiquidityPool.sol` (pass USDC address)
3. Deploy `ExecutionPool.sol` (pass USDC, InvoiceRegistry, LiquidityPool)
4. Deploy `PaymentRouter.sol` (pass InvoiceRegistry, ExecutionPool)
5. Configure access control roles:
   - Grant `EXECUTOR_ROLE` on InvoiceRegistry to ExecutionPool
   - Grant `ROUTER_ROLE` on LiquidityPool to ExecutionPool
   - Grant `ROUTER_ROLE` on ExecutionPool to PaymentRouter
   - Grant `OPERATOR_ROLE` on PaymentRouter to backend service

### Contract Addresses (After Deployment)

```env
# Seed Finance Contracts (Base Sepolia)
BASE_LIQUIDITY_POOL_ADDRESS=
BASE_INVOICE_REGISTRY_ADDRESS=
BASE_EXECUTION_POOL_ADDRESS=
BASE_PAYMENT_ROUTER_ADDRESS=
```

---

## Circle Integration

### Circle Wallets

Circle Wallets work natively on Base for buyer/supplier account abstraction.

```typescript
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});

// Create wallet on Base
const walletsResponse = await client.createWallets({
  blockchains: ['BASE-SEPOLIA'], // or 'BASE' for mainnet
  count: 1,
  walletSetId: walletSetId,
  accountType: 'SCA', // Smart Contract Account
});
```

### Circle Gateway

Circle Gateway handles fiat on/off-ramp directly on Base.

```
On-Ramp (Buyer Repayment):
Buyer's Bank → Circle Gateway → USDC on Base → ExecutionPool

Off-Ramp (Supplier Payout):
ExecutionPool → Supplier Wallet → Circle Gateway → Supplier's Bank
```

### CCTP (Optional - Phase 2)

If multi-chain LP deposits are needed, CCTP can bring USDC from other chains:

```typescript
import { BridgeKit } from "@circle-fin/bridge-kit";

const kit = new BridgeKit();

// LP deposits from Ethereum to Base
await kit.bridge({
  from: {
    chain: "Ethereum_Sepolia",
    address: lpWalletAddress,
  },
  to: {
    chain: "Base_Sepolia",
    address: liquidityPoolAddress,
  },
  amount: "10000.00", // USDC
});
```

---

## Environment Variables

```env
# Base Network
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_SEPOLIA_CHAIN_ID=84532
BASE_MAINNET_RPC_URL=https://mainnet.base.org
BASE_MAINNET_CHAIN_ID=8453

# Contract Addresses (Testnet)
BASE_SEPOLIA_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
BASE_CCTP_TOKEN_MESSENGER=0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5
BASE_CCTP_MESSAGE_TRANSMITTER=0x7865fAfC2db2093669d92c0F33AeEF291086BEFD

# Seed Finance Contracts (after deployment)
BASE_LIQUIDITY_POOL_ADDRESS=
BASE_INVOICE_REGISTRY_ADDRESS=
BASE_EXECUTION_POOL_ADDRESS=
BASE_PAYMENT_ROUTER_ADDRESS=

# CCTP
CCTP_BASE_DOMAIN_ID=6

# Circle API
CIRCLE_API_KEY=TEST_API_KEY:xxx:yyy
CIRCLE_ENTITY_SECRET=

# Explorer
BASESCAN_API_KEY=
```

---

## Useful Links

- [Base Docs](https://docs.base.org)
- [Base Bridge](https://bridge.base.org)
- [Base Explorer (Mainnet)](https://basescan.org)
- [Base Explorer (Sepolia)](https://sepolia.basescan.org)
- [Base Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)
- [Circle CCTP Docs](https://developers.circle.com/stablecoins/cctp-getting-started)
- [Circle Wallets Docs](https://developers.circle.com/wallets)
- [Circle Gateway Docs](https://developers.circle.com/gateway)
- [Base Status](https://status.base.org)

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) — Technical implementation guide
- [Architecture Analysis](./01_architecture_analysis.md) — Why Base-only
- [Arc Reference (Archived)](./archive/ARC-REFERENCE.md) — Historical reference

---

*Document Version: 2.0*
*Updated: 2026-01-31*
*Status: Primary reference for production*
