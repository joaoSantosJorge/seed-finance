'use client';

import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import {
  useUserShares,
  useTotalAssets,
  useTotalSupply,
  useTotalDeployed,
  useTotalInTreasury,
  useAvailableLiquidity,
} from './contracts/useLiquidityPool';
import { useUSDCBalance } from './contracts/useUSDC';
import { USDC_DECIMALS } from '@/lib/contracts';
import {
  calculateAssetsForShares,
  calculatePoolOwnership,
  calculateProportionalAllocation,
} from '@/lib/calculations';
import { formatCurrency, formatShares, formatPercent } from '@/lib/formatters';
import type { UserPosition, FormattedUserPosition } from '@/types';

export function useUserPosition() {
  const { address, isConnected } = useAccount();

  const { data: sharesOwned, isLoading: loadingShares } = useUserShares(address);
  const { data: usdcBalance, isLoading: loadingBalance } = useUSDCBalance(address);
  const { data: totalAssets, isLoading: loadingAssets } = useTotalAssets();
  const { data: totalSupply, isLoading: loadingSupply } = useTotalSupply();
  const { data: totalDeployed } = useTotalDeployed();
  const { data: totalInTreasury } = useTotalInTreasury();
  const { data: availableLiquidity } = useAvailableLiquidity();

  const isLoading = loadingShares || loadingBalance || loadingAssets || loadingSupply;

  const position: UserPosition | null = useMemo(() => {
    if (!address || !isConnected) return null;
    if (
      sharesOwned === undefined ||
      totalAssets === undefined ||
      totalSupply === undefined
    ) {
      return null;
    }

    const currentValue = calculateAssetsForShares(sharesOwned, totalAssets, totalSupply);
    const poolOwnership = calculatePoolOwnership(sharesOwned, totalSupply);

    // Calculate proportional allocation
    const allocation = calculateProportionalAllocation(
      sharesOwned,
      totalSupply,
      totalDeployed ?? 0n,
      totalInTreasury ?? 0n,
      availableLiquidity ?? 0n
    );

    // For MVP, we don't track cost basis on-chain
    // This would need an indexer or database in production
    const netDeposits = currentValue; // Placeholder
    const unrealizedGain = 0n;
    const unrealizedGainPercent = 0;

    return {
      address,
      sharesOwned,
      currentValue,
      totalDeposited: netDeposits,
      totalWithdrawn: 0n,
      netDeposits,
      unrealizedGain,
      unrealizedGainPercent,
      poolOwnership,
      proportionalDeployed: allocation.deployed,
      proportionalTreasury: allocation.treasury,
      proportionalLiquid: allocation.liquid,
    };
  }, [
    address,
    isConnected,
    sharesOwned,
    totalAssets,
    totalSupply,
    totalDeployed,
    totalInTreasury,
    availableLiquidity,
  ]);

  const formattedPosition: FormattedUserPosition | null = useMemo(() => {
    if (!position) return null;

    return {
      sharesOwned: formatShares(position.sharesOwned),
      currentValue: formatCurrency(
        parseFloat(formatUnits(position.currentValue, USDC_DECIMALS))
      ),
      totalDeposited: formatCurrency(
        parseFloat(formatUnits(position.totalDeposited, USDC_DECIMALS))
      ),
      totalWithdrawn: formatCurrency(
        parseFloat(formatUnits(position.totalWithdrawn, USDC_DECIMALS))
      ),
      netDeposits: formatCurrency(
        parseFloat(formatUnits(position.netDeposits, USDC_DECIMALS))
      ),
      unrealizedGain: formatCurrency(
        parseFloat(formatUnits(position.unrealizedGain, USDC_DECIMALS))
      ),
      unrealizedGainPercent: formatPercent(position.unrealizedGainPercent),
      poolOwnership: formatPercent(position.poolOwnership),
      proportionalDeployed: formatCurrency(
        parseFloat(formatUnits(position.proportionalDeployed, USDC_DECIMALS))
      ),
      proportionalTreasury: formatCurrency(
        parseFloat(formatUnits(position.proportionalTreasury, USDC_DECIMALS))
      ),
      proportionalLiquid: formatCurrency(
        parseFloat(formatUnits(position.proportionalLiquid, USDC_DECIMALS))
      ),
    };
  }, [position]);

  const formattedUsdcBalance = useMemo(() => {
    if (usdcBalance === undefined) return null;
    return formatCurrency(parseFloat(formatUnits(usdcBalance, USDC_DECIMALS)));
  }, [usdcBalance]);

  return {
    position,
    formattedPosition,
    usdcBalance,
    formattedUsdcBalance,
    isLoading,
    isConnected,
    address,
  };
}
