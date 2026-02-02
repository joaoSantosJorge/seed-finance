'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { parseUnits, formatUnits, type Address } from 'viem';
import { contracts, chainId } from '@/lib/config';
import { USDC_DECIMALS } from '@/lib/contracts';
import { liquidityPoolAbi } from '@/abis/LiquidityPool';
import { usePreviewDeposit } from '@/hooks/contracts/useLiquidityPool';
import { useUSDCAllowanceForPool, useApproveUSDC, useUSDCBalance } from '@/hooks/contracts/useUSDC';

export interface MockLiFiQuote {
  /** Input amount in source token */
  inputAmount: number;
  /** Output amount in USDC */
  outputAmount: number;
  /** Estimated SEED shares */
  estimatedShares: string;
  /** Bridge name (mock) */
  bridge: string;
  /** Estimated time (mock) */
  estimatedTime: string;
  /** Gas cost estimate (mock) */
  gasCost: string;
  /** Bridge fee (mock) */
  bridgeFee: string;
  /** Exchange rate */
  exchangeRate: number;
}

interface UseMockLiFiOptions {
  sourceChain: number;
  sourceToken: string;
  amount: bigint;
  onSuccess?: (hash: string) => void;
  onError?: (error: Error) => void;
}

interface UseMockLiFiResult {
  /** Simulated quote */
  quote: MockLiFiQuote | null;
  /** Whether quote is loading */
  isLoadingQuote: boolean;
  /** Execute the mock deposit */
  executeDeposit: (recipient: Address) => void;
  /** Transaction pending (awaiting wallet signature) */
  isPending: boolean;
  /** Transaction confirming (on-chain) */
  isConfirming: boolean;
  /** Transaction successful */
  isSuccess: boolean;
  /** Transaction error */
  error: Error | null;
  /** Transaction hash */
  hash: Address | undefined;
}

/**
 * Mock LI.FI Hook for Testnet Development
 *
 * Simulates the LI.FI cross-chain flow:
 * 1. Generates mock quotes with fake bridge/gas data
 * 2. Executes a direct USDC deposit (since we're on testnet)
 * 3. Simulates the cross-chain timing
 *
 * In production, this would be replaced by actual LI.FI SDK calls.
 */
export function useMockLiFi({
  sourceChain,
  sourceToken,
  amount,
  onSuccess,
  onError,
}: UseMockLiFiOptions): UseMockLiFiResult {
  const { address } = useAccount();

  // Quote state
  const [quote, setQuote] = useState<MockLiFiQuote | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);

  // Get preview shares from actual pool
  const { data: previewShares } = usePreviewDeposit(amount > 0n ? amount : undefined);

  // USDC hooks for actual deposit
  const { data: usdcBalance } = useUSDCBalance(address);
  const { data: allowance, refetch: refetchAllowance } = useUSDCAllowanceForPool(address);
  const {
    approvePool,
    isPending: approvePending,
    isConfirming: approveConfirming,
    isSuccess: approveSuccess,
  } = useApproveUSDC();

  // Deposit transaction
  const {
    writeContract: deposit,
    data: depositHash,
    isPending: depositPending,
    error: depositError,
    reset: resetDeposit,
  } = useWriteContract();

  const { isLoading: depositConfirming, isSuccess: depositSuccess } =
    useWaitForTransactionReceipt({
      hash: depositHash,
    });

  // Generate mock quote
  useEffect(() => {
    if (amount === 0n) {
      setQuote(null);
      return;
    }

    setIsLoadingQuote(true);

    // Simulate quote loading delay
    const timer = setTimeout(() => {
      const inputAmountNum = parseFloat(formatUnits(amount, USDC_DECIMALS));

      // Mock exchange rates based on source token
      const exchangeRates: Record<string, number> = {
        USDC: 1.0,
        USDT: 0.9998,
        DAI: 0.9995,
        ETH: 3200,
        WETH: 3195,
      };

      const rate = exchangeRates[sourceToken] || 1.0;
      const inputValue = sourceToken === 'USDC' || sourceToken === 'USDT' || sourceToken === 'DAI'
        ? inputAmountNum
        : inputAmountNum * rate;

      // Calculate output with simulated fees
      const bridgeFeePercent = 0.001; // 0.1%
      const slippage = 0.005; // 0.5%
      const outputAmount = inputValue * (1 - bridgeFeePercent - slippage);

      setQuote({
        inputAmount: inputAmountNum,
        outputAmount,
        estimatedShares: previewShares
          ? formatUnits(previewShares, USDC_DECIMALS)
          : outputAmount.toFixed(2),
        bridge: getBridgeName(sourceChain),
        estimatedTime: getEstimatedTime(sourceChain),
        gasCost: getGasCost(sourceChain),
        bridgeFee: `$${(inputValue * bridgeFeePercent).toFixed(2)}`,
        exchangeRate: rate,
      });

      setIsLoadingQuote(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [amount, sourceChain, sourceToken, previewShares]);

  // Refetch allowance after approval
  useEffect(() => {
    if (approveSuccess) {
      refetchAllowance();
    }
  }, [approveSuccess, refetchAllowance]);

  // Handle success callback
  useEffect(() => {
    if (depositSuccess && depositHash) {
      onSuccess?.(depositHash);
    }
  }, [depositSuccess, depositHash, onSuccess]);

  // Execute deposit (uses direct USDC deposit for mock)
  const executeDeposit = useCallback(
    (recipient: Address) => {
      if (amount === 0n || !contracts.liquidityPool) return;

      // Check if approval needed
      const needsApproval = allowance !== undefined && amount > 0n && allowance < amount;

      if (needsApproval) {
        approvePool(amount);
        return;
      }

      // Execute deposit
      deposit({
        address: contracts.liquidityPool,
        abi: liquidityPoolAbi,
        functionName: 'deposit',
        args: [amount, recipient],
        chainId,
      });
    },
    [amount, allowance, approvePool, deposit, contracts.liquidityPool, chainId]
  );

  // Combined pending state
  const isPending = approvePending || depositPending;
  const isConfirming = approveConfirming || depositConfirming;
  const isSuccess = depositSuccess;
  const error = depositError ? new Error(depositError.message) : null;

  return {
    quote,
    isLoadingQuote,
    executeDeposit,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash: depositHash,
  };
}

// Helper functions for mock data
function getBridgeName(chainId: number): string {
  const bridges: Record<number, string> = {
    1: 'Across Protocol',
    10: 'Optimism Bridge',
    137: 'Polygon Bridge',
    42161: 'Arbitrum Bridge',
    8453: 'Direct (Same Chain)',
  };
  return bridges[chainId] || 'LI.FI Aggregator';
}

function getEstimatedTime(chainId: number): string {
  const times: Record<number, string> = {
    1: '~10-30 min',
    10: '~2-5 min',
    137: '~5-15 min',
    42161: '~2-5 min',
    8453: '~30 sec',
  };
  return times[chainId] || '~5-10 min';
}

function getGasCost(chainId: number): string {
  const costs: Record<number, string> = {
    1: '~$5-15',
    10: '~$0.10',
    137: '~$0.05',
    42161: '~$0.15',
    8453: '~$0.01',
  };
  return costs[chainId] || '~$0.50';
}
