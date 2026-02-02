'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { type Address, parseUnits, encodeAbiParameters, parseAbiParameters } from 'viem';
import { useChainId } from 'wagmi';
import { invoiceDiamondAbi } from '@/abis/InvoiceDiamond';
import { getContractAddresses, USDC_DECIMALS } from '@/lib/contracts';

// ============ Invoice Status Types ============

export enum InvoiceStatus {
  Pending = 0,
  Approved = 1,
  Funded = 2,
  Paid = 3,
  Cancelled = 4,
  Defaulted = 5,
}

export const InvoiceStatusLabels: Record<InvoiceStatus, string> = {
  [InvoiceStatus.Pending]: 'Pending Approval',
  [InvoiceStatus.Approved]: 'Approved',
  [InvoiceStatus.Funded]: 'Funded',
  [InvoiceStatus.Paid]: 'Paid',
  [InvoiceStatus.Cancelled]: 'Cancelled',
  [InvoiceStatus.Defaulted]: 'Defaulted',
};

export interface Invoice {
  id: bigint;
  buyer: Address;
  supplier: Address;
  faceValue: bigint;
  fundingAmount: bigint;
  maturityDate: bigint;
  createdAt: bigint;
  fundedAt: bigint;
  paidAt: bigint;
  discountRateBps: number;
  status: InvoiceStatus;
  invoiceHash: `0x${string}`;
  externalId: `0x${string}`;
}

// ============ Read Single Invoice ============

export function useInvoice(invoiceId?: bigint) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.invoiceDiamond as Address,
    abi: invoiceDiamondAbi,
    functionName: 'getInvoice',
    args: invoiceId !== undefined ? [invoiceId] : undefined,
    query: {
      enabled: !!addresses.invoiceDiamond && invoiceId !== undefined,
      refetchInterval: 30000,
    },
  });
}

// ============ Read Funding Amount ============

export function useFundingAmount(invoiceId?: bigint) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.invoiceDiamond as Address,
    abi: invoiceDiamondAbi,
    functionName: 'getFundingAmount',
    args: invoiceId !== undefined ? [invoiceId] : undefined,
    query: {
      enabled: !!addresses.invoiceDiamond && invoiceId !== undefined,
      refetchInterval: 30000,
    },
  });
}

// ============ Read Repayment Amount ============

export function useRepaymentAmount(invoiceId?: bigint) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.invoiceDiamond as Address,
    abi: invoiceDiamondAbi,
    functionName: 'getRepaymentAmount',
    args: invoiceId !== undefined ? [invoiceId] : undefined,
    query: {
      enabled: !!addresses.invoiceDiamond && invoiceId !== undefined,
      refetchInterval: 30000,
    },
  });
}

// ============ Check Overdue ============

export function useIsOverdue(invoiceId?: bigint) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.invoiceDiamond as Address,
    abi: invoiceDiamondAbi,
    functionName: 'isOverdue',
    args: invoiceId !== undefined ? [invoiceId] : undefined,
    query: {
      enabled: !!addresses.invoiceDiamond && invoiceId !== undefined,
      refetchInterval: 60000,
    },
  });
}

// ============ Check Can Fund ============

export function useCanFundInvoice(invoiceId?: bigint) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.invoiceDiamond as Address,
    abi: invoiceDiamondAbi,
    functionName: 'canFundInvoice',
    args: invoiceId !== undefined ? [invoiceId] : undefined,
    query: {
      enabled: !!addresses.invoiceDiamond && invoiceId !== undefined,
      refetchInterval: 30000,
    },
  });
}

// ============ Invoice Stats ============

export function useInvoiceStats() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.invoiceDiamond as Address,
    abi: invoiceDiamondAbi,
    functionName: 'getStats',
    query: {
      enabled: !!addresses.invoiceDiamond,
      refetchInterval: 30000,
    },
  });
}
