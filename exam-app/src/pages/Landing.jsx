import { useNavigate } from 'react-router-dom'

export default function Landing() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center"
      style={{ background: 'radial-gradient(ellipse 140% 100% at 50% 35%, #1B2B4B 0%, #0A0E1A 100%)' }}>
      {/* Amber glow */}
      <div className="absolute pointer-events-none rounded-full"
        style={{ width: 880, height: 560, left: '50%', top: 100, transform: 'translateX(-50%)',
          background: 'radial-gradient(circle, #F2A20C18 0%, #F2A20C00 100%)' }} />
      <div className="relative z-10 flex flex-col items-center gap-12 text-center px-8">
        {/* Hero text group */}
        <div className="flex flex-col items-center gap-5">
          <span className="font-jakarta text-[11px] font-semibold text-[#F2A20C] tracking-[3px] uppercase">
            Kỳ thi tuyển sinh lớp 10 TP.HCM · 2025–2026
          </span>
          <h1 className="font-fraunces text-[72px] font-bold text-[#F8FAFC] leading-none">
            Luyện thi vào lớp 10 TPHCM
          </h1>
          <p className="font-jakarta text-lg text-[#94A3B8] leading-relaxed max-w-[660px]">
            Ôn tập Toán với đề thi thử từ các nguồn uy tín — phân tích điểm yếu, gợi ý trường phù hợp
          </p>
        </div>
        {/* Buttons */}
        <div className="flex items-center gap-4 flex-wrap justify-center">
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
        </div>
        {/* History link */}
        <button onClick={() => navigate('/history')} className="font-jakarta text-sm text-[#64748B] hover:text-[#94A3B8] transition">
          Xem lịch sử làm bài →
        </button>
        {/* Stats row */}
        <div className="flex gap-5">
          {[
            { value: '10+', label: 'đề thi thử', color: '#F2A20C' },
            { value: '300+', label: 'câu hỏi', color: '#F2A20C' },
            { value: 'AI', label: 'Phân tích', color: '#10B981' },
          ].map(({ value, label, color }) => (
            <div key={label} className="flex flex-col items-center gap-2 bg-[#141D2E] border border-[#2A3A5E] rounded-xl py-5 px-9">
              <span className="font-fraunces text-[32px] font-bold" style={{ color }}>{value}</span>
              <span className="font-jakarta text-[13px] text-[#94A3B8]">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
