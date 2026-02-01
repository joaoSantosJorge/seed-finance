import {
  type Environment,
  type EnvironmentConfig,
  type AppConfig,
} from './types';
import { anvil, baseSepolia, baseMainnet } from './chains';
import { getContractAddresses } from './contracts';

function getEnvironment(): Environment {
  const env = process.env.NEXT_PUBLIC_ENV as Environment;
  if (env === 'local' || env === 'testnet' || env === 'production') return env;
  return 'testnet'; // Default
}

const configs: Record<Environment, Omit<EnvironmentConfig, 'contracts'>> = {
  local: {
    name: 'local',
    displayName: 'Local (Anvil)',
    chain: anvil,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8545',
    explorer: { name: 'Local', url: '' },
    features: { treasuryEnabled: true, mockData: false, debugMode: true },
  },
  testnet: {
    name: 'testnet',
    displayName: 'Base Sepolia',
    chain: baseSepolia,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org',
    explorer: { name: 'BaseScan', url: 'https://sepolia.basescan.org' },
    features: { treasuryEnabled: true, mockData: false, debugMode: true },
  },
  production: {
    name: 'production',
    displayName: 'Base Mainnet',
    chain: baseMainnet,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://mainnet.base.org',
    explorer: { name: 'BaseScan', url: 'https://basescan.org' },
    features: { treasuryEnabled: true, mockData: false, debugMode: false },
  },
};

function createAppConfig(): AppConfig {
  const environment = getEnvironment();
  const base = configs[environment];
  const contracts = getContractAddresses(environment);
  const config: EnvironmentConfig = { ...base, contracts };

  return {
    environment,
    config,
    chain: config.chain,
    chainId: config.chain.id,
    contracts,
    rpcUrl: config.rpcUrl,
    explorerUrl: config.explorer.url,
    isLocal: environment === 'local',
    isTestnet: environment === 'testnet',
    isProduction: environment === 'production',
  };
}

export const appConfig = createAppConfig();
export const {
  environment,
  chain,
  chainId,
  contracts,
  rpcUrl,
  explorerUrl,
  isLocal,
  isTestnet,
  isProduction,
} = appConfig;
