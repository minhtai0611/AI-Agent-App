import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useHistory } from '../context/HistoryContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useExamDispatch } from '../context/ExamContext.jsx'
import { generateStudyPlan, getAdaptiveStudyPlan } from '../api/aiClient.js'
import { buildStudyPlanPayload, loadExamById, loadQuestionsByIds } from '../api/index.js'
import { safeSetItem } from '../utils/storageManager.js'
import { MathText } from '../components/MathText.jsx'

const PLAN_CACHE_KEY = (uid, id) => `recovery-path-data-${uid ?? 'guest'}-${id}`
const PROGRESS_KEY  = (uid, id) => `recovery-path-progress-${uid ?? 'guest'}-${id}`

function Skeleton() {
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      <div className="flex items-center gap-2">
        <span className="font-jakarta text-[13px] text-[#475569]">Đang tạo kế hoạch phục hồi…</span>
      </div>
      <div className="h-24 bg-[#0D1221] border border-[#1E2A44] rounded-2xl" />
      <div className="h-48 bg-[#0D1221] border border-[#1E2A44] rounded-2xl" />
    </div>
  )
}

function CheckpointBar({ target, current }) {
  const pct = Math.min(current / target, 1)
  const filled = Math.min(current, target)
  return (
    <div className="flex flex-col gap-1.5 mt-4">
      <div className="flex items-center justify-between">
        <span className="font-jakarta text-[11px] font-semibold text-[#475569] uppercase tracking-wider">Checkpoint</span>
        <span className="font-jakarta text-[12px] text-[#64748B]">{filled}/{target} câu đúng liên tiếp</span>
      </div>
      <div className="h-1.5 bg-[#1E2A44] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct * 100}%`, background: pct >= 1 ? '#10B981' : 'linear-gradient(90deg, #F2A20C, #10B981)' }}
        />
      </div>
      {pct >= 1 && (
        <span className="font-jakarta text-[11px] text-[#34D399]">Đã đạt checkpoint — tiếp tục luyện tập hoặc thử lại đề thi.</span>
      )}
    </div>
  )
}

function FocusCard({ area, index, streak, onPractice }) {
  const [open, setOpen] = useState(index === 0)
  return (
    <div className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-6 py-4 text-left"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full bg-[#F2A20C1A] border border-[#F2A20C40] flex items-center justify-center font-jakarta text-[11px] font-bold text-[#F2A20C]">
            {index + 1}
          </span>
          <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">
            <MathText>{area.topic}</MathText>
          </span>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="px-6 pb-6 flex flex-col gap-4 border-t border-[#1E2A44] pt-4">
          {/* Error pattern */}
          <div className="bg-[#1A1505] border border-[#4A3A05] rounded-xl px-4 py-3">
            <p className="font-jakarta text-[12px] font-semibold text-[#F2A20C] mb-1">Lỗi phát hiện</p>
            <p className="font-jakarta text-[13px] text-[#CBD5E1] leading-relaxed">
              <MathText>{area.error_pattern}</MathText>
            </p>
          </div>

          {/* Tasks */}
          <div className="flex flex-col gap-2">
            <span className="font-jakarta text-[11px] font-semibold text-[#475569] uppercase tracking-wider">Luyện tập</span>
            {area.tasks.map((task, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#F2A20C] flex-shrink-0" />
                <span className="font-jakarta text-[13px] text-[#94A3B8] leading-relaxed">
                  <MathText>{task}</MathText>
                </span>
              </div>
            ))}
          </div>

          {/* Checkpoint bar */}
          {area.checkpoint && (
            <CheckpointBar
              target={area.checkpoint.target}
              current={streak}
            />
          )}

          {/* Practice CTA */}
          <button
            type="button"
            onClick={() => onPractice(index)}
            className="mt-1 w-full py-2.5 rounded-xl font-jakarta text-[13px] font-semibold border border-[#F2A20C40] text-[#F2A20C] hover:bg-[#F2A20C0D] transition"
          >
            Luyện tập chủ đề này →
          </button>
        </div>
      )}
    </div>
  )
}

export default function StudyPlan() {
  const navigate = useNavigate()
  const { resultId } = useParams()
  const location = useLocation()
  const { results } = useHistory()
  const { user } = useAuth()
  const dispatch = useExamDispatch()
  const uid = user?.id ?? null

  const [plan, setPlan]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)
  const [streaks, setStreaks] = useState({})   // { areaIndex: correctInARow }
  const [adaptivePlan, setAdaptivePlan] = useState(null)

  const result  = location.state?.result  || results.find(r => r.id === resultId)
  const history = location.state?.history || results.filter(r => r.id !== resultId)

  useEffect(() => {
    const saved = localStorage.getItem(PROGRESS_KEY(uid, resultId))
    if (saved) {
      try { setStreaks(JSON.parse(saved)) } catch {}
    }
  }, [uid, resultId])

  useEffect(() => {
    if (!result) return
    const cacheKey = PLAN_CACHE_KEY(uid, resultId)
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      try { setPlan(JSON.parse(cached)); setLoading(false); return } catch {}
    }
    setLoading(true)
    buildStudyPlanPayload(result, history).then(payload => {
      if (user?.province) payload.province = user.province
      return generateStudyPlan(payload).then(({ data, error: err }) => {
        setLoading(false)
        if (data) { safeSetItem(cacheKey, JSON.stringify(data)); setPlan(data) }
        else setError(true)
      })
    })
  }, [resultId, result, uid]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!resultId || !user) return
    getAdaptiveStudyPlan().then(({ data }) => { if (data) setAdaptivePlan(data) }).catch(() => {})
  }, [resultId, user])

  function handlePractice(areaIndex) {
    navigate('/exams')
  }

  async function handleRetake() {
    const examId = result?.examId
    if (!examId) { navigate('/exams'); return }
    const exam = loadExamById(examId)
    if (!exam) { navigate('/exams'); return }
    const questions = await loadQuestionsByIds(exam.questionIds)
    dispatch({ type: 'START_EXAM', exam, questions, mode: 'timed' })
    navigate(`/test/${examId}`)
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-jakarta text-[15px] text-[#94A3B8]">Hoàn thành một bài thi để nhận kế hoạch phục hồi cá nhân hóa của bạn →</p>
        <button
          onClick={() => navigate('/exams')}
          className="px-5 py-2 rounded-xl font-jakarta text-[13px] font-bold mt-2"
          style={{ background: '#F2A20C', color: '#0A0E1A' }}
        >
          Chọn đề thi
        </button>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
      className="min-h-screen bg-[#0A0E1A] flex flex-col"
    >
      <nav className="flex items-center justify-between px-8 bg-[#0D1221] border-b border-[#1E2A44]" style={{ height: 64 }}>
        <button onClick={() => navigate(-1)} className="font-jakarta text-[13px] text-[#94A3B8] hover:text-[#F8FAFC] transition">
          ← Quay lại
        </button>
        <span className="font-jakarta text-[14px] font-semibold text-[#F8FAFC]">Kế hoạch phục hồi</span>
        <div className="w-20" />
      </nav>

      <div className="flex flex-col gap-5 max-w-2xl mx-auto w-full px-4 py-10">
        {loading ? (
          <Skeleton />
        ) : error ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <p className="font-jakarta text-[#94A3B8]">Không thể tạo kế hoạch phục hồi</p>
            <button
              onClick={() => {
                setError(false); setLoading(true)
                buildStudyPlanPayload(result, history).then(payload => {
                  if (user?.province) payload.province = user.province
                  return generateStudyPlan(payload).then(({ data }) => {
                    setLoading(false)
                    if (data) { safeSetItem(PLAN_CACHE_KEY(uid, resultId), JSON.stringify(data)); setPlan(data) }
                    else setError(true)
                  })
                })
              }}
              className="px-5 py-2.5 rounded-xl font-jakarta text-[13px] font-semibold text-[#0A0E1A]"
              style={{ background: 'linear-gradient(180deg, #F2A20C 0%, #D97706 100%)' }}
            >
              Thử lại
            </button>
          </div>
        ) : plan ? (
          <>
            {/* Score gap */}
            <div className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl px-6 py-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-jakarta text-[11px] font-bold tracking-[2px] uppercase text-[#F2A20C]">Mục tiêu</span>
              </div>
              <p className="font-fraunces text-[17px] font-semibold text-[#F8FAFC] leading-snug">
                {plan.score_gap}
              </p>
            </div>

            {/* SM-2 backlog warning + top focus concepts from adaptive plan */}
            {adaptivePlan && (adaptivePlan.focus_concepts?.length > 0 || (adaptivePlan.in_progress_count ?? 0) > 3) && (
              <div className="bg-[#0A1020] border border-[#1E2A44] rounded-2xl px-5 py-4 flex flex-col gap-3">
                {(adaptivePlan.in_progress_count ?? 0) > 3 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2A1A05] border border-[#7A5500]">
                    <span className="text-[#F2A20C] text-[14px]">⚠</span>
                    <p className="font-jakarta text-[12px] text-[#F2A20C] leading-snug">
                      {adaptivePlan.in_progress_count} khái niệm đang học — ưu tiên ôn lại trước khi học mới.
                    </p>
                  </div>
                )}
                {adaptivePlan.focus_concepts?.slice(0, 3).length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="font-jakarta text-[11px] font-semibold text-[#475569] uppercase tracking-wider">
                      Trọng tâm tuần này (Learning Graph)
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {adaptivePlan.focus_concepts.slice(0, 3).map(c => (
                        <span key={c.concept_id}
                          className="font-jakarta text-[12px] font-semibold px-2.5 py-1 rounded-lg border border-[#6366F130] bg-[#6366F108] text-[#818CF8]">
                          ✦ {c.name_vi}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Focus areas */}
            {Array.isArray(plan.focus_areas) && plan.focus_areas.length > 0 && (
              <div className="flex flex-col gap-3">
                <span className="font-jakarta text-[11px] font-bold tracking-[2px] uppercase text-[#475569]">
                  {plan.focus_areas.length === 1 ? 'Trọng tâm cần sửa' : `${plan.focus_areas.length} trọng tâm cần sửa`}
                </span>
                {plan.focus_areas.map((area, i) => (
                  <FocusCard
                    key={i}
                    area={area}
                    index={i}
                    streak={streaks[i] ?? 0}
                    onPractice={handlePractice}
                  />
                ))}
              </div>
            )}

            {/* Retake CTA */}
            <div className="bg-[#0A1F14] border border-[#2D4A1A] rounded-2xl px-6 py-5 flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="font-jakarta text-[12px] font-semibold text-[#34D399]">Sau khi luyện xong</span>
                <p className="font-jakarta text-[13px] text-[#CBD5E1]">
                  {plan.retake_note ?? 'Thử lại đề thi để đo tiến độ thực sự.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRetake}
                className="flex-shrink-0 px-4 py-2.5 rounded-xl font-jakarta text-[13px] font-bold text-[#0A0E1A] whitespace-nowrap"
                style={{ background: '#10B981' }}
              >
                Thử lại đề →
              </button>
            </div>
          </>
        ) : null}
      </div>
    </motion.div>
  )
}
