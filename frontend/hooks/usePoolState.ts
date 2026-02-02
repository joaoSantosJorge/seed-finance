'use client';

import { useMemo } from 'react';
import { formatUnits } from 'viem';
import {
  useTotalAssets,
  useTotalSupply,
  useSharePrice,
  useAvailableLiquidity,
  useTotalDeployed,
  useTotalInTreasury,
  useUtilizationRate,
  useTreasuryAllocationRate,
  useTotalInvoiceYield,
  useTotalTreasuryYield,
  usePoolPaused,
} from './contracts/useLiquidityPool';
import { USDC_DECIMALS, SEED_DECIMALS } from '@/lib/contracts';
import { formatCurrency, formatBps, formatSharePrice } from '@/lib/formatters';
import type { PoolState, FormattedPoolState } from '@/types';

export function usePoolState() {
  const { data: totalAssets, isLoading: loadingAssets } = useTotalAssets();
  const { data: totalSupply, isLoading: loadingSupply } = useTotalSupply();
  const { data: sharePrice, isLoading: loadingPrice } = useSharePrice();
  const { data: availableLiquidity, isLoading: loadingLiquidity } = useAvailableLiquidity();
  const { data: totalDeployed, isLoading: loadingDeployed } = useTotalDeployed();
  const { data: totalInTreasury, isLoading: loadingTreasury } = useTotalInTreasury();
  const { data: utilizationRate, isLoading: loadingUtil } = useUtilizationRate();
  const { data: treasuryAllocationRate, isLoading: loadingAlloc } = useTreasuryAllocationRate();
  const { data: totalInvoiceYield, isLoading: loadingInvoiceYield } = useTotalInvoiceYield();
  const { data: totalTreasuryYield, isLoading: loadingTreasuryYield } = useTotalTreasuryYield();
  const { data: paused } = usePoolPaused();

  const isLoading =
    loadingAssets ||
    loadingSupply ||
    loadingPrice ||
    loadingLiquidity ||
    loadingDeployed ||
    loadingTreasury ||
    loadingUtil ||
    loadingAlloc ||
    loadingInvoiceYield ||
    loadingTreasuryYield;

  const poolState: PoolState | null = useMemo(() => {
    if (
      totalAssets === undefined ||
      totalSupply === undefined ||
      sharePrice === undefined ||
      availableLiquidity === undefined ||
      totalDeployed === undefined ||
      totalInTreasury === undefined ||
      utilizationRate === undefined ||
      treasuryAllocationRate === undefined ||
      totalInvoiceYield === undefined ||
      totalTreasuryYield === undefined
    ) {
      return null;
    }

    return {
      totalAssets,
      totalSupply,
      sharePrice,
      availableLiquidity,
      totalDeployed,
      totalInTreasury,
      utilizationRate: Number(utilizationRate),
      treasuryAllocationRate: Number(treasuryAllocationRate),
      totalInvoiceYield,
      totalTreasuryYield,
      activeInvoices: 0, // Would come from InvoiceRegistry
      liquidityBuffer: 0n,
      maxTreasuryAllocation: 8000,
      lastUpdated: Date.now(),
    };
  }, [
    totalAssets,
    totalSupply,
    sharePrice,
    availableLiquidity,
    totalDeployed,
    totalInTreasury,
    utilizationRate,
    treasuryAllocationRate,
    totalInvoiceYield,
    totalTreasuryYield,
  ]);

  const formattedState: FormattedPoolState | null = useMemo(() => {
    if (!poolState) return null;

    return {
      totalAssets: formatCurrency(
        parseFloat(formatUnits(poolState.totalAssets, USDC_DECIMALS)),
        true
      ),
      totalSupply: parseFloat(formatUnits(poolState.totalSupply, SEED_DECIMALS)).toLocaleString(
        'en-US',
        { maximumFractionDigits: 2 }
      ),
      sharePrice: formatSharePrice(poolState.sharePrice),
      availableLiquidity: formatCurrency(
        parseFloat(formatUnits(poolState.availableLiquidity, USDC_DECIMALS)),
        true
      ),
      totalDeployed: formatCurrency(
        parseFloat(formatUnits(poolState.totalDeployed, USDC_DECIMALS)),
        true
      ),
      totalInTreasury: formatCurrency(
        parseFloat(formatUnits(poolState.totalInTreasury, USDC_DECIMALS)),
        true
      ),
      utilizationRate: formatBps(poolState.utilizationRate),
      treasuryAllocationRate: formatBps(poolState.treasuryAllocationRate),
      totalInvoiceYield: formatCurrency(
        parseFloat(formatUnits(poolState.totalInvoiceYield, USDC_DECIMALS))
      ),
      totalTreasuryYield: formatCurrency(
        parseFloat(formatUnits(poolState.totalTreasuryYield, USDC_DECIMALS))
      ),
      activeInvoices: poolState.activeInvoices,
    };
  }, [poolState]);

  return {
    poolState,
    formattedState,
    isLoading,
    isPaused: paused ?? false,
  };
}
