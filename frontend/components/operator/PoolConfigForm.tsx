'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatUnits, parseUnits } from 'viem';
import { useLiquidityBuffer, useMaxTreasuryAllocation, useSetLiquidityBuffer, useSetMaxTreasuryAllocation } from '@/hooks/operator/usePoolAdmin';
import { USDC_DECIMALS } from '@/lib/contracts';

export function PoolConfigForm() {
  const { data: currentBuffer, isLoading: bufferLoading } = useLiquidityBuffer();
  const { data: currentAllocation, isLoading: allocationLoading } = useMaxTreasuryAllocation();

  const { setBuffer, isPending: bufferPending, isConfirming: bufferConfirming, isSuccess: bufferSuccess, reset: resetBuffer } = useSetLiquidityBuffer();
  const { setAllocation, isPending: allocationPending, isConfirming: allocationConfirming, isSuccess: allocationSuccess, reset: resetAllocation } = useSetMaxTreasuryAllocation();

  const [bufferInput, setBufferInput] = useState('');
  const [allocationInput, setAllocationInput] = useState('');

  // Initialize inputs with current values
  useEffect(() => {
    if (currentBuffer !== undefined) {
      setBufferInput(formatUnits(currentBuffer, USDC_DECIMALS));
    }
  }, [currentBuffer]);

  useEffect(() => {
    if (currentAllocation !== undefined) {
      setAllocationInput((Number(currentAllocation) / 100).toString());
    }
  }, [currentAllocation]);

  // Reset on success
  useEffect(() => {
    if (bufferSuccess) {
      resetBuffer();
    }
  }, [bufferSuccess, resetBuffer]);

  useEffect(() => {
    if (allocationSuccess) {
      resetAllocation();
    }
  }, [allocationSuccess, resetAllocation]);

  const handleSetBuffer = () => {
    const amount = parseUnits(bufferInput, USDC_DECIMALS);
    setBuffer(amount);
  };

  const handleSetAllocation = () => {
    const bps = BigInt(Math.round(parseFloat(allocationInput) * 100));
    setAllocation(bps);
  };

  const isBufferChanged = currentBuffer !== undefined && bufferInput !== formatUnits(currentBuffer, USDC_DECIMALS);
  const isAllocationChanged = currentAllocation !== undefined && allocationInput !== (Number(currentAllocation) / 100).toString();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pool Configuration</CardTitle>
      </CardHeader>

      <div className="space-y-6">
        {/* Liquidity Buffer */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-body font-medium text-white">Liquidity Buffer</p>
              <p className="text-body-sm text-cool-gray">
                Minimum USDC to keep available (not in treasury)
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                type="number"
                value={bufferInput}
                onChange={(e) => setBufferInput(e.target.value)}
                placeholder="100000"
                disabled={bufferLoading}
              />
            </div>
            <span className="flex items-center px-3 text-body text-cool-gray">USDC</span>
            <Button
              variant="secondary"
              onClick={handleSetBuffer}
              disabled={!isBufferChanged || bufferPending || bufferConfirming}
              isLoading={bufferPending || bufferConfirming}
            >
              Update
            </Button>
          </div>
          {currentBuffer !== undefined && (
            <p className="text-body-sm text-cool-gray">
              Current: {Number(formatUnits(currentBuffer, USDC_DECIMALS)).toLocaleString()} USDC
            </p>
          )}
        </div>

        {/* Max Treasury Allocation */}
        <div className="space-y-3 pt-4 border-t border-[var(--border-color)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-body font-medium text-white">Max Treasury Allocation</p>
              <p className="text-body-sm text-cool-gray">
                Maximum % of idle capital to deploy to treasury strategies
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                type="number"
                value={allocationInput}
                onChange={(e) => setAllocationInput(e.target.value)}
                placeholder="80"
                min="0"
                max="100"
                disabled={allocationLoading}
              />
            </div>
            <span className="flex items-center px-3 text-body text-cool-gray">%</span>
            <Button
              variant="secondary"
              onClick={handleSetAllocation}
              disabled={!isAllocationChanged || allocationPending || allocationConfirming}
              isLoading={allocationPending || allocationConfirming}
            >
              Update
            </Button>
          </div>
          {currentAllocation !== undefined && (
            <p className="text-body-sm text-cool-gray">
              Current: {Number(currentAllocation) / 100}%
            </p>
          )}

          {/* Allocation Slider Visual */}
          <div className="mt-4">
            <div className="flex justify-between text-body-sm text-cool-gray mb-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
            <div className="h-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--text-primary)] transition-all"
                style={{ width: `${parseFloat(allocationInput) || 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
