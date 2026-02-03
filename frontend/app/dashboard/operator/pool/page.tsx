'use client';

import {
  PoolStatusCard,
  PoolConfigForm,
  EmergencyWithdrawForm,
} from '@/components/operator';
import { PoolMetrics, UtilizationBar } from '@/components/pool';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { useOperatorRole } from '@/hooks/operator';

export default function OperatorPoolPage() {
  const { isOwner } = useOperatorRole();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-h2 text-white">Pool Administration</h2>
        <p className="text-body text-cool-gray">
          Manage pool settings, pause operations, and configure liquidity parameters.
        </p>
      </div>

      {/* Pool Status */}
      <PoolStatusCard />

      {/* Pool Allocation */}
      <Card>
        <CardHeader>
          <CardTitle>Pool Allocation</CardTitle>
        </CardHeader>
        <UtilizationBar />
      </Card>

      {/* Pool Metrics */}
      <PoolMetrics />

      {/* Pool Configuration */}
      <PoolConfigForm />

      {/* Emergency Withdraw (Owner Only) */}
      {isOwner && <EmergencyWithdrawForm />}
    </div>
  );
}
