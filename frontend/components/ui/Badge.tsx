'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    const variants = {
      default: 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)]',
      success: 'bg-transparent text-[var(--text-primary)] border-[var(--border-color)]',
      warning: 'bg-transparent text-[var(--text-muted)] border-[var(--text-muted)]',
      error: 'bg-[var(--text-muted)] text-[var(--bg-primary)] border-[var(--text-muted)]',
      info: 'bg-transparent text-[var(--text-primary)] border-[var(--border-color)]',
    };

    const prefixes = {
      default: '',
      success: '[+] ',
      warning: '[!] ',
      error: '[X] ',
      info: '[i] ',
    };

    const sizes = {
      sm: 'text-[10px] px-2 py-0.5',
      md: 'text-xs px-3 py-1',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center font-bold uppercase tracking-wider border-2',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {prefixes[variant]}{props.children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
