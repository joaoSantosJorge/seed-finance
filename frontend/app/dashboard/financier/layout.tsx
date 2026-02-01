import { DashboardLayout } from '@/components/layout';

export default function FinancierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
