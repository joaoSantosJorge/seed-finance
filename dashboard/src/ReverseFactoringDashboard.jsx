import React, { useState } from 'react';
import { ArrowRight, ArrowDown, Building2, Users, Wallet, FileText, Shield, Globe, Zap, TrendingUp, Clock, DollarSign, Lock, RefreshCw, ChevronDown, ChevronUp, CheckCircle, AlertCircle } from 'lucide-react';

export default function ReverseFactoringDashboard() {
  const [activeTab, setActiveTab] = useState('architecture');
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const ArchitectureView = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Decentralized Architecture</h2>
        <p className="text-gray-600">Protocol-owned liquidity with fiat interfaces</p>
      </div>
      
      {/* Flow Diagram */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Buyer */}
          <div className="bg-white rounded-lg p-4 shadow-md w-full md:w-48 text-center">
            <Building2 className="w-12 h-12 text-blue-600 mx-auto mb-2" />
            <h3 className="font-bold text-gray-900">BUYER</h3>
            <p className="text-xs text-gray-500">Corporate Client</p>
            <div className="mt-2 text-xs bg-blue-100 rounded px-2 py-1">
              Pays FIAT at maturity
            </div>
          </div>
          
          <ArrowRight className="hidden md:block w-8 h-8 text-blue-400" />
          <ArrowDown className="md:hidden w-8 h-8 text-blue-400" />
          
          {/* Smart Contract Layer */}
          <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg p-4 shadow-lg w-full md:w-64 text-white">
            <Lock className="w-8 h-8 mx-auto mb-2" />
            <h3 className="font-bold text-center">SMART CONTRACTS</h3>
            <div className="grid grid-cols-3 gap-1 mt-3 text-xs">
              <div className="bg-white/20 rounded p-1 text-center">Invoice NFT</div>
              <div className="bg-white/20 rounded p-1 text-center">Escrow</div>
              <div className="bg-white/20 rounded p-1 text-center">Router</div>
            </div>
            <div className="mt-3 text-xs text-center bg-white/10 rounded py-1">
              100% USDC/USDT Internal
            </div>
          </div>
          
          <ArrowRight className="hidden md:block w-8 h-8 text-blue-400" />
          <ArrowDown className="md:hidden w-8 h-8 text-blue-400" />
          
          {/* Supplier */}
          <div className="bg-white rounded-lg p-4 shadow-md w-full md:w-48 text-center">
            <Users className="w-12 h-12 text-green-600 mx-auto mb-2" />
            <h3 className="font-bold text-gray-900">SUPPLIER</h3>
            <p className="text-xs text-gray-500">SME Vendor</p>
            <div className="mt-2 text-xs bg-green-100 rounded px-2 py-1">
              Receives FIAT early
            </div>
          </div>
        </div>
        
        {/* Liquidity Pool */}
        <div className="flex justify-center mt-6">
          <div className="bg-white rounded-lg p-4 shadow-md w-full md:w-80 text-center border-2 border-yellow-400">
            <Wallet className="w-12 h-12 text-yellow-600 mx-auto mb-2" />
            <h3 className="font-bold text-gray-900">LIQUIDITY POOL</h3>
            <p className="text-xs text-gray-500 mb-2">Decentralized Financiers</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-red-100 rounded p-2">
                <div className="font-bold text-red-700">Junior</div>
                <div className="text-red-600">12% APY</div>
              </div>
              <div className="bg-yellow-100 rounded p-2">
                <div className="font-bold text-yellow-700">Mezz</div>
                <div className="text-yellow-600">8% APY</div>
              </div>
              <div className="bg-green-100 rounded p-2">
                <div className="font-bold text-green-700">Senior</div>
                <div className="text-green-600">5% APY</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Key Principle */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
          <div>
            <h4 className="font-bold text-amber-800">Core Principle: Protocol Never Owns Funds</h4>
            <p className="text-sm text-amber-700 mt-1">
              Smart contracts hold funds in escrow. Fiat on/off-ramps at edges only. 
              Protocol earns fees, not interest on capital.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const CompetitiveEdgeView = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Competitive Advantages</h2>
      
      <div className="grid md:grid-cols-2 gap-4">
        {[
          {
            title: "Instant Settlement (T+0)",
            icon: <Zap className="w-6 h-6" />,
            description: "Banks take 2-5 days. We settle in seconds.",
            edge: "Banks structurally cannot match",
            color: "blue"
          },
          {
            title: "Zero Double-Financing Fraud",
            icon: <Shield className="w-6 h-6" />,
            description: "Immutable NFT registry prevents pledging to multiple parties.",
            edge: "Requires blockchain - cannot replicate",
            color: "green"
          },
          {
            title: "24/7 Global Liquidity",
            icon: <Globe className="w-6 h-6" />,
            description: "DeFi pools never close. Access $40B+ ecosystem.",
            edge: "Closed systems cannot integrate",
            color: "purple"
          },
          {
            title: "0.1% Cross-Border Fees",
            icon: <DollarSign className="w-6 h-6" />,
            description: "Banks charge 2-3% forex. Stablecoins eliminate this.",
            edge: "Revenue model conflict for banks",
            color: "yellow"
          },
          {
            title: "Portable Credit History",
            icon: <TrendingUp className="w-6 h-6" />,
            description: "On-chain reputation follows suppliers across platforms.",
            edge: "Proprietary systems trap data",
            color: "pink"
          },
          {
            title: "Composable Finance",
            icon: <RefreshCw className="w-6 h-6" />,
            description: "LP tokens usable as collateral in Aave, Compound, etc.",
            edge: "Unique to DeFi ecosystem",
            color: "indigo"
          }
        ].map((item, idx) => (
          <div key={idx} className={`bg-${item.color}-50 border border-${item.color}-200 rounded-lg p-4`}>
            <div className={`flex items-center gap-3 text-${item.color}-600 mb-2`}>
              {item.icon}
              <h3 className="font-bold">{item.title}</h3>
            </div>
            <p className="text-sm text-gray-700 mb-2">{item.description}</p>
            <div className={`text-xs bg-${item.color}-100 rounded px-2 py-1 inline-block`}>
              Edge: {item.edge}
            </div>
          </div>
        ))}
      </div>
      
      {/* Comparison Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 font-bold">Feature</th>
              <th className="text-center p-3 font-bold">Banks</th>
              <th className="text-center p-3 font-bold">Fintechs</th>
              <th className="text-center p-3 font-bold bg-green-50">Your Protocol</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Settlement Time", "T+2-5", "T+1", "T+0"],
              ["Min Invoice", "$50K+", "$10K", "$1K"],
              ["Fee Range", "2-4%", "1-3%", "0.5-1.5%"],
              ["Hours", "Business", "Extended", "24/7/365"],
              ["Cross-Border", "Limited", "Some", "Native"],
              ["Transparency", "Opaque", "Partial", "Full"],
              ["DeFi Integration", "None", "None", "Full"]
            ].map((row, idx) => (
              <tr key={idx} className="border-t">
                <td className="p-3 font-medium">{row[0]}</td>
                <td className="p-3 text-center text-gray-500">{row[1]}</td>
                <td className="p-3 text-center text-gray-500">{row[2]}</td>
                <td className="p-3 text-center bg-green-50 text-green-700 font-medium">{row[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const StakeholderView = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Stakeholder Analysis</h2>
      
      {[
        {
          title: "BUYERS (Corporates)",
          icon: <Building2 className="w-8 h-8" />,
          color: "blue",
          valueProps: [
            "Extend payment terms without supplier damage",
            "Real-time supply chain visibility",
            "ESG tracking for programs",
            "Lower total cost vs banks"
          ],
          journey: [
            "KYC onboarding",
            "Connect ERP (SAP/Oracle)",
            "Approve invoices",
            "Auto-conversion to on-chain",
            "Pay at maturity"
          ]
        },
        {
          title: "SUPPLIERS (SMEs)",
          icon: <Users className="w-8 h-8" />,
          color: "green",
          valueProps: [
            "Early payment in hours, not weeks",
            "Transparent, competitive rates",
            "No per-transaction credit app",
            "Build portable credit history"
          ],
          journey: [
            "Buyer invitation",
            "Lite KYC",
            "View approved invoices",
            "Request early payment",
            "Receive fiat (T+0/T+1)"
          ]
        },
        {
          title: "FINANCIERS (LPs)",
          icon: <Wallet className="w-8 h-8" />,
          color: "yellow",
          valueProps: [
            "5-15% APY institutional-grade",
            "Diversified buyer credit exposure",
            "Liquid via secondary markets",
            "Composable with DeFi"
          ],
          journey: [
            "Connect wallet",
            "Accredited verification",
            "Deposit USDC/USDT",
            "Select risk tranches",
            "Earn yield / withdraw"
          ]
        }
      ].map((stakeholder, idx) => (
        <div key={idx} className={`bg-${stakeholder.color}-50 border border-${stakeholder.color}-200 rounded-lg overflow-hidden`}>
          <button 
            onClick={() => toggleSection(stakeholder.title)}
            className={`w-full p-4 flex items-center justify-between bg-${stakeholder.color}-100`}
          >
            <div className="flex items-center gap-3">
              <div className={`text-${stakeholder.color}-600`}>{stakeholder.icon}</div>
              <h3 className="font-bold text-lg">{stakeholder.title}</h3>
            </div>
            {expandedSection === stakeholder.title ? 
              <ChevronUp className="w-6 h-6" /> : 
              <ChevronDown className="w-6 h-6" />
            }
          </button>
          
          {expandedSection === stakeholder.title && (
            <div className="p-4 grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-bold text-sm text-gray-700 mb-2">Value Proposition</h4>
                <ul className="space-y-1">
                  {stakeholder.valueProps.map((prop, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{prop}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-sm text-gray-700 mb-2">User Journey</h4>
                <ol className="space-y-1">
                  {stakeholder.journey.map((step, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className={`w-5 h-5 rounded-full bg-${stakeholder.color}-200 text-${stakeholder.color}-700 flex items-center justify-center text-xs font-bold`}>
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const MVPRoadmapView = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">MVP Sprint (7 Days)</h2>
      
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-4 text-white mb-6">
        <h3 className="font-bold text-lg mb-2">Goal: Functional Testnet Demo</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold">3</div>
            <div className="text-sm opacity-80">Smart Contracts</div>
          </div>
          <div>
            <div className="text-3xl font-bold">3</div>
            <div className="text-sm opacity-80">User Dashboards</div>
          </div>
          <div>
            <div className="text-3xl font-bold">1</div>
            <div className="text-sm opacity-80">Testnet Deploy</div>
          </div>
        </div>
      </div>
      
      <div className="space-y-3">
        {[
          { day: "1-2", title: "Smart Contract Dev", tasks: ["Invoice Registry (ERC-721)", "Liquidity Pool (ERC-4626)", "Access control"], status: "critical" },
          { day: "3", title: "Payment & Integration", tasks: ["Payment Router", "Fee calculation", "Event emission"], status: "critical" },
          { day: "4-5", title: "Frontend Development", tasks: ["Buyer dashboard", "Supplier dashboard", "Financier dashboard"], status: "high" },
          { day: "6", title: "Testing & Deploy", tasks: ["Unit tests", "Testnet deploy", "Documentation"], status: "high" },
          { day: "7", title: "Buffer & Polish", tasks: ["Bug fixes", "Demo prep", "Pitch deck"], status: "medium" }
        ].map((sprint, idx) => (
          <div key={idx} className="flex gap-4 items-start">
            <div className="w-16 flex-shrink-0">
              <div className="bg-gray-900 text-white rounded-lg p-2 text-center">
                <div className="text-xs">Day</div>
                <div className="font-bold">{sprint.day}</div>
              </div>
            </div>
            <div className="flex-1 bg-white border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold">{sprint.title}</h4>
                <span className={`text-xs px-2 py-1 rounded ${
                  sprint.status === 'critical' ? 'bg-red-100 text-red-700' :
                  sprint.status === 'high' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {sprint.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {sprint.tasks.map((task, i) => (
                  <span key={i} className="text-xs bg-gray-100 rounded px-2 py-1">{task}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Tech Stack */}
      <div className="bg-gray-900 rounded-lg p-4 text-white">
        <h3 className="font-bold mb-3">Recommended Tech Stack</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-gray-400 text-xs mb-1">Frontend</div>
            <div>Next.js 14</div>
            <div>RainbowKit</div>
            <div>TailwindCSS</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs mb-1">Contracts</div>
            <div>Solidity 0.8.x</div>
            <div>Foundry</div>
            <div>ERC-721/4626</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs mb-1">Chain</div>
            <div>Base Sepolia</div>
            <div>(or Polygon Mumbai)</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs mb-1">Infra</div>
            <div>Alchemy RPC</div>
            <div>Pinata IPFS</div>
            <div>Vercel</div>
          </div>
        </div>
      </div>
    </div>
  );

  const MarketDataView = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Market Opportunity</h2>
      
      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Market 2026", value: "$739B", subtext: "Reverse Factoring" },
          { label: "Market 2035", value: "$1.89T", subtext: "10.9% CAGR" },
          { label: "Blockchain SCF", value: "$34.6B", subtext: "by 2034" },
          { label: "Blockchain CAGR", value: "39.4%", subtext: "2025-2034" }
        ].map((stat, idx) => (
          <div key={idx} className="bg-white border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stat.value}</div>
            <div className="text-sm font-medium text-gray-900">{stat.label}</div>
            <div className="text-xs text-gray-500">{stat.subtext}</div>
          </div>
        ))}
      </div>
      
      {/* Revenue Projections */}
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-bold mb-4">Revenue Projection Model</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Year</th>
                <th className="text-right p-2">Invoice Volume</th>
                <th className="text-right p-2">Avg Fee</th>
                <th className="text-right p-2">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {[
                [1, "$50M", "1.2%", "$600K"],
                [2, "$500M", "1.0%", "$5M"],
                [3, "$2B", "0.8%", "$16M"],
                [4, "$10B", "0.7%", "$70M"]
              ].map((row, idx) => (
                <tr key={idx} className="border-b">
                  <td className="p-2 font-medium">Year {row[0]}</td>
                  <td className="p-2 text-right">{row[1]}</td>
                  <td className="p-2 text-right">{row[2]}</td>
                  <td className="p-2 text-right font-bold text-green-600">{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Go-to-Market */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-bold mb-3">Go-to-Market Phases</h3>
        <div className="space-y-3">
          {[
            { phase: "Phase 1", timing: "MVP Launch", target: "Crypto-Native (DAOs, exchanges)", why: "Already have USDC, low friction" },
            { phase: "Phase 2", timing: "6-12 months", target: "SME Networks (Shopify, gig platforms)", why: "Build fiat ramps, simplify UX" },
            { phase: "Phase 3", timing: "12-24 months", target: "Enterprise ($100M-$1B)", why: "ERP integrations, compliance certs" }
          ].map((phase, idx) => (
            <div key={idx} className="flex gap-3 items-start">
              <div className="w-20 flex-shrink-0 bg-green-600 text-white rounded px-2 py-1 text-xs font-bold text-center">
                {phase.phase}
              </div>
              <div>
                <div className="font-medium">{phase.timing}: {phase.target}</div>
                <div className="text-sm text-gray-600">{phase.why}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'architecture', label: 'Architecture', icon: <Lock className="w-4 h-4" /> },
    { id: 'competitive', label: 'Competitive Edge', icon: <Zap className="w-4 h-4" /> },
    { id: 'stakeholders', label: 'Stakeholders', icon: <Users className="w-4 h-4" /> },
    { id: 'mvp', label: 'MVP Roadmap', icon: <Clock className="w-4 h-4" /> },
    { id: 'market', label: 'Market Data', icon: <TrendingUp className="w-4 h-4" /> }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Decentralized Reverse Factoring Protocol</h1>
          <p className="text-blue-100">Strategic Product Blueprint & MVP Development Guide</p>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-6xl mx-auto p-6">
        {activeTab === 'architecture' && <ArchitectureView />}
        {activeTab === 'competitive' && <CompetitiveEdgeView />}
        {activeTab === 'stakeholders' && <StakeholderView />}
        {activeTab === 'mvp' && <MVPRoadmapView />}
        {activeTab === 'market' && <MarketDataView />}
      </div>
      
      {/* Footer */}
      <div className="bg-gray-900 text-white p-4 mt-8">
        <div className="max-w-6xl mx-auto text-center text-sm">
          <p>Ready to disrupt the $739B reverse factoring market with blockchain</p>
          <p className="text-gray-400 mt-1">MVP achievable in 7 days with focused execution</p>
        </div>
      </div>
    </div>
  );
}
