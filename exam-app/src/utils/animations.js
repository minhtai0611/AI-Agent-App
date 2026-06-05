export const pageVariants = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:   { opacity: 0, y: -8, transition: { duration: 0.18, ease: 'easeIn' } },
}

// Tier 2 reveal: stagger container — max 5 items, opacity only (no y-translate)
export const listVariants = {
  hidden:   {},
  show:     { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
  visible:  { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}

export const itemVariants = {
  hidden:  { opacity: 0 },
  show:    { opacity: 1, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
  visible: { opacity: 1, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
}

// View Transitions API wrapper — falls back gracefully when not supported
export function viewNavigate(navigateFn, path, opts) {
  if (document.startViewTransition) {
    document.startViewTransition(() => navigateFn(path, opts))
  } else {
    navigateFn(path, opts)
  }
}
