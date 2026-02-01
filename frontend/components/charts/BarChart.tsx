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
    <div className="bg-[var(--border-color)] text-[var(--bg-primary)] border-2 border-[var(--border-color)] px-3 py-2 text-xs">
      <p className="font-bold">{name}</p>
      <p className="font-bold">{formattedValue}</p>
    </div>
  );
};

export function BarChart({
  data,
  height = 200,
  color = 'var(--text-primary)',
  formatValue,
  layout = 'horizontal',
}: BarChartProps) {
  // Retro colors - grayscale with accent
  const retroColors = [
    'var(--accent)',      // Red accent for first/main
    'var(--text-primary)', // Black
    'var(--text-muted)',   // Gray
    'var(--text-secondary)', // Lighter gray
  ];

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
            stroke="var(--text-muted)"
            strokeOpacity={0.3}
            horizontal={false}
          />
          <XAxis
            type="number"
            stroke="var(--text-muted)"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: 'var(--border-color)', strokeWidth: 2 }}
            tickFormatter={formatValue}
            fontFamily="Courier Prime"
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="var(--text-muted)"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: 'var(--border-color)', strokeWidth: 2 }}
            width={100}
            fontFamily="Courier Prime"
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
          <Bar dataKey="value" radius={[0, 0, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || retroColors[index % retroColors.length]} />
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
          stroke="var(--text-muted)"
          strokeOpacity={0.3}
          vertical={false}
        />
        <XAxis
          dataKey="name"
          stroke="var(--text-muted)"
          fontSize={10}
          tickLine={false}
          axisLine={{ stroke: 'var(--border-color)', strokeWidth: 2 }}
          fontFamily="Courier Prime"
        />
        <YAxis
          stroke="var(--text-muted)"
          fontSize={10}
          tickLine={false}
          axisLine={{ stroke: 'var(--border-color)', strokeWidth: 2 }}
          tickFormatter={formatValue}
          fontFamily="Courier Prime"
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
        <Bar dataKey="value" fill={color} radius={[0, 0, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color || retroColors[index % retroColors.length]} />
          ))}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
