import { createContext, useContext, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), [])

  const show = useCallback((msg, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
    return id
  }, [])

  const success = useCallback(msg => show(msg, 'success'), [show])
  const error = useCallback(msg => show(msg, 'error'), [show])
  const info = useCallback(msg => show(msg, 'info'), [show])

  return (
    <ToastContext.Provider value={{ success, error, info, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

const TYPE_STYLES = {
  success: { bg: '#0D2A1A', border: '#10B981', icon: '✓', color: '#10B981' },
  error:   { bg: '#2A0F14', border: '#FB7185', icon: '✕', color: '#FB7185' },
  info:    { bg: '#0D1526', border: '#6366F1', icon: 'ℹ', color: '#818CF8' },
}

function ToastContainer({ toasts, dismiss }) {
  return (
    <div className="fixed bottom-6 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => {
          const s = TYPE_STYLES[t.type] ?? TYPE_STYLES.info
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 40, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              onClick={() => dismiss(t.id)}
              className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg cursor-pointer"
              style={{
                background: s.bg, borderColor: s.border,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                maxWidth: 320, minWidth: 200,
              }}
            >
              <span className="text-[14px] flex-shrink-0" style={{ color: s.color }}>{s.icon}</span>
              <span className="font-jakarta text-[13px] text-[#F0F4FF] leading-snug">{t.msg}</span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
