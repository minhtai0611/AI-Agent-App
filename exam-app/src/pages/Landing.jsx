import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { pageVariants, listVariants, itemVariants } from '../utils/animations.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useHistory } from '../context/HistoryContext.jsx'
import { computeStreak } from '../utils/streak.js'
import { getDaysUntilExam, getExamYear } from '../utils/examCountdown.js'
import ZenithLogo from '../components/ZenithLogo.jsx'

const PLANS_MONTHLY = [
  {
    tier: 'basic', label: 'Cơ bản', price: 'Miễn phí', credits: 50,
    features: ['5 Oracle/ngày', 'Tất cả chế độ thi', 'Thử thách hằng ngày'],
  },
  {
    tier: 'student', label: 'Học sinh', price: '29,000đ / tháng', credits: 500, badge: 'PHỔ BIẾN',
    features: ['Oracle không giới hạn', 'AI Phân tích miễn phí', 'Thưởng chuỗi học', 'Xu hướng 30 ngày', 'Kế hoạch học'],
  },
  {
    tier: 'complete', label: 'Toàn diện', price: '59,000đ / tháng', credits: 2000,
    features: ['Tất cả gói Học sinh', 'Tạo đề AI riêng', 'Dự đoán điểm số', 'AI Gia sư ghi nhớ', 'Chiến lược thi', 'So sánh tỉnh thành'],
  },
]

const TOPUP_PACKAGES = [
  { price: '15,000đ', credits: 150 },
  { price: '29,000đ', credits: 350 },
  { price: '59,000đ', credits: 800 },
]

function getDueCount() {
  try {
    const queue = JSON.parse(localStorage.getItem('review_queue') ?? '{}')
    const today = new Date().toISOString().slice(0, 10)
    return Object.values(queue).filter(e => e.dueDate <= today).length
  } catch { return 0 }
}

export default function Landing({ onOpenAuth }) {
  usePageTitle('')
  const navigate = useNavigate()
  const { user } = useAuth()
  const { results } = useHistory()
  const [searchParams] = useSearchParams()
  const [dueCount, setDueCount] = useState(0)
  const streak = useMemo(() => computeStreak(results), [results])
  const daysUntil = user ? getDaysUntilExam(user.province) : null

  useEffect(() => { setDueCount(getDueCount()) }, [])

  // Store referral code before user logs in
  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref && /^[A-Za-z0-9_-]{8,20}$/.test(ref)) {
      try { sessionStorage.setItem('pending_ref', ref) } catch { /* ignore */ }
    }
  }, [searchParams])

  return (
    <motion.div
      className="min-h-screen relative overflow-hidden flex flex-col items-center"
      variants={pageVariants} initial="hidden" animate="show"
      style={{ background: 'radial-gradient(ellipse 140% 100% at 50% 35%, #1B2B4B 0%, #0A0E1A 100%)' }}
    >
      {/* Amber glow */}
      <div className="absolute pointer-events-none rounded-full"
        style={{ width: 880, height: 560, left: '50%', top: 100, transform: 'translateX(-50%)',
          background: 'radial-gradient(circle, #F2A20C18 0%, #F2A20C00 100%)' }} />

      {/* Hero section */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-10 text-center px-6 sm:px-8 pt-20 pb-16 w-full"
        variants={listVariants}
        initial="hidden"
        animate="show"
      >
        <div className="flex flex-col items-center gap-5">
          <motion.div variants={itemVariants}>
            <ZenithLogo variant="hero" />
          </motion.div>
          <motion.span variants={itemVariants}
            className="font-jakarta text-[11px] font-semibold text-[#F2A20C] tracking-[3px] uppercase">
            Kỳ thi tuyển sinh {getExamYear()} · Toán Lớp 10
          </motion.span>
          <motion.h1 variants={itemVariants}
            className="font-fraunces text-[56px] sm:text-[72px] font-bold text-[#F8FAFC] leading-[1.05] text-center">
            Học để hiểu,<br />
            <span style={{ color: '#F2A20C' }}>không học để quên.</span>
          </motion.h1>
          <motion.p variants={itemVariants}
            className="font-jakarta text-[17px] text-[#94A3B8] leading-relaxed max-w-[600px] text-center">
            Toán Oracle giải từng bước — bạn học cách tư duy, không chỉ học đáp án.<br />
            <span className="text-[#64748B] text-[15px]">
              40+ đề thật từ 63 tỉnh thành · AI phát hiện lỗi sai và chỉ cách sửa.
            </span>
          </motion.p>
        </div>

        {/* Oracle input + secondary links */}
        <motion.div variants={itemVariants} className="w-full max-w-xl flex flex-col items-center gap-4">
          <form
            className="w-full flex items-center gap-2 bg-[#141D2E] border border-[#6366F144] rounded-xl px-4 py-3 focus-within:border-[#6366F188] transition"
            onSubmit={e => {
              e.preventDefault()
              const q = e.target.query.value.trim()
              navigate(q ? `/oracle?q=${encodeURIComponent(q)}` : '/oracle')
            }}
          >
            <span className="text-[#6366F1] text-base select-none flex-shrink-0">✦</span>
            <input
              name="query"
              placeholder="Nhập bài toán cần giải..."
              className="flex-1 bg-transparent font-jakarta text-[15px] text-[#F0F4FF] placeholder-[#475569] outline-none min-w-0"
            />
            <button type="submit"
              className="flex-shrink-0 px-4 py-1.5 rounded-lg bg-[#6366F1] text-white font-jakarta text-[13px] font-semibold hover:bg-[#4F46E5] transition">
              Hỏi →
            </button>
          </form>
          <div className="flex items-center gap-5 flex-wrap justify-center">
            <button onClick={() => navigate('/exams')}
              className="font-jakarta text-[13px] font-semibold text-[#F2A20C] hover:opacity-80 transition">
              Thi thử
            </button>
            <span className="text-[#1E2A44]">·</span>
            <button onClick={() => navigate('/exams?mode=practice')}
              className="font-jakarta text-[13px] font-semibold text-[#94A3B8] hover:text-[#F0F4FF] transition">
              Luyện tập
            </button>
            <span className="text-[#1E2A44]">·</span>
            <button onClick={() => navigate('/exams?mode=special')}
              className="font-jakarta text-[13px] font-semibold text-[#94A3B8] hover:text-[#F0F4FF] transition">
              Chế độ đặc biệt
            </button>
          </div>
        </motion.div>

        {/* Today card — logged-in users only */}
        {user && (
          <motion.div variants={itemVariants}
            className="w-full max-w-xl bg-[#0D1527] border border-[#1E2A44] rounded-2xl px-5 py-4 flex items-center gap-5 flex-wrap"
          >
            {streak > 0 && (
              <span className="font-jakarta text-[13px] font-semibold text-[#F2A20C]">🔥 {streak} ngày</span>
            )}
            {daysUntil != null && (
              <span className="font-jakarta text-[13px] font-semibold text-[#818CF8]">📅 Còn {daysUntil} ngày</span>
            )}
            {dueCount > 0 && (
              <button onClick={() => navigate('/review')}
                className="flex items-center gap-1.5 font-jakarta text-[13px] font-semibold text-[#34D399] hover:opacity-80 transition">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
                {dueCount} câu cần ôn
              </button>
            )}
            <button onClick={() => navigate('/history')}
              className="ml-auto font-jakarta text-[12px] text-[#475569] hover:text-[#94A3B8] transition">
              Lịch sử →
            </button>
          </motion.div>
        )}

        {/* Proof strip */}
        <motion.div variants={itemVariants}
          className="flex items-center gap-2 flex-wrap justify-center font-jakarta text-[13px] text-[#475569]">
          {[
            { value: '1,104', label: 'câu từ đề thi thật', color: '#F2A20C' },
            { value: '63', label: 'tỉnh thành', color: '#F2A20C' },
            { value: '6', label: 'dạng toán có Oracle AI', color: '#818CF8' },
            { value: 'SM-2', label: 'ghi nhớ thông minh', color: '#34D399' },
          ].map(({ value, label, color }, i, arr) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="font-fraunces font-bold text-[15px]" style={{ color }}>{value}</span>
              <span>{label}</span>
              {i < arr.length - 1 && <span className="text-[#1E2A44] mx-2">·</span>}
            </span>
          ))}
        </motion.div>

        {/* Benefits strip */}
        <motion.div variants={itemVariants}
          className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-3 gap-3 px-0">
          {[
            {
              icon: '✦', iconColor: '#818CF8',
              title: 'Oracle AI',
              desc: 'Hỏi bất kỳ bài toán — nhận lời giải từng bước rõ ràng trong vài giây',
            },
            {
              icon: '🎯', iconColor: '#F2A20C',
              title: 'Biết bạn yếu ở đâu',
              desc: 'AI phân tích từng bài làm, chỉ đúng lỗi sai — không đoán mò khi ôn thi',
            },
            {
              icon: '📋', iconColor: '#34D399',
              title: 'Đề thật, không đề luyện',
              desc: 'Tất cả từ đề thi tuyển sinh chính thức — mô phỏng đúng cấu trúc kỳ thi',
            },
          ].map(({ icon, iconColor, title, desc }) => (
            <div key={title}
              className="flex flex-col gap-2 bg-[#0D1527] border border-[#1E2A44] rounded-2xl px-5 py-4 text-left">
              <span className="text-xl" style={{ color: iconColor }}>{icon}</span>
              <span className="font-jakarta text-[14px] font-semibold text-[#F0F4FF]">{title}</span>
              <span className="font-jakarta text-[12px] text-[#64748B] leading-relaxed">{desc}</span>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Pricing section */}
      <div className="relative z-10 w-full max-w-3xl mx-auto px-4 sm:px-6 pb-24 flex flex-col gap-10">
        <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, #1E2A44, transparent)' }} />

        <div className="flex flex-col items-center gap-2 text-center">
          <span className="font-fraunces text-[28px] font-bold text-[#F8FAFC]">Bắt đầu miễn phí</span>
          <p className="font-jakarta text-[14px] text-[#64748B]">Không cần thẻ ngân hàng · Nâng cấp khi bạn sẵn sàng</p>
        </div>

        <motion.div
          className="flex flex-col gap-3"
          variants={listVariants} initial="hidden" whileInView="show" viewport={{ once: true }}
        >
          {PLANS_MONTHLY.map(plan => (
            <motion.div
              key={plan.tier}
              variants={itemVariants}
              whileHover={{ scale: 1.01, borderColor: plan.tier === 'student' ? '#F2A20C88' : '#2A3A5E' }}
              className="flex items-start justify-between gap-4 px-6 py-5 rounded-2xl border transition-all cursor-default"
              style={{
                background: plan.tier === 'student' ? '#0F1A10' : '#0D1221',
                border: `1px solid ${plan.tier === 'student' ? '#F2A20C44' : '#1E2A44'}`,
              }}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-jakarta text-[15px] font-bold text-[#F0F4FF]">{plan.label}</span>
                  {plan.badge && (
                    <span className="font-jakarta text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400">
                      {plan.badge}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-jakarta text-[12px] text-[#64748B]">⚡ {plan.credits.toLocaleString()} Tia / tháng</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                  {plan.features.map(f => (
                    <span key={f} className="font-jakarta text-[12px] text-[#64748B]">✓ {f}</span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <span className="font-fraunces text-[16px] font-bold text-[#F0F4FF]">{plan.price}</span>
                {plan.tier !== 'basic' && (
                  <button
                    onClick={user ? () => navigate('/account') : onOpenAuth}
                    className="px-4 py-1.5 rounded-lg font-jakarta text-[12px] font-bold text-[#0A0E1A] hover:opacity-90 transition"
                    style={{ background: '#F2A20C' }}
                  >
                    {user ? 'Nâng cấp ngay' : 'Đăng nhập'}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Top-up packages */}
        <div className="flex flex-col gap-4">
          <span className="font-jakarta text-[13px] font-semibold text-[#94A3B8] text-center">Hoặc nạp thêm Tia</span>
          <div className="flex gap-3 flex-wrap justify-center">
            {TOPUP_PACKAGES.map(pkg => (
              <div key={pkg.price}
                className="flex flex-col items-center gap-1 px-6 py-4 rounded-xl border border-[#1E2A44] bg-[#0D1221]">
                <span className="font-fraunces text-[18px] font-bold text-amber-400">⚡ {pkg.credits}</span>
                <span className="font-jakarta text-[12px] text-[#64748B]">{pkg.price}</span>
              </div>
            ))}
          </div>
          <p className="text-center font-jakarta text-[11px] text-[#2A3A50]">
            Thanh toán: MoMo · VNPay · ZaloPay · Chuyển khoản — Sẽ sớm ra mắt
          </p>
        </div>
      </div>
    </motion.div>
  )
}
