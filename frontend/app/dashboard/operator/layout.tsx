'use client';

import { DashboardLayout } from '@/components/layout';
import { OperatorGuard } from '@/components/operator';
import { operatorNavigation } from '@/lib/config/navigation';
import { Shield } from 'lucide-react';

export default function OperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout navigation={operatorNavigation}>
      <OperatorGuard>
        <div className="space-y-6">
          {/* Operator Header */}
          <div className="flex items-center gap-3 pb-4 border-b-2 border-[var(--border-color)]">
            <div className="w-10 h-10 bg-[var(--text-primary)]/10 border-2 border-[var(--border-color)] flex items-center justify-center">
              <Shield className="w-5 h-5 text-[var(--text-primary)]" />
            </div>
            <div>
              <h1 className="text-h2 text-white">Operator Dashboard</h1>
              <p className="text-body-sm text-cool-gray">
                Manage invoices, pool, and system configuration
              </p>
            </div>
          </div>

          {/* Page Content */}
          <div>{children}</div>
        </div>
      </OperatorGuard>
    </DashboardLayout>
  );
}
