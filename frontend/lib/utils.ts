import { type ClassValue, clsx } from 'clsx';

/**
 * Utility for merging class names
 * Since we're using Tailwind v4, we use clsx directly instead of tailwind-merge
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
