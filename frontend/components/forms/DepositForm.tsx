'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { Card, CardHeader, CardTitle, Skeleton } from '@/components/ui';
import { TransactionButton } from '@/components/wallet';
import { AmountInput, QuickAmountButtons } from './AmountInput';
import {
  useUSDCBalance,
  useUSDCAllowanceForPool,
  useApproveUSDC,
  useDeposit,
  usePreviewDeposit,
  usePoolState,
} from '@/hooks';
import { USDC_DECIMALS } from '@/lib/contracts';
import { formatCurrency, formatShares } from '@/lib/formatters';
import { Check, Circle } from 'lucide-react';

interface DepositFormProps {
  onSuccess?: () => void;
}

export function DepositForm({ onSuccess }: DepositFormProps) {
  const { address } = useAccount();

  const [amount, setAmount] = useState('');
  const [rawAmount, setRawAmount] = useState(0n);

  // Data hooks
  const { data: usdcBalance, isLoading: loadingBalance } = useUSDCBalance(address);
  const { data: allowance, refetch: refetchAllowance } = useUSDCAllowanceForPool(address);
  const { data: previewShares } = usePreviewDeposit(rawAmount > 0n ? rawAmount : undefined);
  const { formattedState: poolState } = usePoolState();

  // Transaction hooks
  const {
    approvePool,
    hash: approveHash,
    isPending: approvePending,
    isConfirming: approveConfirming,
    isSuccess: approveSuccess,
    error: approveError,
  } = useApproveUSDC();

  const {
    deposit,
    hash: depositHash,
    isPending: depositPending,
    isConfirming: depositConfirming,
    isSuccess: depositSuccess,
    error: depositError,
  } = useDeposit();

  // Derived state
  const needsApproval = allowance !== undefined && rawAmount > 0n && allowance < rawAmount;
  const hasBalance = usdcBalance !== undefined && rawAmount > 0n && usdcBalance >= rawAmount;

  // Refetch allowance after approval
  useEffect(() => {
    if (approveSuccess) {
      refetchAllowance();
    }
  }, [approveSuccess, refetchAllowance]);

  // Call onSuccess after deposit
  useEffect(() => {
    if (depositSuccess) {
      onSuccess?.();
    }
  }, [depositSuccess, onSuccess]);

  const handleAmountChange = (value: string, raw: bigint) => {
    setAmount(value);
    setRawAmount(raw);
  };

  const handleQuickAmount = (value: bigint) => {
    setRawAmount(value);
    setAmount(formatUnits(value, USDC_DECIMALS));
  };

  const handleApprove = () => {
    if (rawAmount > 0n) {
      approvePool(rawAmount);
    }
  };

  const handleDeposit = () => {
    if (rawAmount > 0n && address) {
      deposit(rawAmount, address);
    }
  };

  // Validation
  const getError = () => {
    if (rawAmount > 0n && usdcBalance !== undefined && rawAmount > usdcBalance) {
      return 'Insufficient USDC balance';
    }
    return undefined;
  };

  const error = getError();
  const isValid = rawAmount > 0n && !error;

  // Calculate estimated yields
  const estimatedAPY = 7.42;
  const monthlyYield = rawAmount > 0n
    ? parseFloat(formatUnits(rawAmount, USDC_DECIMALS)) * (estimatedAPY / 100 / 12)
    : 0;

  return (
    <div className="space-y-6">
      {/* Wallet Balance */}
      <Card>
        <CardHeader>
          <CardTitle>Your Wallet</CardTitle>
        </CardHeader>
        <div className="flex justify-between items-center">
          <span className="text-body text-cool-gray">USDC Balance</span>
          {loadingBalance ? (
            <Skeleton className="h-5 w-24" />
          ) : (
            <span className="text-body font-mono text-white">
              {usdcBalance ? formatCurrency(parseFloat(formatUnits(usdcBalance, USDC_DECIMALS))) : '$0.00'}
            </span>
          )}
        </div>
      </Card>

      {/* Amount Input */}
      <Card>
        <CardHeader>
          <CardTitle>Deposit Amount</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <AmountInput
            value={amount}
            onChange={handleAmountChange}
            maxValue={usdcBalance}
            rightElement="USDC"
            error={error}
            disabled={depositPending || depositConfirming || depositSuccess}
          />
          {usdcBalance && usdcBalance > 0n && (
            <QuickAmountButtons
              maxValue={usdcBalance}
              onSelect={handleQuickAmount}
            />
          )}
        </div>
      </Card>

      {/* Preview */}
      {rawAmount > 0n && (
        <Card>
          <CardHeader>
            <CardTitle>You Will Receive</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-body text-cool-gray">SEED Shares</span>
              <span className="text-body font-mono text-white">
                {previewShares ? formatShares(previewShares) : '—'} SEED
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-body text-cool-gray">Share Price</span>
              <span className="text-body font-mono text-white">
                {poolState?.sharePrice || '1.0000'} USDC
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-body text-cool-gray">Estimated APY</span>
              <span className="text-body font-mono text-success">
                {estimatedAPY.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-body text-cool-gray">Est. Monthly Yield</span>
              <span className="text-body font-mono text-white">
                ~{formatCurrency(monthlyYield)}
              </span>
            </div>

            <div className="pt-3 border-t border-slate-700">
              <p className="text-body-sm text-cool-gray">Pool Info:</p>
              <ul className="mt-2 space-y-1 text-body-sm text-silver">
                <li>• Current Utilization: {poolState?.utilizationRate || '0%'}</li>
                <li>• Avg. Invoice Duration: 45 days</li>
                <li>• Default Rate (30d): 0.0%</li>
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Transaction Steps */}
      {rawAmount > 0n && (
        <Card>
          <CardHeader>
            <CardTitle>Transaction Steps</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {/* Step 1: Approve */}
            <div className="flex items-center gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  approveSuccess || !needsApproval
                    ? 'bg-success'
                    : 'bg-slate-700'
                }`}
              >
                {approveSuccess || !needsApproval ? (
                  <Check className="w-4 h-4 text-white" />
                ) : (
                  <Circle className="w-4 h-4 text-cool-gray" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-body text-white">Approve USDC spending</p>
                {needsApproval && !approveSuccess && (
                  <p className="text-body-sm text-cool-gray">
                    Allow the pool to use your USDC
                  </p>
                )}
              </div>
              {needsApproval && !approveSuccess && (
                <span className="text-body-sm text-cool-gray">
                  {approvePending ? 'Waiting...' : approveConfirming ? 'Confirming...' : 'Pending'}
                </span>
              )}
              {(approveSuccess || !needsApproval) && (
                <span className="text-body-sm text-success">Done</span>
              )}
            </div>

            {/* Step 2: Deposit */}
            <div className="flex items-center gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  depositSuccess ? 'bg-success' : 'bg-slate-700'
                }`}
              >
                {depositSuccess ? (
                  <Check className="w-4 h-4 text-white" />
                ) : (
                  <Circle className="w-4 h-4 text-cool-gray" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-body text-white">Deposit to pool</p>
                {!depositSuccess && (
                  <p className="text-body-sm text-cool-gray">
                    Receive SEED shares
                  </p>
                )}
              </div>
              <span className="text-body-sm text-cool-gray">
                {depositSuccess
                  ? 'Done'
                  : depositPending
                    ? 'Waiting...'
                    : depositConfirming
                      ? 'Confirming...'
                      : 'Pending'}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Action Button */}
      <div>
        {depositSuccess ? (
          <TransactionButton
            onClick={() => {}}
            isPending={false}
            isConfirming={false}
            isSuccess={true}
            hash={depositHash}
            successText="Deposit Successful!"
          >
            Deposit
          </TransactionButton>
        ) : needsApproval && !approveSuccess ? (
          <TransactionButton
            onClick={handleApprove}
            isPending={approvePending}
            isConfirming={approveConfirming}
            isSuccess={approveSuccess}
            hash={approveHash}
            disabled={!isValid}
            pendingText="Confirm approval..."
            confirmingText="Approving..."
            className="w-full"
          >
            Approve USDC
          </TransactionButton>
        ) : (
          <TransactionButton
            onClick={handleDeposit}
            isPending={depositPending}
            isConfirming={depositConfirming}
            isSuccess={depositSuccess}
            hash={depositHash}
            disabled={!isValid || !hasBalance}
            pendingText="Confirm deposit..."
            confirmingText="Depositing..."
            className="w-full"
          >
            {!isValid ? 'Enter amount' : !hasBalance ? 'Insufficient balance' : 'Deposit'}
          </TransactionButton>
        )}

        {(approveError || depositError) && (
          <p className="mt-2 text-body-sm text-error">
            {(approveError || depositError)?.message || 'Transaction failed'}
          </p>
        )}
      </div>
    </div>
  );
}
