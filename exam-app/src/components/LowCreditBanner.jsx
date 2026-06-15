import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LowCreditBanner({ balance }) {
  const [dismissed, setDismissed] = useState(false)
  const navigate = useNavigate()

  if (dismissed) return null

  return (
    <div
      className="w-full flex items-center justify-between gap-3 px-5 py-2.5 font-sans text-xs bg-[var(--accent-subtle)] border-b border-[var(--accent-border)]"
    >
      <span className="text-[var(--accent)]">
        ⚡ Còn <strong>{balance}</strong> lượt hỏi AI — nạp thêm để tiếp tục sử dụng tính năng AI.
      </span>
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => navigate('/account#topup')}
          className="px-3 py-1 rounded-md font-semibold text-[0.6875rem] bg-[var(--primary)] text-[var(--primary-fg)]"
        >
          Nạp lượt
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-[var(--faint)] hover:text-[var(--fg-secondary)] text-base leading-none"
          aria-label="Đóng"
        >
          ×
        </button>
      </div>
    </div>
  )
}
