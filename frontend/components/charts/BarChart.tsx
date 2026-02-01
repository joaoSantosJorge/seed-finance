'use client';

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface BarChartData {
  name: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartData[];
  height?: number;
  color?: string;
  formatValue?: (value: number) => string;
  layout?: 'horizontal' | 'vertical';
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: BarChartData }>;
  formatValue?: (value: number) => string;
}

const CustomTooltip = ({
  active,
  payload,
  formatValue,
}: CustomTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const { name, value } = payload[0].payload;
  const formattedValue = formatValue ? formatValue(value) : value.toFixed(2);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-gray-400">{name}</p>
      <p className="text-sm font-mono text-white">{formattedValue}</p>
    </div>
  );
};

export function BarChart({
  data,
  height = 200,
  color = '#3B82F6',
  formatValue,
  layout = 'horizontal',
}: BarChartProps) {
  if (layout === 'vertical') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 5, bottom: 5, left: 100 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#334155"
            strokeOpacity={0.5}
            horizontal={false}
          />
          <XAxis
            type="number"
            stroke="#64748B"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatValue}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="#64748B"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={100}
          />
          <Tooltip
            content={({ active, payload }) => (
              <CustomTooltip
                active={active}
                payload={payload as Array<{ payload: BarChartData }>}
                formatValue={formatValue}
              />
            )}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || color} />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart
        data={data}
        margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#334155"
          strokeOpacity={0.5}
          vertical={false}
        />
        <XAxis
          dataKey="name"
          stroke="#64748B"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#64748B"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatValue}
        />
        <Tooltip
          content={({ active, payload }) => (
            <CustomTooltip
              active={active}
              payload={payload as Array<{ payload: BarChartData }>}
              formatValue={formatValue}
            />
          )}
        />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color || color} />
          ))}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
