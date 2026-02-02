'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { DepositForm } from './DepositForm';
import { LiFiDepositWidget, MockLiFiWidget } from '@/components/lifi';
import { CCTPDepositFlow } from '@/components/cctp';
import { useLiFiConfig } from '@/hooks/lifi';
import { Wallet, Globe, Building2, ArrowRightLeft } from 'lucide-react';
import { Hex, Address } from 'viem';

interface UnifiedDepositFormProps {
  onSuccess?: () => void;
  cctpReceiverAddress?: Address;
}

/**
 * Unified Deposit Form
 *
 * Provides a tabbed interface for multiple deposit methods:
 * 1. Direct USDC deposits (for users with USDC on Base) - Fastest
 * 2. Cross-chain USDC via CCTP (Circle native, ~15 min)
 * 3. Cross-chain any token via LI.FI (flexible, variable time)
 * 4. Fiat on-ramp via Circle Gateway (for users without crypto)
 *
 * On testnet, some features show mock widgets for development.
 * On mainnet, they use the real integrations.
 */
export function UnifiedDepositForm({ onSuccess, cctpReceiverAddress }: UnifiedDepositFormProps) {
  const { isBridgingAvailable } = useLiFiConfig();
  const [activeTab, setActiveTab] = useState('usdc');

  const handleLiFiSuccess = (hash: string) => {
    console.log('LI.FI deposit successful:', hash);
    onSuccess?.();
  };

  const handleLiFiError = (error: Error) => {
    console.error('LI.FI deposit failed:', error);
  };

  const handleCCTPSuccess = (txHash: Hex, shares: bigint) => {
    console.log('CCTP deposit successful:', txHash, shares);
    onSuccess?.();
  };

  const handleCCTPError = (error: Error) => {
    console.error('CCTP deposit failed:', error);
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Tab List */}
        <TabsList className="w-full grid grid-cols-4 mb-6 rounded-lg overflow-hidden">
          <TabsTrigger value="usdc" className="flex flex-col items-center justify-center gap-1 py-3">
            <Wallet className="w-4 h-4" />
            <span className="text-xs">Direct</span>
          </TabsTrigger>
          <TabsTrigger value="cctp" className="flex flex-col items-center justify-center gap-1 py-3">
            <ArrowRightLeft className="w-4 h-4" />
            <span className="text-xs">CCTP</span>
          </TabsTrigger>
          <TabsTrigger value="lifi" className="flex flex-col items-center justify-center gap-1 py-3">
            <Globe className="w-4 h-4" />
            <span className="text-xs">Any Token</span>
          </TabsTrigger>
          <TabsTrigger value="fiat" className="flex flex-col items-center justify-center gap-1 py-3">
            <Building2 className="w-4 h-4" />
            <span className="text-xs">Fiat</span>
          </TabsTrigger>
        </TabsList>

        {/* Direct USDC Deposit */}
        <TabsContent value="usdc">
          <div className="space-y-4">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm text-green-700 dark:text-green-300">
                <strong>Fastest option</strong> - Deposit USDC directly from your wallet on Base.
              </p>
            </div>
            <DepositForm onSuccess={onSuccess} />
          </div>
        </TabsContent>

        {/* CCTP Cross-Chain USDC */}
        <TabsContent value="cctp">
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Native USDC transfer</strong> - Transfer USDC from Ethereum, Arbitrum, Polygon, or other chains via Circle&apos;s CCTP. Takes ~15 minutes.
              </p>
            </div>
            <CCTPDepositFlow
              onSuccess={handleCCTPSuccess}
              onError={handleCCTPError}
              cctpReceiverAddress={cctpReceiverAddress}
            />
          </div>
        </TabsContent>

        {/* LI.FI Cross-Chain Any Token */}
        <TabsContent value="lifi">
          <div className="space-y-4">
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-sm text-purple-700 dark:text-purple-300">
                <strong>Any token, any chain</strong> - Bridge and swap any token to USDC on Base. Time varies by route.
              </p>
            </div>
            {isBridgingAvailable ? (
              <LiFiDepositWidget
                onSuccess={handleLiFiSuccess}
                onError={handleLiFiError}
              />
            ) : (
              <MockLiFiWidget
                onSuccess={handleLiFiSuccess}
                onError={handleLiFiError}
              />
            )}
          </div>
        </TabsContent>

        {/* Fiat On-Ramp */}
        <TabsContent value="fiat">
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                <strong>Bank transfer</strong> - Deposit USD from your bank account via Circle Gateway. Takes 1-3 business days.
              </p>
            </div>
            <FiatOnRampPlaceholder />
          </div>
        </TabsContent>
      </Tabs>

      {/* Method comparison */}
      <DepositMethodComparison activeMethod={activeTab} />
    </div>
  );
}

/**
 * Fiat On-Ramp Placeholder
 *
 * Shows information about fiat deposits via Circle Gateway.
 * In production, this would integrate with Circle Gateway API.
 */
function FiatOnRampPlaceholder() {
  return (
    <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
          <Building2 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="font-semibold">Circle Gateway</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Bank transfer to USDC
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Supported methods</span>
          <span>ACH, Wire Transfer</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Processing time</span>
          <span>1-3 business days</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Fees</span>
          <span>0.5% - 1.5%</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Minimum</span>
          <span>$100 USD</span>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          To use fiat deposits, you&apos;ll need to:
        </p>
        <ol className="text-sm space-y-2">
          <li className="flex gap-2">
            <span className="w-5 h-5 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-xs font-medium text-blue-600">1</span>
            <span>Create a Circle account</span>
          </li>
          <li className="flex gap-2">
            <span className="w-5 h-5 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-xs font-medium text-blue-600">2</span>
            <span>Complete KYC verification</span>
          </li>
          <li className="flex gap-2">
            <span className="w-5 h-5 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-xs font-medium text-blue-600">3</span>
            <span>Link your bank account</span>
          </li>
        </ol>
      </div>

      <button
        className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50"
        disabled
      >
        Coming Soon
      </button>

      <p className="text-xs text-center text-gray-500">
        Circle Gateway integration is in development
      </p>
    </div>
  );
}

/**
 * Deposit Method Comparison
 *
 * Shows a comparison table of deposit methods to help users choose.
 */
function DepositMethodComparison({ activeMethod }: { activeMethod: string }) {
  const methods = [
    {
      id: 'usdc',
      name: 'Direct',
      speed: '~30 sec',
      fees: 'Gas only',
      requirements: 'USDC on Base',
      best: 'Already have USDC on Base',
    },
    {
      id: 'cctp',
      name: 'CCTP',
      speed: '~15 min',
      fees: 'Gas + attestation',
      requirements: 'USDC on supported chain',
      best: 'USDC on Ethereum/Arbitrum/etc',
    },
    {
      id: 'lifi',
      name: 'LI.FI',
      speed: '5-30 min',
      fees: 'Gas + bridge + swap',
      requirements: 'Any token on supported chain',
      best: 'Non-USDC tokens',
    },
    {
      id: 'fiat',
      name: 'Fiat',
      speed: '1-3 days',
      fees: '0.5-1.5%',
      requirements: 'Bank account + KYC',
      best: 'No crypto holdings',
    },
  ];

  const active = methods.find(m => m.id === activeMethod);

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <h4 className="text-sm font-medium mb-3">Method Comparison</h4>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400">Speed</span>
          <p className="font-medium">{active?.speed}</p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Fees</span>
          <p className="font-medium">{active?.fees}</p>
        </div>
        <div className="col-span-2">
          <span className="text-gray-500 dark:text-gray-400">Best for</span>
          <p className="font-medium">{active?.best}</p>
        </div>
      </div>
    </div>
  );
}
