'use client';

import Link from 'next/link';
import { FileCheck, Clock, AlertTriangle, CreditCard, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, MetricSkeleton } from '@/components/ui';
import { useAccount } from 'wagmi';
import { usePendingApprovals, useUpcomingRepayments, useBuyerInvoices } from '@/hooks';
import { formatUSDC } from '@/lib/formatters';

export default function BuyerDashboard() {
  const { address } = useAccount();
  const { data: pendingInvoices, count: pendingCount, isLoading: pendingLoading } = usePendingApprovals(address);
  const { data: repaymentInvoices, totalDue, isLoading: repaymentLoading } = useUpcomingRepayments(address);
  const { isLoading: allLoading } = useBuyerInvoices(address);

  const isLoading = pendingLoading || repaymentLoading || allLoading;

  // Calculate metrics
  const overdueCount = repaymentInvoices?.filter(inv => {
    const maturity = new Date(Number(inv.maturityDate) * 1000);
    return maturity < new Date();
  }).length ?? 0;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-h1 text-white">Buyer Dashboard</h1>
        <p className="text-body text-cool-gray mt-1">
          Manage invoice approvals and repayments
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-body-sm text-cool-gray">Pending Approvals</CardTitle>
          </CardHeader>
          {isLoading ? (
            <MetricSkeleton />
          ) : (
            <p className="text-h2 text-warning px-6 pb-4">{pendingCount}</p>
          )}
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-body-sm text-cool-gray">Upcoming Repayments</CardTitle>
          </CardHeader>
          {isLoading ? (
            <MetricSkeleton />
          ) : (
            <p className="text-h2 text-primary px-6 pb-4">{repaymentInvoices?.length ?? 0}</p>
          )}
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-body-sm text-cool-gray">Total Due</CardTitle>
          </CardHeader>
          {isLoading ? (
            <MetricSkeleton />
          ) : (
            <p className="text-h2 text-white px-6 pb-4">{formatUSDC(totalDue)}</p>
          )}
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-body-sm text-cool-gray">Overdue</CardTitle>
          </CardHeader>
          {isLoading ? (
            <MetricSkeleton />
          ) : (
            <p className={`text-h2 px-6 pb-4 ${overdueCount > 0 ? 'text-error' : 'text-success'}`}>
              {overdueCount}
            </p>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <div className="space-y-3 p-6 pt-0">
          <Link
            href="/dashboard/buyer/invoices"
            className="flex items-center gap-4 p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors group"
          >
            <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-warning" />
            </div>
            <div className="flex-1">
              <p className="text-body font-medium text-white">
                Pending Approvals
                {pendingCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-warning/10 text-warning text-body-sm rounded-full">
                    {pendingCount}
                  </span>
                )}
              </p>
              <p className="text-body-sm text-cool-gray">Review and approve invoices</p>
            </div>
            <ArrowRight className="w-5 h-5 text-cool-gray group-hover:text-white transition-colors" />
          </Link>

          <Link
            href="/dashboard/buyer/repayments"
            className="flex items-center gap-4 p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors group"
          >
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-body font-medium text-white">
                Upcoming Repayments
                {overdueCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-error/10 text-error text-body-sm rounded-full">
                    {overdueCount} overdue
                  </span>
                )}
              </p>
              <p className="text-body-sm text-cool-gray">View and pay funded invoices</p>
            </div>
            <ArrowRight className="w-5 h-5 text-cool-gray group-hover:text-white transition-colors" />
          </Link>
        </div>
      </Card>

      {/* Pending Approvals Section */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Approvals</CardTitle>
          <Link
            href="/dashboard/buyer/invoices"
            className="text-body-sm text-primary hover:underline"
          >
            View All
          </Link>
        </CardHeader>
        {isLoading ? (
          <div className="p-6 pt-0 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-700/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !pendingInvoices || pendingInvoices.length === 0 ? (
          <div className="py-8 text-center">
            <FileCheck className="w-12 h-12 text-success mx-auto mb-4" />
            <p className="text-white text-body">All caught up!</p>
            <p className="text-cool-gray text-body-sm">No pending invoices to approve</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {pendingInvoices.slice(0, 5).map((invoice) => (
              <Link
                key={invoice.id.toString()}
                href={`/dashboard/buyer/invoices/${invoice.id}`}
                className="flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-warning" />
                  <div>
                    <p className="text-body text-white">Invoice #{invoice.id.toString()}</p>
                    <p className="text-body-sm text-cool-gray">
                      From: {invoice.supplier.slice(0, 6)}...{invoice.supplier.slice(-4)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-body text-white">{formatUSDC(invoice.faceValue)}</p>
                  <p className="text-body-sm text-warning">Pending</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Upcoming Repayments Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Repayments</CardTitle>
          <Link
            href="/dashboard/buyer/repayments"
            className="text-body-sm text-primary hover:underline"
          >
            View All
          </Link>
        </CardHeader>
        {isLoading ? (
          <div className="p-6 pt-0 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-700/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !repaymentInvoices || repaymentInvoices.length === 0 ? (
          <div className="py-8 text-center">
            <CreditCard className="w-12 h-12 text-cool-gray mx-auto mb-4" />
            <p className="text-cool-gray text-body-sm">No upcoming repayments</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {repaymentInvoices.slice(0, 5).map((invoice) => {
              const maturityDate = new Date(Number(invoice.maturityDate) * 1000);
              const isOverdue = maturityDate < new Date();
              const daysUntil = Math.ceil((maturityDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

              return (
                <Link
                  key={invoice.id.toString()}
                  href={`/dashboard/buyer/repayments/${invoice.id}`}
                  className="flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isOverdue ? (
                      <AlertTriangle className="w-5 h-5 text-error" />
                    ) : (
                      <CreditCard className="w-5 h-5 text-primary" />
                    )}
                    <div>
                      <p className="text-body text-white">Invoice #{invoice.id.toString()}</p>
                      <p className={`text-body-sm ${isOverdue ? 'text-error' : 'text-cool-gray'}`}>
                        {isOverdue
                          ? `${Math.abs(daysUntil)} days overdue`
                          : `Due in ${daysUntil} days`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-body text-white">{formatUSDC(invoice.faceValue)}</p>
                    <p className={`text-body-sm ${isOverdue ? 'text-error' : 'text-cool-gray'}`}>
                      {maturityDate.toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
