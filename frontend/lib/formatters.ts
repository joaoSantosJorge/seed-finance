import { formatUnits } from 'viem';
import { USDC_DECIMALS, SFUSDC_DECIMALS } from './contracts';

// ============ Number Formatting ============

/**
 * Format USDC amount (6 decimals) to display string
 * @param amount Amount in raw units (bigint)
 * @param showSign Show + prefix for positive values
 */
export function formatUSDC(amount: bigint, showSign = false): string {
  const value = parseFloat(formatUnits(amount, USDC_DECIMALS));
  const formatted = formatCurrency(value);
  if (showSign && value > 0) {
    return `+${formatted}`;
  }
  return formatted;
}

/**
 * Format sfUSDC shares (6 decimals, same as underlying USDC) to display string
 */
export function formatShares(amount: bigint, decimals = 2): string {
  const value = parseFloat(formatUnits(amount, SFUSDC_DECIMALS));
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a number as currency (USD)
 */
export function formatCurrency(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (compact && Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format a percentage value
 */
export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format basis points to percentage
 */
export function formatBps(bps: number): string {
  return formatPercent(bps / 100);
}

/**
 * Format a percentage change with sign
 */
export function formatPercentChange(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${formatPercent(value)}`;
}

// ============ Address Formatting ============

/**
 * Truncate an Ethereum address
 */
export function truncateAddress(address: string, startChars = 6, endChars = 4): string {
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Truncate a transaction hash
 */
export function truncateTxHash(hash: string): string {
  return truncateAddress(hash, 10, 8);
}

// ============ Date/Time Formatting ============

/**
 * Format a timestamp to a readable date
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a timestamp to date and time
 */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp * 1000;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return formatDate(timestamp);
  }
  if (days > 1) {
    return `${days} days ago`;
  }
  if (days === 1) {
    return 'Yesterday';
  }
  if (hours > 1) {
    return `${hours} hours ago`;
  }
  if (hours === 1) {
    return '1 hour ago';
  }
  if (minutes > 1) {
    return `${minutes} minutes ago`;
  }
  if (minutes === 1) {
    return '1 minute ago';
  }
  return 'Just now';
}

// ============ Share Price Formatting ============

/**
 * Format share price (1 share = X USDC)
 * Share price is typically close to 1.0 but increases as yield is earned
 * @param priceInAssets USDC value of 1 sfUSDC share (from convertToAssets(1e6))
 */
export function formatSharePrice(priceInAssets: bigint): string {
  const price = parseFloat(formatUnits(priceInAssets, USDC_DECIMALS));
  return price.toFixed(4);
}
