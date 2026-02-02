/**
 * FundingService
 *
 * Service for managing invoice funding operations.
 * Used by operators to fund approved invoices via ExecutionPool.
 */

import { ethers } from 'ethers';
import type {
  Invoice,
  FundingRecord,
  RequestFundingParams,
  BatchFundParams,
} from '../types/invoice';
import type { TransactionResult } from '../types';
import { InvoiceService } from './InvoiceService';

// ExecutionPool ABI (minimal for service functions)
const EXECUTION_POOL_ABI = [
  'function fundInvoice(uint256 invoiceId, address supplier, uint128 fundingAmount, uint128 faceValue) external',
  'function getFundingRecord(uint256 invoiceId) external view returns (tuple(address supplier, uint128 fundingAmount, uint128 faceValue, uint64 fundedAt, bool funded, bool repaid))',
  'function isInvoiceFunded(uint256 invoiceId) external view returns (bool)',
  'function isInvoiceRepaid(uint256 invoiceId) external view returns (bool)',
  'function getStats() external view returns (uint256 totalFunded, uint256 totalRepaid, uint256 activeInvoices)',
  'function availableBalance() external view returns (uint256)',
  'event InvoiceFunded(uint256 indexed invoiceId, address indexed supplier, uint256 amount)',
  'event RepaymentReceived(uint256 indexed invoiceId, address indexed buyer, uint256 amount)',
];

// InvoiceDiamond FundingFacet ABI
const FUNDING_FACET_ABI = [
  'function requestFunding(uint256 invoiceId) external',
  'function batchFund(uint256[] calldata invoiceIds) external',
  'function getFundingAmount(uint256 invoiceId) external view returns (uint128)',
  'function canFundInvoice(uint256 invoiceId) external view returns (bool)',
];

interface FundingServiceConfig {
  rpcUrl: string;
  executionPoolAddress: string;
  invoiceDiamondAddress: string;
  operatorPrivateKey: string; // Operator's private key for signing transactions
}

export class FundingService {
  private provider: ethers.JsonRpcProvider;
  private executionPool: ethers.Contract;
  private invoiceDiamond: ethers.Contract;
  private operatorWallet: ethers.Wallet;
  private config: FundingServiceConfig;
  private invoiceService: InvoiceService;

  /**
   * Initialize the FundingService
   * @param config Service configuration
   * @param invoiceService Invoice service instance
   */
  constructor(config: FundingServiceConfig, invoiceService: InvoiceService) {
    this.config = config;
    this.invoiceService = invoiceService;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.operatorWallet = new ethers.Wallet(config.operatorPrivateKey, this.provider);

    this.executionPool = new ethers.Contract(
      config.executionPoolAddress,
      EXECUTION_POOL_ABI,
      this.operatorWallet
    );

    this.invoiceDiamond = new ethers.Contract(
      config.invoiceDiamondAddress,
      FUNDING_FACET_ABI,
      this.operatorWallet
    );
  }

  // ============ Funding Operations ============

  /**
   * Request funding for an approved invoice
   * This triggers the full funding flow:
   * 1. Update invoice status in Diamond
   * 2. Pull USDC from LiquidityPool
   * 3. Transfer USDC to supplier
   *
   * @param invoiceId Invoice ID to fund
   * @returns Transaction receipt
   */
  async requestFunding(invoiceId: bigint): Promise<ethers.TransactionReceipt | null> {
    // Verify invoice can be funded
    const canFund = await this.invoiceService.canFundInvoice(invoiceId);
    if (!canFund) {
      throw new Error(`Invoice ${invoiceId} cannot be funded (not approved or already funded)`);
    }

    // Get invoice details
    const invoice = await this.invoiceService.getInvoice(invoiceId);
    const fundingAmount = await this.invoiceService.getFundingAmount(invoiceId);

    // Step 1: Update Diamond state (requestFunding in FundingFacet)
    const diamondTx = await this.invoiceDiamond.requestFunding(invoiceId);
    await diamondTx.wait();

    // Step 2: Fund via ExecutionPool (pulls from LiquidityPool, sends to supplier)
    const tx = await this.executionPool.fundInvoice(
      invoiceId,
      invoice.supplier,
      fundingAmount,
      invoice.faceValue
    );

    return tx.wait();
  }

  /**
   * Batch fund multiple approved invoices
   * @param invoiceIds Array of invoice IDs to fund
   * @returns Array of transaction receipts (null for failed funding)
   */
  async batchFund(invoiceIds: bigint[]): Promise<(ethers.TransactionReceipt | null)[]> {
    const results: (ethers.TransactionReceipt | null)[] = [];

    // Filter to only fundable invoices
    const fundableInvoices: bigint[] = [];
    for (const id of invoiceIds) {
      try {
        const canFund = await this.invoiceService.canFundInvoice(id);
        if (canFund) {
          fundableInvoices.push(id);
        }
      } catch {
        // Skip invoices that error on check
      }
    }

    if (fundableInvoices.length === 0) {
      return [];
    }

    // Update Diamond state for all (batch)
    try {
      const batchTx = await this.invoiceDiamond.batchFund(fundableInvoices);
      await batchTx.wait();
    } catch (error) {
      console.error('Batch Diamond update failed:', error);
      throw error;
    }

    // Fund each via ExecutionPool
    for (const id of fundableInvoices) {
      try {
        const invoice = await this.invoiceService.getInvoice(id);
        const fundingAmount = await this.invoiceService.getFundingAmount(id);

        const tx = await this.executionPool.fundInvoice(
          id,
          invoice.supplier,
          fundingAmount,
          invoice.faceValue
        );

        const receipt = await tx.wait();
        results.push(receipt);
      } catch (error) {
        console.error(`Failed to fund invoice ${id}:`, error);
        results.push(null);
      }
    }

    return results;
  }

  // ============ Query Functions ============

  /**
   * Check if an invoice can be funded
   * @param invoiceId Invoice ID
   * @returns True if can be funded
   */
  async canFund(invoiceId: bigint): Promise<boolean> {
    return this.invoiceService.canFundInvoice(invoiceId);
  }

  /**
   * Get funding amount for an invoice
   * @param invoiceId Invoice ID
   * @returns Funding amount (after discount)
   */
  async getFundingAmount(invoiceId: bigint): Promise<bigint> {
    return this.invoiceService.getFundingAmount(invoiceId);
  }

  /**
   * Get funding record from ExecutionPool
   * @param invoiceId Invoice ID
   * @returns Funding record
   */
  async getFundingRecord(invoiceId: bigint): Promise<FundingRecord> {
    const record = await this.executionPool.getFundingRecord(invoiceId);

    return {
      invoiceId,
      supplier: record.supplier,
      fundingAmount: BigInt(record.fundingAmount),
      faceValue: BigInt(record.faceValue),
      fundedAt: new Date(Number(record.fundedAt) * 1000),
      funded: record.funded,
      repaid: record.repaid,
    };
  }

  /**
   * Check if an invoice has been funded
   * @param invoiceId Invoice ID
   */
  async isInvoiceFunded(invoiceId: bigint): Promise<boolean> {
    return this.executionPool.isInvoiceFunded(invoiceId);
  }

  /**
   * Get available balance in ExecutionPool
   * @returns USDC balance
   */
  async getAvailableBalance(): Promise<bigint> {
    return this.executionPool.availableBalance();
  }

  /**
   * Get ExecutionPool statistics
   */
  async getPoolStats(): Promise<{
    totalFunded: bigint;
    totalRepaid: bigint;
    activeInvoices: number;
  }> {
    const [totalFunded, totalRepaid, activeInvoices] = await this.executionPool.getStats();

    return {
      totalFunded: BigInt(totalFunded),
      totalRepaid: BigInt(totalRepaid),
      activeInvoices: Number(activeInvoices),
    };
  }

  // ============ Automation ============

  /**
   * Find and fund all pending approved invoices
   * Used for automated funding
   * @returns Number of invoices funded
   */
  async fundAllApproved(): Promise<number> {
    // Get stats to find pending invoices
    const stats = await this.invoiceService.getStats();

    // This would require iterating through all invoices or maintaining an index
    // For now, return 0 - in production, you'd maintain an off-chain index
    console.log('fundAllApproved requires off-chain invoice tracking');
    return 0;
  }

  // ============ Event Listeners ============

  /**
   * Listen for InvoiceFunded events on ExecutionPool
   */
  onInvoiceFunded(
    callback: (invoiceId: bigint, supplier: string, amount: bigint) => void
  ): void {
    this.executionPool.on('InvoiceFunded', (invoiceId, supplier, amount) => {
      callback(BigInt(invoiceId), supplier, BigInt(amount));
    });
  }

  /**
   * Stop listening to events
   */
  removeAllListeners(): void {
    this.executionPool.removeAllListeners();
    this.invoiceDiamond.removeAllListeners();
  }
}

export default FundingService;
