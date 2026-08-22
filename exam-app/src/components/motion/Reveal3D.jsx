import { cn } from '../../lib/utils'
import { useGsapReveal } from '../../hooks/useGsapReveal'
import { useTilt3D } from '../../hooks/useTilt3D'

/**
 * Declarative Tier 1/2 motion wrapper — pages consume this component instead
 * of wiring raw hooks per-element, so GSAP usage stays consistent across the
 * app (see the Vantage rebrand blueprint's "reusable primitives" section).
 *
 * variant:
 *  - "rise": scroll-triggered fade + rise (default; replaces useRevealOnScroll)
 *  - "tilt": scroll-triggered 3D tilt-in entrance
 *  - "hover-tilt": always-mounted pointer-driven 3D tilt (Tier 1 card treatment)
 */
export function Reveal3D({ as: Tag = 'div', variant = 'rise', amount, className, style, children, ...rest }) {
  const isHoverTilt = variant === 'hover-tilt'
  const reveal = useGsapReveal(isHoverTilt ? { variant: 'none' } : { variant, amount })
  const tilt = useTilt3D()

  if (isHoverTilt) {
    return (
      <Tag
        ref={tilt.ref}
        className={cn(className)}
        style={{ perspective: 'var(--perspective-md)', transformStyle: 'preserve-3d', ...style }}
        {...tilt.handlers}
        {...rest}
      >
        {children}
      </Tag>
    )
  }

  return (
    <Tag
      ref={reveal.ref}
      className={cn(className)}
      style={{ perspective: 'var(--perspective-md)', transformStyle: 'preserve-3d', ...style }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
