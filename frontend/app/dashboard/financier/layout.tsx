'use client';

import { DashboardLayout } from '@/components/layout';
import { financierNavigation } from '@/lib/config/navigation';

export default function FinancierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout navigation={financierNavigation}>{children}</DashboardLayout>;
}
