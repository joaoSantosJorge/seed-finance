'use client';

import { useState, useEffect } from 'react';
import { formatUnits, parseUnits } from 'viem';
import {
  useAllocateToStrategy,
  useWithdrawFromStrategy,
  formatStrategyValue,
  type CrossChainStrategy,
} from '@/hooks/strategies';

interface StrategyAllocationModalProps {
  strategy: CrossChainStrategy;
  mode: 'allocate' | 'withdraw';
  onClose: () => void;
}

export function StrategyAllocationModal({
  strategy,
  mode,
  onClose,
}: StrategyAllocationModalProps) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const allocate = useAllocateToStrategy();
  const withdraw = useWithdrawFromStrategy();

  const isAllocating = mode === 'allocate';
  const action = isAllocating ? allocate : withdraw;

  const maxAmount = isAllocating
    ? undefined // No max for allocation (depends on treasury balance)
    : strategy.totalValue;

  // Reset form on success
  useEffect(() => {
    if (action.isSuccess) {
      setAmount('');
      // Close modal after short delay
      setTimeout(() => {
        action.reset();
        onClose();
      }, 2000);
    }
  }, [action.isSuccess, onClose, action]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      const amountBigInt = parseUnits(amount, 6);

      // Validate max for withdrawals
      if (!isAllocating && maxAmount && amountBigInt > maxAmount) {
        setError('Amount exceeds available balance');
        return;
      }

      if (isAllocating) {
        allocate.allocate(strategy.address, amountBigInt);
      } else {
        withdraw.withdraw(strategy.address, amountBigInt);
      }
    } catch {
      setError('Invalid amount format');
    }
  };

  const handleMaxClick = () => {
    if (maxAmount) {
      setAmount(formatUnits(maxAmount, 6));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            {isAllocating ? 'Allocate to' : 'Withdraw from'} Strategy
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
            disabled={action.isPending || action.isConfirming}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Strategy Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-gray-900">{strategy.name}</h4>
          <p className="text-sm text-gray-500">
            {strategy.destinationChain} • {strategy.yieldSource}
          </p>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-gray-500">Current Value</span>
            <span className="font-medium text-gray-900">
              ${Number(formatStrategyValue(strategy.totalValue)).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount (USDC)
            </label>
            <div className="relative">
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={action.isPending || action.isConfirming}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              />
              {!isAllocating && maxAmount && maxAmount > 0n && (
                <button
                  type="button"
                  onClick={handleMaxClick}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  MAX
                </button>
              )}
            </div>
            {maxAmount && (
              <p className="mt-1 text-sm text-gray-500">
                Max: ${Number(formatUnits(maxAmount, 6)).toLocaleString()}
              </p>
            )}
          </div>

          {/* Warning for cross-chain */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-amber-800">
              <strong>Cross-Chain Notice:</strong>{' '}
              {isAllocating
                ? 'Funds will be bridged to the remote chain. This process may take 15-30 minutes to complete.'
                : 'Withdrawal request will be sent to the remote chain. Funds will return after bridge completion.'}
            </p>
          </div>

          {/* Error */}
          {(error || action.error) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-800">
                {error || (action.error as Error)?.message || 'Transaction failed'}
              </p>
            </div>
          )}

          {/* Success */}
          {action.isSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-800">
                {isAllocating ? 'Allocation' : 'Withdrawal'} initiated successfully!
                Transaction hash: {action.hash?.slice(0, 10)}...
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={action.isPending || action.isConfirming}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={action.isPending || action.isConfirming || !amount}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              {action.isPending || action.isConfirming ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  {action.isPending ? 'Confirming...' : 'Processing...'}
                </span>
              ) : (
                isAllocating ? 'Allocate' : 'Withdraw'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
