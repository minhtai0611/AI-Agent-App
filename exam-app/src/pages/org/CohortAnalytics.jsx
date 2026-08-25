import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { pageVariants } from '../../utils/animations.js'
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
    <motion.div
      className="min-h-screen bg-surface flex flex-col relative overflow-hidden"
      variants={pageVariants} initial="hidden" animate="show" exit="exit"
    >
      <div className="max-w-3xl mx-auto w-full px-4 py-10 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-sans text-[20px] font-semibold text-foreground">Phân tích theo câu hỏi</h1>
          <p className="font-sans text-[13px] text-dim">Tỷ lệ trả lời đúng trên toàn bộ lượt làm bài của tổ chức.</p>
        </div>

        {items === null && <p className="font-sans text-[13px] text-dim">Đang tải…</p>}
        {items !== null && items.length === 0 && <p className="font-sans text-[13px] text-dim">Chưa có dữ liệu lượt thi.</p>}

        {items !== null && items.length > 0 && (
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <XAxis dataKey="name" hide />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="difficulty" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </motion.div>
  )
}
