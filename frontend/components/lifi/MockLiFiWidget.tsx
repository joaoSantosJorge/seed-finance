'use client';

import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardHeader, CardTitle, Skeleton } from '@/components/ui';
import { AmountInput } from '@/components/forms/AmountInput';
import { TransactionButton } from '@/components/wallet';
import { useMockLiFi } from '@/hooks/lifi/useMockLiFi';
import { formatCurrency } from '@/lib/formatters';
import { ArrowDown, RefreshCw, Clock, AlertCircle, Check, Wallet } from 'lucide-react';

// Mock supported chains for UI
const MOCK_CHAINS = [
  { id: 1, name: 'Ethereum', icon: '⟠', color: '#627EEA' },
  { id: 10, name: 'Optimism', icon: '🔴', color: '#FF0420' },
  { id: 137, name: 'Polygon', icon: '🟣', color: '#8247E5' },
  { id: 42161, name: 'Arbitrum', icon: '🔵', color: '#28A0F0' },
  { id: 8453, name: 'Base', icon: '🔷', color: '#0052FF' },
];

// Mock tokens for UI
const MOCK_TOKENS = [
  { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  { symbol: 'USDT', name: 'Tether', decimals: 6 },
  { symbol: 'ETH', name: 'Ethereum', decimals: 18 },
  { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
  { symbol: 'DAI', name: 'Dai', decimals: 18 },
];

interface MockLiFiWidgetProps {
  onSuccess?: (hash: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Mock LI.FI Widget for Testnet Development
 *
 * Simulates the LI.FI widget UI and functionality for testing on Base Sepolia
 * where real bridges aren't available. Uses mock quotes and simulates
 * cross-chain deposits via the MockLiFiExecutor contract.
 */
export function MockLiFiWidget({ onSuccess, onError }: MockLiFiWidgetProps) {
  const { address, isConnected } = useAccount();

  // Form state
  const [sourceChain, setSourceChain] = useState(MOCK_CHAINS[0]);
  const [sourceToken, setSourceToken] = useState(MOCK_TOKENS[0]);
  const [amount, setAmount] = useState('');
  const [rawAmount, setRawAmount] = useState(0n);

  // Mock LI.FI hook
  const {
    quote,
    isLoadingQuote,
    executeDeposit,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  } = useMockLiFi({
    sourceChain: sourceChain.id,
    sourceToken: sourceToken.symbol,
    amount: rawAmount,
    onSuccess,
    onError,
  });

  const handleAmountChange = useCallback((value: string, raw: bigint) => {
    setAmount(value);
    setRawAmount(raw);
  }, []);

  const handleChainSelect = useCallback((chain: typeof MOCK_CHAINS[0]) => {
    setSourceChain(chain);
  }, []);

  const handleTokenSelect = useCallback((token: typeof MOCK_TOKENS[0]) => {
    setSourceToken(token);
  }, []);

  const handleExecute = useCallback(() => {
    if (!address || rawAmount === 0n) return;
    executeDeposit(address);
  }, [address, rawAmount, executeDeposit]);

  if (!isConnected) {
    return (
      <Card className="text-center py-12">
        <Wallet className="w-12 h-12 mx-auto text-cool-gray mb-4" />
        <p className="text-body text-cool-gray">
          Connect your wallet to use cross-chain deposits
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mock Mode Banner */}
      <Card className="border-warning/30 bg-warning/5">
        <div className="flex items-start gap-3 p-4">
          <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-body text-warning font-medium">
              Testnet Mock Mode
            </p>
            <p className="text-body-sm text-warning/80">
              This is a simulated cross-chain widget for testing. Real bridging is
              not available on testnet. Deposits use mock USDC directly.
            </p>
          </div>
        </div>
      </Card>

      {/* Source Selection */}
      <Card>
        <CardHeader>
          <CardTitle>From</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          {/* Chain Selector */}
          <div>
            <label className="text-body-sm text-cool-gray mb-2 block">
              Source Chain
            </label>
            <div className="flex gap-2 flex-wrap">
              {MOCK_CHAINS.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => handleChainSelect(chain)}
                  className={`px-3 py-2 rounded-lg border text-body-sm transition-colors ${
                    sourceChain.id === chain.id
                      ? 'border-primary bg-primary/10 text-white'
                      : 'border-slate-700 text-cool-gray hover:border-slate-600'
                  }`}
                >
                  <span className="mr-1">{chain.icon}</span>
                  {chain.name}
                </button>
              ))}
            </div>
          </div>

          {/* Token Selector */}
          <div>
            <label className="text-body-sm text-cool-gray mb-2 block">
              Source Token
            </label>
            <div className="flex gap-2 flex-wrap">
              {MOCK_TOKENS.map((token) => (
                <button
                  key={token.symbol}
                  onClick={() => handleTokenSelect(token)}
                  className={`px-3 py-2 rounded-lg border text-body-sm transition-colors ${
                    sourceToken.symbol === token.symbol
                      ? 'border-primary bg-primary/10 text-white'
                      : 'border-slate-700 text-cool-gray hover:border-slate-600'
                  }`}
                >
                  {token.symbol}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="text-body-sm text-cool-gray mb-2 block">
              Amount
            </label>
            <AmountInput
              value={amount}
              onChange={handleAmountChange}
              rightElement={sourceToken.symbol}
              placeholder="0.00"
              disabled={isPending || isConfirming}
            />
          </div>
        </div>
      </Card>

      {/* Arrow */}
      <div className="flex justify-center">
        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
          <ArrowDown className="w-5 h-5 text-cool-gray" />
        </div>
      </div>

      {/* Destination (Locked) */}
      <Card>
        <CardHeader>
          <CardTitle>To (Auto-Deposit)</CardTitle>
        </CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#0052FF] flex items-center justify-center text-white text-sm">
              🔷
            </div>
            <div>
              <p className="text-body text-white">Base</p>
              <p className="text-body-sm text-cool-gray">USDC → SEED (auto)</p>
            </div>
          </div>
          <div className="text-right">
            {isLoadingQuote ? (
              <Skeleton className="h-6 w-24" />
            ) : quote ? (
              <>
                <p className="text-body text-white font-mono">
                  {formatCurrency(quote.outputAmount)}
                </p>
                <p className="text-body-sm text-cool-gray">
                  ~{quote.estimatedShares} SEED
                </p>
              </>
            ) : (
              <p className="text-body-sm text-cool-gray">Enter amount</p>
            )}
          </div>
        </div>
      </Card>

      {/* Quote Details */}
      {quote && rawAmount > 0n && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Route Details</span>
              <button
                className="text-body-sm text-primary flex items-center gap-1 hover:underline"
                onClick={() => {}}
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
            </CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-body-sm text-cool-gray">Bridge</span>
              <span className="text-body-sm text-white">{quote.bridge}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-body-sm text-cool-gray">Est. Time</span>
              <span className="text-body-sm text-white flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {quote.estimatedTime}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-body-sm text-cool-gray">Gas Cost</span>
              <span className="text-body-sm text-white">{quote.gasCost}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-body-sm text-cool-gray">Bridge Fee</span>
              <span className="text-body-sm text-white">{quote.bridgeFee}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-700">
              <span className="text-body text-cool-gray">You Receive</span>
              <span className="text-body text-success font-medium">
                {formatCurrency(quote.outputAmount)} USDC
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Success Message */}
      {isSuccess && (
        <Card className="border-success/30 bg-success/5">
          <div className="flex items-center gap-3 p-4">
            <div className="w-8 h-8 rounded-full bg-success flex items-center justify-center">
              <Check className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-body text-success font-medium">Deposit Successful!</p>
              <p className="text-body-sm text-success/80">
                Your USDC has been deposited and you&apos;ve received SEED shares.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Action Button */}
      <TransactionButton
        onClick={handleExecute}
        isPending={isPending}
        isConfirming={isConfirming}
        isSuccess={isSuccess}
        hash={hash}
        disabled={rawAmount === 0n || !quote}
        pendingText="Confirm in wallet..."
        confirmingText="Processing..."
        successText="Deposit Complete!"
        className="w-full"
      >
        {rawAmount === 0n ? 'Enter amount' : 'Deposit (Mock)'}
      </TransactionButton>

      {error && (
        <p className="text-body-sm text-error text-center">{error.message}</p>
      )}
    </div>
  );
}
