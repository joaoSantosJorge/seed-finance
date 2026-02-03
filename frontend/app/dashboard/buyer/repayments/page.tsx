'use client';

import { CreditCard, AlertTriangle, Clock, CheckCircle, Check, Circle } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui';
import { TransactionButton } from '@/components/wallet';
import { useAccount } from 'wagmi';
import {
  useUpcomingRepayments,
  useProcessRepayment,
  useUSDCAllowanceForInvoiceDiamond,
  useApproveUSDC,
  useUSDCBalance,
} from '@/hooks';
import { formatUSDC } from '@/lib/formatters';
import { useState, useEffect } from 'react';

interface InvoiceRepaymentItemProps {
  invoice: {
    id: bigint;
    faceValue: bigint;
    maturityDate: bigint;
  };
  isOverdue: boolean;
  daysLabel: string;
  isUrgent?: boolean;
  allowance?: bigint;
  usdcBalance?: bigint;
  onApprove: (invoiceId: bigint, amount: bigint) => void;
  onRepay: (invoiceId: bigint) => void;
  approveState: {
    isPending: boolean;
    isConfirming: boolean;
    isSuccess: boolean;
    hash?: `0x${string}`;
    error?: Error | null;
  };
  repayState: {
    isPending: boolean;
    isConfirming: boolean;
    isSuccess: boolean;
    hash?: `0x${string}`;
    error?: Error | null;
  };
  activeInvoiceId: bigint | null;
}

function InvoiceRepaymentItem({
  invoice,
  isOverdue,
  daysLabel,
  isUrgent,
  allowance,
  usdcBalance,
  onApprove,
  onRepay,
  approveState,
  repayState,
  activeInvoiceId,
}: InvoiceRepaymentItemProps) {
  const maturityDate = new Date(Number(invoice.maturityDate) * 1000);
  const isActive = activeInvoiceId === invoice.id;
  const needsApproval = allowance !== undefined && allowance < invoice.faceValue;
  const hasBalance = usdcBalance !== undefined && usdcBalance >= invoice.faceValue;

  // Track if this invoice was just approved (for UI flow)
  const [wasApproved, setWasApproved] = useState(false);

  useEffect(() => {
    if (isActive && approveState.isSuccess) {
      setWasApproved(true);
    }
  }, [isActive, approveState.isSuccess]);

  // Reset wasApproved when allowance is sufficient
  useEffect(() => {
    if (!needsApproval) {
      setWasApproved(false);
    }
  }, [needsApproval]);

  const isApproving = isActive && (approveState.isPending || approveState.isConfirming);
  const isRepaying = isActive && (repayState.isPending || repayState.isConfirming);
  const isPaid = isActive && repayState.isSuccess;

  return (
    <div className="p-4 hover:bg-slate-700/30 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isOverdue ? 'bg-error/10' : isUrgent ? 'bg-warning/10' : 'bg-primary/10'
          }`}>
            {isOverdue ? (
              <AlertTriangle className="w-5 h-5 text-error" />
            ) : isUrgent ? (
              <Clock className="w-5 h-5 text-warning" />
            ) : (
              <CreditCard className="w-5 h-5 text-primary" />
            )}
          </div>
          <div>
            <p className="text-body font-medium text-white">
              Invoice #{invoice.id.toString()}
            </p>
            <p className={`text-body-sm ${isOverdue ? 'text-error' : isUrgent ? 'text-warning' : 'text-cool-gray'}`}>
              {daysLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-body text-white">
              {formatUSDC(invoice.faceValue)}
            </p>
            <p className="text-body-sm text-cool-gray">
              Due: {maturityDate.toLocaleDateString()}
            </p>
          </div>

          {isPaid ? (
            <div className="flex items-center gap-2 text-success">
              <CheckCircle className="w-5 h-5" />
              <span className="text-body-sm">Paid</span>
            </div>
          ) : needsApproval && !wasApproved ? (
            <TransactionButton
              onClick={() => onApprove(invoice.id, invoice.faceValue)}
              isPending={approveState.isPending && isActive}
              isConfirming={approveState.isConfirming && isActive}
              isSuccess={approveState.isSuccess && isActive}
              hash={isActive ? approveState.hash : undefined}
              disabled={isApproving || !hasBalance}
              pendingText="Confirm..."
              confirmingText="Approving..."
              size="sm"
            >
              {!hasBalance ? 'Insufficient USDC' : 'Approve USDC'}
            </TransactionButton>
          ) : (
            <TransactionButton
              onClick={() => onRepay(invoice.id)}
              isPending={repayState.isPending && isActive}
              isConfirming={repayState.isConfirming && isActive}
              isSuccess={repayState.isSuccess && isActive}
              hash={isActive ? repayState.hash : undefined}
              disabled={isRepaying || !hasBalance}
              pendingText="Confirm..."
              confirmingText="Paying..."
              variant={isOverdue || isUrgent ? 'primary' : 'secondary'}
              size="sm"
            >
              {!hasBalance ? 'Insufficient USDC' : 'Pay Now'}
            </TransactionButton>
          )}
        </div>
      </div>

      {/* Transaction Steps - Show when this invoice is active */}
      {isActive && (needsApproval || isApproving || isRepaying || wasApproved) && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          <p className="text-body-sm text-cool-gray mb-3">Transaction Steps:</p>
          <div className="space-y-2">
            {/* Step 1: Approve */}
            <div className="flex items-center gap-3">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  !needsApproval || wasApproved
                    ? 'bg-success'
                    : 'bg-slate-700'
                }`}
              >
                {!needsApproval || wasApproved ? (
                  <Check className="w-3 h-3 text-white" />
                ) : (
                  <Circle className="w-3 h-3 text-cool-gray" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-body-sm text-white">Approve USDC spending</p>
              </div>
              <span className="text-body-sm text-cool-gray">
                {!needsApproval || wasApproved
                  ? 'Done'
                  : approveState.isPending
                    ? 'Waiting...'
                    : approveState.isConfirming
                      ? 'Confirming...'
                      : 'Pending'}
              </span>
            </div>

            {/* Step 2: Pay */}
            <div className="flex items-center gap-3">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  isPaid ? 'bg-success' : 'bg-slate-700'
                }`}
              >
                {isPaid ? (
                  <Check className="w-3 h-3 text-white" />
                ) : (
                  <Circle className="w-3 h-3 text-cool-gray" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-body-sm text-white">Process repayment</p>
              </div>
              <span className="text-body-sm text-cool-gray">
                {isPaid
                  ? 'Done'
                  : repayState.isPending
                    ? 'Waiting...'
                    : repayState.isConfirming
                      ? 'Confirming...'
                      : 'Pending'}
              </span>
            </div>
          </div>

          {/* Errors */}
          {isActive && (approveState.error || repayState.error) && (
            <p className="mt-2 text-body-sm text-error">
              {(approveState.error || repayState.error)?.message || 'Transaction failed'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function BuyerRepaymentsPage() {
  const { address } = useAccount();
  const { data: repaymentInvoices, totalDue, isLoading } = useUpcomingRepayments(address);
  const { data: usdcBalance } = useUSDCBalance(address);
  const { data: allowance, refetch: refetchAllowance } = useUSDCAllowanceForInvoiceDiamond(address);

  const {
    approveInvoiceDiamond,
    hash: approveHash,
    isPending: approvePending,
    isConfirming: approveConfirming,
    isSuccess: approveSuccess,
    error: approveError,
  } = useApproveUSDC();

  const {
    processRepayment,
    hash: repayHash,
    isPending: repayPending,
    isConfirming: repayConfirming,
    isSuccess: repaySuccess,
    error: repayError,
    reset: resetRepay,
  } = useProcessRepayment();

  const [activeInvoiceId, setActiveInvoiceId] = useState<bigint | null>(null);

  // Refetch allowance after approval success
  useEffect(() => {
    if (approveSuccess) {
      refetchAllowance();
    }
  }, [approveSuccess, refetchAllowance]);

  const handleApprove = (invoiceId: bigint, amount: bigint) => {
    setActiveInvoiceId(invoiceId);
    approveInvoiceDiamond(amount);
  };

  const handleRepay = (invoiceId: bigint) => {
    setActiveInvoiceId(invoiceId);
    resetRepay();
    processRepayment(invoiceId);
  };

  // Separate overdue and upcoming
  const now = new Date();
  const overdueInvoices = repaymentInvoices?.filter(inv => {
    const maturity = new Date(Number(inv.maturityDate) * 1000);
    return maturity < now;
  }) ?? [];

  const upcomingInvoices = repaymentInvoices?.filter(inv => {
    const maturity = new Date(Number(inv.maturityDate) * 1000);
    return maturity >= now;
  }) ?? [];

  const approveState = {
    isPending: approvePending,
    isConfirming: approveConfirming,
    isSuccess: approveSuccess,
    hash: approveHash,
    error: approveError,
  };

  const repayState = {
    isPending: repayPending,
    isConfirming: repayConfirming,
    isSuccess: repaySuccess,
    hash: repayHash,
    error: repayError,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-h1 text-white">Repayments</h1>
        <p className="text-body text-cool-gray mt-1">
          View and pay funded invoices
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="p-6">
            <p className="text-body-sm text-cool-gray">Total Due</p>
            <p className="text-h2 text-white mt-2">{formatUSDC(totalDue)}</p>
            <p className="text-body-sm text-cool-gray mt-1">USDC</p>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <p className="text-body-sm text-cool-gray">Upcoming</p>
            <p className="text-h2 text-primary mt-2">{upcomingInvoices.length}</p>
            <p className="text-body-sm text-cool-gray mt-1">invoices</p>
          </div>
        </Card>

        <Card className={overdueInvoices.length > 0 ? 'border-error/50' : ''}>
          <div className="p-6">
            <p className="text-body-sm text-cool-gray">Overdue</p>
            <p className={`text-h2 mt-2 ${overdueInvoices.length > 0 ? 'text-error' : 'text-success'}`}>
              {overdueInvoices.length}
            </p>
            <p className="text-body-sm text-cool-gray mt-1">invoices</p>
          </div>
        </Card>
      </div>

      {/* Overdue Section */}
      {overdueInvoices.length > 0 && (
        <Card className="border-error/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-error" />
              <CardTitle className="text-error">Overdue Invoices</CardTitle>
            </div>
          </CardHeader>
          <div className="divide-y divide-slate-700">
            {overdueInvoices.map((invoice) => {
              const maturityDate = new Date(Number(invoice.maturityDate) * 1000);
              const daysOverdue = Math.abs(
                Math.ceil((maturityDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              );

              return (
                <InvoiceRepaymentItem
                  key={invoice.id.toString()}
                  invoice={invoice}
                  isOverdue={true}
                  daysLabel={`${daysOverdue} days overdue`}
                  allowance={allowance}
                  usdcBalance={usdcBalance}
                  onApprove={handleApprove}
                  onRepay={handleRepay}
                  approveState={approveState}
                  repayState={repayState}
                  activeInvoiceId={activeInvoiceId}
                />
              );
            })}
          </div>
        </Card>
      )}

      {/* Upcoming Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Repayments</CardTitle>
        </CardHeader>

        {isLoading ? (
          <div className="p-6 pt-0 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-slate-700/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : upcomingInvoices.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
            <p className="text-white text-body mb-2">No upcoming repayments</p>
            <p className="text-cool-gray text-body-sm">
              All funded invoices have been paid
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {upcomingInvoices.map((invoice) => {
              const maturityDate = new Date(Number(invoice.maturityDate) * 1000);
              const daysUntil = Math.ceil(
                (maturityDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
              );
              const isUrgent = daysUntil <= 3;

              return (
                <InvoiceRepaymentItem
                  key={invoice.id.toString()}
                  invoice={invoice}
                  isOverdue={false}
                  daysLabel={`Due in ${daysUntil} days`}
                  isUrgent={isUrgent}
                  allowance={allowance}
                  usdcBalance={usdcBalance}
                  onApprove={handleApprove}
                  onRepay={handleRepay}
                  approveState={approveState}
                  repayState={repayState}
                  activeInvoiceId={activeInvoiceId}
                />
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
