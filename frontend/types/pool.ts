// ============ Pool State ============
export interface PoolState {
  // Core metrics
  totalAssets: bigint;
  totalSupply: bigint;
  sharePrice: bigint;

  // Allocation
  availableLiquidity: bigint;
  totalDeployed: bigint;
  totalInTreasury: bigint;

  // Rates (basis points)
  utilizationRate: number;
  treasuryAllocationRate: number;

  // Yield tracking
  totalInvoiceYield: bigint;
  totalTreasuryYield: bigint;

  // Pool info
  activeInvoices: number;
  liquidityBuffer: bigint;
  maxTreasuryAllocation: number;

  // Metadata
  lastUpdated: number;
}

// ============ User Position ============
export interface UserPosition {
  address: string;
  sharesOwned: bigint;
  currentValue: bigint;

  // Cost basis (from deposits/withdrawals)
  totalDeposited: bigint;
  totalWithdrawn: bigint;
  netDeposits: bigint;

  // Yield
  unrealizedGain: bigint;
  unrealizedGainPercent: number;

  // Pool share
  poolOwnership: number;

  // Proportional allocation
  proportionalDeployed: bigint;
  proportionalTreasury: bigint;
  proportionalLiquid: bigint;
}

// ============ Formatted versions for display ============
export interface FormattedPoolState {
  totalAssets: string;
  totalSupply: string;
  sharePrice: string;
  availableLiquidity: string;
  totalDeployed: string;
  totalInTreasury: string;
  utilizationRate: string;
  treasuryAllocationRate: string;
  totalInvoiceYield: string;
  totalTreasuryYield: string;
  activeInvoices: number;
}

export interface FormattedUserPosition {
  sharesOwned: string;
  currentValue: string;
  totalDeposited: string;
  totalWithdrawn: string;
  netDeposits: string;
  unrealizedGain: string;
  unrealizedGainPercent: string;
  poolOwnership: string;
  proportionalDeployed: string;
  proportionalTreasury: string;
  proportionalLiquid: string;
}
