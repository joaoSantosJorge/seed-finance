/**
 * Invoice types for Seed Finance backend
 * Maps to the InvoiceDiamond smart contract structures
 */

// ============ Enums ============

/**
 * Invoice status enumeration
 * Matches LibInvoiceStorage.InvoiceStatus from contract
 */
export enum InvoiceStatus {
  Pending = 0,    // Created, awaiting buyer approval
  Approved = 1,   // Buyer approved, ready for funding
  Funded = 2,     // Funds sent to supplier
  Paid = 3,       // Buyer repaid, invoice complete
  Cancelled = 4,  // Cancelled by buyer or supplier
  Defaulted = 5,  // Overdue and marked as default
}

/**
 * Status labels for display
 */
export const InvoiceStatusLabels: Record<InvoiceStatus, string> = {
  [InvoiceStatus.Pending]: 'Pending Approval',
  [InvoiceStatus.Approved]: 'Approved',
  [InvoiceStatus.Funded]: 'Funded',
  [InvoiceStatus.Paid]: 'Paid',
  [InvoiceStatus.Cancelled]: 'Cancelled',
  [InvoiceStatus.Defaulted]: 'Defaulted',
};

/**
 * Status colors for UI
 */
export const InvoiceStatusColors: Record<InvoiceStatus, string> = {
  [InvoiceStatus.Pending]: 'yellow',
  [InvoiceStatus.Approved]: 'blue',
  [InvoiceStatus.Funded]: 'green',
  [InvoiceStatus.Paid]: 'emerald',
  [InvoiceStatus.Cancelled]: 'gray',
  [InvoiceStatus.Defaulted]: 'red',
};

// ============ Core Types ============

/**
 * Invoice data structure
 * Matches IInvoiceDiamond.InvoiceView from contract
 */
export interface Invoice {
  id: bigint;
  buyer: string;              // Buyer address
  supplier: string;           // Supplier address
  faceValue: bigint;          // Full invoice amount (USDC, 6 decimals)
  fundingAmount: bigint;      // Amount funded to supplier
  discountRateBps: number;    // Annual discount rate in basis points
  maturityDate: Date;
  status: InvoiceStatus;
  invoiceHash: string;        // IPFS CID or document hash (bytes32 as hex)
  externalId: string;         // External reference (bytes32 as hex)
  createdAt: Date;
  fundedAt?: Date;
  paidAt?: Date;
}

/**
 * Invoice with computed fields for frontend
 */
export interface InvoiceWithDetails extends Invoice {
  discountAmount: bigint;     // faceValue - fundingAmount
  yieldAmount: bigint;        // Same as discount (protocol perspective)
  daysToMaturity: number;
  isOverdue: boolean;
  discountRateAnnual: number; // discountRateBps / 100 (e.g., 5.00 for 500 bps)
}

// ============ Input Types ============

/**
 * Parameters for creating a new invoice
 */
export interface CreateInvoiceParams {
  buyerAddress: string;         // Buyer's wallet address
  faceValue: bigint;            // Invoice amount (USDC, 6 decimals)
  discountRateBps: number;      // Annual discount rate in basis points (e.g., 500 = 5%)
  maturityDate: Date;           // Payment due date
  invoiceHash?: string;         // IPFS CID of invoice document (optional)
  externalId?: string;          // External reference number (optional)
}

/**
 * Validated create invoice params (after validation)
 */
export interface ValidatedCreateInvoiceParams extends CreateInvoiceParams {
  buyerAddress: string;
  faceValue: bigint;
  discountRateBps: number;
  maturityDate: Date;
  maturityTimestamp: bigint;    // Unix timestamp as bigint
  invoiceHashBytes: string;     // Converted to bytes32 hex
  externalIdBytes: string;      // Converted to bytes32 hex
}

// ============ Query Types ============

/**
 * Filter options for listing invoices
 */
export interface InvoiceFilter {
  status?: InvoiceStatus | InvoiceStatus[];
  buyer?: string;
  supplier?: string;
  minFaceValue?: bigint;
  maxFaceValue?: bigint;
  maturityBefore?: Date;
  maturityAfter?: Date;
  createdBefore?: Date;
  createdAfter?: Date;
}

/**
 * Sort options for listing invoices
 */
export interface InvoiceSort {
  field: 'id' | 'faceValue' | 'maturityDate' | 'createdAt' | 'status';
  direction: 'asc' | 'desc';
}

/**
 * Pagination options
 */
export interface InvoicePagination {
  offset: number;
  limit: number;
}

/**
 * Paginated invoice response
 */
export interface InvoiceListResponse {
  invoices: Invoice[];
  total: number;
  hasMore: boolean;
}

// ============ Stats Types ============

/**
 * Aggregate statistics from the Diamond
 */
export interface InvoiceStats {
  totalFunded: bigint;          // Total USDC funded across all invoices
  totalRepaid: bigint;          // Total USDC repaid
  activeInvoiceCount: number;   // Number of currently funded invoices
  nextInvoiceId: number;        // Next invoice ID
}

/**
 * Extended stats with computed values
 */
export interface InvoiceStatsExtended extends InvoiceStats {
  totalYieldEarned: bigint;     // totalRepaid - totalFunded
  averageDiscount: number;      // Average discount rate in bps
  pendingCount: number;
  approvedCount: number;
  fundedCount: number;
  paidCount: number;
  cancelledCount: number;
  defaultedCount: number;
}

// ============ Funding Types ============

/**
 * Funding record from ExecutionPool
 */
export interface FundingRecord {
  invoiceId: bigint;
  supplier: string;
  fundingAmount: bigint;
  faceValue: bigint;
  fundedAt: Date;
  funded: boolean;
  repaid: boolean;
}

/**
 * Parameters for requesting funding
 */
export interface RequestFundingParams {
  invoiceId: bigint;
}

/**
 * Parameters for batch funding
 */
export interface BatchFundParams {
  invoiceIds: bigint[];
}

// ============ Repayment Types ============

/**
 * Parameters for processing repayment
 */
export interface ProcessRepaymentParams {
  invoiceId: bigint;
  buyerWalletId: string;  // Circle wallet ID for USDC transfer
}

/**
 * Repayment details
 */
export interface RepaymentDetails {
  invoiceId: bigint;
  faceValue: bigint;        // Amount to repay
  fundingAmount: bigint;    // Original funding amount
  yield: bigint;            // faceValue - fundingAmount
  maturityDate: Date;
  isOverdue: boolean;
  daysOverdue: number;
}

/**
 * Upcoming repayment summary for buyer
 */
export interface UpcomingRepayment {
  invoiceId: bigint;
  supplier: string;
  faceValue: bigint;
  maturityDate: Date;
  daysUntilDue: number;
  isOverdue: boolean;
}

// ============ Event Types ============

/**
 * Invoice created event data
 */
export interface InvoiceCreatedEvent {
  invoiceId: bigint;
  buyer: string;
  supplier: string;
  faceValue: bigint;
  discountRateBps: number;
  maturityDate: Date;
  blockNumber: number;
  transactionHash: string;
}

/**
 * Invoice approved event data
 */
export interface InvoiceApprovedEvent {
  invoiceId: bigint;
  buyer: string;
  approvedAt: Date;
  blockNumber: number;
  transactionHash: string;
}

/**
 * Invoice funded event data
 */
export interface InvoiceFundedEvent {
  invoiceId: bigint;
  supplier: string;
  fundingAmount: bigint;
  discount: bigint;
  fundedAt: Date;
  blockNumber: number;
  transactionHash: string;
}

/**
 * Invoice paid event data
 */
export interface InvoicePaidEvent {
  invoiceId: bigint;
  buyer: string;
  amountPaid: bigint;
  paidAt: Date;
  blockNumber: number;
  transactionHash: string;
}

// ============ Helper Functions ============

/**
 * Convert contract invoice data to Invoice type
 */
export function contractToInvoice(
  id: bigint,
  data: {
    buyer: string;
    supplier: string;
    faceValue: bigint;
    fundingAmount: bigint;
    maturityDate: bigint;
    createdAt: bigint;
    fundedAt: bigint;
    paidAt: bigint;
    discountRateBps: number;
    status: number;
    invoiceHash: string;
    externalId: string;
  }
): Invoice {
  return {
    id,
    buyer: data.buyer,
    supplier: data.supplier,
    faceValue: data.faceValue,
    fundingAmount: data.fundingAmount,
    discountRateBps: data.discountRateBps,
    maturityDate: new Date(Number(data.maturityDate) * 1000),
    status: data.status as InvoiceStatus,
    invoiceHash: data.invoiceHash,
    externalId: data.externalId,
    createdAt: new Date(Number(data.createdAt) * 1000),
    fundedAt: data.fundedAt > 0n ? new Date(Number(data.fundedAt) * 1000) : undefined,
    paidAt: data.paidAt > 0n ? new Date(Number(data.paidAt) * 1000) : undefined,
  };
}

/**
 * Add computed details to an invoice
 */
export function addInvoiceDetails(invoice: Invoice): InvoiceWithDetails {
  const now = new Date();
  const daysToMaturity = Math.ceil(
    (invoice.maturityDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    ...invoice,
    discountAmount: invoice.faceValue - invoice.fundingAmount,
    yieldAmount: invoice.faceValue - invoice.fundingAmount,
    daysToMaturity,
    isOverdue: invoice.status === InvoiceStatus.Funded && daysToMaturity < 0,
    discountRateAnnual: invoice.discountRateBps / 100,
  };
}

/**
 * Convert string to bytes32 hex (padded)
 */
export function stringToBytes32(str: string): string {
  if (!str) return '0x' + '0'.repeat(64);
  const hex = Buffer.from(str).toString('hex');
  return '0x' + hex.padEnd(64, '0').slice(0, 64);
}

/**
 * Convert bytes32 hex to string
 */
export function bytes32ToString(hex: string): string {
  if (!hex || hex === '0x' + '0'.repeat(64)) return '';
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Buffer.from(cleanHex, 'hex').toString().replace(/\0/g, '');
}
