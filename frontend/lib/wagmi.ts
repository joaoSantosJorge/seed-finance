import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { appConfig, anvil, baseSepolia, baseMainnet } from './config';

const chains = appConfig.isLocal
  ? [anvil, baseSepolia]
  : appConfig.isProduction
    ? [baseMainnet]
    : [baseSepolia, baseMainnet];

export const wagmiConfig = getDefaultConfig({
  appName: 'Seed Finance',
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chains: chains as any,
  ssr: true,
});
