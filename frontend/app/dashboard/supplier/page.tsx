'use client';

import Link from 'next/link';
import { FileText, Plus, Clock, CheckCircle, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, MetricSkeleton } from '@/components/ui';
import { useAccount } from 'wagmi';
import { useSupplierInvoices, InvoiceStatus } from '@/hooks';
import { formatCurrency } from '@/lib/formatters';

export default function SupplierDashboard() {
  const { address } = useAccount();
  const { data: invoices, isLoading } = useSupplierInvoices(address);

  // Calculate metrics
  const totalInvoices = invoices?.length ?? 0;
  const pendingCount = invoices?.filter(inv => inv.status === InvoiceStatus.Pending).length ?? 0;
  const fundedCount = invoices?.filter(inv => inv.status === InvoiceStatus.Funded).length ?? 0;
  const totalFunded = invoices
    ?.filter(inv => inv.status === InvoiceStatus.Funded || inv.status === InvoiceStatus.Paid)
    .reduce((sum, inv) => sum + inv.fundingAmount, 0n) ?? 0n;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-white">Supplier Dashboard</h1>
          <p className="text-body text-cool-gray mt-1">
            Manage your invoices and track early payments
          </p>
        </div>
        <Link
          href="/dashboard/supplier/invoices/create"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Invoice
        </Link>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-body-sm text-cool-gray">Total Invoices</CardTitle>
          </CardHeader>
          {isLoading ? (
            <MetricSkeleton />
          ) : (
            <p className="text-h2 text-white px-6 pb-4">{totalInvoices}</p>
          )}
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-body-sm text-cool-gray">Pending Approval</CardTitle>
          </CardHeader>
          {isLoading ? (
            <MetricSkeleton />
          ) : (
            <p className="text-h2 text-warning px-6 pb-4">{pendingCount}</p>
          )}
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-body-sm text-cool-gray">Funded Invoices</CardTitle>
          </CardHeader>
          {isLoading ? (
            <MetricSkeleton />
          ) : (
            <p className="text-h2 text-success px-6 pb-4">{fundedCount}</p>
          )}
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-body-sm text-cool-gray">Total Received</CardTitle>
          </CardHeader>
          {isLoading ? (
            <MetricSkeleton />
          ) : (
            <p className="text-h2 text-white px-6 pb-4">{formatCurrency(totalFunded, 6)}</p>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <div className="space-y-3 p-6 pt-0">
          <Link
            href="/dashboard/supplier/invoices/create"
            className="flex items-center gap-4 p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors group"
          >
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-body font-medium text-white">Create New Invoice</p>
              <p className="text-body-sm text-cool-gray">Submit an invoice for early payment</p>
            </div>
            <ArrowRight className="w-5 h-5 text-cool-gray group-hover:text-white transition-colors" />
          </Link>

          <Link
            href="/dashboard/supplier/invoices"
            className="flex items-center gap-4 p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors group"
          >
            <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-success" />
            </div>
            <div className="flex-1">
              <p className="text-body font-medium text-white">View All Invoices</p>
              <p className="text-body-sm text-cool-gray">Track status and payment history</p>
            </div>
            <ArrowRight className="w-5 h-5 text-cool-gray group-hover:text-white transition-colors" />
          </Link>
        </div>
      </Card>

      {/* Recent Invoices */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
          <Link
            href="/dashboard/supplier/invoices"
            className="text-body-sm text-primary hover:underline"
          >
            View All
          </Link>
        </CardHeader>
        {isLoading ? (
          <div className="p-6 pt-0 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-700/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !invoices || invoices.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-cool-gray text-body-sm">No invoices yet</p>
            <Link
              href="/dashboard/supplier/invoices/create"
              className="text-primary hover:underline text-body-sm mt-2 inline-block"
            >
              Create your first invoice
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {invoices.slice(0, 5).map((invoice) => (
              <Link
                key={invoice.id.toString()}
                href={`/dashboard/supplier/invoices/${invoice.id}`}
                className="flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <StatusIcon status={invoice.status} />
                  <div>
                    <p className="text-body text-white">Invoice #{invoice.id.toString()}</p>
                    <p className="text-body-sm text-cool-gray">
                      {formatCurrency(invoice.faceValue, 6)} USDC
                    </p>
                  </div>
                </div>
                <StatusBadge status={invoice.status} />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatusIcon({ status }: { status: InvoiceStatus }) {
  switch (status) {
    case InvoiceStatus.Pending:
      return <Clock className="w-5 h-5 text-warning" />;
    case InvoiceStatus.Approved:
    case InvoiceStatus.Funded:
    case InvoiceStatus.Paid:
      return <CheckCircle className="w-5 h-5 text-success" />;
    default:
      return <FileText className="w-5 h-5 text-cool-gray" />;
  }
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const styles: Record<InvoiceStatus, string> = {
    [InvoiceStatus.Pending]: 'bg-warning/10 text-warning',
    [InvoiceStatus.Approved]: 'bg-blue-500/10 text-blue-400',
    [InvoiceStatus.Funded]: 'bg-success/10 text-success',
    [InvoiceStatus.Paid]: 'bg-emerald-500/10 text-emerald-400',
    [InvoiceStatus.Cancelled]: 'bg-slate-500/10 text-slate-400',
    [InvoiceStatus.Defaulted]: 'bg-error/10 text-error',
  };

  const labels: Record<InvoiceStatus, string> = {
    [InvoiceStatus.Pending]: 'Pending',
    [InvoiceStatus.Approved]: 'Approved',
    [InvoiceStatus.Funded]: 'Funded',
    [InvoiceStatus.Paid]: 'Paid',
    [InvoiceStatus.Cancelled]: 'Cancelled',
    [InvoiceStatus.Defaulted]: 'Defaulted',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-body-sm ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
