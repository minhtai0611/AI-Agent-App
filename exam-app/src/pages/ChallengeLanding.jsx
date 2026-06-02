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
  const challenger = parseChallengeData(params.get('c') || '')

  if (!challenger) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center gap-4 px-4">
        <span className="font-fraunces text-[20px] text-[#F8FAFC]">Link không hợp lệ</span>
        <button onClick={() => navigate('/')}
          className="px-6 py-2.5 rounded-xl bg-[#F2A20C] font-jakarta text-[13px] font-bold text-[#0A0E1A]">
          Về trang chủ
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center gap-6 px-4 py-12"
      style={{ background: 'radial-gradient(ellipse 120% 80% at 50% 20%, #1B2B4B 0%, #0A0E1A 100%)' }}>

      <div className="w-full max-w-sm rounded-2xl border border-[#F2A20C33] p-8 flex flex-col gap-5 text-center"
        style={{ background: 'linear-gradient(135deg, #0D1221 0%, #0A0E1A 100%)' }}>
        <span className="font-jakarta text-[12px] text-[#64748B] uppercase tracking-widest">Thách đấu</span>
        <p className="font-jakarta text-[15px] font-semibold text-[#F8FAFC]">
          {challenger.name} <span className="text-[#64748B]">đã đạt</span>
        </p>
        <div className="flex flex-col items-center gap-1 py-4">
          <span className="font-fraunces text-[72px] font-bold text-[#F2A20C] leading-none">
            {challenger.score.toFixed(1)}
          </span>
          <span className="font-jakarta text-[16px] text-[#475569]">/ 10</span>
        </div>
        <p className="font-jakarta text-[14px] text-[#94A3B8]">Bạn có thể vượt qua không?</p>
        <p className="font-jakarta text-[10px] text-[#2A3A50]">Không xác minh · Dữ liệu tự khai báo</p>
      </div>

      <button
        onClick={() => navigate(`/test/${challenger.examId}`, { state: { challengerScore: challenger.score, challengerName: challenger.name } })}
        className="px-10 py-3.5 rounded-xl bg-[#F2A20C] font-jakarta text-[15px] font-bold text-[#0A0E1A] hover:opacity-90 transition"
      >
        Nhận thách đấu →
      </button>
    </div>
  )
}
