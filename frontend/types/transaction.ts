// ============ Transaction Types ============
export type TransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'yield_invoice'
  | 'yield_treasury'
  | 'pool_event';

export interface Transaction {
  id: string;
  type: TransactionType;
  hash: string;
  blockNumber: number;
  timestamp: number;

  // Amounts
  assetsAmount: bigint;
  sharesAmount: bigint;
  sharePrice: bigint;

  // Metadata
  invoiceId?: number;
  description: string;

  // User context
  userAddress: string;
  userProportionalYield?: bigint;
}

export interface FormattedTransaction {
  id: string;
  type: TransactionType;
  hash: string;
  blockNumber: number;
  timestamp: string;
  relativeTime: string;
  assetsAmount: string;
  sharesAmount: string;
  sharePrice: string;
  invoiceId?: number;
  description: string;
  userAddress: string;
  userProportionalYield?: string;
}

export interface TransactionFilter {
  type?: TransactionType | 'all';
  dateRange?: {
    start: Date;
    end: Date;
  };
  limit: number;
  offset: number;
}

export interface TransactionSummary {
  totalDeposited: bigint;
  totalWithdrawn: bigint;
  netDeposits: bigint;
  yieldEarned: bigint;
  transactionCount: number;
}
