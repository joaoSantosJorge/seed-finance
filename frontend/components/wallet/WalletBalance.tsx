'use client';

import { useUserPosition } from '@/hooks';
import { Skeleton } from '@/components/ui';
import { Wallet } from 'lucide-react';

interface WalletBalanceProps {
  showIcon?: boolean;
  className?: string;
}

export function WalletBalance({ showIcon = true, className }: WalletBalanceProps) {
  const { formattedUsdcBalance, isLoading, isConnected } = useUserPosition();

  if (!isConnected) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showIcon && <Wallet className="w-4 h-4 text-cool-gray" />}
      <span className="text-body-sm text-cool-gray">USDC:</span>
      {isLoading ? (
        <Skeleton className="h-4 w-20" />
      ) : (
        <span className="text-body-sm font-mono text-white">
          {formattedUsdcBalance}
        </span>
      )}
    </div>
  );
}
