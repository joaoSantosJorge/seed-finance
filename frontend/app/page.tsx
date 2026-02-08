import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { FileText, CheckCircle, TrendingUp, Settings } from 'lucide-react';
import { MarkdownContent } from '@/components/ui/MarkdownContent';

export default function HomePage() {
  let readmeContent = '';
  try {
    readmeContent = fs.readFileSync(
      path.join(process.cwd(), 'README.md'),
      'utf-8'
    );
  } catch {
    try {
      readmeContent = fs.readFileSync(
        path.join(process.cwd(), '..', 'README.md'),
        'utf-8'
      );
    } catch {
      readmeContent = '*Documentation available on [GitHub](https://github.com/your-org/seed-finance).*';
    }
  }

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
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center px-6 py-12">
        {/* ASCII Logo */}
        <pre
          className="text-[var(--text-primary)] leading-tight select-none mb-2 text-center"
          style={{ fontSize: '14px' }}
        >
{`  ____  ____  ____  ____
 / ___)(  __)(  __)(    \\
 \\___ \\ ) _)  ) _)  ) D (
 (____/(____)(____)(____/

   ____  __  _  _    __    _  _   ___  ____
  (  __)(  )( \\( )  /  \\  ( \\( ) / __)(  __)
   ) _)  )(  )  (  ( __ )  )  ( ( (__  ) _)
  (__)  (__)(_)\\_) (_)(_) (_)\\_) \\___)(____)`.trim()}
        </pre>

        {/* Subtitle */}
        <p className="text-xs uppercase tracking-[0.15em] text-[var(--text-secondary)] mb-12">
          Seed Finance — For Supply Chain Finance
        </p>

        {/* App Boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl w-full">
          {apps.map((app) => {
            const Icon = app.icon;
            return (
              <Link
                key={app.href}
                href={app.href}
                className="group bg-[var(--bg-card)] border-2 border-[var(--border-color)] p-6 transition-all duration-150 hover:shadow-[4px_4px_0_var(--border-color)] hover:-translate-x-0.5 hover:-translate-y-0.5"
              >
                <div className="mb-4">
                  <Icon className="w-5 h-5 text-[var(--text-primary)]" />
                </div>
                <h2 className="text-lg font-bold uppercase tracking-wider text-[var(--text-primary)] mb-1">
                  {app.title}
                </h2>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {app.description}
                </p>
              </Link>
            );
          })}
        </div>

        {/* Demo Video */}
        <section className="max-w-3xl w-full mt-16">
          <div className="border-2 border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="border-b-2 border-[var(--border-color)] px-4 py-2">
              <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-[var(--text-primary)] text-center">
                — Demo —
              </h2>
            </div>
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src="https://www.youtube.com/embed/PvUzRfTTapc"
                title="Seed Finance Demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        </section>

        {/* README / Documentation */}
        <section className="max-w-3xl w-full mt-16">
          <div className="border-2 border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="border-b-2 border-[var(--border-color)] px-4 py-2">
              <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-[var(--text-primary)] text-center">
                — Documentation —
              </h2>
            </div>
            <div className="p-6">
              <MarkdownContent content={readmeContent} />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto px-6 py-6 text-center text-[var(--text-muted)] text-sm">
          <p>&copy; 2026 Seed Finance. Built on Arc.</p>
        </div>
      </footer>
    </div>
  );
}
