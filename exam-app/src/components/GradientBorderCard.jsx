import { cn } from '../lib/utils.js'

// Static conic-gradient border wrapper for featured CTAs and highlighted cards.
// The inner div uses bg-[#0D1221] to match the app's surface-elevated color.
export function GradientBorderCard({ children, className }) {
  return (
    <div
      className={cn('relative rounded-2xl p-[1px]', className)}
      style={{ background: 'conic-gradient(from 0deg, #1E2A44, #F2A20C, #FBBF24, #F2A20C, #1E2A44)' }}
    >
      <div className="relative rounded-2xl bg-[#0D1221] h-full">
        {children}
      </div>
    </div>
  )
}
