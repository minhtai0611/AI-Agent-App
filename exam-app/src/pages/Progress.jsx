import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext.jsx'
import { getConceptMastery } from '../api/aiClient.js'
import { pageVariants } from '../utils/animations.js'
import { usePageTitle } from '../hooks/usePageTitle.js'

const STAGE_COLORS = [
  { bg: '#1A1F2E', border: '#2A3A50', text: '#475569', label: 'Chưa học' },
  { bg: '#0D1F3C', border: '#1E4080', text: '#60A5FA', label: 'Mới tiếp cận' },
  { bg: '#1F1505', border: '#6B3A0A', text: '#F2A20C', label: 'Đang học' },
  { bg: '#1A1505', border: '#7A5500', text: '#FBBF24', label: 'Luyện tập' },
  { bg: '#0D2A1A', border: '#15603A', text: '#34D399', label: 'Vững' },
  { bg: '#052A1A', border: '#0A7A3A', text: '#10B981', label: 'Thành thạo' },
]

const TOPIC_LABELS = {
  algebra: 'Đại số',
  geometry: 'Hình học',
  functions: 'Hàm số',
  trigonometry: 'Lượng giác',
  statistics: 'Thống kê',
  probability: 'Xác suất',
  combinatorics: 'Tổ hợp',
  number_theory: 'Lý thuyết số',
  sets: 'Tập hợp',
  coordinate_geometry: 'Hình học tọa độ',
  vectors: 'Vectơ',
  sequences: 'Dãy số',
  financial_math: 'Toán tài chính',
}

function ConceptNode({ concept, onClick }) {
  const s = STAGE_COLORS[concept.stage ?? 0]
  return (
    <motion.button
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onClick(concept)}
      className="flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl border text-left transition"
      style={{ background: s.bg, borderColor: s.border }}
    >
      <span className="font-jakarta text-[12px] font-semibold leading-tight" style={{ color: s.text }}>
        {concept.name_vi}
      </span>
      <div className="flex items-center gap-1.5 w-full">
        <div className="flex-1 h-1 rounded-full bg-[#1E2A44] overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${concept.mastery_score}%`, background: s.text }}
          />
        </div>
        <span className="font-jakarta text-[10px]" style={{ color: s.text + 'AA' }}>
          {concept.mastery_score}%
        </span>
      </div>
    </motion.button>
  )
}

export default function Progress() {
  usePageTitle('Bản đồ học tập')
  const navigate = useNavigate()
  const { user } = useAuth()
  const [concepts, setConcepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (!user) return
    getConceptMastery()
      .then(({ data }) => { if (data?.concepts) setConcepts(data.concepts) })
      .finally(() => setLoading(false))
  }, [user])

  const byGrade = concepts.reduce((acc, c) => {
    const g = c.grade ?? 9
    if (!acc[g]) acc[g] = {}
    const t = TOPIC_LABELS[c.topic] ?? c.topic
    if (!acc[g][t]) acc[g][t] = []
    acc[g][t].push(c)
    return acc
  }, {})

  const solidCount = concepts.filter(c => c.stage >= 4).length
  const learnedCount = concepts.filter(c => c.stage >= 1).length

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
        <span className="font-fraunces text-[15px] font-bold text-[#F8FAFC]">Bản đồ học tập</span>
        <span className="font-jakarta text-[12px] text-[#475569]">
          {solidCount}/{concepts.length} vững
        </span>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-6 flex flex-col gap-8">
        {/* Summary bar */}
        {!loading && concepts.length > 0 && (
          <div className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-[#1E2A44] bg-[#0D1221]">
            <div className="flex flex-col gap-0.5">
              <span className="font-fraunces text-[28px] font-bold text-[#F8FAFC]">{solidCount}</span>
              <span className="font-jakarta text-[11px] text-[#475569]">khái niệm vững + thành thạo</span>
            </div>
            <div className="flex-1 h-2 rounded-full bg-[#1E2A44] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#10B981] to-[#34D399] transition-all"
                style={{ width: `${(solidCount / Math.max(concepts.length, 1)) * 100}%` }} />
            </div>
            <div className="flex flex-col gap-0.5 items-end">
              <span className="font-jakarta text-[12px] font-semibold text-[#34D399]">{learnedCount}</span>
              <span className="font-jakarta text-[11px] text-[#475569]">đã bắt đầu</span>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex gap-2 flex-wrap">
          {STAGE_COLORS.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border"
              style={{ background: s.bg, borderColor: s.border }}>
              <span className="font-jakarta text-[10px] font-semibold" style={{ color: s.text }}>{s.label}</span>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="font-jakarta text-[13px] text-[#475569]">Đang tải bản đồ...</span>
          </div>
        ) : !user ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <span className="font-jakarta text-[13px] text-[#475569]">Đăng nhập để xem bản đồ học tập của bạn.</span>
          </div>
        ) : (
          Object.entries(byGrade).sort(([a], [b]) => Number(a) - Number(b)).map(([grade, topics]) => (
            <div key={grade} className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="font-fraunces text-[13px] font-bold text-[#F2A20C]">Lớp {grade}</span>
                <div className="flex-1 h-px bg-[#1E2A44]" />
              </div>
              {Object.entries(topics).map(([topic, nodes]) => (
                <div key={topic} className="flex flex-col gap-2">
                  <span className="font-jakarta text-[11px] font-semibold text-[#475569] uppercase tracking-wider pl-1">
                    {topic}
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {nodes.map(c => <ConceptNode key={c.id} concept={c} onClick={setSelected} />)}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Concept detail panel */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4"
          onClick={() => setSelected(null)}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
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
