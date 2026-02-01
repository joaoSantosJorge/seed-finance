'use client';

import { ConnectButton, WalletBalance } from '@/components/wallet';
import { NotificationBell } from '@/components/notifications';
import { ThemeToggle } from '@/components/ui';
import { useAccount } from 'wagmi';

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const { isConnected } = useAccount();

  return (
    <header className="h-16 border-b-2 border-[var(--border-color)] bg-[var(--bg-card)] sticky top-0 z-40">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Left: Page Title */}
        <div>
          {title && (
            <h1 className="text-lg font-bold uppercase tracking-wider text-[var(--text-primary)]">
              {title}
            </h1>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          <ThemeToggle />
          {isConnected && (
            <>
              <WalletBalance />
              <NotificationBell />
            </>
          )}
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
