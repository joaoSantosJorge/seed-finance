# Anvil Integration Tests

> **End-to-end integration tests for Seed Finance smart contracts using Anvil local blockchain.**
>
> These tests complement the Foundry unit tests by testing complete user flows and
> multi-contract interactions in a realistic blockchain environment.

---

## Overview

This directory contains integration tests that deploy the full contract system to a local
Anvil blockchain and execute realistic scenarios including:

- **LP Operations**: Deposit, withdraw, share token mechanics
- **Treasury Management**: Strategy allocation, yield accrual, rebalancing
- **Access Control**: Role-based permissions, pause/unpause functionality
- **Multi-contract Interactions**: LiquidityPool ↔ TreasuryManager ↔ Strategies

### Why Integration Tests?

While Foundry unit tests (in `test/*.t.sol`) verify individual contract behavior,
these Anvil tests verify:

1. Correct contract deployment and linking
2. Cross-contract call flows
3. State changes across multiple transactions
4. Real gas costs and transaction execution
5. Role-based access control in practice

---

## Files

| File | Description |
|------|-------------|
| `README.md` | This documentation - explains how to run tests and what they cover |
| `test-contracts.sh` | Automated bash script that deploys contracts and runs 4 test scenarios |

---

## Quick Start

### Prerequisites

1. **Foundry installed** - Install from https://getfoundry.sh/
2. **Contracts built** - Run `forge build` in the contracts directory

### Running Tests

```bash
# Terminal 1: Start Anvil
anvil

# Terminal 2: Run tests (from contracts directory)
cd /path/to/seed-finance/contracts
./test/anvil/test-contracts.sh
```

---

## Test Scenarios

### Scenario 1: Basic LP Flow
Tests the core liquidity provider experience:
1. Mint USDC to LP user (simulates fiat on-ramp)
2. LP approves and deposits 100k USDC to pool
3. Verify LP receives correct SEED shares (1:1 initially)
4. LP withdraws 50k USDC
5. Verify share balance and USDC balance are correct

**Validates:** ERC-4626 vault mechanics, deposit/withdraw flows

### Scenario 2: Treasury Integration
Tests idle capital yield optimization:
1. Add liquidity to the pool
2. Admin deposits 30k USDC to treasury strategies
3. Simulate 5k USDC yield earned by strategy
4. Accrue yield and verify totalAssets increases
5. Verify share price appreciation

**Validates:** LiquidityPool ↔ TreasuryManager ↔ Strategy integration

### Scenario 3: Multi-Strategy Rebalancing
Tests capital allocation across multiple strategies:
1. Deploy second MockStrategy
2. Configure 60%/40% weight allocation
3. Deposit 100k to treasury, verify 60k/40k distribution
4. Update weights to 50%/50%
5. Trigger rebalance, verify equal distribution

**Validates:** Strategy weight management, rebalancing mechanics

### Scenario 4: Access Control
Tests role-based permission system:
1. Attempt unauthorized treasury deposit → expect revert
2. Attempt unauthorized strategy addition → expect revert
3. Grant TREASURY_ROLE, retry → expect success
4. Pause pool, attempt deposit → expect revert
5. Unpause pool → operations resume

**Validates:** AccessControl roles, Pausable functionality

---

## Anvil Default Accounts

The script uses Anvil's pre-funded accounts:

| Role | Address | Private Key |
|------|---------|-------------|
| Deployer/Admin | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec...` |
| LP User | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e9...` |
| Strategist | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111af...` |

---

## Role Constants (keccak256 hashes)

```bash
DEFAULT_ADMIN_ROLE=0x0000000000000000000000000000000000000000000000000000000000000000
ROUTER_ROLE=0x7a05a596cb0ce7fdea8a1e1ec73be300bdb35097c944ce1897202f7a13122eb2
TREASURY_ROLE=0xe1dcbdb91df27212a29bc27177c840cf2f819ecf2187432e1fac86c2dd5dfca9
POOL_ROLE=0xb8179c2726c8d8961ef054875ab3f4c1c3d34e1cb429c3d5e0bc97958e4cab9d
STRATEGIST_ROLE=0x17a8e30262c1f919c33056d877a3c22b95c2f5e4dac44683c1c2323cd79fbdb0
PAUSER_ROLE=0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a
```

---

## Troubleshooting

### "Anvil is not running"
Start Anvil in a separate terminal: `anvil`

### "Insufficient liquidity" error
The pool doesn't have enough USDC. Mint more tokens or reduce the operation amount.

### "AccessControlUnauthorizedAccount" error
The caller lacks the required role. Grant the role using:
```bash
cast send <CONTRACT> "grantRole(bytes32,address)" <ROLE_HASH> <ADDRESS> \
    --rpc-url http://localhost:8545 --private-key <ADMIN_KEY>
```

### "EnforcedPause" error
The contract is paused. Unpause with:
```bash
cast send <CONTRACT> "unpause()" --rpc-url http://localhost:8545 --private-key <PAUSER_KEY>
```

---

## Related Resources

- **Foundry Unit Tests**: `contracts/test/LiquidityPool.t.sol`, `contracts/test/TreasuryManager.t.sol`
- **Contract Source**: `contracts/src/base/LiquidityPool.sol`, `contracts/src/base/TreasuryManager.sol`
- **Project Documentation**: `/CLAUDE.md`
