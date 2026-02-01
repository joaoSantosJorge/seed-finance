import { type Address } from 'viem';

// Contract addresses by chain ID
export const contractAddresses: Record<number, {
  usdc: Address;
  liquidityPool: Address;
  treasuryManager: Address;
}> = {
  // Base Sepolia
  84532: {
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address,
    liquidityPool: (process.env.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS || '0x0000000000000000000000000000000000000000') as Address,
    treasuryManager: (process.env.NEXT_PUBLIC_TREASURY_MANAGER_ADDRESS || '0x0000000000000000000000000000000000000000') as Address,
  },
  // Base Mainnet
  8453: {
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
    liquidityPool: (process.env.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS || '0x0000000000000000000000000000000000000000') as Address,
    treasuryManager: (process.env.NEXT_PUBLIC_TREASURY_MANAGER_ADDRESS || '0x0000000000000000000000000000000000000000') as Address,
  },
};

// Helper to get addresses for current chain
export function getContractAddresses(chainId: number) {
  return contractAddresses[chainId] || contractAddresses[84532];
}

// USDC decimals on Base
export const USDC_DECIMALS = 6;

// sfUSDC decimals (ERC-4626 share token)
export const SFUSDC_DECIMALS = 18;

// Explorer URLs
export const explorerUrls: Record<number, string> = {
  84532: 'https://sepolia.basescan.org',
  8453: 'https://basescan.org',
};

export function getExplorerUrl(chainId: number): string {
  return explorerUrls[chainId] || explorerUrls[84532];
}

export function getExplorerTxUrl(chainId: number, txHash: string): string {
  return `${getExplorerUrl(chainId)}/tx/${txHash}`;
}

export function getExplorerAddressUrl(chainId: number, address: string): string {
  return `${getExplorerUrl(chainId)}/address/${address}`;
}
