'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { type Address, parseUnits } from 'viem';
import { useChainId } from 'wagmi';
import { liquidityPoolAbi } from '@/abis/LiquidityPool';
import { getContractAddresses, USDC_DECIMALS, SFUSDC_DECIMALS } from '@/lib/contracts';

// ============ Pool State Reads ============

export function useTotalAssets() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    functionName: 'totalAssets',
    query: {
      refetchInterval: 30000,
    },
  });
}

export function useTotalSupply() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    functionName: 'totalSupply',
    query: {
      refetchInterval: 30000,
    },
  });
}

export function useSharePrice() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  // Get the asset value of 1e18 shares (1 sfUSDC)
  return useReadContract({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    functionName: 'convertToAssets',
    args: [parseUnits('1', SFUSDC_DECIMALS)],
    query: {
      refetchInterval: 30000,
    },
  });
}

export function useAvailableLiquidity() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    functionName: 'availableLiquidity',
    query: {
      refetchInterval: 30000,
    },
  });
}

export function useTotalDeployed() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    functionName: 'totalDeployed',
    query: {
      refetchInterval: 30000,
    },
  });
}

export function useTotalInTreasury() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    functionName: 'totalInTreasury',
    query: {
      refetchInterval: 30000,
    },
  });
}

export function useUtilizationRate() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    functionName: 'utilizationRate',
    query: {
      refetchInterval: 30000,
    },
  });
}

export function useTreasuryAllocationRate() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    functionName: 'treasuryAllocationRate',
    query: {
      refetchInterval: 30000,
    },
  });
}

export function useTotalInvoiceYield() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    functionName: 'totalInvoiceYield',
    query: {
      refetchInterval: 30000,
    },
  });
}

export function useTotalTreasuryYield() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    functionName: 'totalTreasuryYield',
    query: {
      refetchInterval: 30000,
    },
  });
}

export function usePoolPaused() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    functionName: 'paused',
    query: {
      refetchInterval: 60000,
    },
  });
}

// ============ User-Specific Reads ============

export function useUserShares(address?: Address) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 15000,
    },
  });
}

export function useMaxWithdraw(address?: Address) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    functionName: 'maxWithdraw',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 15000,
    },
  });
}

export function useMaxRedeem(address?: Address) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    functionName: 'maxRedeem',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 15000,
    },
  });
}

// ============ Preview Functions ============

export function usePreviewDeposit(assets?: bigint) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    functionName: 'previewDeposit',
    args: assets !== undefined ? [assets] : undefined,
    query: {
      enabled: assets !== undefined && assets > 0n,
    },
  });
}

export function usePreviewWithdraw(assets?: bigint) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    functionName: 'previewWithdraw',
    args: assets !== undefined ? [assets] : undefined,
    query: {
      enabled: assets !== undefined && assets > 0n,
    },
  });
}

export function usePreviewRedeem(shares?: bigint) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    functionName: 'previewRedeem',
    args: shares !== undefined ? [shares] : undefined,
    query: {
      enabled: shares !== undefined && shares > 0n,
    },
  });
}

// ============ Write Functions ============

export function useDeposit() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const deposit = (assets: bigint, receiver: Address) => {
    writeContract({
      address: addresses.liquidityPool,
      abi: liquidityPoolAbi,
      functionName: 'deposit',
      args: [assets, receiver],
    });
  };

  return {
    deposit,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useWithdraw() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const withdraw = (assets: bigint, receiver: Address, owner: Address) => {
    writeContract({
      address: addresses.liquidityPool,
      abi: liquidityPoolAbi,
      functionName: 'withdraw',
      args: [assets, receiver, owner],
    });
  };

  return {
    withdraw,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useRedeem() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const redeem = (shares: bigint, receiver: Address, owner: Address) => {
    writeContract({
      address: addresses.liquidityPool,
      abi: liquidityPoolAbi,
      functionName: 'redeem',
      args: [shares, receiver, owner],
    });
  };

  return {
    redeem,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}
