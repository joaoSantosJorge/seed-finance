'use client';

import { useState, useEffect, useMemo } from 'react';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useBatchApproveFunding } from '@/hooks/invoice/useInvoiceActions';
import { type Invoice, InvoiceStatus } from '@/hooks/invoice/useInvoice';
import { formatCurrency, formatAddress } from '@/lib/formatters';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';

interface BatchApproveModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: Invoice[];
  onSuccess?: () => void;
}

export function BatchApproveModal({ isOpen, onClose, invoices, onSuccess }: BatchApproveModalProps) {
  const [hasProcessed, setHasProcessed] = useState(false);

  const {
    batchApproveFunding,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  } = useBatchApproveFunding();

  // Filter to only invoices in Approved status (awaiting funding approval)
  const approveableInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.status === InvoiceStatus.Approved);
  }, [invoices]);

  // Calculate total face value
  const totalFaceValue = useMemo(() => {
    return approveableInvoices.reduce((sum, inv) => sum + Number(inv.faceValue), 0);
  }, [approveableInvoices]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setHasProcessed(false);
      reset();
    }
  }, [isOpen, reset]);

  // Handle success
  useEffect(() => {
    if (isSuccess && !hasProcessed) {
      setHasProcessed(true);
    }
  }, [isSuccess, hasProcessed]);

  const handleApprove = () => {
    const invoiceIds = approveableInvoices.map((inv) => inv.id);
    batchApproveFunding(invoiceIds);
  };

  const handleClose = () => {
    if (hasProcessed) {
      onSuccess?.();
    }
    onClose();
  };

  const isProcessing = isPending || isConfirming;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Approve Funding" size="lg">
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] text-center">
            <p className="text-body-sm text-cool-gray uppercase tracking-wider">Invoices</p>
            <p className="text-h2 text-white">{approveableInvoices.length}</p>
          </div>
          <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] text-center">
            <p className="text-body-sm text-cool-gray uppercase tracking-wider">Total Face Value</p>
            <p className="text-h3 text-white font-mono">
              {formatCurrency(totalFaceValue / 1e6)}
            </p>
          </div>
        </div>

        {/* Info */}
        <div className="p-4 bg-blue-500/10 border-2 border-blue-500/20">
          <p className="text-body text-white">
            Approving these invoices will allow them to be funded. After approval,
            either the operator or the supplier can trigger the actual funding.
          </p>
        </div>

        {/* Invoice List */}
        <div className="max-h-64 overflow-y-auto border-2 border-[var(--border-color)]">
          {approveableInvoices.map((invoice) => (
            <div
              key={invoice.id.toString()}
              className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] last:border-b-0"
            >
              <div className="flex items-center gap-3">
                {!hasProcessed && !isProcessing && (
                  <div className="w-5 h-5 rounded-full border-2 border-cool-gray" />
                )}
                {isProcessing && (
                  <Loader2 className="w-5 h-5 text-[var(--text-primary)] animate-spin" />
                )}
                {hasProcessed && !error && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                {hasProcessed && error && (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                <div>
                  <p className="text-body text-white">
                    Invoice #{invoice.id.toString()}
                  </p>
                  <p className="text-body-sm text-cool-gray">
                    {formatAddress(invoice.supplier)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-body font-mono text-white">
                  {formatCurrency(Number(invoice.faceValue) / 1e6)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Result */}
        {hasProcessed && !error && (
          <div className="p-4 bg-green-500/10 border-2 border-green-500/20">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-500" />
              <div>
                <p className="text-body font-medium text-white">Funding Approved</p>
                <p className="text-body-sm text-cool-gray">
                  {approveableInvoices.length} invoice{approveableInvoices.length !== 1 ? 's' : ''} approved for funding
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-500/10 border-2 border-red-500/20">
            <p className="text-body text-red-400">{error.message}</p>
          </div>
        )}

        {/* Actions */}
        <ModalFooter>
          <Button variant="secondary" onClick={handleClose} disabled={isProcessing}>
            {hasProcessed ? 'Close' : 'Cancel'}
          </Button>
          {!hasProcessed && (
            <Button
              variant="primary"
              onClick={handleApprove}
              disabled={isProcessing || approveableInvoices.length === 0}
              isLoading={isProcessing}
              leftIcon={<CheckCircle className="w-4 h-4" />}
            >
              {isProcessing
                ? 'Approving...'
                : `Approve ${approveableInvoices.length} Invoice${approveableInvoices.length !== 1 ? 's' : ''}`}
            </Button>
          )}
        </ModalFooter>
      </div>
    </Modal>
  );
}
