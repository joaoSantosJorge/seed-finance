'use client';

import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { InvoiceStatusBadge } from '@/components/operator';
import { RequestFundingButton } from '@/components/supplier/RequestFundingButton';
import { useInvoice, InvoiceStatus } from '@/hooks/invoice/useInvoice';
import { useFundingRecord, useIsInvoiceFunded } from '@/hooks/operator/useExecutionPool';
import { formatCurrency, formatAddress } from '@/lib/formatters';
import { ArrowLeft, User, Building2, Calendar, Clock, CheckCircle, XCircle, Circle } from 'lucide-react';

export default function SupplierInvoiceDetailPage() {
  const params = useParams();

  const invoiceId = useMemo(() => {
    try {
      return BigInt(params.id as string);
    } catch {
      return undefined;
    }
  }, [params.id]);

  const { data: invoice, isLoading: invoiceLoading, refetch } = useInvoice(invoiceId);
  const { data: fundingRecord, isLoading: fundingLoading } = useFundingRecord(invoiceId);
  const { data: isFunded } = useIsInvoiceFunded(invoiceId);

  const isLoading = invoiceLoading || fundingLoading;

  if (!invoiceId) {
    return (
      <div className="text-center py-12">
        <p className="text-cool-gray">Invalid invoice ID</p>
        <Link href="/dashboard/supplier/invoices">
          <Button variant="secondary" className="mt-4">
            Back to Invoices
          </Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-cool-gray">Invoice not found</p>
        <Link href="/dashboard/supplier/invoices">
          <Button variant="secondary" className="mt-4">
            Back to Invoices
          </Button>
        </Link>
      </div>
    );
  }

  const formatDate = (timestamp: bigint) => {
    if (timestamp === 0n) return '-';
    return new Date(Number(timestamp) * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Back Navigation */}
      <Link
        href="/dashboard/supplier/invoices"
        className="inline-flex items-center gap-2 text-cool-gray hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Invoices
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-h2 text-white">Invoice #{invoiceId.toString()}</h2>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        {/* Request Funding Button - shown when FundingApproved */}
        {invoice.status === InvoiceStatus.FundingApproved && (
          <RequestFundingButton invoice={invoice} onSuccess={refetch} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoice Details */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
          </CardHeader>

          <div className="space-y-4">
            {/* Parties */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-cool-gray" />
                  <span className="text-body-sm text-cool-gray uppercase tracking-wider">
                    Supplier (You)
                  </span>
                </div>
                <p className="font-mono text-white text-sm">{formatAddress(invoice.supplier)}</p>
              </div>
              <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-cool-gray" />
                  <span className="text-body-sm text-cool-gray uppercase tracking-wider">
                    Buyer
                  </span>
                </div>
                <p className="font-mono text-white text-sm">{formatAddress(invoice.buyer)}</p>
              </div>
            </div>

            {/* Financial Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
                <p className="text-body-sm text-cool-gray uppercase tracking-wider mb-1">
                  Face Value
                </p>
                <p className="text-h3 text-white font-mono">
                  {formatCurrency(Number(invoice.faceValue) / 1e6)}
                </p>
              </div>
              <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
                <p className="text-body-sm text-cool-gray uppercase tracking-wider mb-1">
                  Discount Rate
                </p>
                <p className="text-h3 text-white">{invoice.discountRateBps / 100}% APR</p>
              </div>
            </div>

            {/* Dates */}
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cool-gray" />
                  <span className="text-body text-cool-gray">Created</span>
                </div>
                <span className="text-body text-white">{formatDate(invoice.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cool-gray" />
                  <span className="text-body text-cool-gray">Maturity</span>
                </div>
                <span className="text-body text-white">{formatDate(invoice.maturityDate)}</span>
              </div>
              {invoice.fundedAt > 0n && (
                <div className="flex items-center justify-between py-2 border-b border-[var(--border-color)]">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-body text-cool-gray">Funded</span>
                  </div>
                  <span className="text-body text-white">{formatDate(invoice.fundedAt)}</span>
                </div>
              )}
              {invoice.paidAt > 0n && (
                <div className="flex items-center justify-between py-2 border-b border-[var(--border-color)]">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-body text-cool-gray">Paid</span>
                  </div>
                  <span className="text-body text-white">{formatDate(invoice.paidAt)}</span>
                </div>
              )}
            </div>

            {/* Hashes */}
            <div className="pt-4 border-t-2 border-[var(--border-color)] space-y-2">
              <div>
                <p className="text-body-sm text-cool-gray uppercase tracking-wider mb-1">
                  Invoice Hash
                </p>
                <p className="font-mono text-body-sm text-white break-all">{invoice.invoiceHash}</p>
              </div>
              <div>
                <p className="text-body-sm text-cool-gray uppercase tracking-wider mb-1">
                  External ID
                </p>
                <p className="font-mono text-body-sm text-white break-all">{invoice.externalId}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Right Column: Funding Record & Status Timeline */}
        <div className="space-y-6">
          {/* Funding Record (if funded) */}
          {isFunded && fundingRecord && (
            <Card>
              <CardHeader>
                <CardTitle>Funding Record</CardTitle>
              </CardHeader>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-[var(--border-color)]">
                  <span className="text-body text-cool-gray">Amount Received</span>
                  <span className="text-body font-mono text-[var(--text-primary)]">
                    {formatCurrency(Number(fundingRecord.fundingAmount) / 1e6)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[var(--border-color)]">
                  <span className="text-body text-cool-gray">Face Value</span>
                  <span className="text-body font-mono text-white">
                    {formatCurrency(Number(fundingRecord.faceValue) / 1e6)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[var(--border-color)]">
                  <span className="text-body text-cool-gray">Discount Applied</span>
                  <span className="text-body font-mono text-red-400">
                    -{formatCurrency((Number(fundingRecord.faceValue) - Number(fundingRecord.fundingAmount)) / 1e6)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-body text-cool-gray">Status</span>
                  <span className={`text-body ${fundingRecord.repaid ? 'text-green-500' : 'text-yellow-500'}`}>
                    {fundingRecord.repaid ? 'Buyer Repaid' : 'Awaiting Buyer Repayment'}
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* Status Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Status Timeline</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              {/* Created */}
              <TimelineStep
                completed={true}
                label="Created"
                sublabel={formatDate(invoice.createdAt)}
              />

              {/* Approved by Buyer */}
              <TimelineStep
                completed={invoice.status >= InvoiceStatus.Approved}
                label="Approved by Buyer"
                sublabel={invoice.status === InvoiceStatus.Pending ? 'Awaiting buyer approval' : undefined}
              />

              {/* Funding Approved by Operator */}
              <TimelineStep
                completed={invoice.status >= InvoiceStatus.FundingApproved}
                label="Funding Approved"
                sublabel={
                  invoice.status === InvoiceStatus.Approved
                    ? 'Awaiting operator approval'
                    : invoice.status === InvoiceStatus.FundingApproved
                      ? 'Ready for you to request funding'
                      : undefined
                }
                highlight={invoice.status === InvoiceStatus.FundingApproved}
              />

              {/* Funded */}
              <TimelineStep
                completed={invoice.status >= InvoiceStatus.Funded}
                label="Funded"
                sublabel={invoice.fundedAt > 0n ? formatDate(invoice.fundedAt) : undefined}
              />

              {/* Paid/Defaulted */}
              <TimelineStep
                completed={invoice.status === InvoiceStatus.Paid || invoice.status === InvoiceStatus.Defaulted}
                label={
                  invoice.status === InvoiceStatus.Defaulted
                    ? 'Defaulted'
                    : invoice.status === InvoiceStatus.Paid
                      ? 'Paid'
                      : 'Awaiting Payment'
                }
                sublabel={invoice.paidAt > 0n ? formatDate(invoice.paidAt) : undefined}
                variant={
                  invoice.status === InvoiceStatus.Paid
                    ? 'success'
                    : invoice.status === InvoiceStatus.Defaulted
                      ? 'error'
                      : 'default'
                }
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Timeline Step Component
interface TimelineStepProps {
  completed: boolean;
  label: string;
  sublabel?: string;
  highlight?: boolean;
  variant?: 'default' | 'success' | 'error';
}

function TimelineStep({ completed, label, sublabel, highlight, variant = 'default' }: TimelineStepProps) {
  const getIconColor = () => {
    if (variant === 'success') return 'bg-green-500';
    if (variant === 'error') return 'bg-red-500';
    if (completed) return 'bg-[var(--text-primary)]';
    return 'bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]';
  };

  const getLabelColor = () => {
    if (variant === 'success') return 'text-green-500';
    if (variant === 'error') return 'text-red-500';
    if (highlight) return 'text-[var(--text-primary)]';
    if (completed) return 'text-white';
    return 'text-cool-gray';
  };

  return (
    <div className="flex items-start gap-3">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${getIconColor()}`}>
        {completed ? (
          variant === 'error' ? (
            <XCircle className="w-4 h-4 text-white" />
          ) : (
            <CheckCircle className="w-4 h-4 text-[var(--bg-primary)]" />
          )
        ) : (
          <Circle className="w-2 h-2 text-cool-gray" />
        )}
      </div>
      <div>
        <p className={`text-body font-medium ${getLabelColor()}`}>{label}</p>
        {sublabel && <p className="text-body-sm text-cool-gray">{sublabel}</p>}
      </div>
    </div>
  );
}
