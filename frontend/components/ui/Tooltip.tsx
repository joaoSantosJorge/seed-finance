'use client';

import { useState, type ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
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

  const arrows = {
    top: 'bottom-[-6px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'top-[-6px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent',
    left: 'right-[-6px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent',
    right: 'left-[-6px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent',
  };

  return (
    <div
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children || (
        <HelpCircle className="w-4 h-4 text-cool-gray hover:text-silver cursor-help" />
      )}

      {isVisible && (
        <div
          className={cn(
            'absolute z-50 px-3 py-2 bg-slate-700 text-white text-body-sm rounded-lg shadow-lg',
            'animate-in fade-in-0 zoom-in-95 duration-150',
            positions[position]
          )}
          style={{ maxWidth }}
        >
          {content}
          <div
            className={cn(
              'absolute w-0 h-0 border-[6px] border-slate-700',
              arrows[position]
            )}
          />
        </div>
      )}
    </div>
  );
}

// Predefined tooltips for financial terms
export const tooltipContent = {
  sharePrice:
    'The value of 1 sfUSDC in USDC. Increases as yield accrues to the pool. Your position value = shares × share price.',
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
