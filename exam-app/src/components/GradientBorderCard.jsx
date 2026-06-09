import { cn } from '../lib/utils.js'

// Static conic-gradient border wrapper for featured CTAs and highlighted cards.
export function GradientBorderCard({ children, className }) {
  return (
    <div
      className={cn('relative rounded-2xl p-[1px]', className)}
      style={{ background: 'conic-gradient(from 0deg, #1E2A44, #F2A20C, #FBBF24, #F2A20C, #1E2A44)' }}
    >
      <div className="relative rounded-2xl bg-surface h-full">
        {children}
      </div>
    </div>
  )
}
