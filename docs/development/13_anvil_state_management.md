# 13. Anvil State Management

## Overview

Anvil is Foundry's local Ethereum node used for development and testing. This document explains how to manage Anvil's state persistence to preserve deployed contracts and transactions between sessions.

## State Persistence Flags

Anvil provides three flags for state management:

| Flag | Load on Start | Save on Exit | Use Case |
|------|---------------|--------------|----------|
| `--state <path>` | Yes | Yes | Full persistence (recommended) |
| `--load-state <path>` | Yes | No | Read-only from snapshot |
| `--dump-state <path>` | No | Yes | Create snapshot on exit |

## Recommended Usage

### Starting Anvil with State Persistence

**Always run Anvil from the `contracts/` directory** to keep state alongside deployment artifacts:

```bash
cd contracts
anvil --host 0.0.0.0 --accounts 10 --balance 10000 --state state.json
```

This stores state at `contracts/state.json`, keeping it with the broadcast files and deployment scripts.

### What Gets Saved

- All deployed contract bytecode and storage
- Account balances (ETH and tokens)
- Transaction history
- Block data
- Nonces

### What Does NOT Get Saved

- Pending transactions in mempool
- WebSocket subscriptions
- RPC connection state

## Saving State

### Automatic Save (Graceful Shutdown)

When using `--state`, Anvil saves automatically on **graceful shutdown**:

1. Press `Ctrl+C` once in the Anvil terminal
2. Wait for the "Saved state to..." message
3. Do NOT close the terminal prematurely

```
^C
Saved state to "state.json"
```

### Manual Save (While Running)

You can force a state dump without stopping Anvil:

```bash
# Dump state via RPC (returns hex-encoded state)
cast rpc anvil_dumpState --rpc-url http://localhost:8545

# Save to file (decode hex to binary)
cast rpc anvil_dumpState --rpc-url http://localhost:8545 | \
  tr -d '"' | xxd -r -p > state_backup.json
```

### Creating Named Backups

For important milestones, create named backups:

```bash
# After completing a test scenario
cp state.json state_invoice_lifecycle_complete.json
cp state.json state_before_upgrade.json
```

## Loading State

### On Startup

```bash
# Load existing state (and save changes on exit)
anvil --state state.json

# Load state read-only (changes won't be saved)
anvil --load-state state.json
```

### Verifying State Loaded Correctly

After starting Anvil, verify the state loaded:

```bash
# Check block number (should be > 0 if state loaded)
cast block-number --rpc-url http://localhost:8545

# Check a known contract exists
cast call <CONTRACT_ADDRESS> "someFunction()" --rpc-url http://localhost:8545
```

If block number is 0 and contracts don't exist, the state didn't load.

## Common Issues

### State Not Loading

**Symptoms:**
- Block number is 0
- Contracts return "does not have any code"

**Causes:**
1. State file doesn't exist at specified path
2. State file is corrupted
3. Anvil version mismatch (state format changed)
4. File permissions issue

**Solutions:**
```bash
# Ensure you're in the contracts directory
cd contracts

# Check file exists and has content
ls -la state.json

# Verify file is valid JSON
head -c 100 state.json

# Try with absolute path
anvil --state /full/path/to/contracts/state.json
```

### State Not Saving

**Symptoms:**
- Block number resets to 0 on restart
- Transactions lost after restart

**Causes:**
1. Anvil killed forcefully (kill -9, terminal closed)
2. Using `--load-state` instead of `--state`
3. Disk full or write permission denied

**Solutions:**
1. Always use `Ctrl+C` for graceful shutdown
2. Use `--state` flag (not `--load-state`)
3. Check disk space and permissions

### State File Too Large

Over time, state files can grow large. To reduce size:

```bash
cd contracts

# Start fresh and redeploy
rm state.json
anvil --host 0.0.0.0 --state state.json &
sleep 2
forge script script/DeployLocal.s.sol:DeployLocal --rpc-url http://localhost:8545 --broadcast
```

## Project-Specific State Management

### Seed Finance Test Accounts

When using `--state`, these deterministic accounts are preserved:

| Account | Address | Role |
|---------|---------|------|
| 0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | Deployer/Admin |
| 1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | Financier/LP |
| 2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | Supplier |
| 3 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | Buyer |

### Deployed Contract Addresses

After running `DeployLocal.s.sol`, these addresses are used:

```bash
# Check broadcast file for latest addresses
cat broadcast/DeployLocal.s.sol/31337/run-latest.json | \
  grep -E '"contractName"|"contractAddress"' | paste - -
```

### Verifying Invoice System State

```bash
# Check invoice stats
DIAMOND=0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6
cast call $DIAMOND "getStats()(uint256,uint256,uint256,uint256)" --rpc-url http://localhost:8545

# Check specific invoice
cast call $DIAMOND "getInvoice(uint256)((uint256,address,address,uint128,uint128,uint64,uint64,uint64,uint16,uint8,bytes32,bytes32))" 1 --rpc-url http://localhost:8545

# Check LiquidityPool
LP=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
cast call $LP "totalAssets()(uint256)" --rpc-url http://localhost:8545
cast call $LP "totalInvoiceYield()(uint256)" --rpc-url http://localhost:8545
```

## Best Practices

1. **Always use `--state` for development** - Ensures you don't lose work

2. **Create backups at milestones** - Before major changes or after completing test scenarios

3. **Use graceful shutdown** - `Ctrl+C` once and wait for confirmation

4. **Verify after restart** - Always check block number and a known contract

5. **Document state contents** - Note what's deployed and configured in each state file

6. **Don't commit large state files** - Add to `.gitignore` if over a few MB

## Quick Reference

```bash
# Always start from contracts directory
cd contracts

# Start with persistence
anvil --host 0.0.0.0 --accounts 10 --balance 10000 --state state.json

# Check if state loaded
cast block-number --rpc-url http://localhost:8545

# Manual backup while running
cp state.json state_backup_$(date +%Y%m%d_%H%M%S).json

# Verify contracts exist
cast call <ADDRESS> "owner()(address)" --rpc-url http://localhost:8545

# Graceful shutdown: Ctrl+C (once, then wait)
```

## File Location

State file location: **`contracts/state.json`**

This keeps the state file alongside:
- `contracts/broadcast/` - Deployment transaction logs
- `contracts/script/` - Deployment scripts
- `contracts/src/` - Contract source code

## Related Documentation

- [Foundry Anvil Docs](https://book.getfoundry.sh/anvil/)
- `docs/development/11_local_anvil_testing.md` - Local testing setup
- `script/DeployLocal.s.sol` - Deployment script for local testing
