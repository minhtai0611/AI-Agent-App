import { useState, useEffect, useRef, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getHint, getExplanation, reportQuestion } from '../api/aiClient.js'
import { loadPreferences } from '../utils/aiPreferences.js'
import { sanitizeSvg } from '../utils/sanitizeSvg.js'
import { MathText } from './MathText.jsx'

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
      <span className="font-jakarta text-[10px] text-[#2A3A50] mr-1">Hữu ích?</span>
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

const REPORT_REASONS = ['Sai đáp án', 'Câu hỏi không rõ', 'Lỗi hiển thị']

function ReportButton({ questionId }) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  async function submit(reason) {
    setSending(true)
    await reportQuestion(questionId, reason)
    setSending(false)
    setSent(true)
    setTimeout(() => { setSent(false); setOpen(false) }, 2000)
  }

  if (sent) return <p className="font-jakarta text-[11px] text-[#34D399] mt-2">Đã gửi báo cáo — cảm ơn!</p>

  return (
    <div className="relative mt-2">
      <button
        onClick={() => setOpen(v => !v)}
        className="font-jakarta text-[11px] text-[#475569] hover:text-[#64748B] transition"
      >
        Báo lỗi
      </button>
      {open && (
        <div className="absolute left-0 top-5 z-20 bg-[#0D1221] border border-[#1E2A44] rounded-xl p-3 flex flex-col gap-1.5 shadow-xl min-w-max">
          {REPORT_REASONS.map(r => (
            <button
              key={r}
              disabled={sending}
              onClick={() => submit(r)}
              className="font-jakarta text-[12px] text-[#94A3B8] hover:text-[#F8FAFC] text-left px-2 py-1 rounded hover:bg-[#1E2A44] transition disabled:opacity-50"
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function QuestionCard({ question, chosen, onAnswer, practiceMode, submitted, hintState, onHint }) {
  const navigate = useNavigate()
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
    getExplanation({ question, chosen_index: chosen, ai_preferences: loadPreferences() }).then(({ data }) => {
      if (data) setAiResult({ correct_index: data.correct_index, explanation: data.explanation })
    })
  }, [showFeedback, question.id, chosen])

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
      setHintError(`Hết Tia (còn ${error.balance}, cần ${error.required})`)
    } else if (status === 429) {
      setHintError('Vui lòng chờ trước khi yêu cầu gợi ý tiếp theo')
    } else {
      setHintError(typeof error === 'string' ? error : 'Không thể tải gợi ý')
    }
  }

  const aiCorrect = aiResult?.correct_index ?? null
  const isCorrect = aiResult !== null && chosen === aiCorrect

  return (
    <div>
      {question.figure?.data && (
        <div
          className="mb-4 rounded-xl overflow-hidden border border-[#1E2A44] bg-[#0D1221] flex justify-center p-3"
          dangerouslySetInnerHTML={{ __html: sanitizeSvg(question.figure.data) }}
        />
      )}

      {question.image && (
        <div className="mb-4 rounded-xl overflow-hidden border border-[#1E2A44] bg-[#0D1221] flex justify-center p-3">
          <img
            src={question.image}
            alt=""
            className="max-h-64 w-auto object-contain"
          />
        </div>
      )}

      <MathText className="font-fraunces text-[20px] text-[#F0F4FF] leading-relaxed mb-5 whitespace-pre-wrap">
        {question.question}
      </MathText>
      <div className="flex flex-col gap-2.5">
        {question.choices.map((choice, i) => {
          const s = choiceStyle(i, chosen, aiCorrect, showFeedback)
          const isChosen = i === chosen
          const feedbackAnim = aiResult !== null && isChosen
            ? isCorrect
              ? { scale: [1, 1.04, 1], transition: { duration: 0.35 } }
              : { x: [-7, 7, -7, 7, 0], transition: { duration: 0.4 } }
            : {}
          return (
            <motion.button
              key={i}
              animate={feedbackAnim}
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
              <MathText className="font-jakarta text-[15px] font-medium" style={{ color: s.text }}>
                {choice}
              </MathText>
            </motion.button>
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
                <MathText
                  className="font-jakarta text-[13px] leading-relaxed"
                  style={{ color: isCorrect ? '#6EE7B7' : '#FCA5A5' }}
                >
                  {aiResult.explanation}
                </MathText>
              </div>
            </>
          )}
        </div>
      )}

      <ReportButton questionId={question.id} />

      {/* Struggle support — shown when answer is wrong */}
      {showFeedback && aiResult !== null && !isCorrect && (
        <div className="mt-3 px-4 py-3 rounded-xl border border-[#2A1A24] bg-[#160A0E] flex items-start gap-3">
          <span className="text-base flex-shrink-0">💡</span>
          <div className="flex flex-col gap-1.5">
            <span className="font-jakarta text-[12px] font-semibold text-[#F87171]">
              Bài này khó — đừng nản!
            </span>
            <span className="font-jakarta text-[11px] text-[#64748B] leading-relaxed">
              Hãy đọc kỹ giải thích trên, sau đó thử lại bài tương tự. Oracle có thể giúp bạn hiểu sâu hơn.
            </span>
          </div>
        </div>
      )}

      {/* Oracle button — always visible in practice mode */}
      {practiceMode && !submitted && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => navigate(`/oracle?q=${encodeURIComponent(question.question)}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#6366F133] bg-[#6366F108] font-jakarta text-[11px] font-semibold text-[#818CF8] hover:border-[#6366F166] hover:bg-[#6366F114] transition"
          >
            <span className="text-[10px]">✦</span> Oracle
          </button>
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
              <span className="text-[#2A3A60] text-[10px]">⚡1</span>
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
            <div key={i} className="p-3.5 rounded-xl border border-[#2A3A60] bg-[#111827] flex flex-col gap-2">
              <MathText className="font-jakarta text-[13px] text-[#94A3B8] leading-relaxed">{text}</MathText>
              <div className="flex items-center justify-between">
                <span className="font-jakarta text-[11px] text-[#475569]">Gợi ý {i + 1}/{MAX_HINTS}</span>
                <AIRating questionId={question.id} hintIndex={i} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default memo(QuestionCard, (prev, next) =>
  prev.question.id === next.question.id &&
  prev.chosen === next.chosen &&
  prev.mode === next.mode &&
  prev.practiceMode === next.practiceMode &&
  prev.submitted === next.submitted
)
