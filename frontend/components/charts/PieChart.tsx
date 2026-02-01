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
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-gray-400">{name}</p>
      <p className="text-sm font-mono text-white">{formattedValue}</p>
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
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
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
  return (
    <div className="space-y-2">
      {data.map((item, index) => (
        <div key={index} className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-xs text-gray-400 flex-1">{item.name}</span>
          <span className="text-xs font-mono text-white">
            {formatValue ? formatValue(item.value) : `${item.value.toFixed(1)}%`}
          </span>
        </div>
      ))}
    </div>
  );
}
