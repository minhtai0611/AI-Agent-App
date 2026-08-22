import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, useScroll, useTransform, useInView } from 'framer-motion'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { useGsapTimeline } from '../hooks/useGsapTimeline.js'
import { useTilt3D } from '../hooks/useTilt3D.js'
import { Scene3DLazy } from '../components/motion/Scene3DLazy.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select.jsx'
import VantageLogo from '../components/VantageLogo.jsx'
import { NumberTicker } from '../components/ui/number-ticker.jsx'

const VN_PROVINCES = ['An Giang','Bà Rịa - Vũng Tàu','Bắc Giang','Bắc Kạn','Bạc Liêu','Bắc Ninh','Bến Tre','Bình Định','Bình Dương','Bình Phước','Bình Thuận','Cà Mau','Cần Thơ','Cao Bằng','Đà Nẵng','Đắk Lắk','Đắk Nông','Điện Biên','Đồng Nai','Đồng Tháp','Gia Lai','Hà Giang','Hà Nam','Hà Nội','Hà Tĩnh','Hải Dương','Hải Phòng','Hậu Giang','Hòa Bình','Hưng Yên','Khánh Hòa','Kiên Giang','Kon Tum','Lai Châu','Lâm Đồng','Lạng Sơn','Lào Cai','Long An','Nam Định','Nghệ An','Ninh Bình','Ninh Thuận','Phú Thọ','Phú Yên','Quảng Bình','Quảng Nam','Quảng Ngãi','Quảng Ninh','Quảng Trị','Sóc Trăng','Sơn La','Tây Ninh','Thái Bình','Thái Nguyên','Thanh Hóa','Thừa Thiên Huế','Tiền Giang','TP. Hồ Chí Minh','Trà Vinh','Tuyên Quang','Vĩnh Long','Vĩnh Phúc','Yên Bái']

const TESTIMONIALS = [
  { name: 'Nguyễn Minh Anh', grade: 'Lớp 12 · Hà Nội', result: 'Đạt 8.0 Toán THPT 2024', quote: 'AI giải thích từng bước rõ ràng hơn sách giáo khoa. Mình hiểu bản chất, không chỉ nhớ công thức.' },
  { name: 'Trần Thảo Linh', grade: 'Lớp 9 · TP.HCM', result: 'Đỗ THPT Chuyên Lê Hồng Phong', quote: 'AI chỉ đúng điểm yếu của mình là Hình học. Luyện đúng chỗ, tiết kiệm thời gian hơn nhiều.' },
  { name: 'Phạm Đức Huy', grade: 'Lớp 11 · Đà Nẵng', result: 'Tăng từ 5.5 lên 7.5 trong 2 tháng', quote: 'Thích nhất là thấy được mình đang ở đâu so với học sinh cùng tỉnh. Tạo động lực học hẳn.' },
  { name: 'Lê Thu Hương', grade: 'Lớp 12 · Cần Thơ', result: 'Điểm Toán tăng 1.5 điểm', quote: 'Kế hoạch học cá nhân hoá thật sự hữu ích. Mỗi tuần biết mình cần ôn cái gì, không bị lạc hướng.' },
  { name: 'Ngô Bảo Long', grade: 'Lớp 10 · Hải Phòng', result: 'Top 10% thi thử', quote: 'Làm đề thật từ Hải Phòng là lợi thế lớn. Vantage cho mình cảm giác đang luyện đúng kỳ thi thật.' },
  { name: 'Vũ Thị Mai', grade: 'Lớp 9 · Hà Nội', result: 'Vào THPT Chuyên Ngữ', quote: 'Gợi ý AI khi làm bài giúp mình hiểu bản chất chứ không chỉ học thuộc.' },
]

const PLANS_MONTHLY = [
  {
    tier: 'basic', label: 'Thử miễn phí', price: 'Miễn phí', credits: 50,
    features: ['1 đề thi mỗi cấp độ', 'Thử thách hằng ngày', '⚗ Bản đồ khái niệm'],
  },
  {
    tier: 'student', label: 'Học sinh', price: '29,000đ / tháng', credits: 500, badge: '⭐ 95% học sinh chọn',
    features: ['AI Phân tích miễn phí', '3 đề thi mỗi cấp độ', '⚗ Lab AI đầy đủ', 'Thưởng chuỗi học', 'Kế hoạch học'],
  },
  {
    tier: 'complete', label: '8.5+ Nâng cao', price: '59,000đ / tháng', credits: 2000,
    features: ['Tất cả gói Học sinh', 'Tất cả đề thi thử & luyện tập', '⚗ Tạo đề AI riêng', 'Dự đoán điểm số', 'So sánh tỉnh thành'],
  },
]

// Precomputed static star field — no runtime Math.random()
// Two layers: base (many dim stars) + twinkle (few bright, animated)
const STAR_SHADOWS_DESKTOP =
  '10px 34px 0 0 rgba(255,255,255,0.71),' +
  '156px 18px 0 0 rgba(255,255,255,0.54),' +
  '298px 67px 0 0 rgba(255,255,255,0.83),' +
  '445px 23px 0 0 rgba(255,255,255,0.61),' +
  '589px 78px 0 0 rgba(255,255,255,0.47),' +
  '712px 45px 0 0 rgba(255,255,255,0.76),' +
  '867px 12px 0 0 rgba(255,255,255,0.58),' +
  '1023px 89px 0 0 rgba(255,255,255,0.69),' +
  '1134px 34px 0 0 rgba(255,255,255,0.44),' +
  '1278px 56px 0 0 rgba(255,255,255,0.82),' +
  '1412px 21px 0 0 rgba(255,255,255,0.63),' +
  '1567px 78px 0 0 rgba(255,255,255,0.51),' +
  '67px 145px 0 0 rgba(255,255,255,0.67),' +
  '189px 178px 0 0 rgba(255,255,255,0.49),' +
  '334px 134px 0 0 rgba(255,255,255,0.78),' +
  '478px 212px 0 0 rgba(255,255,255,0.55),' +
  '623px 156px 0 0 rgba(255,255,255,0.72),' +
  '756px 234px 0 0 rgba(255,255,255,0.43),' +
  '901px 167px 0 0 rgba(255,255,255,0.86),' +
  '1045px 198px 0 0 rgba(255,255,255,0.57),' +
  '1189px 143px 0 0 rgba(255,255,255,0.68),' +
  '1323px 267px 0 0 rgba(255,255,255,0.45),' +
  '1467px 189px 0 0 rgba(255,255,255,0.73),' +
  '23px 312px 0 0 rgba(255,255,255,0.53),' +
  '145px 356px 0 0 rgba(255,255,255,0.74),' +
  '289px 289px 0 0 rgba(255,255,255,0.41),' +
  '434px 412px 0 0 rgba(255,255,255,0.67),' +
  '578px 334px 0 0 rgba(255,255,255,0.58),' +
  '723px 378px 0 0 rgba(255,255,255,0.81),' +
  '867px 312px 0 0 rgba(255,255,255,0.46),' +
  '1012px 456px 0 0 rgba(255,255,255,0.69),' +
  '1156px 389px 0 0 rgba(255,255,255,0.52),' +
  '1301px 312px 0 0 rgba(255,255,255,0.77),' +
  '1445px 434px 0 0 rgba(255,255,255,0.43),' +
  '89px 512px 0 0 rgba(255,255,255,0.65),' +
  '212px 556px 0 0 rgba(255,255,255,0.48),' +
  '356px 489px 0 0 rgba(255,255,255,0.79),' +
  '501px 623px 0 0 rgba(255,255,255,0.54),' +
  '645px 545px 0 0 rgba(255,255,255,0.71),' +
  '790px 612px 0 0 rgba(255,255,255,0.42),' +
  '934px 568px 0 0 rgba(255,255,255,0.83),' +
  '1078px 634px 0 0 rgba(255,255,255,0.56),' +
  '1223px 489px 0 0 rgba(255,255,255,0.68),' +
  '1367px 578px 0 0 rgba(255,255,255,0.47),' +
  '1512px 634px 0 0 rgba(255,255,255,0.75),' +
  '34px 712px 0 0 rgba(255,255,255,0.61),' +
  '178px 756px 0 0 rgba(255,255,255,0.44),' +
  '323px 801px 0 0 rgba(255,255,255,0.78),' +
  '467px 734px 0 0 rgba(255,255,255,0.52),' +
  '612px 812px 0 0 rgba(255,255,255,0.67),' +
  '756px 756px 0 0 rgba(255,255,255,0.41),' +
  '901px 834px 0 0 rgba(255,255,255,0.73),' +
  '1045px 778px 0 0 rgba(255,255,255,0.58),' +
  '1190px 856px 0 0 rgba(255,255,255,0.45),' +
  '1334px 712px 0 0 rgba(255,255,255,0.80),' +
  '1478px 789px 0 0 rgba(255,255,255,0.53),' +
  '234px 445px 0 0 rgba(255,255,255,0.61),' +
  '678px 289px 0 0 rgba(255,255,255,0.49),' +
  '1100px 534px 0 0 rgba(255,255,255,0.72),' +
  '56px 478px 0 0 rgba(255,255,255,0.62),' +
  '312px 623px 0 0 rgba(255,255,255,0.54),' +
  '789px 145px 0 0 rgba(255,255,255,0.75),' +
  '1089px 267px 0 0 rgba(255,255,255,0.48),' +
  '445px 778px 0 0 rgba(255,255,255,0.69),' +
  '934px 712px 0 0 rgba(255,255,255,0.43),' +
  '1234px 134px 0 0 rgba(255,255,255,0.82),' +
  '678px 567px 0 0 rgba(255,255,255,0.57),' +
  '1489px 345px 0 0 rgba(255,255,255,0.71),' +
  '123px 867px 0 0 rgba(255,255,255,0.46),' +
  '567px 423px 0 0 rgba(255,255,255,0.79),' +
  '1345px 812px 0 0 rgba(255,255,255,0.55)'

const STAR_SHADOWS_MOBILE =
  '12px 34px 0 0 rgba(255,255,255,0.72),' +
  '89px 21px 0 0 rgba(255,255,255,0.58),' +
  '178px 56px 0 0 rgba(255,255,255,0.81),' +
  '267px 23px 0 0 rgba(255,255,255,0.49),' +
  '356px 67px 0 0 rgba(255,255,255,0.65),' +
  '45px 134px 0 0 rgba(255,255,255,0.71),' +
  '134px 178px 0 0 rgba(255,255,255,0.44),' +
  '223px 145px 0 0 rgba(255,255,255,0.83),' +
  '312px 212px 0 0 rgba(255,255,255,0.56),' +
  '23px 245px 0 0 rgba(255,255,255,0.67),' +
  '112px 289px 0 0 rgba(255,255,255,0.41),' +
  '201px 334px 0 0 rgba(255,255,255,0.78),' +
  '290px 312px 0 0 rgba(255,255,255,0.53),' +
  '367px 356px 0 0 rgba(255,255,255,0.69),' +
  '56px 401px 0 0 rgba(255,255,255,0.47),' +
  '145px 445px 0 0 rgba(255,255,255,0.74),' +
  '234px 423px 0 0 rgba(255,255,255,0.58),' +
  '323px 467px 0 0 rgba(255,255,255,0.43),' +
  '78px 512px 0 0 rgba(255,255,255,0.81),' +
  '167px 556px 0 0 rgba(255,255,255,0.52),' +
  '256px 534px 0 0 rgba(255,255,255,0.67),' +
  '345px 578px 0 0 rgba(255,255,255,0.45),' +
  '23px 612px 0 0 rgba(255,255,255,0.73),' +
  '112px 634px 0 0 rgba(255,255,255,0.48),' +
  '201px 678px 0 0 rgba(255,255,255,0.82),' +
  '290px 645px 0 0 rgba(255,255,255,0.57),' +
  '367px 712px 0 0 rgba(255,255,255,0.44),' +
  '89px 734px 0 0 rgba(255,255,255,0.71),' +
  '178px 756px 0 0 rgba(255,255,255,0.39),' +
  '267px 801px 0 0 rgba(255,255,255,0.63),' +
  '134px 89px 0 0 rgba(255,255,255,0.76),' +
  '312px 134px 0 0 rgba(255,255,255,0.51),' +
  '45px 367px 0 0 rgba(255,255,255,0.84),' +
  '223px 489px 0 0 rgba(255,255,255,0.47),' +
  '356px 523px 0 0 rgba(255,255,255,0.73),' +
  '89px 645px 0 0 rgba(255,255,255,0.58),' +
  '178px 723px 0 0 rgba(255,255,255,0.42),' +
  '312px 756px 0 0 rgba(255,255,255,0.67),' +
  '56px 823px 0 0 rgba(255,255,255,0.79),' +
  '245px 867px 0 0 rgba(255,255,255,0.53)'

const STAR_SHADOWS_TWINKLE =
  '187px 89px 0 1px rgba(255,255,255,0.90),' +
  '423px 156px 0 1px rgba(255,255,255,0.88),' +
  '678px 234px 0 1px rgba(255,255,255,0.92),' +
  '934px 67px 0 1px rgba(255,255,255,0.87),' +
  '1178px 189px 0 1px rgba(255,255,255,0.91),' +
  '1423px 123px 0 1px rgba(255,255,255,0.85),' +
  '234px 445px 0 1px rgba(255,255,255,0.89),' +
  '578px 512px 0 1px rgba(255,255,255,0.93),' +
  '823px 389px 0 1px rgba(255,255,255,0.86),' +
  '1067px 456px 0 1px rgba(255,255,255,0.90),' +
  '1312px 534px 0 1px rgba(255,255,255,0.88),' +
  '345px 712px 0 1px rgba(255,255,255,0.91),' +
  '689px 778px 0 1px rgba(255,255,255,0.87),' +
  '1023px 756px 0 1px rgba(255,255,255,0.93),' +
  '1267px 812px 0 1px rgba(255,255,255,0.85)'

const FLOAT_SYMBOLS = [
  { char: 'Σ', top: '12%', left: '8%',  size: 22, delay: 0,  dur: 28 },
  { char: '∫', top: '32%', left: '91%', size: 18, delay: 7,  dur: 34 },
  { char: 'π', top: '68%', left: '6%',  size: 20, delay: 14, dur: 28 },
  { char: '√', top: '22%', left: '78%', size: 16, delay: 3,  dur: 42 },
  { char: '∞', top: '78%', left: '85%', size: 24, delay: 21, dur: 34 },
  { char: '∂', top: '52%', left: '93%', size: 16, delay: 10, dur: 42 },
]

const stellarReveal = {
  hidden: { opacity: 0, y: 32, filter: 'blur(8px)', scale: 0.96 },
  show: (i = 0) => ({
    opacity: 1, y: 0, filter: 'blur(0px)', scale: 1,
    transition: { duration: 0.72, ease: [0.16, 1, 0.3, 1], delay: i * 0.1 },
  }),
}

const xReveal = {
  hidden: { opacity: 0, x: 40, filter: 'blur(6px)', scale: 0.96 },
  show: (i = 0) => ({
    opacity: 1, x: 0, filter: 'blur(0px)', scale: 1,
    transition: { duration: 0.72, ease: [0.16, 1, 0.3, 1], delay: i * 0.12 },
  }),
}

function ConcentricRings() {
  const radii = [18, 32, 46, 60, 74, 88]
  return (
    <svg width="200" height="200" viewBox="0 0 200 200" fill="none" aria-hidden="true">
      {radii.map((r, idx) => (
        <circle
          key={r}
          cx="100" cy="100" r={r}
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray={`${3 + idx * 0.6} ${5 + idx * 0.8}`}
          opacity={0.10 + idx * 0.04}
        />
      ))}
      <circle cx="100" cy="100" r="3.5" fill="currentColor" opacity={0.45} />
    </svg>
  )
}

// Mounts NumberTicker only when the element enters view — count-up on scroll
function StatTicker({ value, suffix, label, i }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.3 })
  return (
    <motion.div
      ref={ref}
      variants={stellarReveal}
      custom={i}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
      className="flex flex-col items-center gap-2 text-center"
    >
      <span
        className="font-bold"
        style={{ fontSize: 'clamp(2.4rem,5vw,3.5rem)', letterSpacing: '-0.04em', color: 'var(--primary)', lineHeight: 1 }}
      >
        {inView ? <><NumberTicker value={value} />{suffix}</> : `0${suffix}`}
      </span>
      <span className="text-[13px]" style={{ color: 'var(--fg-secondary)' }}>{label}</span>
    </motion.div>
  )
}

// One of "The Three Pillars" — its own component so useTilt3D (a hook) can be
// called per-card instead of inside the parent's .map() callback.
function PillarCard({ p, i }) {
  const { ref, handlers } = useTilt3D()
  return (
    <motion.div
      ref={ref}
      variants={stellarReveal} custom={i}
      initial="hidden" whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      className="pillar-card flex flex-col gap-4 p-6 rounded-2xl border"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--surface)',
        perspective: 'var(--perspective-md)',
        transformStyle: 'preserve-3d',
      }}
      {...handlers}
    >
      <span className="pillar-glyph text-[2rem] font-bold" style={{ color: p.color }}>
        {p.glyph}
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-bold tracking-[2px] uppercase" style={{ color: p.color }}>
          {p.title}
        </p>
        <p className="text-[15px] font-semibold" style={{ color: 'var(--foreground)' }}>
          {p.subtitle}
        </p>
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--fg-secondary)' }}>
          {p.desc}
        </p>
      </div>
    </motion.div>
  )
}

export default function Landing({ onOpenAuth }) {
  usePageMeta('', { description: 'Ôn tập Toán với 1,104 câu đề thật từ 63 tỉnh thành — AI phát hiện lỗi sai, tạo kế hoạch học tập cá nhân hóa cho học sinh THPT & lớp 10.' })
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const [guestProvince, setGuestProvince] = useState(() => localStorage.getItem('guest_province') || '')
  const starLayerRef = useRef(null)
  const starTwinkleRef = useRef(null)
  const heroIntroRef = useRef(null)
  const { scrollY, scrollYProgress } = useScroll()
  const heroY = useTransform(scrollY, [0, 600], [0, -40])

  // Tier 2 GSAP moment — the hero logo + headline entrance. Everything else
  // in this hero stays on framer-motion's stellarReveal variants; only these
  // two elements are GSAP-owned (one-library-per-element rule).
  useGsapTimeline(
    (tl) => {
      tl.set(['.hero-gsap-logo', '.hero-gsap-heading'], {
        opacity: 0,
        y: 28,
        rotateX: -10,
        transformPerspective: 800,
      })
        .to('.hero-gsap-logo', { opacity: 1, y: 0, rotateX: 0, duration: 0.7, ease: 'power3.out' })
        .to(
          '.hero-gsap-heading',
          { opacity: 1, y: 0, rotateX: 0, duration: 0.7, ease: 'power3.out' },
          '-=0.45'
        )
    },
    { scope: heroIntroRef }
  )

  function handleProvinceChange(v) {
    setGuestProvince(v)
    if (v) localStorage.setItem('guest_province', v)
  }

  // Preserve ref tracking without re-renders
  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref && /^[A-Za-z0-9_-]{8,20}$/.test(ref)) {
      try { sessionStorage.setItem('pending_ref', ref) } catch {}
    }
  }, [searchParams])

  // Apply star shadows once on mount — no re-renders, no runtime Math.random()
  useEffect(() => {
    const isMobile = window.innerWidth < 640
    if (starLayerRef.current) {
      starLayerRef.current.style.boxShadow = isMobile ? STAR_SHADOWS_MOBILE : STAR_SHADOWS_DESKTOP
    }
    if (starTwinkleRef.current) {
      starTwinkleRef.current.style.boxShadow = STAR_SHADOWS_TWINKLE
    }
  }, [])

  const provinceSelector = (
    <div className="flex items-center gap-2" data-testid="province-selector-wrap">
      <span className="text-[12px]" style={{ color: 'var(--fg-tertiary)' }}>Tôi thi ở:</span>
      <Select value={guestProvince || undefined} onValueChange={handleProvinceChange}>
        <SelectTrigger data-testid="province-selector"
          className="h-auto py-1 px-2 text-[12px] w-auto min-w-[120px]">
          <SelectValue placeholder="Chọn tỉnh..." />
        </SelectTrigger>
        <SelectContent>
          {VN_PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <div className="min-h-screen relative overflow-x-hidden flex flex-col items-center">
      {/* Fixed full-page atmospheric backdrop — stars + nebula visible across every section */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }} aria-hidden="true">
        <div className="star-field-wrapper">
          <div ref={starLayerRef} className="star-layer" />
          <div ref={starTwinkleRef} className="star-layer star-twinkle-layer" />
        </div>
        <div className="absolute inset-0">
          <div className="nebula-wisp" style={{ width: 700, height: 700, top: '-5%',  left: '-10%' }} />
          <div className="nebula-wisp" style={{ width: 500, height: 500, top: '30%',  right: '-8%' }} />
          <div className="nebula-wisp" style={{ width: 420, height: 420, top: '65%',  left: '22%' }} />
        </div>
        {/* Tier 3 — ambient WebGL summit-beacon, hero viewport only; lazy + capability-gated, no fallback needed since the CSS layers above already cover the skip case */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '100vh', opacity: 0.5 }}>
          <Scene3DLazy scene={() => import('../components/motion/scenes/LandingHeroScene.jsx')} fallback={null} />
        </div>
      </div>

      {/* Scroll progress bar */}
      <motion.div
        style={{ scaleX: scrollYProgress, transformOrigin: 'left', background: 'var(--primary)', position: 'fixed', top: 0, left: 0, right: 0, height: 2, zIndex: 60, pointerEvents: 'none' }}
      />

      {/* ── 01 THE VOID / THE ATLAS — Hero ──────────────────────────────────── */}
      <section
        className="relative z-[1] w-full flex flex-col items-center justify-center overflow-hidden px-5 sm:px-8 pb-16 pt-20"
        style={{ minHeight: '100dvh' }}
      >
        {/* Floating math symbols */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          {FLOAT_SYMBOLS.map((s, i) => (
            <span
              key={i}
              className={i >= 3 ? 'float-math-symbol hidden sm:inline' : 'float-math-symbol'}
              style={{
                top: s.top, left: s.left, fontSize: s.size,
                animationName: 'nebula-breathe-c',
                animationDuration: `${s.dur}s`,
                animationDelay: `${s.delay}s`,
                animationTimingFunction: 'ease-in-out',
                animationIterationCount: 'infinite',
              }}
            >
              {s.char}
            </span>
          ))}
        </div>

        {/* Hero content */}
        <motion.div
          ref={heroIntroRef}
          style={{ y: heroY }}
          className="relative z-10 flex flex-col items-center gap-7 text-center max-w-2xl w-full"
        >
          <div className="hero-gsap-logo" style={{ perspective: 'var(--perspective-md)' }}>
            <VantageLogo variant="hero" />
          </div>

          <h1
            className="hero-gsap-heading leading-[1.05] text-center"
            style={{
              fontSize: 'clamp(2.8rem,7vw,5rem)',
              letterSpacing: '-0.025em',
              fontWeight: 800,
              color: 'var(--foreground)',
              perspective: 'var(--perspective-md)',
            }}
          >
            Ánh sáng dẫn đường.
          </h1>

          <motion.p
            variants={stellarReveal} custom={2} initial="hidden" animate="show"
            className="text-[16px] leading-relaxed max-w-[520px]"
            style={{ color: 'var(--fg-secondary)' }}
          >
            Vantage soi đúng chỗ bạn đang mất điểm, rồi dẫn bạn ôn đúng chỗ đó. Không tốn thời gian ôn những gì bạn đã biết rồi.
          </motion.p>

          <motion.div variants={stellarReveal} custom={3} initial="hidden" animate="show">
            {provinceSelector}
          </motion.div>

          <motion.div
            variants={stellarReveal} custom={4} initial="hidden" animate="show"
            className="flex flex-col sm:flex-row items-center gap-3"
          >
            <button
              className="spectral-gate-btn px-7 py-3.5 rounded-xl text-[15px]"
              onClick={() => navigate('/practice/diagnostic')}
            >
              Bắt đầu miễn phí →
            </button>
            <button
              onClick={() => navigate('/practice/diagnostic')}
              className="px-5 py-3 rounded-xl text-[13px] font-medium transition hover:opacity-80"
              style={{ color: 'var(--fg-secondary)' }}
            >
              Xem tôi cần học gì →
            </button>
          </motion.div>

          {!user && (
            <motion.div variants={stellarReveal} custom={5} initial="hidden" animate="show">
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] transition hover:opacity-80 border"
                style={{ borderColor: 'var(--border)', color: 'var(--fg-secondary)', background: 'transparent' }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Đăng nhập với Google
              </button>
            </motion.div>
          )}

          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xl select-none"
            style={{ color: 'var(--fg-tertiary)' }}
            aria-hidden="true"
          >
            ↓
          </motion.div>
        </motion.div>
      </section>

      {/* ── 02 THE RECKONING — Stats + philosophy ───────────────────────────── */}
      <section className="relative z-10 w-full max-w-4xl mx-auto px-5 sm:px-8 py-20">
        <div className="flex flex-col sm:flex-row items-center gap-12 sm:gap-16">
          {/* Left: stats + philosophy */}
          <div className="flex-1 flex flex-col">
            <div className="flex flex-col sm:flex-row items-center justify-start gap-10 sm:gap-14">
              <StatTicker value={1104} suffix="" label="câu từ đề thi thật" i={0} />
              <StatTicker value={63}   suffix="" label="tỉnh thành"          i={1} />
              <StatTicker value={3}    suffix="+" label="năm đề chính thức"  i={2} />
            </div>
            <motion.p
              variants={stellarReveal} custom={0}
              initial="hidden" whileInView="show"
              viewport={{ once: true, amount: 0.3 }}
              className="mt-12 font-semibold text-center sm:text-left"
              style={{ fontSize: 'clamp(1.1rem,2.5vw,1.5rem)', color: 'var(--fg-secondary)', letterSpacing: '-0.01em' }}
            >
              Không cần ôn nhiều hơn. Cần ôn đúng hơn.
            </motion.p>
          </div>
          {/* Right: concentric dashed SVG rings — hidden on mobile */}
          <motion.div
            variants={stellarReveal} custom={1}
            initial="hidden" whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            className="hidden sm:flex items-center justify-center flex-shrink-0"
            style={{ color: 'var(--primary)', opacity: 0.55 }}
          >
            <ConcentricRings />
          </motion.div>
        </div>
      </section>

      {/* ── 03 THE THREE PILLARS ─────────────────────────────────────────────── */}
      <section className="relative z-10 w-full max-w-4xl mx-auto px-5 sm:px-8 py-12">
        <div className="text-center mb-10">
          <span
            className="text-[11px] font-semibold tracking-[3px] uppercase"
            style={{ color: 'var(--fg-tertiary)' }}
          >
            Phương pháp
          </span>
          <h2
            className="font-bold mt-2"
            style={{ fontSize: 'clamp(1.5rem,3vw,2.25rem)', color: 'var(--foreground)' }}
          >
            Ba trụ cột
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            {
              glyph: '◇', color: 'var(--primary)',
              title: 'THE LENS',
              subtitle: 'Phát hiện điểm yếu',
              desc: 'AI nhìn thấu từng câu sai — không chỉ đếm điểm mà chỉ đúng chỗ mất điểm để sửa trúng.',
            },
            {
              glyph: '⊕', color: 'var(--purple)',
              title: 'THE MAP',
              subtitle: 'Đề thi thật 63 tỉnh',
              desc: 'Luyện đúng đề của tỉnh mình. 1,104 câu từ Bộ GD&ĐT và các Sở, cập nhật hàng năm.',
            },
            {
              glyph: '⊛', color: 'var(--success)',
              title: 'THE COMPASS',
              subtitle: 'Nhắc đúng lúc sắp quên',
              desc: 'Thuật toán FSRS nhắc bạn ôn lại câu đó đúng khoảnh khắc bộ nhớ sắp mờ đi.',
            },
          ].map((p, i) => (
            <PillarCard key={p.title} p={p} i={i} />
          ))}
        </div>
      </section>

      {/* ── 04 THE JOURNEY — How it works ───────────────────────────────────── */}
      <section className="relative z-10 w-full max-w-4xl mx-auto px-5 sm:px-8 py-16">
        <div className="text-center mb-12">
          <span className="text-[11px] font-semibold tracking-[3px] uppercase" style={{ color: 'var(--fg-tertiary)' }}>Lộ trình</span>
          <h2 className="font-bold mt-2" style={{ fontSize: 'clamp(1.5rem,3vw,2.25rem)', color: 'var(--foreground)' }}>Dùng thế nào?</h2>
        </div>
        {/* Desktop: horizontal with dashed connector / Mobile: vertical */}
        <div className="hidden sm:flex items-start gap-0">
          {[
            { roman: 'I',   color: 'var(--primary)', title: 'Làm đề tỉnh mình', desc: 'Đề từ tỉnh bạn, cập nhật 2025. Vantage ghi lại bạn sai câu nào — không chỉ tổng điểm.' },
            { roman: 'II',  color: 'var(--purple)',        title: 'Biết yếu chỗ nào',  desc: 'Không phải "sai 15/50 câu". Là: Hình học — bạn sai 7/8 câu phần đường tròn.' },
            { roman: 'III', color: 'var(--success)',        title: 'Ôn đúng, nhớ lâu',  desc: 'AI nhắc bạn ôn lại đúng lúc sắp quên. Không cần tự nhớ — Vantage tự nhắc.' },
          ].map((step, i, arr) => (
            <div key={step.roman} className="flex items-start flex-1">
              <motion.div
                variants={xReveal} custom={i}
                initial="hidden" whileInView="show"
                viewport={{ once: true, amount: 0.3 }}
                className="flex flex-col gap-3 flex-1 px-5"
              >
                <span
                  className="font-bold"
                  style={{ fontSize: 'clamp(2rem,4vw,3rem)', color: step.color, opacity: 0.28, lineHeight: 1 }}
                >
                  {step.roman}
                </span>
                <p className="text-[14px] font-semibold" style={{ color: 'var(--foreground)' }}>{step.title}</p>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--fg-secondary)' }}>{step.desc}</p>
              </motion.div>
              {i < arr.length - 1 && (
                <div className="flex-shrink-0 self-center mt-2" style={{ borderTop: '1px dashed var(--border)', width: 24 }} />
              )}
            </div>
          ))}
        </div>
        {/* Mobile: vertical */}
        <div className="flex sm:hidden flex-col gap-0">
          {[
            { roman: 'I',   color: 'var(--primary)', title: 'Làm đề tỉnh mình', desc: 'Đề từ tỉnh bạn, cập nhật 2025. Vantage ghi lại bạn sai câu nào — không chỉ tổng điểm.' },
            { roman: 'II',  color: 'var(--purple)',        title: 'Biết yếu chỗ nào',  desc: 'Không phải "sai 15/50 câu". Là: Hình học — bạn sai 7/8 câu phần đường tròn.' },
            { roman: 'III', color: 'var(--success)',        title: 'Ôn đúng, nhớ lâu',  desc: 'AI nhắc bạn ôn lại đúng lúc sắp quên. Không cần tự nhớ — Vantage tự nhắc.' },
          ].map((step, i, arr) => (
            <div key={step.roman} className="flex gap-5">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: step.color, opacity: 0.15 }} />
                {i < arr.length - 1 && (
                  <div className="w-px flex-1 mt-1" style={{ background: 'var(--border)', minHeight: 32 }} />
                )}
              </div>
              <motion.div
                variants={xReveal} custom={i}
                initial="hidden" whileInView="show"
                viewport={{ once: true, amount: 0.3 }}
                className="flex flex-col gap-1 pb-8"
              >
                <span className="font-bold text-[11px] tracking-[2px] uppercase" style={{ color: step.color }}>{step.roman}</span>
                <p className="text-[14px] font-semibold" style={{ color: 'var(--foreground)' }}>{step.title}</p>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--fg-secondary)' }}>{step.desc}</p>
              </motion.div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 05 THE WITNESSES — Testimonials ──────────────────────────────────── */}
      <section className="relative z-10 w-full py-16 overflow-hidden">
        <div className="text-center mb-8">
          <h2 className="font-bold" style={{ fontSize: 'clamp(1.25rem,2.5vw,1.75rem)', color: 'var(--foreground)' }}>
            Học sinh nói gì về Vantage
          </h2>
        </div>
        <div
          className="relative flex gap-5 px-5 mx-auto"
          style={{
            maxWidth: 900,
            maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
            height: 480,
            overflow: 'hidden',
          }}
        >
          {/* Column 1 */}
          <div className="constellation-column flex-1 flex flex-col gap-3">
            {[...TESTIMONIALS.slice(0, 3), ...TESTIMONIALS.slice(0, 3)].map((t, i) => (
              <div key={i} className="witness-card p-5 flex flex-col gap-3">
                <p className="text-[13px] leading-relaxed italic flex-1" style={{ color: 'var(--fg-secondary)' }}>
                  "{t.quote}"
                </p>
                <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-[13px] font-semibold" style={{ color: 'var(--foreground)' }}>{t.name}</p>
                  <p className="text-[11px]" style={{ color: 'var(--fg-tertiary)' }}>{t.grade}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--success)' }}>✓ {t.result}</p>
                </div>
              </div>
            ))}
          </div>
          {/* Column 2 */}
          <div className="constellation-column flex-1 flex flex-col gap-3 hidden sm:flex">
            {[...TESTIMONIALS.slice(3), ...TESTIMONIALS.slice(3)].map((t, i) => (
              <div key={i} className="witness-card p-5 flex flex-col gap-3">
                <p className="text-[13px] leading-relaxed italic flex-1" style={{ color: 'var(--fg-secondary)' }}>
                  "{t.quote}"
                </p>
                <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-[13px] font-semibold" style={{ color: 'var(--foreground)' }}>{t.name}</p>
                  <p className="text-[11px]" style={{ color: 'var(--fg-tertiary)' }}>{t.grade}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--success)' }}>✓ {t.result}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 06 THE THRESHOLD — Pricing ───────────────────────────────────────── */}
      <section className="relative z-10 w-full max-w-4xl mx-auto px-5 sm:px-8 py-16">
        <div className="h-px w-full mb-12" style={{ background: 'linear-gradient(90deg, transparent, var(--border), transparent)' }} />
        <div className="flex flex-col items-center gap-2 text-center mb-10">
          <h2 className="font-bold" style={{ fontSize: 'clamp(1.5rem,3vw,2rem)', color: 'var(--foreground)' }}>
            Ba cấp độ, một đích đến
          </h2>
          <p className="text-[13px]" style={{ color: 'var(--fg-secondary)' }}>
            Không cần thẻ ngân hàng · Hủy bất cứ lúc nào · Hoàn tiền 7 ngày
          </p>
        </div>
        <div className="flex flex-col gap-4">
          {PLANS_MONTHLY.map((plan, i) => (
            <motion.div
              key={plan.tier}
              variants={stellarReveal} custom={i}
              initial="hidden" whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              className="flex items-start justify-between gap-4 px-6 py-5 rounded-2xl border"
              style={{
                borderColor: plan.tier === 'student' ? 'var(--primary-border)' : 'var(--border)',
                background: plan.tier === 'student' ? 'var(--primary-subtle)' : 'var(--surface)',
              }}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold" style={{ color: 'var(--foreground)' }}>{plan.label}</span>
                  {plan.badge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--primary-subtle)', color: 'var(--primary)' }}>
                      {plan.badge}
                    </span>
                  )}
                </div>
                <span className="text-[12px]" style={{ color: 'var(--fg-tertiary)' }}>⚡ {plan.credits.toLocaleString()} credits / tháng</span>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                  {plan.features.map(f => (
                    <span key={f} className="text-[12px]" style={{ color: 'var(--fg-secondary)' }}>✓ {f}</span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-end gap-3 flex-shrink-0">
                <span className="text-[16px] font-bold" style={{ color: 'var(--foreground)' }}>{plan.price}</span>
                {plan.tier === 'basic' ? (
                  <button
                    onClick={() => navigate('/practice/diagnostic')}
                    className="px-4 py-1.5 rounded-lg text-[12px] font-semibold border transition hover:opacity-80"
                    style={{ borderColor: 'var(--border)', color: 'var(--fg-secondary)' }}
                  >
                    Thử miễn phí →
                  </button>
                ) : plan.tier === 'student' ? (
                  <button
                    className="spectral-gate-btn px-5 py-2 rounded-lg text-[13px]"
                    onClick={user ? () => navigate('/account') : onOpenAuth}
                  >
                    {user ? 'Bắt đầu học ngay' : 'Đăng nhập'}
                  </button>
                ) : (
                  <button
                    onClick={user ? () => navigate('/account') : onOpenAuth}
                    className="px-5 py-2 rounded-lg text-[13px] font-semibold border transition hover:opacity-80"
                    style={{ borderColor: 'var(--primary-border)', color: 'var(--primary)' }}
                  >
                    {user ? 'Mở khóa toàn bộ' : 'Đăng nhập'}
                  </button>
                )}
                {plan.tier !== 'basic' && (
                  <span className="text-[10px]" style={{ color: 'var(--fg-tertiary)' }}>✓ Hoàn tiền 7 ngày · = 1 cốc trà sữa/tuần</span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── 07 THE CALLING — Final CTA ───────────────────────────────────────── */}
      <section className="relative z-10 w-full overflow-hidden py-24 px-5 sm:px-8">
        <div className="relative flex flex-col items-center gap-7 text-center max-w-xl mx-auto">
          <motion.h2
            variants={stellarReveal} custom={0}
            initial="hidden" whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            className="font-bold"
            style={{ fontSize: 'clamp(1.75rem,4vw,3rem)', letterSpacing: '-0.02em', color: 'var(--foreground)' }}
          >
            Thử ngay — chỉ mất 5 phút
          </motion.h2>

          <motion.p
            variants={stellarReveal} custom={1}
            initial="hidden" whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            className="text-[15px]"
            style={{ color: 'var(--fg-secondary)' }}
          >
            Miễn phí · Không cần đăng ký · Kết quả sau 8 câu
          </motion.p>

          <motion.div
            variants={stellarReveal} custom={2}
            initial="hidden" whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
          >
            {provinceSelector}
          </motion.div>

          <motion.div
            variants={stellarReveal} custom={3}
            initial="hidden" whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            className="flex flex-col sm:flex-row items-center gap-3"
          >
            <button
              className="spectral-gate-btn px-8 py-4 rounded-xl text-[16px]"
              onClick={() => navigate('/practice/diagnostic')}
            >
              Bắt đầu ngay →
            </button>
            {!user && (
              <button
                onClick={onOpenAuth}
                className="px-7 py-3.5 rounded-xl text-[15px] font-semibold border transition hover:opacity-80"
                style={{ borderColor: 'var(--border)', color: 'var(--fg-secondary)' }}
              >
                Đăng nhập với Google
              </button>
            )}
          </motion.div>
        </div>
      </section>

      {/* ── 08 FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 w-full border-t px-6 sm:px-10 py-12" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-10 justify-between">
          {/* Brand block */}
          <div className="flex flex-col gap-3 max-w-[220px]">
            <VantageLogo variant="nav" />
            <span className="text-[12px] leading-relaxed mt-1" style={{ color: 'var(--fg-tertiary)' }}>
              Nền tảng luyện thi Toán THPT &amp; Lớp 10 được cá nhân hóa bởi AI.
            </span>
            <div className="flex gap-2 mt-1">
              <a href="https://github.com" target="_blank" rel="noreferrer" aria-label="GitHub"
                className="p-1.5 rounded-lg border transition hover:opacity-70"
                style={{ borderColor: 'var(--border)', color: 'var(--fg-tertiary)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.51 11.51 0 0 1 12 6.598c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>
              <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook"
                className="p-1.5 rounded-lg border transition hover:opacity-70"
                style={{ borderColor: 'var(--border)', color: 'var(--fg-tertiary)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073C24 5.446 18.627 0 12 0S0 5.446 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.025 1.791-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.971H15.83c-1.491 0-1.956.932-1.956 1.888v2.262h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Link columns */}
          <div className="flex gap-10 flex-wrap">
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[2px] mb-1" style={{ color: 'var(--fg-tertiary)' }}>Sản phẩm</span>
              {[['Thi thử', '/exams'], ['Luyện tập', '/exams?mode=practice'],
                ['⚗ Lab', '/exams?mode=lab'],
                ['Bản đồ kiến thức', '/mastery']].map(([label, path]) => (
                <button key={label} onClick={() => navigate(path)}
                  className="text-[12px] text-left transition hover:opacity-70"
                  style={{ color: 'var(--fg-tertiary)' }}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[2px] mb-1" style={{ color: 'var(--fg-tertiary)' }}>Tài khoản</span>
              {[['Đăng nhập', null, onOpenAuth], ['Nâng cấp', '/account', null],
                ['Lịch sử thi', '/history', null]].map(([label, path, fn]) => (
                <button key={label} onClick={fn ?? (() => navigate(path))}
                  className="text-[12px] text-left transition hover:opacity-70"
                  style={{ color: 'var(--fg-tertiary)' }}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[2px] mb-1" style={{ color: 'var(--fg-tertiary)' }}>Hỗ trợ</span>
              {[['Về chúng tôi', '#'], ['Phản hồi', '#'], ['Điều khoản', '#'], ['Riêng tư', '#']].map(([label, href]) => (
                <a key={label} href={href}
                  className="text-[12px] transition hover:opacity-70"
                  style={{ color: 'var(--fg-tertiary)' }}>
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="max-w-5xl mx-auto mt-8 pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-2"
          style={{ borderColor: 'var(--border)' }}>
          <p className="text-[11px]" style={{ color: 'var(--fg-tertiary)' }}>
            © {new Date().getFullYear()} VANTAGE. Tất cả đề thi từ nguồn chính thức.
          </p>
          <div className="flex gap-4">
            <a href="#" className="text-[11px] transition hover:opacity-70" style={{ color: 'var(--fg-tertiary)' }}>Điều khoản dịch vụ</a>
            <a href="#" className="text-[11px] transition hover:opacity-70" style={{ color: 'var(--fg-tertiary)' }}>Chính sách bảo mật</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
