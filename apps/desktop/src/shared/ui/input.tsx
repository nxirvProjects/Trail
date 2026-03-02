import * as React from 'react';
import { cn } from '@/shared/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-elevated)] px-3 py-1 text-sm text-[var(--app-text)] shadow-sm transition-colors placeholder:text-[var(--app-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export { Input };
