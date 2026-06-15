import { useState, useEffect, useRef } from 'react'

const COST_TABLE = [
  { action: '1 gợi ý AI',    cost: '1 lượt' },
  { action: '1 giải thích',   cost: '1 lượt' },
  { action: '1 phân tích đề', cost: '3 lượt' },
  { action: '1 kế hoạch',     cost: '5 lượt' },
]

export default function CreditsTooltip({ userId, creditsBalance, onDismiss }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!userId) return
    const seen = localStorage.getItem(`ai_tooltip_seen_${userId}`)
    if (!seen) setVisible(true)
  }, [userId])

  function dismiss() {
    if (userId) localStorage.setItem(`ai_tooltip_seen_${userId}`, 'true')
    setVisible(false)
    onDismiss?.()
  }

  if (!visible) return null

  return (
    <div
      data-testid="credits-tooltip"
      className="absolute top-full right-0 mt-2 z-50 w-64 bg-surface border border-border rounded-xl shadow-lg p-4 flex flex-col gap-3"
    >
      <p className="font-sans text-[13px] font-semibold text-foreground">
        Bạn có {creditsBalance} lượt hỏi AI miễn phí
      </p>
      <table className="w-full text-[11px]">
        <tbody>
          {COST_TABLE.map(row => (
            <tr key={row.action}>
              <td className="text-dim py-0.5">{row.action}</td>
              <td className="text-right font-semibold text-foreground py-0.5">{row.cost}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={dismiss}
        className="font-sans text-[12px] font-semibold text-primary text-left"
      >
        Đã hiểu →
      </button>
    </div>
  )
}
