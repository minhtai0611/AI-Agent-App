import { useState } from 'react'

// Inline `style` props driven by CSS custom properties always beat a plain
// Tailwind `hover:` class in specificity, so hover effects have to be applied
// by merging into the same style object instead — see Landing.jsx's original
// hero hover fix. Shared here so every inline-styled interactive element can
// use the same pattern instead of re-deriving it per component.
export function useHoverState() {
  const [hovered, setHovered] = useState(false)
  return [hovered, { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) }]
}
