'use client';

import { useState } from 'react';
import { formatUnits } from 'viem';
import { useCrossChainStrategies, formatLastUpdate } from '@/hooks/strategies';

interface PendingTransfer {
  id: string;
  type: 'deposit' | 'withdrawal';
  strategy: string;
  destinationChain: string;
  amount: bigint;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'completed';
}

// Note: In production, this would come from event indexing or a backend service
// For now, we derive pending transfers from strategy state

export function PendingTransfers() {
  const { strategies, isLoading } = useCrossChainStrategies();
  const [expandedTransfers, setExpandedTransfers] = useState<Set<string>>(new Set());

  // Derive pending transfers from strategies
  const pendingTransfers: PendingTransfer[] = strategies.flatMap((strategy, idx) => {
    const transfers: PendingTransfer[] = [];

    if (strategy.pendingDeposits > 0n) {
      transfers.push({
        id: `${strategy.address}-deposit-${idx}`,
        type: 'deposit',
        strategy: strategy.name,
        destinationChain: strategy.destinationChain,
        amount: strategy.pendingDeposits,
        timestamp: strategy.lastValueUpdate, // Approximate
        status: 'pending',
      });
    }

    if (strategy.pendingWithdrawals > 0n) {
      transfers.push({
        id: `${strategy.address}-withdrawal-${idx}`,
        type: 'withdrawal',
        strategy: strategy.name,
        destinationChain: strategy.destinationChain,
        amount: strategy.pendingWithdrawals,
        timestamp: strategy.lastValueUpdate,
        status: 'pending',
      });
    }

    return transfers;
  });

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedTransfers);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedTransfers(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (pendingTransfers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Pending Transfers</h2>
        <div className="text-center py-8 text-gray-500">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p>No pending cross-chain transfers</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Pending Transfers</h2>
        <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
          {pendingTransfers.length} pending
        </span>
      </div>

      <div className="space-y-3">
        {pendingTransfers.map((transfer) => (
          <div
            key={transfer.id}
            className="border border-gray-200 rounded-lg overflow-hidden"
          >
            <button
              onClick={() => toggleExpand(transfer.id)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    transfer.type === 'deposit'
                      ? 'bg-green-100 text-green-600'
                      : 'bg-blue-100 text-blue-600'
                  }`}
                >
                  {transfer.type === 'deposit' ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 11l5-5m0 0l5 5m-5-5v12"
                      />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 13l-5 5m0 0l-5-5m5 5V6"
                      />
                    </svg>
                  )}
                </div>

                {/* Info */}
                <div className="text-left">
                  <p className="font-medium text-gray-900">
                    {transfer.type === 'deposit' ? 'Deposit to' : 'Withdrawal from'}{' '}
                    {transfer.strategy}
                  </p>
                  <p className="text-sm text-gray-500">
                    {transfer.destinationChain} • {formatLastUpdate(transfer.timestamp)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="font-semibold text-gray-900">
                  ${Number(formatUnits(transfer.amount, 6)).toLocaleString()}
                </span>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    transfer.status === 'pending'
                      ? 'bg-amber-100 text-amber-800'
                      : transfer.status === 'confirmed'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  {transfer.status}
                </span>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    expandedTransfers.has(transfer.id) ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Expanded Details */}
            {expandedTransfers.has(transfer.id) && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Transfer Type:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      {transfer.type === 'deposit' ? 'Cross-Chain Deposit' : 'Cross-Chain Withdrawal'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>
                    <span className="ml-2 font-medium text-gray-900 capitalize">{transfer.status}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Bridge:</span>
                    <span className="ml-2 font-medium text-gray-900">CCTP</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Est. Time:</span>
                    <span className="ml-2 font-medium text-gray-900">15-20 min</span>
                  </div>
                </div>

                {/* Progress Indicator */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">Progress</span>
                    <span className="text-sm text-gray-500">
                      {transfer.status === 'pending'
                        ? 'Awaiting bridge confirmation'
                        : transfer.status === 'confirmed'
                        ? 'Bridge confirmed, deploying funds'
                        : 'Complete'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        transfer.status === 'pending'
                          ? 'w-1/3 bg-amber-500'
                          : transfer.status === 'confirmed'
                          ? 'w-2/3 bg-blue-500'
                          : 'w-full bg-green-500'
                      }`}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
