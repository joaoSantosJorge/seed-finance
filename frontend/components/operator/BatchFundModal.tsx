'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useCompleteFunding } from '@/hooks/operator/useExecutionPool';
import { type Invoice, InvoiceStatus } from '@/hooks/invoice/useInvoice';
import { usePoolState } from '@/hooks';
import { formatCurrency, formatAddress } from '@/lib/formatters';
import { type Address } from 'viem';
import { AlertTriangle, Banknote, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface BatchFundModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: Invoice[];
  onSuccess?: () => void;
}

type FundingStatus = 'pending' | 'funding' | 'success' | 'error';

interface InvoiceFundingState {
  invoice: Invoice;
  status: FundingStatus;
  error?: string;
}

export function BatchFundModal({ isOpen, onClose, invoices, onSuccess }: BatchFundModalProps) {
  const { availableLiquidity } = usePoolState();
  const [fundingStates, setFundingStates] = useState<InvoiceFundingState[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [isBatchComplete, setIsBatchComplete] = useState(false);

  const {
    completeFunding,
    isSuccess,
    error,
    reset,
  } = useCompleteFunding();

  // Filter to only funding-approved invoices (ready to fund)
  const approvedInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.status === InvoiceStatus.FundingApproved);
  }, [invoices]);

  // Calculate total funding needed
  const totalFundingNeeded = useMemo(() => {
    return approvedInvoices.reduce((sum, inv) => {
      // Use face value minus estimated discount (simplified)
      const daysToMaturity = Math.max(
        0,
        (Number(inv.maturityDate) - Math.floor(Date.now() / 1000)) / 86400
      );
      const discount = (Number(inv.faceValue) * inv.discountRateBps * daysToMaturity) / (10000 * 365);
      return sum + (Number(inv.faceValue) - discount);
    }, 0);
  }, [approvedInvoices]);

  const hasInsufficientLiquidity = totalFundingNeeded > Number(availableLiquidity ?? 0n) / 1e6;

  // Initialize funding states when modal opens
  // Ref to track if we should proceed to next invoice
  const shouldProceedRef = useRef(false);

  // Initialize funding states when modal opens
  useEffect(() => {
    if (isOpen) {
      setFundingStates(
        approvedInvoices.map((invoice) => ({
          invoice,
          status: 'pending',
        }))
      );
      setCurrentIndex(null);
      setIsBatchComplete(false);
    }
  }, [isOpen, approvedInvoices]);

  const fundInvoiceAtIndex = useCallback((index: number) => {
    const invoice = approvedInvoices[index];
    if (!invoice) return;

    setFundingStates((prev) =>
      prev.map((state, idx) =>
        idx === index ? { ...state, status: 'funding' } : state
      )
    );

    // Calculate funding amount (simplified - in production use contract's calculation)
    const daysToMaturity = Math.max(
      0,
      (Number(invoice.maturityDate) - Math.floor(Date.now() / 1000)) / 86400
    );
    const discountAmount =
      (Number(invoice.faceValue) * invoice.discountRateBps * daysToMaturity) / (10000 * 365);
    const fundingAmt = BigInt(Math.floor(Number(invoice.faceValue) - discountAmount));

    completeFunding(
      invoice.id,
      invoice.supplier as Address,
      fundingAmt,
      invoice.faceValue
    );
  }, [approvedInvoices, completeFunding]);

  // Handle funding completion for current invoice
  useEffect(() => {
    if (currentIndex === null) return;

    if (isSuccess) {
      setFundingStates((prev) =>
        prev.map((state, idx) =>
          idx === currentIndex ? { ...state, status: 'success' } : state
        )
      );
      reset();

      // Move to next invoice
      const nextIndex = currentIndex + 1;
      if (nextIndex < approvedInvoices.length) {
        setCurrentIndex(nextIndex);
        shouldProceedRef.current = true;
      } else {
        setIsBatchComplete(true);
        setCurrentIndex(null);
      }
    } else if (error) {
      setFundingStates((prev) =>
        prev.map((state, idx) =>
          idx === currentIndex
            ? { ...state, status: 'error', error: error.message }
            : state
        )
      );
      reset();

      // Move to next invoice even on error
      const nextIndex = currentIndex + 1;
      if (nextIndex < approvedInvoices.length) {
        setCurrentIndex(nextIndex);
        shouldProceedRef.current = true;
      } else {
        setIsBatchComplete(true);
        setCurrentIndex(null);
      }
    }
  }, [isSuccess, error, currentIndex, approvedInvoices.length, reset]);

  // Effect to fund the next invoice when currentIndex changes
  useEffect(() => {
    if (currentIndex !== null && shouldProceedRef.current) {
      shouldProceedRef.current = false;
      fundInvoiceAtIndex(currentIndex);
    }
  }, [currentIndex, fundInvoiceAtIndex]);

  const handleStartBatch = () => {
    if (approvedInvoices.length === 0) return;
    setCurrentIndex(0);
    fundInvoiceAtIndex(0);
  };

  const handleClose = () => {
    if (isBatchComplete) {
      onSuccess?.();
    }
    onClose();
  };

  const successCount = fundingStates.filter((s) => s.status === 'success').length;
  const errorCount = fundingStates.filter((s) => s.status === 'error').length;
  const isProcessing = currentIndex !== null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Batch Fund Invoices" size="lg">
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] text-center">
            <p className="text-body-sm text-cool-gray uppercase tracking-wider">Invoices</p>
            <p className="text-h2 text-white">{approvedInvoices.length}</p>
          </div>
          <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] text-center">
            <p className="text-body-sm text-cool-gray uppercase tracking-wider">Total Amount</p>
            <p className="text-h3 text-white font-mono">
              {formatCurrency(totalFundingNeeded)}
            </p>
          </div>
          <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] text-center">
            <p className="text-body-sm text-cool-gray uppercase tracking-wider">Available</p>
            <p className={`text-h3 font-mono ${hasInsufficientLiquidity ? 'text-red-500' : 'text-green-500'}`}>
              {formatCurrency(Number(availableLiquidity ?? 0n) / 1e6)}
            </p>
          </div>
        </div>

        {/* Warning */}
        {hasInsufficientLiquidity && (
          <div className="p-4 bg-yellow-500/10 border-2 border-yellow-500/20 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0" />
            <p className="text-body text-white">
              Insufficient liquidity to fund all invoices. Some may fail.
            </p>
          </div>
        )}

        {/* Invoice List */}
        <div className="max-h-64 overflow-y-auto border-2 border-[var(--border-color)]">
          {fundingStates.map((state) => (
            <div
              key={state.invoice.id.toString()}
              className={`flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] last:border-b-0 ${
                state.status === 'funding' ? 'bg-[var(--bg-secondary)]' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                {state.status === 'pending' && (
                  <div className="w-5 h-5 rounded-full border-2 border-cool-gray" />
                )}
                {state.status === 'funding' && (
                  <Loader2 className="w-5 h-5 text-[var(--text-primary)] animate-spin" />
                )}
                {state.status === 'success' && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                {state.status === 'error' && (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                <div>
                  <p className="text-body text-white">
                    Invoice #{state.invoice.id.toString()}
                  </p>
                  <p className="text-body-sm text-cool-gray">
                    {formatAddress(state.invoice.supplier)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-body font-mono text-white">
                  {formatCurrency(Number(state.invoice.faceValue) / 1e6)}
                </p>
                {state.error && (
                  <p className="text-body-sm text-red-400 truncate max-w-[150px]">
                    {state.error}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Progress */}
        {isBatchComplete && (
          <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
            <p className="text-body text-white mb-2">Batch Complete</p>
            <div className="flex gap-4">
              <Badge variant="success">{successCount} Funded</Badge>
              {errorCount > 0 && <Badge variant="error">{errorCount} Failed</Badge>}
            </div>
          </div>
        )}

        {/* Actions */}
        <ModalFooter>
          <Button variant="secondary" onClick={handleClose} disabled={isProcessing}>
            {isBatchComplete ? 'Close' : 'Cancel'}
          </Button>
          {!isBatchComplete && (
            <Button
              variant="primary"
              onClick={handleStartBatch}
              disabled={isProcessing || approvedInvoices.length === 0}
              isLoading={isProcessing}
              leftIcon={<Banknote className="w-4 h-4" />}
            >
              {isProcessing
                ? `Funding ${(currentIndex ?? 0) + 1} of ${approvedInvoices.length}...`
                : `Fund ${approvedInvoices.length} Invoice${approvedInvoices.length !== 1 ? 's' : ''}`}
            </Button>
          )}
        </ModalFooter>
      </div>
    </Modal>
  );
}
