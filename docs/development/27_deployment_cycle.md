# Deployment Cycle

## Overview

Comprehensive reference for Seed Finance's deployment lifecycle on Arc Testnet. Covers contract dependencies, deployment order, what can be redeployed independently, and step-by-step playbooks for common redeployment scenarios.

## A. Contract Dependency Map

```
                        ┌─────────────────────┐
                        │    SmartRouter       │
                        │  (standalone)        │
                        └──────────┬──────────┘
                                   │ deposits via ERC-4626
                                   ▼
┌──────────────────┐    ┌─────────────────────┐    ┌──────────────────┐
│  TreasuryManager │◄───│    LiquidityPool    │───►│  ExecutionPool   │
│                  │    │   (ERC-4626 vault)   │    │                  │
└───────┬──────────┘    └─────────────────────┘    └────────┬─────────┘
        │                                                   │
        │ addStrategy()                    setInvoiceDiamond()
        ▼                                                   ▼
┌──────────────────┐                            ┌──────────────────────┐
│  USYCStrategy    │                            │   InvoiceDiamond     │
│  (Hashnote USYC) │                            │   (EIP-2535 proxy)   │
└──────────────────┘                            │  ┌────────────────┐  │
                                                │  │ InvoiceFacet   │  │
                                                │  │ FundingFacet   │  │
                                                │  │ RepaymentFacet │  │
                                                │  │ ViewFacet      │  │
                                                │  │ AdminFacet     │  │
                                                │  └────────────────┘  │
                                                └──────────────────────┘
```

### Dependency Table

| Contract | References | Referenced By |
|----------|-----------|---------------|
| **LiquidityPool** | TreasuryManager (via `setTreasuryManager`) | ExecutionPool (ROUTER_ROLE), SmartRouter (ERC-4626 deposit), InvoiceDiamond (via AdminFacet) |
| **TreasuryManager** | LiquidityPool (constructor), USYCStrategy (via `addStrategy`) | LiquidityPool (via `setTreasuryManager`) |
| **USYCStrategy** | TreasuryManager (constructor), USYC token | TreasuryManager (via `addStrategy`) |
| **InvoiceDiamond** | ExecutionPool (via `setExecutionPool`), LiquidityPool (via `setLiquidityPool`) | ExecutionPool (via `setInvoiceDiamond`) |
| **ExecutionPool** | LiquidityPool (via `setLiquidityPool`), InvoiceDiamond (via `setInvoiceDiamond`) | LiquidityPool (ROUTER_ROLE), InvoiceDiamond (via AdminFacet) |
| **SmartRouter** | LiquidityPool (constructor) | None (standalone entry point) |

### Link Mechanisms

| Link | Setter Function | Access Control | Contract |
|------|----------------|----------------|----------|
| LiquidityPool → TreasuryManager | `setTreasuryManager(address)` | `DEFAULT_ADMIN_ROLE` | LiquidityPool |
| LiquidityPool → ExecutionPool | `grantRole(ROUTER_ROLE, address)` | `DEFAULT_ADMIN_ROLE` | LiquidityPool |
| TreasuryManager → LiquidityPool | `setLiquidityPool(address)` | `DEFAULT_ADMIN_ROLE` | TreasuryManager |
| TreasuryManager → Strategy | `addStrategy(address, uint256)` | `STRATEGIST_ROLE` | TreasuryManager |
| ExecutionPool → LiquidityPool | `setLiquidityPool(address)` | `DEFAULT_ADMIN_ROLE` | ExecutionPool |
| ExecutionPool → InvoiceDiamond | `setInvoiceDiamond(address)` | `DEFAULT_ADMIN_ROLE` | ExecutionPool |
| InvoiceDiamond → ExecutionPool | `setExecutionPool(address)` | `onlyOwner` | AdminFacet |
| InvoiceDiamond → LiquidityPool | `setLiquidityPool(address)` | `onlyOwner` | AdminFacet |

---

## B. Full Deployment Order (Fresh Deploy)

### Phase 1: Core Layer (`DeployArcTestnet.s.sol`)

Deploys the complete Seed Finance stack in a single atomic script:

| Step | Action | Contract |
|------|--------|----------|
| 1 | Deploy LiquidityPool | `new LiquidityPool(USDC, "Seed Finance LP Token", "SEED")` |
| 2 | Deploy 5 facets | InvoiceFacet, FundingFacet, RepaymentFacet, ViewFacet, AdminFacet |
| 3 | Deploy DiamondInit helper | Ensures correct owner from EVM delegatecall context |
| 4 | Deploy InvoiceDiamond | With all facet cuts + atomic initialization |
| 5 | Deploy ExecutionPool | `new ExecutionPool(USDC)` |
| 6 | Link ExecutionPool → LiquidityPool | `executionPool.setLiquidityPool(liquidityPool)` |
| 7 | Link ExecutionPool → InvoiceDiamond | `executionPool.setInvoiceDiamond(invoiceDiamond)` |
| 8 | Grant ROUTER_ROLE | `liquidityPool.grantRole(ROUTER_ROLE, executionPool)` |
| 9 | Link Diamond → ExecutionPool | `AdminFacet.setExecutionPool(executionPool)` |
| 10 | Link Diamond → LiquidityPool | `AdminFacet.setLiquidityPool(liquidityPool)` |
| 11 | Set deployer as operator | `AdminFacet.setOperator(deployer, true)` |

```powershell
# Dry run
forge script script/DeployArcTestnet.s.sol:DeployArcTestnet `
  --rpc-url https://rpc.testnet.arc.network `
  --account arc-deployer

# Live deploy + verify
forge script script/DeployArcTestnet.s.sol:DeployArcTestnet `
  --rpc-url https://rpc.testnet.arc.network `
  --account arc-deployer `
  --broadcast `
  --verify --etherscan-api-key $ARCSCAN_API_KEY
```

### Phase 2: Treasury Layer (`DeployTreasury.s.sol`)

Deploys treasury on top of existing LiquidityPool:

| Step | Action | Contract |
|------|--------|----------|
| 1 | Deploy TreasuryManager | `new TreasuryManager(USDC, LIQUIDITY_POOL)` |
| 2 | Deploy USYCStrategy | `new USYCStrategy(USDC, USYC, treasuryManager)` |
| 3 | Link to LiquidityPool | `LiquidityPool.setTreasuryManager(treasuryManager)` |
| 4 | Register strategy | `TreasuryManager.addStrategy(usycStrategy, 10000)` |

```powershell
forge script script/DeployTreasury.s.sol:DeployTreasury `
  --rpc-url https://rpc.testnet.arc.network `
  --account arc-deployer `
  --broadcast `
  --verify --etherscan-api-key $ARCSCAN_API_KEY
```

### Phase 3: Post-Deploy Configuration

1. Copy new addresses to `frontend/lib/config/contracts.ts` (testnet defaults)
2. Update `frontend/.env.local` with `NEXT_PUBLIC_*` vars
3. Update `backend/.env` with contract addresses
4. Update Railway environment variables (if backend is deployed)
5. Redeploy frontend and backend

---

## C. Per-Contract Redeployability

### LiquidityPool

| Property | Value |
|----------|-------|
| **Independently Redeployable?** | **No (practically)** |
| **Reason** | SEED share token state (LP balances, totalSupply, totalAssets) lives in this contract. Redeploying loses all LP positions. |
| **State Lost on Redeploy** | LP share balances, totalDeployed, totalInTreasury, yield counters, all USDC held |
| **Access Control** | OpenZeppelin AccessControl (roles-based) |

**Admin Setter Functions:**

| Function | Role | Purpose |
|----------|------|---------|
| `setTreasuryManager(address)` | `DEFAULT_ADMIN_ROLE` | Link/replace TreasuryManager |
| `setLiquidityBuffer(uint256)` | `DEFAULT_ADMIN_ROLE` | Min liquidity to keep in pool |
| `setMaxTreasuryAllocation(uint256)` | `DEFAULT_ADMIN_ROLE` | Max % to deploy to treasury (basis points) |
| `grantRole(role, address)` | `DEFAULT_ADMIN_ROLE` | Grant ROUTER_ROLE, TREASURY_ROLE, etc. |
| `revokeRole(role, address)` | `DEFAULT_ADMIN_ROLE` | Revoke roles |
| `pause()` / `unpause()` | `PAUSER_ROLE` | Emergency pause |
| `emergencyWithdraw(token, amount, to)` | `DEFAULT_ADMIN_ROLE` | Rescue stuck tokens |

---

### TreasuryManager

| Property | Value |
|----------|-------|
| **Independently Redeployable?** | **Yes** |
| **Steps** | Redeploy + call `LiquidityPool.setTreasuryManager(newAddress)` + re-add strategies |
| **State Lost on Redeploy** | Strategy registry, yield counters, rebalance timestamps |
| **Funds at Risk** | Must withdraw from strategies before redeploying, or strategies keep the funds (recoverable via strategy's `emergencyWithdraw`) |
| **Access Control** | OpenZeppelin AccessControl (roles-based) |

**Admin Setter Functions:**

| Function | Role | Purpose |
|----------|------|---------|
| `setLiquidityPool(address)` | `DEFAULT_ADMIN_ROLE` | Update pool reference |
| `addStrategy(address, uint256)` | `STRATEGIST_ROLE` | Register strategy + weight |
| `removeStrategy(address)` | `STRATEGIST_ROLE` | Withdraw all + deregister |
| `setStrategyWeight(address, uint256)` | `STRATEGIST_ROLE` | Change allocation weight |
| `pauseStrategy(address)` | `STRATEGIST_ROLE` | Disable deposits to strategy |
| `unpauseStrategy(address)` | `STRATEGIST_ROLE` | Re-enable strategy |
| `setRebalanceCooldown(uint256)` | `DEFAULT_ADMIN_ROLE` | Min time between rebalances |
| `setWithdrawSlippageTolerance(uint256)` | `DEFAULT_ADMIN_ROLE` | Max slippage (bps) |
| `pause()` / `unpause()` | `PAUSER_ROLE` | Emergency pause |
| `emergencyWithdrawFromStrategy(address)` | `DEFAULT_ADMIN_ROLE` | Extract all from strategy |
| `rescueTokens(token, to, amount)` | `DEFAULT_ADMIN_ROLE` | Rescue stuck tokens |

---

### USYCStrategy

| Property | Value |
|----------|-------|
| **Independently Redeployable?** | **Yes** |
| **Steps** | `TreasuryManager.removeStrategy(old)` → deploy new → `TreasuryManager.addStrategy(new, weight)` |
| **State Lost on Redeploy** | totalDeposited counter, APY setting |
| **Funds** | `removeStrategy()` auto-withdraws all funds back to TreasuryManager |
| **Access Control** | OpenZeppelin Ownable |

**Admin Setter Functions:**

| Function | Access | Purpose |
|----------|--------|---------|
| `setTreasuryManager(address)` | `onlyOwner` | Update TreasuryManager reference |
| `setEstimatedAPY(uint256)` | `onlyOwner` | Update APY estimate (bps) |
| `activate()` / `deactivate()` | `onlyOwner` | Enable/disable deposits |
| `emergencyWithdraw()` | `onlyOwner` | Withdraw all to owner |
| `rescueTokens(token, amount)` | `onlyOwner` | Rescue non-core tokens |

---

### InvoiceDiamond (Proxy)

| Property | Value |
|----------|-------|
| **Independently Redeployable?** | **No (practically)** |
| **Reason** | All invoice state (invoices, supplier/buyer mappings, counters) lives in diamond storage. Redeploying loses everything. |
| **State Lost on Redeploy** | All invoices, funding records, operator list, credit limits |
| **Upgrade Path** | Use `diamondCut()` to replace individual facets — state persists |
| **Access Control** | Custom via LibInvoiceStorage (owner + operators) |

**Admin Functions (via AdminFacet):**

| Function | Access | Purpose |
|----------|--------|---------|
| `setExecutionPool(address)` | `onlyOwner` | Link ExecutionPool |
| `setLiquidityPool(address)` | `onlyOwner` | Link LiquidityPool |
| `setUSDC(address)` | `onlyOwner` | Update USDC reference |
| `setOperator(address, bool)` | `onlyOwner` | Grant/revoke operator |
| `transferOwnership(address)` | `onlyOwner` | Transfer diamond ownership |
| `diamondCut(cuts, init, calldata)` | `onlyOwner` | Add/replace/remove facets |

---

### InvoiceDiamond Facets

| Property | Value |
|----------|-------|
| **Independently Redeployable?** | **Yes** |
| **Method** | Deploy new facet → `diamondCut()` with `Replace` action |
| **State** | Facets are stateless logic — all state is in diamond storage |
| **No Coordination Needed** | Diamond proxy routes calls; replacing a facet is transparent |

---

### ExecutionPool

| Property | Value |
|----------|-------|
| **Independently Redeployable?** | **With coordination** |
| **Steps** | Deploy new → update Diamond (`setExecutionPool`) + LiquidityPool (`grantRole(ROUTER_ROLE)`) + revoke old role |
| **State Lost on Redeploy** | `fundingRecords` mapping (per-invoice funding details), `totalFunded`, `totalRepaid`, `activeInvoices` counters |
| **Risk** | Any USDC held in the old ExecutionPool must be recovered first |
| **Access Control** | OpenZeppelin AccessControl (roles-based) |

**Admin Setter Functions:**

| Function | Role | Purpose |
|----------|------|---------|
| `setLiquidityPool(address)` | `DEFAULT_ADMIN_ROLE` | Link LiquidityPool |
| `setInvoiceDiamond(address)` | `DEFAULT_ADMIN_ROLE` | Link Diamond (auto-grants DIAMOND_ROLE) |

---

### SmartRouter

| Property | Value |
|----------|-------|
| **Independently Redeployable?** | **Yes** |
| **Steps** | Deploy new — no other contracts reference it |
| **State Lost on Redeploy** | `totalRouted`, deposit counters (stats only) |
| **Access Control** | OpenZeppelin Ownable |

**Admin Setter Functions:**

| Function | Access | Purpose |
|----------|--------|---------|
| `setCCTPReceiver(address)` | `onlyOwner` | Update CCTP receiver |
| `setHandler(address, bool)` | `onlyOwner` | Manage authorized handlers |
| `setMinDepositAmount(uint256)` | `onlyOwner` | Update min deposit |
| `emergencyWithdraw(token, amount, to)` | `onlyOwner` | Rescue stuck tokens |

---

### Summary Table

| Contract | Redeployable? | State at Risk | Coordination |
|----------|:------------:|---------------|:------------:|
| LiquidityPool | No | LP shares, USDC balances | — |
| TreasuryManager | **Yes** | Strategy registry, counters | Update LiquidityPool |
| USYCStrategy | **Yes** | Deposit counter, APY | Update TreasuryManager |
| Diamond Facets | **Yes** | None (stateless) | `diamondCut()` only |
| InvoiceDiamond proxy | No | All invoice data | — |
| ExecutionPool | Partial | Funding records, counters | Update Diamond + Pool |
| SmartRouter | **Yes** | Stats only | None |

---

## D. Redeployment Playbooks

### Playbook 1: Redeploy TreasuryManager

**When:** Bug fix in TreasuryManager logic (e.g., double-transfer fix), or need fresh strategy registry.

**Prerequisites:**
- No funds currently deployed to strategies (or call `withdrawAll()` first)
- Deployer has `DEFAULT_ADMIN_ROLE` on LiquidityPool

**Steps:**

```powershell
# Step 1: If funds are deployed, withdraw them first
cast send <OLD_TREASURY_MANAGER> "withdrawAll()" `
  --rpc-url https://rpc.testnet.arc.network `
  --account arc-deployer

# Step 2: Dry run the deployment script
forge script script/DeployTreasury.s.sol:DeployTreasury `
  --rpc-url https://rpc.testnet.arc.network `
  --account arc-deployer

# Step 3: Live deploy + verify
forge script script/DeployTreasury.s.sol:DeployTreasury `
  --rpc-url https://rpc.testnet.arc.network `
  --account arc-deployer `
  --broadcast `
  --verify --etherscan-api-key $ARCSCAN_API_KEY
```

The `DeployTreasury.s.sol` script handles all linking automatically:
1. Deploys fresh TreasuryManager + USYCStrategy
2. Calls `LiquidityPool.setTreasuryManager(newAddress)` — replaces old reference
3. Calls `TreasuryManager.addStrategy(usycStrategy, 10000)` — registers strategy at 100% weight

**Post-deploy verification:**

```powershell
# Verify TreasuryManager is linked to LiquidityPool
cast call 0xB67db96eEbf1D30D95a382535afBB2375ECf0219 `
  "treasuryManager()(address)" `
  --rpc-url https://rpc.testnet.arc.network

# Verify strategy count (should return 1)
cast call <NEW_TREASURY_MANAGER> `
  "strategyCount()(uint256)" `
  --rpc-url https://rpc.testnet.arc.network

# Verify total value (should be 0 for fresh deploy)
cast call <NEW_TREASURY_MANAGER> `
  "totalValue()(uint256)" `
  --rpc-url https://rpc.testnet.arc.network
```

**Post-deploy updates:**
1. Update `frontend/lib/config/contracts.ts` — `treasuryManager` address in testnet config
2. Update `frontend/.env.local` — `NEXT_PUBLIC_TREASURY_MANAGER_ADDRESS`
3. Update `backend/.env` if TreasuryManager is referenced
4. Update Railway env vars if applicable

---

### Playbook 2: Redeploy a Strategy (e.g., USYCStrategy)

**When:** Strategy logic bug, or switching to a different yield source.

```powershell
# Step 1: Remove old strategy (auto-withdraws all funds)
cast send <TREASURY_MANAGER> `
  "removeStrategy(address)" <OLD_STRATEGY> `
  --rpc-url https://rpc.testnet.arc.network `
  --account arc-deployer

# Step 2: Deploy new strategy
forge create src/strategies/USYCStrategy.sol:USYCStrategy `
  --constructor-args <USDC> <USYC> <TREASURY_MANAGER> `
  --rpc-url https://rpc.testnet.arc.network `
  --account arc-deployer `
  --verify --etherscan-api-key $ARCSCAN_API_KEY

# Step 3: Register new strategy (10000 = 100% weight)
cast send <TREASURY_MANAGER> `
  "addStrategy(address,uint256)" <NEW_STRATEGY> 10000 `
  --rpc-url https://rpc.testnet.arc.network `
  --account arc-deployer

# Step 4: Verify
cast call <TREASURY_MANAGER> "strategyCount()(uint256)" `
  --rpc-url https://rpc.testnet.arc.network
```

**No frontend/backend updates needed** — strategies are managed entirely through TreasuryManager and are not referenced by address in the frontend.

---

### Playbook 3: Upgrade a Diamond Facet

**When:** Bug fix or new functionality in invoice logic.

```powershell
# Step 1: Deploy the new facet
forge create src/invoice/facets/FundingFacet.sol:FundingFacet `
  --rpc-url https://rpc.testnet.arc.network `
  --account arc-deployer `
  --verify --etherscan-api-key $ARCSCAN_API_KEY

# Step 2: Execute diamondCut with Replace action
# This requires a script or manual ABI-encoded call.
# Use a dedicated upgrade script or cast with encoded calldata.

# Example: Replace FundingFacet (all 8 selectors)
# Build the FacetCut struct and call diamondCut on the InvoiceDiamond.
# See DeployArcTestnet.s.sol for the selector list per facet.
```

**State is preserved** — diamond storage is untouched by facet replacement. Only the logic contract address changes in the selector-to-facet mapping.

**No frontend/backend updates needed** — the Diamond proxy address stays the same, and ABIs only change if function signatures change (in which case, regenerate ABIs from `forge inspect`).

---

### Playbook 4: Redeploy ExecutionPool

**When:** Critical bug in ExecutionPool logic. Requires coordination with Diamond and LiquidityPool.

**Risk:** Loses `fundingRecords` — any invoices currently in "Funded" status will lose their on-chain funding metadata in ExecutionPool. Invoice status in the Diamond is unaffected.

```powershell
# Step 1: Ensure no USDC is held in old ExecutionPool
cast call <OLD_EXECUTION_POOL> `
  "activeInvoices()(uint256)" `
  --rpc-url https://rpc.testnet.arc.network
# If > 0, process repayments first or use emergencyWithdraw

# Step 2: Deploy new ExecutionPool
forge create src/invoice/ExecutionPool.sol:ExecutionPool `
  --constructor-args <USDC> `
  --rpc-url https://rpc.testnet.arc.network `
  --account arc-deployer `
  --verify --etherscan-api-key $ARCSCAN_API_KEY

# Step 3: Link new ExecutionPool to LiquidityPool and InvoiceDiamond
cast send <NEW_EXECUTION_POOL> `
  "setLiquidityPool(address)" <LIQUIDITY_POOL> `
  --rpc-url https://rpc.testnet.arc.network `
  --account arc-deployer

cast send <NEW_EXECUTION_POOL> `
  "setInvoiceDiamond(address)" <INVOICE_DIAMOND> `
  --rpc-url https://rpc.testnet.arc.network `
  --account arc-deployer

# Step 4: Grant ROUTER_ROLE to new ExecutionPool in LiquidityPool
cast send <LIQUIDITY_POOL> `
  "grantRole(bytes32,address)" $(cast keccak "ROUTER_ROLE") <NEW_EXECUTION_POOL> `
  --rpc-url https://rpc.testnet.arc.network `
  --account arc-deployer

# Step 5: Revoke ROUTER_ROLE from old ExecutionPool
cast send <LIQUIDITY_POOL> `
  "revokeRole(bytes32,address)" $(cast keccak "ROUTER_ROLE") <OLD_EXECUTION_POOL> `
  --rpc-url https://rpc.testnet.arc.network `
  --account arc-deployer

# Step 6: Update InvoiceDiamond to point to new ExecutionPool
cast send <INVOICE_DIAMOND> `
  "setExecutionPool(address)" <NEW_EXECUTION_POOL> `
  --rpc-url https://rpc.testnet.arc.network `
  --account arc-deployer
```

**Post-deploy updates:**
1. Update `frontend/lib/config/contracts.ts` — `executionPool` address
2. Update `backend/.env` — `EXECUTION_POOL_ADDRESS`
3. Update Railway env vars

---

## E. Environment & Tooling Reference

### Keystore Setup

Foundry's encrypted keystore avoids exposing private keys in scripts:

```powershell
# One-time: import your deployer key
cast wallet import arc-deployer --interactive
# Enter private key and a password when prompted

# Verify it's stored
cast wallet list
```

All `forge script` and `cast send` commands use `--account arc-deployer` which prompts for the password.

### Environment Variables

| Variable | Where | Value |
|----------|-------|-------|
| `ARC_TESTNET_RPC_URL` | `foundry.toml` [rpc_endpoints] | `https://rpc.testnet.arc.network` |
| `ARCSCAN_API_KEY` | Shell env / `foundry.toml` [etherscan] | Your Arcscan API key |
| `NEXT_PUBLIC_USDC_ADDRESS` | `frontend/.env.local` | `0x3600000000000000000000000000000000000000` |
| `NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS` | `frontend/.env.local` | See address table below |
| `NEXT_PUBLIC_TREASURY_MANAGER_ADDRESS` | `frontend/.env.local` | See address table below |
| `NEXT_PUBLIC_INVOICE_DIAMOND_ADDRESS` | `frontend/.env.local` | See address table below |
| `NEXT_PUBLIC_EXECUTION_POOL_ADDRESS` | `frontend/.env.local` | See address table below |
| `LIQUIDITY_POOL_ADDRESS` | `backend/.env` | Same as frontend |
| `USDC_ADDRESS` | `backend/.env` | `0x3600000000000000000000000000000000000000` |
| `INVOICE_DIAMOND_ADDRESS` | `backend/.env` | Same as frontend |
| `EXECUTION_POOL_ADDRESS` | `backend/.env` | Same as frontend |

### Forge Script Flags

| Flag | Purpose |
|------|---------|
| *(none)* | Dry run — simulates locally, no broadcast |
| `--broadcast` | Live deploy — sends transactions on-chain |
| `--verify` | Submit source to block explorer for verification |
| `--etherscan-api-key KEY` | API key for verification (Arcscan) |
| `--account NAME` | Use encrypted keystore account |
| `--rpc-url URL` | Target RPC endpoint |
| `-vvvv` | Maximum verbosity (show traces) |

### Current Deployed Addresses (Arc Testnet)

| Contract | Address | Deployed By |
|----------|---------|-------------|
| USDC | `0x3600000000000000000000000000000000000000` | System contract |
| USYC | `0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C` | Hashnote |
| LiquidityPool | `0xB67db96eEbf1D30D95a382535afBB2375ECf0219` | DeployArcTestnet |
| InvoiceDiamond | `0xe73911fbe91a0f76b20b53a8bd7d4c84c5532da6` | DeployArcTestnet |
| ExecutionPool | `0xf1389407cb618990b838d549c226de9ec2d447f0` | DeployArcTestnet |
| TreasuryManager | `0x4815708E786d7355D460CcA07158866B28338885` | DeployTreasury (needs redeploy — double-transfer bug) |
| USYCStrategy | `0x6D0fE2C06878C08F2a1bdb4d3bA5245e017e36ae` | DeployTreasury (needs redeploy with TreasuryManager) |

> **Note:** TreasuryManager and USYCStrategy addresses will change after redeployment following the double-transfer bug fix (commit `6f3435a`). Update this table after redeploying.

### Verification on Arcscan

After deploying with `--verify`, check contract verification at:
```
https://testnet.arcscan.app/address/<CONTRACT_ADDRESS>
```

If automatic verification fails, verify manually:
```powershell
forge verify-contract <ADDRESS> src/base/TreasuryManager.sol:TreasuryManager `
  --constructor-args $(cast abi-encode "constructor(address,address)" <USDC> <LIQUIDITY_POOL>) `
  --chain-id 5042002 `
  --etherscan-api-key $ARCSCAN_API_KEY `
  --verifier-url "https://testnet.arcscan.app/api"
```

---

## F. Redeploying TreasuryManager Now

The TreasuryManager has a double-transfer bug (fixed in commit `6f3435a`) and needs redeployment. The `DeployTreasury.s.sol` script handles everything:

```powershell
# From contracts/ directory

# Step 1: Dry run (verify it works)
forge script script/DeployTreasury.s.sol:DeployTreasury `
  --rpc-url https://rpc.testnet.arc.network `
  --account arc-deployer

# Step 2: Live deploy + verify
forge script script/DeployTreasury.s.sol:DeployTreasury `
  --rpc-url https://rpc.testnet.arc.network `
  --account arc-deployer `
  --broadcast `
  --verify --etherscan-api-key $ARCSCAN_API_KEY

# Step 3: Post-deploy verification
cast call <NEW_TREASURY_MANAGER> "strategyCount()(uint256)" `
  --rpc-url https://rpc.testnet.arc.network

cast call 0xB67db96eEbf1D30D95a382535afBB2375ECf0219 "treasuryManager()(address)" `
  --rpc-url https://rpc.testnet.arc.network

# Step 4: Update frontend/lib/config/contracts.ts with new TreasuryManager address
# Step 5: Update backend .env with new address (if applicable)
# Step 6: Update this doc's address table in Section E
```

## Related Files

- `contracts/script/DeployArcTestnet.s.sol` — Core deployment script
- `contracts/script/DeployTreasury.s.sol` — Treasury deployment script
- `contracts/foundry.toml` — Foundry config with RPC and Etherscan endpoints
- `frontend/lib/config/contracts.ts` — Frontend contract address config
- `backend/.env.example` — Backend environment template
- `docs/development/22_arc_testnet_deployment.md` — Original Arc Testnet deployment
- `docs/development/25_treasury_manager_deployment.md` — First TreasuryManager deployment
- `docs/development/26_treasury_manager_double_transfer_fix.md` — Bug fix requiring redeploy
