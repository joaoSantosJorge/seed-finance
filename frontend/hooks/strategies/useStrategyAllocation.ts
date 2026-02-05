'use client';

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { type Address, parseUnits } from 'viem';

// ============ ABI ============

const treasuryManagerAbi = [
  {
    name: 'allocateToStrategy',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'strategy', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'withdrawFromStrategy',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'strategy', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'received', type: 'uint256' }],
  },
  {
    name: 'rebalanceStrategies',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const;

const strategyAbi = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [{ name: 'received', type: 'uint256' }],
  },
  {
    name: 'withdrawAll',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ name: 'received', type: 'uint256' }],
  },
] as const;

// ============ Hooks ============

/**
 * Hook to allocate funds to a cross-chain strategy
 */
export function useAllocateToStrategy() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const allocate = (strategyAddress: Address, amount: string | bigint) => {
    const amountBigInt = typeof amount === 'string' ? parseUnits(amount, 6) : amount;

    writeContract({
      address: strategyAddress,
      abi: strategyAbi,
      functionName: 'deposit',
      args: [amountBigInt],
    });
  };

  return {
    allocate,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

/**
 * Hook to withdraw funds from a cross-chain strategy
 */
export function useWithdrawFromStrategy() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const withdraw = (strategyAddress: Address, amount: string | bigint) => {
    const amountBigInt = typeof amount === 'string' ? parseUnits(amount, 6) : amount;

    writeContract({
      address: strategyAddress,
      abi: strategyAbi,
      functionName: 'withdraw',
      args: [amountBigInt],
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
 * Hook to withdraw all funds from a strategy
 */
export function useWithdrawAllFromStrategy() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const withdrawAll = (strategyAddress: Address) => {
    writeContract({
      address: strategyAddress,
      abi: strategyAbi,
      functionName: 'withdrawAll',
    });
  };

  return {
    withdrawAll,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

/**
 * Hook for keeper to confirm a deposit
 */
export function useConfirmDeposit() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const confirmDeposit = (
    strategyAddress: Address,
    transferId: `0x${string}`,
    sharesReceived: bigint
  ) => {
    writeContract({
      address: strategyAddress,
      abi: [
        {
          name: 'confirmDeposit',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'transferId', type: 'bytes32' },
            { name: 'sharesReceived', type: 'uint256' },
          ],
          outputs: [],
        },
      ] as const,
      functionName: 'confirmDeposit',
      args: [transferId, sharesReceived],
    });
  };

  return {
    confirmDeposit,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

/**
 * Hook for keeper to update remote value
 */
export function useUpdateRemoteValue() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const updateValue = (
    strategyAddress: Address,
    value: bigint,
    proof: `0x${string}` = '0x'
  ) => {
    writeContract({
      address: strategyAddress,
      abi: [
        {
          name: 'updateRemoteValue',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'value', type: 'uint256' },
            { name: 'proof', type: 'bytes' },
          ],
          outputs: [],
        },
      ] as const,
      functionName: 'updateRemoteValue',
      args: [value, proof],
    });
  };

  return {
    updateValue,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

/**
 * Hook for keeper to receive bridged withdrawal funds
 */
export function useReceiveBridgedFunds() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const receiveFunds = (strategyAddress: Address, transferId: `0x${string}`) => {
    writeContract({
      address: strategyAddress,
      abi: [
        {
          name: 'receiveBridgedFunds',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [{ name: 'transferId', type: 'bytes32' }],
          outputs: [],
        },
      ] as const,
      functionName: 'receiveBridgedFunds',
      args: [transferId],
    });
  };

  return {
    receiveFunds,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

/**
 * Hook for CCTP funds reception
 */
export function useReceiveCCTPFunds() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const receiveFunds = (
    strategyAddress: Address,
    transferId: `0x${string}`,
    messageNonce: bigint
  ) => {
    writeContract({
      address: strategyAddress,
      abi: [
        {
          name: 'receiveCCTPFunds',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'transferId', type: 'bytes32' },
            { name: 'messageNonce', type: 'uint64' },
          ],
          outputs: [],
        },
      ] as const,
      functionName: 'receiveCCTPFunds',
      args: [transferId, messageNonce],
    });
  };

  return {
    receiveFunds,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}
