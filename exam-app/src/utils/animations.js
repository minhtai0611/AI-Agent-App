export const pageVariants = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:   { opacity: 0, y: -8, transition: { duration: 0.18, ease: 'easeIn' } },
}

export const listVariants = {
  hidden:   {},
  show:     { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
  visible:  { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

export const itemVariants = {
  hidden:  { opacity: 0, y: 12 },
  show:    { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
}
