import { type Chain, type Address } from 'viem';

export type Environment = 'local' | 'testnet' | 'production';

export interface ContractAddresses {
  usdc: Address;
  liquidityPool: Address;
  treasuryManager: Address;
  lifiReceiver: Address;
}

export interface EnvironmentConfig {
  name: Environment;
  displayName: string;
  chain: Chain;
  rpcUrl: string;
  contracts: ContractAddresses;
  explorer: { name: string; url: string };
  features: {
    treasuryEnabled: boolean;
    mockData: boolean;
    debugMode: boolean;
  };
}

export interface AppConfig {
  environment: Environment;
  config: EnvironmentConfig;
  chain: Chain;
  chainId: number;
  contracts: ContractAddresses;
  rpcUrl: string;
  explorerUrl: string;
  isLocal: boolean;
  isTestnet: boolean;
  isProduction: boolean;
}
