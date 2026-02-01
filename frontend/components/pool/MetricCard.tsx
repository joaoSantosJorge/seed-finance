'use client';

import { Card, Tooltip, MetricSkeleton } from '@/components/ui';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string;
  change?: {
    value: string;
    isPositive: boolean;
  };
  subtext?: string;
  tooltip?: string;
  isLoading?: boolean;
  className?: string;
}

export function MetricCard({
  label,
  value,
  change,
  subtext,
  tooltip,
  isLoading = false,
  className,
}: MetricCardProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <MetricSkeleton />
      </Card>
    );
  }

  return (
    <Card className={className}>
      <div className="flex items-start justify-between">
        <span className="metric-label">{label}</span>
        {tooltip && <Tooltip content={tooltip} />}
      </div>
      <div className="mt-2">
        <span className="metric-value">{value}</span>
      </div>
      {(change || subtext) && (
        <div className="mt-1 flex items-center gap-2">
          {change && (
            <span
              className={cn(
                'flex items-center gap-1 text-body-sm',
                change.isPositive ? 'text-success' : 'text-error'
              )}
            >
              {change.isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {change.value}
            </span>
          )}
          {subtext && (
            <span className="text-body-sm text-cool-gray">{subtext}</span>
          )}
        </div>
      )}
    </Card>
  );
}
