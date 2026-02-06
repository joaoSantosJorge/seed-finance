import { type Address } from 'viem';
import { type ContractAddresses, type Environment } from './types';

const ZERO = '0x0000000000000000000000000000000000000000' as Address;

const defaults: Record<Environment, ContractAddresses> = {
  local: {
    usdc: ZERO, // Set via env var after Anvil deploy
    liquidityPool: ZERO,
    treasuryManager: ZERO,
    invoiceDiamond: ZERO,
    executionPool: ZERO,
  },
  testnet: {
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address,
    liquidityPool: ZERO, // Set via env var after deploy
    treasuryManager: ZERO,
    invoiceDiamond: ZERO, // Set via env var after deploy
    executionPool: ZERO, // Set via env var after deploy
  },
  production: {
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
    liquidityPool: ZERO,
    treasuryManager: ZERO,
    invoiceDiamond: ZERO,
    executionPool: ZERO,
  },
};

export function getContractAddresses(env: Environment): ContractAddresses {
  const d = defaults[env];
  return {
    usdc: (process.env.NEXT_PUBLIC_USDC_ADDRESS as Address) || d.usdc,
    liquidityPool:
      (process.env.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS as Address) ||
      d.liquidityPool,
    treasuryManager:
      (process.env.NEXT_PUBLIC_TREASURY_MANAGER_ADDRESS as Address) ||
      d.treasuryManager,
    invoiceDiamond:
      (process.env.NEXT_PUBLIC_INVOICE_DIAMOND_ADDRESS as Address) ||
      d.invoiceDiamond,
    executionPool:
      (process.env.NEXT_PUBLIC_EXECUTION_POOL_ADDRESS as Address) ||
      d.executionPool,
  };
}

export const USDC_DECIMALS = 6;
// SEED shares inherit decimals from underlying asset (USDC) via ERC4626
export const SEED_DECIMALS = 6;
