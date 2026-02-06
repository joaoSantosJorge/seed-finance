# Cross-Chain Bridge Architecture

## Overview

This document explains how the CCTP bridge works at a conceptual level, including detailed fund flow diagrams for Seed Finance's cross-chain treasury strategy.

## CCTP: Circle's Native USDC Bridge

CCTP (Cross-Chain Transfer Protocol) uses a **burn-and-mint** mechanism. No liquidity pools are needed — Circle authorizes minting new USDC based on signed attestations.

```
Chain A                          Circle                           Chain B
────────                         ──────                           ────────
User burns USDC ──► TokenMessenger.depositForBurn()
                            │
                            ▼
                   [Attestation Service]
                   - Observes burn event
                   - Signs attestation (~15-20 min)
                            │
                            ▼
                   MessageTransmitter.receiveMessage()
                            │
                            ▼
                                                    Mint fresh USDC ──► Recipient
```

**Key Property:**

```
CCTP:
─────
Source USDC ──► BURN (destroy) ──► [Circle Attestation] ──► MINT (create new) ──► Dest USDC
                                          │
                                    Circle signs that
                                    burn was valid
```

---

## CCTP Strategy Fund Flows

### Deposit: Base -> Arc (USYC)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BASE CHAIN (Domain 6)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TreasuryManager              ArcUSYCStrategy            TokenMessenger      │
│       │                              │                        │              │
│       │── deposit(100k USDC) ───────►│                        │              │
│       │                              │── depositForBurn() ───►│              │
│       │                              │   (burns USDC)         │              │
│       │                              │                        │              │
│       │                              │◄── nonce ──────────────│              │
│       │                              │                        │              │
│       │                              │  emit CCTPBurnInitiated│              │
│                                                                              │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                      ┌────────────────▼────────────────┐
                      │   CIRCLE ATTESTATION SERVICE    │
                      │                                 │
                      │   1. Observes burn on Base      │
                      │   2. Signs attestation message  │
                      │   3. ~15-20 minutes             │
                      │                                 │
                      │   (This is the trust anchor -  │
                      │    Circle authorizes the mint) │
                      └────────────────┬────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────┐
│                             ARC CHAIN (Domain 26)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  MessageTransmitter         ArcUSYCAgent                   USYC Vault        │
│       │                          │                             │             │
│       │── receiveMessage() ─────►│                             │             │
│       │   (with attestation)     │                             │             │
│       │   MINTS fresh USDC ─────►│                             │             │
│       │                          │                             │             │
│       │                          │── keeper.processDeposit() ─►│             │
│       │                          │      deposit(USDC)          │             │
│       │                          │                             │             │
│       │                          │◄── USYC shares ─────────────│             │
│       │                          │    (T-Bill yield)           │             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Withdrawal: Arc -> Base

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BASE CHAIN (Domain 6)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TreasuryManager              ArcUSYCStrategy                                │
│       │                              │                                       │
│       │── withdraw(50k) ────────────►│                                       │
│       │                              │── emit WithdrawalRequested            │
│       │                              │                                       │
│       │                              │  pendingWithdrawals += 50k            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                          Keeper sees event, calls Arc
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────┐
│                             ARC CHAIN (Domain 26)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ArcUSYCAgent                   USYC Vault            TokenMessenger         │
│       │                              │                      │                │
│       │◄── keeper.initiateWithdrawal()                      │                │
│       │                              │                      │                │
│       │── redeem(shares) ───────────►│                      │                │
│       │◄── USDC returned ────────────│                      │                │
│       │                                                     │                │
│       │── depositForBurn() ────────────────────────────────►│                │
│       │   (burns USDC)                                      │                │
│       │◄── nonce ───────────────────────────────────────────│                │
│                                                                              │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                      ┌────────────────▼────────────────┐
                      │   CIRCLE ATTESTATION SERVICE    │
                      │   ~15-20 minutes                │
                      └────────────────┬────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────┐
│                              BASE CHAIN (Domain 6)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  MessageTransmitter        ArcUSYCStrategy           TreasuryManager         │
│       │                          │                        │                  │
│       │── receiveMessage() ─────►│                        │                  │
│       │   MINTS fresh USDC ─────►│                        │                  │
│       │                          │                        │                  │
│       │                          │── keeper.receiveCCTPFunds()               │
│       │                          │                        │                  │
│       │                          │── transfer USDC ──────►│                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## The Role of Keepers

Since smart contracts cannot directly query other blockchains, **keepers** act as trusted relayers that bridge the information gap.

### What Keepers Do

| Function | Description |
|----------|-------------|
| `confirmDeposit(transferId, amount)` | Monitors remote chain, confirms when bridged funds arrive |
| `updateRemoteValue(value, proof)` | Periodically reports current value on remote chain (including yield) |
| `receiveCCTPFunds(transferId, nonce)` | Confirms withdrawal funds have bridged back via CCTP, triggers transfer |

### Keeper Architecture

```
BASE (Home Chain)                    ARC (Remote Chain)
─────────────────                    ──────────────────
ArcUSYCStrategy                      ArcUSYCAgent
     │                                     │
     │── deposit() ──► CCTP ──────────────►│── deposit to USYC
     │                                     │
     │◄── keeper.confirmDeposit() ◄────────│ (keeper watches for arrival)
     │                                     │
     │◄── keeper.updateRemoteValue() ◄─────│ (keeper reads USYC balance)
```

### Keeper Implementation Options

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **Gelato** | Decentralized automation | No infrastructure, reliable | Cost per execution |
| **Chainlink Automation** | Oracle-based keepers | Battle-tested, decentralized | Cost, complexity |
| **Custom Backend** | Your own monitoring bot | Full control, custom logic | Infrastructure burden |
| **Multi-sig + Manual** | Human operators | Most secure | Slow, not scalable |

---

## Testing Cross-Chain Integrations

### Approach 1: Mock Testing (Recommended for Unit Tests)

Test your contract logic without actual chains:

```solidity
// Deploy mocks
MockCCTPMessageTransmitter cctp = new MockCCTPMessageTransmitter(usdc, 6);

// Test deposit flow
vm.prank(treasuryManager);
arcStrategy.deposit(DEPOSIT_AMOUNT);

// Simulate keeper confirming
vm.prank(keeper);
arcStrategy.confirmDeposit(transferId, DEPOSIT_AMOUNT);
```

### Approach 2: CCTP Testnets

Use real testnets with testnet tokens:

- CCTP supports: Sepolia, Avalanche Fuji, Base Sepolia, Arc Testnet

### Approach 3: Multi-Anvil Forks

Spin up multiple Anvil instances forking different chains:

```bash
# Terminal 1: Fork Base
anvil --fork-url https://mainnet.base.org --port 8545 --chain-id 8453
```

Note: Bridges won't actually work between forks — you need to manually simulate the receiving side.

### Recommended Testing Strategy

| Layer | Approach | What It Tests |
|-------|----------|---------------|
| Unit | Mocks | Business logic, access control |
| Contract | Foundry fork | Receiver contract, state changes |
| Integration | CCTP testnets | Actual SDK usage, attestations |
| E2E | Real testnet bridge | Full flow (run sparingly) |

---

## Related Files

- `contracts/src/strategies/ArcUSYCStrategy.sol` - CCTP strategy on Base
- `contracts/src/strategies/remote/ArcUSYCAgent.sol` - Agent on Arc
- `contracts/test/crosschain/CrossChainTreasury.t.sol` - Unit tests with mocks
- `docs/development/17_cross_chain_strategies.md` - Implementation details
