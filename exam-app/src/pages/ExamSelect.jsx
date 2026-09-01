import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExamDispatch } from '../context/ExamContext.jsx'
import { useHistory } from '../context/HistoryContext.jsx'
import { loadExams, loadThiThuExams, loadQuestionsByIds, loadExamById } from '../api/index.js'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants, viewNavigate } from '../utils/animations.js'

import { usePageMeta } from '../hooks/usePageMeta.js'
import { buildBriefing } from '../utils/examBriefing.js'
import { useEscapeToClose } from '../hooks/useEscapeToClose.js'

// 02-chon-de.md — "TRẠM · BẢN ĐỒ TUYẾN". The page is the map: four routes,
// each exam a station on it. No card grid, no chip filter, no decorative 3D
// hero (the old ExamSelectHeroScene purple ripple-mesh was removed — the
// north-star concept for this screen has no room for a second signature
// moment competing with the route table itself).

// Exact 4-route → token-color mapping from the spec. Do not add a 5th color.
const ROUTES = [
  { key: 'thpt-timed', category: 'thpt', source: 'timed', label: 'Thi THPT Quốc gia', description: 'Đề thi & thi thử tốt nghiệp THPT từ Bộ GD&ĐT.', color: 'var(--accent)' },
  { key: 'grade10-timed', category: 'grade10', source: 'timed', label: 'Thi vào lớp 10', description: 'Đề thi tuyển sinh THCS lên THPT — 63 tỉnh thành.', color: 'var(--altitude)' },
  { key: 'grade10-practice', category: 'grade10', source: 'practice', label: 'Luyện tập vào lớp 10 (Quốc tế THCS)', description: 'Ghana BECE, Ấn Độ CBSE & Cambridge IGCSE.', color: 'var(--pine)' },
  { key: 'thpt-practice', category: 'thpt', source: 'practice', label: 'Luyện tập THPT & Đại học (Quốc tế)', description: 'SAT, ACT, A-Level, Bac Pháp, Irish LC, Singapore H2.', color: 'var(--ink)' },
]

const FILTER_KEY = 'examselect_filter'
const SHOW_FIRST = 5

function loadSavedFilters() {
  try { return JSON.parse(sessionStorage.getItem(FILTER_KEY) || '{}') } catch { return {} }
}
function saveFilters(f) {
  try { sessionStorage.setItem(FILTER_KEY, JSON.stringify(f)) } catch {}
}

// Difficulty sparkline — no per-question weight data exists anywhere in this
// dataset, so per the spec's own documented fallback ("nếu không có: đường
// tuyến tính theo thứ tự câu") this renders a plain straight ascending line,
// not a fabricated curve. Same geometry for every exam — that IS the honest
// fallback, not a bug. One ink color only, never heat-mapped by difficulty.
function SlopeSpark({ color = 'var(--ink)' }) {
  return (
    <svg width="96" height="28" viewBox="0 0 96 28" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M2 25 L94 4" stroke={color} strokeWidth="1" opacity="0.55" fill="none" />
      <path d="M2 25 L94 4 L94 28 L2 28 Z" fill={color} opacity="0.06" />
    </svg>
  )
}

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  show: (i) => ({ opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: Math.min(i, 8) * 0.024 } }),
}

function ExamRow({ exam, index, color, isOpen, onToggle, bestScore, onSelect }) {
  return (
    <div
      className="cursor-pointer"
      style={{ borderTop: '1px solid var(--line)' }}
      onClick={() => onToggle(exam.id, !isOpen)}
    >
      <div
        className="grid items-center gap-3 py-3.5"
        style={{ gridTemplateColumns: '1fr 52px 44px 52px 96px 84px' }}
      >
        <span className="font-display truncate" style={{ fontSize: 16, color: 'var(--ink)', fontWeight: 500 }}>
          {exam.title}
        </span>
        <span className="text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{exam.year}</span>
        <span className="text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{exam.totalQuestions}</span>
        <span className="text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{exam.duration}</span>
        <span title="Chưa có dữ liệu độ khó từng câu — hiển thị đường tuyến tính">
          <SlopeSpark color="var(--ink)" />
        </span>
        <span className="text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)' }}>
          {isOpen ? '' : `M·${String(index + 1).padStart(2, '0')} →`}
        </span>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="pb-4 flex flex-wrap items-center justify-between gap-3">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-2)' }}>
                {exam.source && `NGUỒN: ${exam.source.toUpperCase()}`}
                {bestScore !== undefined && ` · ĐIỂM CAO NHẤT: ${bestScore}`}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onSelect(exam) }}
                className="px-4 py-2 font-bold transition-colors"
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.04em',
                  background: color, color: 'var(--paper)', border: `1px solid ${color}`, borderRadius: 'var(--r-sm)',
                }}
              >
                CẮM MỐC NÀY ▲
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function RouteSection({ route, index, exams, expandedGroups, setExpandedGroups, openIds, toggleOpen, bestScores, onSelect }) {
  const isExpanded = !!expandedGroups[route.key]
  const visible = isExpanded ? exams : exams.slice(0, SHOW_FIRST)
  const hiddenCount = exams.length - SHOW_FIRST
  const isEmpty = exams.length === 0

  return (
    <section style={{ borderLeft: `3px solid ${route.color}`, paddingLeft: 'var(--s5)', opacity: isEmpty ? 0.4 : 1 }}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap pb-3" style={{ borderTop: '2px solid var(--ink)', paddingTop: 'var(--s3)' }}>
        <div>
          <h2 className="font-display font-medium" style={{ fontSize: 25, color: 'var(--ink)' }}>{route.label}</h2>
          <p className="font-sans" style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>{route.description}</p>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
          TUYẾN {String(index + 1).padStart(2, '0')} · {exams.length} MỐC
        </span>
      </div>

      {isEmpty ? (
        <p className="py-4" style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
          TUYẾN NÀY CHƯA CÓ MỐC TRONG DẢI NĂM
        </p>
      ) : (
        <>
          {visible.map((exam, i) => (
            <motion.div key={exam.id} custom={i} variants={rowVariants} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }}>
              <ExamRow
                exam={exam}
                index={i}
                color={route.color}
                isOpen={i === 0 || openIds.has(exam.id)}
                onToggle={(id, open) => toggleOpen(id, open)}
                bestScore={bestScores[exam.id]}
                onSelect={onSelect}
              />
            </motion.div>
          ))}
          {!isExpanded && hiddenCount > 0 && (
            <button
              onClick={() => setExpandedGroups(prev => ({ ...prev, [route.key]: true }))}
              className="w-full text-left py-3"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--accent)', borderTop: '1px solid var(--line)' }}
            >
              + NÉT TIẾP ({hiddenCount})
            </button>
          )}
        </>
      )}
    </section>
  )
}

// Year range slider — single-thumb track over [ALL, ...availableYears asc].
// Position 0 = "TẤT CẢ" (full drag left = every year, matches the spec's
// "kéo full dải" semantics); positions 1..N = one real year each. Fill runs
// from the left edge to the thumb in accent, per the trắc địa track spec.
function YearSlider({ availableYears, filterYear, setYear }) {
  const years = [...availableYears].sort((a, b) => a - b)
  const positions = [null, ...years]
  const value = filterYear === null ? 0 : positions.indexOf(filterYear)
  const max = positions.length - 1

  return (
    <div className="flex flex-col gap-1.5 w-full max-w-md">
      <div className="relative h-5 flex items-center">
        <div className="absolute left-0 right-0 h-px" style={{ background: 'var(--line)' }} />
        <div className="absolute left-0 h-px" style={{ background: 'var(--accent)', width: max > 0 ? `${(value / max) * 100}%` : '100%' }} />
        <input
          type="range"
          min={0}
          max={max}
          step={1}
          value={value}
          onChange={(e) => setYear(positions[Number(e.target.value)])}
          className="absolute left-0 right-0 w-full appearance-none bg-transparent cursor-pointer"
          style={{ accentColor: 'var(--accent)', height: 20 }}
          aria-label="Lọc theo năm"
          aria-valuetext={filterYear === null ? 'Tất cả các năm' : String(filterYear)}
        />
      </div>
      <div className="flex justify-between" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
        <span>TẤT CẢ</span>
        {years.length > 0 && (
          <span className="hidden sm:inline">
            {years.map(y => (
              <span key={y} className="inline-block" style={{ width: 34, textAlign: 'right', color: filterYear === y ? 'var(--accent)' : 'var(--ink-3)' }}>{y}</span>
            ))}
          </span>
        )}
        <span className="sm:hidden">{years[years.length - 1]}</span>
      </div>
    </div>
  )
}

export default function ExamSelect() {
  usePageMeta('Chọn đề thi', { description: 'Đề thi THPT & lớp 10 từ 63 tỉnh thành · Luyện tập toán có thời gian.' })
  const navigate = useNavigate()
  const dispatch = useExamDispatch()
  const { results } = useHistory()
  const [previewExam, setPreviewExam] = useState(null)
  const [expandedGroups, setExpandedGroups] = useState({})
  const [openIds, setOpenIds] = useState(() => new Set())

  const saved = loadSavedFilters()
  const [filterYear, setFilterYear] = useState(saved.year ?? null)
  const [filterSearch, setFilterSearch] = useState(saved.search ?? '')
  const [allExams, setAllExams] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [briefingChecked, setBriefingChecked] = useState({ quiet: false, water: false, phone: false })
  const [metacogAnswer, setMetacogAnswer] = useState(null)

  useEffect(() => {
    Promise.all([loadThiThuExams(), loadExams()]).then(([timedData, practiceData]) => {
      setAllExams([
        ...timedData.map(e => ({ ...e, _examType: 'timed' })),
        ...practiceData.map(e => ({ ...e, _examType: 'practice' })),
      ])
      setLoaded(true)
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
  function toggleOpen(id, open) {
    setOpenIds(prev => {
      const next = new Set(prev)
      if (open) next.add(id); else next.delete(id)
      return next
    })
  }

  async function handleStart(exam, startMode = 'timed') {
    const ids = exam.questionIds?.length ? exam.questionIds : (loadExamById(exam.id)?.questionIds ?? [])
    const questions = await loadQuestionsByIds(ids)
    dispatch({ type: 'START_EXAM', exam, questions, mode: startMode })
    viewNavigate(navigate, `/test/${exam.id}`)
  }

  function openPreview(exam) { setPreviewExam(exam); setBriefingChecked({ quiet: false, water: false, phone: false }); setMetacogAnswer(null) }
  function closePreview() { setPreviewExam(null) }
  function confirmStart(exam, startMode) { closePreview(); handleStart(exam, startMode) }
  useEscapeToClose(!!previewExam, closePreview)

  const resumeTitle = useMemo(() => {
    if (!results || results.length === 0) return null
    const sorted = [...results].sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))
    return loadExamById(sorted[0].examId)?.title ?? null
  }, [results])

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show" exit="exit" className="min-h-screen flex flex-col relative">
      <div className="max-w-6xl mx-auto w-full px-6 sm:px-10 pt-8 pb-20 flex flex-col gap-8">

        {/* Header — "TRẠM" */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-3" style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.1em', color: 'var(--accent)' }}>
              <span style={{ width: 24, height: 1, background: 'var(--accent)', display: 'inline-block' }} />
              TRẠM · BẢN ĐỒ TUYẾN · {allExams.length}+ MỐC THẬT
            </span>
            <span className="hidden sm:inline" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
              {ROUTES.length} TUYẾN · LỌC THEO MỐC NĂM
            </span>
          </div>
          <h1 className="font-display font-bold" style={{ fontSize: 39, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Chọn mốc để cắm.</h1>
          <p style={{ fontSize: 15, color: 'var(--ink-2)', maxWidth: '60ch' }}>
            Mỗi đề là một cột mốc trên tuyến. Rê qua để xem độ dốc, cắm mốc để bắt đầu leo.
            {resumeTitle && <> Tiếp tục từ <em>{resumeTitle}</em>.</>}
          </p>
        </div>

        {/* Filter bar — search + year slider (replaces chip filter) */}
        <div className="flex flex-wrap items-center gap-5 py-4" style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
          <input
            type="search"
            placeholder="Tìm đề thi..."
            value={filterSearch}
            onChange={e => setSearch(e.target.value)}
            className="h-9 px-3 font-sans text-[13px] focus:outline-none w-48"
            style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', color: 'var(--ink)' }}
          />
          <YearSlider availableYears={availableYears} filterYear={filterYear} setYear={setYear} />
        </div>

        {/* Routes */}
        {!loaded ? (
          <div className="flex flex-col gap-10">
            {ROUTES.map(r => (
              <div key={r.key} style={{ borderLeft: `3px solid ${r.color}`, paddingLeft: 'var(--s5)', opacity: 0.5 }}>
                <div style={{ borderTop: '2px solid var(--ink)', paddingTop: 'var(--s3)' }} className="pb-3">
                  <div className="h-6 w-48 animate-pulse" style={{ background: 'var(--paper-2)', borderRadius: 'var(--r-sm)' }} />
                </div>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 animate-pulse" style={{ borderTop: '1px solid var(--line)', background: i % 2 ? 'var(--paper-2)' : 'transparent' }} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {ROUTES.map((route, i) => {
              const routeExams = exams.filter(e => e.category === route.category && e._examType === route.source)
              return (
                <RouteSection
                  key={route.key}
                  route={route}
                  index={i}
                  exams={routeExams}
                  expandedGroups={expandedGroups}
                  setExpandedGroups={setExpandedGroups}
                  openIds={openIds}
                  toggleOpen={toggleOpen}
                  bestScores={bestScores}
                  onSelect={openPreview}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Exam preview modal — "Lệnh Xuất Phát Mốc" (spec item #1) */}
      <AnimatePresence>
        {previewExam && (
          <div className="vtg-overlay" onClick={closePreview}>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="vtg-modal"
              style={{ maxWidth: 420 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="vtg-modal-head">
                <div className="min-w-0">
                  <span className="vtg-modal-kicker">LỆNH XUẤT PHÁT MỐC</span>
                  <span className="vtg-modal-title" style={{ display: 'block' }}>{previewExam.title}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{previewExam.year}</span>
                </div>
                <button onClick={closePreview} className="vtg-modal-close" aria-label="Đóng">✕</button>
              </div>

              <div className="vtg-modal-body">
                <div className="vtg-ledger-table">
                  <div className="vtg-ledger-row">
                    <span className="vtg-ledger-label">Số câu</span>
                    <span className="vtg-ledger-value">{previewExam.totalQuestions}</span>
                  </div>
                  <div className="vtg-ledger-row">
                    <span className="vtg-ledger-label">Thời gian</span>
                    <span className="vtg-ledger-value">{previewExam.duration} phút</span>
                  </div>
                  {previewExam.source && (
                    <div className="vtg-ledger-row">
                      <span className="vtg-ledger-label">Nguồn</span>
                      <span className="vtg-ledger-value" style={{ fontWeight: 400 }}>{previewExam.source}</span>
                    </div>
                  )}
                </div>

                {/* Pre-exam briefing — checklist + weak topic warning */}
                <div className="flex flex-col gap-2.5 px-4 py-3.5" style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--paper-2)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--altitude)' }}>CHUẨN BỊ TRƯỚC KHI THI</span>
                  <div className="flex flex-col gap-1.5">
                    {[
                      { key: 'quiet', label: 'Không gian yên tĩnh' },
                      { key: 'water', label: 'Nước uống sẵn sàng' },
                      { key: 'phone', label: 'Điện thoại đã tắt tiếng' },
                    ].map(({ key, label }) => (
                      <button key={key}
                        onClick={() => setBriefingChecked(p => ({ ...p, [key]: !p[key] }))}
                        className="flex items-center gap-2 text-left"
                      >
                        <span
                          className="w-4 h-4 flex-shrink-0 flex items-center justify-center text-[0.625rem] transition"
                          style={{
                            border: `1px solid ${briefingChecked[key] ? 'var(--pine)' : 'var(--line)'}`,
                            background: briefingChecked[key] ? 'var(--pine)' : 'transparent',
                            color: 'var(--paper)', borderRadius: 3,
                          }}
                        >
                          {briefingChecked[key] ? '✓' : ''}
                        </span>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: briefingChecked[key] ? 'var(--pine)' : 'var(--ink-2)', textDecoration: briefingChecked[key] ? 'line-through' : 'none' }}>{label}</span>
                      </button>
                    ))}
                  </div>
                  {(() => {
                    if (!results || results.length === 0) return null
                    const briefing = buildBriefing(results, previewExam)
                    if (!briefing) return null
                    return (
                      <>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{briefing.message}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {briefing.weakTopics.map(w => (
                            <span key={w.topic} className="px-2.5 py-1" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, border: '1px solid var(--accent)', color: 'var(--accent-deep)', borderRadius: 'var(--r-sm)' }}>
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
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>Chủ đề nào khiến bạn lo lắng nhất?</span>
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
                            className="px-2.5 py-1 transition"
                            style={{
                              fontFamily: 'var(--font-mono)', fontSize: 10.5, borderRadius: 'var(--r-sm)',
                              border: `1px solid ${metacogAnswer === w.topic ? 'var(--ink)' : 'var(--line)'}`,
                              background: metacogAnswer === w.topic ? 'var(--paper-2)' : 'var(--paper)',
                              color: metacogAnswer === w.topic ? 'var(--ink)' : 'var(--ink-2)',
                              fontWeight: metacogAnswer === w.topic ? 600 : 400,
                            }}
                          >
                            {w.label}
                          </button>
                        ))}
                      </div>
                      {metacogAnswer && (
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--altitude)' }}>
                          Chú ý kỹ câu {metacogAnswer ? briefing.weakTopics.find(w => w.topic === metacogAnswer)?.label : ''} trong bài thi này.
                        </p>
                      )}
                    </div>
                  )
                })()}
              </div>

              <div className="vtg-modal-foot" style={{ justifyContent: 'space-between' }}>
                <button onClick={closePreview} className="vtg-btn-ghost">HUỶ</button>
                <div className="flex gap-2">
                  <button onClick={() => confirmStart(previewExam, 'practice')} className="vtg-btn-ghost">ÔN LUYỆN</button>
                  <button onClick={() => confirmStart(previewExam, 'timed')} className="vtg-btn-primary">CẮM MỐC XUẤT PHÁT ▲</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
