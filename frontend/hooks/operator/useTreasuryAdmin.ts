'use client';

import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { type Address } from 'viem';
import { useChainId } from 'wagmi';
import { liquidityPoolAbi } from '@/abis/LiquidityPool';
import { getContractAddresses } from '@/lib/contracts';

// ============ Read Hooks ============

/**
 * Hook to get the treasury manager address
 */
export function useTreasuryManager() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    functionName: 'treasuryManager',
    query: {
      refetchInterval: 60000,
    },
  });
}

/**
 * Hook to get total value in treasury
 */
export function useTreasuryValue() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    functionName: 'getTreasuryValue',
    query: {
      refetchInterval: 30000,
    },
  });
}

/**
 * Hook to get optimal treasury deposit amount
 */
export function useOptimalTreasuryDeposit() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    functionName: 'getOptimalTreasuryDeposit',
    query: {
      refetchInterval: 30000,
    },
  });
}

// ============ Write Hooks ============

/**
 * Hook to deposit to treasury
 */
export function useDepositToTreasury() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const deposit = (amount: bigint) => {
    writeContract({
      address: addresses.liquidityPool,
      abi: liquidityPoolAbi,
      functionName: 'depositToTreasury',
      args: [amount],
    });
  };

  return {
    deposit,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

/**
 * Hook to withdraw from treasury
 */
export function useWithdrawFromTreasury() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const withdraw = (amount: bigint) => {
    writeContract({
      address: addresses.liquidityPool,
      abi: liquidityPoolAbi,
      functionName: 'withdrawFromTreasury',
      args: [amount],
    });
  };

  return {
    withdraw,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

/**
 * Hook to rebalance to treasury (uses optimal amount)
 */
export function useRebalanceToTreasury() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const rebalance = () => {
    writeContract({
      address: addresses.liquidityPool,
      abi: liquidityPoolAbi,
      functionName: 'rebalanceToTreasury',
    });
  };

  return {
    rebalance,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

/**
 * Hook to accrue treasury yield
 */
export function useAccrueTreasuryYield() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const accrue = () => {
    writeContract({
      address: addresses.liquidityPool,
      abi: liquidityPoolAbi,
      functionName: 'accrueTreasuryYield',
    });
  };

  return {
    accrue,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}
