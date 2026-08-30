import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExamDispatch } from '../context/ExamContext.jsx'
import { useHistory } from '../context/HistoryContext.jsx'
import { loadExams, loadThiThuExams, loadQuestionsByIds, loadExamById } from '../api/index.js'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants, viewNavigate } from '../utils/animations.js'

import { usePageMeta } from '../hooks/usePageMeta.js'
import { buildBriefing } from '../utils/examBriefing.js'
import { useTilt3D } from '../hooks/useTilt3D.js'
import { Reveal3D } from '../components/motion/Reveal3D.jsx'
import { Scene3DLazy } from '../components/motion/Scene3DLazy.jsx'

// Tier-1 fallback for the hero scene — reduced-motion / low-power devices get
// a static ripple-ring motif instead of the WebGL surface (same accent color,
// same "ripple" motif, zero animation).
function StaticRippleFallback() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {[1, 2, 3, 4, 5].map(i => (
        <circle key={i} cx="200" cy="100" r={i * 22} fill="none" stroke="#8B5CF6" strokeWidth="1" opacity={0.12} />
      ))}
    </svg>
  )
}

// Tier-1 3D hover-tilt wrapper — GSAP owns rotateX/rotateY on this outer node,
// framer-motion (via the existing cardVariants/hoverProps) keeps owning the
// inner scale/opacity transform on its own child element. One library per
// DOM element, per the Vantage rebrand's animation boundary rule.
function TiltCard({ children, className, ...rest }) {
  const { ref, handlers } = useTilt3D()
  return (
    <div
      ref={ref}
      className={className}
      style={{ perspective: 'var(--perspective-md)', transformStyle: 'preserve-3d' }}
      {...handlers}
      {...rest}
    >
      {children}
    </div>
  )
}

const listVariants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}
const cardVariants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
}
const hoverProps = {
  whileHover: { scale: 1.015 },
  whileTap:   { scale: 0.98 },
  transition: { type: 'spring', stiffness: 400, damping: 25 },
}

const GROUPS = {
  timed: [
    { category: 'grade10', label: 'Thi vào lớp 10', description: 'Đề thi tuyển sinh THCS lên THPT', accent: '#3B82F6', tag: 'Lớp 10' },
    { category: 'thpt', label: 'Thi THPT Quốc gia', description: 'Đề thi & thi thử tốt nghiệp THPT', accent: '#F2A20C', tag: 'THPT' },
  ],
  practice: [
    { category: 'grade10', label: 'Luyện tập vào lớp 10', description: 'Đề thi quốc tế — Ghana BECE, Ấn Độ CBSE & Cambridge IGCSE', accent: '#3B82F6', tag: 'Lớp 10' },
    { category: 'thpt', label: 'Luyện tập THPT & Đại học', description: 'SAT, ACT, A-Level, Bac Pháp, Irish LC, Singapore H2 & nhiều đề quốc tế khác', accent: '#F2A20C', tag: 'THPT' },
  ],
}

const FILTER_KEY = 'examselect_filter'

function loadSavedFilters() {
  try { return JSON.parse(sessionStorage.getItem(FILTER_KEY) || '{}') } catch { return {} }
}
function saveFilters(f) {
  try { sessionStorage.setItem(FILTER_KEY, JSON.stringify(f)) } catch {}
}

export default function ExamSelect() {
  usePageMeta('Chọn đề thi', { description: 'Đề thi THPT & lớp 10 từ 63 tỉnh thành · Luyện tập toán có thời gian.' })
  const navigate = useNavigate()
  const dispatch = useExamDispatch()
  const { results } = useHistory()
  const [previewExam, setPreviewExam] = useState(null)
  const [expandedCategories, setExpandedCategories] = useState({})

  const saved = loadSavedFilters()
  const [filterYear, setFilterYear] = useState(saved.year ?? null)
  const [filterSearch, setFilterSearch] = useState(saved.search ?? '')
  const [allExams, setAllExams] = useState([])
  const [briefingChecked, setBriefingChecked] = useState({ quiet: false, water: false, phone: false })
  const [metacogAnswer, setMetacogAnswer] = useState(null)

  useEffect(() => {
    Promise.all([loadThiThuExams(), loadExams()]).then(([timedData, practiceData]) => {
      setAllExams([
        ...timedData.map(e => ({ ...e, _examType: 'timed' })),
        ...practiceData.map(e => ({ ...e, _examType: 'practice' })),
      ])
    })
  }, [])

  const bestScores = useMemo(() => {
    const map = {}
    for (const r of results) {
      if (map[r.examId] === undefined || r.score > map[r.examId]) map[r.examId] = r.score
    }
    return map
  }, [results])

  const availableYears = [...new Set(allExams.map(e => e.year).filter(Boolean))].sort((a, b) => b - a)

  const exams = useMemo(() => {
    return allExams.filter(e => {
      if (filterYear && e.year !== filterYear) return false
      if (filterSearch.trim()) {
        const q = filterSearch.toLowerCase()
        return (e.title || '').toLowerCase().includes(q) || String(e.year).includes(q) || (e.source || '').toLowerCase().includes(q)
      }
      return true
    })
  }, [allExams, filterYear, filterSearch])

  function setYear(y) {
    setFilterYear(y)
    saveFilters({ year: y, search: filterSearch })
  }
  function setSearch(s) {
    setFilterSearch(s)
    saveFilters({ year: filterYear, search: s })
  }

  const motivationalHeader = useMemo(() => {
    if (!results || results.length === 0) return 'Bắt đầu với một đề thi phù hợp với trình độ của bạn.'
    const sorted = [...results].sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))
    const last = sorted[0]
    const bestByExam = {}
    for (const r of results) {
      if (!bestByExam[r.examId] || r.score > bestByExam[r.examId]) bestByExam[r.examId] = r.score
    }
    const personalBest = Math.max(...Object.values(bestByExam))
    const recentBestExamId = Object.entries(bestByExam).find(([, s]) => s === personalBest)?.[0]
    if (recentBestExamId && last.examId === recentBestExamId && results.filter(r => r.examId === recentBestExamId).length >= 2) {
      return `Bạn vừa đạt kỷ lục ${personalBest} điểm — hãy thử thách tiếp!`
    }
    const lastTitle = loadExamById(last.examId)?.title ?? null
    return lastTitle ? `Chào mừng trở lại! Tiếp tục từ ${lastTitle} →` : 'Chào mừng trở lại! Chọn một đề thi để tiếp tục.'
  }, [results])

  async function handleStart(exam, startMode = 'timed') {
    const ids = exam.questionIds?.length ? exam.questionIds : (loadExamById(exam.id)?.questionIds ?? [])
    const questions = await loadQuestionsByIds(ids)
    dispatch({ type: 'START_EXAM', exam, questions, mode: startMode })
    viewNavigate(navigate, `/test/${exam.id}`)
  }

  const groups = [
    ...GROUPS.timed.map(g => ({ ...g, source: 'timed' })),
    ...GROUPS.practice.map(g => ({ ...g, source: 'practice' })),
  ]

  function openPreview(exam) { setPreviewExam(exam); setBriefingChecked({ quiet: false, water: false, phone: false }); setMetacogAnswer(null) }
  function closePreview() { setPreviewExam(null) }
  function confirmStart(exam, startMode) { closePreview(); handleStart(exam, startMode) }

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show" exit="exit"
      className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 px-10 pt-6">
        <input
          type="search"
          placeholder="Tìm đề thi..."
          value={filterSearch}
          onChange={e => setSearch(e.target.value)}
          className="h-9 px-4 rounded-full border border-border bg-surface-elevated font-sans text-[0.8125rem] text-foreground placeholder-faint focus:outline-none focus:border-primary w-48"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setYear(null)}
            className={`h-8 px-3 rounded-full font-sans text-xs font-medium border transition ${
              !filterYear ? 'border-primary bg-primary/10 text-primary' : 'border-border text-dim hover:border-primary/30'
            }`}
          >Tất cả</button>
          {availableYears.map(y => (
            <button
              key={y}
              onClick={() => setYear(filterYear === y ? null : y)}
              className={`h-8 px-3 rounded-full font-sans text-xs font-medium border transition ${
                filterYear === y ? 'border-primary bg-primary/10 text-primary' : 'border-border text-dim hover:border-primary/30'
              }`}
            >{y}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-10 p-10">
        <div className="relative" style={{ minHeight: 180 }}>
          {/* Tier 3 — ambient real-math hero (a computed function surface, not
              stock decoration), rotating slowly behind the header only. */}
          <div className="absolute inset-0" style={{ pointerEvents: 'none', zIndex: 0 }}>
            <Scene3DLazy
              scene={() => import('../components/motion/scenes/ExamSelectHeroScene.jsx')}
              fallback={<StaticRippleFallback />}
            />
          </div>
          <Reveal3D variant="tilt" amount={0.3} className="relative flex flex-col gap-2" style={{ zIndex: 10 }}>
            <h1 className="font-display text-[36px] font-bold text-gradient-brand">Chọn đề thi</h1>
            <p className="font-sans text-sm text-dim">{motivationalHeader}</p>
          </Reveal3D>
        </div>

        <motion.div
          className="flex flex-col gap-10"
          variants={listVariants}
          initial="hidden"
          animate="show"
        >
          {groups.map(group => {
            const groupExams = exams.filter(e => e.category === group.category && e._examType === group.source)
            const groupKey = group.category + (group.source ?? '')
            if (groupExams.length === 0) return null
            return (
              <motion.section key={groupKey} variants={cardVariants}>
                <Reveal3D variant="rise">
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="font-sans text-[0.6875rem] font-bold tracking-[2px] uppercase px-2.5 py-1 rounded"
                      style={{ background: group.accent + '22', color: group.accent }}
                    >
                      {group.tag}
                    </span>
                    <div>
                      <h2 className="font-sans text-[22px] font-bold text-foreground leading-tight">{group.label}</h2>
                      <p className="font-sans text-[0.8125rem] text-dim">{group.description}</p>
                    </div>
                  </div>
                  <div className="h-px mb-4" style={{ background: group.accent + '33' }} />
                </Reveal3D>

                {(() => {
                  const SHOW_FIRST = 5
                  const isExpanded = !!expandedCategories[groupKey]
                  const visibleExams = isExpanded ? groupExams : groupExams.slice(0, SHOW_FIRST)
                  const hiddenCount = groupExams.length - SHOW_FIRST
                  return (
                    <div className="flex flex-col gap-3">
                      {visibleExams.map(exam => (
                        <TiltCard key={exam.id} className="rounded-xl">
                          <motion.div
                            variants={cardVariants}
                            {...hoverProps}
                            className="glass-base rounded-xl px-6 py-5 flex flex-col gap-3"
                            style={{ borderLeft: `3px solid ${group.accent}99` }}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex flex-col gap-1.5">
                                <span className="font-sans text-[15px] font-semibold text-foreground">{exam.title}</span>
                                <span className="font-sans text-[0.8125rem] text-dim">
                                  {exam.year} · {exam.totalQuestions} câu · {exam.duration} phút
                                  {exam.source && ` · ${exam.source}`}
                                  {bestScores[exam.id] !== undefined && ` · Điểm cao nhất: ${bestScores[exam.id]}`}
                                </span>
                              </div>
                              <button
                                onClick={() => openPreview(exam)}
                                className="flex-shrink-0 px-5 py-2 rounded-md font-sans text-[0.8125rem] font-semibold transition"
                                style={{ background: 'transparent', border: `1px solid ${group.accent}`, color: group.accent }}
                                onMouseEnter={e => e.currentTarget.style.background = group.accent + '1A'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                onFocus={e => e.currentTarget.style.background = group.accent + '1A'}
                                onBlur={e => e.currentTarget.style.background = 'transparent'}
                              >
                                Bắt đầu
                              </button>
                            </div>
                          </motion.div>
                        </TiltCard>
                      ))}
                      {!isExpanded && hiddenCount > 0 && (
                        <button
                          onClick={() => setExpandedCategories(prev => ({ ...prev, [groupKey]: true }))}
                          className="font-sans text-[0.8125rem] text-center py-2.5 rounded-xl border border-dashed border-border text-faint hover:text-muted hover:border-border-subtle transition">
                          + Xem thêm ({hiddenCount} đề)
                        </button>
                      )}
                    </div>
                  )
                })()}
              </motion.section>
            )
          })}
        </motion.div>
      </div>

      {/* Exam preview modal */}
      <AnimatePresence>
        {previewExam && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.50)' }}
            onClick={closePreview}
          >
            <div className="w-full max-w-sm glass-elevated rounded-2xl overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={e => e.stopPropagation()}
              className="p-7 flex flex-col gap-5"
            >
              <div className="flex flex-col gap-1.5">
                <span className="font-sans text-[18px] font-semibold text-foreground">{previewExam.title}</span>
                <span className="font-sans text-[0.8125rem] text-dim">{previewExam.year}</span>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex flex-col gap-0.5">
                  <span className="font-sans text-[0.6875rem] text-faint">Số câu</span>
                  <span className="font-sans text-[16px] font-bold text-foreground">{previewExam.totalQuestions}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-sans text-[0.6875rem] text-faint">Thời gian</span>
                  <span className="font-sans text-[16px] font-bold text-foreground">{previewExam.duration} phút</span>
                </div>
                {previewExam.source && (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-sans text-[0.6875rem] text-faint">Nguồn</span>
                    <span className="font-sans text-[0.8125rem] text-muted">{previewExam.source}</span>
                  </div>
                )}
              </div>
              {/* Pre-exam briefing — checklist + weak topic warning */}
              <div className="rounded-xl glass-base px-4 py-3.5 flex flex-col gap-2.5">
                <span className="font-sans text-[0.6875rem] font-bold text-info uppercase tracking-wider">Chuẩn bị trước khi thi</span>
                <div className="flex flex-col gap-1.5">
                  {[
                    { key: 'quiet', label: 'Không gian yên tĩnh' },
                    { key: 'water', label: 'Nước uống sẵn sàng' },
                    { key: 'phone', label: 'Điện thoại đã tắt tiếng' },
                  ].map(({ key, label }) => (
                    <button key={key}
                      onClick={() => setBriefingChecked(p => ({ ...p, [key]: !p[key] }))}
                      className="flex items-center gap-2 text-left group"
                    >
                      <span className={`w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center text-[0.625rem] transition ${briefingChecked[key] ? 'bg-success border-success text-white' : 'border-border'}`}>
                        {briefingChecked[key] ? '✓' : ''}
                      </span>
                      <span className={`font-sans text-[0.8125rem] transition ${briefingChecked[key] ? 'text-success line-through' : 'text-muted'}`}>{label}</span>
                    </button>
                  ))}
                </div>
                {(() => {
                  if (!results || results.length === 0) return null
                  const briefing = buildBriefing(results, previewExam)
                  if (!briefing) return null
                  return (
                    <>
                      <p className="font-sans text-[0.8125rem] text-muted leading-relaxed">{briefing.message}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {briefing.weakTopics.map(w => (
                          <span key={w.topic} className="px-2.5 py-1 rounded-full bg-destructive/10 border border-destructive/30 font-sans text-[0.6875rem] text-destructive">
                            {w.label} · {w.accuracy}%
                          </span>
                        ))}
                      </div>
                    </>
                  )
                })()}
              </div>
              {/* Metacognitive check — topic worry question */}
              {(() => {
                if (!results || results.length === 0) return null
                const briefing = buildBriefing(results, previewExam)
                if (!briefing || briefing.weakTopics.length < 2) return null
                return (
                  <div className="flex flex-col gap-2">
                    <span className="font-sans text-[0.6875rem] font-semibold text-dim">Chủ đề nào khiến bạn lo lắng nhất?</span>
                    <div className="flex flex-wrap gap-1.5">
                      {briefing.weakTopics.map(w => (
                        <button
                          key={w.topic}
                          onClick={() => {
                            const next = metacogAnswer === w.topic ? null : w.topic
                            setMetacogAnswer(next)
                            if (next) {
                              try { localStorage.setItem('metacog_worry', JSON.stringify({ topic: next, label: w.label, ts: Date.now() })) } catch {}
                            }
                          }}
                          className={`px-2.5 py-1 rounded-full font-sans text-[0.6875rem] border transition ${
                            metacogAnswer === w.topic
                              ? 'bg-primary/15 border-primary/40 text-primary font-semibold'
                              : 'bg-surface border-border text-muted'
                          }`}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>
                    {metacogAnswer && (
                      <p className="font-sans text-[0.6875rem] text-info">
                        Chú ý kỹ câu {metacogAnswer ? briefing.weakTopics.find(w => w.topic === metacogAnswer)?.label : ''} trong bài thi này.
                      </p>
                    )}
                  </div>
                )
              })()}
              <div className="flex flex-col gap-2 mt-1">
                <div className="flex gap-2">
                  <button
                    onClick={() => confirmStart(previewExam, 'timed')}
                    className="flex-1 py-3 rounded-xl font-sans text-[0.8125rem] font-bold bg-primary text-primary-fg hover:opacity-90 transition"
                  >
                    ⏱ Thi thử
                  </button>
                  <button
                    onClick={() => confirmStart(previewExam, 'practice')}
                    className="flex-1 py-3 rounded-xl font-sans text-[0.8125rem] font-semibold border border-border text-foreground hover:border-primary/40 transition"
                  >
                    ✎ Ôn luyện
                  </button>
                </div>
                <button
                  onClick={closePreview}
                  className="w-full py-2 rounded-xl font-sans text-[0.8125rem] text-faint hover:text-muted transition"
                >
                  Huỷ
                </button>
              </div>
            </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
