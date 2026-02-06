'use client';

import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/layout';
import { Card, Button, Skeleton } from '@/components/ui';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@/components/wallet';
import { Download, FileCheck, Clock, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatUSDC, formatDate, formatAddress } from '@/lib/formatters';
import { useBuyerApprovedInvoices, useBuyerPaidInvoices } from '@/hooks';
import { InvoiceStatusBadge } from '@/components/operator/InvoiceStatusBadge';
import { InvoiceStatus } from '@/hooks/invoice/useInvoice';
import type { Invoice } from '@/hooks/invoice/useInvoice';

type FilterType = 'all' | 'approved' | 'paid';

const ITEMS_PER_PAGE = 10;

export default function BuyerHistoryPage() {
  const { address, isConnected } = useAccount();
  const [filter, setFilter] = useState<FilterType>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const {
    data: approvedInvoices,
    isLoading: approvedLoading,
    count: approvedCount,
    totalApproved,
  } = useBuyerApprovedInvoices(address);

  const {
    data: paidInvoices,
    isLoading: paidLoading,
    count: paidCount,
    totalPaid,
  } = useBuyerPaidInvoices(address);

  const isLoading = approvedLoading || paidLoading;

  // Combine and filter invoices based on selection
  const filteredInvoices = useMemo(() => {
    if (filter === 'approved') {
      return approvedInvoices.filter(inv => inv.status !== InvoiceStatus.Paid);
    }
    if (filter === 'paid') {
      return paidInvoices;
    }
    // All: combine both lists, sorted by most recent
    return approvedInvoices.sort((a, b) => Number(b.createdAt - a.createdAt));
  }, [filter, approvedInvoices, paidInvoices]);

  // Pagination
  const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE);
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredInvoices.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredInvoices, currentPage]);

  // Reset page when filter changes
  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  // Get display date based on invoice status
  const getDisplayDate = (invoice: Invoice): number => {
    if (invoice.status === InvoiceStatus.Paid && invoice.paidAt > 0n) {
      return Number(invoice.paidAt);
    }
    return Number(invoice.createdAt);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredInvoices.length === 0) return;

    const headers = ['Invoice ID', 'Status', 'Supplier', 'Face Value', 'Date'];
    const rows = filteredInvoices.map((inv) => [
      inv.id.toString(),
      InvoiceStatus[inv.status],
      inv.supplier,
      formatUSDC(inv.faceValue),
      formatDate(getDisplayDate(inv)),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `buyer-invoice-history-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title="Invoice History"
          description="View your approved and paid invoices"
          backHref="/dashboard/buyer"
        />
        <Card className="text-center py-12">
          <p className="text-cool-gray mb-4">Connect your wallet to view history</p>
          <ConnectButton />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoice History"
        description="View your approved and paid invoices"
        backHref="/dashboard/buyer"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-success" />
            <span className="text-body-sm text-cool-gray">Total Approved</span>
          </div>
          <p className="text-lg font-mono text-white">
            {isLoading ? <Skeleton className="h-6 w-20" /> : formatUSDC(totalApproved)}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <FileCheck className="w-4 h-4 text-primary" />
            <span className="text-body-sm text-cool-gray">Total Paid</span>
          </div>
          <p className="text-lg font-mono text-white">
            {isLoading ? <Skeleton className="h-6 w-20" /> : formatUSDC(totalPaid)}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-warning" />
            <span className="text-body-sm text-cool-gray">Approved Count</span>
          </div>
          <p className="text-lg font-mono text-white">
            {isLoading ? <Skeleton className="h-6 w-12" /> : approvedCount}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-success" />
            <span className="text-body-sm text-cool-gray">Paid Count</span>
          </div>
          <p className="text-lg font-mono text-white">
            {isLoading ? <Skeleton className="h-6 w-12" /> : paidCount}
          </p>
        </Card>
      </div>

      {/* Filters and Export */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body-sm text-cool-gray">Filter:</span>
          {(['all', 'approved', 'paid'] as FilterType[]).map((type) => (
            <button
              key={type}
              onClick={() => handleFilterChange(type)}
              className={`px-3 py-1.5 text-body-sm font-medium rounded-md transition-colors ${
                filter === type
                  ? 'bg-primary text-white'
                  : 'bg-slate-700 text-cool-gray hover:text-white'
              }`}
            >
              {type === 'all' ? 'All' : type === 'approved' ? 'Approved' : 'Paid'}
            </button>
          ))}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExportCSV}
          disabled={filteredInvoices.length === 0}
          leftIcon={<Download className="w-4 h-4" />}
        >
          Export CSV
        </Button>
      </div>

      {/* Invoice List */}
      <Card padding="none">
        {isLoading ? (
          <div className="divide-y divide-slate-700">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="w-8 h-8 rounded-lg" />
                    <div>
                      <Skeleton className="h-5 w-24 mb-1" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-4 w-20 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {paginatedInvoices.map((invoice) => (
              <div
                key={invoice.id.toString()}
                className="p-4 hover:bg-slate-700/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        invoice.status === InvoiceStatus.Paid
                          ? 'bg-success/10'
                          : 'bg-primary/10'
                      }`}
                    >
                      {invoice.status === InvoiceStatus.Paid ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : (
                        <FileCheck className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="text-body font-medium text-white">
                        Invoice #{invoice.id.toString()}
                      </p>
                      <p className="text-body-sm text-cool-gray mt-0.5">
                        Supplier: {formatAddress(invoice.supplier)}
                      </p>
                      <div className="mt-1">
                        <InvoiceStatusBadge status={invoice.status} size="sm" />
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-body font-mono text-white">
                      {formatUSDC(invoice.faceValue)}
                    </p>
                    <p className="text-body-sm text-cool-gray mt-0.5">
                      {formatDate(getDisplayDate(invoice))}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && filteredInvoices.length === 0 && (
          <div className="p-12 text-center">
            <Clock className="w-8 h-8 text-cool-gray mx-auto mb-3" />
            <p className="text-cool-gray mb-1">No invoices found</p>
            <p className="text-body-sm text-silver">
              {filter === 'all'
                ? 'Your invoice history will appear here'
                : `No ${filter} invoices to display`}
            </p>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {!isLoading && filteredInvoices.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-body-sm text-cool-gray">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredInvoices.length)} of{' '}
            {filteredInvoices.length}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-body-sm text-cool-gray px-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
