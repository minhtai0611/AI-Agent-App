import { cn } from '../../lib/utils.js'

// Shimmer sweep across text — for badges, tier labels, "Mới" tags.
export function AnimatedShinyText({ children, className, shimmerWidth = 100 }) {
  return (
    <span
      style={{ '--shw': `${shimmerWidth}px` }}
      className={cn(
        'relative inline-block',
        'animate-[shiny-text_3s_linear_infinite]',
        'bg-[length:var(--shw)_100%] bg-no-repeat',
        '[background-position:-100%_0]',
        'bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.7)_50%,transparent_100%),linear-gradient(var(--shiny-base,currentColor),var(--shiny-base,currentColor))]',
        'bg-clip-text text-transparent',
        className,
      )}
    >
      {children}
    </span>
  )
}
