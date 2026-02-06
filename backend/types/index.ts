/**
 * Shared types for Seed Finance backend services
 */

// ============ User Types ============

export type UserType = 'lp' | 'buyer' | 'supplier';

export interface UserWallet {
  walletId: string;
  address: string;
  blockchain: string;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  userType: UserType;
  wallet?: UserWallet;
  bankAccounts?: BankAccount[];
  createdAt: Date;
  updatedAt: Date;
}

// ============ Wallet Types ============

export interface WalletInfo {
  walletId: string;
  address: string;
  blockchain: string;
  accountType: string;
}

export interface TokenBalance {
  token: {
    id: string;
    name: string;
    symbol: string;
    decimals: number;
    blockchain: string;
    contractAddress?: string;
  };
  amount: string;
}

export interface TransactionResult {
  id: string;
  state: 'PENDING' | 'CONFIRMED' | 'FAILED';
  txHash?: string;
  errorReason?: string;
  createdAt: Date;
}

// ============ Bank Account Types ============

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  routingNumber?: string;
  iban?: string;
  swift?: string;
  currency: string;
  country: string;
  verified: boolean;
}

// ============ Payment Types ============

export interface OnRampParams {
  userId: string;
  amount: number;
  currency: 'USD';
  bankAccountId: string;
  destinationWalletId: string;
}

export interface OnRampResult {
  paymentId: string;
  status: PaymentStatus;
  estimatedArrival?: Date;
  instructions?: PaymentInstructions;
}

export interface OffRampParams {
  userId: string;
  amount: bigint;
  sourceWalletId: string;
  bankAccountId: string;
}

export interface OffRampResult {
  payoutId: string;
  status: PaymentStatus;
  estimatedArrival?: Date;
}

export type PaymentStatus =
  | 'PENDING'
  | 'AWAITING_FUNDS'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface PaymentInstructions {
  beneficiaryName: string;
  beneficiaryAddress: string;
  bankName: string;
  bankAddress: string;
  accountNumber: string;
  routingNumber: string;
  reference: string;
}

// ============ CCTP Types ============

export type CCTPDomain = 0 | 1 | 2 | 3 | 5 | 6 | 7;

export const CCTP_DOMAINS: Record<string, CCTPDomain> = {
  ETHEREUM: 0,
  AVALANCHE: 1,
  OPTIMISM: 2,
  ARBITRUM: 3,
  SOLANA: 5,
  BASE: 6,
  POLYGON: 7,
};

export const CCTP_DOMAIN_NAMES: Record<CCTPDomain, string> = {
  0: 'Ethereum',
  1: 'Avalanche',
  2: 'Optimism',
  3: 'Arbitrum',
  5: 'Solana',
  6: 'Base',
  7: 'Polygon',
};

export interface CCTPTransfer {
  id: string;
  sourceDomain: CCTPDomain;
  destinationDomain: CCTPDomain;
  amount: bigint;
  sender: string;
  recipient: string;
  nonce: string;
  messageHash?: string;
  attestation?: string;
  status: 'PENDING' | 'ATTESTED' | 'RECEIVED' | 'FAILED';
  sourceTxHash?: string;
  destinationTxHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Deposit Routing Types ============

export type DepositRouteType = 'DIRECT' | 'CCTP' | 'GATEWAY';

export interface DepositRoute {
  type: DepositRouteType;
  sourceChain: number;
  sourceToken: string;
  destinationToken: string;
  estimatedGas: string;
  estimatedTime: string;
  steps: RouteStep[];
}

export interface RouteStep {
  type: 'APPROVE' | 'BURN' | 'WAIT_ATTESTATION' | 'RECEIVE' | 'BRIDGE' | 'DEPOSIT';
  description: string;
  estimatedTime?: string;
  contractAddress?: string;
  data?: Record<string, unknown>;
}

// ============ Webhook Types ============

export interface CircleWebhookPayload {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
  signature?: string;
}

export interface PaymentWebhookData {
  paymentId: string;
  status: PaymentStatus;
  amount: string;
  currency: string;
  walletId?: string;
  bankAccountId?: string;
  txHash?: string;
  errorCode?: string;
  errorMessage?: string;
}

// ============ API Response Types ============

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ============ Configuration Types ============

export interface CircleConfig {
  apiKey: string;
  entitySecret: string;
  baseUrl?: string;
}

export interface CCTPConfig {
  tokenMessenger: Record<number, string>;
  messageTransmitter: Record<number, string>;
  attestationApi: string;
}

export interface ContractAddresses {
  usdc: string;
  liquidityPool: string;
  cctpReceiver: string;
  smartRouter: string;
  invoiceDiamond?: string;
  executionPool?: string;
}

// ============ Invoice Types ============

export * from './invoice';

// ============ History/Indexer Types ============

export * from './history';
