'use client';

import { ConnectButton as RainbowConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui';
import { truncateAddress } from '@/lib/formatters';
import Image from 'next/image';

interface ConnectButtonProps {
  className?: string;
}

export function ConnectButton({ className }: ConnectButtonProps) {
  return (
    <RainbowConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === 'authenticated');

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
            className={className}
          >
            {(() => {
              if (!connected) {
                return (
                  <Button onClick={openConnectModal}>
                    [ CONNECT ]
                  </Button>
                );
              }

              if (chain.unsupported) {
                return (
                  <Button variant="danger" onClick={openChainModal}>
                    [!] WRONG NETWORK
                  </Button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openChainModal}
                    className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-card)] border-2 border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-colors text-xs font-bold"
                    type="button"
                  >
                    {chain.hasIcon && chain.iconUrl && (
                      <Image
                        alt={chain.name ?? 'Chain icon'}
                        src={chain.iconUrl}
                        width={16}
                        height={16}
                        className="rounded-sm"
                      />
                    )}
                    <span className="text-[var(--text-muted)]">[v]</span>
                  </button>

                  <button
                    onClick={openAccountModal}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-card)] border-2 border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-colors text-xs font-bold tracking-wider"
                    type="button"
                  >
                    <span className="text-[var(--text-primary)]">
                      {truncateAddress(account.address)}
                    </span>
                    <span className="text-[var(--text-muted)]">[v]</span>
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </RainbowConnectButton.Custom>
  );
}
