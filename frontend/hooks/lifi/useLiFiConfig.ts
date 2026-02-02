'use client';

import { useMemo } from 'react';
import {
  createWidgetConfig,
  isLiFiReceiverConfigured,
  isLiFiBridgingAvailable,
  getCurrentChainConfig,
} from '@/lib/lifi';
import type { WidgetConfig } from '@lifi/widget';

export interface UseLiFiConfigResult {
  /** LI.FI Widget configuration */
  widgetConfig: WidgetConfig;
  /** Whether the LiFiReceiver contract is configured */
  isReceiverConfigured: boolean;
  /** Whether LI.FI bridging is available (false on testnet) */
  isBridgingAvailable: boolean;
  /** Current destination chain ID */
  destinationChainId: number;
  /** USDC address on destination chain */
  usdcAddress: string;
  /** LiFiReceiver contract address */
  receiverAddress: string;
  /** Whether the configuration is ready for use */
  isReady: boolean;
}

/**
 * Hook to get LI.FI widget configuration
 *
 * Usage:
 * ```tsx
 * const { widgetConfig, isReady, isBridgingAvailable } = useLiFiConfig();
 *
 * if (!isBridgingAvailable) {
 *   return <MockLiFiWidget />;
 * }
 *
 * return <LiFiWidget config={widgetConfig} />;
 * ```
 */
export function useLiFiConfig(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _onSuccess?: (hash: string) => void
): UseLiFiConfigResult {
  const chainConfig = useMemo(() => getCurrentChainConfig(), []);
  const isReceiverConfigured = useMemo(() => isLiFiReceiverConfigured(), []);
  const isBridgingAvailable = useMemo(() => isLiFiBridgingAvailable(), []);

  const widgetConfig = useMemo(
    () => createWidgetConfig(),
    []
  );

  const isReady = isReceiverConfigured && isBridgingAvailable;

  return {
    widgetConfig,
    isReceiverConfigured,
    isBridgingAvailable,
    destinationChainId: chainConfig.chainId,
    usdcAddress: chainConfig.usdcAddress,
    receiverAddress: chainConfig.receiverAddress,
    isReady,
  };
}
