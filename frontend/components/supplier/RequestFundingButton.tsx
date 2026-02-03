'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { useSupplierRequestFunding } from '@/hooks/invoice/useInvoiceActions';
import { useFundingAmount, type Invoice, InvoiceStatus } from '@/hooks/invoice/useInvoice';
import { useIsInvoiceFunded } from '@/hooks/operator/useExecutionPool';
import { usePoolState } from '@/hooks';
import { formatCurrency, formatAddress } from '@/lib/formatters';
import { type Address } from 'viem';
import { Banknote, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

interface RequestFundingButtonProps {
  invoice: Invoice;
  onSuccess?: () => void;
}

export function RequestFundingButton({ invoice, onSuccess }: RequestFundingButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const { data: calculatedFundingAmount } = useFundingAmount(invoice.id);
  const { data: isAlreadyFunded } = useIsInvoiceFunded(invoice.id);
  const { availableLiquidity } = usePoolState();

  const {
    requestFunding,
    step,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  } = useSupplierRequestFunding();

  const fundingAmount = calculatedFundingAmount ?? 0n;
  const discount = invoice.faceValue - fundingAmount;

  // Check if can request funding (requires FundingApproved status)
  const canRequest = useMemo(() => {
    if (invoice.status !== InvoiceStatus.FundingApproved) return false;
    if (isAlreadyFunded) return false;
    if (fundingAmount <= 0n) return false;
    if (fundingAmount > (availableLiquidity ?? 0n)) return false;
    return true;
  }, [invoice.status, isAlreadyFunded, fundingAmount, availableLiquidity]);

  // Handle success
  useEffect(() => {
    if (isSuccess) {
      setShowModal(false);
      onSuccess?.();
      reset();
    }
  }, [isSuccess, onSuccess, reset]);

  const handleRequestFunding = () => {
    requestFunding(
      invoice.id,
      invoice.supplier as Address,
      fundingAmount,
      invoice.faceValue
    );
  };

  // Don't show button if not funding-approved or already funded
  if (invoice.status !== InvoiceStatus.FundingApproved || isAlreadyFunded) {
    return null;
  }

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        onClick={() => setShowModal(true)}
        disabled={!canRequest}
        leftIcon={<Banknote className="w-4 h-4" />}
      >
        Request Funding
      </Button>

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          reset();
        }}
        title="Request Early Payment"
        size="md"
      >
        <div className="space-y-6">
          {/* Invoice Info */}
          <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
            <p className="text-body-sm text-cool-gray uppercase tracking-wider mb-3">
              Invoice #{invoice.id.toString()}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-body-sm text-cool-gray">Face Value</p>
                <p className="text-h3 font-mono text-white">
                  {formatCurrency(Number(invoice.faceValue) / 1e6)}
                </p>
              </div>
              <div>
                <p className="text-body-sm text-cool-gray">Buyer</p>
                <p className="text-body font-mono text-white">
                  {formatAddress(invoice.buyer)}
                </p>
              </div>
            </div>
          </div>

          {/* Funding Details */}
          <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] space-y-3">
            <p className="text-body-sm text-cool-gray uppercase tracking-wider">
              Early Payment Details
            </p>
            <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
              <span className="text-cool-gray">Face Value</span>
              <span className="font-mono text-white">
                {formatCurrency(Number(invoice.faceValue) / 1e6)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
              <span className="text-cool-gray">Discount ({invoice.discountRateBps / 100}% APR)</span>
              <span className="font-mono text-red-400">
                - {formatCurrency(Number(discount) / 1e6)}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-white font-medium">You Receive</span>
              <span className="text-h3 font-mono text-[var(--text-primary)]">
                {formatCurrency(Number(fundingAmount) / 1e6)}
              </span>
            </div>
          </div>

          {/* Insufficient Liquidity Warning */}
          {fundingAmount > (availableLiquidity ?? 0n) && (
            <div className="p-4 bg-yellow-500/10 border-2 border-yellow-500/20 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0" />
              <div>
                <p className="text-body font-medium text-white">Insufficient Liquidity</p>
                <p className="text-body-sm text-cool-gray">
                  Available: {formatCurrency(Number(availableLiquidity ?? 0n) / 1e6)} USDC
                </p>
              </div>
            </div>
          )}

          {/* Progress Steps */}
          {(isPending || isConfirming) && (
            <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
              <p className="text-body-sm text-cool-gray uppercase tracking-wider mb-3">
                Processing
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-body-sm">
                  {step === 'diamond' ? (
                    <Loader2 className="w-4 h-4 text-[var(--text-primary)] animate-spin" />
                  ) : step === 'execution' || step === 'complete' ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <div className="w-4 h-4 border border-cool-gray rounded-full" />
                  )}
                  <span className={step === 'diamond' ? 'text-[var(--text-primary)]' : step === 'execution' || step === 'complete' ? 'text-green-500' : 'text-cool-gray'}>
                    1. Recording funding request
                  </span>
                </div>
                <div className="flex items-center gap-2 text-body-sm">
                  {step === 'execution' ? (
                    <Loader2 className="w-4 h-4 text-[var(--text-primary)] animate-spin" />
                  ) : step === 'complete' ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <div className="w-4 h-4 border border-cool-gray rounded-full" />
                  )}
                  <span className={step === 'execution' ? 'text-[var(--text-primary)]' : step === 'complete' ? 'text-green-500' : 'text-cool-gray'}>
                    2. Transferring USDC to your wallet
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-500/10 border-2 border-red-500/20 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
              <p className="text-body text-red-400">{error.message}</p>
            </div>
          )}

          <ModalFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setShowModal(false);
                reset();
              }}
              disabled={isPending || isConfirming}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleRequestFunding}
              disabled={!canRequest || isPending || isConfirming}
              isLoading={isPending || isConfirming}
              leftIcon={<Banknote className="w-4 h-4" />}
            >
              {isPending || isConfirming ? 'Processing...' : 'Request Funding'}
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </>
  );
}
