'use client';

import { PageHeader } from '@/components/layout';
import { DepositForm } from '@/components/forms';
import { useAccount } from 'wagmi';
import { Card } from '@/components/ui';
import { ConnectButton } from '@/components/wallet';

export default function DepositPage() {
  const { isConnected } = useAccount();

  const handleSuccess = () => {
    // Optionally redirect after successful deposit
    // router.push('/dashboard/financier');
  };

  return (
    <div className="max-w-xl mx-auto">
      <PageHeader
        title="Deposit USDC"
        description="Add liquidity to the pool and start earning yield"
        backHref="/dashboard/financier"
        backLabel="Back to Dashboard"
      />

      {!isConnected ? (
        <Card className="text-center py-12">
          <p className="text-cool-gray mb-4">Connect your wallet to deposit</p>
          <ConnectButton />
        </Card>
      ) : (
        <DepositForm onSuccess={handleSuccess} />
      )}
    </div>
  );
}
