import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { solveMath, getMathStats } from '../api/aiClient'

const CONFIDENCE_COLOR = { high: '#10B981', medium: '#F2A20C', low: '#EF4444' }
const CONFIDENCE_LABEL = { high: 'Chắc chắn', medium: 'Khả năng cao', low: 'Không chắc' }

function StepList({ steps }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3 items-start">
          <span className="shrink-0 w-6 h-6 rounded-full bg-[#F2A20C]/15 border border-[#F2A20C]/30 text-[#F2A20C] text-[11px] font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <span className="font-jakarta text-[15px] text-[#CBD5E1] leading-relaxed">{s}</span>
        </li>
      ))}
    </ol>
  )
}

function StatsBadge({ stats }) {
  if (!stats) return null
  const total = stats.wiki_units || 0
  const problems = stats.problems || 0
  const topics = Object.keys(stats.topics || {}).length
  return (
    <div className="flex items-center gap-3 font-jakarta text-[12px] text-[#475569]">
      <span className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
        {total.toLocaleString()} wiki units
      </span>
      <span>·</span>
      <span>{problems.toLocaleString()} bài toán</span>
      <span>·</span>
      <span>{topics} chủ đề</span>
    </div>
  )
}

function AnswerCard({ result }) {
  if (result.error === 'INSUFFICIENT_KNOWLEDGE') {
    return (
      <div className="rounded-xl border border-[#2A3A5E] bg-[#0F1726] p-6 text-center">
        <div className="text-3xl mb-3">🔭</div>
        <p className="font-fraunces text-lg text-[#94A3B8]">Chưa đủ tri thức</p>
        <p className="font-jakarta text-sm text-[#475569] mt-1">
          Wiki chưa có đủ dữ liệu về bài toán này. Thêm nội dung qua pipeline ingest để mở rộng tri thức.
        </p>
      </div>
    )
  }

  const answer = result.answer || {}
  const validation = result.validation || {}
  const confidence = answer.confidence || 'low'

  return (
    <div className="flex flex-col gap-5 animate-fade-in-up">
      {/* Answer header */}
      <div className="flex items-start justify-between gap-4 rounded-xl border border-[#2A3A5E] bg-[#0F1726] p-5">
        <div className="flex flex-col gap-1">
          <span className="font-jakarta text-[11px] font-semibold text-[#475569] tracking-widest uppercase">Đáp án</span>
          <span className="font-fraunces text-2xl text-[#F8FAFC] leading-snug">{answer.final_answer}</span>
          <span className="font-jakarta text-[12px] text-[#475569] mt-1 capitalize">{answer.problem_type?.replace(/_/g, ' ')}</span>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="font-jakarta text-[11px] font-semibold tracking-widest uppercase"
            style={{ color: CONFIDENCE_COLOR[confidence] }}>
            {CONFIDENCE_LABEL[confidence]}
          </span>
          {!validation.valid && validation.issues?.length > 0 && (
            <span className="font-jakarta text-[11px] text-[#EF4444]">⚠ {validation.issues[0]}</span>
          )}
        </div>
      </div>

      {/* Steps */}
      {answer.steps?.length > 0 && (
        <div className="rounded-xl border border-[#2A3A5E] bg-[#0F1726] p-5">
          <p className="font-jakarta text-[11px] font-semibold text-[#475569] tracking-widest uppercase mb-4">Lời giải</p>
          <StepList steps={answer.steps} />
        </div>
      )}

      {/* Knowledge used */}
      {result.retrieved_ids?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {result.retrieved_ids.map(id => (
            <span key={id} className="font-jakarta text-[11px] bg-[#141D2E] border border-[#2A3A5E] text-[#64748B] rounded-full px-3 py-1">
              {id}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MathOracle() {
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    getMathStats().then(({ data }) => { if (data) setStats(data) })
  }, [])

  async function handleSolve(e) {
    e.preventDefault()
    if (!question.trim() || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    const { data, error: err } = await solveMath(question.trim())
    setLoading(false)
    if (err) { setError(err); return }
    setResult(data)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSolve(e)
  }

  return (
    <div className="min-h-screen relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse 120% 80% at 50% 0%, #1B2B4B 0%, #0A0E1A 60%)' }}>

      {/* Ambient glow */}
      <div className="absolute pointer-events-none rounded-full opacity-40"
        style={{ width: 600, height: 400, left: '50%', top: 0, transform: 'translateX(-50%)',
          background: 'radial-gradient(circle, #6366F118 0%, transparent 70%)' }} />

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-12 flex flex-col gap-8">

        {/* Back */}
        <button onClick={() => navigate('/')}
          className="self-start font-jakarta text-sm text-[#475569] hover:text-[#94A3B8] transition flex items-center gap-1.5">
          ← Trang chủ
        </button>

        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="font-jakarta text-[10px] font-semibold text-[#6366F1] tracking-[3px] uppercase">
              Experimental · AI Knowledge System
            </span>
          </div>
          <h1 className="font-fraunces text-[52px] font-bold text-[#F8FAFC] leading-none tracking-tight">
            Toán Oracle
          </h1>
          <p className="font-jakarta text-[15px] text-[#64748B] leading-relaxed max-w-[480px]">
            Đặt câu hỏi toán — Oracle truy vấn kho tri thức và giải từng bước.
          </p>
          <StatsBadge stats={stats} />
        </div>

        {/* Input */}
        <form onSubmit={handleSolve} className="flex flex-col gap-3">
          <div className="relative rounded-xl border border-[#2A3A5E] bg-[#0F1726] focus-within:border-[#6366F1] transition-colors">
            <textarea
              ref={textareaRef}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Giải phương trình x² – 5x + 6 = 0…"
              rows={3}
              className="w-full bg-transparent font-jakarta text-[15px] text-[#E2E8F0] placeholder-[#334155] resize-none px-5 pt-4 pb-10 rounded-xl outline-none"
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <span className="font-jakarta text-[11px] text-[#334155]">⌘ Enter</span>
              <button type="submit" disabled={!question.trim() || loading}
                className="px-4 py-1.5 bg-[#6366F1] text-white font-jakarta font-semibold text-sm rounded-lg disabled:opacity-40 hover:bg-[#4F46E5] transition">
                {loading ? 'Đang tính…' : 'Giải'}
              </button>
            </div>
          </div>
          {question.trim() === '' && (
            <div className="flex flex-wrap gap-2">
              {[
                'Giải 2x + 6 = 0',
                'Tính diện tích hình tròn bán kính 5cm',
                'x² – 5x + 6 = 0',
              ].map(eg => (
                <button key={eg} type="button"
                  onClick={() => { setQuestion(eg); textareaRef.current?.focus() }}
                  className="font-jakarta text-[12px] text-[#475569] border border-[#1E2D45] rounded-full px-3 py-1 hover:border-[#6366F1] hover:text-[#6366F1] transition">
                  {eg}
                </button>
              ))}
            </div>
          )}
        </form>

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 font-jakarta text-[14px] text-[#475569] animate-pulse">
            <span className="w-2 h-2 rounded-full bg-[#6366F1] animate-bounce" />
            Oracle đang truy vấn tri thức…
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/5 p-4 font-jakarta text-sm text-[#EF4444]">
            {error}
          </div>
        )}

        {/* Result */}
        {result && <AnswerCard result={result} />}

        {/* Empty-DB notice when stats show 0 */}
        {stats?.wiki_units === 0 && !loading && !result && (
          <div className="rounded-xl border border-[#2A3A5E] bg-[#0F1726] p-5 flex items-start gap-4">
            <span className="text-2xl">🌱</span>
            <div>
              <p className="font-jakarta text-[13px] font-semibold text-[#94A3B8]">Wiki còn trống</p>
              <p className="font-jakarta text-[12px] text-[#475569] mt-0.5">
                Chạy <code className="text-[#6366F1]">node scripts/ingest/crawl-bridge.js</code> để nạp tri thức vào Oracle.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
