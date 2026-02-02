# LI.FI Integration for Seed Finance

## Overview

This document describes the LI.FI integration that allows users to deposit **any token from any chain** into the Seed Finance LiquidityPool. LI.FI handles swap/bridge routing, and the resulting USDC is automatically deposited into the ERC-4626 vault.

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  User Wallet    │     │   LI.FI      │     │   Base L2       │
│  (Any Chain)    │────>│   Bridges    │────>│                 │
└─────────────────┘     └──────────────┘     └─────────────────┘
        │                                            │
        v                                            v
┌─────────────────┐                         ┌─────────────────┐
│  LI.FI Widget   │                         │ LiFiReceiver.sol│
│  (Frontend)     │                         │ (Auto-deposit)  │
└─────────────────┘                         └─────────────────┘
                                                     │
                                                     v
                                            ┌─────────────────┐
                                            │ LiquidityPool   │
                                            │ (ERC-4626)      │
                                            └─────────────────┘
                                                     │
                                                     v
                                            ┌─────────────────┐
                                            │ SEED Shares   │
                                            │ (to User)       │
                                            └─────────────────┘
```

## User Flow

1. User connects wallet (any chain)
2. Selects "Any Token" tab on deposit page
3. Picks source token/chain in LI.FI widget
4. Enters amount, sees quote with output USDC and fees
5. Approves and executes transaction(s)
6. LI.FI bridges/swaps to USDC on Base
7. LiFiReceiver contract auto-deposits to LiquidityPool
8. User receives SEED shares

## Smart Contract

### LiFiReceiver.sol

Location: `contracts/src/integrations/LiFiReceiver.sol`

The LiFiReceiver contract:
- Receives USDC from LI.FI bridge executors
- Auto-deposits to the LiquidityPool
- Sends SEED shares to the user
- Falls back to sending USDC directly if deposit fails

#### Key Functions

```solidity
// Called by authorized LI.FI executors
function receiveAndDeposit(
    address user,       // Final recipient of SEED
    uint256 amount,     // USDC amount received
    bytes32 transferId  // LI.FI tracking ID
) external;

// Direct deposit for users with USDC on Base
function directDeposit(uint256 amount) external;
```

#### Safety Features

- **Authorized Executors**: Only whitelisted LI.FI executor addresses can call `receiveAndDeposit`
- **Minimum Deposit**: Prevents dust attacks with configurable minimum
- **Fallback Mechanism**: If deposit fails, USDC is sent directly to user
- **Emergency Withdraw**: Owner can rescue stuck tokens

### Contract Addresses

| Network | LiFiReceiver Address |
|---------|---------------------|
| Base Sepolia | TBD (after deployment) |
| Base Mainnet | TBD (after deployment) |

### Known LI.FI Executor Addresses

The LI.FI Diamond contract on Base:
- **Base Mainnet**: `0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE`

## Frontend Components

### File Structure

```
frontend/
├── components/
│   └── lifi/
│       ├── LiFiDepositWidget.tsx  # Real LI.FI widget wrapper
│       ├── MockLiFiWidget.tsx     # Mock for testnet
│       └── index.ts
├── hooks/
│   └── lifi/
│       ├── useLiFiConfig.ts       # Widget configuration
│       ├── useMockLiFi.ts         # Mock hook for testnet
│       └── index.ts
├── lib/
│   └── lifi/
│       ├── config.ts              # LI.FI configuration
│       └── index.ts
└── components/forms/
    └── UnifiedDepositForm.tsx     # Tabbed deposit UI
```

### UnifiedDepositForm

The main deposit form provides tabs:
1. **Deposit USDC** - Direct deposit for users with USDC on Base
2. **Any Token** - Cross-chain deposits via LI.FI

On testnet (Base Sepolia), the "Any Token" tab shows a mock widget since LI.FI has limited testnet bridge support.

### Configuration

Environment variables:
```env
# LiFiReceiver contract address
NEXT_PUBLIC_LIFI_RECEIVER_ADDRESS=0x...

# Optional: Override for different networks
NEXT_PUBLIC_LIFI_RECEIVER_ADDRESS_MAINNET=0x...
NEXT_PUBLIC_LIFI_RECEIVER_ADDRESS_SEPOLIA=0x...
```

## Deployment

### 1. Deploy LiFiReceiver Contract

```bash
# From contracts directory
cd contracts

# Deploy to Base Sepolia
forge script script/DeployLiFiReceiver.s.sol:DeployLiFiReceiver \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast

# Verify on BaseScan
forge verify-contract <ADDRESS> \
  src/integrations/LiFiReceiver.sol:LiFiReceiver \
  --chain-id 84532
```

### 2. Configure LI.FI Executor

After deployment, authorize the LI.FI executor:

```solidity
// For mainnet
receiver.setExecutor(0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE, true);

// For testnet (authorize deployer for testing)
receiver.setExecutor(msg.sender, true);
```

### 3. Update Frontend Config

Add the deployed address to your `.env.local`:
```env
NEXT_PUBLIC_LIFI_RECEIVER_ADDRESS=0x<deployed_address>
```

## Testing

### Smart Contract Tests

```bash
# From contracts directory
forge test --match-contract LiFiReceiver -vvv
```

Test coverage:
- Deployment and initialization
- Direct deposits
- Authorized executor deposits
- Fallback scenarios (below minimum, insufficient balance)
- Admin functions (set executor, emergency withdraw)
- Multi-user scenarios

### Frontend Mock Testing

On testnet, the mock widget simulates:
- Chain/token selection UI
- Quote generation with mock fees
- Transaction flow using direct USDC deposit

This allows full UX testing without real bridges.

### Manual Testing on Mainnet

1. Connect wallet with tokens on another chain
2. Open deposit page, select "Any Token" tab
3. Select source chain and token
4. Enter amount and review quote
5. Execute transaction
6. Verify SEED received

## Supported Chains

LI.FI supports 30+ chains including:
- Ethereum
- Optimism
- Arbitrum
- Polygon
- Avalanche
- BSC
- Base
- zkSync Era
- Linea
- Scroll

The widget automatically shows available routes based on liquidity.

## Error Handling

### Contract-Level

| Error | Description |
|-------|-------------|
| `UnauthorizedExecutor` | Caller not in whitelist |
| `InvalidUser` | Zero address for recipient |
| `AmountBelowMinimum` | Deposit too small |
| `ZeroAmount` | Zero amount provided |
| `DepositFailed` | Pool deposit returned 0 shares |

### Fallback Behavior

If auto-deposit fails:
1. USDC is sent directly to user's wallet
2. `FallbackToUser` event emitted with reason
3. User can manually deposit via "Deposit USDC" tab

### Widget Errors

Common widget errors:
- **No route found**: Insufficient liquidity for token pair
- **Slippage exceeded**: Price moved during transaction
- **Bridge timeout**: Cross-chain message delayed

## Security Considerations

1. **Executor Whitelist**: Only trusted LI.FI addresses can trigger deposits
2. **Minimum Deposit**: Prevents griefing with tiny amounts
3. **Fallback Safety**: User always receives their tokens
4. **Reentrancy Protection**: Contract uses ReentrancyGuard
5. **Owner Controls**: Can pause, rescue tokens, update settings

## Gas Costs

Estimated gas costs on Base:
- `receiveAndDeposit`: ~150,000 gas (~$0.02)
- `directDeposit`: ~130,000 gas (~$0.02)

Bridge fees vary by route (shown in widget).

## Future Improvements

1. **Referral System**: Track deposits by referrer
2. **Zap Integration**: Support depositing yield-bearing tokens
3. **Limit Orders**: Allow users to set target prices
4. **Multi-Receiver**: Support deposits to multiple pools

## Related Documentation

- [LI.FI Docs](https://docs.li.fi)
- [LI.FI Widget](https://docs.li.fi/integrate-li-fi-widget/li-fi-widget-overview)
- [ERC-4626 Vault Standard](https://eips.ethereum.org/EIPS/eip-4626)
- [Seed Finance Architecture](../../CLAUDE.md)
