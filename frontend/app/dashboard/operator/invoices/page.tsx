'use client';

import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { InvoiceTable, BatchFundModal, BatchApproveModal } from '@/components/operator';
import { useAllInvoices, useAwaitingFundingApproval, useReadyForFunding, useOverdueInvoices } from '@/hooks/operator';
import { InvoiceStatus, type Invoice } from '@/hooks/invoice/useInvoice';
import { Banknote, RefreshCw, CheckCircle } from 'lucide-react';

type FilterTab = 'all' | 'pending' | 'awaiting-approval' | 'ready-to-fund' | 'funded' | 'paid' | 'overdue';

export default function OperatorInvoicesPage() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') as FilterTab | null;

  const [activeTab, setActiveTab] = useState<FilterTab>(initialStatus || 'all');
  const [selectedInvoices, setSelectedInvoices] = useState<Invoice[]>([]);
  const [showBatchFund, setShowBatchFund] = useState(false);
  const [showBatchApprove, setShowBatchApprove] = useState(false);

  // Get appropriate status filter
  const statusFilter = useMemo(() => {
    switch (activeTab) {
      case 'pending':
        return InvoiceStatus.Pending;
      case 'awaiting-approval':
        return InvoiceStatus.Approved;
      case 'ready-to-fund':
        return InvoiceStatus.FundingApproved;
      case 'funded':
        return InvoiceStatus.Funded;
      case 'paid':
        return InvoiceStatus.Paid;
      default:
        return undefined;
    }
  }, [activeTab]);

  const { refetch } = useAllInvoices(statusFilter);
  const { data: overdueInvoices } = useOverdueInvoices();
  const { count: awaitingApprovalCount } = useAwaitingFundingApproval();
  const { count: readyToFundCount } = useReadyForFunding();

  const handleSelectInvoices = (invoices: Invoice[]) => {
    setSelectedInvoices(invoices);
  };

  const handleBatchApprove = () => {
    if (selectedInvoices.length > 0) {
      setShowBatchApprove(true);
    }
  };

  const handleBatchFund = () => {
    if (selectedInvoices.length > 0) {
      setShowBatchFund(true);
    }
  };

  const handleBatchApproveSuccess = () => {
    setShowBatchApprove(false);
    setSelectedInvoices([]);
    refetch();
  };

  const handleBatchFundSuccess = () => {
    setShowBatchFund(false);
    setSelectedInvoices([]);
    refetch();
  };

  // Count invoices that can be approved (Approved status)
  const approveableSelected = selectedInvoices.filter(
    (inv) => inv.status === InvoiceStatus.Approved
  ).length;

  // Count invoices that can be funded (FundingApproved status)
  const fundableSelected = selectedInvoices.filter(
    (inv) => inv.status === InvoiceStatus.FundingApproved
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-h2 text-white">Invoice Management</h2>
          <p className="text-body text-cool-gray">
            View, approve, fund, and manage all invoices in the system.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => refetch()}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
          </Button>
          <Button
            variant="secondary"
            onClick={handleBatchApprove}
            disabled={approveableSelected === 0}
            leftIcon={<CheckCircle className="w-4 h-4" />}
          >
            Approve Selected ({approveableSelected})
          </Button>
          <Button
            variant="primary"
            onClick={handleBatchFund}
            disabled={fundableSelected === 0}
            leftIcon={<Banknote className="w-4 h-4" />}
          >
            Fund Selected ({fundableSelected})
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="awaiting-approval">
            Awaiting Approval {awaitingApprovalCount > 0 && `(${awaitingApprovalCount})`}
          </TabsTrigger>
          <TabsTrigger value="ready-to-fund">
            Ready to Fund {readyToFundCount > 0 && `(${readyToFundCount})`}
          </TabsTrigger>
          <TabsTrigger value="funded">Funded</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="overdue">
            Overdue {overdueInvoices.length > 0 && `(${overdueInvoices.length})`}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Invoice Table */}
      <InvoiceTable
        statusFilter={statusFilter}
        selectable={activeTab === 'awaiting-approval' || activeTab === 'ready-to-fund' || activeTab === 'all'}
        onSelectInvoices={handleSelectInvoices}
      />

      {/* Batch Approve Modal */}
      <BatchApproveModal
        isOpen={showBatchApprove}
        onClose={() => setShowBatchApprove(false)}
        invoices={selectedInvoices}
        onSuccess={handleBatchApproveSuccess}
      />

      {/* Batch Fund Modal */}
      <BatchFundModal
        isOpen={showBatchFund}
        onClose={() => setShowBatchFund(false)}
        invoices={selectedInvoices}
        onSuccess={handleBatchFundSuccess}
      />
    </div>
  );
}
