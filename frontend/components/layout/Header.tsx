'use client';

import { ConnectButton, WalletBalance } from '@/components/wallet';
import { NotificationBell } from '@/components/notifications';
import { useAccount } from 'wagmi';

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const { isConnected } = useAccount();

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-40">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Left: Page Title */}
        <div>
          {title && (
            <h1 className="text-h1 text-white">{title}</h1>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
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
