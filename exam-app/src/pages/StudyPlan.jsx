import { useState, useEffect, useRef } from 'react'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { motion, AnimatePresence } from 'framer-motion'
import { useRevealOnScroll } from '../hooks/useRevealOnScroll.js'
import AchievementCeremony from '../components/AchievementCeremony.jsx'
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
        <span className="font-sans text-[13px] text-dim">Đang tạo kế hoạch phục hồi…</span>
      </div>
      <div className="h-24 glass-base border border-surface rounded-2xl" />
      <div className="h-48 glass-base border border-surface rounded-2xl" />
    </div>
  )
}

function CheckpointBar({ target, current }) {
  const pct = Math.min(current / target, 1)
  const filled = Math.min(current, target)
  // Animate the fill exactly once: only when completion is first reached this session.
  // If already complete on mount (loaded from localStorage), no animation.
  const wasCompleteOnMount = useRef(pct >= 1)
  const hasAnimated = useRef(false)
  const shouldAnimate = pct >= 1 && !wasCompleteOnMount.current && !hasAnimated.current
  if (shouldAnimate) hasAnimated.current = true

  return (
    <div className="flex flex-col gap-1.5 mt-4">
      <div className="flex items-center justify-between">
        <span className="font-sans text-[11px] font-semibold text-dim uppercase tracking-wider">Checkpoint</span>
        <span className="font-sans text-[12px] text-dim">{filled}/{target} câu đúng liên tiếp</span>
      </div>
      <div className="h-1.5 bg-surface rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full${shouldAnimate ? ' transition-[width] duration-[250ms] ease-linear' : ''}`}
          style={{ width: `${pct * 100}%`, background: pct >= 1 ? 'var(--success)' : 'linear-gradient(90deg, var(--accent), var(--success))' }}
        />
      </div>
      {pct >= 1 && (
        <span className="font-sans text-[11px] text-success">Đã đạt checkpoint — tiếp tục luyện tập hoặc thử lại đề thi.</span>
      )}
    </div>
  )
}

function FocusCard({ area, index, streak, onPractice }) {
  const [open, setOpen] = useState(index === 0)
  const checkpoint = area.checkpoint
  const isResolved = checkpoint ? streak >= checkpoint.target : false
  const wasResolvedOnMount = useRef(isResolved)
  const { ref, inView } = useRevealOnScroll()

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      animate={{ opacity: inView ? 1 : 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: isResolved ? 'var(--primary-subtle)' : 'var(--surface)',
        border: `1px solid ${isResolved ? 'var(--primary-border)' : 'var(--border)'}`,
      }}
    >
      <button
        type="button"
        className="w-full flex items-center justify-between px-6 py-4 text-left"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-3">
          <AnimatePresence mode="wait" initial={false}>
            {isResolved ? (
              <AchievementCeremony
                key="resolved"
                trigger={isResolved}
                className="w-6 h-6 rounded-full bg-success/5 border border-success/20 flex items-center justify-center font-sans text-[11px] font-bold text-success"
              >
                ✓
              </AchievementCeremony>
            ) : (
              <span className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-sans text-[11px] font-bold text-primary">
                {index + 1}
              </span>
            )}
          </AnimatePresence>
          <span className={`font-sans text-[15px] font-semibold ${isResolved ? 'text-muted' : 'text-foreground'}`}>
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
        <div className="px-6 pb-6 flex flex-col gap-4 border-t border-surface pt-4">
          {/* Error pattern */}
          <div className="glass-base border border-primary/20 rounded-xl px-4 py-3">
            <p className="font-sans text-[12px] font-semibold text-primary mb-1">Lỗi phát hiện</p>
            <p className="font-sans text-[13px] text-foreground leading-relaxed">
              <MathText>{area.error_pattern}</MathText>
            </p>
          </div>

          {/* Tasks */}
          <div className="flex flex-col gap-2">
            <span className="font-sans text-[11px] font-semibold text-dim uppercase tracking-wider">Luyện tập</span>
            {area.tasks.map((task, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                <span className="font-sans text-[13px] text-muted leading-relaxed">
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
            className="mt-1 w-full py-2.5 rounded-xl font-sans text-[13px] font-semibold border border-primary/20 text-primary hover:bg-primary/5 transition"
          >
            Luyện tập chủ đề này →
          </button>
        </div>
      )}
    </motion.div>
  )
}

export default function StudyPlan() {
  usePageMeta('Kế hoạch học tập', { noindex: true })
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
  const [hasSavedPlan, setHasSavedPlan] = useState(false)

  const result  = location.state?.result  || results.find(r => r.id === resultId)
  const history = location.state?.history || results.filter(r => r.id !== resultId)

  useEffect(() => {
    const saved = localStorage.getItem(PROGRESS_KEY(uid, resultId))
    if (saved) {
      try { setStreaks(JSON.parse(saved)) } catch {}
    }
  }, [uid, resultId])

  useEffect(() => {
    if (!result && uid) {
      const savedId = localStorage.getItem(`latest_study_plan_result_${uid}`)
      if (savedId) {
        navigate(`/study-plan/${savedId}`, { replace: true })
      } else {
        setHasSavedPlan(false)
      }
    }
  }, [uid, result, navigate])

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

  if (!result && hasSavedPlan) {
    return (
      <div className="flex flex-col items-center gap-3 py-12" data-testid="load-saved-plan">
        <p className="font-sans text-[14px] text-foreground">Bạn có lộ trình học đã lưu.</p>
        <button
          onClick={() => navigate(-1)}
          className="font-sans text-[13px] font-semibold text-primary"
        >
          Quay lại kết quả để xem lộ trình →
        </button>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-sans text-[15px] text-muted">Hoàn thành một bài thi để nhận kế hoạch phục hồi cá nhân hóa của bạn →</p>
        <button
          onClick={() => navigate('/exams')}
          className="px-5 py-2 rounded-xl font-sans text-[13px] font-bold mt-2 bg-primary text-background"
        >
          Chọn đề thi
        </button>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
      className="min-h-screen bg-surface flex flex-col"
    >
      <nav className="flex items-center justify-between px-8 glass-base border-b border-surface" style={{ height: 64 }}>
        <button onClick={() => navigate(-1)} className="font-sans text-[13px] text-muted hover:text-foreground transition">
          ← Quay lại
        </button>
        <span className="font-sans text-[14px] font-semibold text-foreground">Kế hoạch phục hồi</span>
        <button
          onClick={() => navigate('/exams?mode=study_plan')}
          className="px-4 py-2 rounded-lg font-sans text-xs font-bold bg-primary text-primary-fg hover:opacity-90 transition"
        >
          Luyện ngay →
        </button>
      </nav>

      <div className="flex flex-col gap-5 max-w-2xl mx-auto w-full px-4 py-10">
        {loading ? (
          <Skeleton />
        ) : error ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <p className="font-sans text-muted">Không thể tạo kế hoạch phục hồi</p>
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
              className="px-5 py-2.5 rounded-xl font-sans text-[13px] font-semibold text-background"
              style={{ background: 'linear-gradient(180deg, var(--accent) 0%, var(--warning) 100%)' }}
            >
              Thử lại
            </button>
          </div>
        ) : plan ? (
          <>
            {/* Score gap */}
            <div className="glass-base border border-surface rounded-2xl px-6 py-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-sans text-[11px] font-bold tracking-[2px] uppercase text-primary">Mục tiêu</span>
              </div>
              <p className="font-display text-[17px] font-semibold text-foreground leading-snug">
                {plan.score_gap}
              </p>
            </div>

            {/* SM-2 backlog warning + top focus concepts from adaptive plan */}
            {adaptivePlan && (adaptivePlan.focus_concepts?.length > 0 || (adaptivePlan.in_progress_count ?? 0) > 3) && (
              <div className="bg-surface border border-surface rounded-2xl px-5 py-4 flex flex-col gap-3">
                {(adaptivePlan.in_progress_count ?? 0) > 3 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg glass-base border border-primary/20">
                    <span className="text-primary text-[14px]">⚠</span>
                    <p className="font-sans text-[12px] text-primary leading-snug">
                      {adaptivePlan.in_progress_count} khái niệm đang học — ưu tiên ôn lại trước khi học mới.
                    </p>
                  </div>
                )}
                {adaptivePlan.focus_concepts?.slice(0, 3).length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="font-sans text-[11px] font-semibold text-dim uppercase tracking-wider">
                      Trọng tâm tuần này (Learning Graph)
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {adaptivePlan.focus_concepts.slice(0, 3).map(c => (
                        <span key={c.concept_id}
                          className="font-sans text-[12px] font-semibold px-2.5 py-1 rounded-lg border border-info/20 bg-info/5 text-info">
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
                <span className="font-sans text-[11px] font-bold tracking-[2px] uppercase text-dim">
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

            {/* Concept prerequisite chain */}
            {Array.isArray(plan.concept_chain) && plan.concept_chain.length > 0 && (
              <div className="flex flex-col gap-3">
                <span className="font-sans text-[11px] font-bold tracking-[2px] uppercase text-dim">
                  Lộ trình kiến thức cần nắm
                </span>
                <div className="glass-base border border-surface rounded-2xl px-5 py-4 flex flex-col gap-0">
                  {plan.concept_chain.map((c, i) => {
                    const isLast = i === plan.concept_chain.length - 1
                    const TOPIC_COLORS_MAP = {
                      algebra: '#6366F1', geometry: '#10B981', calculus: '#F59E0B',
                      probability: '#EC4899', statistics: '#3B82F6', trigonometry: '#8B5CF6',
                    }
                    const color = TOPIC_COLORS_MAP[c.topic] || '#64748B'
                    return (
                      <div key={c.id} className="flex items-stretch gap-3">
                        {/* Connector line */}
                        <div className="flex flex-col items-center" style={{ minWidth: 20 }}>
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                            style={{ background: c.is_target ? color : '#334155', border: `2px solid ${color}` }}
                          />
                          {!isLast && <div className="w-px flex-1 bg-surface mt-0.5" style={{ minHeight: 16 }} />}
                        </div>
                        {/* Label */}
                        <div className={`pb-3 flex-1 min-w-0 ${isLast ? 'pb-0' : ''}`}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-sans text-[13px] font-semibold" style={{ color: c.is_target ? '#F0F4FF' : '#94A3B8' }}>
                              {c.name_vi}
                            </span>
                            <span
                              className="font-sans text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
                              style={{ background: `${color}22`, color }}
                            >
                              Lớp {c.grade}
                            </span>
                            {c.is_target && (
                              <span className="font-sans text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide bg-primary/20 text-primary">
                                Mục tiêu
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="font-sans text-[11px] text-dim">
                  Nắm vững từng bước trước khi tiến lên khái niệm tiếp theo.
                </p>
              </div>
            )}

            {/* Retake CTA */}
            <div className="glass-base border border-success/20 rounded-2xl px-6 py-5 flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="font-sans text-[12px] font-semibold text-success">Sau khi luyện xong</span>
                <p className="font-sans text-[13px] text-foreground">
                  {plan.retake_note ?? 'Thử lại đề thi để đo tiến độ thực sự.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRetake}
                className="flex-shrink-0 px-4 py-2.5 rounded-xl font-sans text-[13px] font-bold text-background whitespace-nowrap bg-success"
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
