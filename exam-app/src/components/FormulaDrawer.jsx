import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const SHEETS = [
  {
    label: 'Lượng giác',
    formulas: [
      { label: 'sin(A±B)', text: 'sin(A±B) = sinA·cosB ± cosA·sinB' },
      { label: 'cos(A±B)', text: 'cos(A±B) = cosA·cosB ∓ sinA·sinB' },
      { label: 'Hạ bậc sin²', text: 'sin²x = (1 − cos2x) / 2' },
      { label: 'Hạ bậc cos²', text: 'cos²x = (1 + cos2x) / 2' },
      { label: 'sin²+cos²', text: 'sin²x + cos²x = 1' },
    ],
  },
  {
    label: 'Logarit',
    formulas: [
      { label: 'Đổi cơ số', text: 'logₐb = ln b / ln a' },
      { label: 'logₐ(mn)', text: 'logₐ(mn) = logₐm + logₐn' },
      { label: 'logₐ(m/n)', text: 'logₐ(m/n) = logₐm − logₐn' },
      { label: 'logₐ(mⁿ)', text: 'logₐ(mⁿ) = n · logₐm' },
    ],
  },
  {
    label: 'Hình học',
    formulas: [
      { label: 'Diện tích tam giác', text: 'S = (1/2) · a · h' },
      { label: 'Định lý cosin', text: 'a² = b² + c² − 2bc·cosA' },
      { label: 'Diện tích hình tròn', text: 'S = πr²' },
      { label: 'Chu vi hình tròn', text: 'C = 2πr' },
    ],
  },
  {
    label: 'Đại số',
    formulas: [
      { label: '(a+b)²', text: '(a+b)² = a² + 2ab + b²' },
      { label: '(a−b)²', text: '(a−b)² = a² − 2ab + b²' },
      { label: 'a²−b²', text: 'a² − b² = (a+b)(a−b)' },
      { label: 'Nghiệm bậc 2', text: 'x = (−b ± √(b²−4ac)) / 2a' },
    ],
  },
  {
    label: 'Giải tích',
    formulas: [
      { label: "(xⁿ)'",    text: "(xⁿ)' = n·xⁿ⁻¹" },
      { label: "(√x)'",    text: "(√x)' = 1 / (2√x)" },
      { label: "(eˣ)'",    text: "(eˣ)' = eˣ" },
      { label: "(ln x)'",  text: "(ln x)' = 1/x" },
      { label: "(sin x)'", text: "(sin x)' = cos x" },
      { label: "(cos x)'", text: "(cos x)' = −sin x" },
      { label: "∫xⁿ dx",  text: "∫xⁿ dx = xⁿ⁺¹/(n+1) + C" },
    ],
  },
  {
    label: 'Tổ hợp',
    formulas: [
      { label: 'Hoán vị',    text: 'Pₙ = n!' },
      { label: 'Chỉnh hợp', text: 'Aₙᵏ = n! / (n−k)!' },
      { label: 'Tổ hợp',    text: 'Cₙᵏ = n! / (k!·(n−k)!)' },
      { label: 'Xác suất',  text: 'P(A) = m / n' },
      { label: 'Nhị thức',  text: '(a+b)ⁿ = Σ Cₙᵏ·aⁿ⁻ᵏ·bᵏ' },
    ],
  },
  {
    label: 'Dãy số',
    formulas: [
      { label: 'CSC — uₙ',   text: 'uₙ = u₁ + (n−1)·d' },
      { label: 'CSC — Sₙ',   text: 'Sₙ = n·(u₁ + uₙ) / 2' },
      { label: 'CSN — uₙ',   text: 'uₙ = u₁·qⁿ⁻¹' },
      { label: 'CSN — Sₙ',   text: 'Sₙ = u₁·(qⁿ − 1) / (q − 1)' },
      { label: 'Tổng ∞ CSN', text: 'S∞ = u₁ / (1 − q),  |q| < 1' },
    ],
  },
]

export function FormulaDrawer() {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(0)

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-sans text-xs text-dim border border-border hover:text-muted hover:border-border-subtle transition"
      >
        📋 Công thức
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl px-4 pt-4 pb-8 max-h-[60vh] flex flex-col gap-3"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0.05, bottom: 0.2 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 80) setOpen(false)
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-sans text-[0.8125rem] font-semibold text-foreground">Bảng công thức</span>
                <button onClick={() => setOpen(false)} className="text-faint hover:text-muted text-lg leading-none">✕</button>
              </div>

              {/* Tab bar */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {SHEETS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTab(i)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg font-sans text-xs font-medium transition"
                    style={activeTab === i
                      ? { background: 'var(--primary)', color: 'var(--primary-fg)' }
                      : { color: '#64748B' }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Formulas */}
              <div className="overflow-y-auto flex flex-col gap-2">
                {SHEETS[activeTab].formulas.map((f, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-surface">
                    <span className="font-sans text-[0.6875rem] text-faint pt-0.5 flex-shrink-0 w-28">{f.label}</span>
                    <span className="font-mono text-[0.8125rem] text-foreground">{f.text}</span>
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
