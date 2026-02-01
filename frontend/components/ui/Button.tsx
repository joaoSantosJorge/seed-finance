'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-bold uppercase tracking-wider border-2 transition-all duration-150 focus:outline-none disabled:cursor-not-allowed';

    const variants = {
      primary: cn(
        'bg-[var(--border-color)] text-[var(--bg-primary)] border-[var(--border-color)]',
        'hover:bg-[var(--accent)] hover:border-[var(--accent)] hover:shadow-[3px_3px_0_var(--border-color)] hover:-translate-x-0.5 hover:-translate-y-0.5',
        'active:shadow-none active:translate-x-0 active:translate-y-0',
        'disabled:bg-[var(--text-muted)] disabled:border-[var(--text-muted)] disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0'
      ),
      secondary: cn(
        'bg-transparent text-[var(--text-primary)] border-[var(--border-color)]',
        'hover:bg-[var(--bg-secondary)] hover:shadow-[3px_3px_0_var(--border-color)] hover:-translate-x-0.5 hover:-translate-y-0.5',
        'active:shadow-none active:translate-x-0 active:translate-y-0',
        'disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0'
      ),
      ghost: cn(
        'bg-transparent text-[var(--text-muted)] border-transparent',
        'hover:text-[var(--accent)]',
        'disabled:opacity-50'
      ),
      danger: cn(
        'bg-[var(--accent)] text-white border-[var(--accent)]',
        'hover:bg-[var(--accent-hover)] hover:shadow-[3px_3px_0_var(--border-color)] hover:-translate-x-0.5 hover:-translate-y-0.5',
        'active:shadow-none active:translate-x-0 active:translate-y-0',
        'disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0'
      ),
    };

    const sizes = {
      sm: 'text-xs px-3 py-1.5 gap-1.5',
      md: 'text-sm px-6 py-2.5 gap-2',
      lg: 'text-sm px-8 py-3.5 gap-2',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <span className="animate-pulse">...</span>
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
