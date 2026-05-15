import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LowCreditBanner({ balance }) {
  const [dismissed, setDismissed] = useState(false)
  const navigate = useNavigate()

  if (dismissed) return null

  return (
    <div
      className="w-full flex items-center justify-between gap-3 px-5 py-2.5 font-jakarta text-[12px]"
      style={{ background: '#1A1200', borderBottom: '1px solid #F2A20C33' }}
    >
      <span className="text-amber-300">
        ⚡ Còn <strong>{balance}</strong> AI Điểm — mua top-up để tiếp tục sử dụng tính năng AI.
      </span>
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => navigate('/account#topup')}
          className="px-3 py-1 rounded-md font-semibold text-[11px]"
          style={{ background: '#F2A20C', color: '#0A0E1A' }}
        >
          Mua thêm
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-[#475569] hover:text-gray-300 text-base leading-none"
          aria-label="Đóng"
        >
          ×
        </button>
      </div>
    </div>
  )
}
