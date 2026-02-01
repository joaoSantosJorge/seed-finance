'use client';

import { PageHeader } from '@/components/layout';
import { Card, CardHeader, CardTitle, Skeleton, Tooltip, tooltipContent } from '@/components/ui';
import { PieChart, LineChart } from '@/components/charts';
import { useUserPosition, usePoolState } from '@/hooks';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@/components/wallet';

// Mock share price history
const mockSharePriceHistory = Array.from({ length: 90 }, (_, i) => ({
  timestamp: Date.now() / 1000 - (90 - i) * 24 * 60 * 60,
  value: 1 + (i * 0.0004) + (Math.random() * 0.002),
}));

export default function PortfolioPage() {
  const { isConnected } = useAccount();
  const { position, formattedPosition, isLoading } = useUserPosition();
  const { formattedState, isLoading: poolLoading } = usePoolState();

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title="Portfolio"
          description="Detailed view of your position"
          backHref="/dashboard/financier"
        />
        <Card className="text-center py-12">
          <p className="text-cool-gray mb-4">Connect your wallet to view your portfolio</p>
          <ConnectButton />
        </Card>
      </div>
    );
  }

  if (isLoading || poolLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <PageHeader
          title="Portfolio"
          description="Detailed view of your position"
          backHref="/dashboard/financier"
        />
        <Card>
          <Skeleton className="h-40 w-full" />
        </Card>
      </div>
    );
  }

  if (!position || position.sharesOwned === 0n) {
    return (
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title="Portfolio"
          description="Detailed view of your position"
          backHref="/dashboard/financier"
        />
        <Card className="text-center py-12">
          <p className="text-cool-gray mb-2">No position yet</p>
          <p className="text-body-sm text-silver">
            Deposit USDC to start earning yield
          </p>
        </Card>
      </div>
    );
  }

  // Allocation data for pie chart
  const allocationData = [
    {
      name: 'Invoice Financing',
      value: 60, // Would calculate from position data
      color: '#3B82F6',
    },
    {
      name: 'Treasury (USYC)',
      value: 20,
      color: '#10B981',
    },
    {
      name: 'Liquid Reserve',
      value: 20,
      color: '#64748B',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Portfolio"
        description="Detailed view of your position"
        backHref="/dashboard/financier"
      />

      {/* Position Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Position Summary</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="metric-label">Total Value</p>
            <p className="metric-value">{formattedPosition?.currentValue}</p>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="metric-label">sfUSDC Shares</p>
              <Tooltip content={tooltipContent.sfUSDC} />
            </div>
            <p className="metric-value">{formattedPosition?.sharesOwned}</p>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="metric-label">Share Price</p>
              <Tooltip content={tooltipContent.sharePrice} />
            </div>
            <p className="metric-value">{formattedState?.sharePrice} USDC</p>
            <p className="text-body-sm text-success mt-1">+3.92% ATH</p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-700 grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-body-sm text-cool-gray">Cost Basis</p>
            <p className="text-body font-mono text-white">{formattedPosition?.netDeposits}</p>
          </div>
          <div>
            <p className="text-body-sm text-cool-gray">Unrealized Gain</p>
            <p className="text-body font-mono text-success">
              {formattedPosition?.unrealizedGain} ({formattedPosition?.unrealizedGainPercent})
            </p>
          </div>
          <div>
            <p className="text-body-sm text-cool-gray">Pool Ownership</p>
            <p className="text-body font-mono text-white">{formattedPosition?.poolOwnership}</p>
          </div>
        </div>
      </Card>

      {/* Capital Allocation */}
      <Card>
        <CardHeader>
          <CardTitle>Capital Allocation</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <PieChart data={allocationData} height={200} />
          <div>
            <p className="text-body-sm text-cool-gray mb-4 uppercase tracking-wider">
              Your Proportional Breakdown
            </p>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-body text-white">Invoice Financing</span>
                </div>
                <span className="text-body font-mono text-white">
                  {formattedPosition?.proportionalDeployed} (60%)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-success" />
                  <span className="text-body text-white">Treasury (USYC)</span>
                </div>
                <span className="text-body font-mono text-white">
                  {formattedPosition?.proportionalTreasury} (20%)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-cool-gray" />
                  <span className="text-body text-white">Liquid Reserve</span>
                </div>
                <span className="text-body font-mono text-white">
                  {formattedPosition?.proportionalLiquid} (20%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Share Price History */}
      <Card>
        <CardHeader>
          <CardTitle>Share Price History</CardTitle>
        </CardHeader>
        <LineChart
          data={mockSharePriceHistory}
          color="#3B82F6"
          height={250}
          formatValue={(v) => `${v.toFixed(4)} USDC`}
          formatLabel={(t) =>
            new Date(t * 1000).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })
          }
        />
      </Card>

      {/* Yield Sources */}
      <Card>
        <CardHeader>
          <CardTitle>Yield Sources Breakdown</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-700">
            <span className="text-body text-white">Invoice Spread Yield</span>
            <div className="text-right">
              <span className="text-body font-mono text-white">$4,156.45</span>
              <span className="text-body-sm text-cool-gray ml-2">(85%)</span>
            </div>
          </div>
          <div className="flex justify-between items-center pb-3 border-b border-slate-700">
            <span className="text-body text-white">Treasury Yield (USYC)</span>
            <div className="text-right">
              <span className="text-body font-mono text-white">$735.85</span>
              <span className="text-body-sm text-cool-gray ml-2">(15%)</span>
            </div>
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-body font-medium text-white">Total Yield Earned</span>
            <span className="text-body font-mono text-success">$4,892.30</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
