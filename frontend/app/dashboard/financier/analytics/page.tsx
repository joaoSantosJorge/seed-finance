'use client';

import { useState, useMemo } from 'react';
import { formatUnits } from 'viem';
import { PageHeader } from '@/components/layout';
import { Card, CardHeader, CardTitle, Tabs, TabsList, TabsTrigger, Tooltip, Skeleton } from '@/components/ui';
import { MetricCard } from '@/components/pool';
import { AreaChart, BarChart, LineChart } from '@/components/charts';
import { usePoolState } from '@/hooks';
import { usePoolStateHistory } from '@/hooks/usePoolHistory';
import { useExecutionPoolStats } from '@/hooks/operator/useExecutionPool';
import { useAllInvoices, useOverdueInvoices } from '@/hooks/operator/useAllInvoices';
import { useInvoiceStats } from '@/hooks/invoice/useInvoice';
import { USDC_DECIMALS } from '@/lib/contracts';
import { formatCurrency, formatPercent, formatBps } from '@/lib/formatters';
import type { TimePeriod } from '@/types';
import { InvoiceStatus } from '@/hooks/invoice/useInvoice';
import { TrendingUp, AlertTriangle, Clock, DollarSign, Activity, PieChart as PieChartIcon } from 'lucide-react';

// Market comparison rates (updated periodically - Feb 2026)
const MARKET_RATES = {
  treasuryBills: 3.25, // Current short-term T-Bill rate
  aaveUSDC: 2.85,
  compoundUSDC: 2.50,
};

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<TimePeriod>('30d');
  const { poolState, formattedState, isLoading: poolLoading } = usePoolState();
  const { data: executionStats, isLoading: statsLoading } = useExecutionPoolStats();
  const { data: allInvoices, stats: invoiceStats, isLoading: invoicesLoading } = useAllInvoices();
  const { data: overdueInvoices } = useOverdueInvoices();
  const { dataPoints: stateHistory, yieldChange, isLoading: historyLoading } = usePoolStateHistory(period as '7d' | '30d' | '90d' | 'all');

  const isLoading = poolLoading || statsLoading || invoicesLoading;

  // Calculate total yield from pool state
  const yieldData = useMemo(() => {
    if (!poolState) {
      return {
        totalYield: 0n,
        invoiceYield: 0n,
        treasuryYield: 0n,
        totalYieldFormatted: '$0.00',
        invoiceYieldFormatted: '$0.00',
        treasuryYieldFormatted: '$0.00',
        invoiceYieldPct: 0,
        treasuryYieldPct: 0,
      };
    }

    const invoiceYield = poolState.totalInvoiceYield;
    const treasuryYield = poolState.totalTreasuryYield;
    const totalYield = invoiceYield + treasuryYield;

    const invoiceYieldPct = totalYield > 0n
      ? Number((invoiceYield * 100n) / totalYield)
      : 0;
    const treasuryYieldPct = totalYield > 0n
      ? Number((treasuryYield * 100n) / totalYield)
      : 0;

    return {
      totalYield,
      invoiceYield,
      treasuryYield,
      totalYieldFormatted: formatCurrency(
        parseFloat(formatUnits(totalYield, USDC_DECIMALS))
      ),
      invoiceYieldFormatted: formatCurrency(
        parseFloat(formatUnits(invoiceYield, USDC_DECIMALS))
      ),
      treasuryYieldFormatted: formatCurrency(
        parseFloat(formatUnits(treasuryYield, USDC_DECIMALS))
      ),
      invoiceYieldPct,
      treasuryYieldPct,
    };
  }, [poolState]);

  // Parse execution pool stats
  const executionData = useMemo(() => {
    if (!executionStats) {
      return {
        totalFunded: 0n,
        totalRepaid: 0n,
        activeInvoices: 0,
        totalFundedFormatted: '$0.00',
        totalRepaidFormatted: '$0.00',
      };
    }

    const [totalFunded, totalRepaid, activeInvoices] = executionStats as [bigint, bigint, bigint];

    return {
      totalFunded,
      totalRepaid,
      activeInvoices: Number(activeInvoices),
      totalFundedFormatted: formatCurrency(
        parseFloat(formatUnits(totalFunded, USDC_DECIMALS))
      ),
      totalRepaidFormatted: formatCurrency(
        parseFloat(formatUnits(totalRepaid, USDC_DECIMALS))
      ),
    };
  }, [executionStats]);

  // Invoice statistics
  const invoiceData = useMemo(() => {
    if (!invoiceStats) {
      return {
        totalCreated: 0,
        pending: 0,
        approved: 0,
        funded: 0,
        paid: 0,
        cancelled: 0,
        defaulted: 0,
      };
    }

    // invoiceStats: [totalPending, totalApproved, totalFunded, nextId]
    const [totalPending, totalApproved, totalFunded, nextId] = invoiceStats as [bigint, bigint, bigint, bigint];

    // Count by status from allInvoices
    const statusCounts = allInvoices.reduce((acc, inv) => {
      acc[inv.status] = (acc[inv.status] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return {
      totalCreated: Number(nextId) - 1,
      pending: statusCounts[InvoiceStatus.Pending] || 0,
      approved: statusCounts[InvoiceStatus.Approved] || 0,
      fundingApproved: statusCounts[InvoiceStatus.FundingApproved] || 0,
      funded: statusCounts[InvoiceStatus.Funded] || 0,
      paid: statusCounts[InvoiceStatus.Paid] || 0,
      cancelled: statusCounts[InvoiceStatus.Cancelled] || 0,
      defaulted: statusCounts[InvoiceStatus.Defaulted] || 0,
    };
  }, [invoiceStats, allInvoices]);

  // Estimated APY calculation (simplified - without historical data)
  // Based on total yield earned vs total deployed capital
  const estimatedAPY = useMemo(() => {
    if (!poolState || poolState.totalDeployed === 0n || yieldData.totalYield === 0n) {
      return null; // No data yet
    }

    // Rough estimate: annualize based on yield earned
    // This is a simplification - real APY needs time-weighted calculation
    const yieldValue = parseFloat(formatUnits(yieldData.invoiceYield, USDC_DECIMALS));
    const deployedValue = parseFloat(formatUnits(poolState.totalDeployed, USDC_DECIMALS));

    // If we assume average deployment duration of 30 days
    if (deployedValue > 0 && yieldValue > 0) {
      // Annualize: (yield / deployed) * (365 / avgDays)
      // Using a rough 30-day assumption
      const avgDays = 30;
      const annualizedYield = (yieldValue / deployedValue) * (365 / avgDays) * 100;
      return Math.min(annualizedYield, 50); // Cap at 50% for sanity
    }

    return null;
  }, [poolState, yieldData]);

  // APY comparison data
  const apyComparisonData = useMemo(() => {
    return [
      {
        name: 'Seed Finance LP',
        value: estimatedAPY ?? 0,
        color: '#3B82F6',
      },
      { name: 'US Treasury Bills', value: MARKET_RATES.treasuryBills, color: '#F59E0B' },
      { name: 'Aave USDC', value: MARKET_RATES.aaveUSDC, color: '#10B981' },
      { name: 'Compound USDC', value: MARKET_RATES.compoundUSDC, color: '#64748B' },
    ];
  }, [estimatedAPY]);

  // Treasury info
  const treasuryInfo = useMemo(() => {
    if (!poolState) {
      return {
        inTreasury: '$0.00',
        allocationRate: '0%',
        treasuryYield: '$0.00',
      };
    }

    return {
      inTreasury: formatCurrency(
        parseFloat(formatUnits(poolState.totalInTreasury, USDC_DECIMALS))
      ),
      allocationRate: formatBps(poolState.treasuryAllocationRate),
      treasuryYield: yieldData.treasuryYieldFormatted,
    };
  }, [poolState, yieldData]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yield Analytics"
        description="Detailed performance metrics and pool health"
        backHref="/dashboard/financier"
      />

      {/* Period Selector (for future historical data) */}
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
          label="Total Yield Earned"
          value={yieldData.totalYieldFormatted}
          subtext="All-time cumulative yield"
          isLoading={isLoading}
        />
        <MetricCard
          label="Current Utilization"
          value={formattedState?.utilizationRate ?? '0%'}
          subtext="Capital deployed to invoices"
          isLoading={isLoading}
        />
        <MetricCard
          label="Active Invoices"
          value={executionData.activeInvoices.toString()}
          subtext="Currently funded invoices"
          isLoading={isLoading}
        />
      </div>

      {/* Yield Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Yield Over Time</CardTitle>
        </CardHeader>
        {historyLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : stateHistory.length === 0 ? (
          <div className="h-[300px] flex flex-col items-center justify-center bg-slate-800/30 rounded-lg">
            <Clock className="w-8 h-8 text-cool-gray mb-2" />
            <p className="text-cool-gray text-body-sm">No historical data yet</p>
            <p className="text-silver text-body-sm mt-1">Data will appear after pool activity</p>
          </div>
        ) : (
          <AreaChart
            data={stateHistory.map((s) => ({
              timestamp: s.timestamp,
              value: s.totalInvoiceYield + s.totalTreasuryYield,
            }))}
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
            <div className="w-3 h-3 bg-primary rounded-full" />
            <span className="text-body-sm text-cool-gray">Invoice Yield</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-success rounded-full" />
            <span className="text-body-sm text-cool-gray">Treasury Yield</span>
          </div>
        </div>
        {yieldChange.total > 0 && (
          <p className="text-body-sm text-center text-success mt-2">
            +{formatCurrency(yieldChange.total)} yield earned this period
          </p>
        )}
      </Card>

      {/* Two Column: Utilization History & Treasury Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Utilization History */}
        <Card>
          <CardHeader>
            <CardTitle>Pool Utilization History</CardTitle>
          </CardHeader>
          {historyLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : stateHistory.length === 0 ? (
            <div className="h-[200px] flex flex-col items-center justify-center bg-slate-800/30 rounded-lg">
              <Activity className="w-6 h-6 text-cool-gray mb-2" />
              <p className="text-cool-gray text-body-sm">No historical data yet</p>
              <p className="text-silver text-body-sm mt-1">Data will appear after pool activity</p>
            </div>
          ) : (
            <LineChart
              data={stateHistory.map((s) => ({
                timestamp: s.timestamp,
                value: s.utilizationRate,
              }))}
              color="#3B82F6"
              height={200}
              formatValue={(v) => `${v.toFixed(1)}%`}
              formatLabel={(t) =>
                new Date(t * 1000).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              }
            />
          )}
          <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-body-sm text-cool-gray">Current Utilization</span>
              <span className="text-body font-mono text-white">{formattedState?.utilizationRate ?? '0%'}</span>
            </div>
          </div>
        </Card>

        {/* Treasury Status */}
        <Card>
          <CardHeader>
            <CardTitle>Treasury Status</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-success" />
                <span className="text-body-sm text-cool-gray">In Treasury (USYC)</span>
              </div>
              <span className="text-body font-mono text-white">{treasuryInfo.inTreasury}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-primary" />
                <span className="text-body-sm text-cool-gray">Treasury Allocation Rate</span>
              </div>
              <span className="text-body font-mono text-white">{treasuryInfo.allocationRate}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-success" />
                <span className="text-body-sm text-cool-gray">Treasury Yield Earned</span>
              </div>
              <span className="text-body font-mono text-success">{treasuryInfo.treasuryYield}</span>
            </div>
            <p className="text-body-sm text-silver text-center mt-2">
              USYC rate: ~3.25% APY (T-Bill backed)
            </p>
          </div>
        </Card>
      </div>

      {/* APY Comparison */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>APY Comparison</CardTitle>
            {estimatedAPY === null && (
              <Tooltip content="Seed Finance APY shown as estimated based on yield data. Period-specific APY requires historical data.">
                <span className="text-body-sm text-silver">(estimated)</span>
              </Tooltip>
            )}
          </div>
        </CardHeader>
        <BarChart
          data={apyComparisonData}
          layout="vertical"
          height={200}
          formatValue={(v) => `${v.toFixed(2)}%`}
        />
        {estimatedAPY === null && (
          <p className="text-body-sm text-silver text-center mt-2">
            Seed Finance APY will be calculated once yield data is available
          </p>
        )}
      </Card>

      {/* Yield Sources Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Yield Sources Breakdown</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-body text-white">Invoice Spread Yield</span>
            </div>
            <div className="text-right">
              <span className="text-body font-mono text-white">{yieldData.invoiceYieldFormatted}</span>
              {yieldData.totalYield > 0n && (
                <span className="text-body-sm text-cool-gray ml-2">
                  ({yieldData.invoiceYieldPct.toFixed(0)}%)
                </span>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center pb-3 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-success" />
              <span className="text-body text-white">Treasury Yield (USYC)</span>
            </div>
            <div className="text-right">
              <span className="text-body font-mono text-white">{yieldData.treasuryYieldFormatted}</span>
              {yieldData.totalYield > 0n && (
                <span className="text-body-sm text-cool-gray ml-2">
                  ({yieldData.treasuryYieldPct.toFixed(0)}%)
                </span>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-body font-medium text-white">Total Yield Earned</span>
            <span className="text-body font-mono text-success">{yieldData.totalYieldFormatted}</span>
          </div>
        </div>
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
            <p className="text-body font-mono text-white">{executionData.activeInvoices}</p>
          </div>
          <div>
            <p className="text-body-sm text-cool-gray mb-1">Total Funded</p>
            <p className="text-body font-mono text-white">{executionData.totalFundedFormatted}</p>
          </div>
          <div>
            <p className="text-body-sm text-cool-gray mb-1">Total Repaid</p>
            <p className="text-body font-mono text-white">{executionData.totalRepaidFormatted}</p>
          </div>
          <div>
            <p className="text-body-sm text-cool-gray mb-1">Utilization Rate</p>
            <p className="text-body font-mono text-white">{formattedState?.utilizationRate || '0%'}</p>
          </div>
          <div>
            <p className="text-body-sm text-cool-gray mb-1">Treasury Allocation</p>
            <p className="text-body font-mono text-white">{formattedState?.treasuryAllocationRate || '0%'}</p>
          </div>
        </div>
      </Card>

      {/* Invoice Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Statistics</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="p-4 bg-slate-800/50 rounded-lg">
            <p className="text-body-sm text-cool-gray mb-1">Total Created</p>
            <p className="text-xl font-mono text-white">{invoiceData.totalCreated}</p>
          </div>
          <div className="p-4 bg-slate-800/50 rounded-lg">
            <p className="text-body-sm text-cool-gray mb-1">Currently Funded</p>
            <p className="text-xl font-mono text-primary">{invoiceData.funded}</p>
          </div>
          <div className="p-4 bg-slate-800/50 rounded-lg">
            <p className="text-body-sm text-cool-gray mb-1">Paid (Completed)</p>
            <p className="text-xl font-mono text-success">{invoiceData.paid}</p>
          </div>
          <div className="p-4 bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-1 mb-1">
              <p className="text-body-sm text-cool-gray">Overdue</p>
              {overdueInvoices.length > 0 && (
                <AlertTriangle className="w-3.5 h-3.5 text-warning" />
              )}
            </div>
            <p className={`text-xl font-mono ${overdueInvoices.length > 0 ? 'text-warning' : 'text-white'}`}>
              {overdueInvoices.length}
            </p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-700">
          <p className="text-body-sm text-cool-gray mb-3">Invoice Pipeline</p>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-silver" />
              <span className="text-body-sm text-silver">Pending: {invoiceData.pending}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-warning" />
              <span className="text-body-sm text-silver">Approved: {invoiceData.approved}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-body-sm text-silver">Ready to Fund: {invoiceData.fundingApproved}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-error" />
              <span className="text-body-sm text-silver">Cancelled: {invoiceData.cancelled}</span>
            </div>
            {invoiceData.defaulted > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-error" />
                <span className="text-body-sm text-error">Defaulted: {invoiceData.defaulted}</span>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
