/**
 * CircleWalletsService
 *
 * Service for managing Circle Developer-Controlled Wallets.
 * Provides wallet creation, balance checking, and transaction execution
 * for LPs, buyers, and suppliers in the Seed Finance protocol.
 *
 * @package @circle-fin/developer-controlled-wallets
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import type {
  UserType,
  WalletInfo,
  TokenBalance,
  TransactionResult,
  CircleConfig,
} from '../types';

// Circle SDK client type
type CircleWalletsClient = ReturnType<typeof initiateDeveloperControlledWalletsClient>;

/**
 * Supported blockchain networks for Circle Wallets
 */
const SUPPORTED_BLOCKCHAINS = {
  ARC_TESTNET: 'ARC-TESTNET',
  BASE_SEPOLIA: 'BASE-SEPOLIA',
  BASE_MAINNET: 'BASE',
  ETHEREUM_SEPOLIA: 'ETH-SEPOLIA',
  ETHEREUM_MAINNET: 'ETH',
} as const;

/**
 * Default blockchain for new wallets
 * Note: Circle may not support ARC-TESTNET yet; update when available
 */
const DEFAULT_BLOCKCHAIN = SUPPORTED_BLOCKCHAINS.ARC_TESTNET;

/**
 * USDC contract addresses by blockchain
 */
const USDC_ADDRESSES: Record<string, string> = {
  'ARC-TESTNET': '0x3600000000000000000000000000000000000000',
  'BASE-SEPOLIA': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  'BASE': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'ETH-SEPOLIA': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  'ETH': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
};

export class CircleWalletsService {
  private client: CircleWalletsClient;
  private blockchain: string;

  /**
   * Initialize the Circle Wallets service
   * @param config Circle API configuration
   * @param blockchain Optional blockchain override (defaults to BASE-SEPOLIA)
   */
  constructor(config: CircleConfig, blockchain?: string) {
    this.client = initiateDeveloperControlledWalletsClient({
      apiKey: config.apiKey,
      entitySecret: config.entitySecret,
    });
    this.blockchain = blockchain || DEFAULT_BLOCKCHAIN;
  }

  // ============ Wallet Management ============

  /**
   * Create a new wallet for a user
   * @param userId Unique user identifier
   * @param userType Type of user (lp, buyer, supplier)
   * @returns Created wallet information
   */
  async createWallet(userId: string, userType: UserType): Promise<WalletInfo> {
    try {
      // Create a wallet set for the user
      const walletSetResponse = await this.client.createWalletSet({
        name: `${userType}-${userId}`,
      });

      const walletSetId = walletSetResponse.data?.walletSet?.id;
      if (!walletSetId) {
        throw new Error('Failed to create wallet set');
      }

      // Create a Smart Contract Account (SCA) wallet
      const walletsResponse = await this.client.createWallets({
        blockchains: [this.blockchain],
        count: 1,
        walletSetId,
        accountType: 'SCA', // Smart Contract Account for better UX
      });

      const wallet = walletsResponse.data?.wallets?.[0];
      if (!wallet) {
        throw new Error('Failed to create wallet');
      }

      return {
        walletId: wallet.id,
        address: wallet.address,
        blockchain: wallet.blockchain,
        accountType: wallet.accountType,
      };
    } catch (error) {
      console.error('Error creating wallet:', error);
      throw new Error(`Failed to create wallet: ${(error as Error).message}`);
    }
  }

  /**
   * Get wallet information by ID
   * @param walletId Circle wallet ID
   * @returns Wallet information
   */
  async getWallet(walletId: string): Promise<WalletInfo> {
    try {
      const response = await this.client.getWallet({ id: walletId });
      const wallet = response.data?.wallet;

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      return {
        walletId: wallet.id,
        address: wallet.address,
        blockchain: wallet.blockchain,
        accountType: wallet.accountType,
      };
    } catch (error) {
      console.error('Error getting wallet:', error);
      throw new Error(`Failed to get wallet: ${(error as Error).message}`);
    }
  }

  /**
   * Get wallet balance for all tokens
   * @param walletId Circle wallet ID
   * @returns Array of token balances
   */
  async getBalance(walletId: string): Promise<TokenBalance[]> {
    try {
      const response = await this.client.getWalletTokenBalance({ id: walletId });
      const balances = response.data?.tokenBalances || [];

      return balances.map((balance: {
        token?: {
          id?: string;
          name?: string;
          symbol?: string;
          decimals?: number;
          blockchain?: string;
          tokenAddress?: string;
        };
        amount?: string;
      }) => ({
        token: {
          id: balance.token?.id || '',
          name: balance.token?.name || '',
          symbol: balance.token?.symbol || '',
          decimals: balance.token?.decimals || 18,
          blockchain: balance.token?.blockchain || this.blockchain,
          contractAddress: balance.token?.tokenAddress,
        },
        amount: balance.amount || '0',
      }));
    } catch (error) {
      console.error('Error getting balance:', error);
      throw new Error(`Failed to get balance: ${(error as Error).message}`);
    }
  }

  /**
   * Get USDC balance for a wallet
   * @param walletId Circle wallet ID
   * @returns USDC balance as a number
   */
  async getUSDCBalance(walletId: string): Promise<number> {
    const balances = await this.getBalance(walletId);
    const usdc = balances.find((b) => b.token.symbol === 'USDC');
    return usdc ? parseFloat(usdc.amount) : 0;
  }

  // ============ Transaction Execution ============

  /**
   * Execute a contract transaction
   * @param params Transaction parameters
   * @returns Transaction result
   */
  async executeTransaction(params: {
    walletId: string;
    contractAddress: string;
    functionSignature: string;
    args: unknown[];
    value?: string;
  }): Promise<TransactionResult> {
    try {
      const response = await this.client.createContractExecutionTransaction({
        walletId: params.walletId,
        contractAddress: params.contractAddress,
        abiFunctionSignature: params.functionSignature,
        abiParameters: params.args,
        fee: {
          type: 'level',
          config: {
            feeLevel: 'MEDIUM',
          },
        },
      });

      const transaction = response.data;
      if (!transaction) {
        throw new Error('Failed to create transaction');
      }

      return {
        id: transaction.id || '',
        state: (transaction.state as TransactionResult['state']) || 'PENDING',
        txHash: transaction.txHash,
        createdAt: new Date(),
      };
    } catch (error) {
      console.error('Error executing transaction:', error);
      throw new Error(`Failed to execute transaction: ${(error as Error).message}`);
    }
  }

  /**
   * Approve USDC spending for a spender address
   * @param walletId Circle wallet ID
   * @param spender Address to approve for spending
   * @param amount Amount to approve (use BigInt for precision)
   * @returns Transaction result
   */
  async approveUSDC(
    walletId: string,
    spender: string,
    amount: bigint
  ): Promise<TransactionResult> {
    const usdcAddress = USDC_ADDRESSES[this.blockchain];
    if (!usdcAddress) {
      throw new Error(`USDC not supported on ${this.blockchain}`);
    }

    return this.executeTransaction({
      walletId,
      contractAddress: usdcAddress,
      functionSignature: 'approve(address,uint256)',
      args: [spender, amount.toString()],
    });
  }

  /**
   * Deposit USDC to the LiquidityPool
   * @param walletId Circle wallet ID
   * @param poolAddress LiquidityPool contract address
   * @param amount Amount to deposit (in USDC with 6 decimals)
   * @returns Transaction result
   */
  async depositToPool(
    walletId: string,
    poolAddress: string,
    amount: bigint
  ): Promise<TransactionResult> {
    // First, get the wallet address to use as receiver
    const wallet = await this.getWallet(walletId);

    return this.executeTransaction({
      walletId,
      contractAddress: poolAddress,
      functionSignature: 'deposit(uint256,address)',
      args: [amount.toString(), wallet.address],
    });
  }

  /**
   * Withdraw USDC from the LiquidityPool
   * @param walletId Circle wallet ID
   * @param poolAddress LiquidityPool contract address
   * @param amount Amount to withdraw (in USDC with 6 decimals)
   * @returns Transaction result
   */
  async withdrawFromPool(
    walletId: string,
    poolAddress: string,
    amount: bigint
  ): Promise<TransactionResult> {
    const wallet = await this.getWallet(walletId);

    return this.executeTransaction({
      walletId,
      contractAddress: poolAddress,
      functionSignature: 'withdraw(uint256,address,address)',
      args: [amount.toString(), wallet.address, wallet.address],
    });
  }

  /**
   * Redeem SEED shares for USDC
   * @param walletId Circle wallet ID
   * @param poolAddress LiquidityPool contract address
   * @param shares Amount of SEED shares to redeem
   * @returns Transaction result
   */
  async redeemShares(
    walletId: string,
    poolAddress: string,
    shares: bigint
  ): Promise<TransactionResult> {
    const wallet = await this.getWallet(walletId);

    return this.executeTransaction({
      walletId,
      contractAddress: poolAddress,
      functionSignature: 'redeem(uint256,address,address)',
      args: [shares.toString(), wallet.address, wallet.address],
    });
  }

  // ============ Invoice Operations (for Buyers) ============

  /**
   * Approve an invoice (for buyers)
   * @param walletId Buyer's Circle wallet ID
   * @param invoiceRegistryAddress InvoiceRegistry contract address
   * @param invoiceId Invoice ID to approve
   * @returns Transaction result
   */
  async approveInvoice(
    walletId: string,
    invoiceRegistryAddress: string,
    invoiceId: bigint
  ): Promise<TransactionResult> {
    return this.executeTransaction({
      walletId,
      contractAddress: invoiceRegistryAddress,
      functionSignature: 'approveInvoice(uint256)',
      args: [invoiceId.toString()],
    });
  }

  /**
   * Repay an invoice (for buyers)
   * @param walletId Buyer's Circle wallet ID
   * @param paymentRouterAddress PaymentRouter contract address
   * @param invoiceId Invoice ID to repay
   * @returns Transaction result
   */
  async repayInvoice(
    walletId: string,
    paymentRouterAddress: string,
    invoiceId: bigint
  ): Promise<TransactionResult> {
    return this.executeTransaction({
      walletId,
      contractAddress: paymentRouterAddress,
      functionSignature: 'processRepayment(uint256)',
      args: [invoiceId.toString()],
    });
  }

  // ============ Transaction Status ============

  /**
   * Get transaction status
   * @param transactionId Circle transaction ID
   * @returns Transaction result with current state
   */
  async getTransactionStatus(transactionId: string): Promise<TransactionResult> {
    try {
      const response = await this.client.getTransaction({ id: transactionId });
      const transaction = response.data;

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      return {
        id: transaction.id || '',
        state: (transaction.state as TransactionResult['state']) || 'PENDING',
        txHash: transaction.txHash,
        errorReason: transaction.errorReason,
        createdAt: new Date(transaction.createDate || Date.now()),
      };
    } catch (error) {
      console.error('Error getting transaction status:', error);
      throw new Error(`Failed to get transaction status: ${(error as Error).message}`);
    }
  }

  // ============ Utility Functions ============

  /**
   * Wait for a transaction to be confirmed
   * @param transactionId Circle transaction ID
   * @param maxAttempts Maximum polling attempts
   * @param intervalMs Polling interval in milliseconds
   * @returns Final transaction result
   */
  async waitForTransaction(
    transactionId: string,
    maxAttempts = 30,
    intervalMs = 2000
  ): Promise<TransactionResult> {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.getTransactionStatus(transactionId);

      if (status.state === 'CONFIRMED' || status.state === 'FAILED') {
        return status;
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error('Transaction confirmation timeout');
  }
}

export default CircleWalletsService;
