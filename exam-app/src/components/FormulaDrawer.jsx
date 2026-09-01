import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MathText } from './MathText.jsx'
import { useEscapeToClose } from '../hooks/useEscapeToClose.js'

const SHEETS = [
  {
    label: 'Lượng giác',
    formulas: [
      { label: 'sin(A±B)', tex: '\\sin(A\\pm B) = \\sin A\\cos B \\pm \\cos A\\sin B' },
      { label: 'cos(A±B)', tex: '\\cos(A\\pm B) = \\cos A\\cos B \\mp \\sin A\\sin B' },
      { label: 'Hạ bậc sin²', tex: '\\sin^2 x = \\dfrac{1-\\cos 2x}{2}' },
      { label: 'Hạ bậc cos²', tex: '\\cos^2 x = \\dfrac{1+\\cos 2x}{2}' },
      { label: 'sin²+cos²', tex: '\\sin^2 x + \\cos^2 x = 1' },
    ],
  },
  {
    label: 'Logarit',
    formulas: [
      { label: 'Đổi cơ số', tex: '\\log_a b = \\dfrac{\\ln b}{\\ln a}' },
      { label: 'logₐ(mn)', tex: '\\log_a(mn) = \\log_a m + \\log_a n' },
      { label: 'logₐ(m/n)', tex: '\\log_a\\!\\left(\\dfrac{m}{n}\\right) = \\log_a m - \\log_a n' },
      { label: 'logₐ(mⁿ)', tex: '\\log_a(m^n) = n\\log_a m' },
    ],
  },
  {
    label: 'Hình học',
    formulas: [
      { label: 'Diện tích tam giác', tex: 'S = \\dfrac12\\, a \\cdot h' },
      { label: 'Định lý cosin', tex: 'a^2 = b^2+c^2-2bc\\cos A' },
      { label: 'Diện tích hình tròn', tex: 'S = \\pi r^2' },
      { label: 'Chu vi hình tròn', tex: 'C = 2\\pi r' },
    ],
  },
  {
    label: 'Đại số',
    formulas: [
      { label: '(a+b)²', tex: '(a+b)^2 = a^2+2ab+b^2' },
      { label: '(a−b)²', tex: '(a-b)^2 = a^2-2ab+b^2' },
      { label: 'a²−b²', tex: 'a^2-b^2=(a+b)(a-b)' },
      { label: 'Nghiệm bậc 2', tex: 'x = \\dfrac{-b\\pm\\sqrt{b^2-4ac}}{2a}' },
    ],
  },
  {
    label: 'Giải tích',
    formulas: [
      { label: "(xⁿ)′",    tex: "(x^n)' = nx^{n-1}" },
      { label: "(√x)′",    tex: "(\\sqrt{x})' = \\dfrac{1}{2\\sqrt{x}}" },
      { label: "(eˣ)′",    tex: "(e^x)' = e^x" },
      { label: "(ln x)′",  tex: "(\\ln x)' = \\dfrac{1}{x}" },
      { label: "(sin x)′", tex: "(\\sin x)' = \\cos x" },
      { label: "(cos x)′", tex: "(\\cos x)' = -\\sin x" },
      { label: "∫xⁿ dx",  tex: "\\int x^n\\,dx = \\dfrac{x^{n+1}}{n+1}+C" },
    ],
  },
  {
    label: 'Tổ hợp',
    formulas: [
      { label: 'Hoán vị',    tex: 'P_n = n!' },
      { label: 'Chỉnh hợp', tex: 'A_n^k = \\dfrac{n!}{(n-k)!}' },
      { label: 'Tổ hợp',    tex: 'C_n^k = \\dfrac{n!}{k!(n-k)!}' },
      { label: 'Xác suất',  tex: 'P(A) = \\dfrac{m}{n}' },
      { label: 'Nhị thức',  tex: '(a+b)^n = \\sum_{k=0}^{n} C_n^k a^{n-k}b^k' },
    ],
  },
  {
    label: 'Dãy số',
    formulas: [
      { label: 'CSC — uₙ',   tex: 'u_n = u_1 + (n-1)d' },
      { label: 'CSC — Sₙ',   tex: 'S_n = \\dfrac{n(u_1+u_n)}{2}' },
      { label: 'CSN — uₙ',   tex: 'u_n = u_1 \\cdot q^{\\,n-1}' },
      { label: 'CSN — Sₙ',   tex: 'S_n = \\dfrac{u_1(q^n-1)}{q-1}' },
      { label: 'Tổng ∞ CSN', tex: 'S_\\infty = \\dfrac{u_1}{1-q}\\ \\ (|q|<1)' },
    ],
  },
]

export function FormulaDrawer() {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(0)

  useEscapeToClose(open, () => setOpen(false))

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 w-full px-3 py-2.5 transition-colors"
        style={{
          fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.04em',
          color: 'var(--ink-2)', border: '1px solid var(--line)', background: 'var(--paper)',
          borderRadius: 'var(--r-sm)',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 3h11l3 3v15H5z" />
          <path d="M16 3v3h3" />
          <path d="M8 10h8M8 13.5h8M8 17h5" />
        </svg>
        SỔ TRA CỨU CÔNG THỨC TRẮC ĐỊA
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="vtg-overlay"
              style={{ padding: 0, alignItems: 'flex-end', justifyContent: 'center' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              role="dialog" aria-label="Sổ tra cứu công thức trắc địa"
              className="fixed bottom-0 left-0 right-0 z-50 flex flex-col gap-3 px-4 pt-4 pb-6 max-h-[70vh] sm:max-w-lg sm:left-1/2 sm:bottom-6 sm:rounded-lg"
              style={{
                background: 'var(--paper)', borderTop: '3px solid var(--ink)',
                border: '1px solid var(--line)', borderRadius: '8px 8px 0 0',
                boxShadow: '0 20px 48px -12px rgba(0,0,0,0.35)',
              }}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0.05, bottom: 0.2 }}
              onDragEnd={(_, info) => { if (info.offset.y > 80) setOpen(false) }}
            >
              <div className="flex items-center justify-between" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
                <span className="vtg-modal-kicker" style={{ marginBottom: 0 }}>
                  SỔ TAY CÔNG THỨC BỎ TÚI
                </span>
                <button onClick={() => setOpen(false)} aria-label="Đóng" className="vtg-modal-close">✕</button>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-1" role="tablist">
                {SHEETS.map((s, i) => (
                  <button
                    key={i}
                    role="tab"
                    aria-selected={activeTab === i}
                    onClick={() => setActiveTab(i)}
                    className="flex-shrink-0 pb-1.5 transition-colors"
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.03em',
                      color: activeTab === i ? 'var(--ink)' : 'var(--ink-3)',
                      fontWeight: activeTab === i ? 600 : 400,
                      borderBottom: activeTab === i ? '2px solid var(--accent)' : '2px solid transparent',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="overflow-y-auto flex flex-col">
                {SHEETS[activeTab].formulas.map((f, i) => (
                  <div
                    key={i}
                    className="grid items-center gap-3 py-2.5"
                    style={{ gridTemplateColumns: '108px 1fr', borderTop: i === 0 ? 'none' : '1px solid var(--line-soft)' }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{f.label}</span>
                    <MathText style={{ fontSize: 15, color: 'var(--ink)' }}>{`$${f.tex}$`}</MathText>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
