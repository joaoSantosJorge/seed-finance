'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAccount } from 'wagmi';
import { Card, CardHeader, CardTitle, Skeleton } from '@/components/ui';
import { useLiFiConfig } from '@/hooks/lifi/useLiFiConfig';
import { AlertCircle, ExternalLink, Globe, Zap } from 'lucide-react';

// Dynamically import LI.FI Widget to avoid SSR issues
const LiFiWidget = dynamic(
  () => import('@lifi/widget').then((mod) => mod.LiFiWidget),
  {
    ssr: false,
    loading: () => (
      <div className="h-[500px] flex items-center justify-center">
        <Skeleton className="w-full h-full rounded-xl" />
      </div>
    ),
  }
);

interface LiFiDepositWidgetProps {
  onSuccess?: (hash: string) => void;
  onError?: (error: Error) => void;
}

/**
 * LI.FI Deposit Widget
 *
 * Allows users to deposit any token from any chain into Seed Finance.
 * The widget handles:
 * - Token selection (any token on any supported chain)
 * - Route finding (optimal swap/bridge path)
 * - Transaction execution
 * - Cross-chain messaging
 *
 * The resulting USDC is sent to the LiFiReceiver contract which
 * auto-deposits into the LiquidityPool.
 */
export function LiFiDepositWidget({ onSuccess, onError }: LiFiDepositWidgetProps) {
  const { isConnected } = useAccount();
  const { widgetConfig, isBridgingAvailable, isReceiverConfigured } =
    useLiFiConfig(onSuccess);

  const [error, setError] = useState<string | null>(null);

  // Handle widget error - will be passed to widget when supported
  const handleError = useCallback(
    (err: Error) => {
      setError(err.message || 'Transaction failed');
      onError?.(err);
    },
    [onError]
  );

  // Clear error when widget starts a new transaction
  useCallback(() => {
    setError(null);
  }, []);

  // Used to suppress the unused handleError warning while we wait for widget integration
  void handleError;

  // Show configuration warning if receiver not set
  if (!isReceiverConfigured) {
    return (
      <Card className="border-warning/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-warning">
            <AlertCircle className="w-5 h-5" />
            Configuration Required
          </CardTitle>
        </CardHeader>
        <div className="space-y-3">
          <p className="text-body text-cool-gray">
            The LiFiReceiver contract address is not configured. Cross-chain deposits
            are not available until the contract is deployed and configured.
          </p>
          <p className="text-body-sm text-silver">
            For direct USDC deposits on Base, use the &quot;Deposit USDC&quot; tab instead.
          </p>
        </div>
      </Card>
    );
  }

  // Show message if bridging not available (testnet)
  if (!isBridgingAvailable) {
    return (
      <Card className="border-info/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-info">
            <Globe className="w-5 h-5" />
            Testnet Mode
          </CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <p className="text-body text-cool-gray">
            Cross-chain bridging is not available on testnet. LI.FI has limited testnet
            support for bridges.
          </p>
          <div className="p-4 rounded-lg bg-slate-800/50 space-y-2">
            <p className="text-body text-white font-medium">
              Use these options instead:
            </p>
            <ul className="list-disc list-inside space-y-1 text-body-sm text-silver">
              <li>Switch to the &quot;Deposit USDC&quot; tab for direct deposits</li>
              <li>
                Get testnet USDC from{' '}
                <a
                  href="https://faucet.circle.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Circle Faucet
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                Get testnet ETH from{' '}
                <a
                  href="https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Coinbase Faucet
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>
        </div>
      </Card>
    );
  }

  // Show connect wallet message
  if (!isConnected) {
    return (
      <Card className="text-center py-12">
        <div className="space-y-4">
          <Zap className="w-12 h-12 mx-auto text-cool-gray" />
          <p className="text-body text-cool-gray">
            Connect your wallet to deposit from any chain
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <Card className="border-primary/20 bg-primary/5">
        <div className="flex items-start gap-3 p-4">
          <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-body text-white font-medium">
              Cross-Chain Deposit
            </p>
            <p className="text-body-sm text-silver">
              Swap any token from any chain to USDC on Base. Your deposit will be
              automatically added to the Seed Finance liquidity pool.
            </p>
          </div>
        </div>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-error/30 bg-error/5">
          <div className="flex items-start gap-3 p-4">
            <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
            <div>
              <p className="text-body text-error font-medium">Transaction Failed</p>
              <p className="text-body-sm text-error/80">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* LI.FI Widget */}
      <Card className="overflow-hidden p-0">
        <div className="min-h-[500px]">
          <LiFiWidget
            config={widgetConfig}
            integrator="seed-finance"
          />
        </div>
      </Card>

      {/* Disclaimer */}
      <p className="text-body-sm text-cool-gray text-center">
        Powered by{' '}
        <a
          href="https://li.fi"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          LI.FI
        </a>
        . Bridge times vary by route. Slippage and fees are shown in the widget.
      </p>
    </div>
  );
}
