import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useExamDispatch } from '../context/ExamContext.jsx'
import { generateExamStream } from '../api/aiClient.js'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { TOPIC_LABELS } from '../utils/topicLabels.js'

function GeneratingSkeleton({ count, arrived }) {
  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="max-w-xl mx-auto px-4 pt-10 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span className="font-jakarta text-sm text-muted">
            {arrived > 0 ? `Đã tạo ${arrived}/${count} câu...` : `AI đang tạo ${count} câu hỏi...`}
          </span>
        </div>
        {arrived === 0 && (
          <p className="font-jakarta text-xs text-faint">Câu hỏi đầu tiên sẽ xuất hiện trong vài giây.</p>
        )}
        {/* Progress bar */}
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <motion.div className="h-full bg-amber-400 rounded-full"
            animate={{ width: `${Math.max(4, (arrived / count) * 100)}%` }}
            transition={{ duration: 0.4 }} />
        </div>
        {/* Arrived question stubs */}
        <div className="flex flex-col gap-4">
          {Array.from({ length: count }).map((_, i) => (
            i < arrived ? (
              <motion.div key={i}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="bg-surface border border-[#22C55E33] rounded-2xl p-4 flex items-center gap-3">
                <span className="text-emerald-400 text-lg">✓</span>
                <span className="font-jakarta text-xs text-dim">Câu {i + 1} đã tạo xong</span>
              </motion.div>
            ) : (
              <motion.div key={i}
                animate={{ opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 1.8, repeat: Infinity, delay: (i - arrived) * 0.15 }}
                className="bg-surface border border-dashed border-border rounded-2xl p-5 flex flex-col gap-3">
                <div className="h-3 bg-border rounded-full w-2/3" />
                <div className="h-3 bg-border rounded-full w-full" />
              </motion.div>
            )
          ))}
        </div>
      </div>
    </div>
  )
}

const TOPICS = Object.keys(TOPIC_LABELS)
const DIFFICULTIES = [
  { value: 'easy',   label: 'Dễ',     color: '#34D399' },
  { value: 'medium', label: 'Vừa',    color: '#F2A20C' },
  { value: 'hard',   label: 'Khó',    color: '#FB7185' },
]

export default function GenerateExam() {
  usePageMeta('Tạo đề riêng', { noindex: true })
  const navigate = useNavigate()
  const { user } = useAuth()
  const dispatch = useExamDispatch()

  const [selectedTopics, setSelectedTopics] = useState([])
  const [difficulty, setDifficulty] = useState('medium')
  const [count, setCount] = useState(10)
  const [loading, setLoading] = useState(false)
  const [arrived, setArrived] = useState(0)
  const [error, setError] = useState('')
  const abortRef = useRef(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  if (loading) return <GeneratingSkeleton count={count} arrived={arrived} />

  if (user?.subscription_tier !== 'complete') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <span className="text-4xl">🔒</span>
        <span className="font-fraunces text-[20px] font-bold text-foreground">Yêu cầu gói Toàn diện</span>
        <p className="font-jakarta text-[0.8125rem] text-dim text-center max-w-xs">
          Tính năng tạo đề AI riêng chỉ dành cho gói Toàn diện.
        </p>
        <button onClick={() => navigate('/account')}
          className="px-6 py-2.5 rounded-xl font-jakarta text-[0.8125rem] font-bold"
          style={{ background: '#F2A20C', color: '#0A0E1A' }}>
          Xem gói nâng cấp
        </button>
      </div>
    )
  }

  function toggleTopic(t) {
    setSelectedTopics(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    )
  }

  async function handleGenerate() {
    setLoading(true); setError(''); setArrived(0)
    const topics = selectedTopics.length > 0 ? selectedTopics : null
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const { questions, exam_id, error: err } = await generateExamStream(
      topics, difficulty, count,
      () => setArrived(n => n + 1),
      ctrl.signal,
    )
    setLoading(false)
    if (!questions?.length) {
      setError(typeof err === 'string' ? err : 'Tạo đề thất bại, thử lại sau')
      return
    }
    const finalId = exam_id || `generated-${Date.now()}`
    const exam = {
      id: finalId,
      title: '✦ Đề AI riêng',
      totalQuestions: questions.length,
      duration: Math.ceil(questions.length * 2),
      category: 'grade10',
      mode: 'practice',
    }
    dispatch({ type: 'START_EXAM', exam, questions })
    navigate(`/test/${finalId}`)
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="max-w-xl mx-auto px-4 pt-10 flex flex-col gap-6">
        <button onClick={() => navigate('/exams?mode=lab')}
          className="font-jakarta text-[0.8125rem] text-dim hover:text-muted transition self-start">
          ← Quay lại
        </button>

        <div className="flex flex-col gap-1">
          <span className="font-fraunces text-[24px] font-bold text-foreground">✦ Tạo đề riêng</span>
          <span className="font-jakarta text-[0.8125rem] text-dim">AI tạo đề thi theo chủ đề và độ khó bạn chọn · 5 Tia</span>
        </div>

        {/* Topics */}
        <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-jakarta text-[0.8125rem] font-semibold text-highlight">Chủ đề</span>
            <span className="font-jakarta text-[0.6875rem] text-faint">
              {selectedTopics.length === 0 ? 'Tất cả chủ đề' : `${selectedTopics.length} đã chọn`}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map(t => (
              <button key={t} onClick={() => toggleTopic(t)}
                className="px-3 py-1.5 rounded-lg border font-jakarta text-xs transition"
                style={selectedTopics.includes(t)
                  ? { background: '#F2A20C22', borderColor: '#F2A20C88', color: '#F2A20C' }
                  : { background: 'transparent', borderColor: '#1E2A44', color: '#64748B' }
                }>
                {TOPIC_LABELS[t] ?? t}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3">
          <span className="font-jakarta text-[0.8125rem] font-semibold text-highlight">Độ khó</span>
          <div className="flex gap-2">
            {DIFFICULTIES.map(d => (
              <button key={d.value} onClick={() => setDifficulty(d.value)}
                className="flex-1 py-2.5 rounded-xl border font-jakarta text-[0.8125rem] font-semibold transition"
                style={difficulty === d.value
                  ? { background: d.color + '22', borderColor: d.color + '88', color: d.color }
                  : { background: 'transparent', borderColor: '#1E2A44', color: '#64748B' }
                }>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-jakarta text-[0.8125rem] font-semibold text-highlight">Số câu hỏi</span>
            <span className="font-jakarta text-sm font-bold text-primary">{count} câu</span>
          </div>
          <input type="range" min={5} max={15} step={5} value={count}
            onChange={e => setCount(Number(e.target.value))}
            className="w-full accent-amber-400" />
          <div className="flex justify-between font-jakarta text-[0.6875rem] text-faint">
            <span>5</span><span>10</span><span>15</span>
          </div>
        </div>

        {error && <p className="font-jakarta text-xs text-red-400">{error}</p>}

        <button onClick={handleGenerate} disabled={loading}
          className="w-full py-3.5 rounded-xl font-jakarta text-sm font-bold disabled:opacity-60 transition"
          style={{ background: loading ? '#1E2A44' : '#F2A20C', color: loading ? '#64748B' : '#0A0E1A' }}>
          {loading ? 'Đang tạo đề...' : `Tạo đề · ⚡5 Tia`}
        </button>
      </div>
    </div>
  )
}
