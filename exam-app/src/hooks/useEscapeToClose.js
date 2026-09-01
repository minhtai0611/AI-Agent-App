import { useEffect } from 'react'

// Shared Escape-to-close behavior for the .vtg-overlay modal system (spec 10).
export function useEscapeToClose(active, onClose) {
  useEffect(() => {
    if (!active) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, onClose])
}
