import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { viewNavigate } from '../utils/animations.js'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { useTheme } from '../hooks/useTheme.js'
import VantageLogo from '../components/VantageLogo.jsx'
import HeroTerrain from '../components/motion/HeroTerrain.jsx'

// Vantage v1.4.1 landing — editorial 2-column hero (bản đồ địa hình sống +
// đường leo, via HeroTerrain — a live canvas terrain, cursor-tilt camera,
// hover-for-formula tooltips), sổ tay trắc địa stats, "border-top" feature
// rhythm, book-index FAQ, single-ink CTA panel. Ported from the reference
// mockup at vantage/uploads/hero-redesign-3d.html, including its entrance
// choreography (word-by-word headline stagger, staggered hero fade-ins,
// scroll-reveal on every section, count-up stats) and the closing CTA's
// parallax mountain SVG + climb-path draw-in. Local-only page variant
// (opacity, no y) instead of the shared pageVariants — the sticky header
// below needs to NOT sit inside an ancestor with a `transform` (translateY)
// applied, since any transform value (including translateY(0) at rest)
// creates a new containing block and silently breaks position:sticky.
// Deliberately still not ported: the reference file's URL-driven
// "chế độ năng lực" competency-mode terrain morph (?ham-so=8.5&...) — a
// distinct, much larger feature outside this step's scope.
const EASE = [0.22, 1, 0.36, 1]

const landingPageVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.32, ease: EASE } },
  exit: { opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } },
}

const heroContainerVariants = { hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } } }
const heroFadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } } }
const wordContainerVariants = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
const wordVariants = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } }
const reveal = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } }

const HEADLINE_WORDS = [
  { text: 'Tầm' },
  { text: 'nhìn' },
  { text: 'dẫn đường,', break: true },
  { text: 'vươn', accent: true },
  { text: 'tới', accent: true },
  { text: 'đỉnh', accent: true },
  { text: 'cao.', accent: true },
]

const NAV_LINKS = [
  { label: 'Công cụ', anchor: '#cong-cu' },
  { label: 'Lộ trình', anchor: '#lo-trinh' },
  { label: 'Hỏi đáp', anchor: '#hoi-dap' },
]

const STATS = [
  { target: 40, suffix: '+', label: 'ĐỀ THI THẬT' },
  { target: 63, suffix: '', label: 'TỈNH THÀNH' },
  { target: 1104, suffix: '', label: 'CÂU HỎI' },
]

const FEATURES = [
  { num: 'D·01', title: 'Thi thử đề thật', desc: 'Đề THPT Quốc gia & tuyển sinh lớp 10 từ Bộ GD&ĐT và 63 tỉnh thành.', path: '/exams' },
  { num: 'D·02', title: 'Máy tính CAS', desc: 'Giải toán từng bước, hiển thị công thức trực tiếp trên máy tính.', path: '/calculator' },
  { num: 'D·03', title: 'Đại số tuyến tính', desc: 'Ma trận, định thức, hệ phương trình — giải và kiểm tra ngay.', path: '/linalg' },
  { num: 'D·04', title: 'Math Playground', desc: 'Vẽ đồ thị hàm số, giao điểm, tiếp tuyến bằng lời hoặc thủ công.', path: '/playground' },
]

// FAQ copy matches vantage/uploads/hero-redesign-3d.html verbatim (lines
// 462-480) — the earlier version here drifted into different, shorter copy
// and #2 invented paid tiers ("Học sinh 29.000đ/tháng...") that don't exist
// anywhere in the mockup, which states everything is free. Fixed by using
// the mockup's own copy rather than re-paraphrasing.
const FAQS = [
  { q: 'Vantage có khác gì so với ôn thi thông thường?', a: 'Mỗi đề thi bạn làm là một cột mốc. Hệ thống ghi lại chính xác bạn vấp ở đâu — dạng câu nào, bước nào — rồi vẽ lại lộ trình cho buổi học hôm sau. Điểm số của bạn trở thành một bản đồ địa hình: chuyên đề nào là đồi, chuyên đề nào là đỉnh, và cờ tiếp theo cắm ở chỗ bạn còn yếu.' },
  { q: 'Vantage có mất phí không?', a: 'Không. Toàn bộ đề thi thật, máy tính CAS, đại số tuyến tính và Math Playground đều miễn phí — không cần thẻ, dùng ngay trên trình duyệt.' },
  { q: 'Đề thi trên Vantage có thật không?', a: 'Có. Đề được sưu tầm từ kỳ thi THPT Quốc gia của Bộ GD&ĐT và đề tuyển sinh lớp 10 công lập của 63 tỉnh thành, kèm năm và nguồn rõ ràng tại từng cột mốc.' },
  { q: 'Dùng được cho học sinh lớp 9 thi vào 10 không?', a: 'Được. Vantage có lộ trình riêng cho tuyển sinh lớp 10 — tuyến parabola trên cùng một bản đồ: đề theo từng tỉnh, trọng tâm hàm số, hệ phương trình và hình học phẳng theo cấu trúc đề địa phương bạn chọn.' },
  { q: 'AI có tạo ra câu hỏi thi không?', a: 'Không. AI của Vantage không bịa đề — nó phân tích lỗi sai của bạn trên đề thật, gợi ý câu tương tự từ ngân hàng đề có nguồn, và giải thích từng bước như một người thầy kèm riêng.' },
]

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}
function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )
}

function HeaderThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      className="flex items-center justify-center w-9 h-9 transition-colors"
      style={{ color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'transparent' }}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

// Count-up stat number — animates 0 -> target via easeOutCubic once the
// element scrolls into view (matches the mockup's countUp(), mockup:1124-1139).
// Skips straight to the target under prefers-reduced-motion.
function StatValue({ target, suffix }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.4 })
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!inView) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    let raf
    let start = null
    const dur = 900
    function step(ts) {
      if (start === null) start = ts
      const p = Math.min((ts - start) / dur, 1)
      setValue(Math.round(target * (1 - (1 - p) ** 3)))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [inView, target])

  return <span ref={ref}>{value.toLocaleString('vi-VN')}{suffix}</span>
}

function IconExam() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /><path d="M9 3v-1h6v1" />
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

// Closing CTA — mountain SVG (parallax on cursor, matches mockup's
// .layer-back/.layer-front translate ratios) + an accent "climb" path that
// draws itself in via pathLength once scrolled into view (mockup:487-501,
// 1141-1177). Split out from Landing() so the parallax mousemove handler
// doesn't re-run the whole page's render on every pointer move.
function SummitCTA({ onCta }) {
  const sectionRef = useRef(null)
  const [parallax, setParallax] = useState({ x: 0, y: 0 })

  function handleMove(e) {
    const r = sectionRef.current.getBoundingClientRect()
    setParallax({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 })
  }
  function handleLeave() {
    setParallax({ x: 0, y: 0 })
  }

  return (
    <section
      ref={sectionRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className="flex flex-col items-center gap-4 px-6 py-20 text-center relative overflow-hidden"
      style={{ background: 'var(--summit-bg)' }}
    >
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1200 400"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        style={{ pointerEvents: 'none' }}
      >
        <g
          fill="none" stroke="#F5F2EA" strokeOpacity={0.22}
          style={{ transform: `translate3d(${parallax.x * 10}px, ${parallax.y * 8}px, 0)`, transition: `transform 0.45s ${'cubic-bezier(0.22,1,0.36,1)'}` }}
        >
          <ellipse cx="880" cy="200" rx="120" ry="82" />
          <ellipse cx="880" cy="200" rx="240" ry="164" />
          <ellipse cx="880" cy="200" rx="380" ry="258" />
          <ellipse cx="880" cy="200" rx="540" ry="364" />
        </g>
        <g
          fill="none" stroke="#F5F2EA" strokeOpacity={0.4}
          style={{ transform: `translate3d(${parallax.x * 22}px, ${parallax.y * 16}px, 0)`, transition: `transform 0.45s ${'cubic-bezier(0.22,1,0.36,1)'}` }}
        >
          <ellipse cx="880" cy="200" rx="70" ry="48" />
          <ellipse cx="880" cy="200" rx="160" ry="110" />
        </g>
        <motion.path
          d="M120 380 C 260 350, 340 300, 430 262 S 620 190, 740 150 S 900 78, 960 40"
          stroke="var(--accent)" strokeWidth="2" fill="none"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 1.4, ease: EASE }}
        />
        <path d="M960 40 v-24" stroke="#F5F2EA" strokeWidth="1.5" />
        <path d="M960 16 l14 4.7 -14 4.7 z" fill="var(--accent)" />
      </svg>

      <span className="relative z-10" style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.12em', color: 'rgba(245,242,234,0.5)' }}>
        CỘT MỐC TIẾP THEO LÀ CỦA BẠN
      </span>
      <h2 className="font-display font-bold relative z-10" style={{ fontSize: 30, color: '#F5F2EA' }}>
        Sẵn sàng <span style={{ color: 'var(--accent)' }}>bắt đầu leo?</span>
      </h2>
      <button
        onClick={onCta}
        className="relative z-10 px-6 py-3 text-[14.5px] font-bold"
        style={{ fontFamily: 'var(--font-mono)', background: 'var(--accent)', color: '#F5F2EA', border: '1px solid var(--accent)', borderRadius: 'var(--r-sm)' }}
      >
        VÀO ÔN THI NGAY →
      </button>
    </section>
  )
}

export default function Landing() {
  usePageMeta('', { description: 'Tầm nhìn dẫn đường tri thức — Vantage khai mở hành trình ôn thi Toán cùng AI, với 40+ đề thi thật từ 63 tỉnh thành.' })
  const navigate = useNavigate()
  const goToExams = () => viewNavigate(navigate, '/exams')

  return (
    <motion.div variants={landingPageVariants} initial="hidden" animate="show" exit="exit" className="min-h-screen flex flex-col">
      {/* Marketing header — sticky, logo, section nav, theme toggle, single CTA.
          Only opacity-animated (see landingPageVariants comment) so position:sticky
          keeps working on this ancestor. */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-6 sm:px-10 py-5 gap-4"
        style={{ background: 'color-mix(in srgb, var(--paper) 88%, transparent)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--line-soft)' }}
      >
        <VantageLogo variant="nav" onClick={goToExams} />
        <nav className="hidden sm:flex items-center gap-8 ml-auto" aria-label="Chính">
          {NAV_LINKS.map(link => (
            <a
              key={link.anchor}
              href={link.anchor}
              className="text-[15px] transition-colors"
              style={{ color: 'var(--ink-2)' }}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <HeaderThemeToggle />
          <button
            onClick={goToExams}
            className="px-4 py-2 text-[12.5px] font-bold transition-colors"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--paper)' }}
          >
            VÀO ÔN THI →
          </button>
        </div>
      </header>

      {/* Hero — editorial 2 columns: headline+CTA left, terrain card right.
          Left column staggers in (heroContainerVariants); the headline itself
          nests its own per-word stagger (wordContainerVariants/wordVariants). */}
      <section className="px-6 sm:px-10 pt-8 pb-16 sm:pb-20">
        <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-[1.05fr_.95fr] gap-10 lg:gap-12 items-center">
          <motion.div className="flex flex-col gap-5" data-hero-readzone variants={heroContainerVariants} initial="hidden" animate="show">
            <motion.div variants={heroFadeUp} className="flex items-center gap-3" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.12em', color: 'var(--ink-3)' }}>
              <span style={{ width: 32, height: 1, background: 'var(--accent)', display: 'inline-block' }} />
              ÔN THI TOÁN THPT · TUYỂN SINH 10 · KHÓA 2026
            </motion.div>
            <motion.h1
              variants={wordContainerVariants}
              className="font-display font-bold"
              style={{ fontSize: 'clamp(34px, 5vw, 48px)', lineHeight: 1.08, letterSpacing: '-0.02em', color: 'var(--ink)', maxWidth: '20ch' }}
            >
              {HEADLINE_WORDS.map((w, i) => (
                <motion.span key={i} variants={wordVariants} style={{ display: 'inline-block', color: w.accent ? 'var(--accent)' : undefined }}>
                  {w.text}
                  {w.break ? <br /> : i < HEADLINE_WORDS.length - 1 ? ' ' : null}
                </motion.span>
              ))}
            </motion.h1>
            <motion.p variants={heroFadeUp} className="font-sans" style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--ink-2)', maxWidth: '46ch' }}>
              Đề thi thật từ Bộ GD&amp;ĐT và 63 tỉnh thành. Hai lộ trình — THPT và tuyển sinh lớp 10 — cùng một xuất phát điểm. Bản đồ năng lực của riêng bạn, vẽ bằng điểm số thật.
            </motion.p>
            <motion.div variants={heroFadeUp} className="flex flex-wrap items-center gap-3 mt-1">
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
            </motion.div>
            <motion.p variants={heroFadeUp} style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
              KHÔNG CẦN THẺ · DÙNG NGAY TRÊN TRÌNH DUYỆT · ∫Σ√π∞Δ
            </motion.p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}>
            <HeroTerrain />
          </motion.div>
        </div>
      </section>

      {/* Stats — sổ tay trắc địa ledger line, not a 3-up SaaS stat grid (deliberate
          deviation from the mockup's 3-column bordered grid); count-up + scroll-reveal
          now match the mockup's behavior even though the layout doesn't. */}
      <motion.section
        id="lo-trinh" className="px-6 sm:px-10 pb-16"
        variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }}
      >
        <div className="mx-auto max-w-6xl">
          <div
            className="flex flex-wrap items-baseline gap-x-3 gap-y-2 py-4"
            style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line-soft)', fontFamily: 'var(--font-mono)' }}
          >
            {STATS.map((s, i) => (
              <span key={s.label} className="flex items-baseline gap-x-3">
                {i > 0 && <span style={{ color: 'var(--line)' }} aria-hidden="true">·</span>}
                <span style={{ fontSize: 22, fontWeight: 500, color: 'var(--ink)' }}>
                  <StatValue target={s.target} suffix={s.suffix} />
                </span>
                <span style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--ink-3)' }}>{s.label}</span>
              </span>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Features — border-top rhythm, no uniform cards */}
      <section id="cong-cu" className="px-6 sm:px-10 pb-20">
        <div className="mx-auto max-w-6xl">
          <motion.div
            className="flex items-baseline justify-between mb-8 flex-wrap gap-2"
            variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.6 }}
          >
            <h2 className="font-display font-bold" style={{ fontSize: 28, color: 'var(--ink)' }}>Công cụ đi cùng bạn</h2>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.08em', color: 'var(--ink-3)' }}>
              04 DỤNG CỤ · NHƯ HỘP BÚT CỦA NGƯỜI LEO NÚI
            </span>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => {
              const Icon = ICONS[i]
              return (
                <motion.button
                  key={f.path}
                  onClick={() => viewNavigate(navigate, f.path)}
                  className="group flex flex-col items-start gap-2.5 text-left pt-4 transition-transform hover:-translate-y-[3px]"
                  style={{ borderTop: '2px solid var(--ink)' }}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.5, ease: EASE, delay: i * 0.06 }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>{f.num}</span>
                  <span className="block transition-transform group-hover:translate-x-1">
                    <Icon />
                  </span>
                  <span className="font-display" style={{ fontSize: 19, fontWeight: 500, color: 'var(--ink)' }}>{f.title}</span>
                  <span className="font-sans" style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--ink-2)' }}>{f.desc}</span>
                </motion.button>
              )
            })}
          </div>
        </div>
      </section>

      {/* FAQ — mục lục sách, not accordion default; sec-head layout matches Features'
          left-aligned heading + note, not the previous centered heading. */}
      <section id="hoi-dap" className="px-6 sm:px-10 pb-20">
        <div className="mx-auto max-w-2xl">
          <motion.div
            className="flex items-baseline justify-between mb-8 flex-wrap gap-2"
            variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.6 }}
          >
            <h2 className="font-display font-bold" style={{ fontSize: 28, color: 'var(--ink)' }}>Câu hỏi thường gặp</h2>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.08em', color: 'var(--ink-3)' }}>
              MỤC LỤC · {FAQS.length} MỤC
            </span>
          </motion.div>
          <motion.div variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }}>
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
          </motion.div>
        </div>
      </section>

      <SummitCTA onCta={goToExams} />

      <footer
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-6 sm:px-10 py-6"
        style={{ background: 'var(--summit-bg)', color: 'rgba(245,242,234,0.5)', borderTop: '1px solid rgba(245,242,234,0.12)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.08em' }}
      >
        <span>VANTAGE ▲ · VƯƠN TỚI ĐỈNH CAO</span>
        <span>GIẤY — MỰC — CỜ ĐỈNH · V1.4.1 · ĐỊA HÌNH ĐỘNG · TUYẾN TOÁN HỌC</span>
      </footer>
    </motion.div>
  )
}
