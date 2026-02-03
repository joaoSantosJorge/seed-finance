# 06 - Operator Dashboard Implementation

## Overview

The operator dashboard provides a comprehensive admin interface for managing Seed Finance operations, including direct invoice funding via `ExecutionPool.fundInvoice()`, pool administration, treasury management, and contract configuration.

## Features Implemented

### 1. Core Infrastructure

- **ExecutionPool ABI** (`frontend/abis/ExecutionPool.ts`)
  - `fundInvoice(invoiceId, supplier, fundingAmount, faceValue)` - Direct funding
  - `getFundingRecord(invoiceId)` - View funding records
  - `getStats()` - Pool statistics
  - Events: `InvoiceFunded`, `RepaymentReceived`, `YieldReturned`

- **useExecutionPool Hook** (`frontend/hooks/operator/useExecutionPool.ts`)
  - `useFundInvoice()` - Execute funding transactions
  - `useExecutionPoolStats()` - Read pool statistics
  - `useFundingRecord(invoiceId)` - Get funding record for invoice
  - `useIsInvoiceFunded(invoiceId)` - Check funding status

- **OperatorGuard Component** (`frontend/components/operator/OperatorGuard.tsx`)
  - Access control wrapper for operator pages
  - Supports `requireOwner` prop for owner-only sections
  - Shows loading/access denied states

### 2. Invoice Management

- **Invoice Table** (`frontend/components/operator/InvoiceTable.tsx`)
  - Paginated table with all invoices
  - Filterable by status
  - Selectable for batch operations
  - Direct links to fund/view actions

- **Invoice Status Badge** (`frontend/components/operator/InvoiceStatusBadge.tsx`)
  - Visual indicators for: Pending, Approved, Funded, Paid, Cancelled, Defaulted

- **Fund Invoice Form** (`frontend/components/operator/FundInvoiceForm.tsx`)
  - Direct `ExecutionPool.fundInvoice()` integration
  - Shows calculated funding amount (face value - discount)
  - Manual amount override option
  - Liquidity check before funding
  - Confirmation modal

- **Batch Fund Modal** (`frontend/components/operator/BatchFundModal.tsx`)
  - Fund multiple approved invoices sequentially
  - Progress tracking per invoice
  - Error handling with continue capability

### 3. Overview Dashboard

- **System Health Card** (`frontend/components/operator/SystemHealthCard.tsx`)
  - Pool status (Active/Paused)
  - Total assets, available liquidity, utilization
  - Pending funding count
  - Overdue invoice alerts

- **Overview Page** (`frontend/app/dashboard/operator/page.tsx`)
  - Quick actions: Fund All, Pause/Unpause Pool
  - Pending funding and overdue alerts
  - Recent invoices preview
  - Navigation to all sections

### 4. Pool Administration

- **Pool Status Card** (`frontend/components/operator/PoolStatusCard.tsx`)
  - Pause/Unpause pool operations
  - Confirmation for dangerous actions

- **Pool Config Form** (`frontend/components/operator/PoolConfigForm.tsx`)
  - Set liquidity buffer
  - Set max treasury allocation

- **Emergency Withdraw Form** (`frontend/components/operator/EmergencyWithdrawForm.tsx`)
  - Owner-only emergency withdrawal
  - Type-to-confirm safety check

### 5. Treasury Management

- **Treasury Card** (`frontend/components/operator/TreasuryCard.tsx`)
  - Current treasury balance
  - Allocation rate visualization
  - Rebalance availability indicator

- **Treasury Actions Form** (`frontend/components/operator/TreasuryActionsForm.tsx`)
  - Deposit to treasury
  - Withdraw from treasury
  - Rebalance to optimal
  - Accrue yield

### 6. Contract Configuration

- **Contract Addresses Card** (`frontend/components/operator/ContractAddressesCard.tsx`)
  - Display all contract addresses
  - Copy to clipboard
  - Explorer links

- **Operator Management Form** (`frontend/components/operator/OperatorManagementForm.tsx`)
  - Add/remove operators
  - Transfer ownership (with type-to-confirm)

## Directory Structure

```
frontend/
├── abis/
│   └── ExecutionPool.ts           # NEW
│
├── app/dashboard/operator/
│   ├── layout.tsx                 # NEW - Operator layout with guard
│   ├── page.tsx                   # NEW - Overview dashboard
│   ├── invoices/
│   │   ├── page.tsx               # NEW - Invoice management
│   │   └── [id]/page.tsx          # NEW - Invoice detail + fund
│   ├── pool/page.tsx              # NEW - Pool administration
│   ├── treasury/page.tsx          # NEW - Treasury management
│   └── config/page.tsx            # NEW - Contract configuration
│
├── components/operator/
│   ├── index.ts                   # UPDATED - All exports
│   ├── ConfirmActionModal.tsx     # Existing
│   ├── PoolStatusCard.tsx         # Existing
│   ├── PoolConfigForm.tsx         # Existing
│   ├── OperatorGuard.tsx          # NEW
│   ├── SystemHealthCard.tsx       # NEW
│   ├── InvoiceTable.tsx           # NEW
│   ├── InvoiceStatusBadge.tsx     # NEW
│   ├── FundInvoiceForm.tsx        # NEW
│   ├── BatchFundModal.tsx         # NEW
│   ├── TreasuryCard.tsx           # NEW
│   ├── TreasuryActionsForm.tsx    # NEW
│   ├── ContractAddressesCard.tsx  # NEW
│   ├── OperatorManagementForm.tsx # NEW
│   └── EmergencyWithdrawForm.tsx  # NEW
│
└── hooks/operator/
    ├── index.ts                   # UPDATED - Added useExecutionPool
    └── useExecutionPool.ts        # NEW - Direct ExecutionPool calls
```

## Key Usage: Direct Invoice Funding

The critical feature is direct `ExecutionPool.fundInvoice()` calls:

```typescript
// Using the hook
const { fundInvoice, isPending, isSuccess } = useFundInvoice();

// Call with parameters
fundInvoice(
  invoiceId,       // uint256 - Invoice ID
  supplierAddress, // address - Supplier to receive funds
  fundingAmount,   // uint128 - Amount after discount (USDC, 6 decimals)
  faceValue        // uint128 - Full invoice amount for tracking
);

// Equivalent to CLI:
// cast send <EXECUTION_POOL> "fundInvoice(uint256,address,uint128,uint128)" \
//   1 0x... 9958904109 10000000000
```

## Access Control

| Feature | Operator | Owner |
|---------|----------|-------|
| View invoices | ✓ | ✓ |
| Fund invoices | ✓ | ✓ |
| Pause/Unpause pool | ✓ | ✓ |
| Set pool config | ✓ | ✓ |
| Treasury operations | ✓ | ✓ |
| Emergency withdraw | ✗ | ✓ |
| Manage operators | ✗ | ✓ |
| Transfer ownership | ✗ | ✓ |
| Update addresses | ✗ | ✓ |

## Security Features

1. **Confirmation Modals** - All write operations require confirmation
2. **Type-to-Confirm** - Dangerous actions (emergency withdraw, ownership transfer) require typing specific text
3. **Role Checks** - Actions disabled with tooltips for unauthorized users
4. **Liquidity Checks** - Funding disabled if insufficient liquidity
5. **Status Validation** - Only approved invoices can be funded

## Testing

1. Connect wallet with operator role
2. Navigate to `/dashboard/operator`
3. View system health metrics
4. Go to Invoices tab, filter by "Approved"
5. Select an invoice and click "Fund"
6. Verify funding parameters and confirm
7. Check pool and treasury pages for admin operations
