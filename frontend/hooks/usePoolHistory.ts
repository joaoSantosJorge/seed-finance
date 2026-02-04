'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { USDC_DECIMALS } from '@/lib/contracts';
import { formatCurrency, formatPercent } from '@/lib/formatters';

// ============ Types ============

export interface SharePriceDataPoint {
  timestamp: number; // Unix timestamp
  value: number; // Share price as decimal
}

export interface SharePriceHistoryData {
  dataPoints: SharePriceDataPoint[];
  change: {
    absolute: number;
    percent: number;
  };
  isLoading: boolean;
  error: string | null;
}

export interface UserTransaction {
  txHash: string;
  type: 'deposit' | 'withdraw';
  assets: string; // Formatted currency
  shares: string;
  sharePrice: string;
  timestamp: string; // ISO date
  relativeTime: string;
}

export interface UserTransactionHistoryData {
  transactions: UserTransaction[];
  total: number;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
}

export interface UserCostBasisData {
  costBasis: bigint;
  formattedCostBasis: string;
  totalDeposited: bigint;
  formattedTotalDeposited: string;
  totalWithdrawn: bigint;
  formattedTotalWithdrawn: string;
  realizedGain: bigint;
  formattedRealizedGain: string;
  isLoading: boolean;
  error: string | null;
}

// ============ Configuration ============

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

// ============ Share Price History Hook ============

/**
 * Fetch share price history for charting
 * Currently returns mock/empty data - will connect to backend API when available
 */
export function useSharePriceHistory(
  period: '7d' | '30d' | '90d' | 'all' = '30d'
): SharePriceHistoryData {
  const [dataPoints, setDataPoints] = useState<SharePriceDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      setIsLoading(true);
      setError(null);

      try {
        // TODO: Connect to backend API when available
        // const response = await fetch(`${API_BASE_URL}/api/pool/history?period=${period}`);
        // const data = await response.json();
        // setDataPoints(data.dataPoints);

        // For now, return empty data - backend indexer needs to be running
        setDataPoints([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch share price history');
      } finally {
        setIsLoading(false);
      }
    }

    fetchHistory();
  }, [period]);

  const change = useMemo(() => {
    if (dataPoints.length < 2) {
      return { absolute: 0, percent: 0 };
    }

    const first = dataPoints[0].value;
    const last = dataPoints[dataPoints.length - 1].value;
    const absolute = last - first;
    const percent = first > 0 ? (absolute / first) * 100 : 0;

    return { absolute, percent };
  }, [dataPoints]);

  return {
    dataPoints,
    change,
    isLoading,
    error,
  };
}

// ============ User Transaction History Hook ============

/**
 * Fetch user's deposit/withdraw transaction history
 * Currently returns empty data - will connect to backend API when available
 */
export function useUserTransactionHistory(limit = 10): UserTransactionHistoryData {
  const { address, isConnected } = useAccount();
  const [transactions, setTransactions] = useState<UserTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function fetchTransactions() {
      if (!isConnected || !address) {
        setTransactions([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // TODO: Connect to backend API when available
        // const response = await fetch(
        //   `${API_BASE_URL}/api/users/${address}/transactions?limit=${limit}&page=${page}`
        // );
        // const data = await response.json();
        // setTransactions(data.transactions);
        // setTotal(data.total);

        // For now, return empty data - backend indexer needs to be running
        setTransactions([]);
        setTotal(0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch transaction history');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTransactions();
  }, [address, isConnected, limit, page]);

  const loadMore = () => {
    if (transactions.length < total) {
      setPage((p) => p + 1);
    }
  };

  return {
    transactions,
    total,
    isLoading,
    error,
    hasMore: transactions.length < total,
    loadMore,
  };
}

// ============ User Cost Basis Hook ============

/**
 * Fetch user's cost basis and realized/unrealized gains
 * Currently returns zero values - will connect to backend API when available
 */
export function useUserCostBasis(): UserCostBasisData {
  const { address, isConnected } = useAccount();
  const [data, setData] = useState<{
    costBasis: bigint;
    totalDeposited: bigint;
    totalWithdrawn: bigint;
    realizedGain: bigint;
  }>({
    costBasis: 0n,
    totalDeposited: 0n,
    totalWithdrawn: 0n,
    realizedGain: 0n,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCostBasis() {
      if (!isConnected || !address) {
        setData({
          costBasis: 0n,
          totalDeposited: 0n,
          totalWithdrawn: 0n,
          realizedGain: 0n,
        });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // TODO: Connect to backend API when available
        // const response = await fetch(`${API_BASE_URL}/api/users/${address}/position`);
        // const json = await response.json();
        // setData({
        //   costBasis: BigInt(json.costBasis),
        //   totalDeposited: BigInt(json.totalDeposited),
        //   totalWithdrawn: BigInt(json.totalWithdrawn),
        //   realizedGain: BigInt(json.realizedGain),
        // });

        // For now, return zero - backend indexer needs to be running
        setData({
          costBasis: 0n,
          totalDeposited: 0n,
          totalWithdrawn: 0n,
          realizedGain: 0n,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch cost basis');
      } finally {
        setIsLoading(false);
      }
    }

    fetchCostBasis();
  }, [address, isConnected]);

  const formatted = useMemo(
    () => ({
      costBasis: data.costBasis,
      formattedCostBasis: formatCurrency(
        parseFloat(formatUnits(data.costBasis, USDC_DECIMALS))
      ),
      totalDeposited: data.totalDeposited,
      formattedTotalDeposited: formatCurrency(
        parseFloat(formatUnits(data.totalDeposited, USDC_DECIMALS))
      ),
      totalWithdrawn: data.totalWithdrawn,
      formattedTotalWithdrawn: formatCurrency(
        parseFloat(formatUnits(data.totalWithdrawn, USDC_DECIMALS))
      ),
      realizedGain: data.realizedGain,
      formattedRealizedGain: formatCurrency(
        parseFloat(formatUnits(data.realizedGain, USDC_DECIMALS))
      ),
      isLoading,
      error,
    }),
    [data, isLoading, error]
  );

  return formatted;
}

// ============ Combined Position Hook ============

/**
 * Combined hook that provides full position data including historical cost basis
 * Once backend is available, this will provide accurate unrealized gain calculations
 */
export function useEnhancedUserPosition() {
  const costBasisData = useUserCostBasis();
  const transactionHistory = useUserTransactionHistory(5);

  return {
    costBasis: costBasisData,
    recentTransactions: transactionHistory,
    isLoading: costBasisData.isLoading || transactionHistory.isLoading,
    // Backend not yet available
    hasHistoricalData: false,
  };
}
