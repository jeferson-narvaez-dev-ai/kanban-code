/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
      colors: {
        // Background hierarchy
        'bg-base':     '#09090b',
        'bg-surface':  '#111116',
        'bg-elevated': '#18181f',
        'bg-overlay':  '#1e1e28',
        // Accent
        'accent':      '#6366f1',
        'accent-h':    '#818cf8',
        'accent-p':    '#4f46e5',
        // Semantic
        'success':     '#10b981',
        'warning':     '#f59e0b',
        'danger':      '#ef4444',
        // Column accents
        'col-backlog':  '#8b5cf6',
        'col-progress': '#3b82f6',
        'col-approval': '#f59e0b',
        'col-done':     '#10b981',
      },
      boxShadow: {
        'card':       '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.09)',
        'drag':       '0 0 0 2px #6366f1, 0 8px 24px rgba(99,102,241,0.3)',
        'modal':      '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
