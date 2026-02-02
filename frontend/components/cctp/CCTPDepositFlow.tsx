'use client';

/**
 * CCTPDepositFlow Component
 *
 * Multi-step component for depositing USDC via CCTP (Circle Cross-Chain Transfer Protocol).
 * Guides users through the complete flow:
 * 1. Select source chain
 * 2. Enter amount
 * 3. Approve USDC spending
 * 4. Burn USDC on source chain
 * 5. Wait for Circle attestation
 * 6. Receive SEED shares on Base
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { formatUnits, parseUnits, Address, Hex } from 'viem';
import {
  useCCTPDeposit,
  useSupportedCCTPChains,
  CCTP_CHAINS,
} from '@/hooks/cctp';
import { useCCTPAttestation, useAttestationTimer } from '@/hooks/cctp/useCCTPAttestation';

// ============ Types ============

interface CCTPDepositFlowProps {
  onSuccess?: (txHash: Hex, shares: bigint) => void;
  onError?: (error: Error) => void;
  cctpReceiverAddress?: Address;
}

type FlowStep =
  | 'select-chain'
  | 'enter-amount'
  | 'approve'
  | 'burn'
  | 'attestation'
  | 'complete'
  | 'error';

interface ChainOption {
  chainId: number;
  name: string;
  icon?: string;
}

// ============ Chain Options ============

const CHAIN_OPTIONS: ChainOption[] = [
  { chainId: 1, name: 'Ethereum' },
  { chainId: 42161, name: 'Arbitrum' },
  { chainId: 137, name: 'Polygon' },
  { chainId: 10, name: 'Optimism' },
  { chainId: 43114, name: 'Avalanche' },
  // Testnets
  { chainId: 11155111, name: 'Ethereum Sepolia' },
];

// ============ Component ============

export function CCTPDepositFlow({
  onSuccess,
  onError,
  cctpReceiverAddress,
}: CCTPDepositFlowProps) {
  // Wallet state
  const { address, isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  // Flow state
  const [step, setStep] = useState<FlowStep>('select-chain');
  const [selectedChain, setSelectedChain] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const [burnTxHash, setBurnTxHash] = useState<Hex | null>(null);
  const [messageHash, setMessageHash] = useState<Hex | null>(null);
  const [attestationStartTime, setAttestationStartTime] = useState<Date | null>(null);

  // CCTP hooks
  const {
    state: depositState,
    allowance,
    balance,
    config,
    approve,
    burn,
    needsApproval,
    reset: resetDeposit,
    refetchAllowance,
    refetchBalance,
  } = useCCTPDeposit(selectedChain || 1);

  const {
    attestation,
    isPolling,
    startPolling,
    stopPolling,
    reset: resetAttestation,
  } = useCCTPAttestation({ useSandbox: true });

  const { remainingFormatted, progress } = useAttestationTimer(attestationStartTime || undefined);

  // Parsed amount
  const parsedAmount = amount ? parseUnits(amount, 6) : 0n;

  // ============ Chain Selection ============

  const handleChainSelect = useCallback(async (chainId: number) => {
    setSelectedChain(chainId);

    // Switch network if needed
    if (currentChainId !== chainId) {
      try {
        await switchChainAsync({ chainId });
      } catch (err) {
        console.error('Failed to switch chain:', err);
      }
    }

    setStep('enter-amount');
    refetchBalance();
    refetchAllowance();
  }, [currentChainId, switchChainAsync, refetchBalance, refetchAllowance]);

  // ============ Amount Input ============

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers and decimals
    if (/^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  }, []);

  const handleMaxClick = useCallback(() => {
    if (balance) {
      setAmount(formatUnits(balance, 6));
    }
  }, [balance]);

  // ============ Approval ============

  const handleApprove = useCallback(async () => {
    if (!parsedAmount) return;

    setStep('approve');
    setError(null);

    try {
      await approve(parsedAmount);
      setStep('enter-amount');
      refetchAllowance();
    } catch (err) {
      setError(err as Error);
      setStep('error');
      onError?.(err as Error);
    }
  }, [parsedAmount, approve, refetchAllowance, onError]);

  // ============ Burn ============

  const handleBurn = useCallback(async () => {
    if (!parsedAmount || !address || !cctpReceiverAddress) return;

    setStep('burn');
    setError(null);

    try {
      const txHash = await burn({
        amount: parsedAmount,
        recipient: cctpReceiverAddress,
      });

      setBurnTxHash(txHash);
      setStep('attestation');
      setAttestationStartTime(new Date());

      // Calculate message hash from transaction (simplified - in production, extract from receipt)
      // For now, we'll use a placeholder that the user would get from the transaction receipt
      // The actual message hash would be extracted from the MessageSent event

    } catch (err) {
      setError(err as Error);
      setStep('error');
      onError?.(err as Error);
    }
  }, [parsedAmount, address, cctpReceiverAddress, burn, onError]);

  // ============ Continue to Burn (after approval) ============

  const handleContinue = useCallback(async () => {
    if (!parsedAmount) return;

    if (needsApproval(parsedAmount)) {
      await handleApprove();
    } else {
      await handleBurn();
    }
  }, [parsedAmount, needsApproval, handleApprove, handleBurn]);

  // ============ Check Attestation ============

  const handleCheckAttestation = useCallback(async (hash: Hex) => {
    setMessageHash(hash);
    startPolling(hash);
  }, [startPolling]);

  // ============ Reset Flow ============

  const handleReset = useCallback(() => {
    setStep('select-chain');
    setSelectedChain(null);
    setAmount('');
    setError(null);
    setBurnTxHash(null);
    setMessageHash(null);
    setAttestationStartTime(null);
    resetDeposit();
    resetAttestation();
  }, [resetDeposit, resetAttestation]);

  // ============ Monitor Attestation ============

  useEffect(() => {
    if (attestation.status === 'complete') {
      setStep('complete');
      stopPolling();
      // In production, auto-claim or notify user
    }
  }, [attestation.status, stopPolling]);

  // ============ Render ============

  if (!isConnected) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-600 dark:text-gray-400">
          Please connect your wallet to continue
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-6">
        <StepIndicator
          steps={['Chain', 'Amount', 'Transfer', 'Confirm']}
          currentStep={getStepIndex(step)}
        />
      </div>

      {/* Step 1: Select Chain */}
      {step === 'select-chain' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Select Source Chain</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Choose the chain where your USDC is located
          </p>
          <div className="grid grid-cols-2 gap-3">
            {CHAIN_OPTIONS.map((chain) => (
              <button
                key={chain.chainId}
                onClick={() => handleChainSelect(chain.chainId)}
                className={`p-4 border rounded-lg text-left hover:border-blue-500 transition-colors ${
                  selectedChain === chain.chainId
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <span className="font-medium">{chain.name}</span>
                {CCTP_CHAINS[chain.chainId] && (
                  <span className="ml-2 text-xs text-green-600">CCTP</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Enter Amount */}
      {step === 'enter-amount' && selectedChain && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Enter Amount</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Amount</span>
              <span className="text-gray-600 dark:text-gray-400">
                Balance: {balance ? formatUnits(balance, 6) : '0'} USDC
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0.00"
                className="w-full p-4 pr-20 border rounded-lg text-lg font-mono bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              />
              <button
                onClick={handleMaxClick}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-blue-600 hover:text-blue-700"
              >
                MAX
              </button>
            </div>
            {parsedAmount > 0n && balance && parsedAmount > balance && (
              <p className="text-sm text-red-600">Insufficient balance</p>
            )}
          </div>

          {/* Approval status */}
          {parsedAmount > 0n && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
              {needsApproval(parsedAmount) ? (
                <span className="text-amber-600">
                  Approval required for {formatUnits(parsedAmount, 6)} USDC
                </span>
              ) : (
                <span className="text-green-600">
                  USDC approved for transfer
                </span>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep('select-chain')}
              className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Back
            </button>
            <button
              onClick={handleContinue}
              disabled={!parsedAmount || (balance && parsedAmount > balance)}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {needsApproval(parsedAmount) ? 'Approve & Transfer' : 'Transfer'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Approval in progress */}
      {step === 'approve' && (
        <div className="space-y-4 text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <h3 className="text-lg font-semibold">Approving USDC...</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Please confirm the transaction in your wallet
          </p>
        </div>
      )}

      {/* Step 4: Burn in progress */}
      {step === 'burn' && (
        <div className="space-y-4 text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <h3 className="text-lg font-semibold">Initiating Transfer...</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Burning USDC on source chain. Please confirm in your wallet.
          </p>
        </div>
      )}

      {/* Step 5: Waiting for attestation */}
      {step === 'attestation' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-center">Waiting for Attestation</h3>

          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="animate-pulse w-3 h-3 bg-amber-500 rounded-full" />
              <span className="font-medium text-amber-700 dark:text-amber-400">
                Processing Cross-Chain Transfer
              </span>
            </div>
            <p className="text-sm text-amber-600 dark:text-amber-300">
              Circle is verifying your burn transaction. This typically takes 13-19 minutes.
            </p>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>~{remainingFormatted} remaining</span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {burnTxHash && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Transaction Hash</p>
              <code className="text-xs break-all">{burnTxHash}</code>
            </div>
          )}

          {/* Manual attestation check */}
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Have the message hash from the transaction receipt?
            </p>
            <input
              type="text"
              placeholder="Enter message hash (0x...)"
              className="w-full p-2 text-sm border rounded mb-2 bg-white dark:bg-gray-800"
              onChange={(e) => {
                if (e.target.value.startsWith('0x') && e.target.value.length === 66) {
                  handleCheckAttestation(e.target.value as Hex);
                }
              }}
            />
            {isPolling && (
              <p className="text-xs text-blue-600">Checking attestation status...</p>
            )}
          </div>

          <button
            onClick={handleReset}
            className="w-full py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel and start over
          </button>
        </div>
      )}

      {/* Step 6: Complete */}
      {step === 'complete' && (
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-green-600">Transfer Complete!</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Your USDC has been transferred via CCTP. SEED shares will be minted to your wallet.
          </p>
          <button
            onClick={handleReset}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Make Another Deposit
          </button>
        </div>
      )}

      {/* Error state */}
      {step === 'error' && error && (
        <div className="space-y-4">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">
              Transaction Failed
            </h3>
            <p className="text-sm text-red-600 dark:text-red-300">{error.message}</p>
          </div>
          <button
            onClick={handleReset}
            className="w-full py-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

// ============ Helper Components ============

function StepIndicator({
  steps,
  currentStep,
}: {
  steps: string[];
  currentStep: number;
}) {
  return (
    <div className="flex items-center w-full">
      {steps.map((label, index) => (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                index <= currentStep
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
              }`}
            >
              {index < currentStep ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                index + 1
              )}
            </div>
            <span className="text-xs mt-1 text-gray-600 dark:text-gray-400">
              {label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-2 ${
                index < currentStep ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function getStepIndex(step: FlowStep): number {
  switch (step) {
    case 'select-chain':
      return 0;
    case 'enter-amount':
    case 'approve':
      return 1;
    case 'burn':
    case 'attestation':
      return 2;
    case 'complete':
      return 3;
    default:
      return 0;
  }
}

export default CCTPDepositFlow;
