'use client';

import { TreasuryCard, TreasuryActionsForm } from '@/components/operator';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTreasuryManager } from '@/hooks/operator/useTreasuryAdmin';
import { formatAddress } from '@/lib/formatters';
import { ExternalLink, AlertCircle } from 'lucide-react';
import { useChainId } from 'wagmi';

export default function OperatorTreasuryPage() {
  const chainId = useChainId();
  const { data: treasuryManagerAddress, isLoading } = useTreasuryManager();

  const explorerUrl =
    chainId === 1243
      ? 'https://arcscan.app'
      : chainId === 5042002
        ? 'https://testnet.arcscan.app'
        : 'https://etherscan.io';

  const isConfigured =
    treasuryManagerAddress &&
    treasuryManagerAddress !== '0x0000000000000000000000000000000000000000';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-h2 text-white">Treasury Management</h2>
        <p className="text-body text-cool-gray">
          Manage treasury allocations for yield optimization on idle capital.
        </p>
      </div>

      {/* Treasury Manager Address */}
      <Card>
        <CardHeader>
          <CardTitle>Treasury Manager</CardTitle>
        </CardHeader>
        {isLoading ? (
          <Skeleton className="h-10 w-64" />
        ) : isConfigured ? (
          <div className="flex items-center gap-3">
            <span className="font-mono text-white">
              {formatAddress(treasuryManagerAddress)}
            </span>
            <a
              href={`${explorerUrl}/address/${treasuryManagerAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-cool-gray hover:text-white transition-colors"
              title="View on Explorer"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border-2 border-yellow-500/20">
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            <p className="text-body text-white">
              Treasury Manager is not configured. Treasury features are disabled.
            </p>
          </div>
        )}
      </Card>

      {/* Treasury Status */}
      <TreasuryCard />

      {/* Treasury Actions */}
      {isConfigured ? (
        <TreasuryActionsForm />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Treasury Actions</CardTitle>
          </CardHeader>
          <div className="py-8 text-center">
            <p className="text-cool-gray">
              Treasury actions are unavailable until a Treasury Manager is configured.
            </p>
          </div>
        </Card>
      )}

      {/* Treasury Info */}
      <Card>
        <CardHeader>
          <CardTitle>About Treasury</CardTitle>
        </CardHeader>
        <div className="space-y-4 text-body text-cool-gray">
          <p>
            The Treasury system allows idle USDC in the Liquidity Pool to earn additional yield
            through external strategies (e.g., USYC from Hashnote).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
              <h4 className="text-body font-bold text-white mb-2">Deposit to Treasury</h4>
              <p className="text-body-sm">
                Move USDC from the pool to the treasury strategy for yield generation.
              </p>
            </div>
            <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
              <h4 className="text-body font-bold text-white mb-2">Withdraw from Treasury</h4>
              <p className="text-body-sm">
                Retrieve USDC from the treasury back to the pool for invoice funding.
              </p>
            </div>
            <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
              <h4 className="text-body font-bold text-white mb-2">Rebalance</h4>
              <p className="text-body-sm">
                Automatically deposit the optimal amount to maximize yield while maintaining
                liquidity buffer.
              </p>
            </div>
            <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
              <h4 className="text-body font-bold text-white mb-2">Accrue Yield</h4>
              <p className="text-body-sm">
                Record accumulated yield from the treasury strategy into the pool.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
