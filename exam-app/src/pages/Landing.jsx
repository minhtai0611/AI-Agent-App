import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { pageVariants, viewNavigate } from '../utils/animations.js'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { Reveal3D } from '../components/motion/Reveal3D.jsx'
import { Scene3DLazy } from '../components/motion/Scene3DLazy.jsx'
import VantageLogo from '../components/VantageLogo.jsx'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../components/ui/accordion.jsx'

// Stat pills + FAQ content below are reused verbatim from the SEO-audited
// SoftwareApplication/FAQPage JSON-LD in index.html, so the visible page and
// the structured data never drift out of sync — no invented marketing claims.
const STATS = [
  { value: '40+', label: 'đề thi thật' },
  { value: '63', label: 'tỉnh thành' },
  { value: '1.104', label: 'câu hỏi' },
]

const FEATURES = [
  { icon: '📋', title: 'Thi thử đề thật', desc: 'Đề THPT Quốc gia & tuyển sinh lớp 10 từ Bộ GD&ĐT và 63 tỉnh thành.', path: '/exams' },
  { icon: '🧮', title: 'Máy tính CAS', desc: 'Giải toán từng bước, hiển thị công thức trực tiếp trên máy tính.', path: '/calculator' },
  { icon: '🔢', title: 'Đại số tuyến tính', desc: 'Ma trận, định thức, hệ phương trình — giải và kiểm tra ngay.', path: '/linalg' },
  { icon: '📈', title: 'Math Playground', desc: 'Vẽ đồ thị hàm số, giao điểm, tiếp tuyến bằng lời hoặc thủ công.', path: '/playground' },
]

const FAQS = [
  { q: 'Vantage có khác gì so với ôn thi thông thường?', a: 'AI tìm ra lỗi sai cụ thể trong bài làm và đề xuất bài luyện phù hợp — không chỉ chấm điểm như các nền tảng thông thường.' },
  { q: 'Vantage có mất phí không?', a: 'Miễn phí hoàn toàn để bắt đầu. Có thể nâng cấp lên gói Học sinh (29.000đ/tháng) hoặc Toàn diện (59.000đ/tháng) bất kỳ lúc nào.' },
  { q: 'Đề thi trên Vantage có thật không?', a: 'Có — 1.104 câu hỏi từ đề thi chính thức của Bộ GD&ĐT và 63 tỉnh thành. Không có câu hỏi do AI tạo ra.' },
  { q: 'Vantage dùng được cho học sinh lớp 9 thi vào lớp 10 không?', a: 'Có — Vantage bao gồm đề tuyển sinh lớp 10 từ các tỉnh thành trên toàn quốc.' },
  { q: 'AI có tạo ra câu hỏi thi không?', a: 'Không. Tất cả câu hỏi đều từ đề thi thật từ nguồn chính thức. AI chỉ dùng để phân tích kết quả và cá nhân hóa lộ trình học.' },
]

function StaticRippleFallback() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <circle key={i} cx="200" cy="150" r={i * 26} fill="none" stroke="#8B5CF6" strokeWidth="1" opacity={0.1} />
      ))}
    </svg>
  )
}

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
          className="px-4 py-2 rounded-full font-sans text-[0.8125rem] font-semibold bg-primary text-primary-fg hover:opacity-90 transition"
        >
          Vào ôn thi
        </button>
      </header>

      {/* Hero — real computed math surface as the glowing centerpiece, an
          italic Fraunces emphasis phrase per the KAGAKU headline technique */}
      <section className="relative flex flex-col items-center text-center px-6 pb-16" style={{ paddingTop: 240 }}>
        {/* Glowing math-surface "crown" sits above the headline, not behind
            it — keeps the wireframe from crossing running text. */}
        <div
          className="absolute"
          style={{ pointerEvents: 'none', zIndex: 0, top: 0, left: '50%', transform: 'translateX(-50%)', width: 480, height: 220 }}
        >
          <Scene3DLazy
            scene={() => import('../components/motion/scenes/ExamSelectHeroScene.jsx')}
            fallback={<StaticRippleFallback />}
          />
        </div>
        <Reveal3D variant="tilt" amount={0.3} className="relative flex flex-col items-center gap-5 max-w-2xl" style={{ zIndex: 10 }}>
          <h1 className="font-display text-[40px] sm:text-[56px] font-bold leading-tight text-foreground">
            Tầm nhìn dẫn đường,{' '}
            <em className="text-gradient-brand">vươn tới đỉnh cao</em>
          </h1>
          <p className="font-sans text-base sm:text-lg text-dim max-w-xl">
            Vantage khai mở hành trình ôn thi Toán cùng AI — đề thi thật, phân tích lỗi sai, lộ trình học riêng cho từng học sinh THPT &amp; lớp 10.
          </p>
          <button
            onClick={goToExams}
            className="px-7 py-3.5 rounded-full font-sans text-[15px] font-bold bg-primary text-primary-fg hover:opacity-90 transition"
          >
            Bắt đầu ôn thi miễn phí
          </button>
        </Reveal3D>
      </section>

      {/* Stat pills — real numbers, same as the SoftwareApplication JSON-LD */}
      <section className="flex justify-center px-6 pb-16">
        <Reveal3D variant="rise" className="flex flex-wrap justify-center gap-4">
          {STATS.map(s => (
            <div key={s.label} className="glass-base rounded-2xl px-8 py-5 flex flex-col items-center gap-1 min-w-[140px]">
              <span className="font-display text-[28px] font-bold text-gradient-brand">{s.value}</span>
              <span className="font-sans text-[0.8125rem] text-dim">{s.label}</span>
            </div>
          ))}
        </Reveal3D>
      </section>

      {/* Feature grid — real product surfaces, not decorative teasers */}
      <section className="px-6 sm:px-10 pb-20 max-w-5xl mx-auto w-full">
        <h2 className="font-display text-[26px] font-bold text-foreground text-center mb-8">Công cụ đi cùng bạn</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(f => (
            <Reveal3D key={f.path} variant="rise" as="button" onClick={() => viewNavigate(navigate, f.path)}
              className="glass-base rounded-2xl p-6 flex flex-col items-start gap-2.5 text-left hover:border-primary/40 border border-transparent transition"
            >
              <span className="text-[28px]">{f.icon}</span>
              <span className="font-sans text-[15px] font-semibold text-foreground">{f.title}</span>
              <span className="font-sans text-[0.8125rem] text-dim leading-relaxed">{f.desc}</span>
            </Reveal3D>
          ))}
        </div>
      </section>

      {/* FAQ — same 5 Q&As as the FAQPage JSON-LD, now visible on-page */}
      <section className="px-6 sm:px-10 pb-20 max-w-2xl mx-auto w-full">
        <h2 className="font-display text-[26px] font-bold text-foreground text-center mb-6">Câu hỏi thường gặp</h2>
        <Reveal3D variant="rise">
          <Accordion type="single" collapsible>
            {FAQS.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="font-sans text-[15px] text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="font-sans text-[0.875rem] leading-relaxed">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal3D>
      </section>

      {/* Closing CTA */}
      <section className="flex flex-col items-center gap-4 px-6 pb-20 text-center">
        <h2 className="font-display text-[28px] font-bold text-foreground">Sẵn sàng bắt đầu?</h2>
        <button
          onClick={goToExams}
          className="px-7 py-3.5 rounded-full font-sans text-[15px] font-bold bg-primary text-primary-fg hover:opacity-90 transition"
        >
          Vào ôn thi ngay
        </button>
      </section>
    </motion.div>
  )
}
