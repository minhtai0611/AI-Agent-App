/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        fraunces: ['Fraunces', 'serif'],
        jakarta: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        background:        'var(--background)',
        foreground:        'var(--foreground)',
        surface:           'var(--surface)',
        'surface-elevated':'var(--surface-elevated)',
        border:            'var(--border)',
        'border-subtle':   'var(--border-subtle)',
        primary:           'var(--primary)',
        'primary-fg':      'var(--primary-fg)',
        muted:             'var(--muted)',
        'muted-fg':        'var(--muted-fg)',
        dim:               'var(--dim)',
        faint:             'var(--faint)',
        success:           'var(--success)',
        destructive:       'var(--destructive)',
        info:              'var(--info)',
        purple:            'var(--purple)',
        highlight:         'var(--highlight)',
      },
    },
  },
  plugins: [],
}
