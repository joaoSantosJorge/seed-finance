/**
 * DepositRoutingService
 *
 * Smart routing service that determines the optimal deposit path
 * based on source chain and token type.
 *
 * Routes:
 * 1. USDC on Arc -> Direct deposit (fastest, cheapest)
 * 2. USDC on other chains -> CCTP (fast, native USDC, ~15 min)
 * 3. Fiat -> Circle Gateway (for users without crypto)
 */

import type {
  DepositRoute,
  DepositRouteType,
  RouteStep,
  CCTPDomain,
  CCTP_DOMAINS,
} from '../types';

/**
 * Chain configuration
 */
interface ChainConfig {
  chainId: number;
  name: string;
  cctpDomain?: CCTPDomain;
  usdcAddress?: string;
  tokenMessenger?: string;
  messageTransmitter?: string;
}

/**
 * Token information
 */
interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  isNative: boolean;
}

/**
 * Route calculation result
 */
interface RouteCalculation {
  route: DepositRoute;
  score: number; // Higher is better
  warnings: string[];
}

/**
 * Supported chains configuration
 */
const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  // Arc Testnet (destination)
  5042002: {
    chainId: 5042002,
    name: 'Arc Testnet',
    usdcAddress: '0x3600000000000000000000000000000000000000',
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
  },
  // Ethereum
  1: {
    chainId: 1,
    name: 'Ethereum',
    cctpDomain: 0,
    usdcAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    tokenMessenger: '0xBd3fa81B58Ba92a82136038B25aDec7066af3155',
    messageTransmitter: '0x0a992d191DEeC32aFe36203Ad87D7d289a738F81',
  },
  // Ethereum Sepolia (testnet)
  11155111: {
    chainId: 11155111,
    name: 'Ethereum Sepolia',
    cctpDomain: 0,
    usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
    messageTransmitter: '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
  },
  // Arbitrum
  42161: {
    chainId: 42161,
    name: 'Arbitrum',
    cctpDomain: 3,
    usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    tokenMessenger: '0x19330d10D9Cc8751218eaf51E8885D058642E08A',
    messageTransmitter: '0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca',
  },
  // Polygon
  137: {
    chainId: 137,
    name: 'Polygon',
    cctpDomain: 7,
    usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    tokenMessenger: '0x9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE',
    messageTransmitter: '0xF3be9355363857F3e001be68856A2f96b4C39Ba9',
  },
  // Optimism
  10: {
    chainId: 10,
    name: 'Optimism',
    cctpDomain: 2,
    usdcAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    tokenMessenger: '0x2B4069517957735bE00ceE0fadAE88a26365528f',
    messageTransmitter: '0x4D41f22c5a0e5c74090899E5a8Fb597a8842b3e8',
  },
  // Avalanche
  43114: {
    chainId: 43114,
    name: 'Avalanche',
    cctpDomain: 1,
    usdcAddress: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    tokenMessenger: '0x6B25532e1060CE10cc3B0A99e5683b91BFDe6982',
    messageTransmitter: '0x8186359aF5F57FbB40c6b14A588d2A59C0C29880',
  },
};

/**
 * Destination chain (Arc mainnet or testnet)
 */
const DESTINATION_CHAINS = {
  mainnet: 1243,    // Arc mainnet (placeholder)
  testnet: 5042002, // Arc testnet
};

export class DepositRoutingService {
  private destinationChainId: number;
  private contractAddresses: {
    smartRouter: string;
    cctpReceiver: string;
    liquidityPool: string;
  };

  /**
   * Initialize the deposit routing service
   * @param isTestnet Whether to use testnet configuration
   * @param contractAddresses Deployed contract addresses
   */
  constructor(
    isTestnet: boolean = true,
    contractAddresses?: {
      smartRouter: string;
      cctpReceiver: string;
      liquidityPool: string;
    }
  ) {
    this.destinationChainId = isTestnet
      ? DESTINATION_CHAINS.testnet
      : DESTINATION_CHAINS.mainnet;

    this.contractAddresses = contractAddresses || {
      smartRouter: '',
      cctpReceiver: '',
      liquidityPool: '',
    };
  }

  /**
   * Get the optimal deposit route
   * @param sourceChain Source chain ID
   * @param sourceToken Source token address (use 'native' for native token)
   * @param amount Amount to deposit
   * @returns Optimal deposit route
   */
  async getRoute(
    sourceChain: number,
    sourceToken: string,
    amount: bigint
  ): Promise<DepositRoute> {
    const sourceChainConfig = SUPPORTED_CHAINS[sourceChain];
    const destChainConfig = SUPPORTED_CHAINS[this.destinationChainId];

    if (!sourceChainConfig) {
      throw new Error(`Unsupported source chain: ${sourceChain}`);
    }

    // Determine if source token is USDC
    const isSourceUSDC = this.isUSDC(sourceToken, sourceChainConfig);

    // Calculate all possible routes
    const routes: RouteCalculation[] = [];

    // Route 1: Direct deposit (if already on Arc with USDC)
    if (sourceChain === this.destinationChainId && isSourceUSDC) {
      routes.push(this.calculateDirectRoute(amount));
    }

    // Route 2: CCTP (if USDC on CCTP-supported chain)
    if (
      isSourceUSDC &&
      sourceChainConfig.cctpDomain !== undefined &&
      sourceChain !== this.destinationChainId
    ) {
      routes.push(this.calculateCCTPRoute(sourceChainConfig, destChainConfig, amount));
    }

    // Route 3: Gateway (for fiat - always available as last resort)
    routes.push(this.calculateGatewayRoute(amount));

    // Sort by score and return best route
    routes.sort((a, b) => b.score - a.score);

    if (routes.length === 0) {
      throw new Error('No available route for this deposit');
    }

    return routes[0].route;
  }

  /**
   * Calculate direct deposit route (USDC on Arc)
   */
  private calculateDirectRoute(amount: bigint): RouteCalculation {
    const destChainConfig = SUPPORTED_CHAINS[this.destinationChainId];

    const steps: RouteStep[] = [
      {
        type: 'APPROVE',
        description: 'Approve USDC spending',
        estimatedTime: '~15 seconds',
        contractAddress: destChainConfig.usdcAddress,
      },
      {
        type: 'DEPOSIT',
        description: 'Deposit USDC to LiquidityPool',
        estimatedTime: '~15 seconds',
        contractAddress: this.contractAddresses.smartRouter,
      },
    ];

    return {
      route: {
        type: 'DIRECT',
        sourceChain: this.destinationChainId,
        sourceToken: destChainConfig.usdcAddress || '',
        destinationToken: destChainConfig.usdcAddress || '',
        estimatedGas: '~0.01 USDC',
        estimatedTime: '~30 seconds',
        steps,
      },
      score: 100, // Highest priority - fastest and cheapest
      warnings: [],
    };
  }

  /**
   * Calculate CCTP route (cross-chain USDC)
   */
  private calculateCCTPRoute(
    sourceChain: ChainConfig,
    destChain: ChainConfig,
    amount: bigint
  ): RouteCalculation {
    const steps: RouteStep[] = [
      {
        type: 'APPROVE',
        description: `Approve USDC on ${sourceChain.name}`,
        estimatedTime: '~15 seconds',
        contractAddress: sourceChain.usdcAddress,
      },
      {
        type: 'BURN',
        description: `Burn USDC via CCTP on ${sourceChain.name}`,
        estimatedTime: '~30 seconds',
        contractAddress: sourceChain.tokenMessenger,
        data: {
          destinationDomain: destChain.cctpDomain,
          recipient: this.contractAddresses.cctpReceiver,
        },
      },
      {
        type: 'WAIT_ATTESTATION',
        description: 'Wait for Circle attestation',
        estimatedTime: '~15 minutes',
        data: {
          attestationApi: 'https://iris-api.circle.com/attestations',
        },
      },
      {
        type: 'RECEIVE',
        description: `Receive USDC on ${destChain.name}`,
        estimatedTime: '~30 seconds',
        contractAddress: destChain.messageTransmitter,
      },
      {
        type: 'DEPOSIT',
        description: 'Auto-deposit to LiquidityPool',
        estimatedTime: '~15 seconds',
        contractAddress: this.contractAddresses.cctpReceiver,
      },
    ];

    const warnings: string[] = [];

    // Add warning for small amounts (gas may not be worth it)
    if (amount < 100_000_000n) {
      // Less than 100 USDC
      warnings.push('Small amounts may have high relative gas costs');
    }

    return {
      route: {
        type: 'CCTP',
        sourceChain: sourceChain.chainId,
        sourceToken: sourceChain.usdcAddress || '',
        destinationToken: destChain.usdcAddress || '',
        estimatedGas: '~0.02 USDC total',
        estimatedTime: '~15-20 minutes',
        steps,
      },
      score: 80, // Second priority - native USDC, trustless
      warnings,
    };
  }

  /**
   * Calculate Gateway route (fiat)
   */
  private calculateGatewayRoute(amount: bigint): RouteCalculation {
    const steps: RouteStep[] = [
      {
        type: 'BRIDGE',
        description: 'Initiate bank wire transfer',
        estimatedTime: '~5 minutes',
        data: {
          provider: 'Circle Gateway',
          supportedMethods: ['ACH', 'Wire'],
        },
      },
      {
        type: 'WAIT_ATTESTATION',
        description: 'Wait for bank transfer settlement',
        estimatedTime: '1-3 business days',
      },
      {
        type: 'RECEIVE',
        description: 'Receive USDC in Circle Wallet',
        estimatedTime: 'Automatic',
      },
      {
        type: 'DEPOSIT',
        description: 'Deposit USDC to LiquidityPool',
        estimatedTime: '~30 seconds',
        contractAddress: this.contractAddresses.smartRouter,
      },
    ];

    const warnings: string[] = [
      'Requires bank account verification',
      'Settlement takes 1-3 business days',
      'Minimum amount may apply',
    ];

    return {
      route: {
        type: 'GATEWAY',
        sourceChain: 0, // Fiat - no source chain
        sourceToken: 'USD',
        destinationToken:
          SUPPORTED_CHAINS[this.destinationChainId].usdcAddress || '',
        estimatedGas: '$0 (no gas for fiat)',
        estimatedTime: '1-3 business days',
        steps,
      },
      score: 20, // Lowest priority - slowest
      warnings,
    };
  }

  /**
   * Check if a token is USDC on the given chain
   */
  private isUSDC(tokenAddress: string, chainConfig: ChainConfig): boolean {
    return (
      tokenAddress.toLowerCase() === chainConfig.usdcAddress?.toLowerCase()
    );
  }

  /**
   * Get all supported source chains
   */
  getSupportedChains(): Array<{
    chainId: number;
    name: string;
    supportsCCTP: boolean;
  }> {
    return Object.values(SUPPORTED_CHAINS)
      .filter((chain) => chain.chainId !== this.destinationChainId)
      .map((chain) => ({
        chainId: chain.chainId,
        name: chain.name,
        supportsCCTP: chain.cctpDomain !== undefined,
      }));
  }

  /**
   * Get USDC address for a chain
   */
  getUSDCAddress(chainId: number): string | undefined {
    return SUPPORTED_CHAINS[chainId]?.usdcAddress;
  }

  /**
   * Check if a route type is available for given parameters
   */
  isRouteAvailable(
    routeType: DepositRouteType,
    sourceChain: number,
    sourceToken: string
  ): boolean {
    const sourceChainConfig = SUPPORTED_CHAINS[sourceChain];
    const isSourceUSDC = sourceChainConfig
      ? this.isUSDC(sourceToken, sourceChainConfig)
      : false;

    switch (routeType) {
      case 'DIRECT':
        return sourceChain === this.destinationChainId && isSourceUSDC;

      case 'CCTP':
        return (
          isSourceUSDC &&
          sourceChainConfig?.cctpDomain !== undefined &&
          sourceChain !== this.destinationChainId
        );

      case 'GATEWAY':
        return true; // Always available

      default:
        return false;
    }
  }

  /**
   * Set contract addresses (for runtime configuration)
   */
  setContractAddresses(addresses: {
    smartRouter?: string;
    cctpReceiver?: string;
    liquidityPool?: string;
  }): void {
    this.contractAddresses = {
      ...this.contractAddresses,
      ...addresses,
    };
  }
}

export default DepositRoutingService;
