import Link from 'next/link';
import { FileText, CheckCircle, TrendingUp, Settings } from 'lucide-react';

export default function HomePage() {
  const apps = [
    {
      title: "Supplier's App",
      description: 'Create invoices and receive early payment on approved receivables.',
      href: '/dashboard/supplier',
      icon: FileText,
    },
    {
      title: "Buyer's App",
      description: 'Review and approve supplier invoices, manage repayments.',
      href: '/dashboard/buyer',
      icon: CheckCircle,
    },
    {
      title: "Financier's App",
      description: 'Deposit USDC into the vault and earn yield from invoice financing.',
      href: '/dashboard/financier',
      icon: TrendingUp,
    },
    {
      title: 'Operator / Admin',
      description: 'Trigger funding operations and monitor protocol health.',
      href: '/dashboard/operator',
      icon: Settings,
    },
  ];

  return (
    <div className="min-h-screen bg-deep-navy flex flex-col">
      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* ASCII Logo */}
        <pre className="text-seed-green text-[10px] sm:text-xs md:text-sm leading-tight font-mono select-none mb-12 text-center">
{`  ____  ____  ____  ____
 / ___)(  __)(  __)(    \\
 \\___ \\ ) _)  ) _)  ) D (
 (____/(____)(____)(____/

   ____  __  _  _    __    _  _   ___  ____
  (  __)(  )( \\( )  /  \\  ( \\( ) / __)(  __)
   ) _)  )(  )  (  ( __ )  )  ( ( (__  ) _)
  (__)  (__)(_)\\_) (_)(_) (_)\\_) \\___)(____)`.trim()}
        </pre>

        {/* App Boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl w-full">
          {apps.map((app) => {
            const Icon = app.icon;
            return (
              <Link
                key={app.href}
                href={app.href}
                className="group border border-slate-700 rounded-xl p-6 hover:border-seed-green/60 transition-colors bg-slate-900/40"
              >
                <div className="w-10 h-10 rounded-lg bg-seed-green/10 flex items-center justify-center mb-4 group-hover:bg-seed-green/20 transition-colors">
                  <Icon className="w-5 h-5 text-seed-green" />
                </div>
                <h2 className="text-lg font-semibold text-white mb-1">{app.title}</h2>
                <p className="text-sm text-cool-gray leading-relaxed">{app.description}</p>
              </Link>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-6 text-center text-cool-gray text-sm">
          <p>&copy; 2026 Seed Finance. Built on Arc.</p>
        </div>
      </footer>
    </div>
  );
}
