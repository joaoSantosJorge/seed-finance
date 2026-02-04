'use client';

import { useState, useCallback, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { type Address } from 'viem';
import { useChainId } from 'wagmi';
import { executionPoolAbi } from '@/abis/ExecutionPool';
import { invoiceDiamondAbi } from '@/abis/InvoiceDiamond';
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

// ============ Complete Funding Flow (Diamond + ExecutionPool) ============

type FundingStep = 'idle' | 'diamond' | 'execution' | 'complete';

/**
 * Hook for complete invoice funding that updates both Diamond and ExecutionPool
 *
 * This ensures both contracts stay in sync:
 * Step 1: Call Diamond.requestFunding(invoiceId) - updates Diamond state
 * Step 2: Call ExecutionPool.fundInvoice(...) - transfers USDC to supplier
 */
export function useCompleteFunding() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  const [step, setStep] = useState<FundingStep>('idle');
  const [pendingParams, setPendingParams] = useState<{
    invoiceId: bigint;
    supplier: Address;
    fundingAmount: bigint;
    faceValue: bigint;
  } | null>(null);
  const [overallError, setOverallError] = useState<Error | null>(null);

  // Step 1: Diamond requestFunding
  const {
    writeContract: writeDiamond,
    data: diamondHash,
    isPending: isDiamondPending,
    error: diamondError,
    reset: resetDiamond,
  } = useWriteContract();

  const { isLoading: isDiamondConfirming, isSuccess: isDiamondSuccess } = useWaitForTransactionReceipt({
    hash: diamondHash,
  });

  // Step 2: ExecutionPool fundInvoice
  const {
    writeContract: writeExecution,
    data: executionHash,
    isPending: isExecutionPending,
    error: executionError,
    reset: resetExecution,
  } = useWriteContract();

  const { isLoading: isExecutionConfirming, isSuccess: isExecutionSuccess } = useWaitForTransactionReceipt({
    hash: executionHash,
  });

  // Start the funding process
  const completeFunding = useCallback((
    invoiceId: bigint,
    supplier: Address,
    fundingAmount: bigint,
    faceValue: bigint
  ) => {
    setOverallError(null);
    setPendingParams({ invoiceId, supplier, fundingAmount, faceValue });
    setStep('diamond');

    // Step 1: Update Diamond state
    writeDiamond({
      address: addresses.invoiceDiamond as Address,
      abi: invoiceDiamondAbi,
      functionName: 'requestFunding',
      args: [invoiceId],
    });
  }, [addresses.invoiceDiamond, writeDiamond]);

  // When Diamond succeeds, proceed to ExecutionPool
  useEffect(() => {
    if (isDiamondSuccess && step === 'diamond' && pendingParams) {
      setStep('execution');
      writeExecution({
        address: addresses.executionPool as Address,
        abi: executionPoolAbi,
        functionName: 'fundInvoice',
        args: [
          pendingParams.invoiceId,
          pendingParams.supplier,
          pendingParams.fundingAmount,
          pendingParams.faceValue
        ],
      });
    }
  }, [isDiamondSuccess, step, pendingParams, addresses.executionPool, writeExecution]);

  // When ExecutionPool succeeds, mark complete
  useEffect(() => {
    if (isExecutionSuccess && step === 'execution') {
      setStep('complete');
    }
  }, [isExecutionSuccess, step]);

  // Handle errors
  useEffect(() => {
    if (diamondError && step === 'diamond') {
      setOverallError(diamondError);
      setStep('idle');
    }
    if (executionError && step === 'execution') {
      setOverallError(executionError);
      setStep('idle');
    }
  }, [diamondError, executionError, step]);

  const reset = useCallback(() => {
    setStep('idle');
    setPendingParams(null);
    setOverallError(null);
    resetDiamond();
    resetExecution();
  }, [resetDiamond, resetExecution]);

  const isPending = isDiamondPending || isExecutionPending;
  const isConfirming = isDiamondConfirming || isExecutionConfirming;
  const isSuccess = step === 'complete';

  return {
    completeFunding,
    step,
    diamondHash,
    executionHash,
    isPending,
    isConfirming,
    isSuccess,
    error: overallError,
    reset,
  };
}
