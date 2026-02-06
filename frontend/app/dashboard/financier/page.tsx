'use client';

import Link from 'next/link';
import { ArrowDownToLine, ArrowUpFromLine, BarChart3, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, ChartSkeleton } from '@/components/ui';
import { PositionCard } from '@/components/position';
import { PoolMetrics, UtilizationBar } from '@/components/pool';
import { AreaChart } from '@/components/charts';
import { usePoolState } from '@/hooks';
import { useSharePriceHistory, useUserTransactionHistory } from '@/hooks/usePoolHistory';

export default function FinancierDashboard() {
  const { isLoading: poolLoading } = usePoolState();
  const { dataPoints: yieldData, isLoading: yieldLoading } = useSharePriceHistory('30d');
  const { transactions: recentActivity, isLoading: activityLoading } = useUserTransactionHistory(5);

  const isLoading = poolLoading || yieldLoading;

  // Convert transactions to activity format
  const activityItems = recentActivity.map((tx) => ({
    type: tx.type === 'deposit' ? 'yield' : 'invoice',
    description: tx.type === 'deposit' ? `Deposited ${tx.assets}` : `Withdrew ${tx.assets}`,
    time: tx.relativeTime,
  }));

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-h1 text-white">Dashboard</h1>
        <p className="text-body text-cool-gray mt-1">
          Monitor your position and pool performance
        </p>
      </div>

      {/* Position Card */}
      <PositionCard />

      {/* Pool Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Pool Allocation</CardTitle>
        </CardHeader>
        <UtilizationBar />
      </Card>

      {/* Pool Metrics */}
      <PoolMetrics />

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Yield Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Share Price (30 Days)</CardTitle>
          </CardHeader>
          {isLoading ? (
            <ChartSkeleton />
          ) : yieldData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center">
              <p className="text-cool-gray text-body-sm">No historical data yet</p>
            </div>
          ) : (
            <AreaChart
              data={yieldData}
              color="#10B981"
              height={200}
              formatValue={(v) => `${v.toFixed(4)} USDC`}
              formatLabel={(t) =>
                new Date(t * 1000).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              }
            />
          )}
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <Link
              href="/dashboard/financier/deposit"
              className="flex items-center gap-4 p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors group"
            >
              <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
                <ArrowDownToLine className="w-5 h-5 text-success" />
              </div>
              <div className="flex-1">
                <p className="text-body font-medium text-white">Deposit USDC</p>
                <p className="text-body-sm text-cool-gray">Add liquidity to earn yield</p>
              </div>
              <ArrowRight className="w-5 h-5 text-cool-gray group-hover:text-white transition-colors" />
            </Link>

            <Link
              href="/dashboard/financier/withdraw"
              className="flex items-center gap-4 p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors group"
            >
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <ArrowUpFromLine className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-body font-medium text-white">Withdraw</p>
                <p className="text-body-sm text-cool-gray">Withdraw your position</p>
              </div>
              <ArrowRight className="w-5 h-5 text-cool-gray group-hover:text-white transition-colors" />
            </Link>

            <Link
              href="/dashboard/financier/analytics"
              className="flex items-center gap-4 p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors group"
            >
              <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-warning" />
              </div>
              <div className="flex-1">
                <p className="text-body font-medium text-white">View Analytics</p>
                <p className="text-body-sm text-cool-gray">Detailed yield breakdown</p>
              </div>
              <ArrowRight className="w-5 h-5 text-cool-gray group-hover:text-white transition-colors" />
            </Link>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <Link
            href="/dashboard/financier/transactions"
            className="text-body-sm text-primary hover:underline"
          >
            View All
          </Link>
        </CardHeader>
        {activityLoading ? (
          <div className="py-8 text-center">
            <p className="text-cool-gray text-body-sm">Loading...</p>
          </div>
        ) : activityItems.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-cool-gray text-body-sm">No activity yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {activityItems.map((activity, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      activity.type === 'yield'
                        ? 'bg-success'
                        : activity.type === 'invoice'
                          ? 'bg-primary'
                          : 'bg-warning'
                    }`}
                  />
                  <span className="text-body text-white">{activity.description}</span>
                </div>
                <span className="text-body-sm text-cool-gray">{activity.time}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
