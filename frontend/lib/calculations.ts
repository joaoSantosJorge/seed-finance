import { formatUnits, parseUnits } from 'viem';
import { USDC_DECIMALS, SFUSDC_DECIMALS } from './contracts';

/**
 * Calculate shares received for a given deposit amount
 * Based on ERC-4626: shares = assets * totalSupply / totalAssets
 */
export function calculateSharesForDeposit(
  depositAmount: bigint,
  totalAssets: bigint,
  totalSupply: bigint
): bigint {
  if (totalAssets === 0n) {
    // First deposit: 1:1 ratio
    // Both USDC and sfUSDC have 6 decimals (ERC4626 inherits from underlying)
    return depositAmount * 10n ** BigInt(SFUSDC_DECIMALS - USDC_DECIMALS);
  }
  return (depositAmount * totalSupply) / totalAssets;
}

/**
 * Calculate assets received for redeeming shares
 * Based on ERC-4626: assets = shares * totalAssets / totalSupply
 */
export function calculateAssetsForShares(
  shares: bigint,
  totalAssets: bigint,
  totalSupply: bigint
): bigint {
  if (totalSupply === 0n) return 0n;
  return (shares * totalAssets) / totalSupply;
}

/**
 * Calculate shares needed to withdraw a specific asset amount
 */
export function calculateSharesForWithdraw(
  withdrawAmount: bigint,
  totalAssets: bigint,
  totalSupply: bigint
): bigint {
  if (totalAssets === 0n) return 0n;
  // Round up to ensure sufficient shares
  return ((withdrawAmount * totalSupply) + totalAssets - 1n) / totalAssets;
}

/**
 * Calculate current share price (assets per share)
 */
export function calculateSharePrice(
  totalAssets: bigint,
  totalSupply: bigint
): number {
  if (totalSupply === 0n) return 1.0;
  // Calculate value of 1 share (1e6 for 6 decimal sfUSDC)
  const oneShare = 10n ** BigInt(SFUSDC_DECIMALS);
  const priceInAssets = (oneShare * totalAssets) / totalSupply;
  return parseFloat(formatUnits(priceInAssets, USDC_DECIMALS));
}

/**
 * Calculate APY from yield over a period
 * @param yieldAmount Total yield in the period (USDC)
 * @param principal Principal amount (USDC)
 * @param periodDays Number of days in the period
 */
export function calculateAPY(
  yieldAmount: bigint,
  principal: bigint,
  periodDays: number
): number {
  if (principal === 0n || periodDays === 0) return 0;

  const yieldValue = parseFloat(formatUnits(yieldAmount, USDC_DECIMALS));
  const principalValue = parseFloat(formatUnits(principal, USDC_DECIMALS));

  // Annualize the return
  const periodReturn = yieldValue / principalValue;
  const annualizedReturn = periodReturn * (365 / periodDays);

  return annualizedReturn * 100; // Convert to percentage
}

/**
 * Calculate estimated monthly yield based on current APY
 */
export function calculateMonthlyYield(
  positionValue: bigint,
  apy: number
): bigint {
  const monthlyRate = apy / 100 / 12;
  const positionFloat = parseFloat(formatUnits(positionValue, USDC_DECIMALS));
  const monthlyYield = positionFloat * monthlyRate;
  return parseUnits(monthlyYield.toFixed(6), USDC_DECIMALS);
}

/**
 * Calculate unrealized gain from position
 */
export function calculateUnrealizedGain(
  currentValue: bigint,
  costBasis: bigint
): { gain: bigint; percent: number } {
  const gain = currentValue - costBasis;
  const costBasisFloat = parseFloat(formatUnits(costBasis, USDC_DECIMALS));
  const percent = costBasisFloat > 0
    ? (parseFloat(formatUnits(gain, USDC_DECIMALS)) / costBasisFloat) * 100
    : 0;
  return { gain, percent };
}

/**
 * Calculate pool ownership percentage
 */
export function calculatePoolOwnership(
  userShares: bigint,
  totalSupply: bigint
): number {
  if (totalSupply === 0n) return 0;
  const ownership = parseFloat(formatUnits(userShares, SFUSDC_DECIMALS)) /
                    parseFloat(formatUnits(totalSupply, SFUSDC_DECIMALS));
  return ownership * 100;
}

/**
 * Calculate proportional allocation of user position
 */
export function calculateProportionalAllocation(
  userShares: bigint,
  totalSupply: bigint,
  totalDeployed: bigint,
  totalInTreasury: bigint,
  availableLiquidity: bigint
): {
  deployed: bigint;
  treasury: bigint;
  liquid: bigint;
} {
  if (totalSupply === 0n) {
    return { deployed: 0n, treasury: 0n, liquid: 0n };
  }

  const ratio = (userShares * 10n ** 18n) / totalSupply;

  return {
    deployed: (totalDeployed * ratio) / 10n ** 18n,
    treasury: (totalInTreasury * ratio) / 10n ** 18n,
    liquid: (availableLiquidity * ratio) / 10n ** 18n,
  };
}
