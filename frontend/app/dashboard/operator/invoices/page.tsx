'use client';

import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { InvoiceTable, BatchFundModal } from '@/components/operator';
import { useAllInvoices, useApprovedInvoices, useOverdueInvoices } from '@/hooks/operator';
import { InvoiceStatus, type Invoice } from '@/hooks/invoice/useInvoice';
import { Banknote, RefreshCw } from 'lucide-react';

type FilterTab = 'all' | 'pending' | 'approved' | 'funded' | 'paid' | 'overdue';

export default function OperatorInvoicesPage() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') as FilterTab | null;

  const [activeTab, setActiveTab] = useState<FilterTab>(initialStatus || 'all');
  const [selectedInvoices, setSelectedInvoices] = useState<Invoice[]>([]);
  const [showBatchFund, setShowBatchFund] = useState(false);

  // Get appropriate status filter
  const statusFilter = useMemo(() => {
    switch (activeTab) {
      case 'pending':
        return InvoiceStatus.Pending;
      case 'approved':
        return InvoiceStatus.Approved;
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
  const { count: approvedCount } = useApprovedInvoices();

  const handleSelectInvoices = (invoices: Invoice[]) => {
    setSelectedInvoices(invoices);
  };

  const handleBatchFund = () => {
    if (selectedInvoices.length > 0) {
      setShowBatchFund(true);
    }
  };

  const handleBatchSuccess = () => {
    setShowBatchFund(false);
    setSelectedInvoices([]);
    refetch();
  };

  const approvedSelected = selectedInvoices.filter(
    (inv) => inv.status === InvoiceStatus.Approved
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-h2 text-white">Invoice Management</h2>
          <p className="text-body text-cool-gray">
            View, fund, and manage all invoices in the system.
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
            variant="primary"
            onClick={handleBatchFund}
            disabled={approvedSelected === 0}
            leftIcon={<Banknote className="w-4 h-4" />}
          >
            Fund Selected ({approvedSelected})
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">
            Approved {approvedCount > 0 && `(${approvedCount})`}
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
        selectable={activeTab === 'approved' || activeTab === 'all'}
        onSelectInvoices={handleSelectInvoices}
      />

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
