import { type WidgetConfig, type SDKConfig, type ChainId } from '@lifi/widget';
import { isProduction, isTestnet } from '@/lib/config';

/**
 * LI.FI Configuration
 *
 * Configures the LI.FI widget for cross-chain deposits into Seed Finance.
 * Users can swap/bridge any token from any chain to USDC on Arc,
 * which is then auto-deposited into the LiquidityPool.
 *
 * Note: LI.FI does not yet support Arc chain. This config is a placeholder
 * for when support is added. isLiFiBridgingAvailable() returns false for Arc.
 */

// Arc chain IDs
export const ARC_MAINNET_CHAIN_ID = 1243 as ChainId;
export const ARC_TESTNET_CHAIN_ID = 5042002 as ChainId;

// USDC addresses (Arc system contract)
export const USDC_ADDRESS_MAINNET = '0x3600000000000000000000000000000000000000';
export const USDC_ADDRESS_TESTNET = '0x3600000000000000000000000000000000000000';

// LiFiReceiver contract addresses (set after deployment)
// These are read from environment variables
export const LIFI_RECEIVER_ADDRESS_MAINNET =
  process.env.NEXT_PUBLIC_LIFI_RECEIVER_ADDRESS_MAINNET || '';
export const LIFI_RECEIVER_ADDRESS_SEPOLIA =
  process.env.NEXT_PUBLIC_LIFI_RECEIVER_ADDRESS_SEPOLIA || '';

/**
 * Get the current chain configuration based on environment
 */
export function getCurrentChainConfig() {
  if (isProduction) {
    return {
      chainId: ARC_MAINNET_CHAIN_ID,
      usdcAddress: USDC_ADDRESS_MAINNET,
      receiverAddress: LIFI_RECEIVER_ADDRESS_MAINNET,
    };
  }
  return {
    chainId: ARC_TESTNET_CHAIN_ID,
    usdcAddress: USDC_ADDRESS_TESTNET,
    receiverAddress: LIFI_RECEIVER_ADDRESS_SEPOLIA,
  };
}

/**
 * LI.FI SDK Configuration
 */
export const lifiSdkConfig: SDKConfig = {
  integrator: 'seed-finance',
  // Fee configuration (optional - we don't charge additional fees)
  // fee: 0,
};

/**
 * Create LI.FI Widget configuration
 *
 * The widget is configured to:
 * 1. Lock destination chain to Arc
 * 2. Lock destination token to USDC
 * 3. Set receiver to LiFiReceiver contract (for auto-deposit)
 * 4. Allow any source chain/token
 */
export function createWidgetConfig(): WidgetConfig {
  const { chainId, usdcAddress, receiverAddress } = getCurrentChainConfig();

  // Base widget configuration
  const config: WidgetConfig = {
    integrator: 'seed-finance',
    variant: 'compact',

    // Lock destination to USDC on Base
    toChain: chainId,
    toToken: usdcAddress,

    // Allow all source chains (LI.FI will filter available routes)
    // Don't restrict fromChain to enable cross-chain deposits

    // Contract call configuration
    // When receiverAddress is set, LI.FI will call the receiver contract
    // with the resulting USDC after the swap/bridge
    ...(receiverAddress && {
      contractCalls: [
        {
          fromAmount: '0', // Will be replaced with actual amount
          fromTokenAddress: usdcAddress,
          toContractAddress: receiverAddress,
          toContractCallData: '0x', // Will be encoded by widget
          toContractGasLimit: '200000',
        },
      ],
    }),

    // Appearance
    appearance: 'dark',

    // Slippage settings
    slippage: 0.005, // 0.5% default slippage

    // UI customization
    hiddenUI: [
      'appearance', // Hide theme toggle (we control it)
      'poweredBy', // Hide "Powered by LI.FI" (optional)
    ],

    // Disable certain bridges/exchanges if needed
    // disabledBridges: [],
    // disabledExchanges: [],

    // Set theme to match app
    theme: {
      palette: {
        primary: { main: '#10B981' }, // Success green
        secondary: { main: '#6366F1' }, // Indigo
        background: {
          paper: '#1E293B', // Slate 800
          default: '#0F172A', // Slate 900
        },
      },
      shape: {
        borderRadius: 12,
        borderRadiusSecondary: 8,
      },
    },

    // Callbacks
    // Note: These may need to be set differently depending on widget version
  };

  return config;
}

/**
 * Get supported source chains
 * LI.FI supports 30+ chains, but we can restrict if needed
 */
export function getSupportedSourceChains(): ChainId[] {
  // Return all chains LI.FI supports
  // In production, you might want to limit this list
  return [
    1, // Ethereum
    10, // Optimism
    56, // BSC
    100, // Gnosis
    137, // Polygon
    250, // Fantom
    324, // zkSync Era
    1101, // Polygon zkEVM
    8453, // Base
    42161, // Arbitrum
    43114, // Avalanche
    59144, // Linea
    534352, // Scroll
  ] as ChainId[];
}

/**
 * Check if LI.FI receiver is configured
 */
export function isLiFiReceiverConfigured(): boolean {
  const { receiverAddress } = getCurrentChainConfig();
  return !!receiverAddress && receiverAddress !== '';
}

/**
 * Check if we're in a testnet environment where LI.FI bridges may not work
 */
export function isLiFiBridgingAvailable(): boolean {
  // LI.FI does not yet support Arc chain
  // Return false until LI.FI adds Arc support
  return false;
}
