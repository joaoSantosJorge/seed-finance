'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ConfirmActionModal } from './ConfirmActionModal';
import { useSetOperator, useTransferOwnership } from '@/hooks/operator/useDiamondAdmin';
import { useOperatorRole, useIsOperator, useOwner } from '@/hooks/operator';
import { type Address, isAddress } from 'viem';
import { UserPlus, UserMinus, Crown, AlertTriangle, Check } from 'lucide-react';

export function OperatorManagementForm() {
  const { isOwner } = useOperatorRole();
  const { data: currentOwner } = useOwner();

  const [operatorAddress, setOperatorAddress] = useState('');
  const [newOwnerAddress, setNewOwnerAddress] = useState('');
  const [showAddConfirm, setShowAddConfirm] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [checkAddress, setCheckAddress] = useState<Address | undefined>();

  // Check if entered address is already an operator
  const { data: isOperatorAlready, isLoading: checkingOperator } = useIsOperator(checkAddress);

  const {
    setOperator,
    isPending: setPending,
    isConfirming: setConfirming,
    isSuccess: setSuccess,
    error: setError,
    reset: resetSet,
  } = useSetOperator();

  const {
    transferOwnership,
    isPending: transferPending,
    isConfirming: transferConfirming,
    isSuccess: transferSuccess,
    error: transferError,
    reset: resetTransfer,
  } = useTransferOwnership();

  // Update check address when input changes
  useEffect(() => {
    if (isAddress(operatorAddress)) {
      setCheckAddress(operatorAddress as Address);
    } else {
      setCheckAddress(undefined);
    }
  }, [operatorAddress]);

  // Reset on success
  useEffect(() => {
    if (setSuccess) {
      setOperatorAddress('');
      setShowAddConfirm(false);
      setShowRemoveConfirm(false);
      resetSet();
    }
  }, [setSuccess, resetSet]);

  useEffect(() => {
    if (transferSuccess) {
      setNewOwnerAddress('');
      setShowTransferConfirm(false);
      resetTransfer();
    }
  }, [transferSuccess, resetTransfer]);

  const handleAddOperator = () => {
    if (!isAddress(operatorAddress)) return;
    setOperator(operatorAddress as Address, true);
  };

  const handleRemoveOperator = () => {
    if (!isAddress(operatorAddress)) return;
    setOperator(operatorAddress as Address, false);
  };

  const handleTransferOwnership = () => {
    if (!isAddress(newOwnerAddress)) return;
    transferOwnership(newOwnerAddress as Address);
  };

  const isValidOperatorAddress = isAddress(operatorAddress);
  const isValidOwnerAddress = isAddress(newOwnerAddress);

  if (!isOwner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Operator Management</CardTitle>
          <Badge variant="warning">OWNER ONLY</Badge>
        </CardHeader>
        <div className="p-4 bg-yellow-500/10 border-2 border-yellow-500/20 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-yellow-500" />
          <p className="text-body text-white">
            Only the contract owner can manage operators.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Operator Management</CardTitle>
        </CardHeader>

        <div className="space-y-6">
          {/* Current Owner */}
          <div className="p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-5 h-5 text-yellow-500" />
              <span className="text-body-sm text-cool-gray uppercase tracking-wider">
                Current Owner
              </span>
            </div>
            <p className="font-mono text-white">{currentOwner ?? 'Loading...'}</p>
          </div>

          {/* Error Display */}
          {(setError || transferError) && (
            <div className="p-4 bg-red-500/10 border-2 border-red-500/20 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-body text-red-400">
                {setError?.message || transferError?.message}
              </p>
            </div>
          )}

          {/* Add/Remove Operator */}
          <div className="space-y-3">
            <h4 className="text-body font-bold text-white uppercase tracking-wider">
              Manage Operators
            </h4>
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  type="text"
                  value={operatorAddress}
                  onChange={(e) => setOperatorAddress(e.target.value)}
                  placeholder="0x..."
                />
              </div>
              <Button
                variant="primary"
                onClick={() => setShowAddConfirm(true)}
                disabled={!isValidOperatorAddress || isOperatorAlready || setPending || setConfirming}
                leftIcon={<UserPlus className="w-4 h-4" />}
              >
                Add
              </Button>
              <Button
                variant="danger"
                onClick={() => setShowRemoveConfirm(true)}
                disabled={!isValidOperatorAddress || !isOperatorAlready || setPending || setConfirming}
                leftIcon={<UserMinus className="w-4 h-4" />}
              >
                Remove
              </Button>
            </div>

            {/* Status Check */}
            {checkAddress && !checkingOperator && (
              <div className="flex items-center gap-2">
                {isOperatorAlready ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-body-sm text-green-500">This address is an operator</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-cool-gray" />
                    <span className="text-body-sm text-cool-gray">This address is not an operator</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Transfer Ownership */}
          <div className="pt-4 border-t-2 border-[var(--border-color)] space-y-3">
            <h4 className="text-body font-bold text-white uppercase tracking-wider">
              Transfer Ownership
            </h4>
            <p className="text-body-sm text-cool-gray">
              Transfer contract ownership to a new address. This action is irreversible.
            </p>
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  type="text"
                  value={newOwnerAddress}
                  onChange={(e) => setNewOwnerAddress(e.target.value)}
                  placeholder="0x... (new owner address)"
                />
              </div>
              <Button
                variant="danger"
                onClick={() => setShowTransferConfirm(true)}
                disabled={!isValidOwnerAddress || transferPending || transferConfirming}
                isLoading={transferPending || transferConfirming}
              >
                Transfer
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Add Operator Confirmation */}
      <ConfirmActionModal
        isOpen={showAddConfirm}
        onClose={() => setShowAddConfirm(false)}
        onConfirm={handleAddOperator}
        title="Add Operator"
        description={`This will grant operator privileges to ${operatorAddress}. Operators can fund invoices and manage pool operations.`}
        confirmText="Add Operator"
        variant="warning"
        isLoading={setPending || setConfirming}
      />

      {/* Remove Operator Confirmation */}
      <ConfirmActionModal
        isOpen={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        onConfirm={handleRemoveOperator}
        title="Remove Operator"
        description={`This will revoke operator privileges from ${operatorAddress}. They will no longer be able to perform operator actions.`}
        confirmText="Remove Operator"
        variant="danger"
        isLoading={setPending || setConfirming}
      />

      {/* Transfer Ownership Confirmation */}
      <ConfirmActionModal
        isOpen={showTransferConfirm}
        onClose={() => setShowTransferConfirm(false)}
        onConfirm={handleTransferOwnership}
        title="Transfer Ownership"
        description={`WARNING: This will transfer contract ownership to ${newOwnerAddress}. You will lose all owner privileges. This action cannot be undone.`}
        confirmText="Transfer Ownership"
        variant="danger"
        requireConfirmText={true}
        confirmPrompt="TRANSFER"
        isLoading={transferPending || transferConfirming}
      />
    </>
  );
}
