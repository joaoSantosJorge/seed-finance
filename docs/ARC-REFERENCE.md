# Arc Network Reference

> Primary reference for Seed Finance development on Arc chain (Circle's L1)

---

## Network Configuration

### Arc Testnet

| Property | Value |
|----------|-------|
| **Network Name** | Arc Testnet |
| **Chain ID** | 5042002 |
| **RPC Endpoint** | https://rpc.testnet.arc.network |
| **Explorer** | https://testnet.arcscan.app |
| **Faucet** | https://faucet.circle.com |
| **Native Currency** | USDC (18 decimals at protocol level) |
| **EVM Version** | Prague hard fork |
| **Finality** | Sub-second deterministic |

### Arc Mainnet (Placeholder — not yet live)

| Property | Value |
|----------|-------|
| **Network Name** | Arc |
| **Chain ID** | 1243 |
| **RPC Endpoint** | https://rpc.arc.network |
| **Explorer** | https://arcscan.app |
| **Native Currency** | USDC |

---

## Contract Addresses

### Arc Testnet

| Contract | Address |
|----------|---------|
| **USDC (system contract)** | `0x3600000000000000000000000000000000000000` |
| **USYC (Hashnote)** | `0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C` |
| **CCTP TokenMessengerV2** | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` |
| **CCTP MessageTransmitter** | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` |

### Utility Contracts (Arc Testnet)

| Contract | Address |
|----------|---------|
| **Multicall3** | Check ArcScan for deployment |
| **Create2 Deployer** | Standard EVM create2 available |

---

## USDC Decimal Warning

> **CRITICAL**: On Arc, USDC serves dual roles:
>
> 1. **Native gas token**: 18 decimals at the protocol level (like ETH on Ethereum)
> 2. **ERC-20 token**: 6 decimals via the system contract at `0x360...000`
>
> Seed Finance contracts interact with USDC **exclusively via the ERC-20 interface**,
> so all amounts remain in **6-decimal precision**. Do NOT use `msg.value` for USDC
> transfers — always use `IERC20.transfer()` / `IERC20.transferFrom()`.

---

## Key Differences from Base

| Aspect | Base L2 | Arc L1 |
|--------|---------|--------|
| **Type** | Optimistic rollup (L2) | L1 blockchain |
| **Gas token** | ETH | USDC |
| **USDC type** | Bridged ERC-20 | Native system contract |
| **Finality** | ~2 seconds | Sub-second deterministic |
| **EVM version** | Cancun | Prague |
| **Builder** | Coinbase/Optimism | Circle |
| **CCTP** | V1 | V2 |
| **LI.FI support** | Yes | Not yet |

---

## Deployment Instructions

### Prerequisites

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Get testnet USDC from faucet
# Visit: https://faucet.circle.com
```

### Deploy to Arc Testnet

```bash
cd contracts

# Set environment variables
export ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
export PRIVATE_KEY=your_private_key
export ARCSCAN_API_KEY=your_api_key

# Deploy
forge script script/DeployLocal.s.sol:DeployLocal \
  --rpc-url $ARC_TESTNET_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast

# Verify
forge verify-contract <address> src/base/LiquidityPool.sol:LiquidityPool \
  --chain-id 5042002 \
  --verifier-url https://testnet.arcscan.app/api \
  --etherscan-api-key $ARCSCAN_API_KEY
```

---

## Environment Variables

```env
# Arc Network
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
ARC_TESTNET_CHAIN_ID=5042002

# USDC (system contract — same on testnet and mainnet)
ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000

# USYC (Hashnote T-Bill token)
ARC_USYC_ADDRESS=0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C

# CCTP
ARC_CCTP_TOKEN_MESSENGER=0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA
ARC_CCTP_MESSAGE_TRANSMITTER=0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275

# Seed Finance Contracts (after deployment)
ARC_LIQUIDITY_POOL_ADDRESS=
ARC_INVOICE_DIAMOND_ADDRESS=
ARC_EXECUTION_POOL_ADDRESS=
ARC_PAYMENT_ROUTER_ADDRESS=

# Explorer
ARCSCAN_API_KEY=

# Circle API
CIRCLE_API_KEY=TEST_API_KEY:xxx:yyy
CIRCLE_ENTITY_SECRET=
```

---

## Useful Links

- [Arc Docs](https://docs.circle.com/arc)
- [Arc Testnet Explorer](https://testnet.arcscan.app)
- [Arc Faucet](https://faucet.circle.com)
- [Circle CCTP V2 Docs](https://developers.circle.com/stablecoins/cctp-getting-started)
- [Circle Wallets Docs](https://developers.circle.com/wallets)
- [Circle Gateway Docs](https://developers.circle.com/gateway)

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) — Technical implementation guide
- [Base Reference (historical)](./BASE-REFERENCE.md) — Base L2 reference (archived)
- [Migration Doc](./development/20_arc_chain_migration.md) — Migration details

---

*Document Version: 1.0*
*Created: 2026-02-06*
*Status: Primary reference for Arc chain development*
