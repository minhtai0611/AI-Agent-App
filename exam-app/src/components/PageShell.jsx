import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { pageVariants } from '../utils/animations.js'
import { Reveal3D } from './motion/Reveal3D.jsx'

// Shared shell for the Pure Math Toolset pages — closes the gap between the
// polished exam-flow pages (ExamSelect/Results, glass-elevated cards) and the
// toolset's previously bare `bg-background` + plain header boilerplate.
export default function PageShell({ title, onBack, maxWidth = 'max-w-2xl', children }) {
  const navigate = useNavigate()
  return (
    <motion.div
      className="min-h-screen bg-background flex flex-col"
      variants={pageVariants} initial="hidden" animate="show" exit="exit"
    >
      <header className="flex items-center justify-between px-6 sm:px-10 py-4 border-b border-border sticky top-0 z-10 bg-background/85 backdrop-blur-md">
        <button
          onClick={onBack ?? (() => navigate(-1))}
          className="font-sans text-sm text-dim hover:text-foreground transition"
        >
          ← Quay lại
        </button>
        <Reveal3D as="h1" variant="tilt" amount={0.3} className="font-display text-[20px] font-bold text-foreground">
          {title}
        </Reveal3D>
        <div className="w-16" />
      </header>

      <div className={`flex-1 flex flex-col gap-5 p-6 sm:p-10 ${maxWidth} mx-auto w-full`}>
        {children}
      </div>
    </motion.div>
  )
}

// Bento-card primitive — glass-elevated surface with an optional eyebrow label.
// Renders via Reveal3D (Tier-2 scroll-triggered rise) instead of a plain div —
// every call site gets the reveal for free with no prop changes needed.
export function PageCard({ label, className = '', children }) {
  return (
    <Reveal3D variant="rise" className={`glass-elevated rounded-2xl p-5 flex flex-col gap-3 ${className}`}>
      {label && (
        <span className="font-sans text-[0.6875rem] font-semibold uppercase tracking-wide text-faint">{label}</span>
      )}
      {children}
    </Reveal3D>
  )
}
