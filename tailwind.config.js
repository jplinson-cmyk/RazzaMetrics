/** @type {import('tailwindcss').Config} */
// Colours resolve to the Console tokens in src/tokens.css; color-mix keeps opacity modifiers (bg-razza-500/10) working.
const v = (name) => `color-mix(in oklab, var(${name}) calc(<alpha-value> * 100%), transparent)`;
const ramp = (prefix, steps) => Object.fromEntries(steps.map((s) => [s, v(`--${prefix}-${s}`)]));
const neutral = ramp('gray', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gray: neutral,
        slate: neutral,
        blue: ramp('blue', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        razza: ramp('razza', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        semrush: {
          green: v('--color-ok'),
          emerald: v('--color-ok'),
          darkgreen: v('--color-ok-soft'),
          lime: v('--color-ok'),
          amber: v('--color-accent'),
          rose: v('--color-bad'),
          purple: v('--color-cool'),
          sky: v('--color-cool'),
        },
        dark: {
          bg: v('--color-paper'),
          surface: v('--color-paper-3'),
          card: v('--color-paper-2'),
          hover: v('--color-paper-4'),
          border: v('--color-rule'),
          muted: v('--color-muted'),
          text: v('--color-ink'),
        },
      },
      fontFamily: {
        sans: ['var(--font-body)'],
        heading: ['var(--font-display)'],
        mono: ['var(--font-outlier)'],
      },
      boxShadow: {
        'glow-sm': 'none',
        'glow-md': 'none',
      },
    },
  },
  plugins: [],
}
