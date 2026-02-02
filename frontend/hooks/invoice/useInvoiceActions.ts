'use client';

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { type Address, stringToHex, pad } from 'viem';
import { useChainId } from 'wagmi';
import { invoiceDiamondAbi } from '@/abis/InvoiceDiamond';
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
