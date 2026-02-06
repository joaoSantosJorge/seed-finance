'use client';

import { useState } from 'react';
import { formatUnits } from 'viem';
import {
  useCrossChainStrategies,
  formatStrategyValue,
  formatAPY,
  formatLastUpdate,
  type CrossChainStrategy,
} from '@/hooks/strategies';
import { StrategyAllocationModal } from './StrategyAllocationModal';

// ============ Strategy Card ============

interface StrategyCardProps {
  strategy: CrossChainStrategy;
  onAllocate: () => void;
  onWithdraw: () => void;
}

function StrategyCard({ strategy, onAllocate, onWithdraw }: StrategyCardProps) {
  const statusColor = strategy.isActive
    ? 'bg-green-100 text-green-800'
    : 'bg-gray-100 text-gray-800';

  const staleColor = strategy.isValueStale
    ? 'text-amber-600'
    : 'text-gray-500';

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{strategy.name}</h3>
          <p className="text-sm text-gray-500">
            {strategy.destinationChain} → {strategy.yieldSource}
          </p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
          {strategy.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-500">Total Value</p>
          <p className="text-xl font-bold text-gray-900">
            ${Number(formatStrategyValue(strategy.totalValue)).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Est. APY</p>
          <p className="text-xl font-bold text-green-600">
            {formatAPY(strategy.estimatedAPY)}
          </p>
        </div>
      </div>

      {/* Pending Transfers */}
      {(strategy.pendingDeposits > 0n || strategy.pendingWithdrawals > 0n) && (
        <div className="bg-blue-50 rounded-md p-3 mb-4">
          <p className="text-sm font-medium text-blue-800 mb-1">Pending Transfers</p>
          <div className="flex justify-between text-sm text-blue-600">
            <span>
              Deposits: ${Number(formatStrategyValue(strategy.pendingDeposits)).toLocaleString()}
            </span>
            <span>
              Withdrawals: ${Number(formatStrategyValue(strategy.pendingWithdrawals)).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Last Update */}
      <div className="flex justify-between items-center text-sm mb-4">
        <span className="text-gray-500">Last Value Update</span>
        <span className={staleColor}>
          {formatLastUpdate(strategy.lastValueUpdate)}
          {strategy.isValueStale && ' (Stale)'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onAllocate}
          disabled={!strategy.isActive}
          className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
        >
          Allocate
        </button>
        <button
          onClick={onWithdraw}
          disabled={strategy.totalValue === 0n}
          className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm font-medium"
        >
          Withdraw
        </button>
      </div>
    </div>
  );
}

// ============ Main Component ============

export function CrossChainStrategies() {
  const {
    strategies,
    totalValue,
    totalPendingDeposits,
    totalPendingWithdrawals,
    weightedAPY,
    isLoading,
    error,
  } = useCrossChainStrategies();

  const [selectedStrategy, setSelectedStrategy] = useState<CrossChainStrategy | null>(null);
  const [modalMode, setModalMode] = useState<'allocate' | 'withdraw' | null>(null);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-48 bg-gray-200 rounded"></div>
            <div className="h-48 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error loading strategies: {error.message}</p>
      </div>
    );
  }

  if (strategies.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Cross-Chain Strategies</h2>
        <div className="text-center py-8 text-gray-500">
          <p>No cross-chain strategies configured.</p>
          <p className="text-sm mt-2">
            Set NEXT_PUBLIC_ARC_USYC_STRATEGY_ADDRESS
            environment variables.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Cross-Chain Strategies</h2>
        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="text-gray-500">Total Value: </span>
            <span className="font-semibold text-gray-900">
              ${Number(formatUnits(totalValue, 6)).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Avg APY: </span>
            <span className="font-semibold text-green-600">{weightedAPY.toFixed(2)}%</span>
          </div>
        </div>
      </div>

      {/* Pending Transfers Summary */}
      {(totalPendingDeposits > 0n || totalPendingWithdrawals > 0n) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-amber-800 mb-2">In-Flight Transfers</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-amber-700">Pending Deposits:</span>
              <span className="font-semibold text-amber-900 ml-2">
                ${Number(formatUnits(totalPendingDeposits, 6)).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-amber-700">Pending Withdrawals:</span>
              <span className="font-semibold text-amber-900 ml-2">
                ${Number(formatUnits(totalPendingWithdrawals, 6)).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Strategy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {strategies.map((strategy) => (
          <StrategyCard
            key={strategy.address}
            strategy={strategy}
            onAllocate={() => {
              setSelectedStrategy(strategy);
              setModalMode('allocate');
            }}
            onWithdraw={() => {
              setSelectedStrategy(strategy);
              setModalMode('withdraw');
            }}
          />
        ))}
      </div>

      {/* Modal */}
      {selectedStrategy && modalMode && (
        <StrategyAllocationModal
          strategy={selectedStrategy}
          mode={modalMode}
          onClose={() => {
            setSelectedStrategy(null);
            setModalMode(null);
          }}
        />
      )}
    </div>
  );
}
