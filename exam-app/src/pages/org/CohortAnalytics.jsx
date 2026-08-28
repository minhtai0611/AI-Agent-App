import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import PageShell, { PageCard } from '../../components/PageShell.jsx'
import { usePageMeta } from '../../hooks/usePageMeta.js'
import { getItemAnalytics } from '../../api/org.js'

export default function CohortAnalytics() {
  usePageMeta('Phân tích học tập', { noindex: true })
  const [items, setItems] = useState(null)

  useEffect(() => {
    getItemAnalytics().then(setItems).catch(() => setItems([]))
  }, [])

  const chartData = (items ?? []).map(i => ({
    name: i.question_id, difficulty: Math.round((i.difficulty_index ?? 0) * 100),
  }))

  return (
    <PageShell title="Phân tích theo câu hỏi" maxWidth="max-w-3xl">
      <p className="font-sans text-[13px] text-dim -mt-2">Tỷ lệ trả lời đúng trên toàn bộ lượt làm bài của tổ chức.</p>

      {items === null && <p className="font-sans text-[13px] text-dim">Đang tải…</p>}
      {items !== null && items.length === 0 && <p className="font-sans text-[13px] text-dim">Chưa có dữ liệu lượt thi.</p>}

      {items !== null && items.length > 0 && (
        <PageCard label="Độ khó theo câu hỏi">
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <XAxis dataKey="name" hide />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--dim)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="difficulty" fill="var(--primary)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PageCard>
      )}
    </PageShell>
  )
}
