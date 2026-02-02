'use client';

import { CreditCard, AlertTriangle, Clock, Loader2, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, Button } from '@/components/ui';
import { useAccount } from 'wagmi';
import { useUpcomingRepayments, useProcessRepayment } from '@/hooks';
import { formatCurrency } from '@/lib/formatters';
import { useState } from 'react';

export default function BuyerRepaymentsPage() {
  const { address } = useAccount();
  const { data: repaymentInvoices, totalDue, isLoading } = useUpcomingRepayments(address);
  const { processRepayment, isPending: isRepaying, isConfirming, reset } = useProcessRepayment();
  const [repayingId, setRepayingId] = useState<bigint | null>(null);

  const handleRepay = async (invoiceId: bigint) => {
    setRepayingId(invoiceId);
    reset();
    processRepayment(invoiceId);
  };

  // Separate overdue and upcoming
  const now = new Date();
  const overdueInvoices = repaymentInvoices?.filter(inv => {
    const maturity = new Date(Number(inv.maturityDate) * 1000);
    return maturity < now;
  }) ?? [];

  const upcomingInvoices = repaymentInvoices?.filter(inv => {
    const maturity = new Date(Number(inv.maturityDate) * 1000);
    return maturity >= now;
  }) ?? [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-h1 text-white">Repayments</h1>
        <p className="text-body text-cool-gray mt-1">
          View and pay funded invoices
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="p-6">
            <p className="text-body-sm text-cool-gray">Total Due</p>
            <p className="text-h2 text-white mt-2">{formatCurrency(totalDue, 6)}</p>
            <p className="text-body-sm text-cool-gray mt-1">USDC</p>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <p className="text-body-sm text-cool-gray">Upcoming</p>
            <p className="text-h2 text-primary mt-2">{upcomingInvoices.length}</p>
            <p className="text-body-sm text-cool-gray mt-1">invoices</p>
          </div>
        </Card>

        <Card className={overdueInvoices.length > 0 ? 'border-error/50' : ''}>
          <div className="p-6">
            <p className="text-body-sm text-cool-gray">Overdue</p>
            <p className={`text-h2 mt-2 ${overdueInvoices.length > 0 ? 'text-error' : 'text-success'}`}>
              {overdueInvoices.length}
            </p>
            <p className="text-body-sm text-cool-gray mt-1">invoices</p>
          </div>
        </Card>
      </div>

      {/* Overdue Section */}
      {overdueInvoices.length > 0 && (
        <Card className="border-error/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-error" />
              <CardTitle className="text-error">Overdue Invoices</CardTitle>
            </div>
          </CardHeader>
          <div className="divide-y divide-slate-700">
            {overdueInvoices.map((invoice) => {
              const maturityDate = new Date(Number(invoice.maturityDate) * 1000);
              const daysOverdue = Math.abs(
                Math.ceil((maturityDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              );
              const isProcessing = repayingId === invoice.id && (isRepaying || isConfirming);

              return (
                <div
                  key={invoice.id.toString()}
                  className="p-4 hover:bg-slate-700/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-error/10 rounded-lg flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-error" />
                      </div>
                      <div>
                        <p className="text-body font-medium text-white">
                          Invoice #{invoice.id.toString()}
                        </p>
                        <p className="text-body-sm text-error">
                          {daysOverdue} days overdue
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-body text-white">
                          {formatCurrency(invoice.faceValue, 6)} USDC
                        </p>
                        <p className="text-body-sm text-cool-gray">
                          Due: {maturityDate.toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleRepay(invoice.id)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {isRepaying ? 'Confirm...' : 'Paying...'}
                          </>
                        ) : (
                          'Pay Now'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Upcoming Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Repayments</CardTitle>
        </CardHeader>

        {isLoading ? (
          <div className="p-6 pt-0 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-slate-700/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : upcomingInvoices.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
            <p className="text-white text-body mb-2">No upcoming repayments</p>
            <p className="text-cool-gray text-body-sm">
              All funded invoices have been paid
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {upcomingInvoices.map((invoice) => {
              const maturityDate = new Date(Number(invoice.maturityDate) * 1000);
              const daysUntil = Math.ceil(
                (maturityDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
              );
              const isProcessing = repayingId === invoice.id && (isRepaying || isConfirming);
              const isUrgent = daysUntil <= 3;

              return (
                <div
                  key={invoice.id.toString()}
                  className="p-4 hover:bg-slate-700/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isUrgent ? 'bg-warning/10' : 'bg-primary/10'
                      }`}>
                        {isUrgent ? (
                          <Clock className="w-5 h-5 text-warning" />
                        ) : (
                          <CreditCard className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="text-body font-medium text-white">
                          Invoice #{invoice.id.toString()}
                        </p>
                        <p className={`text-body-sm ${isUrgent ? 'text-warning' : 'text-cool-gray'}`}>
                          Due in {daysUntil} days
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-body text-white">
                          {formatCurrency(invoice.faceValue, 6)} USDC
                        </p>
                        <p className="text-body-sm text-cool-gray">
                          Due: {maturityDate.toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant={isUrgent ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => handleRepay(invoice.id)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {isRepaying ? 'Confirm...' : 'Paying...'}
                          </>
                        ) : (
                          'Pay Now'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
