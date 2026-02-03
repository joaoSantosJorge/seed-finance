'use client';

import { DashboardLayout } from '@/components/layout';
import { buyerNavigation } from '@/lib/config/navigation';

export default function BuyerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout navigation={buyerNavigation}>{children}</DashboardLayout>;
}
