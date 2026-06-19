import { useState, useEffect, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getHint } from '../api/aiClient.js'
import ReportButton from './ReportButton.jsx'
import { loadPreferences } from '../utils/aiPreferences.js'
import { sanitizeSvg } from '../utils/sanitizeSvg.js'
import { MathText } from './MathText.jsx'
import { useOracle } from '../context/OracleContext.jsx'

const LABELS = ['A', 'B', 'C', 'D']
const MAX_HINTS = 3

function getAIRatings() {
  try { return JSON.parse(localStorage.getItem('ai_ratings') ?? '{}') }
  catch { return {} }
}

function AIRating({ questionId, hintIndex }) {
  const key = `${questionId}_h${hintIndex}`
  const [rating, setRating] = useState(() => getAIRatings()[key] ?? null)

  function rate(val) {
    const ratings = getAIRatings()
    ratings[key] = val
    localStorage.setItem('ai_ratings', JSON.stringify(ratings))
    setRating(val)
  }

  return (
    <div className="flex items-center gap-1">
      <span className="font-sans text-[0.625rem] text-[var(--faint)] mr-1">Hữu ích?</span>
      {['👍', '👎'].map((emoji, i) => {
        const val = i === 0 ? 'up' : 'down'
        return (
          <button
            key={val}
            onClick={() => rate(val)}
            className="text-sm transition-opacity"
            style={{ opacity: rating === null ? 0.5 : rating === val ? 1 : 0.25 }}
          >
            {emoji}
          </button>
        )
      })}
    </div>
  )
}

// Returns CSS variable strings — resolved by the active theme at render time
function choiceStyle(index, chosen, aiCorrect, showFeedback) {
  if (!showFeedback) {
    if (chosen === index) return {
      bg: 'var(--choice-chosen-bg)',
      border: 'var(--accent)',
      bw: '1.5px',
      labelBg: 'var(--accent)',
      labelText: 'var(--accent-fg)',
      text: 'var(--accent)',
    }
    return {
      bg: 'var(--surface)',
      border: 'var(--border)',
      bw: '1px',
      labelBg: 'var(--border)',
      labelText: 'var(--fg-secondary)',
      text: 'var(--fg-secondary)',
    }
  }
  // Answered but AI still loading — keep chosen highlighted, others neutral
  if (aiCorrect === null) {
    if (chosen === index) return {
      bg: 'var(--choice-chosen-bg)',
      border: 'var(--accent)',
      bw: '1.5px',
      labelBg: 'var(--accent)',
      labelText: 'var(--accent-fg)',
      text: 'var(--accent)',
    }
    return {
      bg: 'var(--surface)',
      border: 'var(--border)',
      bw: '1px',
      labelBg: 'var(--border)',
      labelText: 'var(--fg-tertiary)',
      text: 'var(--fg-tertiary)',
    }
  }
  // AI responded — show correct/wrong
  if (index === aiCorrect) return {
    bg: 'var(--primary-subtle)',
    border: 'var(--success)',
    bw: '1.5px',
    labelBg: 'var(--success)',
    labelText: 'var(--primary-fg)',
    text: 'var(--success)',
  }
  if (index === chosen) return {
    bg: 'var(--choice-wrong-bg)',
    border: 'var(--destructive)',
    bw: '1.5px',
    labelBg: 'var(--destructive)',
    labelText: '#FFFFFF',
    text: 'var(--destructive)',
  }
  return {
    bg: 'var(--surface)',
    border: 'var(--border)',
    bw: '1px',
    labelBg: 'var(--border)',
    labelText: 'var(--fg-tertiary)',
    text: 'var(--fg-tertiary)',
  }
}


function QuestionCard({ question, chosen, onAnswer, practiceMode, submitted, hintState, onHint, wrongStreak = 0 }) {
  const navigate = useNavigate()
  const { open: openOracle, setPageContext: setOracleContext } = useOracle()
  const showFeedback = practiceMode && chosen !== null && chosen !== undefined
  const [hintLoading, setHintLoading] = useState(false)
  const [hintError, setHintError] = useState(null)
  const [showExplanation, setShowExplanation] = useState(false)

  const hintCount = hintState?.count ?? 0
  const hintTexts = hintState?.texts ?? []

  // Level 0: correct answer is known from static data — no AI needed
  const correctIndex = question.correct
  const isCorrect = chosen !== null && chosen !== undefined && chosen === correctIndex

  useEffect(() => {
    setHintError(null)
    setHintLoading(false)
    setShowExplanation(false)
  }, [question.id])

  async function handleGetHint() {
    if (hintLoading || hintCount >= MAX_HINTS) return
    const nextCount = hintCount + 1
    setHintLoading(true)
    setHintError(null)
    const { data, error, status } = await getHint({
      question,
      attempt_count: nextCount,
      previous_hints: hintTexts,
    })
    setHintLoading(false)
    if (data) {
      onHint(question.id, nextCount, data.hint)
    } else if (status === 401) {
      setHintError('Đăng nhập để sử dụng gợi ý AI')
    } else if (status === 402 && typeof error === 'object' && error.code === 'insufficient_credits') {
      setHintError('Hết lượt hỏi AI. Nạp thêm trong Tài khoản.')
    } else if (status === 429) {
      setHintError('Vui lòng chờ trước khi yêu cầu gợi ý tiếp theo')
    } else {
      setHintError(typeof error === 'string' ? error : 'Không thể tải gợi ý')
    }
  }

  return (
    <div>
      {question.figure?.data && (
        <div
          className="mb-4 rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface)] flex justify-center p-3"
          dangerouslySetInnerHTML={{ __html: sanitizeSvg(question.figure.data) }}
        />
      )}

      {question.image && (
        <div className="mb-4 rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface)] flex justify-center p-3">
          <img
            src={question.image}
            alt=""
            className="max-h-64 w-auto object-contain"
          />
        </div>
      )}

      {!question.image && question.imageLink && (
        <a
          href={question.imageLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] font-sans text-[0.8125rem] text-[var(--info)] hover:border-[var(--info)] hover:bg-[var(--surface-elevated)] transition w-fit"
        >
          <span>🖼</span>
          <span>Xem hình minh họa (nguồn chính thức) →</span>
        </a>
      )}

      <MathText className="font-sans font-semibold text-[20px] text-[var(--foreground)] leading-relaxed mb-5 whitespace-pre-wrap">
        {question.question}
      </MathText>
      <div className="flex flex-col gap-2.5">
        {question.choices.map((choice, i) => {
          const s = choiceStyle(i, chosen, showFeedback ? correctIndex : null, showFeedback)
          const isChosen = i === chosen
          const feedbackClass = showFeedback
            ? i === correctIndex ? 'z-choice-correct'
            : (isChosen && i !== correctIndex) ? 'z-choice-wrong'
            : ''
            : ''
          return (
            <motion.button
              key={i}
              className={`w-full text-left flex items-center gap-3.5 px-[18px] py-3.5 rounded-xl transition-all ${feedbackClass}`}
              style={{ background: s.bg, border: `${s.bw} solid ${s.border}` }}
              onClick={() => !showFeedback && !submitted && onAnswer(i)}
              disabled={showFeedback || submitted}
              whileHover={!showFeedback && !submitted ? { scale: 1.01 } : {}}
              whileTap={!showFeedback && !submitted ? { scale: 0.98 } : {}}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <span
                className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md font-sans text-[0.8125rem] font-bold"
                style={{ background: s.labelBg, color: s.labelText }}
              >
                {LABELS[i]}
              </span>
              <MathText className="font-sans text-[15px] font-medium" style={{ color: s.text }}>
                {choice}
              </MathText>
            </motion.button>
          )
        })}
      </div>

      {showFeedback && (
        <div
          className="mt-5 flex items-start gap-3 p-3.5 rounded-xl"
          style={{
            border: `1px solid ${isCorrect ? 'var(--primary-border)' : 'var(--choice-wrong-border)'}`,
            background: isCorrect ? 'var(--primary-subtle)' : 'var(--choice-wrong-bg)',
          }}
        >
          <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--success)' }}>
            {isCorrect ? (
              <svg className="z-checkmark w-5 h-5" viewBox="0 0 20 20" fill="none">
                <path d="M4 10l4.5 4.5L16 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <span className="text-base leading-none text-[var(--destructive)]">✗</span>
            )}
          </span>
          <div className="flex-1 min-w-0">
            {!isCorrect && (
              <p className="font-sans text-xs font-semibold text-[var(--destructive)] mb-1">
                Đáp án đúng: {LABELS[correctIndex] ?? '?'}
              </p>
            )}
            {isCorrect && (
              <p className="font-sans text-[0.8125rem] text-[var(--success)]">Đúng rồi.</p>
            )}
          </div>
        </div>
      )}

      <ReportButton questionId={question.id} topic={question.topic} />

      {/* Post-wrong routing — try a similar question right now */}
      {practiceMode && !submitted && showFeedback && !isCorrect && question.topic && (
        <div className="mt-3 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border bg-surface-elevated">
          <p className="font-sans text-[0.75rem] text-muted">Thử một câu tương tự để luyện thêm?</p>
          <button
            onClick={() => navigate(`/practice?topic=${encodeURIComponent(question.topic)}`)}
            className="font-sans text-[0.75rem] font-semibold text-primary hover:underline whitespace-nowrap flex-shrink-0"
          >
            Luyện ngay →
          </button>
        </div>
      )}

      {/* Struggle support — shown after 2 consecutive wrong across questions */}
      {practiceMode && !submitted && showFeedback && !isCorrect && wrongStreak >= 2 && (
        <div className="mt-3 px-4 py-3 rounded-xl glass-base border-info/20">
          <p className="font-sans text-xs text-[var(--info)] leading-relaxed" style={{ opacity: 0.8 }}>
            Bài này khó với nhiều học sinh. Xem giải thích hoặc hỏi Oracle để hiểu rõ hơn.
          </p>
        </div>
      )}

      {/* Level 1 — static explanation (after wrong answer, user-requested) */}
      {practiceMode && !submitted && showFeedback && !isCorrect && (
        <div className="mt-3 flex flex-col gap-2">
          <button
            onClick={() => setShowExplanation(v => !v)}
            className="self-start flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] font-sans text-xs text-[var(--muted-fg)] hover:text-[var(--foreground)] hover:border-[var(--primary-border)] transition"
          >
            <span>📖</span>
            {showExplanation ? 'Ẩn giải thích' : 'Xem giải thích'}
          </button>
          {showExplanation && question.explanation && (
            <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]">
              <MathText className="font-sans text-[0.8125rem] text-[var(--muted-fg)] leading-relaxed">
                {question.explanation}
              </MathText>
            </div>
          )}
        </div>
      )}

      {/* Level 2 — Haiku hints (only after explanation viewed AND answer was wrong) */}
      {practiceMode && !submitted && showFeedback && !isCorrect && showExplanation && (
        <div className="mt-2 flex flex-col gap-2">
          {hintCount < MAX_HINTS && (
            <button
              onClick={handleGetHint}
              disabled={hintLoading}
              className="self-start flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] font-sans text-xs text-[var(--muted-fg)] hover:text-[var(--foreground)] hover:border-[var(--primary-border)] transition disabled:opacity-50"
            >
              {hintLoading ? (
                <span className="inline-block w-3 h-3 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="text-[var(--primary)]">💡</span>
              )}
              Gợi ý ({hintCount}/{MAX_HINTS})
              <span className="text-[var(--faint)] text-[0.625rem]">⚡ 1 lượt</span>
            </button>
          )}
          {hintError && (
            <p className="font-sans text-xs text-[var(--destructive)]">{hintError}</p>
          )}
          {hintTexts.map((text, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] flex flex-col gap-2">
              <MathText className="font-sans text-[0.8125rem] text-[var(--muted-fg)] leading-relaxed">{text}</MathText>
              <div className="flex items-center justify-between">
                <span className="font-sans text-[0.6875rem] text-[var(--faint)]">Gợi ý {i + 1}/{MAX_HINTS}</span>
                <AIRating questionId={question.id} hintIndex={i} />
              </div>
            </motion.div>
          ))}

          {/* Level 3 — Oracle in-context (after 2+ hints, or immediately when wrongStreak ≥ 2) */}
          {(hintCount >= 2 || wrongStreak >= 2) && (
            <button
              onClick={() => { setOracleContext({ currentQuestion: question, inExam: true }); openOracle() }}
              className="self-start flex items-center gap-2 px-4 py-2 rounded-lg border border-info/30 bg-info/5 font-sans text-xs font-semibold text-[var(--info)] hover:bg-[var(--surface)] transition"
            >
              <span className="text-[0.625rem]">✦</span> Vẫn chưa hiểu — Hỏi Zenith AI
            </button>
          )}
        </div>
      )}

      {/* Hint button before answering (unchanged — pre-answer hint still available) */}
      {practiceMode && !submitted && !showFeedback && (
        <div className="mt-4 flex flex-col gap-2">
          {hintCount < MAX_HINTS ? (
            <button
              onClick={handleGetHint}
              disabled={hintLoading}
              className="self-start flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] font-sans text-xs text-[var(--muted-fg)] hover:text-[var(--foreground)] hover:border-[var(--primary-border)] transition disabled:opacity-50"
            >
              {hintLoading ? (
                <span className="inline-block w-3 h-3 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="text-[var(--primary)]">💡</span>
              )}
              Gợi ý ({hintCount}/{MAX_HINTS})
              <span className="text-[var(--faint)] text-[0.625rem]">⚡ 1 lượt</span>
            </button>
          ) : null}
          {hintError && (
            <p className="font-sans text-xs text-[var(--destructive)]">{hintError}</p>
          )}
          {hintTexts.map((text, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] flex flex-col gap-2">
              <MathText className="font-sans text-[0.8125rem] text-[var(--muted-fg)] leading-relaxed">{text}</MathText>
              <div className="flex items-center justify-between">
                <span className="font-sans text-[0.6875rem] text-[var(--faint)]">Gợi ý {i + 1}/{MAX_HINTS}</span>
                <AIRating questionId={question.id} hintIndex={i} />
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

export default memo(QuestionCard, (prev, next) =>
  prev.question.id === next.question.id &&
  prev.chosen === next.chosen &&
  prev.practiceMode === next.practiceMode &&
  prev.submitted === next.submitted &&
  prev.hintState === next.hintState
)
