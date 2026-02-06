# 09 - Circle Wallets + Gateway + CCTP Smart Routing Integration

## Overview

This document describes the integration of Circle's infrastructure with smart cross-chain routing for Seed Finance:

- **USDC transfers** - Use CCTP (Circle Cross-Chain Transfer Protocol)
- **Circle Wallets** - For ALL users (LPs, Buyers, Suppliers)
- **Circle Gateway** - Both fiat on-ramp and off-ramp

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SMART ROUTING ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         USER ENTRY POINTS                               │ │
│  │  • Fiat (Bank) ──► Circle Gateway ──► USDC on Base                    │ │
│  │  • USDC (any chain) ──► CCTP ──► USDC on Base                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                   │                                          │
│                                   ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    SMART ROUTER CONTRACT (Base)                         │ │
│  │  • Detects incoming token type                                         │ │
│  │  • Routes to appropriate handler (CCTP receiver)                      │ │
│  │  • Final destination: LiquidityPool for SEED shares                   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                   │                                          │
│                                   ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    CIRCLE WALLETS (MPC)                                 │ │
│  │  • LP Wallet: Holds SEED shares, receives yield                       │ │
│  │  • Buyer Wallet: Receives USDC (on-ramp), pays invoices               │ │
│  │  • Supplier Wallet: Receives funding, off-ramps to bank               │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## CCTP Reference

| Network | Domain ID | TokenMessenger | MessageTransmitter |
|---------|-----------|----------------|-------------------|
| Ethereum | 0 | `0xBd3fa81B58Ba92a82136038B25aDec7066af3155` | `0x0a992d191DEeC32aFe36203Ad87D7d289a738F81` |
| Avalanche | 1 | `0x6B25532e1060CE10cc3B0A99e5683b91BFDe6982` | `0x8186359aF5F57FbB40c6b14A588d2A59C0C29880` |
| Optimism | 2 | `0x2B4069517957735bE00ceE0fadAE88a26365528f` | `0x4D41f22c5a0e5c74090899E5a8Fb597a8842b3e8` |
| Arbitrum | 3 | `0x19330d10D9Cc8751218eaf51E8885D058642E08A` | `0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca` |
| Base Sepolia | 6 | `0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5` | `0x7865fAfC2db2093669d92c0F33AeEF291086BEFD` |
| Base Mainnet | 6 | `0x1682Ae6375C4E4A97e4B583BC394c861A46D8962` | `0xAD09780d193884d503182aD4588450C416D6F9D4` |
| Polygon | 7 | `0x9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE` | `0xF3be9355363857F3e001be68856A2f96b4C39Ba9` |

## Implemented Components

### Smart Contracts

#### 1. CCTPReceiver.sol
**Location:** `contracts/src/integrations/CCTPReceiver.sol`

Receives USDC from CCTP cross-chain transfers and auto-deposits to LiquidityPool.

Key features:
- `processCCTPDeposit()` - Process incoming CCTP transfers
- `directDeposit()` - Direct deposit for Base users
- Pending deposit mechanism for failed auto-deposits
- Nonce replay protection
- Domain ID constants for all supported chains

#### 2. SmartRouter.sol
**Location:** `contracts/src/integrations/SmartRouter.sol`

Unified entry point for all deposit methods.

Key features:
- `depositDirect()` - Direct USDC deposit on Base
- `handleCCTPDeposit()` - Called by CCTPReceiver after CCTP transfer
- Authorized handler system
- Deposit statistics by method

### Backend Services

#### 1. CircleWalletsService.ts
**Location:** `backend/services/CircleWalletsService.ts`

Manages Circle Developer-Controlled Wallets.

Key features:
- `createWallet()` - Create wallets for LPs, buyers, suppliers
- `getBalance()` - Get token balances
- `executeTransaction()` - Execute contract calls
- `approveUSDC()` - Approve USDC spending
- `depositToPool()` - Deposit to LiquidityPool
- `withdrawFromPool()` - Withdraw from pool
- `approveInvoice()` - Buyer invoice approval
- `repayInvoice()` - Buyer invoice repayment

#### 2. CircleGatewayService.ts
**Location:** `backend/services/CircleGatewayService.ts`

Manages fiat on-ramp and off-ramp operations.

Key features:
- `initiateOnRamp()` - Bank USD → USDC
- `initiateOffRamp()` - USDC → Bank USD
- `getPaymentStatus()` - Check payment status
- Webhook handlers for completion events

#### 3. DepositRoutingService.ts
**Location:** `backend/services/DepositRoutingService.ts`

Smart routing to determine optimal deposit path.

Routes:
1. **DIRECT** - USDC on Arc (fastest)
2. **CCTP** - USDC on other chains (~15 min)
3. **GATEWAY** - Fiat (1-3 days)

### Frontend Components

#### 1. CCTPDepositFlow.tsx
**Location:** `frontend/components/cctp/CCTPDepositFlow.tsx`

Multi-step component for CCTP deposits:
1. Select source chain
2. Enter amount
3. Approve USDC
4. Burn on source chain
5. Wait for attestation
6. Receive SEED shares

#### 2. useCCTPDeposit.ts
**Location:** `frontend/hooks/cctp/useCCTPDeposit.ts`

React hook for CCTP operations:
- `approve()` - Approve USDC spending
- `burn()` - Burn USDC via TokenMessenger
- `needsApproval()` - Check approval status

#### 3. useCCTPAttestation.ts
**Location:** `frontend/hooks/cctp/useCCTPAttestation.ts`

React hook for attestation polling:
- `checkAttestation()` - Query Circle attestation API
- `startPolling()` - Auto-poll until complete
- `useAttestationTimer()` - Display time remaining

#### 4. UnifiedDepositForm.tsx (Updated)
**Location:** `frontend/components/forms/UnifiedDepositForm.tsx`

Now includes 3 tabs:
- Direct (USDC on Arc)
- CCTP (Cross-chain USDC)
- Fiat (Circle Gateway)

### Webhook Handler

#### circle-gateway.ts
**Location:** `backend/api/webhooks/circle-gateway.ts`

Handles Circle Gateway webhooks:
- `wire.incoming.complete` - On-ramp success
- `wire.incoming.failed` - On-ramp failure
- `payout.complete` - Off-ramp success
- `payout.failed` - Off-ramp failure

## Data Flows

### LP Deposit Flow (Cross-Chain USDC via CCTP)

```
1. LP initiates deposit from Ethereum
2. Frontend calls TokenMessenger.depositForBurn() on Ethereum
3. USDC burned, message emitted
4. Circle attestation service creates attestation (~13-19 min)
5. Backend/Frontend polls for attestation
6. CCTPReceiver.processCCTPDeposit() called on Base
7. USDC minted to CCTPReceiver
8. CCTPReceiver auto-deposits to LiquidityPool
9. SEED shares minted to LP's wallet
```

### Buyer Repayment Flow (Fiat via Gateway)

```
1. Buyer initiates payment in dashboard
2. Backend calls CircleGatewayService.initiateOnRamp()
3. Buyer completes bank transfer (ACH/wire)
4. Circle webhook: payment.complete
5. USDC deposited to Buyer's Circle Wallet
6. Backend triggers invoice repayment via PaymentRouter
```

### Supplier Payout Flow (Off-ramp via Gateway)

```
1. Invoice funded, USDC in Supplier's Circle Wallet
2. Supplier requests withdrawal to bank
3. Backend calls CircleGatewayService.initiateOffRamp()
4. USDC transferred from wallet
5. Circle processes bank transfer
6. Webhook confirms completion
7. Supplier receives fiat in bank account
```

## Environment Variables

```env
# Circle Wallets
CIRCLE_API_KEY=TEST_API_KEY:xxx:yyy
CIRCLE_ENTITY_SECRET=<64-char-alphanumeric>

# Circle Gateway
CIRCLE_GATEWAY_API_KEY=
CIRCLE_GATEWAY_WEBHOOK_SECRET=

# CCTP Contracts (Base Sepolia)
CCTP_TOKEN_MESSENGER=0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5
CCTP_MESSAGE_TRANSMITTER=0x7865fAfC2db2093669d92c0F33AeEF291086BEFD

# CCTP Attestation API
CCTP_ATTESTATION_API=https://iris-api-sandbox.circle.com/attestations
```

## Testing

### Contract Tests

```bash
cd contracts && forge test --match-contract CCTPReceiver -vvv
```

### Integration Testing

1. Deploy CCTPReceiver to Base Sepolia
2. Burn test USDC on Ethereum Sepolia
3. Wait for attestation
4. Call processCCTPDeposit with attestation
5. Verify SEED shares received

## File Summary

| Category | File | Description |
|----------|------|-------------|
| Contracts | `CCTPReceiver.sol` | CCTP deposit receiver |
| Contracts | `SmartRouter.sol` | Unified deposit router |
| Tests | `CCTPReceiver.t.sol` | CCTP receiver tests |
| Backend | `CircleWalletsService.ts` | Wallet management |
| Backend | `CircleGatewayService.ts` | Fiat on/off-ramp |
| Backend | `DepositRoutingService.ts` | Route optimization |
| Backend | `circle-gateway.ts` | Webhook handler |
| Frontend | `CCTPDepositFlow.tsx` | CCTP UI component |
| Frontend | `useCCTPDeposit.ts` | CCTP deposit hook |
| Frontend | `useCCTPAttestation.ts` | Attestation polling |
| Frontend | `UnifiedDepositForm.tsx` | Updated 3-tab form |

## Status

- [x] CCTPReceiver contract
- [x] SmartRouter contract
- [x] CCTPReceiver tests
- [x] CircleWalletsService
- [x] CircleGatewayService
- [x] DepositRoutingService
- [x] Circle Gateway webhook
- [x] CCTP frontend hooks
- [x] CCTPDepositFlow component
- [x] UnifiedDepositForm update
- [ ] End-to-end testnet testing
- [ ] Production deployment
