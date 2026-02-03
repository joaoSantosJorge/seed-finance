'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import { useAllInvoices } from '@/hooks/operator';
import { InvoiceStatus, type Invoice } from '@/hooks/invoice/useInvoice';
import { formatCurrency, formatAddress } from '@/lib/formatters';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Banknote,
  CheckSquare,
  Square,
  CheckCircle,
} from 'lucide-react';

interface InvoiceTableProps {
  statusFilter?: InvoiceStatus;
  onSelectInvoices?: (invoices: Invoice[]) => void;
  selectable?: boolean;
  limit?: number;
  showViewAll?: boolean;
}

const PAGE_SIZE = 10;

export function InvoiceTable({
  statusFilter,
  onSelectInvoices,
  selectable = false,
  limit,
  showViewAll = false,
}: InvoiceTableProps) {
  const { data: invoices, isLoading } = useAllInvoices(statusFilter);
  const [selectedIds, setSelectedIds] = useState<Set<bigint>>(new Set());
  const [currentPage, setCurrentPage] = useState(0);

  // Apply limit if specified
  const displayInvoices = useMemo(() => {
    const sorted = [...invoices].sort((a, b) => Number(b.id - a.id));
    return limit ? sorted.slice(0, limit) : sorted;
  }, [invoices, limit]);

  // Pagination
  const totalPages = Math.ceil(displayInvoices.length / PAGE_SIZE);
  const paginatedInvoices = displayInvoices.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedInvoices.length) {
      setSelectedIds(new Set());
      onSelectInvoices?.([]);
    } else {
      const newSelected = new Set(paginatedInvoices.map((inv) => inv.id));
      setSelectedIds(newSelected);
      onSelectInvoices?.(paginatedInvoices.filter((inv) => newSelected.has(inv.id)));
    }
  };

  const handleSelectOne = (invoice: Invoice) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(invoice.id)) {
      newSelected.delete(invoice.id);
    } else {
      newSelected.add(invoice.id);
    }
    setSelectedIds(newSelected);
    onSelectInvoices?.(invoices.filter((inv) => newSelected.has(inv.id)));
  };

  const formatDate = (timestamp: bigint) => {
    if (timestamp === 0n) return '-';
    return new Date(Number(timestamp) * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isOverdue = (invoice: Invoice) => {
    return (
      invoice.status === InvoiceStatus.Funded &&
      BigInt(Math.floor(Date.now() / 1000)) > invoice.maturityDate
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (displayInvoices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <div className="py-8 text-center">
          <p className="text-cool-gray text-body">No invoices found</p>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="none">
      <div className="p-6 pb-4 border-b-2 border-[var(--border-color)]">
        <div className="flex items-center justify-between">
          <CardTitle>
            Invoices{' '}
            <span className="text-cool-gray font-normal text-sm">
              ({displayInvoices.length})
            </span>
          </CardTitle>
          {showViewAll && (
            <Link href="/dashboard/operator/invoices" className="text-body-sm text-[var(--text-primary)] hover:underline">
              View All
            </Link>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-[var(--border-color)] bg-[var(--bg-secondary)]">
              {selectable && (
                <th className="px-4 py-3 text-left w-12">
                  <button
                    onClick={handleSelectAll}
                    className="text-cool-gray hover:text-white transition-colors"
                  >
                    {selectedIds.size === paginatedInvoices.length ? (
                      <CheckSquare className="w-5 h-5" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                </th>
              )}
              <th className="px-4 py-3 text-left text-body-sm text-cool-gray uppercase tracking-wider font-bold">
                ID
              </th>
              <th className="px-4 py-3 text-left text-body-sm text-cool-gray uppercase tracking-wider font-bold">
                Status
              </th>
              <th className="px-4 py-3 text-left text-body-sm text-cool-gray uppercase tracking-wider font-bold">
                Supplier
              </th>
              <th className="px-4 py-3 text-left text-body-sm text-cool-gray uppercase tracking-wider font-bold">
                Buyer
              </th>
              <th className="px-4 py-3 text-right text-body-sm text-cool-gray uppercase tracking-wider font-bold">
                Face Value
              </th>
              <th className="px-4 py-3 text-right text-body-sm text-cool-gray uppercase tracking-wider font-bold">
                Funding Amt
              </th>
              <th className="px-4 py-3 text-left text-body-sm text-cool-gray uppercase tracking-wider font-bold">
                Maturity
              </th>
              <th className="px-4 py-3 text-center text-body-sm text-cool-gray uppercase tracking-wider font-bold">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedInvoices.map((invoice) => (
              <tr
                key={invoice.id.toString()}
                className={`border-b border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-colors ${
                  isOverdue(invoice) ? 'bg-red-500/5' : ''
                }`}
              >
                {selectable && (
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleSelectOne(invoice)}
                      className="text-cool-gray hover:text-white transition-colors"
                    >
                      {selectedIds.has(invoice.id) ? (
                        <CheckSquare className="w-5 h-5 text-[var(--text-primary)]" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </td>
                )}
                <td className="px-4 py-3">
                  <span className="font-mono text-white">#{invoice.id.toString()}</span>
                </td>
                <td className="px-4 py-3">
                  <InvoiceStatusBadge status={invoice.status} size="sm" />
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-body-sm text-cool-gray">
                    {formatAddress(invoice.supplier)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-body-sm text-cool-gray">
                    {formatAddress(invoice.buyer)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-mono text-white">
                    {formatCurrency(Number(invoice.faceValue) / 1e6)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-mono text-cool-gray">
                    {invoice.fundingAmount > 0n
                      ? formatCurrency(Number(invoice.fundingAmount) / 1e6)
                      : '-'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-body-sm ${isOverdue(invoice) ? 'text-red-500' : 'text-cool-gray'}`}>
                    {formatDate(invoice.maturityDate)}
                    {isOverdue(invoice) && ' (Overdue)'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <Link
                      href={`/dashboard/operator/invoices/${invoice.id.toString()}`}
                      className="p-2 text-cool-gray hover:text-white transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    {invoice.status === InvoiceStatus.Approved && (
                      <Link
                        href={`/dashboard/operator/invoices/${invoice.id.toString()}?action=approve`}
                        className="p-2 text-blue-400 hover:text-white transition-colors"
                        title="Approve Funding"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Link>
                    )}
                    {invoice.status === InvoiceStatus.FundingApproved && (
                      <Link
                        href={`/dashboard/operator/invoices/${invoice.id.toString()}?action=fund`}
                        className="p-2 text-[var(--text-primary)] hover:text-white transition-colors"
                        title="Fund Invoice"
                      >
                        <Banknote className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!limit && totalPages > 1 && (
        <div className="p-4 border-t-2 border-[var(--border-color)] flex items-center justify-between">
          <p className="text-body-sm text-cool-gray">
            Showing {currentPage * PAGE_SIZE + 1} -{' '}
            {Math.min((currentPage + 1) * PAGE_SIZE, displayInvoices.length)} of{' '}
            {displayInvoices.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-body-sm text-white px-2">
              {currentPage + 1} / {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage === totalPages - 1}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
