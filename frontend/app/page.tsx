import Link from 'next/link';
import { ArrowRight, Shield, TrendingUp, Wallet } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-deep-navy">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-seed-green rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="text-xl font-semibold text-white">Seed Finance</span>
          </div>
          <Link
            href="/dashboard/financier"
            className="btn-primary flex items-center gap-2"
          >
            Launch App
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-display text-white mb-6">
            Earn Yield on Invoice Financing
          </h1>
          <p className="text-xl text-cool-gray mb-12">
            Provide liquidity to the Seed Finance protocol and earn competitive
            yields from real-world invoice financing on Base L2.
          </p>
          <Link
            href="/dashboard/financier"
            className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-4"
          >
            Start Earning
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-24">
          <div className="card">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-h2 text-white mb-2">Competitive APY</h3>
            <p className="text-body text-cool-gray">
              Earn yields from invoice financing spreads plus treasury strategies
              on idle capital.
            </p>
          </div>

          <div className="card">
            <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-success" />
            </div>
            <h3 className="text-h2 text-white mb-2">Secure & Transparent</h3>
            <p className="text-body text-cool-gray">
              Non-custodial smart contracts on Base with full transparency into
              pool composition and yield sources.
            </p>
          </div>

          <div className="card">
            <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center mb-4">
              <Wallet className="w-6 h-6 text-warning" />
            </div>
            <h3 className="text-h2 text-white mb-2">Flexible Liquidity</h3>
            <p className="text-body text-cool-gray">
              Deposit and withdraw anytime. ERC-4626 vault shares automatically
              accrue yield.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-24 text-center">
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div>
              <p className="metric-value">—%</p>
              <p className="metric-label">Current APY</p>
            </div>
            <div>
              <p className="metric-value">$0.00</p>
              <p className="metric-label">Total Value Locked</p>
            </div>
            <div>
              <p className="metric-value">0</p>
              <p className="metric-label">Active Invoices</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-24">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center text-cool-gray text-body-sm">
          <p>&copy; 2026 Seed Finance. Built on Base.</p>
        </div>
      </footer>
    </div>
  );
}
