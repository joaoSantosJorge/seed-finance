'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTreasuryValue, useOptimalTreasuryDeposit } from '@/hooks/operator/useTreasuryAdmin';
import { useMaxTreasuryAllocation } from '@/hooks/operator/usePoolAdmin';
import { usePoolState } from '@/hooks';
import { formatCurrency } from '@/lib/formatters';
import { Vault, TrendingUp, Target, AlertCircle } from 'lucide-react';

export function TreasuryCard() {
  const { data: treasuryValue, isLoading: valueLoading } = useTreasuryValue();
  const { data: optimalDeposit, isLoading: optimalLoading } = useOptimalTreasuryDeposit();
  const { data: maxAllocation, isLoading: allocationLoading } = useMaxTreasuryAllocation();
  const { totalAssets, isLoading: poolLoading } = usePoolState();

  const isLoading = valueLoading || optimalLoading || allocationLoading || poolLoading;

  // Calculate current allocation percentage
  const currentAllocationPct =
    totalAssets && treasuryValue && totalAssets > 0n
      ? (Number(treasuryValue) / Number(totalAssets)) * 100
      : 0;

  const maxAllocationPct = maxAllocation ? Number(maxAllocation) / 100 : 0;

  // Determine if rebalancing is needed
  const needsRebalance = optimalDeposit && optimalDeposit > 0n;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Treasury</CardTitle>
        <Badge variant={needsRebalance ? 'warning' : 'success'}>
          {needsRebalance ? 'REBALANCE AVAILABLE' : 'OPTIMAL'}
        </Badge>
      </CardHeader>

      <div className="space-y-6">
        {/* Treasury Value */}
        <div className="flex items-center gap-4 p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
          <div className="w-12 h-12 bg-[var(--text-primary)]/10 border-2 border-[var(--border-color)] flex items-center justify-center">
            <Vault className="w-6 h-6 text-[var(--text-primary)]" />
          </div>
          <div className="flex-1">
            <p className="text-body-sm text-cool-gray uppercase tracking-wider">
              Treasury Balance
            </p>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-h2 text-white font-mono">
                {formatCurrency(Number(treasuryValue ?? 0n) / 1e6)}
              </p>
            )}
          </div>
        </div>

        {/* Allocation Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-cool-gray" />
              <span className="text-body-sm text-cool-gray uppercase tracking-wider">
                Current Allocation
              </span>
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <p className="text-h3 text-white font-mono">
                {currentAllocationPct.toFixed(1)}%
              </p>
            )}
          </div>

          <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-cool-gray" />
              <span className="text-body-sm text-cool-gray uppercase tracking-wider">
                Max Allocation
              </span>
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <p className="text-h3 text-white font-mono">{maxAllocationPct.toFixed(1)}%</p>
            )}
          </div>
        </div>

        {/* Allocation Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-body-sm text-cool-gray">
            <span>Treasury Allocation</span>
            <span>{currentAllocationPct.toFixed(1)}% / {maxAllocationPct}%</span>
          </div>
          <div className="h-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] overflow-hidden relative">
            {/* Current allocation */}
            <div
              className="absolute inset-y-0 left-0 bg-[var(--text-primary)]"
              style={{ width: `${Math.min(currentAllocationPct, 100)}%` }}
            />
            {/* Max allocation marker */}
            <div
              className="absolute inset-y-0 w-0.5 bg-white"
              style={{ left: `${Math.min(maxAllocationPct, 100)}%` }}
            />
          </div>
        </div>

        {/* Optimal Deposit Info */}
        {needsRebalance && (
          <div className="p-4 bg-yellow-500/10 border-2 border-yellow-500/20 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-body font-medium text-white">Rebalance Available</p>
              <p className="text-body-sm text-cool-gray">
                {formatCurrency(Number(optimalDeposit) / 1e6)} USDC can be deposited to treasury
                for optimal yield.
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
