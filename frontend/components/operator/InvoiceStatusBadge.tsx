'use client';

import { Badge } from '@/components/ui/Badge';
import { InvoiceStatus, InvoiceStatusLabels } from '@/hooks/invoice/useInvoice';

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
  size?: 'sm' | 'md';
}

export function InvoiceStatusBadge({ status, size = 'md' }: InvoiceStatusBadgeProps) {
  const getVariant = (status: InvoiceStatus) => {
    switch (status) {
      case InvoiceStatus.Pending:
        return 'warning';
      case InvoiceStatus.Approved:
        return 'info';
      case InvoiceStatus.FundingApproved:
        return 'info';
      case InvoiceStatus.Funded:
        return 'success';
      case InvoiceStatus.Paid:
        return 'success';
      case InvoiceStatus.Cancelled:
        return 'error';
      case InvoiceStatus.Defaulted:
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Badge variant={getVariant(status)} size={size}>
      {InvoiceStatusLabels[status] || 'Unknown'}
    </Badge>
  );
}
