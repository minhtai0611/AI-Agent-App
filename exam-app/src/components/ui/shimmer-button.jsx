import { cn } from '../../lib/utils.js'

// CTA button with a traveling shimmer highlight.
export function ShimmerButton({
  children,
  className,
  shimmerColor = 'rgba(255,255,255,0.15)',
  shimmerSize = '0.1em',
  shimmerDuration = '2s',
  borderRadius = '12px',
  background = 'linear-gradient(135deg, #1a1200, #0D1221)',
  onClick,
  disabled,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        '--shimmer-color': shimmerColor,
        '--shimmer-size': shimmerSize,
        '--shimmer-duration': shimmerDuration,
        '--border-radius': borderRadius,
        '--background': background,
        borderRadius,
        background,
      }}
      className={cn(
        'relative isolate overflow-hidden cursor-pointer',
        'border border-amber-500/30',
        'px-6 py-2.5 font-jakarta font-semibold text-amber-200',
        'transition-all duration-300',
        'hover:border-amber-400/50 hover:brightness-110',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'after:absolute after:inset-0 after:-z-10',
        'after:translate-x-[-100%]',
        'after:animate-[shimmer-slide_var(--shimmer-duration)_ease-in-out_infinite]',
        'after:bg-[linear-gradient(90deg,transparent_0%,var(--shimmer-color)_50%,transparent_100%)]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
