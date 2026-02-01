'use client';

import { usePoolState } from '@/hooks';
import { MetricCard } from './MetricCard';
import { tooltipContent } from '@/components/ui';

export function PoolMetrics() {
  const { formattedState, isLoading } = usePoolState();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        label="Total Value Locked"
        value={formattedState?.totalAssets ?? '$0.00'}
        isLoading={isLoading}
      />
      <MetricCard
        label="Utilization Rate"
        value={formattedState?.utilizationRate ?? '0%'}
        tooltip={tooltipContent.utilizationRate}
        isLoading={isLoading}
      />
      <MetricCard
        label="Treasury Allocation"
        value={formattedState?.treasuryAllocationRate ?? '0%'}
        tooltip={tooltipContent.treasuryAllocation}
        isLoading={isLoading}
      />
      <MetricCard
        label="Share Price"
        value={formattedState?.sharePrice ? `${formattedState.sharePrice} USDC` : '1.0000 USDC'}
        tooltip={tooltipContent.sharePrice}
        isLoading={isLoading}
      />
    </div>
  );
}
