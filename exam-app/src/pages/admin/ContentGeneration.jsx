import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageShell, { PageCard } from '../../components/PageShell.jsx'
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
    <PageShell title="Sinh câu hỏi bằng AI">
      <p className="font-sans text-[13px] text-dim -mt-2">
        Câu hỏi được xác minh độc lập bằng sympy trước khi vào hàng chờ duyệt — không tự động lên bank.
      </p>

      <PageCard className="max-w-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Chủ đề (vd: algebra)" required
            className="px-3 py-2 rounded-lg border border-border bg-background font-sans text-[13px] text-foreground" />
          <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-background font-sans text-[13px] text-foreground">
            <option value="easy">Dễ</option>
            <option value="medium">Trung bình</option>
            <option value="hard">Khó</option>
          </select>
          <input type="number" min="1" max="10" value={count} onChange={e => setCount(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-border bg-background font-sans text-[13px] text-foreground" />
          <button type="submit" className="self-start px-4 py-2 rounded-lg font-sans text-xs font-bold bg-primary text-primary-fg">Sinh câu hỏi</button>
        </form>
      </PageCard>

      {error && <p className="font-sans text-[13px] text-destructive">{error}</p>}

      {results && (
        <div className="flex flex-col gap-2">
          {results.map((r, i) => (
            <div key={i} className="p-3 rounded-xl border border-border bg-surface-elevated font-sans text-[13px] text-foreground">
              {r.status === 'verified_pending_review' ? 'Đã xác minh — chờ duyệt' : 'Bị từ chối sau nhiều lần thử'}
            </div>
          ))}
          <button onClick={() => navigate('/org/pending')} className="self-start px-4 py-2 rounded-lg font-sans text-xs font-bold border border-border text-foreground">
            Xem hàng chờ duyệt
          </button>
        </div>
      )}
    </PageShell>
  )
}
