'use client';

import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { type Address } from 'viem';
import { useChainId } from 'wagmi';
import { liquidityPoolAbi } from '@/abis/LiquidityPool';
import { getContractAddresses } from '@/lib/contracts';

// ============ Read Hooks ============

/**
 * Hook to get the liquidity buffer setting
 */
export function useLiquidityBuffer() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    functionName: 'liquidityBuffer',
    query: {
      refetchInterval: 30000,
    },
  });
}

/**
 * Hook to get the max treasury allocation setting
 */
export function useMaxTreasuryAllocation() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    functionName: 'maxTreasuryAllocation',
    query: {
      refetchInterval: 30000,
    },
  });
}

// Note: useOptimalTreasuryDeposit is defined in useTreasuryAdmin.ts

// ============ Write Hooks ============

/**
 * Hook to pause the pool
 */
export function usePausePool() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const pause = () => {
    writeContract({
      address: addresses.liquidityPool,
      abi: liquidityPoolAbi,
      functionName: 'pause',
    });
  };

  return {
    pause,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

/**
 * Hook to unpause the pool
 */
export function useUnpausePool() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const unpause = () => {
    writeContract({
      address: addresses.liquidityPool,
      abi: liquidityPoolAbi,
      functionName: 'unpause',
    });
  };

  return {
    unpause,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

/**
 * Hook to set liquidity buffer
 */
export function useSetLiquidityBuffer() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const setBuffer = (buffer: bigint) => {
    writeContract({
      address: addresses.liquidityPool,
      abi: liquidityPoolAbi,
      functionName: 'setLiquidityBuffer',
      args: [buffer],
    });
  };

  return {
    setBuffer,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

/**
 * Hook to set max treasury allocation
 */
export function useSetMaxTreasuryAllocation() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const setAllocation = (allocationBps: bigint) => {
    writeContract({
      address: addresses.liquidityPool,
      abi: liquidityPoolAbi,
      functionName: 'setMaxTreasuryAllocation',
      args: [allocationBps],
    });
  };

  return {
    setAllocation,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

/**
 * Hook to emergency withdraw tokens
 */
export function useEmergencyWithdraw() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const emergencyWithdraw = (token: Address, amount: bigint, to: Address) => {
    writeContract({
      address: addresses.liquidityPool,
      abi: liquidityPoolAbi,
      functionName: 'emergencyWithdraw',
      args: [token, amount, to],
    });
  };

  return {
    emergencyWithdraw,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}
