'use client';

import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface PieChartData {
  name: string;
  value: number;
  color: string;
}

interface PieChartProps {
  data: PieChartData[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  formatValue?: (value: number) => string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: PieChartData }>;
  formatValue?: (value: number) => string;
}

const CustomTooltip = ({
  active,
  payload,
  formatValue,
}: CustomTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const { name, value } = payload[0].payload;
  const formattedValue = formatValue ? formatValue(value) : `${value.toFixed(1)}%`;

  return (
    <div className="bg-[var(--border-color)] text-[var(--bg-primary)] border-2 border-[var(--border-color)] px-3 py-2 text-xs">
      <p className="font-bold">{name}</p>
      <p className="font-bold">{formattedValue}</p>
    </div>
  );
};

export function PieChart({
  data,
  height = 200,
  innerRadius = 60,
  outerRadius = 80,
  formatValue,
}: PieChartProps) {
  // Override colors to retro palette - grayscale only
  const retroColors = [
    'var(--text-primary)',   // Main
    'var(--text-secondary)', // Secondary
    'var(--text-muted)',     // Muted
  ];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsPieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={2}
          dataKey="value"
          stroke="var(--bg-primary)"
          strokeWidth={2}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={retroColors[index % retroColors.length]} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => (
            <CustomTooltip
              active={active}
              payload={payload as Array<{ payload: PieChartData }>}
              formatValue={formatValue}
            />
          )}
        />
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}

// Legend component for pie charts
interface PieChartLegendProps {
  data: PieChartData[];
  formatValue?: (value: number) => string;
}

export function PieChartLegend({ data, formatValue }: PieChartLegendProps) {
  const retroColors = [
    'var(--text-primary)',
    'var(--text-secondary)',
    'var(--text-muted)',
  ];

  return (
    <div className="space-y-2">
      {data.map((item, index) => (
        <div key={index} className="flex items-center gap-3">
          <div
            className="w-4 h-4 border-2 border-[var(--border-color)]"
            style={{ backgroundColor: retroColors[index % retroColors.length] }}
          />
          <span className="text-xs text-[var(--text-muted)] flex-1 uppercase tracking-wider">{item.name}</span>
          <span className="text-xs font-bold text-[var(--text-primary)]">
            {formatValue ? formatValue(item.value) : `${item.value.toFixed(1)}%`}
          </span>
        </div>
      ))}
    </div>
  );
}
