'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  SystemHealthCard,
  InvoiceTable,
  BatchFundModal,
} from '@/components/operator';
import { PoolMetrics } from '@/components/pool';
import { useApprovedInvoices, useOverdueInvoices, useOperatorRole } from '@/hooks/operator';
import { usePausePool, useUnpausePool } from '@/hooks/operator/usePoolAdmin';
import { usePoolState } from '@/hooks';
import type { Invoice } from '@/hooks/invoice/useInvoice';
import {
  Banknote,
  Pause,
  Play,
  FileText,
  AlertTriangle,
  ArrowRight,
  Settings,
} from 'lucide-react';

export default function OperatorDashboard() {
  const { isOwner } = useOperatorRole();
  const { isPaused, isLoading: poolLoading } = usePoolState();
  const { data: approvedInvoices, count: pendingCount, refetch } = useApprovedInvoices();
  const { count: overdueCount } = useOverdueInvoices();

  const { pause, isPending: pausePending, isConfirming: pauseConfirming } = usePausePool();
  const { unpause, isPending: unpausePending, isConfirming: unpauseConfirming } = useUnpausePool();

  const [showBatchFund, setShowBatchFund] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState<Invoice[]>([]);

  const handleFundAll = () => {
    setSelectedInvoices(approvedInvoices);
    setShowBatchFund(true);
  };

  const handleBatchSuccess = () => {
    setShowBatchFund(false);
    setSelectedInvoices([]);
    refetch();
  };

  const handlePauseToggle = () => {
    if (isPaused) {
      unpause();
    } else {
      pause();
    }
  };

  const isProcessing = pausePending || pauseConfirming || unpausePending || unpauseConfirming;

  return (
    <div className="space-y-6">
      {/* System Health */}
      <SystemHealthCard />

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Pending Funding */}
        <Card className={pendingCount > 0 ? 'border-yellow-500/50' : ''}>
          <CardHeader>
            <CardTitle>Pending Funding</CardTitle>
            {pendingCount > 0 && <Badge variant="warning">{pendingCount}</Badge>}
          </CardHeader>
          <div className="space-y-4">
            <p className="text-body text-cool-gray">
              {pendingCount > 0
                ? `${pendingCount} invoice${pendingCount !== 1 ? 's' : ''} ready to be funded.`
                : 'No invoices waiting for funding.'}
            </p>
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleFundAll}
                disabled={pendingCount === 0}
                leftIcon={<Banknote className="w-4 h-4" />}
              >
                Fund All
              </Button>
              <Link href="/dashboard/operator/invoices?status=approved">
                <Button variant="secondary" size="sm" leftIcon={<FileText className="w-4 h-4" />}>
                  View
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        {/* Overdue Invoices */}
        <Card className={overdueCount > 0 ? 'border-red-500/50' : ''}>
          <CardHeader>
            <CardTitle>Overdue Invoices</CardTitle>
            {overdueCount > 0 && <Badge variant="error">{overdueCount}</Badge>}
          </CardHeader>
          <div className="space-y-4">
            <p className="text-body text-cool-gray">
              {overdueCount > 0
                ? `${overdueCount} invoice${overdueCount !== 1 ? 's' : ''} past maturity date.`
                : 'No overdue invoices.'}
            </p>
            <Link href="/dashboard/operator/invoices?status=overdue">
              <Button
                variant={overdueCount > 0 ? 'danger' : 'secondary'}
                size="sm"
                leftIcon={<AlertTriangle className="w-4 h-4" />}
              >
                {overdueCount > 0 ? 'Review Now' : 'View'}
              </Button>
            </Link>
          </div>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <Button
              variant={isPaused ? 'primary' : 'danger'}
              size="sm"
              onClick={handlePauseToggle}
              disabled={isProcessing || poolLoading}
              isLoading={isProcessing}
              leftIcon={isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              className="w-full justify-start"
            >
              {isPaused ? 'Unpause Pool' : 'Pause Pool'}
            </Button>
            {isOwner && (
              <Link href="/dashboard/operator/config" className="block">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Settings className="w-4 h-4" />}
                  className="w-full justify-start"
                >
                  Manage Operators
                </Button>
              </Link>
            )}
          </div>
        </Card>
      </div>

      {/* Pool Metrics */}
      <PoolMetrics />

      {/* Recent Invoices */}
      <InvoiceTable limit={5} showViewAll />

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/dashboard/operator/invoices">
          <Card hoverable className="h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-cool-gray" />
                <span className="text-body text-white">All Invoices</span>
              </div>
              <ArrowRight className="w-4 h-4 text-cool-gray" />
            </div>
          </Card>
        </Link>
        <Link href="/dashboard/operator/pool">
          <Card hoverable className="h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Pause className="w-5 h-5 text-cool-gray" />
                <span className="text-body text-white">Pool Settings</span>
              </div>
              <ArrowRight className="w-4 h-4 text-cool-gray" />
            </div>
          </Card>
        </Link>
        <Link href="/dashboard/operator/treasury">
          <Card hoverable className="h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Banknote className="w-5 h-5 text-cool-gray" />
                <span className="text-body text-white">Treasury Management</span>
              </div>
              <ArrowRight className="w-4 h-4 text-cool-gray" />
            </div>
          </Card>
        </Link>
      </div>

      {/* Batch Fund Modal */}
      <BatchFundModal
        isOpen={showBatchFund}
        onClose={() => setShowBatchFund(false)}
        invoices={selectedInvoices}
        onSuccess={handleBatchSuccess}
      />
    </div>
  );
}
