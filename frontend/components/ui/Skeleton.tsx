'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  className,
  width,
  height,
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'skeleton bg-[var(--bg-secondary)]',
        className
      )}
      style={{
        width: width,
        height: height,
      }}
    />
  );
}

// Pre-configured skeleton patterns
export function MetricSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="card">
      <MetricSkeleton />
    </div>
  );
}

export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 py-4 border-b-2 border-[var(--border-color)]">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="h-64 w-full relative">
      <Skeleton className="absolute inset-0" />
    </div>
  );
}
