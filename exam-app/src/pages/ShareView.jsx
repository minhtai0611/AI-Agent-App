import { useSearchParams, useNavigate } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { useHistory } from '../context/HistoryContext.jsx'
import { computeBadges } from '../utils/badges.js'

function parseReportData(raw) {
  if (!raw) return null
  try {
    return JSON.parse(decodeURIComponent(atob(raw)))
  } catch { return null }
}

function parseShareData(raw) {
  try {
    const d = JSON.parse(decodeURIComponent(raw))
    if (
      typeof d.s !== 'number' || d.s < 0 || d.s > 10 ||
      typeof d.c !== 'number' || d.c < 0 ||
      typeof d.t !== 'number' || d.t < 0 || d.c > d.t ||
      typeof d.e !== 'string' || d.e.length > 100 ||
      typeof d.dt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.dt)
    ) return null
    return d
  } catch { return null }
}

export default function ShareView() {
  usePageMeta('Kết quả chia sẻ', { noindex: true })
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { results } = useHistory()
  const data = parseShareData(params.get('d') || '')
  const topBadge = computeBadges(results)[0] ?? null

  // Parent report view (?report= param — base64+URI encoded JSON)
  const reportData = parseReportData(params.get('report'))
  if (reportData) {
    return (
      <div data-testid="parent-report-view" className="max-w-md mx-auto p-6 flex flex-col gap-4 min-h-screen">
        <h1 className="font-sans text-[20px] font-bold text-foreground">
          Báo cáo tiến độ học tập
        </h1>
        <p className="font-sans text-[13px] text-dim">
          Học sinh: <strong className="text-foreground">{reportData.name}</strong>
        </p>
        {reportData.grade && (
          <p className="font-sans text-[13px] text-dim">Lớp: <strong className="text-foreground">{reportData.grade}</strong></p>
        )}
        {reportData.province && (
          <p className="font-sans text-[13px] text-dim">Tỉnh: <strong className="text-foreground">{reportData.province}</strong></p>
        )}
        <p className="font-sans text-[13px] text-dim">
          Gói hiện tại: <strong className="text-foreground">{reportData.subscription_tier}</strong>
        </p>
        <p className="font-sans text-[11px] text-dim mt-2">
          Báo cáo tạo lúc: {reportData.generated_at ? new Date(reportData.generated_at).toLocaleString('vi-VN') : 'N/A'}
        </p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4 px-4">
        <span className="font-sans text-[20px] text-foreground">Link không hợp lệ</span>
        <p className="font-sans text-[13px] text-dim text-center">Link chia sẻ đã hết hạn hoặc bị thay đổi.</p>
        <button onClick={() => navigate('/')}
          className="px-6 py-2.5 rounded-xl bg-primary font-sans text-[13px] font-bold text-background">
          Về trang chủ
        </button>
      </div>
    )
  }

  const date = new Date(data.dt).toLocaleDateString('vi-VN')

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-6 px-4 py-12"
      style={{ background: 'var(--bg)' }}>

      {/* Card */}
      <div className="w-full max-w-sm rounded-2xl border border-surface p-8 flex flex-col gap-5"
        style={{ background: 'var(--surface)' }}>

        <div className="flex items-center justify-between">
          <span className="font-sans text-[12px] text-dim">Kết quả thi thử</span>
          <span className="font-sans text-[12px] text-dim">{date}</span>
        </div>

        <p className="font-sans text-[14px] font-semibold text-muted leading-snug">{data.e}</p>

        <div className="flex flex-col items-center gap-1 py-5">
          <span className="font-sans text-[72px] font-bold text-primary leading-none">{data.s.toFixed(1)}</span>
          <span className="font-sans text-[16px] text-dim">/ 10</span>
        </div>

        <div className="flex justify-around border-t border-surface pt-4">
          <div className="flex flex-col items-center gap-1">
            <span className="font-sans text-[20px] font-bold text-foreground">{data.c}/{data.t}</span>
            <span className="font-sans text-[11px] text-dim">Câu đúng</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="font-sans text-[20px] font-bold text-foreground">
              {data.t > 0 ? Math.round((data.c / data.t) * 100) : 0}%
            </span>
            <span className="font-sans text-[11px] text-dim">Độ chính xác</span>
          </div>
        </div>

        {topBadge && (
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-[16px]">{topBadge.icon}</span>
            <span className="font-sans text-[12px] text-muted">{topBadge.label}</span>
          </div>
        )}
        <p className="font-sans text-[10px] text-dim text-center">✦ exam-app-ey0.pages.dev · Không xác minh</p>
      </div>

      {/* CTA */}
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="font-sans text-[13px] text-dim">Bạn có thể đạt điểm cao hơn không?</p>
        <button
          onClick={() => navigate('/exams')}
          className="px-8 py-3 rounded-xl bg-primary font-sans text-[14px] font-bold text-background hover:opacity-90 transition"
        >
          Thi thử ngay →
        </button>
      </div>
    </div>
  )
}
