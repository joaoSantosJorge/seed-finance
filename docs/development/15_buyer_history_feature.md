# Buyer Invoice History Feature

## Overview
Added a detailed invoice approval and repayment history page to the buyer dashboard at `/dashboard/buyer/history`. This allows buyers to view their complete invoice history with filtering, pagination, and CSV export capabilities.

## Changes Made

### New Files
| File | Purpose |
|------|---------|
| `frontend/app/dashboard/buyer/history/page.tsx` | History page with filters, pagination, and export |

### Modified Files
| File | Change |
|------|--------|
| `frontend/hooks/invoice/useInvoiceList.ts` | Added `useBuyerApprovedInvoices` and `useBuyerPaidInvoices` hooks |
| `frontend/lib/config/navigation.ts` | Added "HISTORY" nav item to `buyerNavigation` |

## How It Works

### New Hooks

**`useBuyerApprovedInvoices(buyerAddress)`**
- Filters buyer invoices to show all approved invoices (status >= Approved, excluding Cancelled)
- Returns invoices sorted by creation date (most recent first)
- Provides total approved count and sum of face values

**`useBuyerPaidInvoices(buyerAddress)`**
- Filters buyer invoices to show only paid invoices (status === Paid)
- Returns invoices sorted by paid date (most recent first)
- Provides total paid count and sum of face values

### History Page Features

1. **Summary Metrics** - 4 cards showing:
   - Total Approved (USDC value)
   - Total Paid (USDC value)
   - Approved Count
   - Paid Count

2. **Filter Tabs** - Filter invoices by:
   - All (combined view)
   - Approved (excludes paid)
   - Paid only

3. **Paginated List** - 10 items per page with navigation controls

4. **Invoice Details** - Each row shows:
   - Invoice ID
   - Status badge
   - Supplier address (truncated)
   - Face value
   - Date (paidAt for paid invoices, createdAt for others)

5. **CSV Export** - Downloads filtered invoice data

### Navigation
Added to buyer sidebar as 4th item with keyboard shortcut "4" and mobile label "LOG".

## Testing

1. **Navigation**: Click "HISTORY" in buyer sidebar - should load history page
2. **Summary Cards**: Verify totals match filtered invoice counts/values
3. **Filters**: Click each filter - list should update correctly
4. **Pagination**: Navigate pages if >10 invoices
5. **Export**: Click export - CSV should download with correct data
6. **Empty State**: Test with wallet that has no history
7. **Mobile**: Verify responsive layout on small screens

## Related Files
- `frontend/hooks/invoice/useInvoice.ts` - Invoice types and status enum
- `frontend/components/operator/InvoiceStatusBadge.tsx` - Status badge component
- `frontend/lib/formatters.ts` - `formatUSDC`, `formatDate`, `formatAddress`
- `frontend/app/dashboard/financier/transactions/page.tsx` - Pattern reference for similar history UI
