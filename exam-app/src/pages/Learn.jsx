import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { pageVariants } from '../utils/animations.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useHistory } from '../context/HistoryContext.jsx'
import { usePageMeta } from '../hooks/usePageMeta.js'

const MODES = [
  {
    id: 'review',
    icon: '📋',
    label: 'Ôn tập FSRS',
    desc: 'Ôn tập thẻ đến hạn theo thuật toán nhớ dài hạn',
    path: '/review',
    suggestWhen: 'history', // suggest when user has exam history
    color: 'success',
  },
  {
    id: 'adaptive',
    icon: '✦',
    label: 'Luyện tập thích nghi',
    desc: 'Câu hỏi được chọn theo điểm yếu và độ khó phù hợp',
    path: '/practice',
    suggestWhen: 'new',
    color: 'info',
  },
  {
    id: 'daily',
    icon: '⚡',
    label: 'Thử thách ngày',
    desc: '1 câu hỏi mỗi ngày — nhanh, vui, tích streak',
    path: '/practice/daily',
    suggestWhen: null,
    color: 'accent',
  },
]

export default function Learn() {
  usePageMeta('Học hôm nay')
  const navigate = useNavigate()
  const { user } = useAuth()
  const { results } = useHistory()

  const hasHistory = results.length > 0
  const suggestedId = hasHistory ? 'review' : 'adaptive'

  const borderClass = {
    success: 'border-success/40 bg-success/5',
    info: 'border-info/40 bg-info/5',
    accent: 'border-border bg-surface',
  }
  const badgeClass = {
    success: 'bg-success/10 text-success border-success/20',
    info: 'bg-info/10 text-info border-info/20',
    accent: '',
  }

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show" exit="exit"
      className="min-h-screen bg-background px-6 flex flex-col items-center justify-center gap-10 pb-16">

      <div className="flex flex-col items-center gap-2 text-center">
        <span className="font-sans text-[0.6875rem] font-bold tracking-[3px] uppercase text-faint">Bắt đầu học</span>
        <h1 className="font-display text-[28px] font-bold text-foreground">Học hôm nay</h1>
        <p className="font-sans text-[0.8125rem] text-dim max-w-xs leading-relaxed">
          {hasHistory
            ? 'Ôn tập thẻ FSRS đến hạn trước, sau đó luyện tập thích nghi.'
            : 'Bắt đầu với luyện tập thích nghi — hệ thống sẽ điều chỉnh độ khó theo bạn.'}
        </p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-3">
        {MODES.map(mode => {
          const isSuggested = mode.id === suggestedId
          return (
            <button
              key={mode.id}
              onClick={() => navigate(mode.path)}
              className={`w-full flex items-start gap-4 p-5 rounded-2xl border transition hover:opacity-90 ${
                isSuggested ? borderClass[mode.color] : 'border-border bg-surface hover:border-primary/30'
              }`}
            >
              <span className="text-2xl mt-0.5 flex-shrink-0">{mode.icon}</span>
              <div className="flex flex-col gap-0.5 text-left flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-sans text-[14px] font-semibold text-foreground">{mode.label}</span>
                  {isSuggested && (
                    <span className={`font-sans text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeClass[mode.color]}`}>
                      Gợi ý hôm nay
                    </span>
                  )}
                </div>
                <span className="font-sans text-xs text-dim">{mode.desc}</span>
              </div>
            </button>
          )
        })}
      </div>

      {!user && (
        <p className="font-sans text-xs text-faint text-center">
          Đăng nhập để lưu tiến độ và nhận gợi ý cá nhân hóa
        </p>
      )}
    </motion.div>
  )
}
