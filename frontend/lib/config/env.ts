import {
  type Environment,
  type EnvironmentConfig,
  type AppConfig,
} from './types';
import { anvil, arcTestnet, arcMainnet } from './chains';
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
    displayName: 'Arc Testnet',
    chain: arcTestnet,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.testnet.arc.network',
    explorer: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
    features: { treasuryEnabled: true, mockData: false, debugMode: true },
  },
  production: {
    name: 'production',
    displayName: 'Arc Mainnet',
    chain: arcMainnet,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.arc.network',
    explorer: { name: 'ArcScan', url: 'https://arcscan.app' },
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
