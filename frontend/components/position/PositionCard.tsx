'use client';

import { useUserPosition, usePoolState } from '@/hooks';
import { Card, Skeleton, Tooltip, tooltipContent } from '@/components/ui';
import { TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { formatUnits } from 'viem';
import { USDC_DECIMALS } from '@/lib/contracts';

export function PositionCard() {
  const { position, formattedPosition, isLoading, isConnected } = useUserPosition();
  const { formattedState, isLoading: poolLoading } = usePoolState();

  if (!isConnected) {
    return (
      <Card className="text-center py-12">
        <p className="text-cool-gray">Connect your wallet to view your position</p>
      </Card>
    );
  }

  if (isLoading || poolLoading) {
    return (
      <Card>
        <div className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-40" />
          <div className="flex gap-8">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-32" />
          </div>
        </div>
      </Card>
    );
  }

  if (!position || position.sharesOwned === 0n) {
    return (
      <Card className="text-center py-12">
        <p className="text-cool-gray mb-2">No position yet</p>
        <p className="text-body-sm text-silver">
          Deposit USDC to start earning yield
        </p>
      </Card>
    );
  }

  // Calculate estimated APY (mock for now - would come from yield metrics)
  const estimatedAPY = 7.42;
  const monthlyYield = parseFloat(formatUnits(position.currentValue, USDC_DECIMALS)) * (estimatedAPY / 100 / 12);

  return (
    <Card>
      <div className="space-y-6">
        {/* Main Value */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="metric-label">YOUR POSITION</span>
            <Tooltip content={tooltipContent.sfUSDC} />
          </div>
          <div className="text-display font-mono text-white">
            {formattedPosition?.currentValue}
          </div>
          {position.unrealizedGain !== 0n && (
            <div className="flex items-center gap-1 mt-1 text-success">
              <TrendingUp className="w-4 h-4" />
              <span className="text-body">
                {formattedPosition?.unrealizedGain} ({formattedPosition?.unrealizedGainPercent})
              </span>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-700">
          <div>
            <p className="text-body-sm text-cool-gray mb-1">sfUSDC Shares</p>
            <p className="text-body font-mono text-white">{formattedPosition?.sharesOwned}</p>
          </div>
          <div>
            <p className="text-body-sm text-cool-gray mb-1">Share Price</p>
            <p className="text-body font-mono text-white">{formattedState?.sharePrice} USDC</p>
          </div>
          <div>
            <p className="text-body-sm text-cool-gray mb-1">Est. APY</p>
            <p className="text-body font-mono text-success">{estimatedAPY.toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-body-sm text-cool-gray mb-1">Est. Monthly</p>
            <p className="text-body font-mono text-white">~{formatCurrency(monthlyYield)}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
