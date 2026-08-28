import { useState, useEffect } from 'react'
import PageShell, { PageCard } from '../../components/PageShell.jsx'
import { usePageMeta } from '../../hooks/usePageMeta.js'
import { MathText } from '../../components/MathText.jsx'
import { getContentLibrary, submitContentItem, submitContentForReview, approveContentItem } from '../../api/org.js'

const STATUS_LABELS = {
  draft: 'Bản nháp', pending_review: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối', archived: 'Lưu trữ',
}

export default function ContentLibrary() {
  usePageMeta('Thư viện nội dung', { noindex: true })
  const [items, setItems] = useState(null)
  const [question, setQuestion] = useState('')
  const [choiceA, setChoiceA] = useState('')
  const [choiceB, setChoiceB] = useState('')

  const reload = () => getContentLibrary().then(setItems).catch(() => setItems([]))
  useEffect(() => { reload() }, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!question || !choiceA || !choiceB) return
    await submitContentItem({ question, choices: [choiceA, choiceB], correct: 0 })
    setQuestion(''); setChoiceA(''); setChoiceB('')
    reload()
  }

  return (
    <PageShell title="Thư viện nội dung tổ chức" maxWidth="max-w-3xl">
      <PageCard className="max-w-lg">
        <form onSubmit={handleCreate} className="flex flex-col gap-2">
          <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Câu hỏi"
            className="px-3 py-2 rounded-lg border border-border bg-background font-sans text-[13px] text-foreground" />
          <input value={choiceA} onChange={e => setChoiceA(e.target.value)} placeholder="Đáp án đúng"
            className="px-3 py-2 rounded-lg border border-border bg-background font-sans text-[13px] text-foreground" />
          <input value={choiceB} onChange={e => setChoiceB(e.target.value)} placeholder="Đáp án sai"
            className="px-3 py-2 rounded-lg border border-border bg-background font-sans text-[13px] text-foreground" />
          <button type="submit" className="self-start px-4 py-2 rounded-lg font-sans text-xs font-bold bg-primary text-primary-fg">Thêm bản nháp</button>
        </form>
      </PageCard>

      <div className="flex flex-col gap-2">
        {(items ?? []).map(item => (
          <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface-elevated flex-wrap">
            <MathText className="font-sans text-[13px] text-foreground flex-1 min-w-[160px]">{item.question}</MathText>
            <span className="font-sans text-[11px] text-dim">{STATUS_LABELS[item.status] ?? item.status}</span>
            {item.status === 'draft' && (
              <button onClick={() => submitContentForReview(item.id).then(reload)} className="px-3 py-1.5 rounded-lg font-sans text-[11px] font-medium border border-border text-dim">Gửi duyệt</button>
            )}
            {item.status === 'pending_review' && (
              <button onClick={() => approveContentItem(item.id).then(reload)} className="px-3 py-1.5 rounded-lg font-sans text-[11px] font-bold bg-primary text-primary-fg">Duyệt</button>
            )}
          </div>
        ))}
      </div>
    </PageShell>
  )
}
