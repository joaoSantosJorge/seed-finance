'use client';

import { useReadContract } from 'wagmi';
import { type Address } from 'viem';
import { useChainId, useAccount } from 'wagmi';
import { invoiceDiamondAbi } from '@/abis/InvoiceDiamond';
import { getContractAddresses } from '@/lib/contracts';

/**
 * Hook to check if the connected wallet is an operator
 */
export function useIsOperator(address?: Address) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.invoiceDiamond as Address,
    abi: invoiceDiamondAbi,
    functionName: 'isOperator',
    args: address ? [address] : undefined,
    query: {
      enabled: !!addresses.invoiceDiamond && !!address,
      refetchInterval: 60000,
    },
  });
}

/**
 * Hook to get the owner of the InvoiceDiamond
 */
export function useOwner() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.invoiceDiamond as Address,
    abi: invoiceDiamondAbi,
    functionName: 'owner',
    query: {
      enabled: !!addresses.invoiceDiamond,
      refetchInterval: 60000,
    },
  });
}

/**
 * Combined hook to check operator and owner status for current user
 */
export function useOperatorRole() {
  const { address, isConnected } = useAccount();
  const { data: isOperator, isLoading: operatorLoading } = useIsOperator(address);
  const { data: owner, isLoading: ownerLoading } = useOwner();

  const isOwner = isConnected && address && owner
    ? address.toLowerCase() === owner.toLowerCase()
    : false;

  return {
    isOperator: isOperator ?? false,
    isOwner,
    isLoading: operatorLoading || ownerLoading,
    isConnected,
    address,
    owner,
  };
}
