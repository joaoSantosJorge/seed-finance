'use client';

import Link from 'next/link';
import { FileCheck, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, Button } from '@/components/ui';
import { useAccount } from 'wagmi';
import { usePendingApprovals, useApproveInvoice } from '@/hooks';
import { formatUSDC } from '@/lib/formatters';
import { useState } from 'react';

export default function BuyerInvoicesPage() {
  const { address } = useAccount();
  const { data: pendingInvoices, isLoading, count } = usePendingApprovals(address);
  const { approveInvoice, isPending: isApproving, isConfirming, reset } = useApproveInvoice();
  const [approvingId, setApprovingId] = useState<bigint | null>(null);

  const handleApprove = async (invoiceId: bigint) => {
    setApprovingId(invoiceId);
    reset();
    approveInvoice(invoiceId);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-h1 text-white">Pending Approvals</h1>
        <p className="text-body text-cool-gray mt-1">
          Review and approve invoices from your suppliers
        </p>
      </div>

      {/* Summary Card */}
      <Card>
        <div className="flex items-center gap-4 p-6">
          <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
            <Clock className="w-6 h-6 text-warning" />
          </div>
          <div>
            <p className="text-h3 text-white">{count} Pending</p>
            <p className="text-body-sm text-cool-gray">Invoices awaiting your approval</p>
          </div>
        </div>
      </Card>

      {/* Invoice List */}
      <Card>
        <CardHeader>
          <CardTitle>Invoices to Approve</CardTitle>
        </CardHeader>

        {isLoading ? (
          <div className="p-6 pt-0 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-slate-700/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !pendingInvoices || pendingInvoices.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
            <p className="text-white text-body mb-2">All caught up!</p>
            <p className="text-cool-gray text-body-sm">
              No pending invoices to approve
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {pendingInvoices.map((invoice) => {
              const maturityDate = new Date(Number(invoice.maturityDate) * 1000);
              const daysToMaturity = Math.ceil(
                (maturityDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              );
              const discountRate = invoice.discountRateBps / 100;
              const isProcessing = approvingId === invoice.id && (isApproving || isConfirming);

              return (
                <div
                  key={invoice.id.toString()}
                  className="p-4 hover:bg-slate-700/30 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center mt-1">
                        <FileCheck className="w-5 h-5 text-warning" />
                      </div>
                      <div>
                        <p className="text-body font-medium text-white">
                          Invoice #{invoice.id.toString()}
                        </p>
                        <p className="text-body-sm text-cool-gray mt-1">
                          From: {invoice.supplier.slice(0, 8)}...{invoice.supplier.slice(-6)}
                        </p>
                        <div className="flex gap-4 mt-2">
                          <div>
                            <span className="text-body-sm text-cool-gray">Face Value</span>
                            <p className="text-body text-white">
                              {formatUSDC(invoice.faceValue)}
                            </p>
                          </div>
                          <div>
                            <span className="text-body-sm text-cool-gray">Discount</span>
                            <p className="text-body text-white">{discountRate.toFixed(2)}%</p>
                          </div>
                          <div>
                            <span className="text-body-sm text-cool-gray">Maturity</span>
                            <p className="text-body text-white">
                              {maturityDate.toLocaleDateString()} ({daysToMaturity} days)
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/dashboard/buyer/invoices/${invoice.id}`}>
                        <Button variant="secondary" size="sm">
                          View Details
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(invoice.id)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {isApproving ? 'Confirm...' : 'Approving...'}
                          </>
                        ) : (
                          'Approve'
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
