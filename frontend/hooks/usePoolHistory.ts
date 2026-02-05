'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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

export interface PoolStateDataPoint {
  timestamp: number;
  utilizationRate: number;
  totalInvoiceYield: number;
  totalTreasuryYield: number;
  totalAssets: number;
}

export interface PoolStateHistoryData {
  dataPoints: PoolStateDataPoint[];
  yieldChange: {
    invoice: number;
    treasury: number;
    total: number;
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

// ============ Share Price History Hook ============

/**
 * Fetch share price history for charting
 * Connects to /api/pool/share-price-history endpoint
 */
export function useSharePriceHistory(
  period: '7d' | '30d' | '90d' | 'all' = '30d'
): SharePriceHistoryData {
  const [dataPoints, setDataPoints] = useState<SharePriceDataPoint[]>([]);
  const [change, setChange] = useState({ absolute: 0, percent: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/pool/share-price-history?period=${period}`);
        if (!response.ok) {
          throw new Error('Failed to fetch share price history');
        }
        const data = await response.json();

        // Convert to component format (API returns sharePrice, we need value)
        const points: SharePriceDataPoint[] = data.dataPoints.map(
          (p: { timestamp: number; sharePrice: number }) => ({
            timestamp: p.timestamp,
            value: p.sharePrice,
          })
        );

        setDataPoints(points);
        setChange(data.change || { absolute: 0, percent: 0 });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch share price history');
        setDataPoints([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchHistory();
  }, [period]);

  return {
    dataPoints,
    change,
    isLoading,
    error,
  };
}

// ============ Pool State History Hook ============

/**
 * Fetch pool state history for analytics charts
 * (utilization, yield breakdown, etc.)
 */
export function usePoolStateHistory(
  period: '7d' | '30d' | '90d' | 'all' = '30d'
): PoolStateHistoryData {
  const [dataPoints, setDataPoints] = useState<PoolStateDataPoint[]>([]);
  const [yieldChange, setYieldChange] = useState({ invoice: 0, treasury: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/pool/state-history?period=${period}`);
        if (!response.ok) {
          throw new Error('Failed to fetch pool state history');
        }
        const data = await response.json();
        setDataPoints(data.dataPoints || []);
        setYieldChange(data.yieldChange || { invoice: 0, treasury: 0, total: 0 });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch pool state history');
        setDataPoints([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchHistory();
  }, [period]);

  return {
    dataPoints,
    yieldChange,
    isLoading,
    error,
  };
}

// ============ User Transaction History Hook ============

/**
 * Fetch user's deposit/withdraw transaction history
 * Connects to /api/user/:address/transactions endpoint
 */
export function useUserTransactionHistory(limit = 10): UserTransactionHistoryData {
  const { address, isConnected } = useAccount();
  const [transactions, setTransactions] = useState<UserTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    async function fetchTransactions() {
      if (!isConnected || !address) {
        setTransactions([]);
        setTotal(0);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/user/${address}/transactions?limit=${limit}&offset=${offset}`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch transaction history');
        }
        const data = await response.json();

        // Format transactions with relative time
        const formattedTxs: UserTransaction[] = data.transactions.map(
          (tx: {
            txHash: string;
            type: 'deposit' | 'withdraw';
            assets: string;
            shares: string;
            sharePrice: string;
            timestamp: string;
          }) => ({
            ...tx,
            relativeTime: getRelativeTime(new Date(tx.timestamp)),
          })
        );

        if (offset === 0) {
          setTransactions(formattedTxs);
        } else {
          setTransactions((prev) => [...prev, ...formattedTxs]);
        }
        setTotal(data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch transaction history');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTransactions();
  }, [address, isConnected, limit, offset]);

  const loadMore = useCallback(() => {
    if (transactions.length < total) {
      setOffset((prev) => prev + limit);
    }
  }, [transactions.length, total, limit]);

  return {
    transactions,
    total,
    isLoading,
    error,
    hasMore: transactions.length < total,
    loadMore,
  };
}

// Helper to format relative time
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ============ User Cost Basis Hook ============

/**
 * Fetch user's cost basis and realized/unrealized gains
 * Connects to /api/user/:address/position endpoint
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
        const response = await fetch(`/api/user/${address}/position`);
        if (!response.ok) {
          throw new Error('Failed to fetch user position');
        }
        const json = await response.json();

        // Convert string values to bigint (values are in decimal format from API)
        const parseToBigint = (val: string) => {
          const num = parseFloat(val);
          return BigInt(Math.round(num * 1e6)); // Convert to 6 decimal bigint
        };

        setData({
          costBasis: parseToBigint(json.costBasis),
          totalDeposited: parseToBigint(json.totalDeposited),
          totalWithdrawn: parseToBigint(json.totalWithdrawn),
          realizedGain: parseToBigint(json.realizedGain),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch cost basis');
        setData({
          costBasis: 0n,
          totalDeposited: 0n,
          totalWithdrawn: 0n,
          realizedGain: 0n,
        });
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
