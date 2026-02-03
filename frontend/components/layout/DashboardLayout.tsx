'use client';

import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { Header } from './Header';
import { type RoleNavigation, financierNavigation } from '@/lib/config/navigation';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  navigation?: RoleNavigation;
}

export function DashboardLayout({
  children,
  title,
  navigation = financierNavigation,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Sidebar - Desktop only */}
      <div className="hidden lg:block">
        <Sidebar navigation={navigation} />
      </div>

      {/* Main Content */}
      <div className="lg:ml-64">
        <Header title={title} />
        <main className="p-6 max-w-7xl mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[var(--bg-card)] border-t-2 border-[var(--border-color)] z-40">
        <MobileNav navigation={navigation} />
      </div>
    </div>
  );
}
