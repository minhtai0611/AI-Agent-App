import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const STEPS = [
  {
    id: 'diagnostic',
    label: 'Kiểm tra năng lực',
    detail: 'Luminary cần biết điểm yếu của bạn — chỉ mất 5 phút.',
    cta: 'Kiểm tra ngay →',
    path: '/practice/diagnostic',
  },
  {
    id: 'first_exam',
    label: 'Làm bài thi đầu tiên',
    detail: 'Chọn đề thi thật theo tỉnh của bạn.',
    cta: 'Chọn đề thi →',
    path: '/exams',
  },
  {
    id: 'ai_insights',
    label: 'Xem phân tích AI',
    detail: 'AI tìm đúng chỗ bạn hay sai nhất.',
    cta: 'Xem phân tích →',
    path: '/results',
  },
]

export default function WelcomePanel({ userId, diagnosticDone, hasExams, aiInsightViewed, onDismiss }) {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!userId) return
    const stored = localStorage.getItem(`welcome_checklist_${userId}`)
    if (stored) {
      try { if (JSON.parse(stored).dismissed) setDismissed(true) } catch {}
    }
  }, [userId])

  function handleDismiss() {
    if (userId) localStorage.setItem(`welcome_checklist_${userId}`, JSON.stringify({ dismissed: true }))
    setDismissed(true)
    onDismiss?.()
  }

  const stepDone = { diagnostic: diagnosticDone, first_exam: hasExams, ai_insights: aiInsightViewed }
  const allDone = Object.values(stepDone).every(Boolean)

  if (dismissed || allDone) return null

  return (
    <div data-testid="welcome-panel" className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-dim">Bắt đầu với Luminary</span>
        <button onClick={handleDismiss} className="font-sans text-[11px] text-dim hover:text-muted">Bỏ qua</button>
      </div>
      <div className="flex flex-col gap-3">
        {STEPS.map(step => {
          const done = stepDone[step.id]
          const isThirdDisabled = step.id === 'ai_insights' && !hasExams
          return (
            <div key={step.id} className={`flex items-start gap-3 ${done ? 'opacity-50' : ''}`}>
              <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${done ? 'bg-primary border-primary' : 'border-border'}`}>
                {done && <span className="text-background text-[9px] font-bold">✓</span>}
              </div>
              <div className="flex-1 flex flex-col gap-0.5">
                <span className={`font-sans text-[13px] font-semibold ${done ? 'line-through text-dim' : 'text-foreground'}`}>{step.label}</span>
                {!done && <p className="font-sans text-[11px] text-dim">{step.detail}</p>}
                {!done && !isThirdDisabled && (
                  <button
                    onClick={() => navigate(step.path)}
                    className="font-sans text-[11px] font-semibold text-primary text-left mt-1"
                  >
                    {step.cta}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
