'use client';

import {
  ContractAddressesCard,
  OperatorManagementForm,
} from '@/components/operator';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ConfirmActionModal } from '@/components/operator/ConfirmActionModal';
import { useOperatorRole } from '@/hooks/operator';
import {
  useSetExecutionPool,
  useSetLiquidityPool,
  useSetUSDC,
} from '@/hooks/operator/useDiamondAdmin';
import { isAddress, type Address } from 'viem';
import { useState, useEffect } from 'react';
import { AlertTriangle, Save } from 'lucide-react';

export default function OperatorConfigPage() {
  const { isOwner } = useOperatorRole();

  // Address update states
  const [executionPoolAddr, setExecutionPoolAddr] = useState('');
  const [liquidityPoolAddr, setLiquidityPoolAddr] = useState('');
  const [usdcAddr, setUsdcAddr] = useState('');

  const [showExecConfirm, setShowExecConfirm] = useState(false);
  const [showLpConfirm, setShowLpConfirm] = useState(false);
  const [showUsdcConfirm, setShowUsdcConfirm] = useState(false);

  // Hooks
  const {
    setExecutionPool,
    isPending: execPending,
    isConfirming: execConfirming,
    isSuccess: execSuccess,
    error: execError,
    reset: resetExec,
  } = useSetExecutionPool();

  const {
    setLiquidityPool,
    isPending: lpPending,
    isConfirming: lpConfirming,
    isSuccess: lpSuccess,
    error: lpError,
    reset: resetLp,
  } = useSetLiquidityPool();

  const {
    setUSDC,
    isPending: usdcPending,
    isConfirming: usdcConfirming,
    isSuccess: usdcSuccess,
    error: usdcError,
    reset: resetUsdc,
  } = useSetUSDC();

  // Reset on success
  useEffect(() => {
    if (execSuccess) {
      setExecutionPoolAddr('');
      setShowExecConfirm(false);
      resetExec();
    }
  }, [execSuccess, resetExec]);

  useEffect(() => {
    if (lpSuccess) {
      setLiquidityPoolAddr('');
      setShowLpConfirm(false);
      resetLp();
    }
  }, [lpSuccess, resetLp]);

  useEffect(() => {
    if (usdcSuccess) {
      setUsdcAddr('');
      setShowUsdcConfirm(false);
      resetUsdc();
    }
  }, [usdcSuccess, resetUsdc]);

  const handleSetExecutionPool = () => {
    if (isAddress(executionPoolAddr)) {
      setExecutionPool(executionPoolAddr as Address);
    }
  };

  const handleSetLiquidityPool = () => {
    if (isAddress(liquidityPoolAddr)) {
      setLiquidityPool(liquidityPoolAddr as Address);
    }
  };

  const handleSetUSDC = () => {
    if (isAddress(usdcAddr)) {
      setUSDC(usdcAddr as Address);
    }
  };

  const error = execError || lpError || usdcError;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-h2 text-white">Contract Configuration</h2>
        <p className="text-body text-cool-gray">
          View contract addresses and manage system configuration.
        </p>
      </div>

      {/* Contract Addresses */}
      <ContractAddressesCard />

      {/* Update Addresses (Owner Only) */}
      {isOwner ? (
        <Card>
          <CardHeader>
            <CardTitle>Update Contract Addresses</CardTitle>
            <Badge variant="warning">OWNER ONLY</Badge>
          </CardHeader>

          <div className="space-y-6">
            {/* Warning */}
            <div className="p-4 bg-yellow-500/10 border-2 border-yellow-500/20 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-body font-medium text-white">Caution</p>
                <p className="text-body-sm text-cool-gray">
                  Changing contract addresses affects the entire system. Only update these if you
                  are deploying new contracts or migrating.
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

            {/* Execution Pool */}
            <div className="space-y-2">
              <label className="text-body-sm text-cool-gray uppercase tracking-wider">
                Execution Pool Address
              </label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Input
                    type="text"
                    value={executionPoolAddr}
                    onChange={(e) => setExecutionPoolAddr(e.target.value)}
                    placeholder="0x..."
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setShowExecConfirm(true)}
                  disabled={!isAddress(executionPoolAddr) || execPending || execConfirming}
                  isLoading={execPending || execConfirming}
                  leftIcon={<Save className="w-4 h-4" />}
                >
                  Update
                </Button>
              </div>
            </div>

            {/* Liquidity Pool */}
            <div className="space-y-2">
              <label className="text-body-sm text-cool-gray uppercase tracking-wider">
                Liquidity Pool Address
              </label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Input
                    type="text"
                    value={liquidityPoolAddr}
                    onChange={(e) => setLiquidityPoolAddr(e.target.value)}
                    placeholder="0x..."
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setShowLpConfirm(true)}
                  disabled={!isAddress(liquidityPoolAddr) || lpPending || lpConfirming}
                  isLoading={lpPending || lpConfirming}
                  leftIcon={<Save className="w-4 h-4" />}
                >
                  Update
                </Button>
              </div>
            </div>

            {/* USDC */}
            <div className="space-y-2">
              <label className="text-body-sm text-cool-gray uppercase tracking-wider">
                USDC Address
              </label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Input
                    type="text"
                    value={usdcAddr}
                    onChange={(e) => setUsdcAddr(e.target.value)}
                    placeholder="0x..."
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setShowUsdcConfirm(true)}
                  disabled={!isAddress(usdcAddr) || usdcPending || usdcConfirming}
                  isLoading={usdcPending || usdcConfirming}
                  leftIcon={<Save className="w-4 h-4" />}
                >
                  Update
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Update Contract Addresses</CardTitle>
            <Badge variant="warning">OWNER ONLY</Badge>
          </CardHeader>
          <div className="p-4 bg-yellow-500/10 border-2 border-yellow-500/20 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-500" />
            <p className="text-body text-white">
              Only the contract owner can update contract addresses.
            </p>
          </div>
        </Card>
      )}

      {/* Operator Management */}
      <OperatorManagementForm />

      {/* Confirmation Modals */}
      <ConfirmActionModal
        isOpen={showExecConfirm}
        onClose={() => setShowExecConfirm(false)}
        onConfirm={handleSetExecutionPool}
        title="Update Execution Pool"
        description={`This will update the Execution Pool address to ${executionPoolAddr}. Make sure this is the correct address.`}
        confirmText="Update"
        variant="warning"
        isLoading={execPending || execConfirming}
      />

      <ConfirmActionModal
        isOpen={showLpConfirm}
        onClose={() => setShowLpConfirm(false)}
        onConfirm={handleSetLiquidityPool}
        title="Update Liquidity Pool"
        description={`This will update the Liquidity Pool address to ${liquidityPoolAddr}. Make sure this is the correct address.`}
        confirmText="Update"
        variant="warning"
        isLoading={lpPending || lpConfirming}
      />

      <ConfirmActionModal
        isOpen={showUsdcConfirm}
        onClose={() => setShowUsdcConfirm(false)}
        onConfirm={handleSetUSDC}
        title="Update USDC Address"
        description={`This will update the USDC token address to ${usdcAddr}. Make sure this is the correct address.`}
        confirmText="Update"
        variant="danger"
        requireConfirmText={true}
        confirmPrompt="UPDATE"
        isLoading={usdcPending || usdcConfirming}
      />
    </div>
  );
}
