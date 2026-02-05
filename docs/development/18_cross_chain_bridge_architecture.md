# Cross-Chain Bridge Architecture

## Overview

This document explains how LI.FI and CCTP bridges work at a conceptual level, including detailed fund flow diagrams for Seed Finance's cross-chain treasury strategies.

## Bridge Comparison

| Aspect | LI.FI (Aggregator) | CCTP (Circle Native) |
|--------|-------------------|---------------------|
| **Mechanism** | Liquidity pools | Burn & mint |
| **Speed** | 2-20 min (varies by bridge) | 15-20 min (attestation) |
| **Trust** | Bridge operators + LPs | Circle (centralized) |
| **Liquidity** | Limited by pool depth | Unlimited (new USDC minted) |
| **Chains** | 20+ chains | 8 chains (growing) |
| **Fees** | Variable (0.05-0.3%) | Fixed (~$0.10) |
| **Slippage** | Possible on large amounts | None |
| **In Seed** | Base <-> Arbitrum (Aave) | Base <-> Arc (USYC) |

## How Each Bridge Works

### LI.FI: Bridge Aggregator

LI.FI is a **bridge aggregator** — it doesn't run its own bridge. Instead, it routes transactions through the best available bridge (Stargate, Across, Hop, etc.) based on fees, speed, and liquidity.

```
User Request ──► LI.FI API ──► Selects Best Route ──► Execute via:
                                                      ├── Stargate (liquidity pools)
                                                      ├── Across (optimistic bridge)
                                                      ├── Hop (rollup native)
                                                      └── Others...
```

**How Liquidity Pool Bridges Work:**

```
Chain A                          Chain B
────────                         ────────
User deposits USDC ──► Lock in Pool A
                            │
                       [Relayer observes lock]
                            │
                       Pool B releases USDC ──► Recipient receives
```

Liquidity providers fund pools on each chain. When you bridge, your tokens are locked on the source chain, and equivalent tokens are released from a pool on the destination chain.

### CCTP: Circle's Native USDC Bridge

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

**Key Difference:**

```
LI.FI (via Stargate/Across):
─────────────────────────────
Source USDC ──► Lock in Pool ──► [Liquidity Pool] ──► Release from Pool ──► Dest USDC
                                       │
                                 Pool must have
                                 sufficient liquidity

CCTP:
─────
Source USDC ──► BURN (destroy) ──► [Circle Attestation] ──► MINT (create new) ──► Dest USDC
                                          │
                                    Circle signs that
                                    burn was valid
```

---

## LI.FI Strategy Fund Flows

### Deposit: Base -> Arbitrum (Aave V3)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BASE CHAIN                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TreasuryManager                LiFiVaultStrategy              LI.FI Diamond │
│       │                              │                              │        │
│       │── deposit(100k USDC) ───────►│                              │        │
│       │                              │── approve USDC ──────────────►│        │
│       │                              │── startBridgeTokensViaBridge()│        │
│       │                              │   (via Stargate/Across/etc)  │        │
│       │                              │                              │        │
│       │                              │◄── transferId ───────────────│        │
│       │                              │                              │        │
│       │                              │  pendingDeposits += 100k     │        │
│                                                                              │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                         ┌─────────────▼─────────────┐
                         │   UNDERLYING BRIDGE       │
                         │   (Stargate liquidity     │
                         │    pools, relayers, etc)  │
                         │                           │
                         │   ~2-20 minutes           │
                         └─────────────┬─────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────┐
│                             ARBITRUM CHAIN                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LiFiVaultAgent                    Aave V3 Pool                              │
│       │                                 │                                    │
│       │◄── USDC arrives (bridge)        │                                    │
│       │                                 │                                    │
│       │── keeper.processDeposit() ─────►│                                    │
│       │       supply(USDC)              │                                    │
│       │                                 │                                    │
│       │◄── receive aUSDC ───────────────│                                    │
│       │                                 │                                    │
│       │   (aUSDC accrues yield)         │                                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Withdrawal: Arbitrum -> Base

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BASE CHAIN                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TreasuryManager              LiFiVaultStrategy                              │
│       │                              │                                       │
│       │── withdraw(50k) ────────────►│                                       │
│       │                              │── emit WithdrawalRequested ──────────►│
│       │                              │   (keeper watches this event)         │
│       │                              │                                       │
│       │                              │  pendingWithdrawals += 50k            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                          Keeper sees event, calls Arbitrum
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────┐
│                             ARBITRUM CHAIN                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LiFiVaultAgent                    Aave V3              LI.FI Diamond        │
│       │                              │                       │               │
│       │◄── keeper.initiateWithdrawal()                       │               │
│       │                              │                       │               │
│       │── withdraw(USDC) ───────────►│                       │               │
│       │◄── USDC returned ────────────│                       │               │
│       │                                                      │               │
│       │── startBridgeTokensViaBridge() ─────────────────────►│               │
│       │                                                      │               │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                         ┌─────────────▼─────────────┐
                         │   UNDERLYING BRIDGE       │
                         │   ~2-20 minutes           │
                         └─────────────┬─────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────┐
│                              BASE CHAIN                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LiFiVaultStrategy                TreasuryManager                            │
│       │                                 │                                    │
│       │◄── USDC arrives (bridge)        │                                    │
│       │                                 │                                    │
│       │── keeper.receiveBridgedFunds()  │                                    │
│       │                                 │                                    │
│       │── transfer USDC ───────────────►│                                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
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
| `receiveBridgedFunds(transferId)` | Confirms withdrawal funds have bridged back, triggers transfer |
| `receiveCCTPFunds(transferId, nonce)` | Same for CCTP-based bridges |

### Keeper Architecture

```
BASE (Home Chain)                    ETHEREUM/ARBITRUM/ARC (Remote Chain)
─────────────────                    ────────────────────────────────────
LiFiVaultStrategy                    LiFiVaultAgent
     │                                     │
     │── deposit() ──► LI.FI Bridge ──────►│── deposit to Aave
     │                                     │
     │◄── keeper.confirmDeposit() ◄────────│ (keeper watches for arrival)
     │                                     │
     │◄── keeper.updateRemoteValue() ◄─────│ (keeper reads Aave balance)
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
MockLiFiBridgeExecutor lifiBridge = new MockLiFiBridgeExecutor();
MockCCTPMessageTransmitter cctp = new MockCCTPMessageTransmitter(usdc, 6);

// Test deposit flow
vm.prank(treasuryManager);
lifiStrategy.deposit(DEPOSIT_AMOUNT);

// Simulate keeper confirming
vm.prank(keeper);
lifiStrategy.confirmDeposit(transferId, DEPOSIT_AMOUNT);
```

### Approach 2: LI.FI/CCTP Testnets

Use real testnets with testnet tokens:

- LI.FI supports: Sepolia, Base Sepolia, Arbitrum Sepolia
- CCTP supports: Sepolia, Avalanche Fuji, Base Sepolia

### Approach 3: Multi-Anvil Forks

Spin up multiple Anvil instances forking different chains:

```bash
# Terminal 1: Fork Base
anvil --fork-url https://mainnet.base.org --port 8545 --chain-id 8453

# Terminal 2: Fork Arbitrum
anvil --fork-url https://arb1.arbitrum.io/rpc --port 8546 --chain-id 42161
```

Note: Bridges won't actually work between forks — you need to manually simulate the receiving side.

### Recommended Testing Strategy

| Layer | Approach | What It Tests |
|-------|----------|---------------|
| Unit | Mocks | Business logic, access control |
| Contract | Foundry fork | Receiver contract, state changes |
| Integration | LI.FI/CCTP testnets | Actual SDK usage, quotes |
| E2E | Real testnet bridge | Full flow (run sparingly) |

---

## Related Files

- `contracts/src/strategies/LiFiVaultStrategy.sol` - LI.FI strategy on Base
- `contracts/src/strategies/ArcUSYCStrategy.sol` - CCTP strategy on Base
- `contracts/src/strategies/remote/LiFiVaultAgent.sol` - Agent on Arbitrum
- `contracts/src/strategies/remote/ArcUSYCAgent.sol` - Agent on Arc
- `contracts/test/crosschain/CrossChainTreasury.t.sol` - Unit tests with mocks
- `docs/development/17_cross_chain_strategies.md` - Implementation details
