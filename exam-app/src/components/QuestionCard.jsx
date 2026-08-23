import { useState, useEffect, memo } from 'react'
import { motion } from 'framer-motion'
import { sanitizeSvg } from '../utils/sanitizeSvg.js'
import { MathText } from './MathText.jsx'

const LABELS = ['A', 'B', 'C', 'D']

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


function QuestionCard({ question, chosen, onAnswer, practiceMode, submitted, wrongStreak = 0 }) {
  const showFeedback = practiceMode && chosen !== null && chosen !== undefined
  const [showExplanation, setShowExplanation] = useState(false)

  // Correct answer is known from static data
  const correctIndex = question.correct
  const isCorrect = chosen !== null && chosen !== undefined && chosen === correctIndex

  useEffect(() => {
    setShowExplanation(false)
  }, [question.id])

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

      {/* Struggle support — shown after 2 consecutive wrong across questions */}
      {practiceMode && !submitted && showFeedback && !isCorrect && wrongStreak >= 2 && (
        <div className="mt-3 px-4 py-3 rounded-xl glass-base border-info/20">
          <p className="font-sans text-xs text-[var(--info)] leading-relaxed" style={{ opacity: 0.8 }}>
            Bài này khó với nhiều học sinh. Xem giải thích bên dưới.
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

    </div>
  )
}

export default memo(QuestionCard, (prev, next) =>
  prev.question.id === next.question.id &&
  prev.chosen === next.chosen &&
  prev.practiceMode === next.practiceMode &&
  prev.submitted === next.submitted
)
