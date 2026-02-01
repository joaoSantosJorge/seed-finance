'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: ReactNode;
  children?: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  maxWidth?: string;
}

export function Tooltip({
  content,
  children,
  position = 'top',
  className,
  maxWidth = '280px',
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children || (
        <span className="text-[var(--text-muted)] hover:text-[var(--accent)] cursor-help font-bold">[?]</span>
      )}

      {isVisible && (
        <div
          className={cn(
            'absolute z-50 px-3 py-2 bg-[var(--border-color)] text-[var(--bg-primary)] text-xs border-2 border-[var(--border-color)]',
            positions[position]
          )}
          style={{ maxWidth }}
        >
          {content}
        </div>
      )}
    </div>
  );
}

// Predefined tooltips for financial terms
export const tooltipContent = {
  sharePrice:
    'The value of 1 sfUSDC in USDC. Increases as yield accrues to the pool. Your position value = shares x share price.',
  utilizationRate:
    'Percentage of pool capital currently deployed to finance invoices. Higher utilization = more capital earning yield.',
  availableLiquidity:
    'USDC available for immediate withdrawal. Withdrawals exceeding this may require treasury redemption.',
  treasuryAllocation:
    'Percentage of idle capital deployed to treasury strategies (like USYC) to earn additional yield.',
  apy: 'Annual Percentage Yield - the annualized return you can expect on your deposit based on current pool performance.',
  sfUSDC:
    'Seed Finance USDC shares - ERC-4626 vault tokens that represent your share of the liquidity pool.',
};
