'use client';

import { Tooltip } from '@/components/ui';

interface AllocationSegment {
  label: string;
  value: string;
  percentage: number;
  color: string;
  textColor?: string;
}

interface AllocationBarProps {
  segments: AllocationSegment[];
  showLegend?: boolean;
  height?: 'sm' | 'md' | 'lg';
  className?: string;
}

const heightClasses = {
  sm: 'h-3',
  md: 'h-4',
  lg: 'h-6',
};

export function AllocationBar({
  segments,
  showLegend = true,
  height = 'md',
  className = '',
}: AllocationBarProps) {
  // Filter out zero-value segments for the bar, but keep them in legend
  const visibleSegments = segments.filter((s) => s.percentage > 0);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Progress Bar */}
      <div className={`${heightClasses[height]} bg-slate-700 rounded-full overflow-hidden flex`}>
        {visibleSegments.length === 0 ? (
          <div className="w-full h-full bg-slate-600 flex items-center justify-center">
            <span className="text-[10px] text-cool-gray">No allocation</span>
          </div>
        ) : (
          visibleSegments.map((segment, index) => (
            <Tooltip
              key={index}
              content={`${segment.label}: ${segment.value} (${segment.percentage.toFixed(1)}%)`}
            >
              <div
                className="h-full transition-all duration-300 cursor-default"
                style={{
                  width: `${segment.percentage}%`,
                  backgroundColor: segment.color,
                  minWidth: segment.percentage > 0 ? '4px' : '0',
                }}
              />
            </Tooltip>
          ))
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {segments.map((segment, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: segment.color }}
              />
              <div className="flex items-baseline gap-1.5">
                <span className="text-body-sm text-cool-gray">{segment.label}:</span>
                <span className="text-body-sm font-mono text-white">{segment.value}</span>
                <span className="text-body-sm text-silver">
                  ({segment.percentage.toFixed(1)}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
