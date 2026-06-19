import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta.js'

function parseChallengeData(raw) {
  try {
    const d = JSON.parse(decodeURIComponent(raw))
    if (
      typeof d.name !== 'string' || d.name.length > 50 ||
      typeof d.score !== 'number' || d.score < 0 || d.score > 10 ||
      typeof d.examId !== 'string' || d.examId.length > 60 ||
      typeof d.dt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.dt)
    ) return null
    return d
  } catch { return null }
}

export default function ChallengeLanding() {
  usePageMeta('Thách đấu', { noindex: true })
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const challenger = parseChallengeData(params.get('c') || '')

  function copyLink() {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  if (!challenger) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4 px-4">
        <span className="font-sans text-[20px] text-foreground">Link không hợp lệ</span>
        <button onClick={() => navigate('/')}
          className="px-6 py-2.5 rounded-xl bg-primary font-sans text-[13px] font-bold text-background">
          Về trang chủ
        </button>
      </div>
    )
  }

  const scoreColor = challenger.score >= 8 ? '#10B981' : challenger.score >= 6 ? '#F2A20C' : '#FB7185'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 py-12"
      style={{ background: 'var(--bg)' }}>

      {/* Challenge card */}
      <div className="w-full max-w-sm rounded-2xl p-px"
        style={{ background: `linear-gradient(135deg, ${scoreColor}40, transparent)` }}>
        <div className="rounded-2xl p-8 flex flex-col gap-5 text-center"
          style={{ background: 'var(--surface)' }}>
          <div className="flex flex-col items-center gap-1">
            <span className="font-sans text-[11px] font-bold text-dim uppercase tracking-[3px]">Thách đấu trực tiếp</span>
            <span className="text-2xl mt-1">⚔️</span>
          </div>

          <div>
            <p className="font-sans text-[16px] font-semibold text-foreground">{challenger.name}</p>
            <p className="font-sans text-[13px] text-dim mt-0.5">thách bạn vượt điểm này</p>
          </div>

          {/* Score display */}
          <div className="flex flex-col items-center gap-0.5 py-2">
            <span className="font-sans text-[80px] font-bold leading-none" style={{ color: scoreColor }}>
              {challenger.score.toFixed(1)}
            </span>
            <span className="font-sans text-[14px] text-dim">/ 10 điểm</span>
          </div>

          {/* Score context bar */}
          <div className="w-full bg-surface rounded-full overflow-hidden h-1.5">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${(challenger.score / 10) * 100}%`, background: scoreColor }} />
          </div>

          <div className="flex justify-between font-sans text-[11px] text-dim">
            <span>{challenger.dt}</span>
            <span>Đề: {challenger.examId}</span>
          </div>

          <p className="font-sans text-[10px] text-dim/60">Không xác minh chính thức · Dữ liệu tự khai báo</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="w-full max-w-sm flex flex-col gap-3">
        <button
          onClick={() => navigate(`/test/${challenger.examId}`, {
            state: { challengerScore: challenger.score, challengerName: challenger.name },
          })}
          className="w-full px-6 py-4 rounded-xl font-sans text-[15px] font-bold text-background hover:opacity-90 transition"
          style={{ background: scoreColor }}>
          Nhận thách đấu →
        </button>

        <button
          onClick={copyLink}
          className="w-full px-6 py-3 rounded-xl font-sans text-[13px] font-semibold text-dim border border-surface hover:border-info hover:text-info transition">
          {copied ? '✓ Đã sao chép link' : 'Sao chép link thách đấu'}
        </button>
      </div>

      <p className="font-sans text-[11px] text-dim text-center max-w-xs">
        Chia sẻ link này với bạn bè để họ cùng thử sức trên đề thi {challenger.examId}.
      </p>
    </div>
  )
}
