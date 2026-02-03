# Operator Funding Approval Step

## Summary

This feature adds a new `FundingApproved` status between `Approved` and `Funded` to introduce an operator funding approval step before suppliers can request funding.

## Invoice Flow

**Previous Flow:**
```
Pending → Approved (buyer) → Funded → Paid
```

**New Flow:**
```
Pending → Approved (buyer) → FundingApproved (operator) → Funded → Paid
```

## Status Values

| Status | Value | Description |
|--------|-------|-------------|
| Pending | 0 | Created, awaiting buyer approval |
| Approved | 1 | Buyer approved, awaiting operator funding approval |
| FundingApproved | 2 | Operator approved, ready for funding |
| Funded | 3 | Funds sent to supplier |
| Paid | 4 | Buyer repaid, invoice complete |
| Cancelled | 5 | Cancelled by buyer or supplier |
| Defaulted | 6 | Overdue and marked as default |

## Smart Contract Changes

### LibInvoiceStorage.sol
- Added `FundingApproved` to the `InvoiceStatus` enum at position 2
- Shifted subsequent status values (Funded=3, Paid=4, Cancelled=5, Defaulted=6)

### FundingFacet.sol
- Added `FundingApprovalGranted` event
- Added `approveFunding(uint256 invoiceId)` - Single invoice approval
- Added `batchApproveFunding(uint256[] invoiceIds)` - Batch approval
- Added `canApproveFunding(uint256 invoiceId)` - Check if invoice can be approved
- Modified `requestFunding()` to require `FundingApproved` status
- Modified `supplierRequestFunding()` to require `FundingApproved` status
- Modified `batchFund()` to require `FundingApproved` status
- Modified `canFundInvoice()` to return true only for `FundingApproved` status

### ViewFacet.sol
- Added `getAwaitingFundingApproval()` - Returns invoices in `Approved` status
- Added `getReadyForFunding()` - Returns invoices in `FundingApproved` status

### IInvoiceDiamond.sol
- Added interface definitions for all new functions and events

## Frontend Changes

### Hooks
- Updated `InvoiceStatus` enum with `FundingApproved = 2`
- Updated `InvoiceStatusLabels` with new labels
- Added `useApproveFunding()` hook
- Added `useBatchApproveFunding()` hook
- Added `useAwaitingFundingApproval()` hook
- Added `useReadyForFunding()` hook
- Updated `useFundedInvoices()` and `useOverdueInvoices()` to use new status value (3)

### Operator Dashboard
- Added "Awaiting Approval" tab showing invoices with `Approved` status
- Added "Ready to Fund" tab showing invoices with `FundingApproved` status
- Added "Approve Selected" button for batch approval
- Updated "Fund Selected" to only work with `FundingApproved` invoices
- Added approve action button (checkmark) in InvoiceTable for `Approved` invoices
- Added fund action button (banknote) in InvoiceTable for `FundingApproved` invoices
- Created `BatchApproveModal` component

### Supplier Dashboard
- Added "Awaiting Approval" and "Ready to Fund" filter buttons
- Updated `RequestFundingButton` to only show for `FundingApproved` invoices

### ABI
- Added entries for new functions: `approveFunding`, `batchApproveFunding`, `canApproveFunding`, `getAwaitingFundingApproval`, `getReadyForFunding`
- Added `FundingApprovalGranted` event

## Test Coverage

All 431 tests pass including:
- `test_ApproveFunding_Success`
- `test_ApproveFunding_RevertNotOperator`
- `test_ApproveFunding_RevertNotApproved`
- `test_BatchApproveFunding_Success`
- `test_BatchApproveFunding_SkipsNonApproved`
- `test_CanApproveFunding_TrueForApproved`
- `test_CanApproveFunding_FalseForPending`
- `test_CanApproveFunding_FalseForFundingApproved`
- `test_RequestFunding_RequiresFundingApproved`
- `test_FullFlow_WithFundingApproval`

## Migration Notes

For testnet deployments, a fresh deployment is recommended.

For existing production data, a migration script would be needed to shift existing status values.

## Files Changed

### Contracts
- `contracts/src/invoice/libraries/LibInvoiceStorage.sol`
- `contracts/src/invoice/facets/FundingFacet.sol`
- `contracts/src/invoice/facets/ViewFacet.sol`
- `contracts/src/invoice/interfaces/IInvoiceDiamond.sol`
- `contracts/test/FundingFacet.t.sol`
- `contracts/test/RepaymentFacet.t.sol`
- `contracts/test/ViewFacet.t.sol`
- `contracts/test/integration/InvoiceLifecycle.t.sol`

### Frontend
- `frontend/hooks/invoice/useInvoice.ts`
- `frontend/hooks/invoice/useInvoiceActions.ts`
- `frontend/hooks/operator/useAllInvoices.ts`
- `frontend/abis/InvoiceDiamond.ts`
- `frontend/app/dashboard/operator/invoices/page.tsx`
- `frontend/app/dashboard/supplier/invoices/page.tsx`
- `frontend/components/operator/InvoiceTable.tsx`
- `frontend/components/operator/BatchFundModal.tsx`
- `frontend/components/operator/BatchApproveModal.tsx` (NEW)
- `frontend/components/operator/InvoiceStatusBadge.tsx`
- `frontend/components/operator/index.ts`
- `frontend/components/supplier/RequestFundingButton.tsx`
