import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
}
const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

export default function Landing() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center"
      style={{ background: 'radial-gradient(ellipse 140% 100% at 50% 35%, #1B2B4B 0%, #0A0E1A 100%)' }}>
      {/* Amber glow */}
      <div className="absolute pointer-events-none rounded-full"
        style={{ width: 880, height: 560, left: '50%', top: 100, transform: 'translateX(-50%)',
          background: 'radial-gradient(circle, #F2A20C18 0%, #F2A20C00 100%)' }} />
      <motion.div
        className="relative z-10 flex flex-col items-center gap-12 text-center px-8"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {/* Hero text group */}
        <div className="flex flex-col items-center gap-5">
          <motion.span variants={item} className="font-jakarta text-[11px] font-semibold text-[#F2A20C] tracking-[3px] uppercase">
            Toán lớp 10 · Đề thi Việt Nam & Quốc tế
          </motion.span>
          <motion.h1 variants={item} className="font-fraunces text-[72px] font-bold text-[#F8FAFC] leading-none">
            Luyện thi vào lớp 10
          </motion.h1>
          <motion.p variants={item} className="font-jakarta text-lg text-[#94A3B8] leading-relaxed max-w-[660px]">
            Ôn tập Toán với đề thi từ các tỉnh thành và kỳ thi quốc tế uy tín — AI phân tích kết quả, gợi ý trường phù hợp
          </motion.p>
        </div>
        {/* Buttons */}
        <motion.div variants={item} className="flex items-center gap-4 flex-wrap justify-center">
          <button onClick={() => navigate('/exams')}
            className="px-10 py-3.5 bg-[#F2A20C] text-[#0A0E1A] font-jakarta font-bold text-base rounded-lg hover:opacity-90 transition">
            Thi thử
          </button>
          <button onClick={() => navigate('/exams?mode=practice')}
            className="px-10 py-3.5 border border-[#F2A20C] text-[#F2A20C] font-jakarta font-semibold text-base rounded-lg hover:bg-[#F2A20C]/10 transition">
            Luyện tập
          </button>
          <button onClick={() => navigate('/oracle')}
            className="px-10 py-3.5 border border-[#6366F1] text-[#6366F1] font-jakarta font-semibold text-base rounded-lg hover:bg-[#6366F1]/10 transition flex items-center gap-2">
            <span>✦</span>
            Toán Oracle
          </button>
        </motion.div>
        {/* History link */}
        <motion.button variants={item} onClick={() => navigate('/history')} className="font-jakarta text-sm text-[#64748B] hover:text-[#94A3B8] transition">
          Xem lịch sử làm bài →
        </motion.button>
        {/* Stats row */}
        <motion.div variants={item} className="flex gap-5">
          {[
            { value: '10', label: 'đề thi', color: '#F2A20C' },
            { value: '200', label: 'câu hỏi', color: '#F2A20C' },
            { value: 'AI', label: 'Phân tích', color: '#10B981' },
          ].map(({ value, label, color }) => (
            <div key={label} className="flex flex-col items-center gap-2 bg-[#141D2E] border border-[#2A3A5E] rounded-xl py-5 px-9">
              <span className="font-fraunces text-[32px] font-bold" style={{ color }}>{value}</span>
              <span className="font-jakarta text-[13px] text-[#94A3B8]">{label}</span>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}
