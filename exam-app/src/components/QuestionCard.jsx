import { useState, useEffect, useRef } from 'react'
import { getHint, getExplanation } from '../api/aiClient.js'

const LABELS = ['A', 'B', 'C', 'D']
const MAX_HINTS = 3

// aiCorrect is null while loading (answered but AI not yet responded)
function choiceStyle(index, chosen, aiCorrect, showFeedback) {
  if (!showFeedback) {
    if (chosen === index) return { bg: '#111827', border: '#F2A20C', bw: '1.5px', labelBg: '#F2A20C', labelText: '#0A0E1A', text: '#F0B429' }
    return { bg: '#0D1221', border: '#1E2A44', bw: '1px', labelBg: '#1E2A44', labelText: '#94A3B8', text: '#94A3B8' }
  }
  // Answered but AI still loading — keep chosen highlighted amber, others neutral
  if (aiCorrect === null) {
    if (chosen === index) return { bg: '#111827', border: '#F2A20C', bw: '1.5px', labelBg: '#F2A20C', labelText: '#0A0E1A', text: '#F0B429' }
    return { bg: '#0D1221', border: '#1E2A44', bw: '1px', labelBg: '#1E2A44', labelText: '#475569', text: '#475569' }
  }
  // AI responded — show correct/wrong
  if (index === aiCorrect) return { bg: '#0A1F14', border: '#10B981', bw: '1.5px', labelBg: '#10B981', labelText: '#0A0E1A', text: '#6EE7B7' }
  if (index === chosen) return { bg: '#1F0A0E', border: '#FB7185', bw: '1.5px', labelBg: '#FB7185', labelText: '#0A0E1A', text: '#FB7185' }
  return { bg: '#0D1221', border: '#1E2A44', bw: '1px', labelBg: '#1E2A44', labelText: '#475569', text: '#475569' }
}

export default function QuestionCard({ question, chosen, onAnswer, practiceMode, submitted, hintState, onHint }) {
  const showFeedback = practiceMode && chosen !== null && chosen !== undefined
  const [hintLoading, setHintLoading] = useState(false)
  const [hintError, setHintError] = useState(null)
  const [showExplanation, setShowExplanation] = useState(false)

  const hintCount = hintState?.count ?? 0
  const hintTexts = hintState?.texts ?? []

  // null = not yet fetched / loading; { correct_index, explanation } = done
  const [aiResult, setAiResult] = useState(null)
  const fetchedForRef = useRef(null)

  useEffect(() => {
    setHintError(null)
    setHintLoading(false)
    setAiResult(null)
    fetchedForRef.current = null
  }, [question.id])

  useEffect(() => {
    if (!showFeedback) return
    const cacheKey = `${question.id}-${chosen}`
    if (fetchedForRef.current === cacheKey) return
    fetchedForRef.current = cacheKey
    getExplanation({ question, chosen_index: chosen }).then(({ data }) => {
      if (data) setAiResult({ correct_index: data.correct_index, explanation: data.explanation })
    })
  }, [showFeedback, question.id, chosen])

  async function handleGetHint() {
    if (hintLoading || hintCount >= MAX_HINTS) return
    const nextCount = hintCount + 1
    setHintLoading(true)
    setHintError(null)
    const { data, error } = await getHint({
      question,
      attempt_count: nextCount,
      previous_hints: hintTexts,
    })
    setHintLoading(false)
    if (data) {
      onHint(question.id, nextCount, data.hint)
    } else {
      setHintError(error || 'Không thể tải gợi ý')
    }
  }

  const aiCorrect = aiResult?.correct_index ?? null
  const isCorrect = aiResult !== null && chosen === aiCorrect

  return (
    <div>
      <p className="font-fraunces text-[20px] text-[#F0F4FF] leading-relaxed mb-5 whitespace-pre-wrap">
        {question.question}
      </p>
      <div className="flex flex-col gap-2.5">
        {question.choices.map((choice, i) => {
          const s = choiceStyle(i, chosen, aiCorrect, showFeedback)
          return (
            <button
              key={i}
              className="w-full text-left flex items-center gap-3.5 px-[18px] py-3.5 rounded-xl transition-all"
              style={{ background: s.bg, border: `${s.bw} solid ${s.border}` }}
              onClick={() => !showFeedback && !submitted && onAnswer(i)}
              disabled={showFeedback || submitted}
            >
              <span
                className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md font-fraunces text-[13px] font-bold"
                style={{ background: s.labelBg, color: s.labelText }}
              >
                {LABELS[i]}
              </span>
              <span className="font-jakarta text-[15px] font-medium" style={{ color: s.text }}>
                {choice}
              </span>
            </button>
          )
        })}
      </div>

      {showFeedback && (
        <div
          className="mt-5 flex items-start gap-3 p-3.5 rounded-xl transition-all"
          style={{
            border: `1px solid ${aiResult === null ? '#2A3A60' : isCorrect ? '#1A4A2A' : '#4A1A24'}`,
            background: aiResult === null ? '#111827' : isCorrect ? '#0A1F14' : '#1F0A0E',
          }}
        >
          {aiResult === null ? (
            <>
              <span className="inline-block w-3 h-3 border border-[#94A3B8] border-t-transparent rounded-full animate-spin flex-shrink-0 mt-0.5" />
              <span className="font-jakarta text-[12px] text-[#475569]">AI đang phân tích đáp án...</span>
            </>
          ) : (
            <>
              <span
                className="text-base leading-none mt-0.5 flex-shrink-0"
                style={{ color: isCorrect ? '#10B981' : '#FB7185' }}
              >
                {isCorrect ? '✓' : '✗'}
              </span>
              <div className="flex-1 min-w-0">
                {!isCorrect && (
                  <p className="font-jakarta text-[12px] font-semibold text-[#FB7185] mb-1">
                    Đáp án đúng: {LABELS[aiCorrect] ?? '?'}
                  </p>
                )}
                <p
                  className="font-jakarta text-[13px] leading-relaxed"
                  style={{ color: isCorrect ? '#6EE7B7' : '#FCA5A5' }}
                >
                  {aiResult.explanation}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Hint button — practice mode only, before answer is chosen */}
      {practiceMode && !submitted && !showFeedback && (
        <div className="mt-4 flex flex-col gap-2">
          {hintCount < MAX_HINTS ? (
            <button
              onClick={handleGetHint}
              disabled={hintLoading}
              className="self-start flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2A3A60] bg-[#111827] font-jakarta text-[12px] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#4A5A80] transition disabled:opacity-50"
            >
              {hintLoading ? (
                <span className="inline-block w-3 h-3 border border-[#94A3B8] border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="text-[#F2A20C]">💡</span>
              )}
              Gợi ý ({hintCount}/{MAX_HINTS})
            </button>
          ) : (
            <button
              onClick={() => setShowExplanation(v => !v)}
              className="self-start flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2A3A60] bg-[#111827] font-jakarta text-[12px] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#4A5A80] transition"
            >
              <span>📖</span>
              {showExplanation ? 'Ẩn giải thích' : 'Xem giải thích'}
            </button>
          )}
          {hintError && (
            <p className="font-jakarta text-[12px] text-[#FB7185]">{hintError} — thử lại</p>
          )}
          {showExplanation && (
            <div className="p-3.5 rounded-xl border border-[#2A3A60] bg-[#111827]">
              <p className="font-jakarta text-[13px] text-[#94A3B8] leading-relaxed">AI sẽ giải thích sau khi bạn chọn đáp án.</p>
            </div>
          )}
          {hintTexts.map((text, i) => (
            <div key={i} className="p-3.5 rounded-xl border border-[#2A3A60] bg-[#111827]">
              <p className="font-jakarta text-[13px] text-[#94A3B8] leading-relaxed">{text}</p>
              <span className="font-jakarta text-[11px] text-[#475569]">Gợi ý {i + 1}/{MAX_HINTS}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
