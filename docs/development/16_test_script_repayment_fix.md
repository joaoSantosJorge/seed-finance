# Test Script Repayment Flow Fix

## Overview
Fixed a bug in the test scripts (`TestWorkflow.s.sol` and `TestWorkflowExtensive.s.sol`) where invoice repayments were bypassing the InvoiceDiamond, causing invoice status to remain "Funded" even after the buyer had repaid. This is a follow-up to `12_repayment_flow_fix.md` which fixed the contract code - this doc fixes the test scripts.

## The Bug

### Symptoms
- ExecutionPool showed `repaid = true` for invoices
- InvoiceDiamond showed `status = Funded` (not Paid) for the same invoices
- The frontend displayed "Buyer Repaid" in Funding Record but "Awaiting Payment" in Status Timeline

### Root Cause
The test scripts (`TestWorkflow.s.sol` and `TestWorkflowExtensive.s.sol`) were calling `ExecutionPool.repayInvoice()` directly instead of going through `InvoiceDiamond.processRepayment()`.

**Incorrect flow (what the scripts did):**
```
Buyer → USDC.approve(ExecutionPool) → ExecutionPool.repayInvoice()
```
This only updated ExecutionPool's FundingRecord, NOT the Diamond's invoice status.

**Correct flow:**
```
Buyer → USDC.approve(InvoiceDiamond) → InvoiceDiamond.processRepayment()
       → Diamond updates invoice.status = Paid
       → Diamond calls ExecutionPool.receiveRepayment()
       → ExecutionPool marks repaid = true
```

## Changes Made

### Modified Files
| File | Change |
|------|--------|
| `contracts/script/TestWorkflow.s.sol` | Use `invoiceDiamond.processRepayment()` instead of `executionPool.repayInvoice()` |
| `contracts/script/TestWorkflowExtensive.s.sol` | Same fix for all 20 invoice repayments |

### Key Changes

**TestWorkflow.s.sol (lines 425-431):**
```solidity
// Before (WRONG):
usdc.approve(address(executionPool), INVOICE_FACE_VALUE);
executionPool.repayInvoice(invoiceId);

// After (CORRECT):
usdc.approve(address(invoiceDiamond), INVOICE_FACE_VALUE);
RepaymentFacet(address(invoiceDiamond)).processRepayment(invoiceId);
```

**TestWorkflowExtensive.s.sol (lines 537-544):**
```solidity
// Before (WRONG):
usdc.approve(address(executionPool), allInvoices[i].faceValue);
executionPool.repayInvoice(allInvoices[i].id);

// After (CORRECT):
usdc.approve(address(invoiceDiamond), allInvoices[i].faceValue);
RepaymentFacet(address(invoiceDiamond)).processRepayment(allInvoices[i].id);
```

### Added Verification
Both scripts now verify that invoice status is correctly updated to `Paid` after repayment:
- `TestWorkflow.s.sol`: Checks single invoice status
- `TestWorkflowExtensive.s.sol`: Verifies all 20 invoices have `Paid` status

## Testing

To test the fix, restart Anvil and run the test workflow:

```bash
# Terminal 1: Start fresh Anvil
anvil --block-time 1

# Terminal 2: Run test workflow
cd contracts
forge script script/TestWorkflowExtensive.s.sol --rpc-url http://localhost:8545 --broadcast
```

After running, verify:
1. All invoices show `status = Paid` in the Diamond
2. Frontend history page shows correct "Paid" status
3. No more "Funded" invoices with "Buyer Repaid" in ExecutionPool

## Architecture Notes

The repayment flow MUST go through the Diamond because:
1. `RepaymentFacet.processRepayment()` updates the invoice status and timestamps
2. It maintains the Diamond's `activeInvoiceCount` and `totalRepaid` stats
3. It then delegates to `ExecutionPool.receiveRepayment()` to handle fund routing

Never call `ExecutionPool.repayInvoice()` directly for normal operations - it exists for emergency/admin scenarios only.
