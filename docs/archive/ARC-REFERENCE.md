# Arc Network Reference

> **ARCHIVED:** This document was part of the original hackathon design (Arc + Base dual-chain).
> The production architecture uses Base-only deployment. See `docs/01_architecture_analysis.md` for rationale.
> This file is kept for historical reference only.

---

> Consolidated reference for Seed Finance development on Arc

---

## Network Configuration

### Arc Testnet

| Property | Value |
|----------|-------|
| **Network Name** | Arc Testnet |
| **Chain ID** | 5042002 |
| **RPC Endpoint** | https://rpc.testnet.arc.network |
| **WebSocket** | wss://rpc.testnet.arc.network |
| **Explorer** | https://testnet.arcscan.app |
| **Faucet** | https://faucet.circle.com |
| **Native Currency** | USDC (18 decimals) |
| **Gateway Domain ID** | 26 |

### Alternative RPC Endpoints
- https://rpc.blockdaemon.testnet.arc.network
- https://rpc.drpc.testnet.arc.network
- https://rpc.quicknode.testnet.arc.network

---

## Contract Addresses (Testnet)

| Contract | Address |
|----------|---------|
| **USDC** | `0x3600000000000000000000000000000000000000` |
| **Gateway Wallet** | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` |
| **Gateway Minter** | `0x0022222ABE238Cc2C7Bb1f21003F0a260052475B` |

---

## Architecture Overview

### Consensus Layer (Malachite)
- High-performance Tendermint BFT implementation
- **Deterministic finality** in <1 second
- Transactions are irreversible once committed
- Proof-of-Authority validator model

### Execution Layer (Reth)
- Rust implementation of Ethereum execution
- Full EVM compatibility
- Native stablecoin services:
  - Fee Manager (USDC-denominated fees)
  - Privacy Module (opt-in)
  - Stablecoin Services (multi-currency)

---

## Circle SDK Packages

```bash
# Core packages for Arc development
npm install @circle-fin/developer-controlled-wallets  # Wallets SDK
npm install @circle-fin/smart-contract-platform       # Contracts SDK
npm install @circle-fin/bridge-kit                    # Cross-chain bridging
npm install @circle-fin/adapter-circle-wallets        # Bridge Kit adapter
```

---

## Circle Gateway (Chain Abstraction)

### How It Works

1. **Deposit** USDC to Gateway Wallet on any supported chain
2. Creates **unified crosschain balance**
3. **Transfer out** to any destination chain

### Supported Chains (Testnet)

| Chain | USDC Address | Domain ID |
|-------|-------------|-----------|
| Arc Testnet | `0x3600000000000000000000000000000000000000` | 26 |
| Ethereum Sepolia | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | 0 |
| Avalanche Fuji | `0x5425890298aed601595a70AB815c96711a31Bc65` | 1 |
| Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | 6 |

### Gateway API

```
Testnet: https://gateway-api-testnet.circle.com/v1
```

### Deposit Flow

```typescript
// 1. Approve USDC for Gateway Wallet
await client.createContractExecutionTransaction({
  walletId: WALLET_ID,
  contractAddress: USDC_ADDRESS,
  abiFunctionSignature: "approve(address,uint256)",
  abiParameters: [GATEWAY_WALLET_ADDRESS, amount],
  fee: { type: "level", config: { feeLevel: "MEDIUM" } },
});

// 2. Deposit to Gateway
await client.createContractExecutionTransaction({
  walletId: WALLET_ID,
  contractAddress: GATEWAY_WALLET_ADDRESS,
  abiFunctionSignature: "deposit(address,uint256)",
  abiParameters: [USDC_ADDRESS, amount],
  fee: { type: "level", config: { feeLevel: "MEDIUM" } },
});
```

### Transfer Flow (Mint on Destination)

```typescript
// 1. Sign burn intents with EIP-712

// 2. Submit to Gateway API
const response = await fetch(
  "https://gateway-api-testnet.circle.com/v1/transfer",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(signedBurnIntents),
  }
);
const { attestation, signature } = await response.json();

// 3. Mint on destination chain
await client.createContractExecutionTransaction({
  walletAddress: DEPOSITOR_ADDRESS,
  blockchain: "ARC-TESTNET",
  contractAddress: GATEWAY_MINTER_ADDRESS,
  abiFunctionSignature: "gatewayMint(bytes,bytes)",
  abiParameters: [attestation, signature],
  fee: { type: "level", config: { feeLevel: "MEDIUM" } },
});
```

---

## Bridge Kit (CCTP)

Direct USDC bridging between chains via Circle's Cross-Chain Transfer Protocol.

```typescript
import { BridgeKit } from "@circle-fin/bridge-kit";
import { createCircleWalletsAdapter } from "@circle-fin/adapter-circle-wallets";

const kit = new BridgeKit();

const adapter = createCircleWalletsAdapter({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});

await kit.bridge({
  from: {
    adapter,
    chain: "Ethereum_Sepolia",
    address: sourceAddress,
  },
  to: {
    adapter,
    chain: "Arc_Testnet",
    address: destinationAddress,
  },
  amount: "100.00",
});
```

---

## CCTP V2 Fast Transfer (Arc ↔ Base)

CCTP V2 introduces **Fast Transfer** mode, enabling sub-second USDC transfers between Arc and Base.

### Key Advantages

| Feature | CCTP V1 / Wormhole | CCTP V2 Fast Transfer |
|---------|--------------------|-----------------------|
| **Transfer Time** | 15-20 minutes | ~seconds |
| **Attestation** | Wait for finality | Pre-signed by Circle |
| **Bridge Fee** | Variable | Gas only |
| **Reliability** | External validators | Circle-attested |

### Arc → Base Transfer

```typescript
import { BridgeKit } from "@circle-fin/bridge-kit";

const kit = new BridgeKit();

// Fast Transfer from Arc to Base
const result = await kit.bridge({
  from: {
    chain: "Arc_Testnet",
    address: arcWalletAddress,
  },
  to: {
    chain: "Base_Sepolia",
    address: baseExecutionPoolAddress,
  },
  amount: "10000.00", // USDC
  options: {
    fastTransfer: true, // Enable CCTP V2 Fast Transfer
  },
});

console.log(`Transfer hash: ${result.transactionHash}`);
// Funds arrive on Base in seconds
```

### Base → Arc Return

```typescript
// Return funds from Base to Arc after invoice repayment
const returnResult = await kit.bridge({
  from: {
    chain: "Base_Sepolia",
    address: baseExecutionPoolAddress,
  },
  to: {
    chain: "Arc_Testnet",
    address: arcLiquidityPoolAddress,
  },
  amount: "10500.00", // Principal + yield
  options: {
    fastTransfer: true,
  },
});
```

### Supported Fast Transfer Routes

| Source | Destination | Domain IDs |
|--------|-------------|------------|
| Arc Testnet | Base Sepolia | 26 → 6 |
| Base Sepolia | Arc Testnet | 6 → 26 |
| Arc Mainnet | Base Mainnet | 26 → 6 |
| Base Mainnet | Arc Mainnet | 6 → 26 |

### Why Base for Credit Execution?

Seed Finance uses Base as the credit execution layer because:

1. **Same Language (Solidity)** — No context switching, ~80% code reuse
2. **CCTP V2 Native** — Sub-second transfers from Arc
3. **Circle Alignment** — Coinbase + Circle partnership
4. **Account Abstraction** — 87% of ERC-4337 activity
5. **Low Costs** — ~$0.001 per transaction

---

## Circle Wallets

### Create Dev-Controlled Wallet

```typescript
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});

// Create wallet set
const walletSetResponse = await client.createWalletSet({
  name: "Seed Finance Wallets",
});

// Create wallet on Arc
const walletsResponse = await client.createWallets({
  blockchains: ["ARC-TESTNET"],
  count: 1,
  walletSetId: walletSetResponse.data?.walletSet?.id,
  accountType: "SCA", // Smart Contract Account (recommended)
});
```

### Check Balance

```typescript
const response = await client.getWalletTokenBalance({
  id: walletId,
});
```

---

## Smart Contract Deployment

### Using Circle Contracts SDK

```typescript
import { initiateSmartContractPlatformClient } from "@circle-fin/smart-contract-platform";

const circleContractSdk = initiateSmartContractPlatformClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});

// Deploy ERC-20 template
const response = await circleContractSdk.deployContractTemplate({
  id: "a1b74add-23e0-4712-88d1-6b3009e85a86", // ERC-20 template
  blockchain: "ARC-TESTNET",
  name: "SeedFinanceToken",
  walletId: process.env.WALLET_ID,
  templateParameters: {
    name: "Seed Finance LP Token",
    symbol: "sfUSDC",
    defaultAdmin: walletAddress,
    primarySaleRecipient: walletAddress,
  },
  fee: { type: "level", config: { feeLevel: "MEDIUM" } },
});
```

### Template IDs

| Template | ID |
|----------|-----|
| ERC-20 | `a1b74add-23e0-4712-88d1-6b3009e85a86` |
| ERC-721 | `76b83278-50e2-4006-8b63-5b1a2a814533` |
| ERC-1155 | `aea21da6-0aa2-4971-9a1a-5098842b1248` |
| Airdrop | `13e322f2-18dc-4f57-8eed-4bddfc50f85e` |

### Using Foundry/Hardhat

Standard EVM deployment works. Configure your network:

```javascript
// hardhat.config.js
networks: {
  arcTestnet: {
    url: "https://rpc.testnet.arc.network",
    chainId: 5042002,
    accounts: [process.env.PRIVATE_KEY],
  },
}
```

---

## Key Features for Seed Finance

### 1. USDC as Gas
- No need to hold native tokens
- Predictable transaction costs
- USDC decimals: 18 on Arc (vs 6 on other chains)

### 2. Sub-Second Finality
- Transactions finalize in <1 second
- No reorgs or rollbacks
- Instant confirmation for invoice approvals

### 3. Gateway for Liquidity Aggregation
- LPs deposit from any chain
- Unified balance on Arc
- Route to Base via CCTP V2 when needed

### 4. Circle Wallets for Companies
- No private key management
- API-driven transaction signing
- Perfect for buyer/supplier abstraction

---

## Environment Variables

```env
# Circle API
CIRCLE_API_KEY=TEST_API_KEY:xxx:yyy
CIRCLE_ENTITY_SECRET=64_char_alphanumeric

# Arc Network
ARC_RPC_URL=https://rpc.testnet.arc.network
ARC_CHAIN_ID=5042002

# Contract Addresses
ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
GATEWAY_WALLET_ADDRESS=0x0077777d7EBA4688BDeF3E311b846F25870A19B9
GATEWAY_MINTER_ADDRESS=0x0022222ABE238Cc2C7Bb1f21003F0a260052475B

# Wallet IDs (from Circle Console)
ARC_WALLET_ID=
ETH_SEPOLIA_WALLET_ID=
BASE_SEPOLIA_WALLET_ID=
AVAX_FUJI_WALLET_ID=
```

---

## Useful Links

- [Arc Docs](https://docs.arc.network)
- [Arc Explorer](https://testnet.arcscan.app)
- [Circle Faucet](https://faucet.circle.com)
- [Circle Developer Console](https://console.circle.com)
- [Gateway API Reference](https://developers.circle.com/gateway)
- [Circle Wallets Docs](https://developers.circle.com/wallets)
- [Bridge Kit Docs](https://developers.circle.com/bridge-kit)
