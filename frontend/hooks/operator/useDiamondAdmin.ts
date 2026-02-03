'use client';

import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { type Address } from 'viem';
import { useChainId } from 'wagmi';
import { invoiceDiamondAbi } from '@/abis/InvoiceDiamond';
import { getContractAddresses } from '@/lib/contracts';

// Note: useOwner and useIsOperator are defined in useOperatorRole.ts
// Import from there to avoid duplication

/**
 * Hook to get contract addresses from InvoiceDiamond
 */
export function useContractAddresses() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.invoiceDiamond as Address,
    abi: invoiceDiamondAbi,
    functionName: 'getContractAddresses',
    query: {
      enabled: !!addresses.invoiceDiamond,
      refetchInterval: 60000,
    },
  });
}

// ============ Write Hooks ============

/**
 * Hook to set operator status
 */
export function useSetOperator() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const setOperator = (operator: Address, status: boolean) => {
    writeContract({
      address: addresses.invoiceDiamond as Address,
      abi: invoiceDiamondAbi,
      functionName: 'setOperator',
      args: [operator, status],
    });
  };

  return {
    setOperator,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

/**
 * Hook to transfer ownership
 */
export function useTransferOwnership() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const transferOwnership = (newOwner: Address) => {
    writeContract({
      address: addresses.invoiceDiamond as Address,
      abi: invoiceDiamondAbi,
      functionName: 'transferOwnership',
      args: [newOwner],
    });
  };

  return {
    transferOwnership,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

/**
 * Hook to set execution pool address
 */
export function useSetExecutionPool() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const setExecutionPool = (executionPool: Address) => {
    writeContract({
      address: addresses.invoiceDiamond as Address,
      abi: invoiceDiamondAbi,
      functionName: 'setExecutionPool',
      args: [executionPool],
    });
  };

  return {
    setExecutionPool,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

/**
 * Hook to set liquidity pool address
 */
export function useSetLiquidityPool() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const setLiquidityPool = (liquidityPool: Address) => {
    writeContract({
      address: addresses.invoiceDiamond as Address,
      abi: invoiceDiamondAbi,
      functionName: 'setLiquidityPool',
      args: [liquidityPool],
    });
  };

  return {
    setLiquidityPool,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

/**
 * Hook to set USDC address
 */
export function useSetUSDC() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const setUSDC = (usdc: Address) => {
    writeContract({
      address: addresses.invoiceDiamond as Address,
      abi: invoiceDiamondAbi,
      functionName: 'setUSDC',
      args: [usdc],
    });
  };

  return {
    setUSDC,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}
