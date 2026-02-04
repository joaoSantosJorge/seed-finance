'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAccount, useChainId, usePublicClient } from 'wagmi';
import { formatUnits, type Log, parseAbiItem } from 'viem';
import { liquidityPoolAbi } from '@/abis/LiquidityPool';
import { getContractAddresses, USDC_DECIMALS, SEED_DECIMALS } from '@/lib/contracts';
import { formatCurrency, formatShares } from '@/lib/formatters';
import type { TransactionType } from '@/types';

// ============ Types ============

export interface PoolTransaction {
  id: string;
  type: TransactionType;
  hash: string;
  blockNumber: bigint;
  timestamp: number;
  assets: bigint;
  shares: bigint;
  assetsFormatted: string;
  sharesFormatted: string;
  description: string;
}

export interface UserTransactionsData {
  transactions: PoolTransaction[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  summary: {
    totalDeposited: bigint;
    totalWithdrawn: bigint;
    netDeposits: bigint;
    totalDepositedFormatted: string;
    totalWithdrawnFormatted: string;
    netDepositsFormatted: string;
  };
}

// ============ Event Types ============

interface DepositEventArgs {
  sender: `0x${string}`;
  owner: `0x${string}`;
  assets: bigint;
  shares: bigint;
}

interface WithdrawEventArgs {
  sender: `0x${string}`;
  receiver: `0x${string}`;
  owner: `0x${string}`;
  assets: bigint;
  shares: bigint;
}

// ============ Hook ============

/**
 * Fetches user's deposit and withdrawal history directly from blockchain events
 * Note: For production, a backend indexer would be more efficient
 */
export function useUserTransactions(): UserTransactionsData {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const addresses = getContractAddresses(chainId);

  const [transactions, setTransactions] = useState<PoolTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blockTimestamps, setBlockTimestamps] = useState<Map<bigint, number>>(new Map());

  const fetchTransactions = useCallback(async () => {
    if (!isConnected || !address || !publicClient) {
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get current block for range calculation
      const currentBlock = await publicClient.getBlockNumber();
      // Fetch last ~30 days of blocks (assuming ~12 sec blocks on most chains)
      // ~7200 blocks per day * 30 days = 216000 blocks
      const fromBlock = currentBlock > 216000n ? currentBlock - 216000n : 0n;

      // Fetch Deposit events where owner is the user
      const depositLogs = await publicClient.getContractEvents({
        address: addresses.liquidityPool,
        abi: liquidityPoolAbi,
        eventName: 'Deposit',
        args: {
          owner: address,
        },
        fromBlock,
        toBlock: currentBlock,
      });

      // Fetch Withdraw events where owner is the user
      const withdrawLogs = await publicClient.getContractEvents({
        address: addresses.liquidityPool,
        abi: liquidityPoolAbi,
        eventName: 'Withdraw',
        args: {
          owner: address,
        },
        fromBlock,
        toBlock: currentBlock,
      });

      // Collect unique block numbers to fetch timestamps
      const blockNumbers = new Set<bigint>();
      [...depositLogs, ...withdrawLogs].forEach((log) => {
        if (log.blockNumber) {
          blockNumbers.add(log.blockNumber);
        }
      });

      // Fetch block timestamps
      const timestamps = new Map<bigint, number>();
      await Promise.all(
        Array.from(blockNumbers).map(async (blockNum) => {
          try {
            const block = await publicClient.getBlock({ blockNumber: blockNum });
            timestamps.set(blockNum, Number(block.timestamp));
          } catch {
            timestamps.set(blockNum, Math.floor(Date.now() / 1000));
          }
        })
      );
      setBlockTimestamps(timestamps);

      // Transform deposit logs
      const depositTxs: PoolTransaction[] = depositLogs.map((log) => {
        const args = log.args as DepositEventArgs;
        return {
          id: `deposit-${log.transactionHash}-${log.logIndex}`,
          type: 'deposit' as TransactionType,
          hash: log.transactionHash || '0x',
          blockNumber: log.blockNumber || 0n,
          timestamp: timestamps.get(log.blockNumber || 0n) || Math.floor(Date.now() / 1000),
          assets: args.assets,
          shares: args.shares,
          assetsFormatted: formatCurrency(parseFloat(formatUnits(args.assets, USDC_DECIMALS))),
          sharesFormatted: formatShares(args.shares),
          description: `Deposited ${formatCurrency(parseFloat(formatUnits(args.assets, USDC_DECIMALS)))} for ${formatShares(args.shares)} SEED`,
        };
      });

      // Transform withdraw logs
      const withdrawTxs: PoolTransaction[] = withdrawLogs.map((log) => {
        const args = log.args as WithdrawEventArgs;
        return {
          id: `withdraw-${log.transactionHash}-${log.logIndex}`,
          type: 'withdrawal' as TransactionType,
          hash: log.transactionHash || '0x',
          blockNumber: log.blockNumber || 0n,
          timestamp: timestamps.get(log.blockNumber || 0n) || Math.floor(Date.now() / 1000),
          assets: args.assets,
          shares: args.shares,
          assetsFormatted: formatCurrency(parseFloat(formatUnits(args.assets, USDC_DECIMALS))),
          sharesFormatted: formatShares(args.shares),
          description: `Withdrew ${formatCurrency(parseFloat(formatUnits(args.assets, USDC_DECIMALS)))} (${formatShares(args.shares)} SEED)`,
        };
      });

      // Combine and sort by block number (most recent first)
      const allTxs = [...depositTxs, ...withdrawTxs].sort(
        (a, b) => Number(b.blockNumber) - Number(a.blockNumber)
      );

      setTransactions(allTxs);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected, publicClient, addresses.liquidityPool]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Calculate summary
  const summary = useMemo(() => {
    const totalDeposited = transactions
      .filter((tx) => tx.type === 'deposit')
      .reduce((sum, tx) => sum + tx.assets, 0n);

    const totalWithdrawn = transactions
      .filter((tx) => tx.type === 'withdrawal')
      .reduce((sum, tx) => sum + tx.assets, 0n);

    const netDeposits = totalDeposited - totalWithdrawn;

    return {
      totalDeposited,
      totalWithdrawn,
      netDeposits,
      totalDepositedFormatted: formatCurrency(
        parseFloat(formatUnits(totalDeposited, USDC_DECIMALS))
      ),
      totalWithdrawnFormatted: formatCurrency(
        parseFloat(formatUnits(totalWithdrawn, USDC_DECIMALS))
      ),
      netDepositsFormatted: formatCurrency(
        parseFloat(formatUnits(netDeposits, USDC_DECIMALS))
      ),
    };
  }, [transactions]);

  return {
    transactions,
    isLoading,
    error,
    refetch: fetchTransactions,
    summary,
  };
}
