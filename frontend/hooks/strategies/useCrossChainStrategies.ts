'use client';

import { useReadContract, useReadContracts } from 'wagmi';
import { type Address, formatUnits } from 'viem';
import { useChainId } from 'wagmi';

// ============ Types ============

export interface CrossChainStrategy {
  address: Address;
  name: string;
  destinationChain: string;
  destinationChainId: number;
  yieldSource: string;
  estimatedAPY: number;
  isActive: boolean;
  totalValue: bigint;
  pendingDeposits: bigint;
  pendingWithdrawals: bigint;
  lastReportedValue: bigint;
  lastValueUpdate: number;
  isValueStale: boolean;
}

export interface StrategyAllocation {
  strategyAddress: Address;
  allocation: bigint; // Amount allocated
  percentage: number; // Percentage of total
}

// ============ ABI ============

const crossChainStrategyAbi = [
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'totalValue',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'pendingDeposits',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'pendingWithdrawals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'lastReportedValue',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'lastValueUpdate',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'isValueStale',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'destinationChainId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'estimatedAPY',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'isActive',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
] as const;

// ============ Strategy Config ============

interface StrategyConfig {
  address: Address;
  destinationChain: string;
  yieldSource: string;
}

// Configurable strategy addresses (would come from env/config in production)
export function getStrategyAddresses(): StrategyConfig[] {
  const lifiStrategy = process.env.NEXT_PUBLIC_LIFI_VAULT_STRATEGY_ADDRESS as Address | undefined;
  const arcStrategy = process.env.NEXT_PUBLIC_ARC_USYC_STRATEGY_ADDRESS as Address | undefined;

  const strategies: StrategyConfig[] = [];

  if (lifiStrategy && lifiStrategy !== '0x0000000000000000000000000000000000000000') {
    strategies.push({
      address: lifiStrategy,
      destinationChain: 'Arbitrum',
      yieldSource: 'Aave V3',
    });
  }

  if (arcStrategy && arcStrategy !== '0x0000000000000000000000000000000000000000') {
    strategies.push({
      address: arcStrategy,
      destinationChain: 'Arc',
      yieldSource: 'USYC T-Bills',
    });
  }

  return strategies;
}

// ============ Hooks ============

/**
 * Hook to fetch all cross-chain strategy data
 */
export function useCrossChainStrategies() {
  const strategyConfigs = getStrategyAddresses();

  // Create contract read configs for each strategy
  const contracts = strategyConfigs.flatMap((config) => [
    { address: config.address, abi: crossChainStrategyAbi, functionName: 'name' },
    { address: config.address, abi: crossChainStrategyAbi, functionName: 'totalValue' },
    { address: config.address, abi: crossChainStrategyAbi, functionName: 'pendingDeposits' },
    { address: config.address, abi: crossChainStrategyAbi, functionName: 'pendingWithdrawals' },
    { address: config.address, abi: crossChainStrategyAbi, functionName: 'lastReportedValue' },
    { address: config.address, abi: crossChainStrategyAbi, functionName: 'lastValueUpdate' },
    { address: config.address, abi: crossChainStrategyAbi, functionName: 'isValueStale' },
    { address: config.address, abi: crossChainStrategyAbi, functionName: 'destinationChainId' },
    { address: config.address, abi: crossChainStrategyAbi, functionName: 'estimatedAPY' },
    { address: config.address, abi: crossChainStrategyAbi, functionName: 'isActive' },
  ]);

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: contracts as any,
    query: {
      enabled: strategyConfigs.length > 0,
      refetchInterval: 30000, // Refresh every 30 seconds
    },
  });

  // Parse results into strategy objects
  const strategies: CrossChainStrategy[] = [];

  if (data && strategyConfigs.length > 0) {
    const fieldsPerStrategy = 10;

    for (let i = 0; i < strategyConfigs.length; i++) {
      const offset = i * fieldsPerStrategy;
      const config = strategyConfigs[i];

      // Extract results for this strategy
      const results = data.slice(offset, offset + fieldsPerStrategy);

      // Check if all calls succeeded
      const allSuccess = results.every((r) => r.status === 'success');

      if (allSuccess) {
        strategies.push({
          address: config.address,
          name: results[0].result as string,
          destinationChain: config.destinationChain,
          destinationChainId: Number(results[7].result),
          yieldSource: config.yieldSource,
          estimatedAPY: Number(results[8].result) / 100, // Convert from bps to %
          isActive: results[9].result as boolean,
          totalValue: results[1].result as bigint,
          pendingDeposits: results[2].result as bigint,
          pendingWithdrawals: results[3].result as bigint,
          lastReportedValue: results[4].result as bigint,
          lastValueUpdate: Number(results[5].result),
          isValueStale: results[6].result as boolean,
        });
      }
    }
  }

  // Calculate totals
  const totalValue = strategies.reduce((sum, s) => sum + s.totalValue, 0n);
  const totalPendingDeposits = strategies.reduce((sum, s) => sum + s.pendingDeposits, 0n);
  const totalPendingWithdrawals = strategies.reduce((sum, s) => sum + s.pendingWithdrawals, 0n);

  // Calculate weighted average APY
  const weightedAPY =
    totalValue > 0n
      ? strategies.reduce(
          (sum, s) => sum + (s.estimatedAPY * Number(s.totalValue)) / Number(totalValue),
          0
        )
      : 0;

  return {
    strategies,
    totalValue,
    totalPendingDeposits,
    totalPendingWithdrawals,
    weightedAPY,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch a single strategy's data
 */
export function useCrossChainStrategy(strategyAddress: Address | undefined) {
  const enabled = !!strategyAddress;

  const { data: name } = useReadContract({
    address: strategyAddress,
    abi: crossChainStrategyAbi,
    functionName: 'name',
    query: { enabled },
  });

  const { data: totalValue } = useReadContract({
    address: strategyAddress,
    abi: crossChainStrategyAbi,
    functionName: 'totalValue',
    query: { enabled, refetchInterval: 30000 },
  });

  const { data: pendingDeposits } = useReadContract({
    address: strategyAddress,
    abi: crossChainStrategyAbi,
    functionName: 'pendingDeposits',
    query: { enabled, refetchInterval: 30000 },
  });

  const { data: pendingWithdrawals } = useReadContract({
    address: strategyAddress,
    abi: crossChainStrategyAbi,
    functionName: 'pendingWithdrawals',
    query: { enabled, refetchInterval: 30000 },
  });

  const { data: lastReportedValue } = useReadContract({
    address: strategyAddress,
    abi: crossChainStrategyAbi,
    functionName: 'lastReportedValue',
    query: { enabled, refetchInterval: 30000 },
  });

  const { data: lastValueUpdate } = useReadContract({
    address: strategyAddress,
    abi: crossChainStrategyAbi,
    functionName: 'lastValueUpdate',
    query: { enabled, refetchInterval: 30000 },
  });

  const { data: isValueStale } = useReadContract({
    address: strategyAddress,
    abi: crossChainStrategyAbi,
    functionName: 'isValueStale',
    query: { enabled, refetchInterval: 30000 },
  });

  const { data: estimatedAPY } = useReadContract({
    address: strategyAddress,
    abi: crossChainStrategyAbi,
    functionName: 'estimatedAPY',
    query: { enabled },
  });

  const { data: isActive } = useReadContract({
    address: strategyAddress,
    abi: crossChainStrategyAbi,
    functionName: 'isActive',
    query: { enabled, refetchInterval: 30000 },
  });

  return {
    name: name as string | undefined,
    totalValue: totalValue as bigint | undefined,
    pendingDeposits: pendingDeposits as bigint | undefined,
    pendingWithdrawals: pendingWithdrawals as bigint | undefined,
    lastReportedValue: lastReportedValue as bigint | undefined,
    lastValueUpdate: lastValueUpdate as bigint | undefined,
    isValueStale: isValueStale as boolean | undefined,
    estimatedAPY: estimatedAPY as bigint | undefined,
    isActive: isActive as boolean | undefined,
  };
}

/**
 * Format strategy value for display
 */
export function formatStrategyValue(value: bigint | undefined): string {
  if (value === undefined) return '-';
  return formatUnits(value, 6);
}

/**
 * Format APY for display
 */
export function formatAPY(apyBps: number): string {
  return `${apyBps.toFixed(2)}%`;
}

/**
 * Format timestamp as relative time
 */
export function formatLastUpdate(timestamp: number): string {
  if (timestamp === 0) return 'Never';

  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
