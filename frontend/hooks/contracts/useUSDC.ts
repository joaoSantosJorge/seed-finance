'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { type Address } from 'viem';
import { useChainId } from 'wagmi';
import { erc20Abi } from '@/abis/ERC20';
import { getContractAddresses } from '@/lib/contracts';

// ============ Read Functions ============

export function useUSDCBalance(address?: Address) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.usdc,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 15000,
    },
  });
}

export function useUSDCAllowance(owner?: Address, spender?: Address) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.usdc,
    abi: erc20Abi,
    functionName: 'allowance',
    args: owner && spender ? [owner, spender] : undefined,
    query: {
      enabled: !!owner && !!spender,
      refetchInterval: 15000,
    },
  });
}

export function useUSDCAllowanceForPool(owner?: Address) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.usdc,
    abi: erc20Abi,
    functionName: 'allowance',
    args: owner ? [owner, addresses.liquidityPool] : undefined,
    query: {
      enabled: !!owner,
      refetchInterval: 15000,
    },
  });
}

export function useUSDCAllowanceForInvoiceDiamond(owner?: Address) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.usdc,
    abi: erc20Abi,
    functionName: 'allowance',
    args: owner ? [owner, addresses.invoiceDiamond] : undefined,
    query: {
      enabled: !!owner && !!addresses.invoiceDiamond,
      refetchInterval: 15000,
    },
  });
}

// ============ Write Functions ============

export function useApproveUSDC() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const approve = (spender: Address, amount: bigint) => {
    writeContract({
      address: addresses.usdc,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, amount],
    });
  };

  const approvePool = (amount: bigint) => {
    approve(addresses.liquidityPool, amount);
  };

  const approveInvoiceDiamond = (amount: bigint) => {
    approve(addresses.invoiceDiamond, amount);
  };

  return {
    approve,
    approvePool,
    approveInvoiceDiamond,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}
