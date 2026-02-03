'use client';

import Link from 'next/link';
import { Plus, FileText, Search } from 'lucide-react';
import { Card, CardHeader, CardTitle, Input, Button, Badge } from '@/components/ui';
import { RequestFundingButton } from '@/components/supplier/RequestFundingButton';
import { useAccount } from 'wagmi';
import { useSupplierInvoices, InvoiceStatus, InvoiceStatusLabels } from '@/hooks';
import { formatUSDC } from '@/lib/formatters';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export default function SupplierInvoicesPage() {
  const { address } = useAccount();
  const { data: invoices, isLoading, refetch } = useSupplierInvoices(address);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const handleFundingSuccess = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['poolState'] });
  };

  // Filter invoices
  const filteredInvoices = invoices?.filter((inv) => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!inv.id.toString().includes(query)) return false;
    }
    return true;
  }) ?? [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-white">My Invoices</h1>
          <p className="text-body text-cool-gray mt-1">
            View and manage all your invoices
          </p>
        </div>
        <Link href="/dashboard/supplier/invoices/create">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Invoice
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4 p-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cool-gray" />
            <Input
              type="text"
              placeholder="Search by invoice ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={statusFilter === 'all' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              All
            </Button>
            <Button
              variant={statusFilter === InvoiceStatus.Pending ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setStatusFilter(InvoiceStatus.Pending)}
            >
              Pending
            </Button>
            <Button
              variant={statusFilter === InvoiceStatus.Approved ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setStatusFilter(InvoiceStatus.Approved)}
            >
              Awaiting Approval
            </Button>
            <Button
              variant={statusFilter === InvoiceStatus.FundingApproved ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setStatusFilter(InvoiceStatus.FundingApproved)}
            >
              Ready to Fund
            </Button>
            <Button
              variant={statusFilter === InvoiceStatus.Funded ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setStatusFilter(InvoiceStatus.Funded)}
            >
              Funded
            </Button>
            <Button
              variant={statusFilter === InvoiceStatus.Paid ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setStatusFilter(InvoiceStatus.Paid)}
            >
              Paid
            </Button>
          </div>
        </div>
      </Card>

      {/* Invoice List */}
      <Card>
        <CardHeader>
          <CardTitle>Invoices ({filteredInvoices.length})</CardTitle>
        </CardHeader>

        {isLoading ? (
          <div className="p-6 pt-0 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-slate-700/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="w-12 h-12 text-cool-gray mx-auto mb-4" />
            <p className="text-white text-body mb-2">No invoices found</p>
            <p className="text-cool-gray text-body-sm mb-4">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first invoice to get started'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <Link href="/dashboard/supplier/invoices/create">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Invoice
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-body-sm text-cool-gray font-medium p-4">ID</th>
                  <th className="text-left text-body-sm text-cool-gray font-medium p-4">Buyer</th>
                  <th className="text-right text-body-sm text-cool-gray font-medium p-4">Face Value</th>
                  <th className="text-right text-body-sm text-cool-gray font-medium p-4">Funding</th>
                  <th className="text-left text-body-sm text-cool-gray font-medium p-4">Maturity</th>
                  <th className="text-left text-body-sm text-cool-gray font-medium p-4">Status</th>
                  <th className="text-right text-body-sm text-cool-gray font-medium p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => {
                  const maturityDate = new Date(Number(invoice.maturityDate) * 1000);
                  const isOverdue = invoice.status === InvoiceStatus.Funded && maturityDate < new Date();

                  return (
                    <tr
                      key={invoice.id.toString()}
                      className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="p-4">
                        <span className="text-white text-body">#{invoice.id.toString()}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-cool-gray text-body-sm font-mono">
                          {invoice.buyer.slice(0, 6)}...{invoice.buyer.slice(-4)}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-white text-body">
                          {formatUSDC(invoice.faceValue)}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-success text-body">
                          {invoice.fundingAmount > 0n
                            ? formatUSDC(invoice.fundingAmount)
                            : '-'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`text-body-sm ${isOverdue ? 'text-error' : 'text-cool-gray'}`}>
                          {maturityDate.toLocaleDateString()}
                        </span>
                      </td>
                      <td className="p-4">
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {invoice.status === InvoiceStatus.FundingApproved && (
                            <RequestFundingButton
                              invoice={invoice}
                              onSuccess={handleFundingSuccess}
                            />
                          )}
                          <Link
                            href={`/dashboard/supplier/invoices/${invoice.id}`}
                            className="text-primary hover:underline text-body-sm"
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const variants: Record<InvoiceStatus, 'warning' | 'info' | 'success' | 'error' | 'default'> = {
    [InvoiceStatus.Pending]: 'warning',
    [InvoiceStatus.Approved]: 'info',
    [InvoiceStatus.FundingApproved]: 'info',
    [InvoiceStatus.Funded]: 'success',
    [InvoiceStatus.Paid]: 'success',
    [InvoiceStatus.Cancelled]: 'default',
    [InvoiceStatus.Defaulted]: 'error',
  };

  return (
    <Badge variant={variants[status]}>
      {InvoiceStatusLabels[status]}
    </Badge>
  );
}
