/**
 * RepaymentService
 *
 * Service for managing invoice repayment operations.
 * Used by buyers to repay funded invoices via Circle Wallets.
 */

import { ethers } from 'ethers';
import type {
  Invoice,
  InvoiceStatus,
  RepaymentDetails,
  UpcomingRepayment,
} from '../types/invoice';
import type { TransactionResult } from '../types';
import { CircleWalletsService } from './CircleWalletsService';
import { InvoiceService } from './InvoiceService';

// ExecutionPool ABI for repayment
const EXECUTION_POOL_ABI = [
  'function repayInvoice(uint256 invoiceId) external',
  'function receiveRepayment(uint256 invoiceId, address buyer) external',
  'function isInvoiceRepaid(uint256 invoiceId) external view returns (bool)',
  'event RepaymentReceived(uint256 indexed invoiceId, address indexed buyer, uint256 amount)',
  'event YieldReturned(uint256 indexed invoiceId, uint256 principal, uint256 yield)',
];

// USDC ABI for approval
const USDC_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
];

interface RepaymentServiceConfig {
  rpcUrl: string;
  executionPoolAddress: string;
  invoiceDiamondAddress: string;
  usdcAddress: string;
}

export class RepaymentService {
  private provider: ethers.JsonRpcProvider;
  private executionPool: ethers.Contract;
  private usdc: ethers.Contract;
  private config: RepaymentServiceConfig;
  private walletService: CircleWalletsService;
  private invoiceService: InvoiceService;

  /**
   * Initialize the RepaymentService
   * @param config Service configuration
   * @param walletService Circle Wallets service
   * @param invoiceService Invoice service
   */
  constructor(
    config: RepaymentServiceConfig,
    walletService: CircleWalletsService,
    invoiceService: InvoiceService
  ) {
    this.config = config;
    this.walletService = walletService;
    this.invoiceService = invoiceService;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);

    this.executionPool = new ethers.Contract(
      config.executionPoolAddress,
      EXECUTION_POOL_ABI,
      this.provider
    );

    this.usdc = new ethers.Contract(
      config.usdcAddress,
      USDC_ABI,
      this.provider
    );
  }

  // ============ Repayment Operations ============

  /**
   * Process repayment for a funded invoice
   * Two-step process:
   * 1. Approve USDC spending (if needed)
   * 2. Call repayInvoice on ExecutionPool
   *
   * @param buyerWalletId Circle wallet ID of the buyer
   * @param invoiceId Invoice ID to repay
   * @returns Transaction result
   */
  async processRepayment(
    buyerWalletId: string,
    invoiceId: bigint
  ): Promise<TransactionResult> {
    // Get invoice details
    const invoice = await this.invoiceService.getInvoice(invoiceId);

    // Verify invoice is funded and buyer owns it
    if (invoice.status !== 2) { // InvoiceStatus.Funded
      throw new Error(`Invoice ${invoiceId} is not in funded state`);
    }

    // Get wallet address
    const wallet = await this.walletService.getWallet(buyerWalletId);

    // Check USDC balance
    const balance = await this.usdc.balanceOf(wallet.address);
    if (balance < invoice.faceValue) {
      throw new Error(
        `Insufficient USDC balance. Required: ${invoice.faceValue}, Available: ${balance}`
      );
    }

    // Check and set allowance
    const allowance = await this.usdc.allowance(wallet.address, this.config.executionPoolAddress);
    if (allowance < invoice.faceValue) {
      // Approve ExecutionPool to spend USDC
      const approvalResult = await this.walletService.approveUSDC(
        buyerWalletId,
        this.config.executionPoolAddress,
        invoice.faceValue
      );

      // Wait for approval to be confirmed
      await this.walletService.waitForTransaction(approvalResult.id);
    }

    // Process repayment via ExecutionPool
    return this.walletService.executeTransaction({
      walletId: buyerWalletId,
      contractAddress: this.config.executionPoolAddress,
      functionSignature: 'repayInvoice(uint256)',
      args: [invoiceId.toString()],
    });
  }

  // ============ Query Functions ============

  /**
   * Get repayment amount for an invoice
   * @param invoiceId Invoice ID
   * @returns Repayment amount (face value)
   */
  async getRepaymentAmount(invoiceId: bigint): Promise<bigint> {
    return this.invoiceService.getRepaymentAmount(invoiceId);
  }

  /**
   * Get detailed repayment information
   * @param invoiceId Invoice ID
   * @returns Repayment details
   */
  async getRepaymentDetails(invoiceId: bigint): Promise<RepaymentDetails> {
    const invoice = await this.invoiceService.getInvoice(invoiceId);
    const isOverdue = await this.invoiceService.isOverdue(invoiceId);

    const now = new Date();
    const daysOverdue = isOverdue
      ? Math.ceil((now.getTime() - invoice.maturityDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      invoiceId,
      faceValue: invoice.faceValue,
      fundingAmount: invoice.fundingAmount,
      yield: invoice.faceValue - invoice.fundingAmount,
      maturityDate: invoice.maturityDate,
      isOverdue,
      daysOverdue,
    };
  }

  /**
   * Check if an invoice is overdue
   * @param invoiceId Invoice ID
   * @returns True if overdue
   */
  async isOverdue(invoiceId: bigint): Promise<boolean> {
    return this.invoiceService.isOverdue(invoiceId);
  }

  /**
   * Check if an invoice has been repaid
   * @param invoiceId Invoice ID
   */
  async isInvoiceRepaid(invoiceId: bigint): Promise<boolean> {
    return this.executionPool.isInvoiceRepaid(invoiceId);
  }

  /**
   * Get upcoming repayments for a buyer
   * @param buyerAddress Buyer wallet address
   * @returns Array of upcoming repayments sorted by due date
   */
  async getUpcomingRepayments(buyerAddress: string): Promise<UpcomingRepayment[]> {
    const invoices = await this.invoiceService.getUpcomingRepayments(buyerAddress);

    const now = new Date();
    const upcoming: UpcomingRepayment[] = invoices.map((invoice) => {
      const daysUntilDue = Math.ceil(
        (invoice.maturityDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        invoiceId: invoice.id,
        supplier: invoice.supplier,
        faceValue: invoice.faceValue,
        maturityDate: invoice.maturityDate,
        daysUntilDue,
        isOverdue: daysUntilDue < 0,
      };
    });

    // Sort by maturity date (soonest first)
    return upcoming.sort((a, b) => a.maturityDate.getTime() - b.maturityDate.getTime());
  }

  /**
   * Get overdue invoices for a buyer
   * @param buyerAddress Buyer wallet address
   * @returns Array of overdue invoices
   */
  async getOverdueInvoices(buyerAddress: string): Promise<Invoice[]> {
    const invoices = await this.invoiceService.getUpcomingRepayments(buyerAddress);

    const overdue: Invoice[] = [];
    for (const invoice of invoices) {
      const isOverdue = await this.invoiceService.isOverdue(invoice.id);
      if (isOverdue) {
        overdue.push(invoice);
      }
    }

    return overdue;
  }

  /**
   * Calculate total amount due for a buyer
   * @param buyerAddress Buyer wallet address
   * @returns Total USDC due
   */
  async getTotalAmountDue(buyerAddress: string): Promise<bigint> {
    const invoices = await this.invoiceService.getUpcomingRepayments(buyerAddress);
    return invoices.reduce((total, inv) => total + inv.faceValue, 0n);
  }

  // ============ Balance Checks ============

  /**
   * Check if buyer has sufficient balance to repay
   * @param buyerWalletId Circle wallet ID
   * @param invoiceId Invoice ID
   * @returns True if sufficient balance
   */
  async hasSufficientBalance(
    buyerWalletId: string,
    invoiceId: bigint
  ): Promise<boolean> {
    const invoice = await this.invoiceService.getInvoice(invoiceId);
    const wallet = await this.walletService.getWallet(buyerWalletId);
    const balance = await this.usdc.balanceOf(wallet.address);

    return balance >= invoice.faceValue;
  }

  /**
   * Get USDC balance for a wallet
   * @param walletAddress Wallet address
   * @returns USDC balance
   */
  async getUSDCBalance(walletAddress: string): Promise<bigint> {
    return this.usdc.balanceOf(walletAddress);
  }

  // ============ Event Listeners ============

  /**
   * Listen for RepaymentReceived events
   */
  onRepaymentReceived(
    callback: (invoiceId: bigint, buyer: string, amount: bigint) => void
  ): void {
    this.executionPool.on('RepaymentReceived', (invoiceId, buyer, amount) => {
      callback(BigInt(invoiceId), buyer, BigInt(amount));
    });
  }

  /**
   * Listen for YieldReturned events
   */
  onYieldReturned(
    callback: (invoiceId: bigint, principal: bigint, yield_: bigint) => void
  ): void {
    this.executionPool.on('YieldReturned', (invoiceId, principal, yield_) => {
      callback(BigInt(invoiceId), BigInt(principal), BigInt(yield_));
    });
  }

  /**
   * Stop listening to events
   */
  removeAllListeners(): void {
    this.executionPool.removeAllListeners();
  }
}

export default RepaymentService;
