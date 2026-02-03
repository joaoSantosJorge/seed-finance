'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { FundInvoiceForm, InvoiceStatusBadge, ConfirmActionModal } from '@/components/operator';
import { useInvoice, InvoiceStatus } from '@/hooks/invoice/useInvoice';
import { useFundingRecord, useIsInvoiceFunded } from '@/hooks/operator/useExecutionPool';
import { formatCurrency, formatAddress } from '@/lib/formatters';
import {
  ArrowLeft,
  User,
  Building2,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { invoiceDiamondAbi } from '@/abis/InvoiceDiamond';
import { getContractAddresses } from '@/lib/contracts';
import type { Address } from 'viem';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

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

  const [showDefaultModal, setShowDefaultModal] = useState(false);

  // Mark defaulted hook
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) {
      setShowDefaultModal(false);
      reset();
      refetch();
    }
  }, [isSuccess, reset, refetch]);

  const handleMarkDefaulted = () => {
    if (!invoiceId) return;
    writeContract({
      address: addresses.invoiceDiamond as Address,
      abi: invoiceDiamondAbi,
      functionName: 'markDefaulted',
      args: [invoiceId],
    });
  };

  const isLoading = invoiceLoading || fundingLoading;

  // Check if invoice is overdue
  const isOverdue =
    invoice &&
    invoice.status === InvoiceStatus.Funded &&
    BigInt(Math.floor(Date.now() / 1000)) > invoice.maturityDate;

  if (!invoiceId) {
    return (
      <div className="text-center py-12">
        <p className="text-cool-gray">Invalid invoice ID</p>
        <Link href="/dashboard/operator/invoices">
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
        <Link href="/dashboard/operator/invoices">
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
        href="/dashboard/operator/invoices"
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
          {isOverdue && (
            <span className="px-3 py-1 text-body-sm bg-red-500/10 border-2 border-red-500/20 text-red-500 uppercase tracking-wider">
              Overdue
            </span>
          )}
        </div>
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
                    Supplier
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
                <span className={`text-body ${isOverdue ? 'text-red-500' : 'text-white'}`}>
                  {formatDate(invoice.maturityDate)}
                </span>
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

        {/* Funding Section */}
        <div className="space-y-6">
          {/* Show fund form for approved invoices */}
          {invoice.status === InvoiceStatus.Approved && (
            <FundInvoiceForm
              invoiceId={invoiceId}
              onSuccess={() => {
                refetch();
                router.push('/dashboard/operator/invoices');
              }}
            />
          )}

          {/* Funding Record (if funded) */}
          {isFunded && fundingRecord && (
            <Card>
              <CardHeader>
                <CardTitle>Funding Record</CardTitle>
              </CardHeader>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-[var(--border-color)]">
                  <span className="text-body text-cool-gray">Funding Amount</span>
                  <span className="text-body font-mono text-white">
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
                  <span className="text-body text-cool-gray">Expected Yield</span>
                  <span className="text-body font-mono text-green-500">
                    +{formatCurrency((Number(fundingRecord.faceValue) - Number(fundingRecord.fundingAmount)) / 1e6)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-body text-cool-gray">Status</span>
                  <span className={`text-body ${fundingRecord.repaid ? 'text-green-500' : 'text-yellow-500'}`}>
                    {fundingRecord.repaid ? 'Repaid' : 'Awaiting Repayment'}
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* Mark Defaulted Action */}
          {isOverdue && invoice.status === InvoiceStatus.Funded && (
            <Card>
              <CardHeader>
                <CardTitle>Overdue Actions</CardTitle>
              </CardHeader>
              <div className="space-y-4">
                <div className="p-4 bg-red-500/10 border-2 border-red-500/20 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-body font-medium text-white">Invoice is Overdue</p>
                    <p className="text-body-sm text-cool-gray">
                      This invoice has passed its maturity date without repayment.
                    </p>
                  </div>
                </div>
                {error && (
                  <div className="p-4 bg-red-500/10 border-2 border-red-500/20 flex items-center gap-3">
                    <XCircle className="w-5 h-5 text-red-500" />
                    <p className="text-body text-red-400">{error.message}</p>
                  </div>
                )}
                <Button
                  variant="danger"
                  onClick={() => setShowDefaultModal(true)}
                  disabled={isPending || isConfirming}
                  isLoading={isPending || isConfirming}
                  className="w-full"
                >
                  Mark as Defaulted
                </Button>
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
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[var(--text-primary)] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4 text-[var(--bg-primary)]" />
                </div>
                <div>
                  <p className="text-body font-medium text-white">Created</p>
                  <p className="text-body-sm text-cool-gray">{formatDate(invoice.createdAt)}</p>
                </div>
              </div>

              {/* Approved */}
              <div className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  invoice.status >= InvoiceStatus.Approved ? 'bg-[var(--text-primary)]' : 'bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]'
                }`}>
                  {invoice.status >= InvoiceStatus.Approved ? (
                    <CheckCircle className="w-4 h-4 text-[var(--bg-primary)]" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-cool-gray" />
                  )}
                </div>
                <div>
                  <p className={`text-body font-medium ${invoice.status >= InvoiceStatus.Approved ? 'text-white' : 'text-cool-gray'}`}>
                    Approved
                  </p>
                  {invoice.status === InvoiceStatus.Pending && (
                    <p className="text-body-sm text-cool-gray">Awaiting buyer approval</p>
                  )}
                </div>
              </div>

              {/* Funded */}
              <div className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  invoice.status >= InvoiceStatus.Funded ? 'bg-[var(--text-primary)]' : 'bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]'
                }`}>
                  {invoice.status >= InvoiceStatus.Funded ? (
                    <CheckCircle className="w-4 h-4 text-[var(--bg-primary)]" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-cool-gray" />
                  )}
                </div>
                <div>
                  <p className={`text-body font-medium ${invoice.status >= InvoiceStatus.Funded ? 'text-white' : 'text-cool-gray'}`}>
                    Funded
                  </p>
                  {invoice.fundedAt > 0n && (
                    <p className="text-body-sm text-cool-gray">{formatDate(invoice.fundedAt)}</p>
                  )}
                </div>
              </div>

              {/* Paid/Defaulted */}
              <div className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  invoice.status === InvoiceStatus.Paid
                    ? 'bg-green-500'
                    : invoice.status === InvoiceStatus.Defaulted
                      ? 'bg-red-500'
                      : 'bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]'
                }`}>
                  {invoice.status === InvoiceStatus.Paid ? (
                    <CheckCircle className="w-4 h-4 text-white" />
                  ) : invoice.status === InvoiceStatus.Defaulted ? (
                    <XCircle className="w-4 h-4 text-white" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-cool-gray" />
                  )}
                </div>
                <div>
                  <p className={`text-body font-medium ${
                    invoice.status === InvoiceStatus.Paid
                      ? 'text-green-500'
                      : invoice.status === InvoiceStatus.Defaulted
                        ? 'text-red-500'
                        : 'text-cool-gray'
                  }`}>
                    {invoice.status === InvoiceStatus.Paid
                      ? 'Paid'
                      : invoice.status === InvoiceStatus.Defaulted
                        ? 'Defaulted'
                        : 'Awaiting Payment'}
                  </p>
                  {invoice.paidAt > 0n && (
                    <p className="text-body-sm text-cool-gray">{formatDate(invoice.paidAt)}</p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Mark Defaulted Confirmation */}
      <ConfirmActionModal
        isOpen={showDefaultModal}
        onClose={() => setShowDefaultModal(false)}
        onConfirm={handleMarkDefaulted}
        title="Mark Invoice as Defaulted"
        description="This will mark the invoice as defaulted. This action indicates that the buyer has failed to repay and may affect credit scoring."
        confirmText="Mark Defaulted"
        variant="danger"
        isLoading={isPending || isConfirming}
      />
    </div>
  );
}
