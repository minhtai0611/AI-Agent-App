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
]

export function FormulaDrawer() {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(0)

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-jakarta text-[12px] text-[#64748B] border border-[#1E2A44] hover:text-[#94A3B8] hover:border-[#2A3A5E] transition"
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
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#0D1221] border-t border-[#1E2A44] rounded-t-2xl px-4 pt-4 pb-8 max-h-[60vh] flex flex-col gap-3"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-jakarta text-[13px] font-semibold text-[#F8FAFC]">Bảng công thức</span>
                <button onClick={() => setOpen(false)} className="text-[#475569] hover:text-[#94A3B8] text-lg leading-none">✕</button>
              </div>

              {/* Tab bar */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {SHEETS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTab(i)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg font-jakarta text-[12px] font-medium transition"
                    style={activeTab === i
                      ? { background: '#1E2A44', color: '#F8FAFC' }
                      : { color: '#64748B' }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Formulas */}
              <div className="overflow-y-auto flex flex-col gap-2">
                {SHEETS[activeTab].formulas.map((f, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#141D2E]">
                    <span className="font-jakarta text-[11px] text-[#475569] pt-0.5 flex-shrink-0 w-28">{f.label}</span>
                    <span className="font-mono text-[13px] text-[#E2E8F0]">{f.text}</span>
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
