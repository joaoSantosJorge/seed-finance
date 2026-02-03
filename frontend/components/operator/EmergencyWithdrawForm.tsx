'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ConfirmActionModal } from './ConfirmActionModal';
import { useEmergencyWithdraw } from '@/hooks/operator/usePoolAdmin';
import { useOperatorRole } from '@/hooks/operator';
import { usePoolState } from '@/hooks';
import { getContractAddresses } from '@/lib/contracts';
import { useChainId, useAccount } from 'wagmi';
import { parseUnits, isAddress, type Address } from 'viem';
import { USDC_DECIMALS } from '@/lib/contracts';
import { formatCurrency } from '@/lib/formatters';
import { AlertTriangle, ShieldAlert, ArrowRight } from 'lucide-react';

export function EmergencyWithdrawForm() {
  const { isOwner } = useOperatorRole();
  const { address } = useAccount();
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { totalAssets } = usePoolState();

  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    emergencyWithdraw,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  } = useEmergencyWithdraw();

  // Set default recipient to connected address
  useEffect(() => {
    if (address && !recipient) {
      setRecipient(address);
    }
  }, [address, recipient]);

  // Reset on success
  useEffect(() => {
    if (isSuccess) {
      setAmount('');
      setShowConfirm(false);
      reset();
    }
  }, [isSuccess, reset]);

  const handleWithdraw = () => {
    if (!isAddress(recipient)) return;
    const amountBigInt = parseUnits(amount, USDC_DECIMALS);
    emergencyWithdraw(addresses.usdc, amountBigInt, recipient as Address);
  };

  const isValidAmount = amount && parseFloat(amount) > 0;
  const isValidRecipient = isAddress(recipient);
  const maxAmount = Number(totalAssets ?? 0n) / 1e6;

  if (!isOwner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Emergency Withdraw</CardTitle>
          <Badge variant="error">OWNER ONLY</Badge>
        </CardHeader>
        <div className="p-4 bg-red-500/10 border-2 border-red-500/20 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-500" />
          <p className="text-body text-white">
            Only the contract owner can perform emergency withdrawals.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Emergency Withdraw</CardTitle>
          <Badge variant="error">DANGER</Badge>
        </CardHeader>

        <div className="space-y-6">
          {/* Warning */}
          <div className="p-4 bg-red-500/10 border-2 border-red-500/20 flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-body font-medium text-white">Emergency Function</p>
              <p className="text-body-sm text-cool-gray">
                This function should only be used in emergencies. It bypasses normal withdrawal
                logic and may affect LP share prices. Use with extreme caution.
              </p>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-500/10 border-2 border-red-500/20 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-body text-red-400">{error.message}</p>
            </div>
          )}

          {/* Amount Input */}
          <div className="space-y-2">
            <label className="text-body-sm text-cool-gray uppercase tracking-wider">
              Amount (USDC)
            </label>
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAmount(maxAmount.toString())}
              >
                Max
              </Button>
            </div>
            <p className="text-body-sm text-cool-gray">
              Pool Total: {formatCurrency(maxAmount)} USDC
            </p>
          </div>

          {/* Recipient Input */}
          <div className="space-y-2">
            <label className="text-body-sm text-cool-gray uppercase tracking-wider">
              Recipient Address
            </label>
            <Input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x..."
            />
            {address && recipient !== address && (
              <button
                onClick={() => setRecipient(address)}
                className="text-body-sm text-[var(--text-primary)] hover:underline"
              >
                Use my address
              </button>
            )}
          </div>

          {/* Preview */}
          {isValidAmount && isValidRecipient && (
            <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
              <p className="text-body-sm text-cool-gray uppercase tracking-wider mb-3">
                Transaction Preview
              </p>
              <div className="flex items-center gap-2 text-body">
                <span className="text-white font-mono">{formatCurrency(parseFloat(amount))}</span>
                <span className="text-cool-gray">USDC</span>
                <ArrowRight className="w-4 h-4 text-cool-gray" />
                <span className="text-white font-mono text-sm">
                  {recipient.slice(0, 6)}...{recipient.slice(-4)}
                </span>
              </div>
            </div>
          )}

          {/* Withdraw Button */}
          <Button
            variant="danger"
            size="lg"
            onClick={() => setShowConfirm(true)}
            disabled={!isValidAmount || !isValidRecipient || isPending || isConfirming}
            isLoading={isPending || isConfirming}
            className="w-full"
          >
            Emergency Withdraw
          </Button>
        </div>
      </Card>

      <ConfirmActionModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleWithdraw}
        title="Confirm Emergency Withdraw"
        description={`WARNING: You are about to withdraw ${formatCurrency(parseFloat(amount || '0'))} USDC to ${recipient}. This bypasses normal withdrawal logic and may affect LP share prices.`}
        confirmText="Withdraw"
        variant="danger"
        requireConfirmText={true}
        confirmPrompt="EMERGENCY"
        isLoading={isPending || isConfirming}
      />
    </>
  );
}
