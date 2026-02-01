'use client';

import { useWatchContractEvent } from 'wagmi';
import { useChainId } from 'wagmi';
import { liquidityPoolAbi } from '@/abis/LiquidityPool';
import { getContractAddresses } from '@/lib/contracts';
import type { Log } from 'viem';

interface DepositLog {
  sender: `0x${string}`;
  owner: `0x${string}`;
  assets: bigint;
  shares: bigint;
}

interface WithdrawLog {
  sender: `0x${string}`;
  receiver: `0x${string}`;
  owner: `0x${string}`;
  assets: bigint;
  shares: bigint;
}

interface LiquidityReturnedLog {
  invoiceId: bigint;
  principal: bigint;
  yield: bigint;
}

interface TreasuryYieldAccruedLog {
  amount: bigint;
}

export function useWatchDeposits(
  onDeposit: (event: DepositLog, log: Log) => void
) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useWatchContractEvent({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    eventName: 'Deposit',
    onLogs: (logs) => {
      logs.forEach((log) => {
        const args = log.args as unknown as DepositLog;
        if (args) {
          onDeposit(args, log);
        }
      });
    },
  });
}

export function useWatchWithdrawals(
  onWithdraw: (event: WithdrawLog, log: Log) => void
) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useWatchContractEvent({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    eventName: 'Withdraw',
    onLogs: (logs) => {
      logs.forEach((log) => {
        const args = log.args as unknown as WithdrawLog;
        if (args) {
          onWithdraw(args, log);
        }
      });
    },
  });
}

export function useWatchLiquidityReturned(
  onReturn: (event: LiquidityReturnedLog, log: Log) => void
) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useWatchContractEvent({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    eventName: 'LiquidityReturned',
    onLogs: (logs) => {
      logs.forEach((log) => {
        const args = log.args as unknown as LiquidityReturnedLog;
        if (args) {
          onReturn(args, log);
        }
      });
    },
  });
}

export function useWatchTreasuryYield(
  onYield: (event: TreasuryYieldAccruedLog, log: Log) => void
) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useWatchContractEvent({
    address: addresses.liquidityPool,
    abi: liquidityPoolAbi,
    eventName: 'TreasuryYieldAccrued',
    onLogs: (logs) => {
      logs.forEach((log) => {
        const args = log.args as unknown as TreasuryYieldAccruedLog;
        if (args) {
          onYield(args, log);
        }
      });
    },
  });
}
