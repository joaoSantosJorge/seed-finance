/**
 * Time Provider for Seed Finance Backend
 *
 * Provides a unified way to get "current time" that can switch between:
 * - System time (production)
 * - Blockchain time (local testing with Anvil time manipulation)
 *
 * This ensures the backend stays in sync with Anvil's manipulated time
 * when testing time-dependent features like yield accrual.
 */

import { createPublicClient, http, PublicClient, defineChain } from 'viem';
import { foundry } from 'viem/chains';

// Arc chain definition (viem doesn't have Arc built-in yet)
const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { decimals: 18, name: 'USD Coin', symbol: 'USDC' },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
});

// ============ Configuration ============

export type TimeSource = 'system' | 'blockchain';

interface TimeProviderConfig {
  source: TimeSource;
  rpcUrl?: string;
  chainId?: number;
}

// Default configuration - uses environment variables
const DEFAULT_CONFIG: TimeProviderConfig = {
  source: (process.env.TIME_SOURCE as TimeSource) || 'system',
  rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8545',
  chainId: parseInt(process.env.CHAIN_ID || '31337'),
};

// ============ Time Provider Class ============

class TimeProvider {
  private config: TimeProviderConfig;
  private client: PublicClient | null = null;
  private cachedBlockTime: { timestamp: Date; fetchedAt: number } | null = null;
  private readonly CACHE_TTL_MS = 1000; // Cache blockchain time for 1 second

  constructor(config: TimeProviderConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  /**
   * Configure the time provider
   */
  configure(config: Partial<TimeProviderConfig>): void {
    this.config = { ...this.config, ...config };
    this.client = null; // Reset client on config change
    this.cachedBlockTime = null;
  }

  /**
   * Set time source (convenience method)
   */
  setSource(source: TimeSource): void {
    this.configure({ source });
  }

  /**
   * Use blockchain time (for local testing)
   */
  useBlockchainTime(rpcUrl?: string): void {
    this.configure({
      source: 'blockchain',
      rpcUrl: rpcUrl || this.config.rpcUrl,
    });
  }

  /**
   * Use system time (for production)
   */
  useSystemTime(): void {
    this.configure({ source: 'system' });
  }

  /**
   * Get current time source
   */
  getSource(): TimeSource {
    return this.config.source;
  }

  /**
   * Get the viem client (lazy initialization)
   */
  private getClient(): PublicClient {
    if (!this.client) {
      const chain = this.getChain();
      this.client = createPublicClient({
        chain,
        transport: http(this.config.rpcUrl),
      });
    }
    return this.client;
  }

  /**
   * Get chain config based on chainId
   */
  private getChain() {
    switch (this.config.chainId) {
      case 31337:
        return foundry;
      case 5042002:
        return arcTestnet;
      default:
        return foundry;
    }
  }

  /**
   * Get current time as Date
   * - In 'system' mode: returns new Date()
   * - In 'blockchain' mode: returns block timestamp from RPC
   */
  async now(): Promise<Date> {
    if (this.config.source === 'system') {
      return new Date();
    }

    // Check cache first
    if (this.cachedBlockTime) {
      const cacheAge = Date.now() - this.cachedBlockTime.fetchedAt;
      if (cacheAge < this.CACHE_TTL_MS) {
        return this.cachedBlockTime.timestamp;
      }
    }

    // Fetch from blockchain
    try {
      const client = this.getClient();
      const block = await client.getBlock();
      const timestamp = new Date(Number(block.timestamp) * 1000);

      // Update cache
      this.cachedBlockTime = {
        timestamp,
        fetchedAt: Date.now(),
      };

      return timestamp;
    } catch (error) {
      console.warn('Failed to fetch blockchain time, falling back to system time:', error);
      return new Date();
    }
  }

  /**
   * Get current time as Unix timestamp (seconds)
   */
  async nowUnix(): Promise<number> {
    const date = await this.now();
    return Math.floor(date.getTime() / 1000);
  }

  /**
   * Get current time as BigInt (for contract interactions)
   */
  async nowBigInt(): Promise<bigint> {
    const unix = await this.nowUnix();
    return BigInt(unix);
  }

  /**
   * Synchronous version - uses cached value or system time
   * Useful when async is not possible (e.g., in some contexts)
   */
  nowSync(): Date {
    if (this.config.source === 'system') {
      return new Date();
    }

    // Return cached blockchain time if available and fresh
    if (this.cachedBlockTime) {
      const cacheAge = Date.now() - this.cachedBlockTime.fetchedAt;
      if (cacheAge < this.CACHE_TTL_MS * 10) {
        // Use slightly longer TTL for sync
        return this.cachedBlockTime.timestamp;
      }
    }

    // Fall back to system time if no cache
    console.warn('No cached blockchain time available, using system time');
    return new Date();
  }

  /**
   * Clear the cache (useful after time manipulation)
   */
  clearCache(): void {
    this.cachedBlockTime = null;
  }
}

// ============ Singleton Instance ============

export const timeProvider = new TimeProvider();

// ============ Convenience Functions ============

/**
 * Get current time as Date
 */
export async function getCurrentTime(): Promise<Date> {
  return timeProvider.now();
}

/**
 * Get current time as Unix timestamp
 */
export async function getCurrentTimestamp(): Promise<number> {
  return timeProvider.nowUnix();
}

/**
 * Calculate days between two dates
 */
export function daysBetween(from: Date, to: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((to.getTime() - from.getTime()) / msPerDay);
}

/**
 * Calculate days until a future date from "now"
 */
export async function daysUntil(futureDate: Date): Promise<number> {
  const now = await timeProvider.now();
  return daysBetween(now, futureDate);
}

/**
 * Check if a date is in the past
 */
export async function isPast(date: Date): Promise<boolean> {
  const now = await timeProvider.now();
  return date.getTime() < now.getTime();
}

export default timeProvider;
