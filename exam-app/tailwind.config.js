/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['selector', '[data-theme="dark"], .dark'],
  safelist: [
    // Aurora background animation classes — dynamic strings would be purged otherwise
    'animate-[ambient-float-0_18s_ease-in-out_0s_infinite]',
    'animate-[ambient-float-1_22s_ease-in-out_3s_infinite]',
    'animate-[ambient-float-2_26s_ease-in-out_6s_infinite]',
    'animate-[ambient-float-3_20s_ease-in-out_9s_infinite]',
  ],
  theme: {
    extend: {
      fontFamily: {
        fraunces: ['Fraunces', 'serif'],
        jakarta: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      keyframes: {
        // BorderBeam — light travels around card border via offset-path
        'border-beam': {
          '100%': { 'offset-distance': '100%' },
        },
        // ShimmerButton — highlight slides across button surface
        'shimmer-slide': {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
        // AnimatedShinyText — shimmer sweep across text
        'shiny-text': {
          '0%, 90%, 100%': { 'background-position': 'calc(-100% - var(--shw,100px)) 0' },
          '30%, 60%':       { 'background-position': 'calc(100% + var(--shw,100px)) 0' },
        },
      },
      animation: {
        'border-beam':   'border-beam 8s linear infinite',
        'shimmer-slide': 'shimmer-slide 2s ease-in-out infinite',
        'shiny-text':    'shiny-text 3s linear infinite',
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
        whatsapp:          '#25D366',
        'mastery-0':       'var(--mastery-0)',
        'mastery-0-bg':    'var(--mastery-0-bg)',
        'mastery-1':       'var(--mastery-1)',
        'mastery-1-bg':    'var(--mastery-1-bg)',
        'mastery-2':       'var(--mastery-2)',
        'mastery-2-bg':    'var(--mastery-2-bg)',
        'mastery-3':       'var(--mastery-3)',
        'mastery-3-bg':    'var(--mastery-3-bg)',
        'mastery-4':       'var(--mastery-4)',
        'mastery-4-bg':    'var(--mastery-4-bg)',
        'mastery-5':       'var(--mastery-5)',
        'mastery-5-bg':    'var(--mastery-5-bg)',
      },
    },
  },
  plugins: [],
}
