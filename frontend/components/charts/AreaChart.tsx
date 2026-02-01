'use client';

import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TimeSeriesPoint } from '@/types';

interface AreaChartProps {
  data: TimeSeriesPoint[];
  dataKey?: string;
  xAxisKey?: string;
  color?: string;
  gradientId?: string;
  height?: number;
  showGrid?: boolean;
  showAxis?: boolean;
  formatValue?: (value: number) => string;
  formatLabel?: (timestamp: number) => string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: number;
  formatValue?: (value: number) => string;
  formatLabel?: (timestamp: number) => string;
}

const CustomTooltip = ({
  active,
  payload,
  label,
  formatValue,
  formatLabel,
}: CustomTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const value = payload[0].value;
  const formattedValue = formatValue ? formatValue(value) : value.toFixed(2);
  const formattedLabel = formatLabel && label !== undefined ? formatLabel(label) : String(label);

  return (
    <div className="bg-[var(--border-color)] text-[var(--bg-primary)] border-2 border-[var(--border-color)] px-3 py-2 text-xs">
      <p className="font-bold">{formattedLabel}</p>
      <p className="font-bold">{formattedValue}</p>
    </div>
  );
};

export function AreaChart({
  data,
  dataKey = 'value',
  xAxisKey = 'timestamp',
  color = 'var(--accent)',
  gradientId = 'colorValue',
  height = 200,
  showGrid = true,
  showAxis = true,
  formatValue,
  formatLabel,
}: AreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--text-muted)"
            strokeOpacity={0.3}
            vertical={false}
          />
        )}
        {showAxis && (
          <>
            <XAxis
              dataKey={xAxisKey}
              stroke="var(--text-muted)"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-color)', strokeWidth: 2 }}
              tickFormatter={formatLabel}
              fontFamily="Courier Prime"
            />
            <YAxis
              stroke="var(--text-muted)"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-color)', strokeWidth: 2 }}
              tickFormatter={formatValue}
              width={60}
              fontFamily="Courier Prime"
            />
          </>
        )}
        <Tooltip
          content={({ active, payload, label }) => (
            <CustomTooltip
              active={active}
              payload={payload as Array<{ value: number }>}
              label={label as number}
              formatValue={formatValue}
              formatLabel={formatLabel}
            />
          )}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
        />
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
}
