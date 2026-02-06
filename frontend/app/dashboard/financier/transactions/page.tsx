'use client';

import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/layout';
import { Card, CardHeader, CardTitle, Button, Skeleton } from '@/components/ui';
import { useAccount, useChainId } from 'wagmi';
import { ConnectButton } from '@/components/wallet';
import { ExternalLink, Download, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Clock, Wallet } from 'lucide-react';
import { formatRelativeTime, truncateTxHash, formatDate } from '@/lib/formatters';
import { getExplorerTxUrl } from '@/lib/contracts';
import { useUserTransactions } from '@/hooks/useUserTransactions';
import { useUserPosition, usePoolState } from '@/hooks';
import type { TransactionType } from '@/types';

const transactionIcons: Record<TransactionType, React.ReactNode> = {
  deposit: <ArrowDownToLine className="w-4 h-4" />,
  withdrawal: <ArrowUpFromLine className="w-4 h-4" />,
  yield_invoice: <Wallet className="w-4 h-4" />,
  yield_treasury: <Wallet className="w-4 h-4" />,
  pool_event: <RefreshCw className="w-4 h-4" />,
};

const transactionColors: Record<TransactionType, string> = {
  deposit: 'bg-success/10 text-success',
  withdrawal: 'bg-primary/10 text-primary',
  yield_invoice: 'bg-success/10 text-success',
  yield_treasury: 'bg-success/10 text-success',
  pool_event: 'bg-warning/10 text-warning',
};

const transactionLabels: Record<TransactionType, string> = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  yield_invoice: 'Yield Accrued',
  yield_treasury: 'Treasury Yield',
  pool_event: 'Pool Event',
};

export default function TransactionsPage() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const [filter, setFilter] = useState<TransactionType | 'all'>('all');

  // Fetch real transaction data from contract events
  const { transactions, isLoading, error, refetch, summary } = useUserTransactions();
  const { formattedPosition } = useUserPosition();
  usePoolState();

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    if (filter === 'all') return transactions;
    return transactions.filter((tx) => tx.type === filter);
  }, [transactions, filter]);

  // Calculate yield earned (from user position)
  const yieldEarned = useMemo(() => {
    if (!formattedPosition) return '$0.00';
    return formattedPosition.unrealizedGain;
  }, [formattedPosition]);

  // Export to CSV
  const handleExportCSV = () => {
    if (transactions.length === 0) return;

    const headers = ['Date', 'Type', 'Amount (USDC)', 'Shares (SEED)', 'Transaction Hash'];
    const rows = transactions.map((tx) => [
      formatDate(tx.timestamp),
      transactionLabels[tx.type],
      tx.assetsFormatted,
      tx.sharesFormatted,
      tx.hash,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `seed-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title="Transaction History"
          description="View all your deposits, withdrawals, and yield events"
          backHref="/dashboard/financier"
        />
        <Card className="text-center py-12">
          <p className="text-cool-gray mb-4">Connect your wallet to view transactions</p>
          <ConnectButton />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transaction History"
        description="View all your deposits, withdrawals, and yield events"
        backHref="/dashboard/financier"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownToLine className="w-4 h-4 text-success" />
            <span className="text-body-sm text-cool-gray">Total Deposited</span>
          </div>
          <p className="text-lg font-mono text-white">
            {isLoading ? <Skeleton className="h-6 w-20" /> : summary.totalDepositedFormatted}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpFromLine className="w-4 h-4 text-primary" />
            <span className="text-body-sm text-cool-gray">Total Withdrawn</span>
          </div>
          <p className="text-lg font-mono text-white">
            {isLoading ? <Skeleton className="h-6 w-20" /> : summary.totalWithdrawnFormatted}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-white" />
            <span className="text-body-sm text-cool-gray">Net Deposits</span>
          </div>
          <p className="text-lg font-mono text-white">
            {isLoading ? <Skeleton className="h-6 w-20" /> : summary.netDepositsFormatted}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-success" />
            <span className="text-body-sm text-cool-gray">Yield Earned</span>
          </div>
          <p className="text-lg font-mono text-success">
            {isLoading ? <Skeleton className="h-6 w-20" /> : yieldEarned}
          </p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body-sm text-cool-gray">Filter:</span>
          {['all', 'deposit', 'withdrawal'].map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type as TransactionType | 'all')}
              className={`px-3 py-1.5 text-body-sm font-medium rounded-md transition-colors ${
                filter === type
                  ? 'bg-primary text-white'
                  : 'bg-slate-700 text-cool-gray hover:text-white'
              }`}
            >
              {type === 'all' ? 'All Types' : transactionLabels[type as TransactionType]}
            </button>
          ))}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={refetch}
          leftIcon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
        >
          Refresh
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <Card className="p-4 border-error/50 bg-error/10">
          <p className="text-error text-body-sm">{error}</p>
        </Card>
      )}

      {/* Transaction List */}
      <Card padding="none">
        {isLoading ? (
          <div className="divide-y divide-slate-700">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="w-8 h-8 rounded-lg" />
                    <div>
                      <Skeleton className="h-5 w-24 mb-1" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-4 w-20 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className="p-4 hover:bg-slate-700/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${transactionColors[tx.type]}`}
                    >
                      {transactionIcons[tx.type]}
                    </div>
                    <div>
                      <p className="text-body font-medium text-white">
                        {transactionLabels[tx.type]}
                      </p>
                      <p className="text-body-sm text-cool-gray mt-0.5">
                        {tx.description}
                      </p>
                      <p className="text-caption text-silver mt-1">
                        {formatDate(tx.timestamp)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-body font-mono ${tx.type === 'deposit' ? 'text-success' : 'text-primary'}`}>
                      {tx.type === 'deposit' ? '+' : '-'}{tx.assetsFormatted}
                    </p>
                    <p className="text-body-sm text-cool-gray mt-0.5">
                      {formatRelativeTime(tx.timestamp)}
                    </p>
                    <a
                      href={getExplorerTxUrl(chainId, tx.hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-caption text-primary hover:underline mt-1"
                    >
                      {truncateTxHash(tx.hash)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && filteredTransactions.length === 0 && (
          <div className="p-12 text-center">
            <Clock className="w-8 h-8 text-cool-gray mx-auto mb-3" />
            <p className="text-cool-gray mb-1">No transactions found</p>
            <p className="text-body-sm text-silver">
              {transactions.length === 0
                ? 'Your deposit and withdrawal history will appear here'
                : 'No transactions match the selected filter'}
            </p>
          </div>
        )}
      </Card>

      {/* Pagination Info */}
      {!isLoading && transactions.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-body-sm text-cool-gray">
            Showing {filteredTransactions.length} of {transactions.length} transactions
          </p>
          <p className="text-body-sm text-silver">
            Last 30 days from blockchain events
          </p>
        </div>
      )}

      {/* Export Section */}
      {!isLoading && transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Export Data</CardTitle>
          </CardHeader>
          <div className="flex items-center justify-between">
            <p className="text-body-sm text-cool-gray">
              Download your transaction history as a CSV file for record keeping
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCSV}
              leftIcon={<Download className="w-4 h-4" />}
            >
              Export CSV
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
