import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { pageVariants } from '../../utils/animations.js'
import { usePageMeta } from '../../hooks/usePageMeta.js'
import { generateOrgQuestions } from '../../api/index.js'

export default function ContentGeneration() {
  usePageMeta('Sinh câu hỏi bằng AI', { noindex: true })
  const navigate = useNavigate()
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState('easy')
  const [count, setCount] = useState(1)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setResults(null)
    try {
      const { results } = await generateOrgQuestions(topic, difficulty, count)
      setResults(results)
    } catch {
      setError('Không tạo được câu hỏi — kiểm tra cấu hình AI router.')
    }
  }

  return (
    <motion.div
      className="min-h-screen bg-surface flex flex-col relative overflow-hidden"
      variants={pageVariants} initial="hidden" animate="show" exit="exit"
    >
      <div className="max-w-2xl mx-auto w-full px-4 py-10 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-sans text-[20px] font-semibold text-foreground">Sinh câu hỏi bằng AI</h1>
          <p className="font-sans text-[13px] text-dim">
            Câu hỏi được xác minh độc lập bằng sympy trước khi vào hàng chờ duyệt — không tự động lên bank.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2 max-w-sm">
          <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Chủ đề (vd: algebra)" required
            className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] font-sans text-[13px] text-foreground" />
          <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] font-sans text-[13px] text-foreground">
            <option value="easy">Dễ</option>
            <option value="medium">Trung bình</option>
            <option value="hard">Khó</option>
          </select>
          <input type="number" min="1" max="10" value={count} onChange={e => setCount(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] font-sans text-[13px] text-foreground" />
          <button type="submit" className="self-start px-4 py-2 rounded-lg font-sans text-xs font-bold bg-primary text-primary-fg">Sinh câu hỏi</button>
        </form>

        {error && <p className="font-sans text-[13px] text-[var(--destructive)]">{error}</p>}

        {results && (
          <div className="flex flex-col gap-2">
            {results.map((r, i) => (
              <div key={i} className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] font-sans text-[13px] text-foreground">
                {r.status === 'verified_pending_review' ? 'Đã xác minh — chờ duyệt' : 'Bị từ chối sau nhiều lần thử'}
              </div>
            ))}
            <button onClick={() => navigate('/org/pending')} className="self-start px-4 py-2 rounded-lg font-sans text-xs font-bold border border-[var(--border)] text-foreground">
              Xem hàng chờ duyệt
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
