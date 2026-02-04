'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmActionModal } from './ConfirmActionModal';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import { useInvoice, useFundingAmount, InvoiceStatus } from '@/hooks/invoice/useInvoice';
import { useCompleteFunding, useIsInvoiceFunded } from '@/hooks/operator/useExecutionPool';
import { usePoolState } from '@/hooks';
import { formatCurrency, formatAddress } from '@/lib/formatters';
import { parseUnits, formatUnits, type Address } from 'viem';
import { USDC_DECIMALS } from '@/lib/contracts';
import { Banknote, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';

interface FundInvoiceFormProps {
  invoiceId: bigint;
  onSuccess?: () => void;
}

export function FundInvoiceForm({ invoiceId, onSuccess }: FundInvoiceFormProps) {
  const { data: invoice, isLoading: invoiceLoading } = useInvoice(invoiceId);
  const { data: calculatedFundingAmount, isLoading: fundingLoading } = useFundingAmount(invoiceId);
  const { data: isAlreadyFunded, isLoading: fundedLoading } = useIsInvoiceFunded(invoiceId);
  const { availableLiquidity, isLoading: poolLoading } = usePoolState();

  const {
    completeFunding,
    step,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  } = useCompleteFunding();

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [useManualAmount, setUseManualAmount] = useState(false);
  const [manualFundingAmount, setManualFundingAmount] = useState('');

  const isLoading = invoiceLoading || fundingLoading || fundedLoading || poolLoading;

  // Use calculated or manual funding amount
  const fundingAmountToUse = useMemo(() => {
    if (useManualAmount && manualFundingAmount) {
      return parseUnits(manualFundingAmount, USDC_DECIMALS);
    }
    return calculatedFundingAmount ?? 0n;
  }, [useManualAmount, manualFundingAmount, calculatedFundingAmount]);

  // Calculate discount
  const discount = useMemo(() => {
    if (!invoice) return 0n;
    return invoice.faceValue - fundingAmountToUse;
  }, [invoice, fundingAmountToUse]);

  // Check if can fund - now requires FundingApproved status
  const canFund = useMemo(() => {
    if (!invoice) return false;
    // Allow funding for both Approved and FundingApproved statuses
    if (invoice.status !== InvoiceStatus.Approved && invoice.status !== InvoiceStatus.FundingApproved) return false;
    if (isAlreadyFunded) return false;
    if (fundingAmountToUse <= 0n) return false;
    if (fundingAmountToUse > (availableLiquidity ?? 0n)) return false;
    return true;
  }, [invoice, isAlreadyFunded, fundingAmountToUse, availableLiquidity]);

  // Handle success
  useEffect(() => {
    if (isSuccess) {
      setShowConfirmModal(false);
      onSuccess?.();
      reset();
    }
  }, [isSuccess, onSuccess, reset]);

  const handleFund = () => {
    if (!invoice) return;

    completeFunding(
      invoiceId,
      invoice.supplier as Address,
      fundingAmountToUse,
      invoice.faceValue
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fund Invoice</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-32" />
        </div>
      </Card>
    );
  }

  if (!invoice) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fund Invoice</CardTitle>
        </CardHeader>
        <div className="py-8 text-center">
          <p className="text-cool-gray">Invoice not found</p>
        </div>
      </Card>
    );
  }

  if (isAlreadyFunded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fund Invoice</CardTitle>
          <Badge variant="success">Already Funded</Badge>
        </CardHeader>
        <div className="p-4 bg-green-500/10 border-2 border-green-500/20 flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-green-500" />
          <p className="text-body text-white">
            This invoice has already been funded.
          </p>
        </div>
      </Card>
    );
  }

  if (invoice.status !== InvoiceStatus.Approved && invoice.status !== InvoiceStatus.FundingApproved) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fund Invoice</CardTitle>
          <InvoiceStatusBadge status={invoice.status} />
        </CardHeader>
        <div className="p-4 bg-yellow-500/10 border-2 border-yellow-500/20 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-yellow-500" />
          <p className="text-body text-white">
            Only approved or funding-approved invoices can be funded. Current status:{' '}
            {invoice.status === InvoiceStatus.Pending ? 'Pending Buyer Approval' : 'Not Available'}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Fund Invoice #{invoiceId.toString()}</CardTitle>
          <InvoiceStatusBadge status={invoice.status} />
        </CardHeader>

        <div className="space-y-6">
          {/* Invoice Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
              <p className="text-body-sm text-cool-gray uppercase tracking-wider mb-1">
                Supplier
              </p>
              <p className="font-mono text-white">{formatAddress(invoice.supplier)}</p>
            </div>
            <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
              <p className="text-body-sm text-cool-gray uppercase tracking-wider mb-1">
                Buyer
              </p>
              <p className="font-mono text-white">{formatAddress(invoice.buyer)}</p>
            </div>
            <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
              <p className="text-body-sm text-cool-gray uppercase tracking-wider mb-1">
                Maturity Date
              </p>
              <p className="text-white">
                {new Date(Number(invoice.maturityDate) * 1000).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
              <p className="text-body-sm text-cool-gray uppercase tracking-wider mb-1">
                Discount Rate
              </p>
              <p className="text-white">{invoice.discountRateBps / 100}% APR</p>
            </div>
          </div>

          {/* Funding Details */}
          <div className="p-6 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] space-y-4">
            <h4 className="text-body font-bold text-white uppercase tracking-wider">
              Funding Details
            </h4>

            <div className="flex items-center justify-between py-2 border-b border-[var(--border-color)]">
              <span className="text-body text-cool-gray">Face Value</span>
              <span className="text-h3 font-mono text-white">
                {formatCurrency(Number(invoice.faceValue) / 1e6)}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-[var(--border-color)]">
              <span className="text-body text-cool-gray">Discount</span>
              <span className="text-body font-mono text-red-400">
                - {formatCurrency(Number(discount) / 1e6)}
              </span>
            </div>

            {/* Funding Amount */}
            <div className="py-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-body text-cool-gray">Funding Amount</span>
                <button
                  onClick={() => setUseManualAmount(!useManualAmount)}
                  className="text-body-sm text-[var(--text-primary)] hover:underline"
                >
                  {useManualAmount ? 'Use Calculated' : 'Enter Manual'}
                </button>
              </div>

              {useManualAmount ? (
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    value={manualFundingAmount}
                    onChange={(e) => setManualFundingAmount(e.target.value)}
                    placeholder={formatUnits(calculatedFundingAmount ?? 0n, USDC_DECIMALS)}
                  />
                  <span className="text-cool-gray">USDC</span>
                </div>
              ) : (
                <span className="text-h2 font-mono text-[var(--text-primary)]">
                  {formatCurrency(Number(fundingAmountToUse) / 1e6)}
                </span>
              )}
            </div>
          </div>

          {/* Liquidity Check */}
          {fundingAmountToUse > (availableLiquidity ?? 0n) && (
            <div className="p-4 bg-red-500/10 border-2 border-red-500/20 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <div>
                <p className="text-body font-medium text-white">Insufficient Liquidity</p>
                <p className="text-body-sm text-cool-gray">
                  Available: {formatCurrency(Number(availableLiquidity ?? 0n) / 1e6)} USDC
                </p>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-500/10 border-2 border-red-500/20 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <p className="text-body text-red-400">{error.message}</p>
            </div>
          )}

          {/* Fund Button */}
          <Button
            variant="primary"
            size="lg"
            onClick={() => setShowConfirmModal(true)}
            disabled={!canFund || isPending || isConfirming}
            isLoading={isPending || isConfirming}
            leftIcon={<Banknote className="w-5 h-5" />}
            className="w-full"
          >
            Fund Invoice
          </Button>

          {/* Transaction Flow */}
          <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
            <p className="text-body-sm text-cool-gray uppercase tracking-wider mb-3">
              Transaction Flow (2 Steps)
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-body-sm">
                <span className={step === 'diamond' ? 'text-[var(--text-primary)]' : step === 'execution' || step === 'complete' ? 'text-green-500' : 'text-cool-gray'}>
                  1. Update Diamond
                </span>
                {(step === 'execution' || step === 'complete') && <CheckCircle className="w-4 h-4 text-green-500" />}
              </div>
              <div className="flex items-center gap-2 text-body-sm">
                <span className={step === 'execution' ? 'text-[var(--text-primary)]' : step === 'complete' ? 'text-green-500' : 'text-cool-gray'}>
                  2. Transfer USDC
                </span>
                <ArrowRight className="w-4 h-4 text-cool-gray" />
                <span className="text-white">{formatAddress(invoice.supplier)}</span>
                {step === 'complete' && <CheckCircle className="w-4 h-4 text-green-500" />}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <ConfirmActionModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleFund}
        title="Confirm Invoice Funding"
        description={`This will transfer ${formatCurrency(Number(fundingAmountToUse) / 1e6)} USDC to ${formatAddress(invoice.supplier)}. The supplier will receive funds immediately.`}
        confirmText="Fund Invoice"
        variant="warning"
        isLoading={isPending || isConfirming}
      />
    </>
  );
}
