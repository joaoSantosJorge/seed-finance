'use client';

import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { type Address } from 'viem';
import { useChainId } from 'wagmi';
import { executionPoolAbi } from '@/abis/ExecutionPool';
import { getContractAddresses } from '@/lib/contracts';

// ============ Types ============

export interface FundingRecord {
  supplier: Address;
  fundingAmount: bigint;
  faceValue: bigint;
  fundedAt: bigint;
  funded: boolean;
  repaid: boolean;
}

export interface ExecutionPoolStats {
  totalFunded: bigint;
  totalRepaid: bigint;
  activeInvoices: bigint;
}

// ============ Read Hooks ============

/**
 * Hook to get ExecutionPool stats
 */
export function useExecutionPoolStats() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.executionPool as Address,
    abi: executionPoolAbi,
    functionName: 'getStats',
    query: {
      enabled: !!addresses.executionPool,
      refetchInterval: 15000,
    },
  });
}

/**
 * Hook to get funding record for an invoice
 */
export function useFundingRecord(invoiceId?: bigint) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.executionPool as Address,
    abi: executionPoolAbi,
    functionName: 'getFundingRecord',
    args: invoiceId !== undefined ? [invoiceId] : undefined,
    query: {
      enabled: !!addresses.executionPool && invoiceId !== undefined,
      refetchInterval: 30000,
    },
  });
}

/**
 * Hook to check if an invoice is funded
 */
export function useIsInvoiceFunded(invoiceId?: bigint) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.executionPool as Address,
    abi: executionPoolAbi,
    functionName: 'isInvoiceFunded',
    args: invoiceId !== undefined ? [invoiceId] : undefined,
    query: {
      enabled: !!addresses.executionPool && invoiceId !== undefined,
      refetchInterval: 30000,
    },
  });
}

/**
 * Hook to check if an invoice is repaid
 */
export function useIsInvoiceRepaid(invoiceId?: bigint) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.executionPool as Address,
    abi: executionPoolAbi,
    functionName: 'isInvoiceRepaid',
    args: invoiceId !== undefined ? [invoiceId] : undefined,
    query: {
      enabled: !!addresses.executionPool && invoiceId !== undefined,
      refetchInterval: 30000,
    },
  });
}

/**
 * Hook to get available balance in ExecutionPool
 */
export function useExecutionPoolBalance() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.executionPool as Address,
    abi: executionPoolAbi,
    functionName: 'availableBalance',
    query: {
      enabled: !!addresses.executionPool,
      refetchInterval: 15000,
    },
  });
}

// ============ Write Hooks ============

/**
 * Hook to fund an invoice directly via ExecutionPool
 *
 * This is the key function for operators to fund invoices:
 * - invoiceId: The invoice to fund
 * - supplier: The supplier's address to receive funds
 * - fundingAmount: Amount after discount (in USDC, 6 decimals)
 * - faceValue: Full invoice amount for repayment tracking
 */
export function useFundInvoice() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const fundInvoice = (
    invoiceId: bigint,
    supplier: Address,
    fundingAmount: bigint,
    faceValue: bigint
  ) => {
    writeContract({
      address: addresses.executionPool as Address,
      abi: executionPoolAbi,
      functionName: 'fundInvoice',
      args: [invoiceId, supplier, fundingAmount, faceValue],
    });
  };

  return {
    fundInvoice,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

/**
 * Hook to receive repayment for an invoice
 */
export function useReceiveRepayment() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const receiveRepayment = (invoiceId: bigint, buyer: Address) => {
    writeContract({
      address: addresses.executionPool as Address,
      abi: executionPoolAbi,
      functionName: 'receiveRepayment',
      args: [invoiceId, buyer],
    });
  };

  return {
    receiveRepayment,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}
