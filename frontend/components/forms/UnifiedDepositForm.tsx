'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { DepositForm } from './DepositForm';
import { LiFiDepositWidget, MockLiFiWidget } from '@/components/lifi';
import { useLiFiConfig } from '@/hooks/lifi';
import { Wallet, Globe } from 'lucide-react';

interface UnifiedDepositFormProps {
  onSuccess?: () => void;
}

/**
 * Unified Deposit Form
 *
 * Provides a tabbed interface for:
 * 1. Direct USDC deposits (for users with USDC on Base)
 * 2. Cross-chain deposits (for users with any token on any chain)
 *
 * On testnet, the cross-chain tab shows a mock widget for development.
 * On mainnet, it shows the real LI.FI widget.
 */
export function UnifiedDepositForm({ onSuccess }: UnifiedDepositFormProps) {
  const { isBridgingAvailable } = useLiFiConfig();

  const handleLiFiSuccess = (hash: string) => {
    console.log('LI.FI deposit successful:', hash);
    onSuccess?.();
  };

  const handleLiFiError = (error: Error) => {
    console.error('LI.FI deposit failed:', error);
  };

  return (
    <Tabs defaultValue="usdc">
      {/* Tab List */}
      <TabsList className="w-full grid grid-cols-2 mb-6 rounded-lg overflow-hidden">
        <TabsTrigger value="usdc" className="flex items-center justify-center gap-2">
          <Wallet className="w-4 h-4" />
          <span>Deposit USDC</span>
        </TabsTrigger>
        <TabsTrigger value="any" className="flex items-center justify-center gap-2">
          <Globe className="w-4 h-4" />
          <span>Any Token</span>
        </TabsTrigger>
      </TabsList>

      {/* Direct USDC Deposit */}
      <TabsContent value="usdc">
        <DepositForm onSuccess={onSuccess} />
      </TabsContent>

      {/* Cross-Chain Deposit */}
      <TabsContent value="any">
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
      </TabsContent>
    </Tabs>
  );
}
