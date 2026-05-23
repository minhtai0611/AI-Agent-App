import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext.jsx'
import { getAdaptiveStudyPlan } from '../api/aiClient.js'
import { pageVariants } from '../utils/animations.js'
import { usePageTitle } from '../hooks/usePageTitle.js'

const STAGE_COLORS = [
  '#475569', // 0 unknown
  '#60A5FA', // 1 introduced
  '#F2A20C', // 2 attempting
  '#FBBF24', // 3 practicing
  '#34D399', // 4 solid
  '#10B981', // 5 mastered
]
const STAGE_LABELS = ['Chưa học', 'Mới tiếp cận', 'Đang học', 'Luyện tập', 'Vững', 'Thành thạo']

function MasteryBar({ score, stage }) {
  const color = STAGE_COLORS[stage] ?? STAGE_COLORS[0]
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-[#1E2A44] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="font-jakarta text-[10px] min-w-[28px] text-right" style={{ color: color + 'CC' }}>
        {score}%
      </span>
    </div>
  )
}

function TrajectoryCard({ plan }) {
  const color = plan.on_track ? '#10B981' : '#F2A20C'
  const border = plan.on_track ? '#0A7A3A' : '#7A5500'
  const bg = plan.on_track ? '#052A1A' : '#1A1505'

  return (
    <div className="rounded-2xl border px-5 py-4 flex flex-col gap-3" style={{ background: bg, borderColor: border }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-fraunces text-[28px] font-bold" style={{ color }}>
            {plan.predicted_score?.toFixed(1) ?? '—'}
          </span>
          <div className="flex flex-col gap-0">
            <span className="font-jakarta text-[11px] font-semibold" style={{ color }}>
              {plan.on_track ? '↗ Đúng hướng' : '⚠ Cần tăng tốc'}
            </span>
            <span className="font-jakarta text-[10px] text-[#475569]">dự kiến kỳ thi</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="font-fraunces text-[20px] font-bold text-[#F8FAFC]">{plan.solid_count}</span>
          <span className="font-jakarta text-[10px] text-[#475569]">/ {plan.total_concepts} vững</span>
        </div>
      </div>

      {plan.days_remaining != null && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-[#1E2A44] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (plan.solid_count / Math.max(plan.total_concepts, 1)) * 100)}%`,
                background: `linear-gradient(90deg, ${color}, ${color}AA)`,
              }}
            />
          </div>
          <span className="font-jakarta text-[11px] text-[#475569]">còn {plan.days_remaining} ngày</span>
        </div>
      )}

      <p className="font-jakarta text-[12px] leading-relaxed" style={{ color: color + 'CC' }}>
        {plan.trajectory_message}
      </p>
    </div>
  )
}

function FocusConceptCard({ concept }) {
  const color = STAGE_COLORS[concept.stage] ?? STAGE_COLORS[0]
  return (
    <div className="flex flex-col gap-2 px-3 py-2.5 rounded-xl border border-[#1E2A44] bg-[#0D1221]">
      <div className="flex items-start justify-between gap-2">
        <span className="font-jakarta text-[12px] font-semibold text-[#F0F4FF] leading-tight">
          {concept.name_vi}
        </span>
        <span className="font-jakarta text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0"
          style={{ color, background: color + '20' }}>
          {STAGE_LABELS[concept.stage]}
        </span>
      </div>
      <MasteryBar score={concept.mastery_score} stage={concept.stage} />
      {concept.error_types.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {concept.error_types.map(t => (
            <span key={t} className="font-jakarta text-[10px] text-[#FB7185] px-1.5 py-0.5 rounded bg-[#FB718514]">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function WeekSchedule({ week }) {
  const [open, setOpen] = useState(week.week === 1)
  return (
    <div className="rounded-2xl border border-[#1E2A44] bg-[#0D1221] overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#111827] transition"
      >
        <div className="flex items-center gap-3">
          <span className="font-fraunces text-[14px] font-bold text-[#F8FAFC]">Tuần {week.week}</span>
          <div className="flex gap-1.5">
            {week.focus_concepts.map(c => (
              <span key={c.concept_id} className="font-jakarta text-[11px] text-[#475569]">
                {c.name_vi}
              </span>
            )).reduce((acc, el, i) => (i === 0 ? [el] : [...acc, <span key={`sep-${i}`} className="text-[#1E2A44]">·</span>, el]), [])}
          </div>
        </div>
        <span className="font-jakarta text-[12px] text-[#475569]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 flex flex-col gap-3 border-t border-[#1E2A44]">
          {/* Focus concepts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3">
            {week.focus_concepts.map(c => (
              <FocusConceptCard key={c.concept_id} concept={c} />
            ))}
          </div>

          {/* Daily plan */}
          <div className="flex flex-col gap-1.5 pt-1">
            <span className="font-jakarta text-[11px] font-semibold text-[#475569] uppercase tracking-wider">
              Kế hoạch tuần
            </span>
            {week.daily_plan.map(({ day, items }) => (
              <div key={day} className="flex items-start gap-3 py-2 border-b border-[#1E2A44] last:border-0">
                <span className="font-jakarta text-[11px] font-semibold text-[#475569] w-14 shrink-0 pt-0.5">
                  {day}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((item, i) => {
                    if (item.type === 'sm2') {
                      return (
                        <span key={i} className="font-jakarta text-[11px] text-[#34D399] px-2 py-0.5 rounded-md bg-[#34D39914] border border-[#34D39930]">
                          📋 {item.label}
                        </span>
                      )
                    }
                    if (item.type === 'challenge') {
                      return (
                        <span key={i} className="font-jakarta text-[11px] text-[#F2A20C] px-2 py-0.5 rounded-md bg-[#F2A20C14] border border-[#F2A20C30]">
                          ⚡ {item.label}
                        </span>
                      )
                    }
                    return (
                      <span key={i} className="font-jakarta text-[11px] text-[#818CF8] px-2 py-0.5 rounded-md bg-[#6366F114] border border-[#6366F130]">
                        ✦ {item.name_vi}
                      </span>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdaptiveStudyPlan() {
  usePageTitle('Kế hoạch học thích nghi')
  const navigate = useNavigate()
  const { user } = useAuth()
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    getAdaptiveStudyPlan()
      .then(({ data, error: err }) => {
        if (data) setPlan(data)
        else setError(err || 'Không thể tải kế hoạch')
      })
      .finally(() => setLoading(false))
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      className="min-h-screen bg-[#0A0E1A] pb-16"
      variants={pageVariants} initial="hidden" animate="show"
    >
      {/* Header */}
      <div className="sticky top-12 z-10 bg-[#0A0E1A]/95 backdrop-blur border-b border-[#1E2A44] px-4 py-3 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="font-jakarta text-[13px] text-[#64748B] hover:text-[#F8FAFC] transition">
          ← Quay lại
        </button>
        <span className="font-fraunces text-[15px] font-bold text-[#F8FAFC]">Kế hoạch học thích nghi</span>
        <button
          onClick={() => navigate('/progress')}
          className="font-jakarta text-[12px] text-[#475569] hover:text-[#94A3B8] transition"
        >
          Bản đồ
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 flex flex-col gap-6">
        {!user ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <span className="font-jakarta text-[13px] text-[#475569]">
              Đăng nhập để xem kế hoạch học thích nghi của bạn.
            </span>
          </div>
        ) : loading ? (
          <div className="flex flex-col gap-4 animate-pulse">
            <div className="h-32 rounded-2xl bg-[#0D1221] border border-[#1E2A44]" />
            <div className="h-8 w-48 rounded-lg bg-[#0D1221]" />
            <div className="h-24 rounded-2xl bg-[#0D1221] border border-[#1E2A44]" />
            <div className="h-24 rounded-2xl bg-[#0D1221] border border-[#1E2A44]" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <span className="font-jakarta text-[13px] text-[#FB7185]">{error}</span>
            <button
              onClick={() => { setError(null); setLoading(true); getAdaptiveStudyPlan().then(({ data, error: e }) => { if (data) setPlan(data); else setError(e || 'Lỗi'); }).finally(() => setLoading(false)) }}
              className="px-4 py-2 rounded-xl font-jakarta text-[12px] font-semibold text-[#F8FAFC] border border-[#1E2A44] hover:border-[#4A5A80] transition"
            >
              Thử lại
            </button>
          </div>
        ) : plan ? (
          <>
            {/* Trajectory */}
            <TrajectoryCard plan={plan} />

            {/* Quick actions */}
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/review')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[#34D39930] bg-[#34D39908] font-jakarta text-[12px] font-semibold text-[#34D399] hover:bg-[#34D39914] transition"
              >
                📋 Ôn FSRS{plan.days_remaining != null ? '' : ''}
              </button>
              <button
                onClick={() => navigate('/practice/adaptive')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[#6366F130] bg-[#6366F108] font-jakarta text-[12px] font-semibold text-[#818CF8] hover:bg-[#6366F114] transition"
              >
                ✦ Luyện tập thích nghi
              </button>
            </div>

            {/* No exam date nudge */}
            {plan.days_remaining == null && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#2A3A60] bg-[#111827]">
                <span className="text-[#F2A20C]">📅</span>
                <div className="flex flex-col gap-0.5">
                  <span className="font-jakarta text-[12px] font-semibold text-[#F8FAFC]">
                    Thêm ngày thi để dự đoán điểm số
                  </span>
                  <button
                    onClick={() => navigate('/account')}
                    className="font-jakarta text-[11px] text-[#6366F1] hover:underline text-left transition"
                  >
                    Cập nhật trong tài khoản →
                  </button>
                </div>
              </div>
            )}

            {/* This week's focus */}
            {plan.focus_concepts.length > 0 && (
              <div className="flex flex-col gap-3">
                <span className="font-fraunces text-[14px] font-bold text-[#F8FAFC]">
                  Ưu tiên luyện tập
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {plan.focus_concepts.map(c => (
                    <FocusConceptCard key={c.concept_id} concept={c} />
                  ))}
                </div>
              </div>
            )}

            {/* Weekly schedule */}
            {plan.weekly_schedule.length > 0 && (
              <div className="flex flex-col gap-3">
                <span className="font-fraunces text-[14px] font-bold text-[#F8FAFC]">
                  Lịch học {plan.weeks_remaining != null ? `${Math.min(plan.weeks_remaining, 4)} tuần` : ''}
                </span>
                {plan.weekly_schedule.map(week => (
                  <WeekSchedule key={week.week} week={week} />
                ))}
              </div>
            )}

            {/* Empty state */}
            {plan.focus_concepts.length === 0 && plan.weekly_schedule.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <span className="text-4xl">🗺</span>
                <p className="font-jakarta text-[14px] font-semibold text-[#F8FAFC]">
                  Bắt đầu luyện tập để xây dựng kế hoạch
                </p>
                <p className="font-jakarta text-[13px] text-[#475569] max-w-xs">
                  Hoàn thành một vài buổi ôn tập để hệ thống tính toán kế hoạch cá nhân hóa cho bạn.
                </p>
                <button
                  onClick={() => navigate('/review')}
                  className="px-5 py-2.5 rounded-xl font-jakarta text-[13px] font-bold text-[#0A0E1A]"
                  style={{ background: 'linear-gradient(180deg, #F2A20C 0%, #D97706 100%)' }}
                >
                  Bắt đầu ôn tập
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </motion.div>
  )
}
