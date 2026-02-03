'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  useDepositToTreasury,
  useWithdrawFromTreasury,
  useRebalanceToTreasury,
  useAccrueTreasuryYield,
  useOptimalTreasuryDeposit,
  useTreasuryValue,
} from '@/hooks/operator/useTreasuryAdmin';
import { usePoolState } from '@/hooks';
import { formatCurrency } from '@/lib/formatters';
import { parseUnits } from 'viem';
import { USDC_DECIMALS } from '@/lib/contracts';
import { ArrowDownToLine, ArrowUpFromLine, RefreshCw, Coins, AlertTriangle } from 'lucide-react';

export function TreasuryActionsForm() {
  const { availableLiquidity, isLoading: poolLoading } = usePoolState();
  const { data: treasuryValue, isLoading: valueLoading } = useTreasuryValue();
  const { data: optimalDeposit, isLoading: optimalLoading } = useOptimalTreasuryDeposit();

  const {
    deposit,
    isPending: depositPending,
    isConfirming: depositConfirming,
    isSuccess: depositSuccess,
    error: depositError,
    reset: resetDeposit,
  } = useDepositToTreasury();

  const {
    withdraw,
    isPending: withdrawPending,
    isConfirming: withdrawConfirming,
    isSuccess: withdrawSuccess,
    error: withdrawError,
    reset: resetWithdraw,
  } = useWithdrawFromTreasury();

  const {
    rebalance,
    isPending: rebalancePending,
    isConfirming: rebalanceConfirming,
    isSuccess: rebalanceSuccess,
    error: rebalanceError,
    reset: resetRebalance,
  } = useRebalanceToTreasury();

  const {
    accrue,
    isPending: accruePending,
    isConfirming: accrueConfirming,
    isSuccess: accrueSuccess,
    error: accrueError,
    reset: resetAccrue,
  } = useAccrueTreasuryYield();

  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const isLoading = poolLoading || valueLoading || optimalLoading;

  // Reset on success
  useEffect(() => {
    if (depositSuccess) {
      setDepositAmount('');
      resetDeposit();
    }
  }, [depositSuccess, resetDeposit]);

  useEffect(() => {
    if (withdrawSuccess) {
      setWithdrawAmount('');
      resetWithdraw();
    }
  }, [withdrawSuccess, resetWithdraw]);

  useEffect(() => {
    if (rebalanceSuccess) {
      resetRebalance();
    }
  }, [rebalanceSuccess, resetRebalance]);

  useEffect(() => {
    if (accrueSuccess) {
      resetAccrue();
    }
  }, [accrueSuccess, resetAccrue]);

  const handleDeposit = () => {
    const amount = parseUnits(depositAmount, USDC_DECIMALS);
    deposit(amount);
  };

  const handleWithdraw = () => {
    const amount = parseUnits(withdrawAmount, USDC_DECIMALS);
    withdraw(amount);
  };

  const handleRebalance = () => {
    rebalance();
  };

  const handleAccrue = () => {
    accrue();
  };

  const canDeposit =
    depositAmount && parseFloat(depositAmount) > 0 && parseFloat(depositAmount) <= Number(availableLiquidity ?? 0n) / 1e6;

  const canWithdraw =
    withdrawAmount && parseFloat(withdrawAmount) > 0 && parseFloat(withdrawAmount) <= Number(treasuryValue ?? 0n) / 1e6;

  const canRebalance = optimalDeposit && optimalDeposit > 0n;

  const error = depositError || withdrawError || rebalanceError || accrueError;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Treasury Actions</CardTitle>
      </CardHeader>

      <div className="space-y-6">
        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-500/10 border-2 border-red-500/20 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-body text-red-400">{error.message}</p>
          </div>
        )}

        {/* Deposit Section */}
        <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] space-y-3">
          <div className="flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5 text-green-500" />
            <h4 className="text-body font-bold text-white uppercase tracking-wider">
              Deposit to Treasury
            </h4>
          </div>
          <p className="text-body-sm text-cool-gray">
            Move USDC to treasury strategy for yield generation.
          </p>
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                disabled={isLoading}
              />
            </div>
            <span className="flex items-center px-3 text-body text-cool-gray">USDC</span>
            <Button
              variant="primary"
              onClick={handleDeposit}
              disabled={!canDeposit || depositPending || depositConfirming}
              isLoading={depositPending || depositConfirming}
            >
              Deposit
            </Button>
          </div>
          <p className="text-body-sm text-cool-gray">
            Available: {formatCurrency(Number(availableLiquidity ?? 0n) / 1e6)} USDC
          </p>
        </div>

        {/* Withdraw Section */}
        <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] space-y-3">
          <div className="flex items-center gap-2">
            <ArrowUpFromLine className="w-5 h-5 text-[var(--text-primary)]" />
            <h4 className="text-body font-bold text-white uppercase tracking-wider">
              Withdraw from Treasury
            </h4>
          </div>
          <p className="text-body-sm text-cool-gray">
            Withdraw USDC from treasury strategy back to pool.
          </p>
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0.00"
                disabled={isLoading}
              />
            </div>
            <span className="flex items-center px-3 text-body text-cool-gray">USDC</span>
            <Button
              variant="secondary"
              onClick={handleWithdraw}
              disabled={!canWithdraw || withdrawPending || withdrawConfirming}
              isLoading={withdrawPending || withdrawConfirming}
            >
              Withdraw
            </Button>
          </div>
          <p className="text-body-sm text-cool-gray">
            In Treasury: {formatCurrency(Number(treasuryValue ?? 0n) / 1e6)} USDC
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          {/* Rebalance */}
          <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] space-y-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-cool-gray" />
              <h4 className="text-body font-bold text-white">Rebalance</h4>
            </div>
            <p className="text-body-sm text-cool-gray">
              Auto-deposit optimal amount to treasury.
            </p>
            {canRebalance && (
              <p className="text-body-sm text-[var(--text-primary)]">
                +{formatCurrency(Number(optimalDeposit) / 1e6)} available
              </p>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRebalance}
              disabled={!canRebalance || rebalancePending || rebalanceConfirming}
              isLoading={rebalancePending || rebalanceConfirming}
              className="w-full"
            >
              Rebalance to Optimal
            </Button>
          </div>

          {/* Accrue Yield */}
          <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] space-y-3">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-cool-gray" />
              <h4 className="text-body font-bold text-white">Accrue Yield</h4>
            </div>
            <p className="text-body-sm text-cool-gray">
              Accrue and record treasury yield earnings.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAccrue}
              disabled={accruePending || accrueConfirming}
              isLoading={accruePending || accrueConfirming}
              className="w-full"
            >
              Accrue Treasury Yield
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
