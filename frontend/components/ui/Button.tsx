'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
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
      'inline-flex items-center justify-center font-semibold rounded-button transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-deep-navy disabled:cursor-not-allowed';

    const variants = {
      primary:
        'bg-primary text-white hover:bg-blue-500 active:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 focus:ring-primary',
      secondary:
        'bg-transparent border border-slate-600 text-white hover:bg-slate-700 disabled:opacity-50 focus:ring-slate-500',
      ghost:
        'bg-transparent text-cool-gray hover:text-white disabled:opacity-50 focus:ring-slate-500',
      danger:
        'bg-error text-white hover:bg-rose-600 active:bg-rose-700 disabled:opacity-50 focus:ring-error',
    };

    const sizes = {
      sm: 'text-body-sm px-3 py-2 gap-1.5',
      md: 'text-body px-6 py-3 gap-2',
      lg: 'text-body px-8 py-4 gap-2',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
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
