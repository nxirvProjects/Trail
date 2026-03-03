import type { HTMLAttributes } from 'react';
import { cn } from '@/shared/lib/utils';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-md bg-[var(--app-hover)]', className)} {...props} />;
}
