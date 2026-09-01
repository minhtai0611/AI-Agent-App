import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { pageVariants, viewNavigate } from '../utils/animations.js'
import { usePageMeta } from '../hooks/usePageMeta.js'
import VantageLogo from '../components/VantageLogo.jsx'
import HeroTerrain from '../components/motion/HeroTerrain.jsx'

// Vantage v1.4.1 landing — editorial 2-column hero (bản đồ địa hình sống +
// đường leo, via HeroTerrain — a live canvas terrain, cursor-tilt camera,
// hover-for-formula tooltips), sổ tay trắc địa stats, "border-top" feature
// rhythm, book-index FAQ, single-ink CTA panel. The hero previously shipped
// a static two-peak SVG illustration (follow-up noted in that pass's
// report); HeroTerrain replaces it with the real engine ported into
// src/lib/terrain3d.js, reused later by /linalg for "ma trận là địa hình".
// Deliberately still not ported: the reference file's URL-driven
// "chế độ năng lực" competency-mode terrain morph (?ham-so=8.5&...) — a
// distinct, much larger feature outside this step's scope.
const STATS = [
  { value: '40+', label: 'ĐỀ THI THẬT' },
  { value: '63', label: 'TỈNH THÀNH' },
  { value: '1.104', label: 'CÂU HỎI' },
]

const FEATURES = [
  { num: 'D·01', title: 'Thi thử đề thật', desc: 'Đề THPT Quốc gia & tuyển sinh lớp 10 từ Bộ GD&ĐT và 63 tỉnh thành.', path: '/exams' },
  { num: 'D·02', title: 'Máy tính CAS', desc: 'Giải toán từng bước, hiển thị công thức trực tiếp trên máy tính.', path: '/calculator' },
  { num: 'D·03', title: 'Đại số tuyến tính', desc: 'Ma trận, định thức, hệ phương trình — giải và kiểm tra ngay.', path: '/linalg' },
  { num: 'D·04', title: 'Math Playground', desc: 'Vẽ đồ thị hàm số, giao điểm, tiếp tuyến bằng lời hoặc thủ công.', path: '/playground' },
]

const FAQS = [
  { q: 'Vantage có khác gì so với ôn thi thông thường?', a: 'AI tìm ra lỗi sai cụ thể trong bài làm và đề xuất bài luyện phù hợp — không chỉ chấm điểm như các nền tảng thông thường.' },
  { q: 'Vantage có mất phí không?', a: 'Miễn phí hoàn toàn để bắt đầu. Có thể nâng cấp lên gói Học sinh (29.000đ/tháng) hoặc Toàn diện (59.000đ/tháng) bất kỳ lúc nào.' },
  { q: 'Đề thi trên Vantage có thật không?', a: 'Có — 1.104 câu hỏi từ đề thi chính thức của Bộ GD&ĐT và 63 tỉnh thành. Không có câu hỏi do AI tạo ra.' },
  { q: 'Vantage dùng được cho học sinh lớp 9 thi vào lớp 10 không?', a: 'Có — Vantage bao gồm đề tuyển sinh lớp 10 từ các tỉnh thành trên toàn quốc.' },
  { q: 'AI có tạo ra câu hỏi thi không?', a: 'Không. Tất cả câu hỏi đều từ đề thi thật từ nguồn chính thức. AI chỉ dùng để phân tích kết quả và cá nhân hóa lộ trình học.' },
]

function IconExam() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  )
}
function IconCalc() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="2" width="12" height="20" rx="2" /><rect x="9" y="5" width="6" height="3" rx="0.5" />
      <path d="M9 12h1M12 12h1M15 12h1M9 15h1M12 15h1M15 15h1M9 18h4M15 18h1" />
    </svg>
  )
}
function IconMatrix() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4v16M20 4v16" /><path d="M8 7h3M13 7h3M8 12h3M13 12h3M8 17h3M13 17h3" />
    </svg>
  )
}
function IconPlot() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21h18M3 21V3" /><path d="M5 16C8 16 8 8 12 8s4 6 7 6" stroke="var(--accent)" />
      <circle cx="12" cy="8" r="1.4" fill="var(--accent)" stroke="none" />
    </svg>
  )
}
const ICONS = [IconExam, IconCalc, IconMatrix, IconPlot]

export default function Landing() {
  usePageMeta('', { description: 'Tầm nhìn dẫn đường tri thức — Vantage khai mở hành trình ôn thi Toán cùng AI, với 40+ đề thi thật từ 63 tỉnh thành.' })
  const navigate = useNavigate()
  const goToExams = () => viewNavigate(navigate, '/exams')

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show" exit="exit" className="min-h-screen flex flex-col">
      {/* Minimal marketing header — no app nav tabs, single CTA */}
      <header className="flex items-center justify-between px-6 sm:px-10 py-5 relative z-10">
        <VantageLogo variant="nav" onClick={goToExams} />
        <button
          onClick={goToExams}
          className="px-4 py-2 text-[12.5px] font-bold transition-colors"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--paper)' }}
        >
          VÀO ÔN THI →
        </button>
      </header>

      {/* Hero — editorial 2 columns: headline+CTA left, terrain card right */}
      <section className="px-6 sm:px-10 pt-8 pb-16 sm:pb-20">
        <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-[1.05fr_.95fr] gap-10 lg:gap-12 items-center">
          <div className="flex flex-col gap-5" data-hero-readzone>
            <div className="flex items-center gap-3" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.12em', color: 'var(--ink-3)' }}>
              <span style={{ width: 32, height: 1, background: 'var(--accent)', display: 'inline-block' }} />
              ÔN THI TOÁN THPT · TUYỂN SINH 10 · KHÓA 2026
            </div>
            <h1
              className="font-display font-bold"
              style={{ fontSize: 'clamp(34px, 5vw, 48px)', lineHeight: 1.08, letterSpacing: '-0.02em', color: 'var(--ink)', maxWidth: '20ch' }}
            >
              Tầm nhìn dẫn đường, <span style={{ color: 'var(--accent)' }}>vươn tới đỉnh cao.</span>
            </h1>
            <p className="font-sans" style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--ink-2)', maxWidth: '46ch' }}>
              Vantage khai mở hành trình ôn thi Toán cùng AI — đề thi thật, phân tích lỗi sai, lộ trình học riêng cho từng học sinh THPT &amp; lớp 10.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <button
                onClick={goToExams}
                className="px-6 py-3 text-[14.5px] font-bold transition-colors"
                style={{ fontFamily: 'var(--font-mono)', background: 'var(--accent)', color: 'var(--paper)', border: '1px solid var(--accent)', borderRadius: 'var(--r-sm)' }}
              >
                BẮT ĐẦU ÔN THI MIỄN PHÍ →
              </button>
              <button
                onClick={() => viewNavigate(navigate, '/playground')}
                className="px-6 py-3 text-[14.5px] font-bold transition-colors"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'transparent' }}
              >
                XEM CÔNG CỤ
              </button>
            </div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
              KHÔNG CẦN THẺ · DÙNG NGAY TRÊN TRÌNH DUYỆT · ∫Σ√π∞Δ
            </p>
          </div>
          <HeroTerrain />
        </div>
      </section>

      {/* Stats — sổ tay trắc địa ledger line, not a 3-up SaaS stat grid */}
      <section className="px-6 sm:px-10 pb-16">
        <div className="mx-auto max-w-6xl">
          <div
            className="flex flex-wrap items-baseline gap-x-3 gap-y-2 py-4"
            style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line-soft)', fontFamily: 'var(--font-mono)' }}
          >
            {STATS.map((s, i) => (
              <span key={s.label} className="flex items-baseline gap-x-3">
                {i > 0 && <span style={{ color: 'var(--line)' }} aria-hidden="true">·</span>}
                <span style={{ fontSize: 22, fontWeight: 500, color: 'var(--ink)' }}>{s.value}</span>
                <span style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--ink-3)' }}>{s.label}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features — border-top rhythm, no uniform cards */}
      <section className="px-6 sm:px-10 pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-baseline justify-between mb-8 flex-wrap gap-2">
            <h2 className="font-display font-bold" style={{ fontSize: 28, color: 'var(--ink)' }}>Công cụ đi cùng bạn</h2>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.08em', color: 'var(--ink-3)' }}>
              04 DỤNG CỤ · NHƯ HỘP BÚT CỦA NGƯỜI LEO NÚI
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => {
              const Icon = ICONS[i]
              return (
                <button
                  key={f.path}
                  onClick={() => viewNavigate(navigate, f.path)}
                  className="flex flex-col items-start gap-2.5 text-left pt-4 transition-transform hover:-translate-y-[3px]"
                  style={{ borderTop: '2px solid var(--ink)' }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>{f.num}</span>
                  <Icon />
                  <span className="font-display" style={{ fontSize: 19, fontWeight: 500, color: 'var(--ink)' }}>{f.title}</span>
                  <span className="font-sans" style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--ink-2)' }}>{f.desc}</span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* FAQ — mục lục sách, not accordion default */}
      <section className="px-6 sm:px-10 pb-20">
        <div className="mx-auto max-w-2xl">
          <h2 className="font-display font-bold text-center mb-6" style={{ fontSize: 28, color: 'var(--ink)' }}>Câu hỏi thường gặp</h2>
          <div>
            {FAQS.map((f, i) => (
              <details
                key={f.q}
                open={i === 0}
                className="group"
                style={{ borderTop: '1px solid var(--line)', borderBottom: i === FAQS.length - 1 ? '1px solid var(--line)' : 'none' }}
              >
                <summary
                  className="grid items-center py-4 cursor-pointer list-none"
                  style={{ gridTemplateColumns: '40px 1fr 24px' }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-3)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="font-display" style={{ fontSize: 17, color: 'var(--ink)' }}>{f.q}</span>
                  <span
                    className="transition-transform group-open:rotate-45 text-right"
                    style={{ color: 'var(--accent)', fontSize: 18 }}
                  >
                    +
                  </span>
                </summary>
                <p className="pb-4 font-sans" style={{ gridColumn: 2, marginLeft: 40, maxWidth: '64ch', fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-2)' }}>
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA — the single ink panel of the page */}
      <section
        className="flex flex-col items-center gap-4 px-6 py-20 text-center relative overflow-hidden"
        style={{ background: 'var(--summit-bg)' }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.12em', color: 'rgba(245,242,234,0.5)' }}>
          CỘT MỐC TIẾP THEO LÀ CỦA BẠN
        </span>
        <h2 className="font-display font-bold relative z-10" style={{ fontSize: 30, color: '#F5F2EA' }}>
          Sẵn sàng <span style={{ color: 'var(--accent)' }}>bắt đầu leo?</span>
        </h2>
        <button
          onClick={goToExams}
          className="relative z-10 px-6 py-3 text-[14.5px] font-bold"
          style={{ fontFamily: 'var(--font-mono)', background: 'var(--accent)', color: '#F5F2EA', border: '1px solid var(--accent)', borderRadius: 'var(--r-sm)' }}
        >
          VÀO ÔN THI NGAY →
        </button>
      </section>
    </motion.div>
  )
}
