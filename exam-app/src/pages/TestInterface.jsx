import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants, viewNavigate } from '../utils/animations.js'
import { useNavigate, useParams } from 'react-router-dom'
import { useExam, useExamDispatch, useFlags } from '../context/ExamContext.jsx'
import QuestionCard from '../components/QuestionCard.jsx'
import Timer from '../components/Timer.jsx'
import { FormulaDrawer } from '../components/FormulaDrawer.jsx'
import VantageLogo from '../components/VantageLogo.jsx'
import { useTheme } from '../hooks/useTheme.js'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { useEscapeToClose } from '../hooks/useEscapeToClose.js'
import { scoreExam } from '../engine/scoringEngine.js'
import { track } from '../lib/eventTrack.js'
import ProctoringMonitor from '../components/ProctoringMonitor.jsx'

import { TOPIC_LABELS } from '../utils/topicLabels.js'

const DIFF_LABELS = { easy: 'DỄ', medium: 'VỪA', hard: 'KHÓ' }
const KB_HINT_KEY = 'kb_hint_seen'

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.5M12 19v2.5M4.4 4.4l1.8 1.8M17.8 17.8l1.8 1.8M2.5 12H5M19 12h2.5M4.4 19.6l1.8-1.8M17.8 6.2l1.8-1.8" />
    </svg>
  )
}
function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" />
    </svg>
  )
}
function FlagIcon() {
  return (
    <svg width="11" height="13" viewBox="0 0 11 13" fill="none" aria-hidden="true">
      <path d="M1 1v11M1 1h7.5l-2 3.5 2 3.5H1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function TestInterface() {
  usePageMeta('Đang thi', { noindex: true })
  const navigate = useNavigate()
  const { examId } = useParams()
  const session = useExam()
  const dispatch = useExamDispatch()
  const { theme, toggleTheme } = useTheme()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [submitModal, setSubmitModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [pauseOverlay, setPauseOverlay] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [showKbHint, setShowKbHint] = useState(() => !sessionStorage.getItem(KB_HINT_KEY))
  const [tabSwitchCount, setTabSwitchCount] = useState(0)
  const [diffAura, setDiffAura] = useState(false)
  const [showBackModal, setShowBackModal] = useState(false)
  const prevDiffRef = useRef(null)
  const [showTabWarning, setShowTabWarning] = useState(false)
  const [devToolsOpen, setDevToolsOpen] = useState(false)

  // Time-per-question tracking
  const questionStartTime = useRef(Date.now())

  function recordTimeForQuestion(qId) {
    const elapsed = Math.round((Date.now() - questionStartTime.current) / 1000)
    if (qId && elapsed > 0) dispatch({ type: 'RECORD_TIME', questionId: qId, seconds: elapsed })
    questionStartTime.current = Date.now()
  }

  useEffect(() => {
    if (session.status === 'idle' || !session.exam || session.exam.id !== examId) {
      navigate('/exams', { replace: true })
    }
  }, [session.status, session.exam, examId, navigate])

  useEffect(() => {
    if (session.exam?.id === examId && session.status === 'active') {
      track('exam_started', { examId, mode: session.mode })
    }
  }, [session.exam?.id, examId, session.mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Timer tick (only when active)
  useEffect(() => {
    if (session.mode !== 'timed' || session.status !== 'active') return
    const id = setInterval(() => dispatch({ type: 'TICK' }), 1000)
    return () => clearInterval(id)
  }, [session.mode, session.status, dispatch])

  // Timeout → auto-submit
  useEffect(() => {
    if (session.status === 'timeout') {
      const scored = scoreExam(session)
      dispatch({ type: 'SUBMIT' })
      navigate('/results/current', { replace: true, state: { result: scored } })
    }
  }, [session.status, dispatch, navigate]) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist answers to sessionStorage so a refresh mid-exam doesn't lose work
  useEffect(() => {
    if (!examId || !session.answers || session.status !== 'active') return
    sessionStorage.setItem(`exam-draft-${examId}`, JSON.stringify({
      examId,
      answers: session.answers,
      startedAt: session.startedAt ?? new Date().toISOString(),
      mode: session.mode,
    }))
  }, [examId, session.answers, session.status])

  // Auto-pause + tab-switch tracking
  useEffect(() => {
    function handleVisibility() {
      if (document.hidden && session.status === 'active') {
        setTabSwitchCount(n => n + 1)
        setShowTabWarning(true)
        if (session.mode === 'timed') {
          dispatch({ type: 'PAUSE' })
          setPauseOverlay(true)
          track('exam_paused', { examId, elapsedMs: Date.now() - questionStartTime.current })
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [session.mode, session.status, dispatch])

  // Tier 1 — copy/cut/contextmenu/keyboard blockers (timed mode only; learning/practice stays unrestricted)
  useEffect(() => {
    if (session.status !== 'active' || session.mode !== 'timed') return
    const blockCopy = (e) => { e.preventDefault(); e.stopPropagation() }
    const blockKey = (e) => {
      if (e.key === 'PrintScreen') { e.preventDefault(); navigator.clipboard?.writeText('').catch(() => {}) }
      if ((e.ctrlKey || e.metaKey) && ['a', 'u', 's', 'p'].includes(e.key.toLowerCase())) e.preventDefault()
    }
    document.addEventListener('copy', blockCopy)
    document.addEventListener('cut', blockCopy)
    document.addEventListener('contextmenu', blockCopy)
    window.addEventListener('keydown', blockKey)
    return () => {
      document.removeEventListener('copy', blockCopy)
      document.removeEventListener('cut', blockCopy)
      document.removeEventListener('contextmenu', blockCopy)
      window.removeEventListener('keydown', blockKey)
    }
  }, [session.status, session.mode])

  // Tier 2 — DevTools detection via window size delta (timed mode only)
  useEffect(() => {
    if (session.status !== 'active' || session.mode !== 'timed') return
    const id = setInterval(() => {
      const threshold = 160
      const open = window.outerWidth - window.innerWidth > threshold ||
                   window.outerHeight - window.innerHeight > threshold
      setDevToolsOpen(open)
    }, 1000)
    return () => clearInterval(id)
  }, [session.status, session.mode])

  // Fullscreen sync
  useEffect(() => {
    function onFsChange() { setFullscreen(!!document.fullscreenElement) }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // Keyboard shortcuts
  const { questions, answers, mode, timeLeft, exam } = session
  const question = questions[currentIndex]

  // Adaptive difficulty aura — pulse when difficulty level changes between questions
  useEffect(() => {
    const diff = question?.difficulty ?? null
    if (prevDiffRef.current !== null && prevDiffRef.current !== diff) {
      setDiffAura(true)
      const t = setTimeout(() => setDiffAura(false), 700)
      return () => clearTimeout(t)
    }
    prevDiffRef.current = diff
  }, [question?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAnswerCallback = useCallback((choiceIndex) => {
    if (!question) return
    dispatch({ type: 'ANSWER_QUESTION', questionId: question.id, choiceIndex })
    track('question_answered', { questionId: question.id, topic: question.topic })
  }, [dispatch, question])

  useEffect(() => {
    if (session.status !== 'active' || submitModal || pauseOverlay) return
    function onKey(e) {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      switch (e.key) {
        case 'a': case 'A': handleAnswerCallback(0); break
        case 'b': case 'B': handleAnswerCallback(1); break
        case 'c': case 'C': handleAnswerCallback(2); break
        case 'd': case 'D': handleAnswerCallback(3); break
        case 'ArrowRight': handleNext(); break
        case 'ArrowLeft': handlePrev(); break
        case 'f': case 'F': if (question) dispatch({ type: 'TOGGLE_FLAG', questionId: question.id }); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session.status, submitModal, pauseOverlay, handleAnswerCallback, currentIndex]) // eslint-disable-line

  // Practice mode back guard — intercept browser Back so answers aren't silently lost.
  // Timed mode already blocks back via anti-cheat; this only activates for practice.
  useEffect(() => {
    if (mode !== 'practice' || session.status !== 'active') return
    // Push a synthetic entry so the first Back press fires popstate instead of navigating.
    window.history.pushState(null, '', window.location.href)
    function onPop() {
      // Re-push so repeated Back presses keep triggering the modal.
      window.history.pushState(null, '', window.location.href)
      setShowBackModal(true)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [mode, session.status])

  const { flags, toggleFlag } = useFlags()

  // Escape closes dismissible modals — the pause overlay is deliberately excluded (mandatory lock).
  useEscapeToClose(submitModal, () => setSubmitModal(false))
  useEscapeToClose(showBackModal, () => setShowBackModal(false))

  if (session.status === 'idle' || !session.exam) return null

  const chosen = answers[question?.id] ?? null
  const isLast = currentIndex === questions.length - 1
  const isPractice = mode === 'practice'
  const progress = ((currentIndex + 1) / questions.length) * 100
  const isFlagged = flags[question?.id] ?? false
  const flagged = questions.map((q, i) => ({ q, i })).filter(({ q }) => flags[q.id])
  const unanswered = questions.map((q, i) => ({ q, i })).filter(({ q }) => answers[q.id] === undefined)
  const allAnswered = unanswered.length === 0
  const answeredCount = questions.length - unanswered.length

  function handleAnswer(choiceIndex) {
    dispatch({ type: 'ANSWER_QUESTION', questionId: question.id, choiceIndex })
    track('question_answered', { questionId: question.id, topic: question.topic })
  }

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      recordTimeForQuestion(question?.id)
      setCurrentIndex(i => i + 1)
    }
  }

  function handlePrev() {
    if (currentIndex > 0) {
      recordTimeForQuestion(question?.id)
      setCurrentIndex(i => i - 1)
    }
  }

  function jumpTo(i) {
    recordTimeForQuestion(question?.id)
    setCurrentIndex(i)
  }

  function handleSubmit() { setSubmitModal(true) }

  function confirmSubmit() {
    if (submitting) return
    setSubmitting(true)
    recordTimeForQuestion(question?.id)
    sessionStorage.removeItem(`exam-draft-${examId}`)
    const scored = scoreExam(session)
    dispatch({ type: 'SUBMIT' })
    track('exam_submitted', { examId, score: scored?.score, durationMs: Date.now() - (session.startedAt ? Date.parse(session.startedAt) : Date.now()) })
    viewNavigate(navigate, '/results/current', { replace: true, state: { result: scored, tab_switches: tabSwitchCount, devtools_detected: devToolsOpen ? 1 : 0 } })
  }

  function resumeFromPause() {
    dispatch({ type: 'RESUME' })
    setPauseOverlay(false)
    questionStartTime.current = Date.now()
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  }

  function dismissKbHint() {
    sessionStorage.setItem(KB_HINT_KEY, '1')
    setShowKbHint(false)
  }

  const canProceed = isPractice ? chosen !== null : true
  const usedSeconds = session.startedAt ? Math.round((Date.now() - Date.parse(session.startedAt)) / 1000) : 0
  const usedLabel = `${String(Math.floor(usedSeconds / 60)).padStart(2, '0')}:${String(usedSeconds % 60).padStart(2, '0')}`

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show" exit="exit"
      className="min-h-screen flex flex-col relative" style={{ background: 'var(--paper)' }}>

      {mode === 'timed' && (
        <ProctoringMonitor
          examId={examId}
          stakesTier={exam?.stakesTier ?? 'low'}
          tabSwitchCount={tabSwitchCount}
          devToolsOpen={devToolsOpen}
        />
      )}

      {/* Exam Top Bar */}
      <div className="sticky top-0 z-30" style={{
        height: 60, background: 'color-mix(in srgb, var(--paper) 92%, transparent)',
        backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--line)',
      }}>
        <div className="h-full flex items-center justify-between px-4 sm:px-6 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <VantageLogo variant="nav" />
            <span className="hidden sm:inline-block px-2 py-1" style={{
              fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.08em',
              color: 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
            }}>
              {mode === 'timed' ? 'SƯỜN LÀM BÀI' : 'ÔN LUYỆN'}
            </span>
          </div>

          <div className="hidden md:flex flex-col items-center min-w-0">
            <span className="truncate max-w-md" style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
              {exam?.title}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.03em' }}>
              NGUỒN: {exam?.source ?? 'VANTAGE'} · {questions.length} TRẠM · {mode === 'timed' ? 'CHẾ ĐỘ THI THẬT' : 'ÔN LUYỆN'}
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-shrink-0">
            {mode === 'timed' && timeLeft !== null && (
              <Timer timeLeft={timeLeft} totalTime={(session.exam?.duration ?? 0) * 60} />
            )}
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
              className="flex items-center justify-center w-8 h-8 transition-colors"
              style={{ color: 'var(--ink-2)', border: '1px solid var(--line)', background: 'var(--paper)', borderRadius: 'var(--r-sm)' }}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              onClick={toggleFullscreen}
              title={fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
              className="flex items-center justify-center w-8 h-8 transition-colors"
              style={{ color: 'var(--ink-2)', border: '1px solid var(--line)', background: 'var(--paper)', borderRadius: 'var(--r-sm)' }}
            >
              {fullscreen
                ? <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M5 1H1v4M9 1h4v4M5 13H1V9M9 13h4V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                : <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M1 5V1h4M9 1h4v4M1 9v4h4M13 9v4H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              }
            </button>
          </div>
        </div>
        {/* Altitude Strip */}
        <div className="absolute left-0 right-0 bottom-0" style={{ height: 3, background: 'var(--line-soft)' }}>
          <motion.div
            style={{ height: '100%', background: 'var(--accent)' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 w-full max-w-[1180px] mx-auto px-4 sm:px-6 py-6 md:py-8 flex flex-col gap-5">

        {/* Tab-switch warning banner */}
        {showTabWarning && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5" style={{ border: '1px solid var(--line)', background: 'var(--paper-2)', borderRadius: 'var(--r-sm)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-2)' }}>
              Bạn đã rời khỏi trang <strong style={{ color: 'var(--accent-deep)' }}>{tabSwitchCount}</strong> lần trong khi làm bài.
            </span>
            <button onClick={() => setShowTabWarning(false)} style={{ color: 'var(--ink-3)' }} className="text-base leading-none hover:opacity-70">×</button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-5 lg:gap-6 items-start">
          {/* LEFT — Question paper */}
          <div className="flex-1 min-w-0 w-full flex flex-col gap-5">
            {/* Keyboard hint (top, dismissible) */}
            <AnimatePresence>
              {showKbHint && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center justify-between gap-3 px-4 py-2"
                  style={{ border: '1px solid var(--line)', background: 'var(--paper-2)', borderRadius: 'var(--r-sm)' }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                    A · B · C · D chọn đáp án &nbsp;·&nbsp; ← → chuyển trạm &nbsp;·&nbsp; F cắm cờ &nbsp;·&nbsp; Esc đóng sổ/hộp thoại
                  </span>
                  <button onClick={dismissKbHint} style={{ color: 'var(--ink-3)' }} className="hover:opacity-70 text-base leading-none">×</button>
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderTop: '3px solid var(--ink)', borderRadius: '8px' }} className="px-5 sm:px-7 py-6 sm:py-7">
              {/* Paper header */}
              <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>
                    TRẠM {String(currentIndex + 1).padStart(2, '0')}/{questions.length}
                  </span>
                  {question?.topic && (
                    <span className="relative">
                      {diffAura && (
                        <motion.span
                          className="absolute inset-0 pointer-events-none"
                          initial={{ opacity: 0.6, scale: 1 }}
                          animate={{ opacity: 0, scale: 1.8 }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          style={{ background: 'var(--altitude)', borderRadius: 'var(--r-sm)' }}
                        />
                      )}
                      <span className="relative px-2.5 py-1" style={{
                        fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.05em',
                        color: 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
                      }}>
                        {(TOPIC_LABELS[question.topic] ?? question.topic).toUpperCase()}
                      </span>
                    </span>
                  )}
                  <span className="px-2.5 py-1" style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.05em',
                    color: 'var(--ink-3)', border: '1px solid var(--line-soft)', borderRadius: 'var(--r-sm)',
                  }}>
                    MỨC: {DIFF_LABELS[question?.difficulty] ?? 'VỪA'}
                  </span>
                </div>
                <button
                  onClick={() => toggleFlag(question.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 transition"
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.04em', fontWeight: 600,
                    background: isFlagged ? 'color-mix(in srgb, var(--accent) 12%, var(--paper))' : 'var(--paper)',
                    border: `1px solid ${isFlagged ? 'var(--accent)' : 'var(--line)'}`,
                    color: isFlagged ? 'var(--accent-deep)' : 'var(--ink-2)',
                    borderRadius: 'var(--r-sm)',
                  }}
                >
                  <FlagIcon />
                  {isFlagged ? 'ĐÃ CẮM CỜ MỐC NÀY ▲' : 'CẮM CỜ MỐC NÀY'}
                </button>
              </div>

              {/* Question + choices */}
              <AnimatePresence mode="wait">
                {question && (
                  <motion.div
                    key={question.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <QuestionCard
                      question={question}
                      chosen={chosen}
                      onAnswer={handleAnswer}
                      practiceMode={isPractice}
                      submitted={session.status === 'submitted'}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Nav row */}
            <div className="flex items-center justify-between gap-3 sticky bottom-0 lg:static z-20 py-3 -mx-4 px-4 lg:mx-0 lg:px-0" style={{ background: 'var(--paper)', borderTop: '1px solid var(--line-soft)' }}>
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="flex items-center gap-1.5 px-4 py-2.5 transition disabled:opacity-35"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-2)', border: '1px solid var(--line)', background: 'var(--paper)', borderRadius: 'var(--r-sm)' }}
              >
                ← TRẠM TRƯỚC
              </button>
              <div className="flex items-center gap-2.5">
                {!isLast && (
                  <button
                    onClick={handleNext}
                    disabled={isPractice && !canProceed}
                    className="flex items-center gap-1.5 px-5 py-2.5 transition disabled:opacity-35"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--ink)', border: '1px solid var(--line)', background: 'var(--paper-2)', borderRadius: 'var(--r-sm)' }}
                  >
                    TRẠM TIẾP →
                  </button>
                )}
                {(isLast || !isPractice) && (
                  <button
                    onClick={handleSubmit}
                    className="flex items-center gap-1.5 px-5 py-2.5 transition hover:opacity-90"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--accent-fg)', background: 'var(--accent)', borderRadius: 'var(--r-sm)' }}
                  >
                    GẤP BÀI THI ▲
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT — Station map + formula pocket book */}
          <div className="w-full lg:w-[340px] flex-shrink-0 flex flex-col gap-4 lg:sticky lg:top-[76px]">
            <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: '8px' }} className="p-4">
              <div className="flex items-center justify-between mb-3.5">
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', color: 'var(--ink-2)', fontWeight: 600 }}>
                  BẢN ĐỒ CỘT MỐC
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                  {String(answeredCount).padStart(2, '0')}/{questions.length} ĐÃ CẮM
                </span>
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {questions.map((q, i) => {
                  const answeredQ = answers[q.id] !== undefined
                  const isQFlagged = flags[q.id]
                  const isCurrent = i === currentIndex
                  let style = { border: '1px solid var(--line-soft)', background: 'transparent', color: 'var(--ink-3)' }
                  if (answeredQ) style = { border: '1px solid color-mix(in srgb, var(--pine) 40%, transparent)', background: 'color-mix(in srgb, var(--pine) 14%, var(--paper))', color: 'var(--pine)' }
                  if (isCurrent) style = { border: '2px solid var(--ink)', background: 'var(--paper-2)', color: 'var(--ink)' }
                  return (
                    <button
                      key={q.id}
                      onClick={() => jumpTo(i)}
                      className="relative flex items-center justify-center font-semibold"
                      style={{ width: 40, height: 40, borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: 12.5, ...style }}
                    >
                      {String(i + 1).padStart(2, '0')}
                      {isQFlagged && (
                        <span className="absolute" style={{ top: 3, right: 3, width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }} />
                      )}
                    </button>
                  )
                })}
              </div>
              <div className="mt-3.5 pt-3" style={{ borderTop: '1px solid var(--line-soft)', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.01em' }}>
                ● Đang đứng &nbsp; ● Đã cắm mốc &nbsp; ▲ Cờ cần xem &nbsp; ○ Chưa tới
              </div>
            </div>

            <FormulaDrawer />
          </div>
        </div>
      </div>

      {/* DevTools warning overlay */}
      {devToolsOpen && session.status === 'active' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 pointer-events-none">
          <div className="px-6 py-4 pointer-events-auto" style={{ border: '1px solid var(--accent)', background: 'var(--paper)', borderRadius: 'var(--r-sm)' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-deep)', textAlign: 'center' }}>
              Vui lòng đóng DevTools để tiếp tục làm bài.
            </p>
          </div>
        </div>
      )}

      {/* Pause overlay — "Trạm tạm dừng & khóa giờ" (mandatory: no Escape/outside-click dismiss) */}
      <AnimatePresence>
        {pauseOverlay && (
          <div className="vtg-overlay">
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="vtg-modal"
              style={{ maxWidth: 380 }}
            >
              <div className="vtg-modal-head" style={{ justifyContent: 'center', textAlign: 'center', flexDirection: 'column', gap: 4 }}>
                <span className="vtg-modal-kicker">TRẠM TẠM DỪNG</span>
                <span className="vtg-modal-title">Đồng hồ đo cao đã khóa</span>
              </div>
              <div className="vtg-modal-body" style={{ alignItems: 'center', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--ink-2)' }}>Bạn đã rời khỏi tab — bộ đếm giờ đã dừng.</p>
              </div>
              <div className="vtg-modal-foot" style={{ justifyContent: 'center' }}>
                <button onClick={resumeFromPause} className="vtg-btn-primary">TIẾP TỤC THI ▲</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Submit confirmation modal — "Biên bản kiểm tra mốc" (spec item #2) */}
      {submitModal && (
        <div className="vtg-overlay" onClick={() => setSubmitModal(false)}>
          <div className="vtg-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="vtg-modal-head">
              <div>
                <span className="vtg-modal-kicker">BIÊN BẢN CHỐT BÀI</span>
                <span className="vtg-modal-title">Biên bản kiểm tra mốc</span>
              </div>
              <button onClick={() => setSubmitModal(false)} className="vtg-modal-close" aria-label="Đóng">✕</button>
            </div>

            <div className="vtg-modal-body">
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>Xác nhận trước khi gấp bài thi</p>

              <div className="vtg-ledger-table">
                {[
                  ['Tổng số trạm', questions.length],
                  ['Số trạm đã cắm', answeredCount],
                  ['Số câu chưa trả lời', unanswered.length],
                  ['Số cờ cần xem lại', flagged.length],
                  ['Thời gian đã dùng', usedLabel],
                ].map(([label, val]) => (
                  <div key={label} className="vtg-ledger-row">
                    <span className="vtg-ledger-label">{label}</span>
                    <span className="vtg-ledger-value">{val}</span>
                  </div>
                ))}
              </div>

              {!allAnswered && (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--accent-deep)' }}>
                  ▲ CHÚ Ý: BẠN VẪN CÒN {unanswered.length} CÂU CHƯA CẮM MỐC
                </p>
              )}

              {!allAnswered && (
                <div className="flex flex-wrap gap-2">
                  {unanswered.map(({ q, i }) => (
                    <button
                      key={q.id}
                      onClick={() => { jumpTo(i); setSubmitModal(false) }}
                      className="w-8 h-8 flex items-center justify-center transition"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 600, border: '1px solid var(--line)', color: 'var(--ink-2)', background: 'var(--paper-2)', borderRadius: 'var(--r-sm)' }}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}

              {flagged.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="flex items-center gap-1.5" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--accent-deep)' }}>
                    <FlagIcon />
                    {flagged.length} cờ cần xem lại
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {flagged.map(({ q, i }) => (
                      <button
                        key={q.id}
                        onClick={() => { jumpTo(i); setSubmitModal(false) }}
                        className="w-8 h-8 flex items-center justify-center transition hover:opacity-80"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 600, background: 'color-mix(in srgb, var(--accent) 10%, var(--paper))', border: '1px solid var(--accent)', color: 'var(--accent-deep)', borderRadius: 'var(--r-sm)' }}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="vtg-modal-foot">
              <button onClick={() => setSubmitModal(false)} className="vtg-btn-ghost">LÀM TIẾP</button>
              <button onClick={confirmSubmit} className="vtg-btn-primary">NỘP BÀI & XEM KẾT QUẢ ▲</button>
            </div>
          </div>
        </div>
      )}

      {/* Practice mode back guard modal */}
      {showBackModal && (
        <div className="vtg-overlay" onClick={() => setShowBackModal(false)}>
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="vtg-modal"
            style={{ maxWidth: 380 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="vtg-modal-head">
              <div>
                <span className="vtg-modal-kicker">THOÁT ÔN LUYỆN</span>
                <span className="vtg-modal-title">Thoát bài luyện tập?</span>
              </div>
              <button onClick={() => setShowBackModal(false)} className="vtg-modal-close" aria-label="Đóng">✕</button>
            </div>
            <div className="vtg-modal-body">
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink-2)' }}>Câu trả lời đã chọn vẫn được lưu. Bạn có thể tiếp tục sau.</p>
            </div>
            <div className="vtg-modal-foot">
              <button
                onClick={() => {
                  setShowBackModal(false)
                  sessionStorage.removeItem(`exam-draft-${examId}`)
                  dispatch({ type: 'RESET' })
                  navigate('/exams', { replace: true })
                }}
                className="vtg-btn-ghost"
              >
                LƯU NHÁP VÀ THOÁT
              </button>
              <button onClick={() => setShowBackModal(false)} className="vtg-btn-primary">LÀM TIẾP ▲</button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}
