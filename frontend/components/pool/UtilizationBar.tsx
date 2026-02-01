'use client';

import { usePoolState } from '@/hooks';
import { Skeleton, Tooltip } from '@/components/ui';

interface AllocationSegment {
  label: string;
  value: string;
  percentage: number;
  color: string;
}

export function UtilizationBar() {
  const { poolState, formattedState, isLoading } = usePoolState();

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (!poolState || !formattedState) {
    return null;
  }

  // Calculate allocation percentages
  const totalAssets = Number(poolState.totalAssets);
  const deployed = Number(poolState.totalDeployed);
  const treasury = Number(poolState.totalInTreasury);
  const available = Number(poolState.availableLiquidity);

  const deployedPct = totalAssets > 0 ? (deployed / totalAssets) * 100 : 0;
  const treasuryPct = totalAssets > 0 ? (treasury / totalAssets) * 100 : 0;
  const availablePct = totalAssets > 0 ? (available / totalAssets) * 100 : 0;

  const segments: AllocationSegment[] = [
    {
      label: 'In Invoices',
      value: formattedState.totalDeployed,
      percentage: deployedPct,
      color: '#3B82F6', // Primary blue
    },
    {
      label: 'Treasury',
      value: formattedState.totalInTreasury,
      percentage: treasuryPct,
      color: '#10B981', // Success green
    },
    {
      label: 'Available',
      value: formattedState.availableLiquidity,
      percentage: availablePct,
      color: '#64748B', // Cool gray
    },
  ];

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="h-4 bg-slate-700 rounded-full overflow-hidden flex">
        {segments.map((segment, index) => (
          <Tooltip
            key={index}
            content={`${segment.label}: ${segment.value} (${segment.percentage.toFixed(1)}%)`}
          >
            <div
              className="h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${segment.percentage}%`,
                backgroundColor: segment.color,
              }}
            />
          </Tooltip>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {segments.map((segment, index) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            <span className="text-body-sm text-cool-gray">{segment.label}:</span>
            <span className="text-body-sm font-mono text-white">{segment.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
