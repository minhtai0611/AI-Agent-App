import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useOracle } from '../context/OracleContext.jsx'
import { solveMath } from '../api/aiClient.js'
import { MathText } from './MathText.jsx'

export default function OracleDrawer() {
  const { isOpen, close, pageContext } = useOracle()
  const [input, setInput] = useState('')
  const [answer, setAnswer] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  // Pre-fill from exam question context whenever the drawer opens
  useEffect(() => {
    if (isOpen) {
      const q = pageContext?.currentQuestion?.question ?? ''
      setInput(q)
      setAnswer(null)
      setError(null)
      setTimeout(() => inputRef.current?.focus(), 120)
    }
  }, [isOpen, pageContext?.currentQuestion?.question])

  async function handleSolve(e) {
    e.preventDefault()
    if (!input.trim() || loading) return
    setLoading(true)
    setAnswer(null)
    setError(null)
    const { data, error: err } = await solveMath(input.trim())
    setLoading(false)
    if (data?.solution) {
      setAnswer(data.solution)
    } else {
      setError(typeof err === 'string' ? err : 'Không thể giải. Thử lại hoặc mở trang Oracle.')
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 z-40 bg-black/40"
          />
          {/* Drawer */}
          <motion.div
            key="drawer"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl"
            style={{ maxHeight: '75vh' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            <div className="flex items-center justify-between px-5 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground font-sans">✦ Zenith AI</span>
                <span className="font-sans text-[0.625rem] px-1.5 py-0.5 rounded-full bg-info/10 text-info">Trong bài thi</span>
              </div>
              <button onClick={close} className="font-sans text-xs text-dim hover:text-muted transition px-2 py-1">
                Đóng
              </button>
            </div>

            <div className="px-5 pb-6 flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: 'calc(75vh - 80px)' }}>
              <form onSubmit={handleSolve} className="flex flex-col gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  rows={3}
                  placeholder="Nhập câu hỏi hoặc dán đề bài vào đây…"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-surface-elevated font-sans text-[13px] text-foreground placeholder:text-faint focus:outline-none focus:border-primary/40 transition resize-none"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="self-end px-5 py-2 rounded-xl font-sans text-[13px] font-bold bg-primary text-primary-fg hover:opacity-90 transition disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 border border-primary-fg border-t-transparent rounded-full animate-spin" />
                      Đang giải…
                    </span>
                  ) : 'Giải ngay →'}
                </button>
              </form>

              {error && (
                <p className="font-sans text-[12px] text-destructive">{error}</p>
              )}

              {answer && (
                <div className="flex flex-col gap-2">
                  <span className="font-sans text-[0.6875rem] font-bold text-info uppercase tracking-wider">Lời giải</span>
                  <div className="p-4 rounded-xl bg-surface-elevated border border-border">
                    <MathText className="font-sans text-[13px] text-foreground leading-relaxed whitespace-pre-wrap">
                      {answer}
                    </MathText>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
