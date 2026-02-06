'use client';

import { useMemo } from 'react';
import { formatUnits } from 'viem';
import { PageHeader } from '@/components/layout';
import { Card, CardHeader, CardTitle, Skeleton, Tooltip, tooltipContent } from '@/components/ui';
import { LineChart } from '@/components/charts';
import { AllocationBar, RiskIndicator } from '@/components/portfolio';
import { useUserPosition, usePoolState } from '@/hooks';
import { useMaxWithdraw } from '@/hooks/contracts/useLiquidityPool';
import { useExecutionPoolStats } from '@/hooks/operator/useExecutionPool';
import { useSharePriceHistory } from '@/hooks/usePoolHistory';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@/components/wallet';
import { USDC_DECIMALS } from '@/lib/contracts';
import { formatCurrency } from '@/lib/formatters';
import { AlertTriangle, TrendingUp, Activity, Wallet, PieChart as PieChartIcon } from 'lucide-react';

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const { position, formattedPosition, isLoading } = useUserPosition();
  const { poolState, formattedState, isLoading: poolLoading } = usePoolState();
  const { data: maxWithdraw, isLoading: maxWithdrawLoading } = useMaxWithdraw(address);
  const { data: executionStats } = useExecutionPoolStats();
  const { dataPoints: sharePriceHistory, isLoading: historyLoading } = useSharePriceHistory('30d');

  // Calculate proportional yield for user
  const userYield = useMemo(() => {
    if (!position || !poolState || poolState.totalSupply === 0n) {
      return {
        invoiceYield: 0n,
        treasuryYield: 0n,
        totalYield: 0n,
        invoiceYieldFormatted: '$0.00',
        treasuryYieldFormatted: '$0.00',
        totalYieldFormatted: '$0.00',
      };
    }

    // User's proportional share of total yields
    const ratio = (position.sharesOwned * 10n ** 18n) / poolState.totalSupply;
    const invoiceYield = (poolState.totalInvoiceYield * ratio) / 10n ** 18n;
    const treasuryYield = (poolState.totalTreasuryYield * ratio) / 10n ** 18n;
    const totalYield = invoiceYield + treasuryYield;

    return {
      invoiceYield,
      treasuryYield,
      totalYield,
      invoiceYieldFormatted: formatCurrency(
        parseFloat(formatUnits(invoiceYield, USDC_DECIMALS))
      ),
      treasuryYieldFormatted: formatCurrency(
        parseFloat(formatUnits(treasuryYield, USDC_DECIMALS))
      ),
      totalYieldFormatted: formatCurrency(
        parseFloat(formatUnits(totalYield, USDC_DECIMALS))
      ),
    };
  }, [position, poolState]);

  // Calculate allocation percentages
  const allocationData = useMemo(() => {
    if (!position || position.currentValue === 0n) {
      return {
        segments: [
          { label: 'Invoice Financing', value: '$0.00', percentage: 0, color: '#3B82F6' },
          { label: 'Treasury (USYC)', value: '$0.00', percentage: 0, color: '#10B981' },
          { label: 'Liquid Reserve', value: '$0.00', percentage: 0, color: '#64748B' },
        ],
        deployedPct: 0,
        treasuryPct: 0,
        liquidPct: 0,
      };
    }

    const total = Number(position.currentValue);
    const deployed = Number(position.proportionalDeployed);
    const treasury = Number(position.proportionalTreasury);
    const liquid = Number(position.proportionalLiquid);

    const deployedPct = total > 0 ? (deployed / total) * 100 : 0;
    const treasuryPct = total > 0 ? (treasury / total) * 100 : 0;
    const liquidPct = total > 0 ? (liquid / total) * 100 : 0;

    return {
      segments: [
        {
          label: 'Invoice Financing',
          value: formatCurrency(parseFloat(formatUnits(position.proportionalDeployed, USDC_DECIMALS))),
          percentage: deployedPct,
          color: '#3B82F6',
        },
        {
          label: 'Treasury (USYC)',
          value: formatCurrency(parseFloat(formatUnits(position.proportionalTreasury, USDC_DECIMALS))),
          percentage: treasuryPct,
          color: '#10B981',
        },
        {
          label: 'Liquid Reserve',
          value: formatCurrency(parseFloat(formatUnits(position.proportionalLiquid, USDC_DECIMALS))),
          percentage: liquidPct,
          color: '#64748B',
        },
      ],
      deployedPct,
      treasuryPct,
      liquidPct,
    };
  }, [position]);

  // Calculate max withdraw and check if there's a constraint
  const withdrawInfo = useMemo(() => {
    if (!position || !maxWithdraw) {
      return { formatted: '$0.00', isConstrained: false, constraintPercent: 100 };
    }

    const maxWithdrawValue = parseFloat(formatUnits(maxWithdraw, USDC_DECIMALS));
    const currentValue = parseFloat(formatUnits(position.currentValue, USDC_DECIMALS));
    const isConstrained = maxWithdrawValue < currentValue * 0.99; // 1% tolerance
    const constraintPercent = currentValue > 0 ? (maxWithdrawValue / currentValue) * 100 : 100;

    return {
      formatted: formatCurrency(maxWithdrawValue),
      isConstrained,
      constraintPercent,
    };
  }, [position, maxWithdraw]);

  // Risk indicator data
  const riskData = useMemo(() => {
    if (!formattedPosition) {
      return {
        atRisk: { label: 'At Risk', value: '$0.00', percentage: 0, description: '' },
        lowRisk: { label: 'Low Risk', value: '$0.00', percentage: 0, description: '' },
        safe: { label: 'Safe', value: '$0.00', percentage: 0, description: '' },
      };
    }

    return {
      atRisk: {
        label: 'At Risk',
        value: formattedPosition.proportionalDeployed,
        percentage: allocationData.deployedPct,
        description: 'Capital deployed to invoices. Subject to counterparty default risk.',
      },
      lowRisk: {
        label: 'Low Risk',
        value: formattedPosition.proportionalTreasury,
        percentage: allocationData.treasuryPct,
        description: 'Capital in Treasury (USYC). Very low risk, earning Treasury yield.',
      },
      safe: {
        label: 'Safe',
        value: formattedPosition.proportionalLiquid,
        percentage: allocationData.liquidPct,
        description: 'Liquid USDC reserve. Instantly available for withdrawal.',
      },
    };
  }, [formattedPosition, allocationData]);

  // Pool metrics
  const poolMetrics = useMemo(() => {
    const activeInvoices = executionStats ? Number(executionStats[2]) : 0;

    return {
      utilization: formattedState?.utilizationRate ?? '0%',
      activeInvoices,
      tvl: formattedState?.totalAssets ?? '$0',
      treasuryRate: formattedState?.treasuryAllocationRate ?? '0%',
    };
  }, [formattedState, executionStats]);

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
        <Card>
          <Skeleton className="h-32 w-full" />
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
              <p className="metric-label">SEED Shares</p>
              <Tooltip content={tooltipContent.seed} />
            </div>
            <p className="metric-value">{formattedPosition?.sharesOwned}</p>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="metric-label">Share Price</p>
              <Tooltip content={tooltipContent.sharePrice} />
            </div>
            <p className="metric-value">{formattedState?.sharePrice} USDC</p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-700 grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <div>
            <div className="flex items-center gap-1">
              <p className="text-body-sm text-cool-gray">Max Withdrawable</p>
              {withdrawInfo.isConstrained && (
                <Tooltip content="Some capital is deployed and not immediately available">
                  <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                </Tooltip>
              )}
            </div>
            <p className={`text-body font-mono ${withdrawInfo.isConstrained ? 'text-warning' : 'text-white'}`}>
              {maxWithdrawLoading ? '...' : withdrawInfo.formatted}
            </p>
            {withdrawInfo.isConstrained && (
              <p className="text-body-sm text-silver">
                ({withdrawInfo.constraintPercent.toFixed(0)}% available)
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Pool Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-body-sm text-cool-gray">Utilization</span>
          </div>
          <p className="text-lg font-mono text-white">{poolMetrics.utilization}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-success" />
            <span className="text-body-sm text-cool-gray">Active Invoices</span>
          </div>
          <p className="text-lg font-mono text-white">{poolMetrics.activeInvoices}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-primary" />
            <span className="text-body-sm text-cool-gray">Pool TVL</span>
          </div>
          <p className="text-lg font-mono text-white">{poolMetrics.tvl}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <PieChartIcon className="w-4 h-4 text-success" />
            <span className="text-body-sm text-cool-gray">Treasury Rate</span>
          </div>
          <p className="text-lg font-mono text-white">{poolMetrics.treasuryRate}</p>
        </Card>
      </div>

      {/* Capital Allocation & Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Capital Allocation - Stacked Bar */}
        <Card>
          <CardHeader>
            <CardTitle>Capital Allocation</CardTitle>
          </CardHeader>
          <AllocationBar
            segments={allocationData.segments}
            height="lg"
            showLegend={true}
          />
        </Card>

        {/* Risk Exposure */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Exposure</CardTitle>
          </CardHeader>
          <RiskIndicator
            atRisk={riskData.atRisk}
            lowRisk={riskData.lowRisk}
            safe={riskData.safe}
          />
        </Card>
      </div>

      {/* Share Price History */}
      <Card>
        <CardHeader>
          <CardTitle>Share Price History</CardTitle>
        </CardHeader>
        {historyLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : sharePriceHistory.length === 0 ? (
          <div className="h-[200px] flex flex-col items-center justify-center bg-slate-800/30 rounded-lg">
            <p className="text-cool-gray text-body-sm">No historical data yet</p>
            <p className="text-silver text-body-sm mt-1">Data will appear after pool activity</p>
          </div>
        ) : (
          <LineChart
            data={sharePriceHistory}
            color="#3B82F6"
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

      {/* Yield Sources */}
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
              <span className="text-body font-mono text-white">{userYield.invoiceYieldFormatted}</span>
              {userYield.totalYield > 0n && (
                <span className="text-body-sm text-cool-gray ml-2">
                  ({((Number(userYield.invoiceYield) / Number(userYield.totalYield)) * 100).toFixed(0)}%)
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
              <span className="text-body font-mono text-white">{userYield.treasuryYieldFormatted}</span>
              {userYield.totalYield > 0n && (
                <span className="text-body-sm text-cool-gray ml-2">
                  ({((Number(userYield.treasuryYield) / Number(userYield.totalYield)) * 100).toFixed(0)}%)
                </span>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-body font-medium text-white">Total Yield Earned</span>
            <span className="text-body font-mono text-success">{userYield.totalYieldFormatted}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
