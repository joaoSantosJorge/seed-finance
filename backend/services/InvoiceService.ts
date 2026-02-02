/**
 * InvoiceService
 *
 * Service for managing invoices in the Seed Finance protocol.
 * Interacts with the InvoiceDiamond contract via Circle Wallets.
 */

import { ethers } from 'ethers';
import type {
  Invoice,
  InvoiceWithDetails,
  CreateInvoiceParams,
  ValidatedCreateInvoiceParams,
  InvoiceFilter,
  InvoiceStats,
  InvoiceStatus,
  contractToInvoice,
  addInvoiceDetails,
  stringToBytes32,
} from '../types/invoice';
import type { TransactionResult, WalletInfo } from '../types';
import { CircleWalletsService } from './CircleWalletsService';

// InvoiceDiamond ABI (minimal for service functions)
const INVOICE_DIAMOND_ABI = [
  // InvoiceFacet
  'function createInvoice(address buyer, uint128 faceValue, uint16 discountRateBps, uint64 maturityDate, bytes32 invoiceHash, bytes32 externalId) external returns (uint256)',
  'function approveInvoice(uint256 invoiceId) external',
  'function cancelInvoice(uint256 invoiceId) external',
  // FundingFacet
  'function getFundingAmount(uint256 invoiceId) external view returns (uint128)',
  'function canFundInvoice(uint256 invoiceId) external view returns (bool)',
  // RepaymentFacet
  'function getRepaymentAmount(uint256 invoiceId) external view returns (uint128)',
  'function isOverdue(uint256 invoiceId) external view returns (bool)',
  // ViewFacet
  'function getInvoice(uint256 invoiceId) external view returns (tuple(uint256 id, address buyer, address supplier, uint128 faceValue, uint128 fundingAmount, uint64 maturityDate, uint64 createdAt, uint64 fundedAt, uint64 paidAt, uint16 discountRateBps, uint8 status, bytes32 invoiceHash, bytes32 externalId))',
  'function getSupplierInvoices(address supplier) external view returns (uint256[])',
  'function getBuyerInvoices(address buyer) external view returns (uint256[])',
  'function getPendingApprovals(address buyer) external view returns (uint256[])',
  'function getUpcomingRepayments(address buyer) external view returns (uint256[])',
  'function getStats() external view returns (uint256 totalFunded, uint256 totalRepaid, uint256 activeCount, uint256 nextId)',
  // Events
  'event InvoiceCreated(uint256 indexed invoiceId, address indexed buyer, address indexed supplier, uint128 faceValue, uint16 discountRateBps, uint64 maturityDate)',
  'event InvoiceApproved(uint256 indexed invoiceId, address indexed buyer, uint64 approvedAt)',
  'event InvoiceFunded(uint256 indexed invoiceId, address indexed supplier, uint128 fundingAmount, uint128 discount, uint64 fundedAt)',
  'event InvoicePaid(uint256 indexed invoiceId, address indexed buyer, uint128 amountPaid, uint64 paidAt)',
];

interface InvoiceServiceConfig {
  rpcUrl: string;
  invoiceDiamondAddress: string;
}

export class InvoiceService {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private config: InvoiceServiceConfig;
  private walletService: CircleWalletsService;

  /**
   * Initialize the InvoiceService
   * @param config Service configuration
   * @param walletService Circle Wallets service for transaction execution
   */
  constructor(config: InvoiceServiceConfig, walletService: CircleWalletsService) {
    this.config = config;
    this.walletService = walletService;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.contract = new ethers.Contract(
      config.invoiceDiamondAddress,
      INVOICE_DIAMOND_ABI,
      this.provider
    );
  }

  // ============ Invoice Creation ============

  /**
   * Create a new invoice
   * @param supplierWalletId Circle wallet ID of the supplier
   * @param params Invoice creation parameters
   * @returns Transaction result
   */
  async createInvoice(
    supplierWalletId: string,
    params: CreateInvoiceParams
  ): Promise<TransactionResult> {
    // Validate and prepare params
    const validatedParams = this.validateCreateParams(params);

    // Execute via Circle Wallet
    return this.walletService.executeTransaction({
      walletId: supplierWalletId,
      contractAddress: this.config.invoiceDiamondAddress,
      functionSignature: 'createInvoice(address,uint128,uint16,uint64,bytes32,bytes32)',
      args: [
        validatedParams.buyerAddress,
        validatedParams.faceValue.toString(),
        validatedParams.discountRateBps,
        validatedParams.maturityTimestamp.toString(),
        validatedParams.invoiceHashBytes,
        validatedParams.externalIdBytes,
      ],
    });
  }

  /**
   * Validate and prepare create invoice params
   */
  private validateCreateParams(params: CreateInvoiceParams): ValidatedCreateInvoiceParams {
    // Validate buyer address
    if (!ethers.isAddress(params.buyerAddress)) {
      throw new Error('Invalid buyer address');
    }

    // Validate face value
    if (params.faceValue <= 0n) {
      throw new Error('Face value must be positive');
    }

    // Validate discount rate (0-10000 bps = 0-100%)
    if (params.discountRateBps < 0 || params.discountRateBps > 10000) {
      throw new Error('Discount rate must be between 0 and 10000 bps');
    }

    // Validate maturity date is in future
    if (params.maturityDate.getTime() <= Date.now()) {
      throw new Error('Maturity date must be in the future');
    }

    // Convert to bytes32
    const invoiceHashBytes = params.invoiceHash
      ? this.stringToBytes32(params.invoiceHash)
      : '0x' + '0'.repeat(64);

    const externalIdBytes = params.externalId
      ? this.stringToBytes32(params.externalId)
      : '0x' + '0'.repeat(64);

    return {
      ...params,
      maturityTimestamp: BigInt(Math.floor(params.maturityDate.getTime() / 1000)),
      invoiceHashBytes,
      externalIdBytes,
    };
  }

  /**
   * Convert string to bytes32 (right-padded)
   */
  private stringToBytes32(str: string): string {
    const bytes = ethers.toUtf8Bytes(str);
    const padded = ethers.zeroPadBytes(bytes.slice(0, 32), 32);
    return ethers.hexlify(padded);
  }

  // ============ Invoice Approval ============

  /**
   * Approve an invoice (buyer action)
   * @param buyerWalletId Circle wallet ID of the buyer
   * @param invoiceId Invoice ID to approve
   * @returns Transaction result
   */
  async approveInvoice(
    buyerWalletId: string,
    invoiceId: bigint
  ): Promise<TransactionResult> {
    return this.walletService.executeTransaction({
      walletId: buyerWalletId,
      contractAddress: this.config.invoiceDiamondAddress,
      functionSignature: 'approveInvoice(uint256)',
      args: [invoiceId.toString()],
    });
  }

  /**
   * Cancel a pending invoice (supplier or buyer action)
   * @param walletId Circle wallet ID of the canceler
   * @param invoiceId Invoice ID to cancel
   * @returns Transaction result
   */
  async cancelInvoice(
    walletId: string,
    invoiceId: bigint
  ): Promise<TransactionResult> {
    return this.walletService.executeTransaction({
      walletId,
      contractAddress: this.config.invoiceDiamondAddress,
      functionSignature: 'cancelInvoice(uint256)',
      args: [invoiceId.toString()],
    });
  }

  // ============ Invoice Queries ============

  /**
   * Get invoice by ID
   * @param invoiceId Invoice ID
   * @returns Invoice data
   */
  async getInvoice(invoiceId: bigint): Promise<Invoice> {
    const data = await this.contract.getInvoice(invoiceId);

    return {
      id: invoiceId,
      buyer: data.buyer,
      supplier: data.supplier,
      faceValue: BigInt(data.faceValue),
      fundingAmount: BigInt(data.fundingAmount),
      discountRateBps: Number(data.discountRateBps),
      maturityDate: new Date(Number(data.maturityDate) * 1000),
      status: Number(data.status) as InvoiceStatus,
      invoiceHash: data.invoiceHash,
      externalId: data.externalId,
      createdAt: new Date(Number(data.createdAt) * 1000),
      fundedAt: data.fundedAt > 0n ? new Date(Number(data.fundedAt) * 1000) : undefined,
      paidAt: data.paidAt > 0n ? new Date(Number(data.paidAt) * 1000) : undefined,
    };
  }

  /**
   * Get invoice with computed details
   * @param invoiceId Invoice ID
   * @returns Invoice with computed fields
   */
  async getInvoiceWithDetails(invoiceId: bigint): Promise<InvoiceWithDetails> {
    const invoice = await this.getInvoice(invoiceId);
    return this.addDetails(invoice);
  }

  /**
   * Add computed details to invoice
   */
  private addDetails(invoice: Invoice): InvoiceWithDetails {
    const now = new Date();
    const daysToMaturity = Math.ceil(
      (invoice.maturityDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      ...invoice,
      discountAmount: invoice.faceValue - invoice.fundingAmount,
      yieldAmount: invoice.faceValue - invoice.fundingAmount,
      daysToMaturity,
      isOverdue: invoice.status === 2 && daysToMaturity < 0, // Status.Funded
      discountRateAnnual: invoice.discountRateBps / 100,
    };
  }

  /**
   * Get invoices for a supplier
   * @param supplierAddress Supplier wallet address
   * @returns Array of invoices
   */
  async getSupplierInvoices(supplierAddress: string): Promise<Invoice[]> {
    const invoiceIds: bigint[] = await this.contract.getSupplierInvoices(supplierAddress);
    return Promise.all(invoiceIds.map((id) => this.getInvoice(id)));
  }

  /**
   * Get invoices for a buyer
   * @param buyerAddress Buyer wallet address
   * @returns Array of invoices
   */
  async getBuyerInvoices(buyerAddress: string): Promise<Invoice[]> {
    const invoiceIds: bigint[] = await this.contract.getBuyerInvoices(buyerAddress);
    return Promise.all(invoiceIds.map((id) => this.getInvoice(id)));
  }

  /**
   * Get pending approvals for a buyer
   * @param buyerAddress Buyer wallet address
   * @returns Array of pending invoices
   */
  async getPendingApprovals(buyerAddress: string): Promise<Invoice[]> {
    const invoiceIds: bigint[] = await this.contract.getPendingApprovals(buyerAddress);
    return Promise.all(invoiceIds.map((id) => this.getInvoice(id)));
  }

  /**
   * Get upcoming repayments for a buyer
   * @param buyerAddress Buyer wallet address
   * @returns Array of funded invoices awaiting repayment
   */
  async getUpcomingRepayments(buyerAddress: string): Promise<Invoice[]> {
    const invoiceIds: bigint[] = await this.contract.getUpcomingRepayments(buyerAddress);
    return Promise.all(invoiceIds.map((id) => this.getInvoice(id)));
  }

  // ============ Funding Helpers ============

  /**
   * Get the funding amount for an invoice
   * @param invoiceId Invoice ID
   * @returns Funding amount (after discount)
   */
  async getFundingAmount(invoiceId: bigint): Promise<bigint> {
    return this.contract.getFundingAmount(invoiceId);
  }

  /**
   * Check if an invoice can be funded
   * @param invoiceId Invoice ID
   * @returns True if can be funded
   */
  async canFundInvoice(invoiceId: bigint): Promise<boolean> {
    return this.contract.canFundInvoice(invoiceId);
  }

  // ============ Repayment Helpers ============

  /**
   * Get the repayment amount for an invoice
   * @param invoiceId Invoice ID
   * @returns Repayment amount (face value)
   */
  async getRepaymentAmount(invoiceId: bigint): Promise<bigint> {
    return this.contract.getRepaymentAmount(invoiceId);
  }

  /**
   * Check if an invoice is overdue
   * @param invoiceId Invoice ID
   * @returns True if overdue
   */
  async isOverdue(invoiceId: bigint): Promise<boolean> {
    return this.contract.isOverdue(invoiceId);
  }

  // ============ Stats ============

  /**
   * Get aggregate statistics
   * @returns Invoice stats
   */
  async getStats(): Promise<InvoiceStats> {
    const [totalFunded, totalRepaid, activeCount, nextId] = await this.contract.getStats();

    return {
      totalFunded: BigInt(totalFunded),
      totalRepaid: BigInt(totalRepaid),
      activeInvoiceCount: Number(activeCount),
      nextInvoiceId: Number(nextId),
    };
  }

  // ============ Event Listeners ============

  /**
   * Listen for InvoiceCreated events
   * @param callback Callback function
   */
  onInvoiceCreated(
    callback: (invoiceId: bigint, buyer: string, supplier: string) => void
  ): void {
    this.contract.on('InvoiceCreated', (invoiceId, buyer, supplier) => {
      callback(BigInt(invoiceId), buyer, supplier);
    });
  }

  /**
   * Listen for InvoiceApproved events
   * @param callback Callback function
   */
  onInvoiceApproved(
    callback: (invoiceId: bigint, buyer: string) => void
  ): void {
    this.contract.on('InvoiceApproved', (invoiceId, buyer) => {
      callback(BigInt(invoiceId), buyer);
    });
  }

  /**
   * Listen for InvoiceFunded events
   * @param callback Callback function
   */
  onInvoiceFunded(
    callback: (invoiceId: bigint, supplier: string, fundingAmount: bigint) => void
  ): void {
    this.contract.on('InvoiceFunded', (invoiceId, supplier, fundingAmount) => {
      callback(BigInt(invoiceId), supplier, BigInt(fundingAmount));
    });
  }

  /**
   * Listen for InvoicePaid events
   * @param callback Callback function
   */
  onInvoicePaid(
    callback: (invoiceId: bigint, buyer: string, amount: bigint) => void
  ): void {
    this.contract.on('InvoicePaid', (invoiceId, buyer, amount) => {
      callback(BigInt(invoiceId), buyer, BigInt(amount));
    });
  }

  /**
   * Stop listening to all events
   */
  removeAllListeners(): void {
    this.contract.removeAllListeners();
  }
}

export default InvoiceService;
