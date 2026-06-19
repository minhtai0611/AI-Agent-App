import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants, viewNavigate } from '../utils/animations.js'
import { useNavigate, useParams } from 'react-router-dom'
import { useExam, useExamDispatch, useHints, useFlags } from '../context/ExamContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import QuestionCard from '../components/QuestionCard.jsx'
import Timer from '../components/Timer.jsx'
import { FormulaDrawer } from '../components/FormulaDrawer.jsx'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { embedWatermark } from '../utils/watermark.js'
import { scoreExam } from '../engine/scoringEngine.js'
import { buildAnalyzePayload } from '../api/index.js'
import { analyzeResult as aiAnalyzeResult } from '../api/aiClient.js'
import { safeSetItem } from '../utils/storageManager.js'

import { TOPIC_LABELS } from '../utils/topicLabels.js'

import { useOracle } from '../context/OracleContext.jsx'
const DIFF_LABELS = { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' }
const KB_HINT_KEY = 'kb_hint_seen'

export default function TestInterface() {
  usePageMeta('Đang thi', { noindex: true })
  const navigate = useNavigate()
  const { examId } = useParams()
  const session = useExam()
  const dispatch = useExamDispatch()
  const { user } = useAuth()
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
  const canvasRef = useRef(null)

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
      userId: user?.id ?? null,
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
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [session.mode, session.status, dispatch])

  // Tier 1 — copy/cut/contextmenu/keyboard blockers during active exam
  useEffect(() => {
    if (session.status !== 'active') return
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
  }, [session.status])

  // Tier 2 — DevTools detection via window size delta
  useEffect(() => {
    if (session.status !== 'active') return
    const id = setInterval(() => {
      const threshold = 160
      const open = window.outerWidth - window.innerWidth > threshold ||
                   window.outerHeight - window.innerHeight > threshold
      setDevToolsOpen(open)
    }, 1000)
    return () => clearInterval(id)
  }, [session.status])

  // Tier 3 — Canvas watermark overlay (user identity)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !user) return
    const ctx = canvas.getContext('2d')
    canvas.width = canvas.offsetWidth || 600
    canvas.height = canvas.offsetHeight || 400
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.font = '12px monospace'
    ctx.fillStyle = 'rgba(242,162,12,0.03)'
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate(-Math.PI / 6)
    const label = `${user.email ?? user.id} · ${user.id}`
    for (let y = -canvas.height; y < canvas.height; y += 60)
      for (let x = -canvas.width; x < canvas.width; x += 200)
        ctx.fillText(label, x, y)
    ctx.restore()
  }, [user, currentIndex])

  // Fullscreen sync
  useEffect(() => {
    function onFsChange() { setFullscreen(!!document.fullscreenElement) }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // Keyboard shortcuts
  const { questions, answers, mode, timeLeft, exam } = session
  const question = questions[currentIndex]

  // Oracle context — update whenever question or exam state changes
  const { setPageContext } = useOracle()
  useEffect(() => {
    setPageContext({
      inExam: true,
      examTitle: exam?.title ?? '',
      examId: exam?.id ?? '',
      mode: mode ?? 'timed',
      currentQuestionNumber: currentIndex + 1,
      totalQuestions: questions.length,
      currentTopic: question?.topic ?? '',
      timeLeftSeconds: timeLeft ?? null,
    })
    return () => setPageContext({})
  }, [currentIndex, mode, timeLeft, exam?.id, question?.topic]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const { hints, setHint } = useHints()
  const { flags, toggleFlag } = useFlags()

  if (session.status === 'idle' || !session.exam) return null

  const chosen = answers[question?.id] ?? null
  const isLast = currentIndex === questions.length - 1
  const isPractice = mode === 'practice'
  const progress = ((currentIndex + 1) / questions.length) * 100
  const isFlagged = flags[question?.id] ?? false
  const flagged = questions.map((q, i) => ({ q, i })).filter(({ q }) => flags[q.id])
  const unanswered = questions.map((q, i) => ({ q, i })).filter(({ q }) => answers[q.id] === undefined)
  const allAnswered = unanswered.length === 0

  const timerPulsing = session.mode === 'timed' && timeLeft !== null && timeLeft < 300

  function handleAnswer(choiceIndex) {
    dispatch({ type: 'ANSWER_QUESTION', questionId: question.id, choiceIndex })
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
    viewNavigate(navigate, '/results/current', { replace: true, state: { result: scored, tab_switches: tabSwitchCount, devtools_detected: devToolsOpen ? 1 : 0 } })

    // Precompute AI analysis in background — Results.jsx reads from this cache key
    if (user) {
      const cacheKey = `ai-analysis-${user.id}-${scored.id}`
      if (!localStorage.getItem(cacheKey)) {
        const examObj = session.exam || {}
        const profile = { province: user.province || '', grade: user.grade || '', display_name: user.display_name || '' }
        buildAnalyzePayload(scored, [], [], examObj.category || '', profile).then(payload =>
          aiAnalyzeResult(payload).then(({ data }) => {
            if (data) safeSetItem(cacheKey, JSON.stringify({ data: { ...data, _source: 'ai' }, ts: Date.now() }))
          })
        )
      }
    }
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

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show" exit="exit"
      className="min-h-screen bg-surface flex flex-col relative overflow-hidden">
      {/* Accent line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 pointer-events-none bg-[var(--primary-border)]" />

      {/* NavBar */}
      <nav
        className="relative z-10 flex items-center justify-between px-6 border-b border-[var(--border)] bg-[var(--bg)]"
        style={{ height: 64 }}
      >
        <div className="flex items-center gap-2">
          <span className="font-sans font-semibold text-foreground text-[15px]">
            Câu {currentIndex + 1}
          </span>
          <span className="font-sans text-dim text-sm">
            / {questions.length}
          </span>
        </div>
        <span className="font-sans text-muted text-sm font-medium truncate max-w-xs hidden sm:block">
          {exam?.title}
        </span>
        <div className="flex items-center gap-3">
          {mode === 'timed' && timeLeft !== null && (
            <div className="relative">
              {/* Breathing ring behind timer */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: -12,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%)',
                  animation: 'breathe 4s ease-in-out infinite',
                  pointerEvents: 'none',
                }}
              />
              <motion.div
                animate={timerPulsing ? { boxShadow: ['0 0 0 0 rgba(194,65,12,0.25)', '0 0 0 8px rgba(194,65,12,0)'] } : {}}
                transition={timerPulsing ? { duration: 1.2, repeat: Infinity } : {}}
                className="rounded-lg relative z-10"
              >
                <Timer timeLeft={timeLeft} totalTime={(session.exam?.duration ?? 0) * 60} />
              </motion.div>
            </div>
          )}
          {/* Focus mode toggle */}
          <button
            onClick={toggleFullscreen}
            title={fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            className="p-2 rounded-lg text-dim hover:text-foreground hover:bg-surface transition"
          >
            {fullscreen
              ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 1H1v4M9 1h4v4M5 13H1V9M9 13h4V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 5V1h4M9 1h4v4M1 9v4h4M13 9v4H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            }
          </button>
        </div>
      </nav>

      {/* Progress bar + mobile timer stripe */}
      <div className="relative z-10">
        <div className="h-1 bg-surface">
          <motion.div
            className="h-full"
            style={{ background: 'var(--primary)' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>
        {/* Mobile-only timer stripe (4px, color changes with urgency) */}
        {mode === 'timed' && timeLeft !== null && (
          <div
            className="h-1 md:hidden transition-colors duration-500"
            style={{
              background: timeLeft < 60 ? 'var(--destructive)' : timeLeft < 300 ? 'var(--accent)' : 'var(--primary)',
              width: `${Math.max(0, (timeLeft / ((session.exam?.duration ?? 45) * 60)) * 100)}%`,
            }}
          />
        )}
      </div>

      {/* Main content — on mobile: scrollable area above sticky nav */}
      <div className="relative z-10 flex-1 max-w-3xl mx-auto w-full px-4 pt-6 pb-0 md:py-10 flex flex-col gap-6 md:gap-8 exam-content overflow-y-auto md:overflow-visible">
        {/* Keyboard hint */}
        <AnimatePresence>
          {showKbHint && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-surface glass-base"
            >
              <span className="font-sans text-[12px] text-dim">
                ⌨ <span className="text-dim">A · B · C · D</span> chọn đáp án &nbsp;·&nbsp;
                <span className="text-dim">← →</span> chuyển câu &nbsp;·&nbsp;
                <span className="text-dim">F</span> đánh dấu
              </span>
              <button onClick={dismissKbHint} className="text-dim hover:text-dim text-base leading-none">×</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab-switch warning banner */}
        {showTabWarning && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-primary/20 glass-base">
            <span className="font-sans text-[12px] text-muted">
              Bạn đã rời khỏi trang <strong className="text-[var(--accent)]">{tabSwitchCount}</strong> lần trong khi làm bài.
            </span>
            <button onClick={() => setShowTabWarning(false)} className="text-dim hover:text-muted text-base leading-none">×</button>
          </div>
        )}

        {/* Question badges */}
        <div className="flex items-center gap-2">
          {question?.topic && (
            <span className="px-2.5 py-1 bg-surface text-primary font-sans text-[11px] font-semibold rounded-md tracking-[0.5px]">
              {TOPIC_LABELS[question.topic] ?? question.topic}
            </span>
          )}
          <div className="relative">
            {diffAura && (
              <motion.div
                className="absolute inset-0 rounded-md pointer-events-none"
                initial={{ opacity: 0.8, scale: 1 }}
                animate={{ opacity: 0, scale: 2.2 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%)' }}
              />
            )}
            <span className="px-2.5 py-1 bg-surface border border-surface text-dim font-sans text-[11px] font-medium rounded-md block">
              {DIFF_LABELS[question?.difficulty] ?? 'Trung bình'}
            </span>
          </div>
          <button
            onClick={() => toggleFlag(question.id)}
            title={isFlagged ? 'Bỏ đánh dấu' : 'Đánh dấu câu này'}
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-md font-sans text-[11px] font-semibold transition"
            style={{
              background: isFlagged ? 'rgba(220,38,38,0.1)' : 'var(--surface)',
              border: `1px solid ${isFlagged ? 'var(--destructive)' : 'var(--border)'}`,
              color: isFlagged ? 'var(--destructive)' : 'var(--fg-secondary)',
            }}
          >
            <svg width="11" height="13" viewBox="0 0 11 13" fill="none">
              <path d="M1 1v11M1 1h7.5l-2 3.5 2 3.5H1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {isFlagged ? 'Đã đánh dấu' : 'Đánh dấu'}
          </button>
        </div>

        {/* Question card with watermark overlay */}
        <AnimatePresence mode="wait">
          {question && (
            <motion.div
              key={question.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative"
            >
              <QuestionCard
                question={user ? { ...question, question: embedWatermark(question.question, user.id) } : question}
                chosen={chosen}
                onAnswer={handleAnswer}
                practiceMode={isPractice}
                submitted={session.status === 'submitted'}
                hintState={hints[question.id]}
                onHint={setHint}
              />
              {/* Canvas watermark — invisible diagonal user identity overlay */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ zIndex: 1 }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nav row — sticky at bottom on mobile, inline on desktop */}
        <div className="flex items-center justify-between sticky bottom-0 md:static z-20 bg-surface md:bg-transparent py-3 md:py-0 -mx-4 md:mx-0 px-4 md:px-0 border-t border-surface md:border-none">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="flex items-center gap-1.5 px-4 py-3 md:py-2.5 bg-surface border border-surface rounded-[10px] font-sans text-[13px] text-muted font-medium disabled:opacity-40 hover:bg-surface transition"
            >
              ← Câu trước
            </button>
            {isPractice && <FormulaDrawer />}
          </div>
          <div className="flex items-center gap-2.5">
            {!isLast && (
              <button
                onClick={handleNext}
                disabled={isPractice && !canProceed}
                className="flex items-center gap-1.5 px-5 py-3 md:py-2.5 bg-surface rounded-[10px] font-sans text-[13px] text-foreground font-semibold disabled:opacity-40 hover:bg-surface-elevated transition"
              >
                Tiếp theo →
              </button>
            )}
            {(isLast || !isPractice) && (
              <button
                onClick={handleSubmit}
                className="flex items-center gap-1.5 px-5 py-3 md:py-2.5 rounded-[10px] font-sans text-[13px] text-background font-bold hover:opacity-90 transition"
                style={{ background: 'var(--primary)' }}
              >
                Nộp bài
              </button>
            )}
          </div>
        </div>

        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          {questions.map((q, i) => {
            const answered = answers[q.id] !== undefined
            const isQFlagged = flags[q.id]
            const isCurrent = i === currentIndex
            let bg = 'var(--border)'
            if (isCurrent) bg = 'var(--accent)'
            else if (isQFlagged) bg = 'var(--destructive)'
            else if (answered) bg = 'var(--success)'
            return (
              <button
                key={i}
                onClick={() => jumpTo(i)}
                className="rounded-[2px] h-1 transition-all"
                style={{ width: isCurrent ? 24 : 8, background: bg }}
              />
            )
          })}
        </div>
      </div>

      {/* DevTools warning overlay */}
      {devToolsOpen && session.status === 'active' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 pointer-events-none">
          <div className="px-6 py-4 rounded-xl border border-primary/20 glass-base pointer-events-auto">
            <p className="font-sans text-[13px] text-[var(--accent)] text-center">
              Vui lòng đóng DevTools để tiếp tục làm bài.
            </p>
          </div>
        </div>
      )}

      {/* Pause overlay */}
      <AnimatePresence>
        {pauseOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          >
            <div className="flex flex-col items-center gap-6 text-center">
              <span className="font-sans text-[22px] font-bold text-foreground">Bài thi đã tạm dừng</span>
              <p className="font-sans text-[14px] text-dim">Bạn đã rời khỏi tab — bộ đếm giờ đã dừng.</p>
              <button
                onClick={resumeFromPause}
                className="px-8 py-3 rounded-xl font-sans text-[14px] font-bold text-background hover:opacity-90 transition bg-primary"
              >
                Tiếp tục thi
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit confirmation modal */}
      {submitModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl border border-surface p-6 flex flex-col gap-5"
            style={{ background: 'var(--surface-elevated)' }}
          >
            <div className="flex flex-col gap-1">
              {allAnswered ? (
                <>
                  <span className="font-sans text-foreground text-[18px] font-semibold">Nộp bài?</span>
                  <span className="font-sans text-dim text-[13px]">
                    Bạn đã trả lời đủ {questions.length}/{questions.length} câu.
                  </span>
                </>
              ) : (
                <>
                  <span className="font-sans text-foreground text-[18px] font-semibold">Còn câu chưa trả lời</span>
                  <span className="font-sans text-muted text-[13px]">
                    Bạn còn{' '}
                    <span className="text-primary font-bold">{unanswered.length} câu</span>
                    {' '}chưa trả lời. Nhấn vào ô để quay lại, hoặc vẫn nộp bài.
                  </span>
                </>
              )}
            </div>

            {!allAnswered && (
              <div className="flex flex-wrap gap-2">
                {unanswered.map(({ q, i }) => (
                  <button
                    key={q.id}
                    onClick={() => { jumpTo(i); setSubmitModal(false) }}
                    className="w-8 h-8 rounded-lg font-sans text-[12px] font-bold border border-primary/20 text-primary hover:bg-primary/10 transition"
                    style={{ background: 'var(--primary-subtle)' }}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}

            {flagged.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="font-sans text-destructive text-[12px] font-semibold flex items-center gap-1.5">
                  <svg width="10" height="12" viewBox="0 0 11 13" fill="none">
                    <path d="M1 1v11M1 1h7.5l-2 3.5 2 3.5H1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {flagged.length} câu đã đánh dấu — nhấn để xem lại
                </span>
                <div className="flex flex-wrap gap-2">
                  {flagged.map(({ q, i }) => (
                    <button
                      key={q.id}
                      onClick={() => { jumpTo(i); setSubmitModal(false) }}
                      className="w-8 h-8 rounded-lg font-sans text-[12px] font-bold transition hover:opacity-80"
                      style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid var(--destructive)', color: 'var(--destructive)' }}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mt-1">
              <button
                onClick={() => setSubmitModal(false)}
                className="flex-1 py-2.5 rounded-[10px] font-sans text-[13px] font-semibold text-muted bg-surface border border-surface hover:bg-surface transition"
              >
                Làm tiếp
              </button>
              <button
                onClick={confirmSubmit}
                className="flex-1 py-2.5 rounded-[10px] font-sans text-[13px] font-bold text-background hover:opacity-90 transition"
                style={{ background: 'var(--primary)' }}
              >
                Nộp bài
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Practice mode back guard modal */}
      {showBackModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="w-full max-w-sm bg-surface-elevated rounded-2xl p-6 flex flex-col gap-4 mb-4 sm:mb-0"
          >
            <div className="flex flex-col gap-1">
              <p className="font-sans text-[15px] font-semibold text-foreground">Thoát bài luyện tập?</p>
              <p className="font-sans text-[13px] text-muted">Câu trả lời đã chọn vẫn được lưu. Bạn có thể tiếp tục sau.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowBackModal(false)}
                className="flex-1 py-2.5 rounded-xl font-sans text-[13px] font-semibold text-foreground bg-surface border border-border hover:bg-border/50 transition"
              >
                Làm tiếp
              </button>
              <button
                onClick={() => {
                  setShowBackModal(false)
                  sessionStorage.removeItem(`exam-draft-${examId}`)
                  dispatch({ type: 'RESET' })
                  navigate('/exams', { replace: true })
                }}
                className="flex-1 py-2.5 rounded-xl font-sans text-[13px] font-semibold text-muted bg-surface border border-border hover:text-foreground transition"
              >
                Lưu nháp và thoát
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}
