'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/layout';
import { Card, CardHeader, CardTitle, Button } from '@/components/ui';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@/components/wallet';
import { ExternalLink, Download, ArrowDownToLine, ArrowUpFromLine, TrendingUp, RefreshCw } from 'lucide-react';
import { formatCurrency, formatRelativeTime, truncateTxHash } from '@/lib/formatters';
import { getExplorerTxUrl } from '@/lib/contracts';
import { useChainId } from 'wagmi';
import type { TransactionType } from '@/types';

// Mock transactions
const mockTransactions = [
  {
    id: '1',
    type: 'deposit' as TransactionType,
    hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    timestamp: Date.now() / 1000 - 2 * 60 * 60,
    assetsAmount: '10000',
    sharesAmount: '9622.83',
    sharePrice: '1.0392',
    description: '+10,000 USDC → 9,622.83 sfUSDC',
  },
  {
    id: '2',
    type: 'yield_invoice' as TransactionType,
    hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    timestamp: Date.now() / 1000 - 24 * 60 * 60,
    assetsAmount: '156.20',
    invoiceId: 1842,
    description: 'Invoice #1842 repaid → +$156.20 yield',
  },
  {
    id: '3',
    type: 'yield_treasury' as TransactionType,
    hash: '0x7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456',
    timestamp: Date.now() / 1000 - 2 * 24 * 60 * 60,
    assetsAmount: '42.30',
    description: 'USYC harvest → +$42.30',
  },
  {
    id: '4',
    type: 'withdrawal' as TransactionType,
    hash: '0xdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abc',
    timestamp: Date.now() / 1000 - 4 * 24 * 60 * 60,
    assetsAmount: '5000',
    sharesAmount: '4811.42',
    sharePrice: '1.0392',
    description: '-5,000 USDC ← 4,811.42 sfUSDC burned',
  },
  {
    id: '5',
    type: 'deposit' as TransactionType,
    hash: '0x567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234',
    timestamp: Date.now() / 1000 - 17 * 24 * 60 * 60,
    assetsAmount: '50000',
    sharesAmount: '49018.21',
    sharePrice: '1.0200',
    description: '+50,000 USDC → 49,018.21 sfUSDC',
  },
];

const transactionIcons: Record<TransactionType, React.ReactNode> = {
  deposit: <ArrowDownToLine className="w-4 h-4" />,
  withdrawal: <ArrowUpFromLine className="w-4 h-4" />,
  yield_invoice: <TrendingUp className="w-4 h-4" />,
  yield_treasury: <TrendingUp className="w-4 h-4" />,
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

  const filteredTransactions = filter === 'all'
    ? mockTransactions
    : mockTransactions.filter((tx) => tx.type === filter);

  // Summary calculations
  const summary = {
    totalDeposited: 120528.20,
    totalWithdrawn: 5000.00,
    netDeposits: 115528.20,
    yieldEarned: 4892.30,
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-body-sm text-cool-gray">Filter:</span>
        {['all', 'deposit', 'withdrawal', 'yield_invoice', 'yield_treasury'].map((type) => (
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

      {/* Transaction List */}
      <Card padding="none">
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
                    {tx.sharePrice && (
                      <p className="text-caption text-silver mt-1">
                        Share price: {tx.sharePrice}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-body-sm text-cool-gray">
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

        {filteredTransactions.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-cool-gray">No transactions found</p>
          </div>
        )}
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-body-sm text-cool-gray">
          Showing 1-{filteredTransactions.length} of {filteredTransactions.length} transactions
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled>
            Previous
          </Button>
          <Button variant="secondary" size="sm" disabled>
            Next
          </Button>
        </div>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-body-sm text-cool-gray mb-1">Total Deposited</p>
            <p className="text-body font-mono text-white">
              {formatCurrency(summary.totalDeposited)}
            </p>
          </div>
          <div>
            <p className="text-body-sm text-cool-gray mb-1">Total Withdrawn</p>
            <p className="text-body font-mono text-white">
              {formatCurrency(summary.totalWithdrawn)}
            </p>
          </div>
          <div>
            <p className="text-body-sm text-cool-gray mb-1">Net Deposits</p>
            <p className="text-body font-mono text-white">
              {formatCurrency(summary.netDeposits)}
            </p>
          </div>
          <div>
            <p className="text-body-sm text-cool-gray mb-1">Yield Earned</p>
            <p className="text-body font-mono text-success">
              {formatCurrency(summary.yieldEarned)}
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-700">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export CSV
          </Button>
        </div>
      </Card>
    </div>
  );
}
