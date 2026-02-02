'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/layout';
import { Card, CardHeader, CardTitle, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { MetricCard } from '@/components/pool';
import { AreaChart, BarChart } from '@/components/charts';
import { usePoolState } from '@/hooks';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import type { TimePeriod } from '@/types';

// Empty data - will be populated from real contract data
const mockYieldHistory: { timestamp: number; value: number }[] = [];

const mockUtilizationHistory: { timestamp: number; value: number }[] = [];

// APY comparison with real market rates; Seed Finance LP shows — until real data available
const mockAPYComparison = [
  { name: 'Seed Finance LP', value: 0, color: '#3B82F6' },
  { name: 'US Treasury Bills', value: 5.25, color: '#F59E0B' },
  { name: 'Aave USDC', value: 4.12, color: '#10B981' },
  { name: 'Compound USDC', value: 3.85, color: '#64748B' },
];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<TimePeriod>('30d');
  const { formattedState, isLoading } = usePoolState();

  // Default metrics - will be populated from real contract data
  const periodMetrics = {
    '7d': { apy: 0, change: 0, yield: 0 },
    '30d': { apy: 0, change: 0, yield: 0 },
    '90d': { apy: 0, change: 0, yield: 0 },
    '1y': { apy: 0, change: 0, yield: 0 },
    'all': { apy: 0, change: 0, yield: 0 },
  };

  const currentMetrics = periodMetrics[period];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yield Analytics"
        description="Detailed performance metrics and pool health"
        backHref="/dashboard/financier"
      />

      {/* Period Selector */}
      <Tabs defaultValue="30d" onChange={(v) => setPeriod(v as TimePeriod)}>
        <TabsList>
          <TabsTrigger value="7d">7D</TabsTrigger>
          <TabsTrigger value="30d">30D</TabsTrigger>
          <TabsTrigger value="90d">90D</TabsTrigger>
          <TabsTrigger value="1y">1Y</TabsTrigger>
          <TabsTrigger value="all">ALL</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Period APY"
          value={formatPercent(currentMetrics.apy)}
          change={{
            value: `${currentMetrics.change >= 0 ? '+' : ''}${formatPercent(currentMetrics.change)} vs prev`,
            isPositive: currentMetrics.change >= 0,
          }}
          isLoading={isLoading}
        />
        <MetricCard
          label="Period Yield"
          value={formatCurrency(currentMetrics.yield)}
          subtext={period === '30d' ? '30-day earnings' : `${period} earnings`}
          isLoading={isLoading}
        />
        <MetricCard
          label="Projected Annual"
          value={formatCurrency(0)}
          subtext="at current rate"
          isLoading={isLoading}
        />
      </div>

      {/* Yield Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Yield Over Time</CardTitle>
        </CardHeader>
        {mockYieldHistory.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-cool-gray text-body-sm">No data available</p>
          </div>
        ) : (
          <AreaChart
            data={mockYieldHistory}
            color="#10B981"
            height={300}
            formatValue={(v) => formatCurrency(v)}
            formatLabel={(t) =>
              new Date(t * 1000).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })
            }
          />
        )}
        <div className="mt-4 flex items-center gap-6 justify-center">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-success rounded-full" />
            <span className="text-body-sm text-cool-gray">Invoice Yield</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-primary rounded-full" />
            <span className="text-body-sm text-cool-gray">Treasury Yield</span>
          </div>
        </div>
      </Card>

      {/* Two Column Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Utilization History */}
        <Card>
          <CardHeader>
            <CardTitle>Pool Utilization History</CardTitle>
          </CardHeader>
          {mockUtilizationHistory.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center">
              <p className="text-cool-gray text-body-sm">No data available</p>
            </div>
          ) : (
            <AreaChart
              data={mockUtilizationHistory}
              color="#3B82F6"
              height={200}
              formatValue={(v) => `${v.toFixed(0)}%`}
              formatLabel={(t) =>
                new Date(t * 1000).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              }
            />
          )}
        </Card>

        {/* Treasury APY */}
        <Card>
          <CardHeader>
            <CardTitle>Treasury APY Tracking</CardTitle>
          </CardHeader>
          <div className="h-[200px] flex items-center justify-center">
            <div className="text-center">
              <p className="text-display text-white">—%</p>
              <p className="text-body-sm text-cool-gray mt-2">USYC Current Rate</p>
            </div>
          </div>
        </Card>
      </div>

      {/* APY Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>APY Comparison</CardTitle>
        </CardHeader>
        <BarChart
          data={mockAPYComparison}
          layout="vertical"
          height={200}
          formatValue={(v) => `${v.toFixed(2)}%`}
        />
      </Card>

      {/* Pool Health Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Pool Health Metrics</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          <div>
            <p className="text-body-sm text-cool-gray mb-1">Total Value Locked</p>
            <p className="text-body font-mono text-white">{formattedState?.totalAssets || '$0.00'}</p>
          </div>
          <div>
            <p className="text-body-sm text-cool-gray mb-1">Active Invoices</p>
            <p className="text-body font-mono text-white">0</p>
          </div>
          <div>
            <p className="text-body-sm text-cool-gray mb-1">Avg Invoice Size</p>
            <p className="text-body font-mono text-white">—</p>
          </div>
          <div>
            <p className="text-body-sm text-cool-gray mb-1">Avg Days to Maturity</p>
            <p className="text-body font-mono text-white">—</p>
          </div>
          <div>
            <p className="text-body-sm text-cool-gray mb-1">Default Rate (All Time)</p>
            <p className="text-body font-mono text-white">—</p>
          </div>
          <div>
            <p className="text-body-sm text-cool-gray mb-1">Unique Buyers</p>
            <p className="text-body font-mono text-white">0</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
