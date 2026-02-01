'use client';

import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from 'recharts';
import type { TimeSeriesPoint } from '@/types';

interface SparklineProps {
  data: TimeSeriesPoint[];
  color?: string;
  height?: number;
  width?: number | string;
  positive?: boolean;
}

export function Sparkline({
  data,
  color,
  height = 40,
  width = 100,
  positive,
}: SparklineProps) {
  // Determine color based on trend if not provided
  const lineColor = color || (positive === undefined
    ? '#3B82F6' // Default blue
    : positive
      ? '#10B981' // Green for positive
      : '#F43F5E'); // Red for negative

  return (
    <ResponsiveContainer width={width} height={height}>
      <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`sparkline-gradient-${lineColor}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={lineColor} stopOpacity={0.3} />
            <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={lineColor}
          strokeWidth={1.5}
          fill={`url(#sparkline-gradient-${lineColor})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
