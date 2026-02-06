# Cross-Chain Treasury Strategies

## Overview

This document describes the implementation of cross-chain treasury strategies that enable USDC yield generation on remote chains.

| Strategy | Bridge | Destination | Yield Source | Est. APY |
|----------|--------|-------------|--------------|----------|
| **ArcUSYCStrategy** | CCTP | Arc (Domain 26) | USYC T-bills | ~4.5% |

## Architecture

```
BASE (Home Chain)
├── TreasuryManager
│   └── ArcUSYCStrategy ──► CCTP ──► Arc ──────► USYC
│
REMOTE CHAINS
└── Arc: ArcUSYCAgent → USYC Vault
```

## Changes Made

### Contracts Created

#### Interfaces
- `contracts/src/interfaces/ICrossChainStrategy.sol` - Extended interface for cross-chain strategies with:
  - `pendingDeposits()` / `pendingWithdrawals()` - track in-flight transfers
  - `lastValueUpdate()` - staleness tracking
  - `updateRemoteValue()` - keeper callback for value reporting
  - `confirmDeposit()` - confirm cross-chain deposit arrived

#### Base Contracts
- `contracts/src/strategies/BaseCrossChainStrategy.sol` - Abstract base with:
  - Async state machine (Pending → Confirmed → Deployed)
  - Value tracking with staleness decay
  - `supportsInstantWithdraw() = false`
  - Keeper authorization

#### Strategy Contracts (Base Chain)
- `contracts/src/strategies/ArcUSYCStrategy.sol` - CCTP bridge to Arc

#### Remote Agent Contracts
- `contracts/src/strategies/remote/ArcUSYCAgent.sol` - Arc (USYC)

#### Mock Contracts (Testing)
- `contracts/test/mocks/crosschain/MockCCTPMessageTransmitter.sol`
- `contracts/test/mocks/crosschain/MockAavePool.sol`
- `contracts/test/mocks/crosschain/MockUSYCArc.sol`

### Tests Created
- `contracts/test/crosschain/CrossChainTreasury.t.sol` - Single-anvil unit tests
- `contracts/test/crosschain/CrossChainIntegration.t.sol` - Multi-anvil integration tests

### Scripts Created
- `contracts/scripts/multi-chain/start-multi-anvil.sh` - Start Anvil instances
- `contracts/scripts/multi-chain/stop-multi-anvil.sh` - Stop all instances
- `contracts/scripts/multi-chain/deploy-multi-chain.sh` - Deploy to all chains
- `contracts/scripts/relay/relay.ts` - Cross-chain relay service
- `contracts/scripts/relay/package.json` - Relay dependencies

### Frontend Created
- `frontend/hooks/strategies/useCrossChainStrategies.ts` - Read strategy data
- `frontend/hooks/strategies/useStrategyAllocation.ts` - Allocate/withdraw
- `frontend/components/dashboard/operator/CrossChainStrategies.tsx` - Strategy cards
- `frontend/components/dashboard/operator/StrategyAllocationModal.tsx` - Allocation modal
- `frontend/components/dashboard/operator/PendingTransfers.tsx` - Transfer tracking

## How It Works

### Deposit Flow

1. **TreasuryManager calls deposit(amount)**
   ```solidity
   strategy.deposit(100_000e6); // 100k USDC
   ```

2. **Strategy bridges USDC to remote chain**
   - Arc: Burns USDC via CCTP TokenMessenger

3. **Keeper monitors bridge events and calls remote agent**
   ```solidity
   // On Arc
   agent.processDeposit(transferId);
   ```

4. **Agent deposits to yield source**
   - USYC: `usyc.deposit(amount, address(this))`

5. **Keeper confirms deposit on home strategy**
   ```solidity
   // On Base
   strategy.confirmDeposit(transferId, sharesReceived);
   ```

### Value Reporting

Keepers periodically report remote chain value:

```solidity
// Read value from remote agent
uint256 remoteValue = agent.getCurrentValue();

// Update home strategy
strategy.updateRemoteValue(remoteValue, "");
```

The strategy calculates total value as:
```
totalValue = lastReportedValue + pendingDeposits - pendingWithdrawals
```

### Withdrawal Flow

1. **TreasuryManager calls withdraw(amount)**

2. **Strategy emits withdrawal request event**
   ```solidity
   emit WithdrawalRequested(transferId, amount);
   ```

3. **Keeper processes on remote agent**
   ```solidity
   agent.initiateWithdrawal(transferId, amount);
   ```

4. **Agent withdraws and bridges back**
   - Arc: Burns USDC via CCTP

5. **Keeper receives funds on home strategy**
   ```solidity
   strategy.receiveCCTPFunds(transferId, nonce);
   ```

## Testing

### Unit Tests (Fast)

```bash
cd contracts
forge test --match-contract CrossChainTreasury
```

### Multi-Anvil Integration Tests

```bash
# Terminal 1: Start Anvil instances
./scripts/multi-chain/start-multi-anvil.sh

# Terminal 2: Deploy contracts
./scripts/multi-chain/deploy-multi-chain.sh

# Terminal 3: Start relay service
cd scripts/relay
npm install
npx ts-node relay.ts

# Terminal 4: Run tests
MULTI_ANVIL=true forge test --match-contract CrossChainIntegration


#Windows:
  To run on Windows:

  # Navigate to the contracts directory
  cd C:\projects\seed-finance\contracts

  # Start the multi-anvil environment
  .\scripts\multi-chain\start-multi-anvil.ps1

  # After anvils are running, deploy contracts
  .\scripts\multi-chain\deploy-multi-chain.ps1

  # To stop all anvil instances
  .\scripts\multi-chain\stop-multi-anvil.ps1

   # Terminal 4: Run tests
   $env:MULTI_ANVIL="true"; forge test --match-contract CrossChainIntegration

  Note: If you get an execution policy error, you may need to run this first:
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### Testnet Testing

1. Deploy strategies to Base Sepolia
2. Deploy agents to Arc Testnet
3. Configure keeper service with real CCTP attestations
4. Test full deposit/withdrawal flows

## Configuration

### Environment Variables

```bash
# Strategy Addresses (Frontend)
NEXT_PUBLIC_ARC_USYC_STRATEGY_ADDRESS=0x...
```

### Contract Addresses

#### CCTP (Mainnet)
- TokenMessenger (Base): `0x1682Ae6375C4E4A97e4B583BC394c861A46D8962`
- Base Domain: 6
- TokenMessengerV2 (Arc): `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA`
- Arc Domain: 26
- USYC (Arc): `0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C`

## Security Considerations

1. **Keeper Authorization** - Only authorized keepers can:
   - Update remote values
   - Confirm deposits
   - Receive withdrawals

2. **Value Staleness** - Remote values have a max staleness (default 1 hour). UI warns when values are stale.

3. **Async Operations** - All cross-chain operations are async. Users must understand:
   - Deposits take 15-20 minutes to complete
   - Withdrawals take 15-20 minutes to return

4. **Bridge Risk** - Cross-chain operations have additional risks:
   - CCTP trust (Circle attestation)
   - Remote chain stability
   - Oracle/attestation delays

## Related Files

- `contracts/src/interfaces/ITreasuryStrategy.sol` - Base interface
- `contracts/src/strategies/BaseTreasuryStrategy.sol` - Local strategy base
- `contracts/src/integrations/CCTPReceiver.sol` - CCTP patterns

## Future Improvements

1. **Additional Strategies**
   - Compound V3 on multiple chains
   - Morpho optimized lending
   - Yearn vaults

2. **Automated Rebalancing**
   - Keeper-based rebalancing across strategies
   - APY-optimized allocation

3. **Insurance Integration**
   - Nexus Mutual coverage
   - Risk scoring per strategy

4. **Enhanced Monitoring**
   - Real-time bridge status
   - Yield comparison dashboard
   - Alert system for stale values
