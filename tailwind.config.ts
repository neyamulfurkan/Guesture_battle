import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'bg-base': '#050810',
        'bg-surface': '#0d1117',
        'bg-interactive': '#1a2035',
        'accent-blue': '#3b82f6',
        'accent-orange': '#f97316',
        'accent-purple': '#a855f7',
        'accent-cyan': '#06b6d4',
        'accent-green': '#22c55e',
        'accent-red': '#ef4444',
        'accent-gold': '#eab308',
        'accent-gray': '#94a3b8',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse-slow 2s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 600ms ease-in-out infinite',
        'screen-shake': 'screen-shake 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      },
      keyframes: {
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'glow-pulse': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.02)' },
        },
        'screen-shake': {
          '0%': { transform: 'translate(0, 0)' },
          '20%': { transform: 'translate(-6px, 3px)' },
          '40%': { transform: 'translate(6px, -3px)' },
          '60%': { transform: 'translate(-4px, 5px)' },
          '80%': { transform: 'translate(4px, -2px)' },
          '100%': { transform: 'translate(0, 0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config