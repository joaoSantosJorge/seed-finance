# 14. Full Workflow Test Script on Anvil

## Summary

Created a Foundry script (`TestWorkflow.s.sol`) to test the complete invoice financing workflow on a fresh Anvil instance. Also fixed missing FundingFacet selectors in the deployment script required for the two-step funding flow.

## Changes Made

### 1. Fixed DeployLocal.s.sol (contracts/script/DeployLocal.s.sol)

Updated FundingFacet selectors from 4 to 8 to include all functions needed for the two-step funding flow:

```solidity
// Before: 4 selectors
bytes4[] memory fundingSelectors = new bytes4[](4);
fundingSelectors[0] = FundingFacet.requestFunding.selector;
fundingSelectors[1] = FundingFacet.batchFund.selector;
fundingSelectors[2] = FundingFacet.canFundInvoice.selector;
fundingSelectors[3] = FundingFacet.getFundingAmount.selector;

// After: 8 selectors
bytes4[] memory fundingSelectors = new bytes4[](8);
fundingSelectors[0] = FundingFacet.approveFunding.selector;
fundingSelectors[1] = FundingFacet.batchApproveFunding.selector;
fundingSelectors[2] = FundingFacet.canApproveFunding.selector;
fundingSelectors[3] = FundingFacet.supplierRequestFunding.selector;
fundingSelectors[4] = FundingFacet.requestFunding.selector;
fundingSelectors[5] = FundingFacet.batchFund.selector;
fundingSelectors[6] = FundingFacet.canFundInvoice.selector;
fundingSelectors[7] = FundingFacet.getFundingAmount.selector;
```

### 2. Fixed InvoiceLifecycle.t.sol (contracts/test/integration/InvoiceLifecycle.t.sol)

Updated FundingFacet selectors from 5 to 8 (same change as above).

### 3. Created TestWorkflow.s.sol (contracts/script/TestWorkflow.s.sol)

New Foundry script that tests the complete two-step funding workflow:

## Workflow Tested

```
1. Financier deposits 100,000 USDC → LiquidityPool
2. Supplier creates 10,000 USDC invoice (30 days maturity, 5% APR discount)
3. Buyer approves invoice (Pending → Approved)
4. Operator approves funding (Approved → FundingApproved)
5. Supplier triggers funding (FundingApproved → Funded) + receives USDC
6. Time warp 30 days + 1 second (vm.warp)
7. Buyer repays invoice at maturity (Funded → Paid)
```

## Usage

```bash
# Terminal 1: Start fresh Anvil
anvil --host 0.0.0.0 --accounts 10 --balance 10000

# Terminal 2: Run workflow test
forge script script/TestWorkflow.s.sol:TestWorkflow \
  --rpc-url http://localhost:8545 \
  --broadcast
```

## Test Accounts (Anvil Defaults)

| Role | Address | Private Key |
|------|---------|-------------|
| Deployer/Operator | 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 | 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 |
| Financier/LP | 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 | 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d |
| Supplier | 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC | 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a |
| Buyer | 0x90F79bf6EB2c4f870365E785982E1f101E93b906 | 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6 |

## Expected Output

```
==========================================================
      SEED FINANCE - FULL WORKFLOW TEST ON ANVIL
==========================================================

STEP 0: Deploying contracts...
  MockUSDC deployed at: 0x5FbDB2315678afecb367f032d93F642f64180aa3
  LiquidityPool deployed at: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
  InvoiceDiamond deployed at: 0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6
  ExecutionPool deployed at: 0x610178dA211FEF7D417bC0e6FeD39F05609AD788

STEP 1: Financier deposits USDC to LiquidityPool
  Deposited: 100000 USDC
  SEED shares received: 100000000000

STEP 2: Supplier creates invoice
  Invoice ID: 1
  Face Value: 10000 USDC
  Discount Rate: 500 bps (5% APR)

STEP 3: Buyer approves invoice
  New Status: Approved

STEP 4: Operator approves funding
  New Status: FundingApproved

STEP 5: Supplier triggers funding
  Funding amount (after discount): 9958 USDC
  Discount: 41 USDC
  Supplier received: 9958 USDC
  Pool totalDeployed: 9958 USDC

STEP 6: Time warp to maturity (30 days + 1 second)

STEP 7: Buyer repays invoice at maturity
  Buyer paid: 10000 USDC
  Pool totalInvoiceYield: 41 USDC

==========================================================
                    FINAL SUMMARY
==========================================================

LiquidityPool State:
  Total Assets: 100041 USDC
  Total Invoice Yield: 41 USDC

Financier Position:
  SEED Shares: 100000000000
  Share Value: 100041 USDC
  Profit: 41 USDC

==========================================================
         WORKFLOW TEST COMPLETED SUCCESSFULLY!
==========================================================
```

## Files Modified

1. `contracts/script/DeployLocal.s.sol` - Added 4 missing FundingFacet selectors
2. `contracts/script/TestWorkflow.s.sol` - **New file** - Full workflow test script
3. `contracts/test/integration/InvoiceLifecycle.t.sol` - Added 3 missing FundingFacet selectors

## Tests Verified

All 431 tests pass after the changes:
- 5 integration tests (InvoiceLifecycleTest)
- 426 unit tests across all other test suites

## Status

- [x] DeployLocal.s.sol updated with all 8 FundingFacet selectors
- [x] TestWorkflow.s.sol created and tested
- [x] InvoiceLifecycle.t.sol updated with all 8 FundingFacet selectors
- [x] All tests pass (431 total)
- [x] Workflow script runs successfully on Anvil
