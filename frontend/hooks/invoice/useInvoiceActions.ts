'use client';

import { useState, useCallback, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { type Address, stringToHex, pad } from 'viem';
import { useChainId } from 'wagmi';
import { invoiceDiamondAbi } from '@/abis/InvoiceDiamond';
import { executionPoolAbi } from '@/abis/ExecutionPool';
import { getContractAddresses } from '@/lib/contracts';

// ============ Helper Functions ============

/**
 * Convert string to bytes32 (right-padded with zeros)
 */
function stringToBytes32(str: string): `0x${string}` {
  if (!str) return `0x${'0'.repeat(64)}` as `0x${string}`;
  const hex = stringToHex(str, { size: 32 });
  return hex;
}

// ============ Create Invoice ============

export interface CreateInvoiceParams {
  buyer: Address;
  faceValue: bigint;
  discountRateBps: number;
  maturityDate: Date;
  invoiceHash?: string;
  externalId?: string;
}

export function useCreateInvoice() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
  });

  const createInvoice = (params: CreateInvoiceParams) => {
    const maturityTimestamp = BigInt(Math.floor(params.maturityDate.getTime() / 1000));
    const invoiceHashBytes = stringToBytes32(params.invoiceHash ?? '');
    const externalIdBytes = stringToBytes32(params.externalId ?? '');

    writeContract({
      address: addresses.invoiceDiamond as Address,
      abi: invoiceDiamondAbi,
      functionName: 'createInvoice',
      args: [
        params.buyer,
        params.faceValue,
        params.discountRateBps,
        maturityTimestamp,
        invoiceHashBytes,
        externalIdBytes,
      ],
    });
  };

  return {
    createInvoice,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    receipt,
    error,
    reset,
  };
}

// ============ Approve Invoice ============

export function useApproveInvoice() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
  });

  const approveInvoice = (invoiceId: bigint) => {
    writeContract({
      address: addresses.invoiceDiamond as Address,
      abi: invoiceDiamondAbi,
      functionName: 'approveInvoice',
      args: [invoiceId],
    });
  };

  return {
    approveInvoice,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    receipt,
    error,
    reset,
  };
}

// ============ Cancel Invoice ============

export function useCancelInvoice() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
  });

  const cancelInvoice = (invoiceId: bigint) => {
    writeContract({
      address: addresses.invoiceDiamond as Address,
      abi: invoiceDiamondAbi,
      functionName: 'cancelInvoice',
      args: [invoiceId],
    });
  };

  return {
    cancelInvoice,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    receipt,
    error,
    reset,
  };
}

// ============ Process Repayment ============

export function useProcessRepayment() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
  });

  const processRepayment = (invoiceId: bigint) => {
    writeContract({
      address: addresses.invoiceDiamond as Address,
      abi: invoiceDiamondAbi,
      functionName: 'processRepayment',
      args: [invoiceId],
    });
  };

  return {
    processRepayment,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    receipt,
    error,
    reset,
  };
}

// ============ Approve Funding (Operator) ============

export function useApproveFunding() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
  });

  const approveFunding = (invoiceId: bigint) => {
    writeContract({
      address: addresses.invoiceDiamond as Address,
      abi: invoiceDiamondAbi,
      functionName: 'approveFunding',
      args: [invoiceId],
    });
  };

  return {
    approveFunding,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    receipt,
    error,
    reset,
  };
}

// ============ Batch Approve Funding (Operator) ============

export function useBatchApproveFunding() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
  });

  const batchApproveFunding = (invoiceIds: bigint[]) => {
    writeContract({
      address: addresses.invoiceDiamond as Address,
      abi: invoiceDiamondAbi,
      functionName: 'batchApproveFunding',
      args: [invoiceIds],
    });
  };

  return {
    batchApproveFunding,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    receipt,
    error,
    reset,
  };
}

// ============ Request Funding (Operator) ============

export function useRequestFunding() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
  });

  const requestFunding = (invoiceId: bigint) => {
    writeContract({
      address: addresses.invoiceDiamond as Address,
      abi: invoiceDiamondAbi,
      functionName: 'requestFunding',
      args: [invoiceId],
    });
  };

  return {
    requestFunding,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    receipt,
    error,
    reset,
  };
}

// ============ Batch Fund (Operator) ============

export function useBatchFund() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
  });

  const batchFund = (invoiceIds: bigint[]) => {
    writeContract({
      address: addresses.invoiceDiamond as Address,
      abi: invoiceDiamondAbi,
      functionName: 'batchFund',
      args: [invoiceIds],
    });
  };

  return {
    batchFund,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    receipt,
    error,
    reset,
  };
}

// ============ Mark Defaulted (Operator) ============

export function useMarkDefaulted() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
  });

  const markDefaulted = (invoiceId: bigint) => {
    writeContract({
      address: addresses.invoiceDiamond as Address,
      abi: invoiceDiamondAbi,
      functionName: 'markDefaulted',
      args: [invoiceId],
    });
  };

  return {
    markDefaulted,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    receipt,
    error,
    reset,
  };
}

// ============ Supplier Request Funding ============

type SupplierFundingStep = 'idle' | 'diamond' | 'execution' | 'complete';

/**
 * Hook for suppliers to request funding for their approved invoices
 *
 * This ensures both contracts stay in sync:
 * Step 1: Call Diamond.supplierRequestFunding(invoiceId) - updates Diamond state
 * Step 2: Call ExecutionPool.fundInvoice(...) - transfers USDC to supplier
 */
export function useSupplierRequestFunding() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  const [step, setStep] = useState<SupplierFundingStep>('idle');
  const [pendingParams, setPendingParams] = useState<{
    invoiceId: bigint;
    supplier: Address;
    fundingAmount: bigint;
    faceValue: bigint;
  } | null>(null);
  const [overallError, setOverallError] = useState<Error | null>(null);

  // Step 1: Diamond supplierRequestFunding
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
  const requestFunding = useCallback((
    invoiceId: bigint,
    supplier: Address,
    fundingAmount: bigint,
    faceValue: bigint
  ) => {
    setOverallError(null);
    setPendingParams({ invoiceId, supplier, fundingAmount, faceValue });
    setStep('diamond');

    // Step 1: Update Diamond state via supplier-specific function
    writeDiamond({
      address: addresses.invoiceDiamond as Address,
      abi: invoiceDiamondAbi,
      functionName: 'supplierRequestFunding',
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
    requestFunding,
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
