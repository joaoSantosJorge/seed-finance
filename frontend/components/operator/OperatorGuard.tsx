'use client';

import { useOperatorRole } from '@/hooks/operator';
import { Shield, AlertTriangle, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';

interface OperatorGuardProps {
  children: React.ReactNode;
  requireOwner?: boolean;
}

export function OperatorGuard({ children, requireOwner = false }: OperatorGuardProps) {
  const { isOperator, isOwner, isLoading, isConnected } = useOperatorRole();

  // Determine if user has required access
  const hasAccess = requireOwner ? isOwner : (isOperator || isOwner);

  // Show loading state while checking permissions
  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 text-[var(--text-primary)] animate-spin mx-auto" />
          <p className="text-body text-cool-gray">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Not connected
  if (!isConnected) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Card className="max-w-md text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] mx-auto flex items-center justify-center">
              <Shield className="w-8 h-8 text-cool-gray" />
            </div>
            <h2 className="text-h3 text-white">Wallet Not Connected</h2>
            <p className="text-body text-cool-gray">
              Please connect your wallet to access the operator dashboard.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // No access
  if (!hasAccess) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Card className="max-w-md text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 bg-red-500/10 border-2 border-red-500/20 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-h3 text-white">Access Denied</h2>
            <p className="text-body text-cool-gray">
              {requireOwner
                ? 'This section requires owner privileges. Contact the contract owner for access.'
                : 'You do not have operator privileges. Contact the contract owner to request access.'}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Hook-based guard for conditional rendering
 */
export function useOperatorAccess(requireOwner = false) {
  const { isOperator, isOwner, isLoading, isConnected } = useOperatorRole();

  const hasAccess = requireOwner ? isOwner : (isOperator || isOwner);

  return {
    hasAccess,
    isLoading,
    isConnected,
    isOperator,
    isOwner,
  };
}
