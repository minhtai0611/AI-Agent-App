import { useState, useEffect } from 'react'
import PageShell, { PageCard } from '../../components/PageShell.jsx'
import { usePageMeta } from '../../hooks/usePageMeta.js'
import { MathText } from '../../components/MathText.jsx'
import { loadOrgPending, approvePending, rejectPending } from '../../api/index.js'

export default function PendingReview() {
  usePageMeta('Duyệt câu hỏi AI', { noindex: true })
  const [items, setItems] = useState(null)

  const reload = () => loadOrgPending('verified_pending_review').then(setItems).catch(() => setItems([]))
  useEffect(() => { reload() }, [])

  return (
    <PageShell title="Hàng chờ duyệt" maxWidth="max-w-3xl">
      <p className="font-sans text-[13px] text-dim -mt-2">
        Câu hỏi đã xác minh bằng AI, chờ quản trị viên duyệt trước khi vào ngân hàng câu hỏi của tổ chức.
      </p>

      {items === null && <p className="font-sans text-[13px] text-dim">Đang tải…</p>}
      {items !== null && items.length === 0 && <p className="font-sans text-[13px] text-dim">Không có câu hỏi nào chờ duyệt.</p>}

      <div className="flex flex-col gap-3">
        {(items ?? []).map(item => {
          let draft = {}
          try { draft = JSON.parse(item.draft_json) } catch { /* ignore */ }
          return (
            <PageCard key={item.id}>
              <MathText className="font-sans text-[14px] font-medium text-foreground">{draft.question_tex}</MathText>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => approvePending(item.id).then(reload)}
                  className="px-4 py-2 rounded-lg font-sans text-xs font-bold bg-primary text-primary-fg"
                >
                  Duyệt
                </button>
                <button
                  onClick={() => rejectPending(item.id).then(reload)}
                  className="px-4 py-2 rounded-lg font-sans text-xs font-medium border border-border text-dim"
                >
                  Từ chối
                </button>
              </div>
            </PageCard>
          )
        })}
      </div>
    </PageShell>
  )
}
