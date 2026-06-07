import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useHistory } from '../context/HistoryContext.jsx'
import { loadExamById } from '../api/index.js'
import { listVariants, itemVariants, pageVariants } from '../utils/animations.js'
import { usePageMeta } from '../hooks/usePageMeta.js'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function shortDate(iso) {
  const d = new Date(iso)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

const PAGE_SIZE = 10

export default function History() {
  usePageMeta('Lịch sử', { noindex: true })
  const navigate = useNavigate()
  const { results } = useHistory()
  const [page, setPage] = useState(1)
  const sorted = [...results].sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))

  // Personal best per exam
  const bestByExam = {}
  for (const r of results) {
    if (!bestByExam[r.examId] || r.score > bestByExam[r.examId]) {
      bestByExam[r.examId] = r.score
    }
  }

  // Score trend chart data (oldest → newest, up to last 10)
  const chartData = [...results]
    .sort((a, b) => new Date(a.finishedAt) - new Date(b.finishedAt))
    .slice(-10)
    .map(r => ({ date: shortDate(r.finishedAt), score: r.score }))

  return (
    <motion.div
      className="min-h-screen bg-background flex flex-col relative overflow-hidden"
      variants={pageVariants} initial="hidden" animate="show" exit="exit"
    >
      {/* Ambient glows */}
      <div className="absolute pointer-events-none rounded-full"
        style={{ width: 560, height: 560, right: -120, top: -60,
          background: 'radial-gradient(circle, #F2A20C12 0%, transparent 100%)' }} />
      <div className="absolute pointer-events-none rounded-full"
        style={{ width: 420, height: 420, left: -80, bottom: 80,
          background: 'radial-gradient(circle, #6366F112 0%, transparent 100%)' }} />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-10 py-4 bg-surface border-b border-[#1E2D45]">
        <button onClick={() => navigate('/')} className="font-jakarta text-sm text-dim hover:text-muted transition">
          ← Trang chủ
        </button>
        <h1 className="font-fraunces text-[24px] font-bold text-foreground">Lịch sử làm bài</h1>
        <div className="w-24" />
      </header>

      <div className="relative z-10 flex flex-col gap-6 p-6 sm:p-10 max-w-3xl mx-auto w-full">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="font-jakarta text-muted text-lg">Bạn chưa làm bài thi nào. Hãy bắt đầu với một đề thử! 📝</p>
            <button onClick={() => navigate('/exams')}
              className="px-6 py-2.5 bg-primary text-primary-fg font-jakarta font-bold text-sm rounded-lg hover:opacity-90 transition">
              Bắt đầu thi thử
            </button>
          </div>
        ) : (
          <>
            {/* Score trend chart */}
            {chartData.length >= 2 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
                className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-3"
              >
                <span className="font-fraunces text-[15px] font-semibold text-foreground">Xu hướng điểm số</span>
                <div style={{ height: 120 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10, fontFamily: 'Plus Jakarta Sans, sans-serif' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 10]} tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
                      <Tooltip
                        contentStyle={{ background: '#0D1221', border: '1px solid #1E2A44', borderRadius: 8, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12 }}
                        labelStyle={{ color: '#94A3B8' }}
                        itemStyle={{ color: '#F2A20C' }}
                      />
                      <Line type="monotone" dataKey="score" stroke="#F2A20C" strokeWidth={2} dot={{ r: 4, fill: '#F2A20C', stroke: '#0D1221', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}

            {/* Result cards — paginated */}
            {(() => {
              const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
              const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
              return (
                <>
                  <motion.div className="flex flex-col gap-4" variants={listVariants} initial="hidden" animate="show">
                    {pageItems.map(result => {
                      const scoreColor = result.score >= 8 ? '#10B981' : result.score >= 6 ? '#F2A20C' : '#FB7185'
                      const borderColor = result.score < 5 ? '#FB718540' : '#1E2D45'
                      const examTitle = loadExamById(result.examId)?.title ?? result.examId
                      const isPersonalBest = result.score === bestByExam[result.examId] && results.filter(r => r.examId === result.examId).length > 1
                      return (
                        <motion.div
                          key={result.id}
                          variants={itemVariants}
                          className="flex items-center justify-between bg-surface-elevated rounded-xl px-6 py-5 cursor-pointer transition-all"
                          style={{ border: `1px solid ${borderColor}` }}
                          onClick={() => navigate(`/results/${result.id}`, { state: { result } })}
                        >
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-jakarta text-[15px] font-semibold text-foreground">{examTitle}</span>
                              {isPersonalBest && (
                                <span className="font-jakarta text-[0.625rem] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400">🏆 Best</span>
                              )}
                            </div>
                            <span className="font-jakarta text-[0.8125rem] text-dim">{formatDate(result.finishedAt)}</span>
                          </div>
                          <div className="flex items-center gap-5">
                            <span className="font-fraunces text-[40px] font-bold" style={{ color: scoreColor }}>{result.score}</span>
                            <span className="px-4 py-2 bg-[#1A2440] rounded-md font-jakarta text-[0.8125rem] text-muted hover:text-foreground transition">
                              Chi tiết →
                            </span>
                          </div>
                        </motion.div>
                      )
                    })}
                  </motion.div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 pt-2">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 rounded-lg font-jakarta text-[0.8125rem] bg-surface-elevated border border-border text-muted disabled:opacity-30 hover:text-foreground transition">
                        ← Trước
                      </button>
                      <span className="font-jakarta text-xs text-faint">{page} / {totalPages}</span>
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-4 py-2 rounded-lg font-jakarta text-[0.8125rem] bg-surface-elevated border border-border text-muted disabled:opacity-30 hover:text-foreground transition">
                        Tiếp →
                      </button>
                    </div>
                  )}
                </>
              )
            })()}
          </>
        )}
      </div>
    </motion.div>
  )
}
