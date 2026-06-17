import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { pageVariants } from '../utils/animations.js'

const TIERS = [
  { id: 'student', label: 'Student', price: 79000, desc: 'Không giới hạn câu hỏi · AI hints & phân tích' },
  { id: 'complete', label: 'Complete', price: 149000, desc: 'Mọi tính năng · Dự đoán điểm · Kế hoạch học 4 tuần' },
]
const DURATIONS = [
  { months: 1, label: '1 tháng' },
  { months: 3, label: '3 tháng', badge: '-10%' },
  { months: 6, label: '6 tháng', badge: '-15%' },
]

export default function Gift() {
  const navigate = useNavigate()
  const [tier, setTier] = useState('student')
  const [months, setMonths] = useState(1)
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [senderNote, setSenderNote] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selected = TIERS.find(t => t.id === tier)
  const discount = months === 3 ? 0.9 : months === 6 ? 0.85 : 1
  const total = Math.round(selected.price * months * discount / 1000) * 1000

  async function handleSubmit(e) {
    e.preventDefault()
    if (!recipientEmail.trim()) { setError('Nhập email người nhận.'); return }
    setError('')
    setLoading(true)
    // Fire-and-forget to Formspree — replace with actual gift endpoint when payment is wired
    try {
      await fetch('https://formspree.io/f/gift-placeholder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ tier, months, recipientName, recipientEmail, senderNote }),
      })
    } catch (_) {}
    setLoading(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <motion.div variants={pageVariants} initial="hidden" animate="show" exit="exit" className="min-h-screen bg-background flex flex-col items-center justify-center px-4 gap-6 text-center">
        <span className="text-5xl">🎁</span>
        <h1 className="font-sans text-[22px] font-bold text-foreground">Đã gửi quà!</h1>
        <p className="font-sans text-[0.8125rem] text-muted max-w-xs">
          {recipientName || 'Người nhận'} sẽ nhận được link kích hoạt gói <strong>{selected.label} {months} tháng</strong> qua email {recipientEmail} trong vòng 24 giờ.
        </p>
        <button onClick={() => navigate('/home')}
          className="px-6 py-3 rounded-xl font-sans text-[0.8125rem] font-bold bg-primary text-primary-fg hover:opacity-90 transition">
          Về trang chủ
        </button>
      </motion.div>
    )
  }

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show" exit="exit" className="min-h-screen bg-background pb-16">
      <div className="max-w-lg mx-auto px-4 pt-8 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="font-sans text-xs text-dim hover:text-muted transition">← Quay lại</button>
        </div>

        <div className="flex flex-col gap-1">
          <h1 className="font-sans text-[22px] font-bold text-foreground">Tặng gói học</h1>
          <p className="font-sans text-[0.8125rem] text-muted">Món quà ý nghĩa cho mùa thi.</p>
        </div>

        {/* Tier selector */}
        <div className="flex flex-col gap-2">
          <span className="font-sans text-[11px] font-semibold text-muted uppercase tracking-wider">Chọn gói</span>
          <div className="grid grid-cols-2 gap-3">
            {TIERS.map(t => (
              <button key={t.id} onClick={() => setTier(t.id)}
                className={`flex flex-col gap-1 px-4 py-3 rounded-xl border text-left transition ${tier === t.id ? 'border-primary bg-primary/5' : 'border-border bg-surface'}`}>
                <span className="font-sans text-[13px] font-bold text-foreground">{t.label}</span>
                <span className="font-sans text-[10px] text-muted leading-relaxed">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Duration selector */}
        <div className="flex flex-col gap-2">
          <span className="font-sans text-[11px] font-semibold text-muted uppercase tracking-wider">Thời hạn</span>
          <div className="flex gap-2">
            {DURATIONS.map(d => (
              <button key={d.months} onClick={() => setMonths(d.months)}
                className={`flex-1 relative px-3 py-2.5 rounded-xl border font-sans text-[12px] font-semibold transition ${months === d.months ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-surface text-muted'}`}>
                {d.label}
                {d.badge && (
                  <span className="absolute -top-2 -right-1 px-1.5 py-0.5 rounded-full bg-success text-white font-sans text-[9px] font-bold">{d.badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Recipient info */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="font-sans text-[11px] font-semibold text-muted uppercase tracking-wider">Thông tin người nhận</span>
            <input
              type="text" placeholder="Tên người nhận (không bắt buộc)"
              value={recipientName} onChange={e => setRecipientName(e.target.value)}
              className="px-4 py-3 rounded-xl border border-border bg-surface font-sans text-[13px] text-foreground placeholder:text-faint focus:outline-none focus:border-primary/40 transition"
            />
            <input
              type="email" placeholder="Email người nhận *" required
              value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)}
              className="px-4 py-3 rounded-xl border border-border bg-surface font-sans text-[13px] text-foreground placeholder:text-faint focus:outline-none focus:border-primary/40 transition"
            />
            <textarea
              placeholder="Lời nhắn (không bắt buộc)"
              rows={3} value={senderNote} onChange={e => setSenderNote(e.target.value)}
              className="px-4 py-3 rounded-xl border border-border bg-surface font-sans text-[13px] text-foreground placeholder:text-faint focus:outline-none focus:border-primary/40 transition resize-none"
            />
          </div>

          {error && <p className="font-sans text-[12px] text-destructive">{error}</p>}

          {/* Summary + CTA */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-elevated border border-border">
            <div className="flex flex-col gap-0.5">
              <span className="font-sans text-[11px] text-muted">Tổng thanh toán</span>
              <span className="font-sans text-[18px] font-bold text-foreground">{total.toLocaleString('vi-VN')} ₫</span>
            </div>
            <button type="submit" disabled={loading}
              className="px-5 py-2.5 rounded-xl font-sans text-[13px] font-bold bg-primary text-primary-fg hover:opacity-90 transition disabled:opacity-50">
              {loading ? 'Đang xử lý…' : 'Mua ngay →'}
            </button>
          </div>
          <p className="font-sans text-[10px] text-faint text-center">
            Thanh toán an toàn · Link kích hoạt gửi qua email trong 24h · Hỗ trợ: taitm@locdo.tech
          </p>
        </form>
      </div>
    </motion.div>
  )
}
