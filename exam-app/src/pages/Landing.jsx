import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { pageVariants, listVariants, itemVariants } from '../utils/animations.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import { useAuth } from '../context/AuthContext.jsx'

const PLANS_MONTHLY = [
  { tier: 'basic', label: 'Cơ bản', price: 'Miễn phí', credits: 50, studyPlan: false },
  { tier: 'student', label: 'Học sinh', price: '29,000đ / tháng', credits: 500, studyPlan: true, badge: 'PHỔ BIẾN' },
  { tier: 'complete', label: 'Toàn diện', price: '59,000đ / tháng', credits: 2000, studyPlan: true },
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
  const [dueCount, setDueCount] = useState(0)

  useEffect(() => { setDueCount(getDueCount()) }, [])

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
        className="relative z-10 flex flex-col items-center gap-12 text-center px-8 pt-20 pb-16 w-full"
        variants={listVariants}
        initial="hidden"
        animate="show"
      >
        <div className="flex flex-col items-center gap-5">
          <motion.span variants={itemVariants} className="font-jakarta text-[11px] font-semibold text-[#F2A20C] tracking-[3px] uppercase">
            Toán lớp 10 · Đề thi Việt Nam &amp; Quốc tế
          </motion.span>
          <motion.h1 variants={itemVariants} className="font-fraunces text-[64px] sm:text-[72px] font-bold text-[#F8FAFC] leading-none">
            Luyện thi vào lớp 10
          </motion.h1>
          <motion.p variants={itemVariants} className="font-jakarta text-lg text-[#94A3B8] leading-relaxed max-w-[660px]">
            Ôn tập Toán với 40+ đề thi Việt Nam &amp; quốc tế — AI phân tích kết quả, gợi ý ôn luyện và trường phù hợp
          </motion.p>
        </div>

        {/* CTA buttons */}
        <motion.div variants={itemVariants} className="flex items-center gap-4 flex-wrap justify-center">
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/exams')}
            className="px-10 py-3.5 bg-[#F2A20C] text-[#0A0E1A] font-jakarta font-bold text-base rounded-lg hover:opacity-90 transition"
          >
            Thi thử
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/exams?mode=practice')}
            className="px-10 py-3.5 border border-[#F2A20C] text-[#F2A20C] font-jakarta font-semibold text-base rounded-lg hover:bg-[#F2A20C]/10 transition"
          >
            Luyện tập
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/oracle')}
            className="px-10 py-3.5 border border-[#6366F1] text-[#6366F1] font-jakarta font-semibold text-base rounded-lg hover:bg-[#6366F1]/10 transition flex items-center gap-2"
          >
            <span>✦</span>Toán Oracle
          </motion.button>
        </motion.div>

        {/* Review badge + history link */}
        <motion.div variants={itemVariants} className="flex items-center gap-4 flex-wrap justify-center">
          {dueCount > 0 && (
            <motion.button
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/review')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#6366F144] font-jakarta text-[13px] font-semibold text-[#6366F1] hover:bg-[#6366F1]/10 transition"
            >
              <span className="w-2 h-2 rounded-full bg-[#6366F1] animate-pulse" />
              Ôn tập hôm nay ({dueCount} câu)
            </motion.button>
          )}
          <button onClick={() => navigate('/history')} className="font-jakarta text-sm text-[#64748B] hover:text-[#94A3B8] transition">
            Xem lịch sử làm bài →
          </button>
        </motion.div>

        {/* Stats */}
        <motion.div variants={itemVariants} className="flex gap-4 flex-wrap justify-center">
          {[
            { value: '40+', label: 'đề thi', color: '#F2A20C' },
            { value: '1,000+', label: 'câu hỏi', color: '#F2A20C' },
            { value: 'AI', label: 'Phân tích', color: '#10B981' },
          ].map(({ value, label, color }) => (
            <motion.div
              key={label}
              whileHover={{ scale: 1.05 }}
              className="flex flex-col items-center gap-2 bg-[#141D2E] border border-[#2A3A5E] rounded-xl py-5 px-8 cursor-default"
            >
              <span className="font-fraunces text-[32px] font-bold" style={{ color }}>{value}</span>
              <span className="font-jakarta text-[13px] text-[#94A3B8]">{label}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Pricing section */}
      <div className="relative z-10 w-full max-w-3xl mx-auto px-6 pb-24 flex flex-col gap-10">
        <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, #1E2A44, transparent)' }} />

        <div className="flex flex-col items-center gap-3 text-center">
          <span className="font-fraunces text-[28px] font-bold text-[#F8FAFC]">Gói dịch vụ</span>
          <p className="font-jakarta text-[14px] text-[#64748B]">Bắt đầu miễn phí · Nâng cấp bất kỳ lúc nào</p>
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
              className="flex items-center justify-between gap-4 px-6 py-5 rounded-2xl border transition-all cursor-default"
              style={{
                background: plan.tier === 'student' ? '#0F1A10' : '#0D1221',
                border: `1px solid ${plan.tier === 'student' ? '#F2A20C44' : '#1E2A44'}`,
              }}
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-jakarta text-[15px] font-bold text-[#F0F4FF]">{plan.label}</span>
                  {plan.badge && (
                    <span className="font-jakarta text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400">
                      {plan.badge}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-jakarta text-[13px] text-[#64748B]">⚡ {plan.credits.toLocaleString()} AI Điểm / tháng</span>
                  {plan.studyPlan && <span className="font-jakarta text-[12px] text-emerald-400">✓ Kế hoạch học</span>}
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
                    {user ? 'Nâng cấp ngay' : 'Đăng nhập để bắt đầu'}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Top-up packages */}
        <div className="flex flex-col gap-4">
          <span className="font-jakarta text-[13px] font-semibold text-[#94A3B8] text-center">Hoặc mua thêm AI Điểm</span>
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
