import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext.jsx'
import { useHistory } from '../context/HistoryContext.jsx'
import { getConceptMastery } from '../api/aiClient.js'
import { pageVariants } from '../utils/animations.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import { TOPIC_LABELS } from '../utils/topicLabels.js'

// Province cutoff thresholds (mirrors _PROVINCE_DATA in backend)
const PROVINCE_THRESHOLDS = {
  // D4 — most competitive
  'Hà Nội':               { typical: 8.0, top: 9.2 },
  'TP.HCM':               { typical: 7.8, top: 9.0 },
  // D3 — competitive
  'Đà Nẵng':              { typical: 7.2, top: 8.5 },
  'Hải Phòng':            { typical: 7.0, top: 8.2 },
  'Cần Thơ':              { typical: 6.8, top: 8.0 },
  'Bình Dương':           { typical: 7.0, top: 8.2 },
  'Đồng Nai':             { typical: 6.8, top: 8.0 },
  'Khánh Hòa':            { typical: 6.8, top: 7.8 },
  'Bà Rịa - Vũng Tàu':   { typical: 7.0, top: 8.0 },
  'Vĩnh Phúc':            { typical: 6.8, top: 7.8 },
  'Bắc Ninh':             { typical: 7.0, top: 8.2 },
  'Nghệ An':              { typical: 6.6, top: 7.8 },
  'Thanh Hóa':            { typical: 6.4, top: 7.5 },
  'Hà Tĩnh':              { typical: 6.8, top: 7.8 },
  'Thừa Thiên - Huế':     { typical: 6.8, top: 8.0 },
  'Quảng Ninh':           { typical: 6.8, top: 7.8 },
  'Nam Định':             { typical: 7.0, top: 8.2 },
  'Ninh Bình':            { typical: 6.5, top: 7.5 },
  'Hải Dương':            { typical: 6.5, top: 7.5 },
  'Hưng Yên':             { typical: 6.2, top: 7.2 },
  'Hà Nam':               { typical: 6.2, top: 7.2 },
  'Thái Bình':            { typical: 6.2, top: 7.2 },
  'Lâm Đồng':             { typical: 6.0, top: 7.0 },
  'Thái Nguyên':          { typical: 6.5, top: 7.5 },
  'Bình Định':            { typical: 6.2, top: 7.2 },
  'Quảng Nam':            { typical: 6.0, top: 7.0 },
  'Phú Thọ':              { typical: 6.5, top: 7.5 },
  'Bắc Giang':            { typical: 6.2, top: 7.2 },
  'Quảng Bình':           { typical: 6.0, top: 7.0 },
  'Kiên Giang':           { typical: 6.2, top: 7.2 },
  'Cà Mau':               { typical: 5.8, top: 6.8 },
  // D2 — moderate
  'An Giang':             { typical: 5.8, top: 6.8 },
  'Đắk Lắk':             { typical: 5.8, top: 6.8 },
  'Gia Lai':              { typical: 5.6, top: 6.6 },
  'Đồng Tháp':            { typical: 5.8, top: 6.8 },
  'Long An':              { typical: 5.8, top: 6.8 },
  'Tiền Giang':           { typical: 5.8, top: 6.8 },
  'Bình Phước':           { typical: 5.6, top: 6.6 },
  'Tây Ninh':             { typical: 5.6, top: 6.6 },
  'Bến Tre':              { typical: 5.8, top: 6.8 },
  'Vĩnh Long':            { typical: 5.8, top: 6.8 },
  'Sóc Trăng':            { typical: 5.6, top: 6.6 },
  'Bạc Liêu':             { typical: 5.6, top: 6.6 },
  'Hậu Giang':            { typical: 5.4, top: 6.4 },
  'Bình Thuận':           { typical: 5.8, top: 6.8 },
  'Ninh Thuận':           { typical: 5.6, top: 6.6 },
  'Phú Yên':              { typical: 5.8, top: 6.8 },
  'Quảng Ngãi':           { typical: 5.8, top: 6.8 },
  'Quảng Trị':            { typical: 5.8, top: 6.8 },
  'Đắk Nông':             { typical: 5.4, top: 6.4 },
  'Kon Tum':              { typical: 5.4, top: 6.4 },
  'Hòa Bình':             { typical: 5.4, top: 6.4 },
  'Lào Cai':              { typical: 5.4, top: 6.4 },
  'Lạng Sơn':             { typical: 5.4, top: 6.4 },
  'Tuyên Quang':          { typical: 5.4, top: 6.4 },
  'Yên Bái':              { typical: 5.4, top: 6.4 },
  // D1 — least competitive
  'Hà Giang':             { typical: 5.0, top: 6.0 },
  'Điện Biên':            { typical: 5.0, top: 6.0 },
  'Lai Châu':             { typical: 4.8, top: 5.8 },
  'Sơn La':               { typical: 5.2, top: 6.2 },
  'Bắc Kạn':              { typical: 5.0, top: 6.0 },
  'Cao Bằng':             { typical: 5.0, top: 6.0 },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const RECOVERY_PATH_KEY = (uid, id) => `recovery-path-data-${uid ?? 'guest'}-${id}`

function findActiveRecoveryPath(uid, results) {
  for (const r of results.slice(0, 5)) {
    try {
      const raw = localStorage.getItem(RECOVERY_PATH_KEY(uid, r.id))
      if (raw) {
        const data = JSON.parse(raw)
        if (data?.focus_areas?.length) return { data, resultId: r.id }
      }
    } catch {}
  }
  return null
}

function computeWeakTopics(results) {
  const totals = {}  // topic → { correct, total }
  for (const r of results) {
    const tb = r.topicBreakdown ?? {}
    for (const [topic, stats] of Object.entries(tb)) {
      if (!totals[topic]) totals[topic] = { correct: 0, total: 0 }
      totals[topic].correct += stats.correct ?? 0
      totals[topic].total   += stats.total   ?? 0
    }
  }
  return Object.entries(totals)
    .filter(([, s]) => s.total >= 2)
    .map(([topic, s]) => ({
      topic,
      label: TOPIC_LABELS[topic] ?? topic,
      accuracy: s.total > 0 ? s.correct / s.total : 1,
      wrong: s.total - s.correct,
    }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3)
}

// ── Mini sparkline (SVG) ─────────────────────────────────────────────────────

function Sparkline({ scores }) {
  if (scores.length < 2) return null
  const W = 120, H = 36, pad = 4
  const min = Math.min(...scores) - 0.5
  const max = Math.max(...scores) + 0.5
  const range = max - min || 1
  const pts = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * (W - pad * 2)
    const y = H - pad - ((s - min) / range) * (H - pad * 2)
    return `${x},${y}`
  })
  const last = pts[pts.length - 1].split(',')
  const trend = scores[scores.length - 1] - scores[0]
  const color = trend > 0 ? '#10B981' : trend < 0 ? '#FB7185' : '#F2A20C'
  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} />
    </svg>
  )
}

// ── Concept map (from legacy Progress.jsx) ───────────────────────────────────

const STAGE_COLORS = [
  { bg: '#1A1F2E', border: '#2A3A50', text: '#475569', label: 'Chưa học' },
  { bg: '#0D1F3C', border: '#1E4080', text: '#60A5FA', label: 'Mới tiếp cận' },
  { bg: '#1F1505', border: '#6B3A0A', text: '#F2A20C', label: 'Đang học' },
  { bg: '#1A1505', border: '#7A5500', text: '#FBBF24', label: 'Luyện tập' },
  { bg: '#0D2A1A', border: '#15603A', text: '#34D399', label: 'Vững' },
  { bg: '#052A1A', border: '#0A7A3A', text: '#10B981', label: 'Thành thạo' },
]

function ConceptNode({ concept, onClick }) {
  const s = STAGE_COLORS[concept.stage ?? 0]
  return (
    <button
      type="button"
      onClick={() => onClick(concept)}
      className="flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl border text-left transition hover:opacity-80"
      style={{ background: s.bg, borderColor: s.border }}
    >
      <span className="font-jakarta text-[12px] font-semibold leading-tight" style={{ color: s.text }}>
        {concept.name_vi}
      </span>
      <div className="flex items-center gap-1.5 w-full">
        <div className="flex-1 h-1 rounded-full bg-[#1E2A44] overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${concept.mastery_score}%`, background: s.text }} />
        </div>
        <span className="font-jakarta text-[10px]" style={{ color: s.text + 'AA' }}>{concept.mastery_score}%</span>
      </div>
    </button>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Progress() {
  usePageTitle('Tiến độ')
  const navigate = useNavigate()
  const { user } = useAuth()
  const { results } = useHistory()
  const uid = user?.id ?? null

  const [showMore, setShowMore]     = useState(false)
  const [concepts, setConcepts]     = useState([])
  const [conceptsLoaded, setConceptsLoaded] = useState(false)
  const [selected, setSelected]     = useState(null)

  const recentResults = useMemo(() => [...results].slice(0, 10), [results])
  const scores = useMemo(() => recentResults.map(r => r.score ?? 0).reverse(), [recentResults])

  const scoreDelta = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : null
  const avgScore   = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null

  const weakTopics = useMemo(() => computeWeakTopics(results), [results])

  const activeRecovery = useMemo(() => findActiveRecoveryPath(uid, results), [uid, results])

  const conceptsByGrade = useMemo(() => {
    return concepts.reduce((acc, c) => {
      const g = c.grade ?? 9
      if (!acc[g]) acc[g] = {}
      const t = TOPIC_LABELS[c.topic] ?? c.topic
      if (!acc[g][t]) acc[g][t] = []
      acc[g][t].push(c)
      return acc
    }, {})
  }, [concepts])

  useEffect(() => {
    if (!showMore || conceptsLoaded || !user) return
    getConceptMastery()
      .then(({ data }) => { if (data?.concepts) setConcepts(data.concepts) })
      .finally(() => setConceptsLoaded(true))
  }, [showMore, conceptsLoaded, user])

  const emptyState = results.length === 0

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
        <span className="font-fraunces text-[15px] font-bold text-[#F8FAFC]">Tiến độ</span>
        <div className="w-16" />
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 flex flex-col gap-5">

        {emptyState ? (
          <div className="flex flex-col items-center gap-4 py-20">
            <p className="font-jakarta text-[14px] text-[#475569] text-center">Hoàn thành một bài thi để xem tiến độ của bạn.</p>
            <button
              onClick={() => navigate('/exams')}
              className="px-5 py-2.5 rounded-xl font-jakarta text-[13px] font-bold text-[#0A0E1A]"
              style={{ background: '#F2A20C' }}
            >
              Chọn đề thi →
            </button>
          </div>
        ) : (
          <>
            {/* ── Score trend ─────────────────────────────────────────────── */}
            <div className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="font-jakarta text-[11px] font-bold tracking-[2px] uppercase text-[#475569]">Xu hướng điểm</span>
                  {avgScore !== null && (
                    <span className="font-fraunces text-[26px] font-bold text-[#F8FAFC]">{avgScore.toFixed(1)}</span>
                  )}
                  {scoreDelta !== null && (
                    <span className={`font-jakarta text-[13px] font-semibold ${scoreDelta > 0 ? 'text-[#34D399]' : scoreDelta < 0 ? 'text-[#FB7185]' : 'text-[#64748B]'}`}>
                      {scoreDelta > 0 ? `+${scoreDelta.toFixed(1)}đ` : scoreDelta < 0 ? `${scoreDelta.toFixed(1)}đ` : 'Ổn định'} trong {scores.length} bài gần nhất
                    </span>
                  )}
                </div>
                <Sparkline scores={scores} />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => navigate('/exams')}
                  className="flex-1 py-2.5 rounded-xl font-jakarta text-[13px] font-bold text-[#0A0E1A]"
                  style={{ background: '#F2A20C' }}
                >
                  Thi tiếp →
                </button>
                {activeRecovery && (
                  <button
                    onClick={() => navigate(`/study-plan/${activeRecovery.resultId}`)}
                    className="flex-1 py-2.5 rounded-xl font-jakarta text-[13px] font-semibold border border-[#1E2A44] text-[#94A3B8] hover:text-[#F8FAFC] transition"
                  >
                    Ôn tập trước
                  </button>
                )}
              </div>
            </div>

            {/* ── Active Recovery Path ────────────────────────────────────── */}
            {activeRecovery && (
              <div className="bg-[#0A1F14] border border-[#2D4A1A] rounded-2xl px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="font-jakarta text-[11px] font-bold tracking-[2px] uppercase text-[#34D399]">Kế hoạch phục hồi đang chạy</span>
                    <p className="font-jakarta text-[13px] text-[#CBD5E1] mt-1">
                      {activeRecovery.data.focus_areas.map(a => a.topic).join(' · ')}
                    </p>
                    <p className="font-jakarta text-[12px] text-[#64748B] mt-0.5 line-clamp-2">
                      {activeRecovery.data.score_gap}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/study-plan/${activeRecovery.resultId}`)}
                    className="flex-shrink-0 px-4 py-2 rounded-xl font-jakarta text-[12px] font-bold text-[#0A0E1A]"
                    style={{ background: '#10B981' }}
                  >
                    Tiếp tục →
                  </button>
                </div>
              </div>
            )}

            {/* ── Weak topic cards ────────────────────────────────────────── */}
            {weakTopics.length > 0 && (
              <div className="flex flex-col gap-3">
                <span className="font-jakarta text-[11px] font-bold tracking-[2px] uppercase text-[#475569]">Chủ đề cần chú ý</span>
                {weakTopics.map(({ topic, label, accuracy, wrong }) => (
                  <div key={topic} className="bg-[#0D1221] border border-[#1E2A44] rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <span className="font-jakarta text-[14px] font-semibold text-[#F8FAFC] truncate">{label}</span>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1 bg-[#1E2A44] rounded-full overflow-hidden max-w-[100px]">
                          <div className="h-full rounded-full" style={{ width: `${accuracy * 100}%`, background: accuracy < 0.4 ? '#FB7185' : accuracy < 0.6 ? '#F2A20C' : '#34D399' }} />
                        </div>
                        <span className="font-jakarta text-[12px] text-[#64748B]">{Math.round(accuracy * 100)}% đúng · {wrong} câu sai</span>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate('/exams')}
                      className="flex-shrink-0 px-3 py-1.5 rounded-lg font-jakarta text-[12px] font-semibold border border-[#1E2A44] text-[#94A3B8] hover:text-[#F8FAFC] transition"
                    >
                      Luyện tập →
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ── Xem thêm collapse ───────────────────────────────────────── */}
            <button
              type="button"
              onClick={() => setShowMore(v => !v)}
              className="flex items-center gap-2 font-jakarta text-[13px] text-[#475569] hover:text-[#94A3B8] transition py-1"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform duration-200 ${showMore ? 'rotate-180' : ''}`}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
              {showMore ? 'Thu gọn' : 'Xem thêm — bản đồ học tập, chi tiết chủ đề'}
            </button>

            {showMore && (
              <div className="flex flex-col gap-5">
                {/* Concept map */}
                {!conceptsLoaded ? (
                  <div className="py-8 flex items-center justify-center">
                    <span className="font-jakarta text-[13px] text-[#475569]">Đang tải bản đồ học tập…</span>
                  </div>
                ) : concepts.length > 0 ? (
                  <div className="flex flex-col gap-6">
                    <div className="flex gap-2 flex-wrap">
                      {STAGE_COLORS.map((s, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border" style={{ background: s.bg, borderColor: s.border }}>
                          <span className="font-jakarta text-[10px] font-semibold" style={{ color: s.text }}>{s.label}</span>
                        </div>
                      ))}
                    </div>
                    {Object.entries(conceptsByGrade).sort(([a], [b]) => Number(a) - Number(b)).map(([grade, topics]) => (
                      <div key={grade} className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                          <span className="font-fraunces text-[13px] font-bold text-[#F2A20C]">Lớp {grade}</span>
                          <div className="flex-1 h-px bg-[#1E2A44]" />
                        </div>
                        {Object.entries(topics).map(([topic, nodes]) => (
                          <div key={topic} className="flex flex-col gap-2">
                            <span className="font-jakarta text-[11px] font-semibold text-[#475569] uppercase tracking-wider pl-1">{topic}</span>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {nodes.map(c => <ConceptNode key={c.id} concept={c} onClick={setSelected} />)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="font-jakarta text-[13px] text-[#475569] text-center py-4">Chưa có dữ liệu bản đồ học tập. Hoàn thành thêm bài thi để xây dựng bản đồ.</p>
                )}

                {/* Topic accuracy full list */}
                {results.length > 0 && (() => {
                  const all = computeAllTopics(results)
                  if (!all.length) return null
                  return (
                    <div className="flex flex-col gap-2">
                      <span className="font-jakarta text-[11px] font-bold tracking-[2px] uppercase text-[#475569]">Tất cả chủ đề</span>
                      {all.map(({ topic, label, accuracy, total }) => (
                        <div key={topic} className="flex items-center gap-3 py-2 border-b border-[#1E2A44]/60">
                          <span className="font-jakarta text-[13px] text-[#94A3B8] flex-1 min-w-0 truncate">{label}</span>
                          <div className="w-20 h-1 bg-[#1E2A44] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${accuracy * 100}%`, background: accuracy < 0.4 ? '#FB7185' : accuracy < 0.6 ? '#F2A20C' : '#34D399' }} />
                          </div>
                          <span className="font-jakarta text-[12px] text-[#475569] w-12 text-right">{Math.round(accuracy * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}

                {/* Province score comparison — only when ≥20 results and province is set */}
                {results.length >= 20 && user?.province && PROVINCE_THRESHOLDS[user.province] && (() => {
                  const thresh = PROVINCE_THRESHOLDS[user.province]
                  const avgScore = results.slice(0, 10).reduce((s, r) => s + (r.score ?? 0), 0) / Math.min(results.length, 10)
                  const aboveTypical = avgScore >= thresh.typical
                  const aboveTop = avgScore >= thresh.top
                  const gap = thresh.typical - avgScore
                  return (
                    <div className="flex flex-col gap-2">
                      <span className="font-jakarta text-[11px] font-bold tracking-[2px] uppercase text-[#475569]">So sánh tỉnh {user.province}</span>
                      <div className="bg-[#0D1221] border border-[#1E2A44] rounded-xl px-4 py-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="font-jakarta text-[12px] text-[#64748B]">Điểm TB 10 đề gần nhất</span>
                          <span className="font-jakarta text-[13px] font-semibold text-[#F8FAFC]">{avgScore.toFixed(1)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-jakarta text-[12px] text-[#64748B]">Ngưỡng an toàn {user.province}</span>
                          <span className="font-jakarta text-[12px]" style={{ color: aboveTypical ? '#34D399' : '#F2A20C' }}>{thresh.typical} {aboveTypical ? '✓' : `(thiếu ${gap.toFixed(1)}đ)`}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-jakarta text-[12px] text-[#64748B]">Trường tốt yêu cầu</span>
                          <span className="font-jakarta text-[12px]" style={{ color: aboveTop ? '#34D399' : '#475569' }}>{thresh.top}+</span>
                        </div>
                      </div>
                    </div>
                  )
                })()}
          </>
        )}
      </div>

      {/* Concept detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4" onClick={() => setSelected(null)}>
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-6 flex flex-col gap-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="font-fraunces text-[17px] font-bold text-[#F8FAFC]">{selected.name_vi}</span>
                <span className="font-jakarta text-[12px] text-[#475569]">{selected.name}</span>
              </div>
              <button onClick={() => setSelected(null)} className="text-[#475569] hover:text-[#F8FAFC] text-lg">×</button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-jakarta text-[11px] text-[#475569]">Giai đoạn</span>
                <span className="font-jakarta text-[13px] font-semibold" style={{ color: STAGE_COLORS[selected.stage ?? 0].text }}>
                  {STAGE_COLORS[selected.stage ?? 0].label}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-jakarta text-[11px] text-[#475569]">Thành thạo</span>
                <span className="font-jakarta text-[13px] font-semibold text-[#F8FAFC]">{selected.mastery_score}%</span>
              </div>
              {selected.review_count > 0 && (
                <div className="flex flex-col gap-0.5">
                  <span className="font-jakarta text-[11px] text-[#475569]">Đã ôn</span>
                  <span className="font-jakarta text-[13px] font-semibold text-[#F8FAFC]">{selected.review_count} lần</span>
                </div>
              )}
            </div>
            {selected.prerequisite_ids?.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="font-jakarta text-[11px] text-[#475569]">Cần học trước</span>
                <div className="flex gap-1.5 flex-wrap">
                  {selected.prerequisite_ids.map(pid => {
                    const prereq = concepts.find(c => c.id === pid)
                    const s = STAGE_COLORS[prereq?.stage ?? 0]
                    return (
                      <span key={pid} className="px-2 py-0.5 rounded-md border font-jakarta text-[11px]"
                        style={{ background: s.bg, borderColor: s.border, color: s.text }}>
                        {prereq?.name_vi ?? pid}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
            <button
              onClick={() => { setSelected(null); navigate(`/oracle?q=${encodeURIComponent('Giải thích khái niệm: ' + selected.name_vi)}`) }}
              className="w-full py-2.5 rounded-xl border border-[#6366F133] bg-[#6366F108] font-jakarta text-[13px] font-semibold text-[#818CF8] hover:bg-[#6366F114] transition"
            >
              ✦ Hỏi Oracle về {selected.name_vi}
            </button>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}

function computeAllTopics(results) {
  const totals = {}
  for (const r of results) {
    const tb = r.topicBreakdown ?? {}
    for (const [topic, stats] of Object.entries(tb)) {
      if (!totals[topic]) totals[topic] = { correct: 0, total: 0 }
      totals[topic].correct += stats.correct ?? 0
      totals[topic].total   += stats.total   ?? 0
    }
  }
  return Object.entries(totals)
    .filter(([, s]) => s.total >= 1)
    .map(([topic, s]) => ({
      topic,
      label: TOPIC_LABELS[topic] ?? topic,
      accuracy: s.total > 0 ? s.correct / s.total : 1,
      total: s.total,
    }))
    .sort((a, b) => a.accuracy - b.accuracy)
}
