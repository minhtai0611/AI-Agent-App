import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from './ui/button.jsx'
import { Alert } from './ui/alert.jsx'

export default function LowCreditBanner({ balance }) {
  const [dismissed, setDismissed] = useState(false)
  const navigate = useNavigate()

  if (dismissed) return null

  return (
    <Alert className="w-full flex items-center justify-between gap-3 px-5 py-2.5 rounded-none border-x-0 border-t-0 border-b border-[var(--accent-border)] bg-[var(--accent-subtle)] font-sans text-xs">
      <span className="text-[var(--accent)]">
        ⚡ Còn <strong>{balance}</strong> lượt hỏi AI — nạp thêm để tiếp tục sử dụng tính năng AI.
      </span>
      <div className="flex items-center gap-3 flex-shrink-0">
        <Button
          size="sm"
          onClick={() => navigate('/account#topup')}
          className="text-[0.6875rem] font-semibold"
        >
          Nạp lượt
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="text-[var(--faint)] hover:text-[var(--fg-secondary)] text-base leading-none"
          aria-label="Đóng"
        >
          ×
        </button>
      </div>
    </Alert>
  )
}
