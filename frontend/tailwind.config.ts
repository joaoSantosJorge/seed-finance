import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary palette (Professional Finance)
        'deep-navy': '#0F172A',
        'slate-bg': '#1E293B',
        'steel-gray': '#334155',
        'cool-gray': '#64748B',
        'silver': '#94A3B8',
        // Semantic colors
        'success': '#10B981',
        'success-light': '#D1FAE5',
        'error': '#F43F5E',
        'error-light': '#FFE4E6',
        'primary': '#3B82F6',
        'primary-light': '#DBEAFE',
        'warning': '#F59E0B',
        // Brand
        'seed-green': '#22C55E',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'monospace'],
      },
      fontSize: {
        'display': ['36px', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.02em' }],
        'h1': ['24px', { lineHeight: '1.3', fontWeight: '600', letterSpacing: '-0.01em' }],
        'h2': ['18px', { lineHeight: '1.4', fontWeight: '600' }],
        'h3': ['14px', { lineHeight: '1.5', fontWeight: '600', letterSpacing: '0.02em' }],
        'body': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'body-sm': ['12px', { lineHeight: '1.5', fontWeight: '400' }],
        'caption': ['11px', { lineHeight: '1.4', fontWeight: '500', letterSpacing: '0.05em' }],
      },
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
        '2xl': '48px',
      },
      borderRadius: {
        'card': '12px',
        'button': '8px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.1)',
        'card-hover': '0 4px 6px rgba(0,0,0,0.1)',
      },
      animation: {
        'pulse-slow': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
