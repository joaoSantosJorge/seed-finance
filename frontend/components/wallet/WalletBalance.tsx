'use client';

import { useUserPosition } from '@/hooks';
import { Skeleton } from '@/components/ui';

interface WalletBalanceProps {
  showIcon?: boolean;
  className?: string;
}

export function WalletBalance({ className }: WalletBalanceProps) {
  const { formattedUsdcBalance, isLoading, isConnected } = useUserPosition();

  if (!isConnected) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 border-2 border-[var(--border-color)] bg-[var(--bg-card)] ${className}`}>
      <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">USDC:</span>
      {isLoading ? (
        <Skeleton className="h-4 w-20" />
      ) : (
        <span className="text-xs font-bold text-[var(--text-primary)]">
          {formattedUsdcBalance}
        </span>
      )}
    </div>
  );
}
