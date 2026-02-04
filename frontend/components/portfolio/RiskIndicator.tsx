'use client';

import { AlertTriangle, Shield, Zap } from 'lucide-react';
import { Tooltip } from '@/components/ui';

interface RiskLevel {
  label: string;
  value: string;
  percentage: number;
  description: string;
}

interface RiskIndicatorProps {
  atRisk: RiskLevel;
  lowRisk: RiskLevel;
  safe: RiskLevel;
  className?: string;
}

export function RiskIndicator({ atRisk, lowRisk, safe, className = '' }: RiskIndicatorProps) {
  const total = atRisk.percentage + lowRisk.percentage + safe.percentage;

  // Normalize to 100% if there's any allocation
  const normalizedAtRisk = total > 0 ? (atRisk.percentage / total) * 100 : 0;
  const normalizedLowRisk = total > 0 ? (lowRisk.percentage / total) * 100 : 0;
  const normalizedSafe = total > 0 ? (safe.percentage / total) * 100 : 0;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Risk badges */}
      <div className="space-y-2">
        {/* At Risk - Invoice exposure */}
        <Tooltip content={atRisk.description}>
          <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg border border-slate-700 cursor-default">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <span className="text-body-sm text-white">{atRisk.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-body-sm font-mono text-white">{atRisk.value}</span>
              <span className="text-body-sm text-warning">
                {normalizedAtRisk.toFixed(0)}%
              </span>
            </div>
          </div>
        </Tooltip>

        {/* Low Risk - Treasury */}
        <Tooltip content={lowRisk.description}>
          <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg border border-slate-700 cursor-default">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-success" />
              <span className="text-body-sm text-white">{lowRisk.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-body-sm font-mono text-white">{lowRisk.value}</span>
              <span className="text-body-sm text-success">
                {normalizedLowRisk.toFixed(0)}%
              </span>
            </div>
          </div>
        </Tooltip>

        {/* Safe - Liquid */}
        <Tooltip content={safe.description}>
          <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg border border-slate-700 cursor-default">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-body-sm text-white">{safe.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-body-sm font-mono text-white">{safe.value}</span>
              <span className="text-body-sm text-primary">
                {normalizedSafe.toFixed(0)}%
              </span>
            </div>
          </div>
        </Tooltip>
      </div>
    </div>
  );
}
