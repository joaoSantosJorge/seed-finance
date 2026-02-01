'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, rightElement, leftElement, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-body-sm text-cool-gray mb-2"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftElement && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-silver">
              {leftElement}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full bg-slate-800 border border-slate-600 rounded-button px-4 py-3 text-white font-mono',
              'placeholder:text-silver focus:outline-none focus:border-primary',
              'transition-colors duration-150',
              error && 'border-error focus:border-error',
              leftElement && 'pl-12',
              rightElement && 'pr-16',
              className
            )}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-cool-gray text-body-sm font-medium">
              {rightElement}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-2 text-body-sm text-error">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-2 text-body-sm text-silver">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
