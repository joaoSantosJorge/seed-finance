import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { baseSepolia, baseMainnet } from './chains';

export const wagmiConfig = getDefaultConfig({
  appName: 'Seed Finance',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
  chains: [baseSepolia, baseMainnet],
  ssr: true,
});
