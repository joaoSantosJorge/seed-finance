'use client';

import { Button, type ButtonProps } from '@/components/ui';
import { Check, ExternalLink } from 'lucide-react';
import { getExplorerTxUrl } from '@/lib/contracts';
import { useChainId } from 'wagmi';

interface TransactionButtonProps extends Omit<ButtonProps, 'onClick'> {
  onClick: () => void;
  isPending: boolean;
  isConfirming: boolean;
  isSuccess: boolean;
  hash?: `0x${string}`;
  pendingText?: string;
  confirmingText?: string;
  successText?: string;
}

export function TransactionButton({
  onClick,
  isPending,
  isConfirming,
  isSuccess,
  hash,
  pendingText = 'Confirm in wallet...',
  confirmingText = 'Confirming...',
  successText = 'Success!',
  children,
  ...props
}: TransactionButtonProps) {
  const chainId = useChainId();

  if (isSuccess && hash) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-success">
          <Check className="w-5 h-5" />
          <span className="text-body font-medium">{successText}</span>
        </div>
        <a
          href={getExplorerTxUrl(chainId, hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-body-sm text-primary hover:underline"
        >
          View on Explorer
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    );
  }

  const getButtonText = () => {
    if (isPending) return pendingText;
    if (isConfirming) return confirmingText;
    return children;
  };

  return (
    <Button
      onClick={onClick}
      isLoading={isPending || isConfirming}
      disabled={isPending || isConfirming}
      {...props}
    >
      {getButtonText()}
    </Button>
  );
}
