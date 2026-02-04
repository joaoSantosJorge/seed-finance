/**
 * Types for historical pool and user data tracking
 * Used by the indexer service to track share price history,
 * user transactions, and cost basis calculations.
 */

// ============ Share Price History ============

export interface SharePriceSnapshot {
  id: number;
  blockNumber: bigint;
  timestamp: Date;
  totalAssets: bigint;
  totalSupply: bigint;
  sharePrice: bigint; // In USDC units (6 decimals) - value of 1 SEED share
}

export interface SharePriceHistoryQuery {
  period: '7d' | '30d' | '90d' | 'all';
  interval?: 'hourly' | 'daily';
}

// ============ User Transaction History ============

export type TransactionType = 'deposit' | 'withdraw';

export interface UserTransaction {
  id: number;
  userAddress: string;
  txHash: string;
  eventType: TransactionType;
  assets: bigint; // USDC amount (6 decimals)
  shares: bigint; // SEED shares (6 decimals)
  sharePriceAtTime: bigint; // Share price when transaction occurred
  blockNumber: bigint;
  timestamp: Date;
}

export interface UserTransactionQuery {
  userAddress: string;
  eventType?: TransactionType;
  limit?: number;
  offset?: number;
}

// ============ User Position Tracking ============

export interface UserPositionHistory {
  userAddress: string;
  totalDeposited: bigint; // Sum of all deposit amounts
  totalWithdrawn: bigint; // Sum of all withdrawal amounts
  costBasis: bigint; // FIFO or average cost basis
  realizedGain: bigint; // Profit from withdrawals
  firstDepositAt: Date;
  lastActivityAt: Date;
  transactionCount: number;
}

// ============ Yield Event Tracking ============

export type YieldEventType = 'invoice' | 'treasury';

export interface YieldEvent {
  id: number;
  eventType: YieldEventType;
  invoiceId?: bigint; // Only for invoice yield
  principal?: bigint; // Only for invoice yield
  yieldAmount: bigint;
  blockNumber: bigint;
  txHash: string;
  timestamp: Date;
}

// ============ Pool State Snapshots ============

export interface PoolStateSnapshot {
  id: number;
  blockNumber: bigint;
  timestamp: Date;
  totalAssets: bigint;
  totalSupply: bigint;
  totalDeployed: bigint;
  totalInTreasury: bigint;
  availableLiquidity: bigint;
  utilizationRate: number; // In basis points
  activeInvoices: number;
  totalInvoiceYield: bigint;
  totalTreasuryYield: bigint;
}

// ============ API Response Types ============

export interface SharePriceHistoryResponse {
  period: string;
  dataPoints: Array<{
    timestamp: number; // Unix timestamp
    sharePrice: number; // Decimal value
  }>;
  change: {
    absolute: number;
    percent: number;
  };
}

export interface UserPositionResponse {
  address: string;
  costBasis: string; // Formatted currency
  totalDeposited: string;
  totalWithdrawn: string;
  realizedGain: string;
  unrealizedGain: string;
  unrealizedGainPercent: number;
  firstDepositAt: string; // ISO date
  transactionCount: number;
}

export interface UserTransactionResponse {
  transactions: Array<{
    txHash: string;
    type: TransactionType;
    assets: string; // Formatted currency
    shares: string;
    sharePrice: string;
    timestamp: string; // ISO date
  }>;
  total: number;
  page: number;
  pageSize: number;
}

// ============ Indexer State ============

export interface IndexerState {
  lastProcessedBlock: bigint;
  lastProcessedTimestamp: Date;
  isRunning: boolean;
  errorCount: number;
  lastError?: string;
}

// ============ Events to Index ============

// From LiquidityPool.sol
export interface DepositEvent {
  sender: string;
  owner: string;
  assets: bigint;
  shares: bigint;
  blockNumber: bigint;
  transactionHash: string;
  logIndex: number;
}

export interface WithdrawEvent {
  sender: string;
  receiver: string;
  owner: string;
  assets: bigint;
  shares: bigint;
  blockNumber: bigint;
  transactionHash: string;
  logIndex: number;
}

export interface LiquidityReturnedEvent {
  invoiceId: bigint;
  principal: bigint;
  yield: bigint;
  blockNumber: bigint;
  transactionHash: string;
  logIndex: number;
}

export interface TreasuryYieldAccruedEvent {
  amount: bigint;
  newTotalTreasuryYield: bigint;
  blockNumber: bigint;
  transactionHash: string;
  logIndex: number;
}
