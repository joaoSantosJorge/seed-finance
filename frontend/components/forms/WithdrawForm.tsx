'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { Card, CardHeader, CardTitle, Skeleton, Badge } from '@/components/ui';
import { TransactionButton } from '@/components/wallet';
import { AmountInput, QuickAmountButtons } from './AmountInput';
import {
  useUserShares,
  useMaxWithdraw,
  useWithdraw,
  useRedeem,
  usePreviewWithdraw,
  usePreviewRedeem,
  usePoolState,
  useAvailableLiquidity,
} from '@/hooks';
import { USDC_DECIMALS, SFUSDC_DECIMALS } from '@/lib/contracts';
import { formatCurrency, formatShares } from '@/lib/formatters';
import { calculateAssetsForShares } from '@/lib/calculations';
import { AlertTriangle } from 'lucide-react';

type WithdrawMode = 'assets' | 'shares' | 'all';

interface WithdrawFormProps {
  onSuccess?: () => void;
}

export function WithdrawForm({ onSuccess }: WithdrawFormProps) {
  const { address } = useAccount();

  const [mode, setMode] = useState<WithdrawMode>('assets');
  const [amount, setAmount] = useState('');
  const [rawAmount, setRawAmount] = useState(0n);

  // Data hooks
  const { data: userShares, isLoading: loadingShares } = useUserShares(address);
  const { data: maxWithdraw } = useMaxWithdraw(address);
  const { data: availableLiquidity } = useAvailableLiquidity();
  const { poolState } = usePoolState();

  // Preview calculations
  const { data: previewSharesNeeded } = usePreviewWithdraw(
    mode === 'assets' && rawAmount > 0n ? rawAmount : undefined
  );
  const { data: previewAssetsReceived } = usePreviewRedeem(
    mode === 'shares' && rawAmount > 0n ? rawAmount : undefined
  );

  // Transaction hooks
  const {
    withdraw,
    hash: withdrawHash,
    isPending: withdrawPending,
    isConfirming: withdrawConfirming,
    isSuccess: withdrawSuccess,
    error: withdrawError,
  } = useWithdraw();

  const {
    redeem,
    hash: redeemHash,
    isPending: redeemPending,
    isConfirming: redeemConfirming,
    isSuccess: redeemSuccess,
    error: redeemError,
  } = useRedeem();

  // Computed values
  const currentValue = userShares && poolState
    ? calculateAssetsForShares(userShares, poolState.totalAssets, poolState.totalSupply)
    : 0n;

  const assetsToReceive =
    mode === 'all' && maxWithdraw
      ? maxWithdraw
      : mode === 'assets'
        ? rawAmount
        : previewAssetsReceived || 0n;

  const sharesToBurn =
    mode === 'all' && userShares
      ? userShares
      : mode === 'shares'
        ? rawAmount
        : previewSharesNeeded || 0n;

  const remainingValue = currentValue - assetsToReceive;
  const remainingShares = userShares ? userShares - sharesToBurn : 0n;

  // Liquidity check
  const needsTreasuryWithdraw = availableLiquidity !== undefined && assetsToReceive > availableLiquidity;

  // Call onSuccess after withdrawal
  useEffect(() => {
    if (withdrawSuccess || redeemSuccess) {
      onSuccess?.();
    }
  }, [withdrawSuccess, redeemSuccess, onSuccess]);

  const handleAmountChange = (value: string, raw: bigint) => {
    setAmount(value);
    setRawAmount(raw);
  };

  const handleQuickAmount = (value: bigint) => {
    setRawAmount(value);
    const decimals = mode === 'shares' ? SFUSDC_DECIMALS : USDC_DECIMALS;
    setAmount(formatUnits(value, decimals));
  };

  const handleModeChange = (newMode: WithdrawMode) => {
    setMode(newMode);
    setAmount('');
    setRawAmount(0n);
  };

  const handleWithdraw = () => {
    if (!address) return;

    if (mode === 'all' && userShares && userShares > 0n) {
      redeem(userShares, address, address);
    } else if (mode === 'shares' && rawAmount > 0n) {
      redeem(rawAmount, address, address);
    } else if (mode === 'assets' && rawAmount > 0n) {
      withdraw(rawAmount, address, address);
    }
  };

  // Validation
  const getError = () => {
    if (mode === 'assets' && maxWithdraw !== undefined && rawAmount > maxWithdraw) {
      return 'Amount exceeds maximum withdrawable';
    }
    if (mode === 'shares' && userShares !== undefined && rawAmount > userShares) {
      return 'Insufficient shares';
    }
    return undefined;
  };

  const error = getError();
  const isValid = (mode === 'all' && userShares && userShares > 0n) || (rawAmount > 0n && !error);
  const isSuccess = withdrawSuccess || redeemSuccess;
  const isPending = withdrawPending || redeemPending;
  const isConfirming = withdrawConfirming || redeemConfirming;
  const txHash = withdrawHash || redeemHash;
  const txError = withdrawError || redeemError;

  return (
    <div className="space-y-6">
      {/* Current Position */}
      <Card>
        <CardHeader>
          <CardTitle>Your Position</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-body text-cool-gray">sfUSDC Balance</span>
            {loadingShares ? (
              <Skeleton className="h-5 w-24" />
            ) : (
              <span className="text-body font-mono text-white">
                {userShares ? formatShares(userShares) : '0.00'} sfUSDC
              </span>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-body text-cool-gray">Current Value</span>
            <span className="text-body font-mono text-white">
              {formatCurrency(parseFloat(formatUnits(currentValue, USDC_DECIMALS)))}
            </span>
          </div>
        </div>
      </Card>

      {/* Withdrawal Mode */}
      <Card>
        <CardHeader>
          <CardTitle>Withdrawal Mode</CardTitle>
        </CardHeader>
        <div className="space-y-2">
          {[
            { value: 'assets' as const, label: 'Withdraw by USDC amount' },
            { value: 'shares' as const, label: 'Withdraw by share amount' },
            { value: 'all' as const, label: 'Withdraw ALL' },
          ].map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/50 cursor-pointer hover:bg-slate-700 transition-colors"
            >
              <input
                type="radio"
                name="mode"
                value={option.value}
                checked={mode === option.value}
                onChange={() => handleModeChange(option.value)}
                className="w-4 h-4 text-primary"
                disabled={isSuccess}
              />
              <span className="text-body text-white">{option.label}</span>
            </label>
          ))}
        </div>
      </Card>

      {/* Amount Input (not shown for "all" mode) */}
      {mode !== 'all' && (
        <Card>
          <CardHeader>
            <CardTitle>Withdraw Amount</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <AmountInput
              value={amount}
              onChange={handleAmountChange}
              maxValue={mode === 'shares' ? userShares : maxWithdraw}
              decimals={mode === 'shares' ? SFUSDC_DECIMALS : USDC_DECIMALS}
              rightElement={mode === 'shares' ? 'sfUSDC' : 'USDC'}
              error={error}
              disabled={isPending || isConfirming || isSuccess}
            />
            {mode === 'shares' && userShares && userShares > 0n && (
              <QuickAmountButtons
                maxValue={userShares}
                onSelect={handleQuickAmount}
                decimals={SFUSDC_DECIMALS}
              />
            )}
            {mode === 'assets' && maxWithdraw && maxWithdraw > 0n && (
              <QuickAmountButtons
                maxValue={maxWithdraw}
                onSelect={handleQuickAmount}
              />
            )}
          </div>
        </Card>
      )}

      {/* Preview */}
      {(mode === 'all' || rawAmount > 0n) && (
        <Card>
          <CardHeader>
            <CardTitle>Withdrawal Preview</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-body text-cool-gray">Shares to Burn</span>
              <span className="text-body font-mono text-white">
                {formatShares(sharesToBurn)} sfUSDC
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-body text-cool-gray">You Will Receive</span>
              <span className="text-body font-mono text-white">
                {formatCurrency(parseFloat(formatUnits(assetsToReceive, USDC_DECIMALS)))} USDC
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-body text-cool-gray">Remaining Position</span>
              <span className="text-body font-mono text-white">
                {formatCurrency(parseFloat(formatUnits(remainingValue, USDC_DECIMALS)))}
                <span className="text-cool-gray ml-1">
                  ({formatShares(remainingShares)} sfUSDC)
                </span>
              </span>
            </div>

            {/* Liquidity Warning */}
            {needsTreasuryWithdraw && (
              <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-body-sm text-warning font-medium">Liquidity Note</p>
                  <p className="text-body-sm text-silver mt-1">
                    This withdrawal exceeds available liquidity and will require a treasury redemption.
                    The transaction may take slightly longer.
                  </p>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-700">
              <div className="flex items-center gap-2">
                <span className="text-body-sm text-cool-gray">Available instant:</span>
                <span className="text-body-sm font-mono text-white">
                  {availableLiquidity
                    ? formatCurrency(parseFloat(formatUnits(availableLiquidity, USDC_DECIMALS)))
                    : '$0.00'}
                </span>
                {!needsTreasuryWithdraw && <Badge variant="success" size="sm">Instant</Badge>}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Action Button */}
      <TransactionButton
        onClick={handleWithdraw}
        isPending={isPending}
        isConfirming={isConfirming}
        isSuccess={isSuccess}
        hash={txHash}
        disabled={!isValid}
        pendingText="Confirm withdrawal..."
        confirmingText="Withdrawing..."
        successText="Withdrawal Successful!"
        className="w-full"
      >
        {!isValid ? 'Enter amount' : 'Withdraw'}
      </TransactionButton>

      {txError && (
        <p className="mt-2 text-body-sm text-error">
          {txError?.message || 'Transaction failed'}
        </p>
      )}
    </div>
  );
}
