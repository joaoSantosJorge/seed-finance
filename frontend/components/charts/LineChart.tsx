'use client';

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TimeSeriesPoint } from '@/types';

interface LineChartProps {
  data: TimeSeriesPoint[];
  dataKey?: string;
  xAxisKey?: string;
  color?: string;
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
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-gray-400">{formattedLabel}</p>
      <p className="text-sm font-mono text-white">{formattedValue}</p>
    </div>
  );
};

export function LineChart({
  data,
  dataKey = 'value',
  xAxisKey = 'timestamp',
  color = '#3B82F6',
  height = 200,
  showGrid = true,
  showAxis = true,
  formatValue,
  formatLabel,
}: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#334155"
            strokeOpacity={0.5}
            vertical={false}
          />
        )}
        {showAxis && (
          <>
            <XAxis
              dataKey={xAxisKey}
              stroke="#64748B"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatLabel}
            />
            <YAxis
              stroke="#64748B"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatValue}
              width={60}
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
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: color }}
        />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
