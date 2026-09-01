import { useState, useEffect, memo } from 'react'
import { sanitizeSvg } from '../utils/sanitizeSvg.js'
import { MathText } from './MathText.jsx'
import { ReportIssueButton } from './ReportIssueButton.jsx'
import { track } from '../lib/eventTrack.js'
import { loadStepSolution } from '../api/index.js'

const LABELS = ['A', 'B', 'C', 'D']

function BookIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5.5C4 4.7 4.7 4 5.5 4H12v16H5.5C4.7 20 4 19.3 4 18.5z" />
      <path d="M20 5.5C20 4.7 19.3 4 18.5 4H12v16h6.5c.8 0 1.5-.7 1.5-1.5z" />
    </svg>
  )
}

function CompassIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9l-4 6-2-2z" />
    </svg>
  )
}

// Returns CSS variable strings — resolved by the active theme at render time
function choiceStyle(index, chosen, aiCorrect, showFeedback) {
  if (!showFeedback) {
    if (chosen === index) return {
      bg: 'var(--paper-2)', border: 'var(--ink)', bw: '2px',
      labelBg: 'var(--ink)', labelText: 'var(--paper)', text: 'var(--ink)',
    }
    return {
      bg: 'var(--paper)', border: 'var(--line)', bw: '1px',
      labelBg: 'var(--paper-2)', labelText: 'var(--ink-2)', text: 'var(--ink)',
    }
  }
  if (aiCorrect === null) {
    if (chosen === index) return {
      bg: 'var(--paper-2)', border: 'var(--ink)', bw: '2px',
      labelBg: 'var(--ink)', labelText: 'var(--paper)', text: 'var(--ink)',
    }
    return {
      bg: 'var(--paper)', border: 'var(--line)', bw: '1px',
      labelBg: 'var(--paper-2)', labelText: 'var(--ink-3)', text: 'var(--ink-2)',
    }
  }
  if (index === aiCorrect) return {
    bg: 'color-mix(in srgb, var(--pine) 12%, var(--paper))', border: 'var(--pine)', bw: '2px',
    labelBg: 'var(--pine)', labelText: 'var(--paper)', text: 'var(--pine)',
  }
  if (index === chosen) return {
    bg: 'color-mix(in srgb, var(--accent) 10%, var(--paper))', border: 'var(--accent)', bw: '2px',
    labelBg: 'var(--accent)', labelText: 'var(--accent-fg)', text: 'var(--accent-deep)',
  }
  return {
    bg: 'var(--paper)', border: 'var(--line)', bw: '1px',
    labelBg: 'var(--paper-2)', labelText: 'var(--ink-3)', text: 'var(--ink-2)',
  }
}


function QuestionCard({ question, chosen, onAnswer, practiceMode, submitted, wrongStreak = 0 }) {
  const showFeedback = practiceMode && chosen !== null && chosen !== undefined
  const [showExplanation, setShowExplanation] = useState(false)
  const [stepsOpen, setStepsOpen] = useState(false)
  const [stepFetch, setStepFetch] = useState({ status: 'idle', result: null }) // 'idle'|'loading'|'done'

  // Correct answer is known from static data
  const correctIndex = question.correct
  const isCorrect = chosen !== null && chosen !== undefined && chosen === correctIndex

  useEffect(() => {
    setShowExplanation(false)
    setStepsOpen(false)
    setStepFetch({ status: 'idle', result: null })
  }, [question.id])

  const handleToggleSteps = async () => {
    const next = !stepsOpen
    setStepsOpen(next)
    if (next && stepFetch.status === 'idle') {
      setStepFetch({ status: 'loading', result: null })
      const result = await loadStepSolution(question.id)
      setStepFetch({ status: 'done', result })
    }
  }

  return (
    <div>
      {question.figure?.data && (
        <div
          className="mb-4 overflow-hidden flex justify-center p-3"
          style={{ border: '1px solid var(--line)', background: 'var(--paper)', borderRadius: 'var(--r-sm)' }}
          dangerouslySetInnerHTML={{ __html: sanitizeSvg(question.figure.data) }}
        />
      )}

      {question.image && (
        <div className="mb-4 overflow-hidden flex justify-center p-3" style={{ border: '1px solid var(--line)', background: 'var(--paper)', borderRadius: 'var(--r-sm)' }}>
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
          className="mb-4 flex items-center gap-2 px-4 py-2.5 w-fit transition"
          style={{ border: '1px solid var(--line)', background: 'var(--paper)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--altitude)' }}
        >
          XEM BẢN VẼ GỐC TRẮC ĐỊA →
        </a>
      )}

      <MathText className="mb-5 whitespace-pre-wrap block" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18.5, lineHeight: 1.75, color: 'var(--ink)' }}>
        {question.question}
      </MathText>
      <div className="flex flex-col gap-2.5">
        {question.choices.map((choice, i) => {
          const s = choiceStyle(i, chosen, showFeedback ? correctIndex : null, showFeedback)
          return (
            <button
              key={i}
              className="w-full text-left flex items-stretch gap-0 overflow-hidden transition-colors duration-150"
              style={{ border: `${s.bw} solid ${s.border}`, background: s.bg, borderRadius: '6px' }}
              onClick={() => !showFeedback && !submitted && onAnswer(i)}
              disabled={showFeedback || submitted}
              onMouseEnter={(e) => { if (!showFeedback && !submitted && chosen !== i) e.currentTarget.style.background = 'var(--paper-2)' }}
              onMouseLeave={(e) => { if (!showFeedback && !submitted && chosen !== i) e.currentTarget.style.background = s.bg }}
            >
              <span
                className="flex-shrink-0 flex items-center justify-center font-bold"
                style={{ width: 44, background: s.labelBg, color: s.labelText, fontFamily: 'var(--font-mono)', fontSize: 14 }}
              >
                {LABELS[i]}
              </span>
              <span className="flex items-center px-4 py-3.5">
                <MathText style={{ fontFamily: 'var(--font-body)', fontSize: 15.5, color: s.text }}>
                  {choice}
                </MathText>
              </span>
            </button>
          )
        })}
      </div>

      {showFeedback && (
        <div
          className="mt-5 flex items-start gap-3 p-3.5"
          style={{
            border: `1px solid ${isCorrect ? 'var(--pine)' : 'var(--accent)'}`,
            background: isCorrect ? 'color-mix(in srgb, var(--pine) 8%, var(--paper))' : 'color-mix(in srgb, var(--accent) 7%, var(--paper))',
            borderRadius: 'var(--r-sm)',
          }}
        >
          <div className="flex-1 min-w-0">
            {isCorrect ? (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 600, color: 'var(--pine)', letterSpacing: '0.03em' }}>
                ✓ ĐẠT MỐC CHUẨN XÁC
              </p>
            ) : (
              <>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 600, color: 'var(--accent-deep)', letterSpacing: '0.03em' }}>
                  ✕ TRẠM VẤP — CẦN ĐỐI CHIẾU
                </p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>
                  Đáp án đúng: {LABELS[correctIndex] ?? '?'}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Struggle support — shown after 2 consecutive wrong across questions */}
      {practiceMode && !submitted && showFeedback && !isCorrect && wrongStreak >= 2 && (
        <div className="mt-3 px-4 py-3" style={{ border: '1px solid var(--line)', background: 'var(--paper-2)', borderRadius: 'var(--r-sm)' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--altitude)', lineHeight: 1.6 }}>
            Bài này khó với nhiều học sinh. Xem giải thích bên dưới.
          </p>
        </div>
      )}

      {/* Level 1 — static explanation (after wrong answer, user-requested) */}
      {practiceMode && !submitted && showFeedback && !isCorrect && (
        <div className="mt-3 flex flex-col gap-2">
          <button
            onClick={() => {
              const next = !showExplanation
              setShowExplanation(next)
              if (next) track('explanation_opened', { questionId: question.id })
            }}
            className="self-start flex items-center gap-2 px-3.5 py-2 transition"
            style={{ border: '1px solid var(--line)', background: 'var(--paper-2)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-2)' }}
          >
            <BookIcon />
            {showExplanation ? 'Ẩn giải thích' : 'Xem giải thích'}
          </button>
          {showExplanation && question.explanation && (
            <div className="p-3.5" style={{ border: '1px solid var(--line)', background: 'var(--paper-2)', borderRadius: 'var(--r-sm)' }}>
              <MathText style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                {question.explanation}
              </MathText>
            </div>
          )}
        </div>
      )}

      {/* Step-by-step CAS solution — sympy-verified, AI-narrated captions only */}
      {practiceMode && (
        <div className="mt-3 flex flex-col gap-2">
          <button
            onClick={handleToggleSteps}
            className="self-start flex items-center gap-2 px-3.5 py-2 transition"
            style={{ border: '1px solid var(--line)', background: 'var(--paper-2)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-2)' }}
          >
            <CompassIcon />
            {stepsOpen ? 'Ẩn NHỊP LEO — SOI TỪNG BƯỚC' : 'NHỊP LEO — SOI TỪNG BƯỚC'}
          </button>
          {stepsOpen && stepFetch.status === 'loading' && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)' }}>Đang tạo lời giải…</p>
          )}
          {stepsOpen && stepFetch.status === 'done' && !stepFetch.result?.available && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)' }}>Câu này chưa có lời giải từng bước.</p>
          )}
          {stepsOpen && stepFetch.status === 'done' && stepFetch.result?.available && (
            <div className="flex flex-col gap-2">
              {stepFetch.result.steps.map((step, i) => (
                <div key={i} className="p-3.5 flex flex-col gap-1.5" style={{ border: '1px solid var(--line)', background: 'var(--paper-2)', borderRadius: 'var(--r-sm)' }}>
                  <MathText style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink)' }}>
                    {`$${step.before}$ $\\Rightarrow$ $${step.after}$`}
                  </MathText>
                  {step.caption && (
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontStyle: 'italic', color: 'var(--ink-3)' }}>{step.caption}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-3">
        <ReportIssueButton questionId={question.id} />
      </div>

    </div>
  )
}

export default memo(QuestionCard, (prev, next) =>
  prev.question.id === next.question.id &&
  prev.chosen === next.chosen &&
  prev.practiceMode === next.practiceMode &&
  prev.submitted === next.submitted
)
