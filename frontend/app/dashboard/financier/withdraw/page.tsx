'use client';

import { PageHeader } from '@/components/layout';
import { WithdrawForm } from '@/components/forms';
import { useAccount } from 'wagmi';
import { Card } from '@/components/ui';
import { ConnectButton } from '@/components/wallet';

export default function WithdrawPage() {
  const { isConnected } = useAccount();

  const handleSuccess = () => {
    // Optionally redirect after successful withdrawal
    // router.push('/dashboard/financier');
  };

  return (
    <div className="max-w-xl mx-auto">
      <PageHeader
        title="Withdraw USDC"
        description="Withdraw your position from the pool"
        backHref="/dashboard/financier"
        backLabel="Back to Dashboard"
      />

      {!isConnected ? (
        <Card className="text-center py-12">
          <p className="text-cool-gray mb-4">Connect your wallet to withdraw</p>
          <ConnectButton />
        </Card>
      ) : (
        <WithdrawForm onSuccess={handleSuccess} />
      )}
    </div>
  );
}
