'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePoolState } from '@/hooks';
import { useInvoiceStats } from '@/hooks/invoice';
import { useApprovedInvoices, useOverdueInvoices } from '@/hooks/operator';
import { useExecutionPoolStats } from '@/hooks/operator/useExecutionPool';
import { formatCurrency } from '@/lib/formatters';
import { Activity, TrendingUp, AlertTriangle, Clock, DollarSign, FileText } from 'lucide-react';

export function SystemHealthCard() {
  const { totalAssets, availableLiquidity, utilizationRate, isPaused, isLoading: poolLoading } = usePoolState();
  const { isLoading: statsLoading } = useInvoiceStats();
  const { data: executionStats, isLoading: execLoading } = useExecutionPoolStats();
  const { count: pendingFundingCount, isLoading: pendingLoading } = useApprovedInvoices();
  const { count: overdueCount, isLoading: overdueLoading } = useOverdueInvoices();

  const isLoading = poolLoading || statsLoading || execLoading || pendingLoading || overdueLoading;

  // Parse execution pool stats
  const activeInvoices = executionStats ? Number(executionStats[2]) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Health</CardTitle>
        <Badge variant={isPaused ? 'error' : 'success'} size="md">
          {isPaused ? 'PAUSED' : 'ACTIVE'}
        </Badge>
      </CardHeader>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Assets */}
        <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-cool-gray" />
            <span className="text-body-sm text-cool-gray uppercase tracking-wider">Total Assets</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-7 w-24" />
          ) : (
            <p className="text-h3 text-white font-mono">
              {formatCurrency(Number(totalAssets) / 1e6)}
            </p>
          )}
        </div>

        {/* Available Liquidity */}
        <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-cool-gray" />
            <span className="text-body-sm text-cool-gray uppercase tracking-wider">Available</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-7 w-24" />
          ) : (
            <p className="text-h3 text-white font-mono">
              {formatCurrency(Number(availableLiquidity) / 1e6)}
            </p>
          )}
        </div>

        {/* Utilization Rate */}
        <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-cool-gray" />
            <span className="text-body-sm text-cool-gray uppercase tracking-wider">Utilization</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <p className="text-h3 text-white font-mono">
              {(Number(utilizationRate) / 100).toFixed(1)}%
            </p>
          )}
        </div>

        {/* Active Invoices */}
        <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-cool-gray" />
            <span className="text-body-sm text-cool-gray uppercase tracking-wider">Active</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-7 w-12" />
          ) : (
            <p className="text-h3 text-white font-mono">{activeInvoices}</p>
          )}
        </div>

        {/* Pending Funding */}
        <div className={`p-4 border-2 ${pendingFundingCount > 0 ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-[var(--bg-secondary)] border-[var(--border-color)]'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Clock className={`w-4 h-4 ${pendingFundingCount > 0 ? 'text-yellow-500' : 'text-cool-gray'}`} />
            <span className="text-body-sm text-cool-gray uppercase tracking-wider">To Fund</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-7 w-12" />
          ) : (
            <p className={`text-h3 font-mono ${pendingFundingCount > 0 ? 'text-yellow-500' : 'text-white'}`}>
              {pendingFundingCount}
            </p>
          )}
        </div>

        {/* Overdue */}
        <div className={`p-4 border-2 ${overdueCount > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-[var(--bg-secondary)] border-[var(--border-color)]'}`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className={`w-4 h-4 ${overdueCount > 0 ? 'text-red-500' : 'text-cool-gray'}`} />
            <span className="text-body-sm text-cool-gray uppercase tracking-wider">Overdue</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-7 w-12" />
          ) : (
            <p className={`text-h3 font-mono ${overdueCount > 0 ? 'text-red-500' : 'text-white'}`}>
              {overdueCount}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
