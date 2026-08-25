import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { pageVariants } from '../../utils/animations.js'
import { usePageMeta } from '../../hooks/usePageMeta.js'
import { MathText } from '../../components/MathText.jsx'
import { loadOrgPending, approvePending, rejectPending } from '../../api/index.js'

export default function PendingReview() {
  usePageMeta('Duyệt câu hỏi AI', { noindex: true })
  const [items, setItems] = useState(null)

  const reload = () => loadOrgPending('verified_pending_review').then(setItems).catch(() => setItems([]))
  useEffect(() => { reload() }, [])

  return (
    <motion.div
      className="min-h-screen bg-surface flex flex-col relative overflow-hidden"
      variants={pageVariants} initial="hidden" animate="show" exit="exit"
    >
      <div className="max-w-2xl mx-auto w-full px-4 py-10 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-sans text-[20px] font-semibold text-foreground">Hàng chờ duyệt</h1>
          <p className="font-sans text-[13px] text-dim">Câu hỏi đã xác minh bằng AI, chờ quản trị viên duyệt trước khi vào ngân hàng câu hỏi của tổ chức.</p>
        </div>

        {items === null && <p className="font-sans text-[13px] text-dim">Đang tải…</p>}
        {items !== null && items.length === 0 && <p className="font-sans text-[13px] text-dim">Không có câu hỏi nào chờ duyệt.</p>}

        <div className="flex flex-col gap-3">
          {(items ?? []).map(item => {
            let draft = {}
            try { draft = JSON.parse(item.draft_json) } catch { /* ignore */ }
            return (
              <div key={item.id} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] flex flex-col gap-3">
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
                    className="px-4 py-2 rounded-lg font-sans text-xs font-medium border border-[var(--border)] text-dim"
                  >
                    Từ chối
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
