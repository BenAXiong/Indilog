import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream:        '#F5EEDF',
        paper:        '#FBF5E7',
        'paper-hi':   '#FFFCF3',
        line:         '#E6DAC0',
        'line-soft':  '#EFE5CF',
        ink:          '#2B221A',
        'ink-soft':   '#5C4E3F',
        'ink-mute':   '#8B7B68',
        'ink-faint':  '#B5A691',
        crimson:      '#A8351F',
        'crimson-dp': '#7C2113',
        'crimson-hi': '#C75038',
        'crimson-bg': '#F6E0D6',
        terra:        '#D2773A',
        'terra-bg':   '#F6E2CE',
        amber:        '#D9A12F',
        'amber-bg':   '#F6E5BA',
        sage:         '#7B8C46',
        'sage-bg':    '#E4E7CC',
        'sage-dp':    '#566234',
      },
      fontFamily: {
        serif: ['Newsreader', '"Source Serif Pro"', '"Iowan Old Style"', 'Georgia', 'serif'],
        sans:  ['Manrope', '"Helvetica Neue"', 'system-ui', '-apple-system', 'sans-serif'],
        mono:  ['"JetBrains Mono"', 'ui-monospace', '"SF Mono"', 'Menlo', 'monospace'],
      },
      keyframes: {
        'iv-rise':    { from: { transform: 'translateY(8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        'iv-flip':    { '0%': { transform: 'rotateY(0)' }, '50%': { transform: 'rotateY(90deg)' }, '100%': { transform: 'rotateY(0)' } },
        'iv-toast':   { '0%': { transform: 'translateY(20px)', opacity: '0' }, '15%': { transform: 'translateY(0)', opacity: '1' }, '85%': { transform: 'translateY(0)', opacity: '1' }, '100%': { transform: 'translateY(-6px)', opacity: '0' } },
        'iv-shimmer': { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
        'iv-pulse':   { '0%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.08)' }, '100%': { transform: 'scale(1)' } },
      },
      animation: {
        'iv-rise':    'iv-rise 0.35s cubic-bezier(.2,.7,.3,1)',
        'iv-flip':    'iv-flip 0.55s ease',
        'iv-toast':   'iv-toast 2s ease forwards',
        'iv-shimmer': 'iv-shimmer 1.4s ease infinite',
        'iv-pulse':   'iv-pulse 0.4s ease',
      },
    },
  },
  plugins: [],
} satisfies Config
