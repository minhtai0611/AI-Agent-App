import { cn } from '../../lib/utils.js'

// Animated light beam that travels around a card's border.
// Parent must have position:relative and overflow:hidden.
export function BorderBeam({
  className,
  size = 200,
  duration = 8,
  borderWidth = 1.5,
  colorFrom = '#F2A20C',
  colorTo = '#FBBF24',
  delay = 0,
}) {
  return (
    <div
      style={{
        '--size': size,
        '--duration': duration,
        '--border-width': borderWidth,
        '--color-from': colorFrom,
        '--color-to': colorTo,
        '--delay': `-${delay}s`,
      }}
      className={cn(
        'pointer-events-none absolute inset-0 rounded-[inherit]',
        '[border:calc(var(--border-width)*1px)_solid_transparent]',
        '![mask-clip:padding-box,border-box]',
        '![mask-composite:intersect]',
        '[mask:linear-gradient(transparent,transparent),linear-gradient(white,white)]',
        'after:absolute after:aspect-square after:w-[calc(var(--size)*1px)]',
        'after:animate-[border-beam_calc(var(--duration)*1s)_infinite_linear]',
        'after:[animation-delay:var(--delay)]',
        'after:[background:linear-gradient(to_left,var(--color-from),var(--color-to),transparent)]',
        'after:[offset-anchor:calc(var(--size)*0.2px)_50%]',
        'after:[offset-path:rect(0_auto_auto_0_round_calc(var(--size)*1px))]',
        className,
      )}
    />
  )
}
