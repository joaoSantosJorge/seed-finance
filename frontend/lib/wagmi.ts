import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { appConfig, rpcUrl, anvil, arcTestnet, arcMainnet } from './config';

const chains = appConfig.isLocal
  ? [anvil, arcTestnet]
  : appConfig.isProduction
    ? [arcMainnet]
    : [arcTestnet, arcMainnet];

export const wagmiConfig = getDefaultConfig({
  appName: 'Seed Finance',
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chains: chains as any,
  transports: {
    [anvil.id]: http(rpcUrl, { batch: true }),
    [arcTestnet.id]: http(rpcUrl, { batch: true }),
    [arcMainnet.id]: http(rpcUrl, { batch: true }),
  },
  ssr: true,
});
