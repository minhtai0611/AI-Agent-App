import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useExamDispatch } from '../context/ExamContext.jsx'
import { generateExam } from '../api/aiClient.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import { TOPIC_LABELS } from '../utils/topicLabels.js'

const TOPICS = Object.keys(TOPIC_LABELS)
const DIFFICULTIES = [
  { value: 'easy',   label: 'Dễ',     color: '#34D399' },
  { value: 'medium', label: 'Vừa',    color: '#F2A20C' },
  { value: 'hard',   label: 'Khó',    color: '#FB7185' },
]

export default function GenerateExam() {
  usePageTitle('Tạo đề riêng')
  const navigate = useNavigate()
  const { user } = useAuth()
  const dispatch = useExamDispatch()

  const [selectedTopics, setSelectedTopics] = useState([])
  const [difficulty, setDifficulty] = useState('medium')
  const [count, setCount] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (user?.subscription_tier !== 'complete') {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center gap-4 px-4">
        <span className="text-4xl">🔒</span>
        <span className="font-fraunces text-[20px] font-bold text-[#F8FAFC]">Yêu cầu gói Toàn diện</span>
        <p className="font-jakarta text-[13px] text-[#64748B] text-center max-w-xs">
          Tính năng tạo đề AI riêng chỉ dành cho gói Toàn diện.
        </p>
        <button onClick={() => navigate('/account')}
          className="px-6 py-2.5 rounded-xl font-jakarta text-[13px] font-bold"
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
    setLoading(true); setError('')
    const topics = selectedTopics.length > 0 ? selectedTopics : null
    const { data, error: err } = await generateExam(topics, difficulty, count)
    setLoading(false)
    if (!data?.questions?.length) {
      setError(err ?? 'Tạo đề thất bại, thử lại sau')
      return
    }
    const exam = {
      id: data.exam_id,
      title: '✦ Đề AI riêng',
      totalQuestions: data.questions.length,
      duration: Math.ceil(data.questions.length * 2),
      category: 'grade10',
      mode: 'practice',
    }
    dispatch({ type: 'START_EXAM', exam, questions: data.questions })
    navigate(`/test/${data.exam_id}`)
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] pb-16">
      <div className="max-w-xl mx-auto px-4 pt-10 flex flex-col gap-6">
        <button onClick={() => navigate('/exams?mode=special')}
          className="font-jakarta text-[13px] text-[#64748B] hover:text-[#94A3B8] transition self-start">
          ← Quay lại
        </button>

        <div className="flex flex-col gap-1">
          <span className="font-fraunces text-[24px] font-bold text-[#F8FAFC]">✦ Tạo đề riêng</span>
          <span className="font-jakarta text-[13px] text-[#64748B]">AI tạo đề thi theo chủ đề và độ khó bạn chọn · 5 Tia</span>
        </div>

        {/* Topics */}
        <div className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-jakarta text-[13px] font-semibold text-[#F0F4FF]">Chủ đề</span>
            <span className="font-jakarta text-[11px] text-[#475569]">
              {selectedTopics.length === 0 ? 'Tất cả chủ đề' : `${selectedTopics.length} đã chọn`}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map(t => (
              <button key={t} onClick={() => toggleTopic(t)}
                className="px-3 py-1.5 rounded-lg border font-jakarta text-[12px] transition"
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
        <div className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-5 flex flex-col gap-3">
          <span className="font-jakarta text-[13px] font-semibold text-[#F0F4FF]">Độ khó</span>
          <div className="flex gap-2">
            {DIFFICULTIES.map(d => (
              <button key={d.value} onClick={() => setDifficulty(d.value)}
                className="flex-1 py-2.5 rounded-xl border font-jakarta text-[13px] font-semibold transition"
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
        <div className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-jakarta text-[13px] font-semibold text-[#F0F4FF]">Số câu hỏi</span>
            <span className="font-jakarta text-[14px] font-bold text-[#F2A20C]">{count} câu</span>
          </div>
          <input type="range" min={5} max={15} step={5} value={count}
            onChange={e => setCount(Number(e.target.value))}
            className="w-full accent-amber-400" />
          <div className="flex justify-between font-jakarta text-[11px] text-[#475569]">
            <span>5</span><span>10</span><span>15</span>
          </div>
        </div>

        {error && <p className="font-jakarta text-[12px] text-red-400">{error}</p>}

        <button onClick={handleGenerate} disabled={loading}
          className="w-full py-3.5 rounded-xl font-jakarta text-[14px] font-bold disabled:opacity-60 transition"
          style={{ background: loading ? '#1E2A44' : '#F2A20C', color: loading ? '#64748B' : '#0A0E1A' }}>
          {loading ? 'Đang tạo đề...' : `Tạo đề · ⚡5 Tia`}
        </button>
      </div>
    </div>
  )
}
