'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Pause, Play } from 'lucide-react';
import { usePoolPaused } from '@/hooks/contracts/useLiquidityPool';
import { usePausePool, useUnpausePool } from '@/hooks/operator/usePoolAdmin';
import { ConfirmActionModal } from './ConfirmActionModal';

export function PoolStatusCard() {
  const { data: isPaused, isLoading } = usePoolPaused();
  const { pause, isPending: pausePending, isConfirming: pauseConfirming, isSuccess: pauseSuccess, reset: resetPause } = usePausePool();
  const { unpause, isPending: unpausePending, isConfirming: unpauseConfirming, isSuccess: unpauseSuccess, reset: resetUnpause } = useUnpausePool();

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Reset and close modal on success
  useEffect(() => {
    if (pauseSuccess) {
      setShowConfirmModal(false);
      resetPause();
    }
    if (unpauseSuccess) {
      setShowConfirmModal(false);
      resetUnpause();
    }
  }, [pauseSuccess, unpauseSuccess, resetPause, resetUnpause]);

  const handleToggle = () => {
    if (isPaused) {
      unpause();
    } else {
      setShowConfirmModal(true);
    }
  };

  const handleConfirmPause = () => {
    pause();
  };

  const isProcessing = pausePending || pauseConfirming || unpausePending || unpauseConfirming;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Pool Status</CardTitle>
          <Badge variant={isPaused ? 'error' : 'success'} size="md">
            {isPaused ? 'PAUSED' : 'ACTIVE'}
          </Badge>
        </CardHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
              <div>
                <p className="text-body font-medium text-white">
                  {isPaused ? 'Pool is Paused' : 'Pool is Active'}
                </p>
                <p className="text-body-sm text-cool-gray">
                  {isPaused
                    ? 'Deposits and withdrawals are disabled'
                    : 'All operations are functioning normally'}
                </p>
              </div>
            </div>

            <Button
              variant={isPaused ? 'primary' : 'danger'}
              onClick={handleToggle}
              isLoading={isProcessing || isLoading}
              leftIcon={isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            >
              {isPaused ? 'Unpause' : 'Pause'}
            </Button>
          </div>

          <p className="text-body-sm text-cool-gray">
            {isPaused
              ? 'Click Unpause to resume normal pool operations.'
              : 'Pausing the pool will prevent all deposits and withdrawals. Use only in emergency situations.'}
          </p>
        </div>
      </Card>

      <ConfirmActionModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmPause}
        title="Pause Pool"
        description="This will disable all deposits and withdrawals. Are you sure you want to pause the pool?"
        confirmText="Pause Pool"
        variant="danger"
        isLoading={pausePending || pauseConfirming}
      />
    </>
  );
}
