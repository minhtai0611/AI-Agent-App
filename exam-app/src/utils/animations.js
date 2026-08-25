// ── Page transitions ──────────────────────────────────────────────────────────

export const pageVariants = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:   { opacity: 0, y: -6, transition: { duration: 0.2, ease: 'easeIn' } },
}

// ── List stagger (with y-lift for richness) ───────────────────────────────────

export const listVariants = {
  hidden:   {},
  show:     { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
  visible:  { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

export const itemVariants = {
  hidden:  { opacity: 0, y: 10 },
  show:    { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
}

// ── Card hover lift ───────────────────────────────────────────────────────────
// Apply with whileHover="hover" initial="rest" on motion.div glass-base cards

export const cardHover = {
  hidden: { opacity: 0, y: 10 },
  rest:   { opacity: 1, y: 0,  transition: { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] } },
  hover:  { y: -3,             transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] } },
}

// ── Landing hero sequence — 7-element orchestrated entry ─────────────────────
// Use with custom delay per element: transition={{ delay: heroSequence.headline.delay }}

export const heroSequence = {
  eyebrow:  { delay: 0 },
  headline: { delay: 0.08 },
  sub:      { delay: 0.16 },
  cta:      { delay: 0.24 },
  proof:    { delay: 0.32 },
  heroCard: { delay: 0.2,  y: 20 },
  heroGlow: { delay: 0.4 },
}

export const heroItem = (key) => ({
  hidden: { opacity: 0, y: heroSequence[key]?.y ?? 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      delay: heroSequence[key]?.delay ?? 0,
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
})

// ── View Transitions API — falls back gracefully ──────────────────────────────

export function viewNavigate(navigateFn, path, opts) {
  // startViewTransition throws/rejects (InvalidStateError) when the document is hidden
  // or a transition is already in flight — navigation itself still succeeds via the
  // callback, so this is safe to swallow rather than let surface as an unhandled rejection.
  if (document.startViewTransition) {
    const transition = document.startViewTransition(() => navigateFn(path, opts))
    transition.ready.catch(() => {})
  } else {
    navigateFn(path, opts)
  }
}
