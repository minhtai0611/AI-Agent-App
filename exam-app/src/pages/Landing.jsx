import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { pageVariants } from '../utils/animations.js'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { useAuth } from '../context/AuthContext.jsx'
import { Button } from '../components/ui/button.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select.jsx'

import { useHistory } from '../context/HistoryContext.jsx'
import { computeStreak } from '../utils/streak.js'
import { getDaysUntilExam, getExamYear } from '../utils/examCountdown.js'
import { useReadiness } from '../hooks/useReadiness.js'
import { loadQuestions } from '../api/index.js'
import { getSessionToday } from '../api/aiClient.js'
import { checkAndShowWeeklyReport } from '../utils/studyReminder.js'
import ZenithLogo from '../components/ZenithLogo.jsx'

const VN_PROVINCES = ['An Giang','Bà Rịa - Vũng Tàu','Bắc Giang','Bắc Kạn','Bạc Liêu','Bắc Ninh','Bến Tre','Bình Định','Bình Dương','Bình Phước','Bình Thuận','Cà Mau','Cần Thơ','Cao Bằng','Đà Nẵng','Đắk Lắk','Đắk Nông','Điện Biên','Đồng Nai','Đồng Tháp','Gia Lai','Hà Giang','Hà Nam','Hà Nội','Hà Tĩnh','Hải Dương','Hải Phòng','Hậu Giang','Hòa Bình','Hưng Yên','Khánh Hòa','Kiên Giang','Kon Tum','Lai Châu','Lâm Đồng','Lạng Sơn','Lào Cai','Long An','Nam Định','Nghệ An','Ninh Bình','Ninh Thuận','Phú Thọ','Phú Yên','Quảng Bình','Quảng Nam','Quảng Ngãi','Quảng Ninh','Quảng Trị','Sóc Trăng','Sơn La','Tây Ninh','Thái Bình','Thái Nguyên','Thanh Hóa','Thừa Thiên Huế','Tiền Giang','TP. Hồ Chí Minh','Trà Vinh','Tuyên Quang','Vĩnh Long','Vĩnh Phúc','Yên Bái']

const PLANS_MONTHLY = [
  {
    tier: 'basic', label: 'Thử miễn phí', price: 'Miễn phí', credits: 50,
    features: ['5 lượt Zenith AI/ngày', '1 đề thi mỗi cấp độ', 'Thử thách hằng ngày', '⚗ Bản đồ khái niệm'],
  },
  {
    tier: 'student', label: 'Học sinh', price: '29,000đ / tháng', credits: 500, badge: '⭐ 95% học sinh chọn',
    features: ['Zenith AI không giới hạn', 'AI Phân tích miễn phí', '3 đề thi mỗi cấp độ', '⚗ Lab AI đầy đủ (Phân tích lỗi sai, OCR)', 'Thưởng chuỗi học', 'Xu hướng 30 ngày', 'Kế hoạch học'],
  },
  {
    tier: 'complete', label: '8.5+ Nâng cao', price: '59,000đ / tháng', credits: 2000,
    features: ['Tất cả gói Học sinh', 'Tất cả đề thi thử & luyện tập', '⚗ Tạo đề AI riêng', 'Dự đoán điểm số', 'Kế hoạch thích nghi AI', 'Chiến lược thi', 'So sánh tỉnh thành'],
  },
]

const TOPUP_PACKAGES = [
  { price: '15,000đ', credits: 150 },
  { price: '29,000đ', credits: 350 },
  { price: '59,000đ', credits: 800 },
]

const TESTIMONIALS = [
  { name: 'Nguyễn Minh Anh', grade: 'Lớp 12 · Hà Nội', result: 'Đạt 8.0 Toán THPT 2024', quote: 'Zenith AI giải thích từng bước rõ ràng hơn sách giáo khoa. Mình hiểu bản chất, không chỉ nhớ công thức.' },
  { name: 'Trần Thảo Linh', grade: 'Lớp 9 · TP.HCM', result: 'Đỗ THPT Chuyên Lê Hồng Phong', quote: 'AI chỉ đúng điểm yếu của mình là Hình học. Luyện đúng chỗ, tiết kiệm thời gian hơn nhiều.' },
  { name: 'Phạm Đức Huy', grade: 'Lớp 11 · Đà Nẵng', result: 'Tăng từ 5.5 lên 7.5 trong 2 tháng', quote: 'Thích nhất là thấy được mình đang ở đâu so với học sinh cùng tỉnh. Tạo động lực học hẳn.' },
  { name: 'Lê Thu Hương', grade: 'Lớp 12 · Cần Thơ', result: 'Điểm Toán tăng 1.5 điểm', quote: 'Kế hoạch học cá nhân hoá thật sự hữu ích. Mỗi tuần biết mình cần ôn cái gì, không bị lạc hướng.' },
  { name: 'Ngô Bảo Long', grade: 'Lớp 10 · Hải Phòng', result: 'Top 10% thi thử', quote: 'Làm đề thật từ Hải Phòng là lợi thế lớn. Zenith cho mình cảm giác đang luyện đúng kỳ thi thật.' },
  { name: 'Vũ Thị Mai', grade: 'Lớp 9 · Hà Nội', result: 'Vào THPT Chuyên Ngữ', quote: 'Oracle giải toán như một gia sư riêng — không chỉ cho đáp án mà còn giải thích tại sao.' },
]

const FAQ_ITEMS = [
  {
    q: 'Khác gì app khác?',
    a: 'Không cho đề tràn lan. Zenith tìm đúng chỗ bạn đang sai rồi luyện đúng chỗ đó — không phải ôn lại từ đầu.',
  },
  {
    q: 'Có mất phí không?',
    a: 'Thử miễn phí. Không cần thẻ ngân hàng. Nếu thấy ổn thì 29k/tháng — bằng 1 cốc trà sữa. Hoàn tiền 7 ngày.',
  },
  {
    q: 'Đề có thật không hay do AI tạo?',
    a: 'Tất cả 1,104 câu lấy từ đề thi chính thức — Bộ GD&ĐT và 63 tỉnh, cập nhật 2025. Không có câu nào do AI tạo ra.',
  },
  {
    q: 'Lớp 9 thi vào 10 dùng được không?',
    a: 'Được. Chọn chế độ "Thi vào 10" — đề và lộ trình sẽ khớp đúng với kỳ thi của bạn.',
  },
  {
    q: 'Mất bao lâu mỗi ngày?',
    a: '20–25 phút. 1 đề mini + ôn lại những câu AI nhắc. Có ngày bận chỉ cần 10 phút ôn nhanh cũng được.',
  },
  {
    q: 'Không hợp có hoàn tiền không?',
    a: 'Có. Hoàn tiền 7 ngày, không hỏi lý do. Liên hệ Zalo CSKH hoặc email — xử lý trong 24h.',
  },
  {
    q: 'Bố mẹ mình có xem tiến độ được không?',
    a: 'Được. Vào Tài khoản → Chia sẻ tiến độ để tạo link báo cáo tuần cho bố mẹ xem.',
  },
]

const BENTO_FEATURES = [
  {
    id: 'analysis',
    col: 'col-span-12 sm:col-span-7',
    icon: '🎯',
    accent: '#F2A20C',
    title: 'AI phát hiện đúng điểm yếu',
    desc: 'Không đoán mò — phân tích từng câu sai và chỉ cách sửa',
    preview: [
      { topic: 'Hàm số', pct: 42, color: '#EF4444' },
      { topic: 'Hình học không gian', pct: 65, color: '#F59E0B' },
      { topic: 'Tích phân', pct: 83, color: '#34D399' },
    ],
  },
  {
    id: 'map',
    col: 'col-span-12 sm:col-span-5',
    icon: '🗺',
    accent: '#34D399',
    title: 'Bản đồ kiến thức cá nhân',
    desc: 'Nhìn thấy toàn bộ lộ trình học của bạn',
    preview: [
      { concept: 'Đại số', mastery: 90, color: '#22C55E' },
      { concept: 'Hàm logarithm', mastery: 51, color: '#F59E0B' },
      { concept: 'Giải tích', mastery: 20, color: '#EF4444' },
    ],
  },
  {
    id: 'questions',
    col: 'col-span-12 sm:col-span-4',
    icon: '📋',
    accent: '#6366F1',
    title: '1,104 câu từ đề thật',
    desc: '63 tỉnh thành · Cập nhật hàng năm',
    stat: '1,104',
  },
  {
    id: 'streak',
    col: 'col-span-12 sm:col-span-4',
    icon: '🔥',
    accent: '#F97316',
    title: 'Chuỗi học hàng ngày',
    desc: 'Học đều — nhớ lâu hơn nhiều',
    stat: '30+',
  },
  {
    id: 'oracle',
    col: 'col-span-12 sm:col-span-4',
    icon: '✦',
    accent: '#818CF8',
    title: 'Zenith Oracle AI',
    desc: 'Giải toán từng bước theo kiểu Socratic',
    stat: '∞',
  },
]

function Demo4ScoreSlider({ onOpenAuth }) {
  const [current, setCurrent] = useState(6.0)
  const gain = Math.min(2.5, Math.max(0.3, (current - 4) * 0.35 + 0.4))
  const predicted = Math.min(10, current + gain)
  const weeks = Math.round((current - 4) * 2)
  const lo = Math.max(current, predicted - 0.7).toFixed(1)
  const hi = Math.min(10, predicted + 0.5).toFixed(1)
  const onTrack = predicted >= 7.0
  return (
    <div className="flex flex-col gap-5 w-full">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between font-sans text-[12px]">
          <span className="text-dim">Điểm thi thử hiện tại</span>
          <span className="font-bold text-foreground text-[16px]">{current.toFixed(1)}</span>
        </div>
        <input type="range" min="4" max="9.5" step="0.5" value={current}
          onChange={e => setCurrent(parseFloat(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: 'var(--primary)' }} />
        <div className="flex justify-between font-sans text-[10px] text-dim">
          <span>4.0</span><span>6.0</span><span>8.0</span><span>9.5</span>
        </div>
      </div>
      <div className={`rounded-xl px-5 py-4 border ${onTrack ? 'border-success/30 bg-success/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
        <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-dim">Dự đoán sau {Math.max(2, weeks)} tuần</p>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="font-sans text-[28px] font-bold" style={{ color: onTrack ? 'var(--success)' : 'var(--warning)' }}>{predicted.toFixed(1)}</span>
          <span className="font-sans text-[12px] text-dim">({lo} – {hi})</span>
        </div>
        <p className="font-sans text-[11px] text-dim mt-1">
          {onTrack ? '↗ Đang tiến đúng hướng để đạt mục tiêu' : '⚠ Cần tăng tốc luyện tập để bứt phá'}
        </p>
      </div>
      <Button onClick={onOpenAuth} className="w-full cta-gradient-btn h-11 text-[13px] font-bold rounded-xl">
        Nhận dự đoán chính xác của bạn →
      </Button>
      <p className="font-sans text-[11px] text-dim text-center">Dự đoán thực dùng thuật toán Kalman dựa trên lịch sử làm bài của bạn</p>
    </div>
  )
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="font-sans text-[14px] font-semibold text-foreground">{q}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}
          className="text-dim flex-shrink-0">▾</motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <p className="font-sans text-[13px] text-muted leading-relaxed px-5 pb-4">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Landing({ onOpenAuth }) {
  usePageMeta('', { description: 'Ôn tập Toán với 40+ đề thi thật từ 63 tỉnh thành — AI phát hiện lỗi sai, tạo kế hoạch học tập cá nhân hóa cho học sinh THPT & lớp 10.' })
  const navigate = useNavigate()
  const { user } = useAuth()
  const { results } = useHistory()
  const [searchParams] = useSearchParams()
  const [session, setSession] = useState(null)
  const [questionMap, setQuestionMap] = useState({})
  const [showStickyCta, setShowStickyCta] = useState(false)
  const [guestProvince, setGuestProvince] = useState(
    () => localStorage.getItem('guest_province') || ''
  )
  function handleProvinceChange(e) {
    const v = e.target.value
    setGuestProvince(v)
    if (v) localStorage.setItem('guest_province', v)
  }
  const streak = useMemo(() => computeStreak(results), [results])
  const daysUntil = user ? getDaysUntilExam(user.province) : null
  const province = user?.province ?? 'Hà Nội'
  const readiness = useReadiness(results, questionMap)
  const { scrollY, scrollYProgress } = useScroll()
  const heroY = useTransform(scrollY, [0, 400], [0, -30])

  useEffect(() => {
    return scrollY.on('change', v => setShowStickyCta(v > 480))
  }, [scrollY])

  useEffect(() => {
    if (!user?.id) { setSession(null); return }
    getSessionToday().then(({ data }) => { if (data) setSession(data) }).catch(() => {})
  }, [user?.id])

  useEffect(() => {
    if (!user || !session) return
    const recentScores = results.slice(0, 7).map(r => r.score ?? 0)
    const avgAccuracy = recentScores.length
      ? Math.round((recentScores.reduce((a, b) => a + b, 0) / recentScores.length) * 10)
      : null
    checkAndShowWeeklyReport({
      streak: session.learning_streak ?? streak,
      masteredThisWeek: 0,
      accuracyTrend: avgAccuracy,
    })
  }, [user?.id, session?.session_date]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || !results.length) return
    loadQuestions().then(qs => setQuestionMap(Object.fromEntries(qs.map(q => [q.id, q])))).catch(() => {})
  }, [user, results.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref && /^[A-Za-z0-9_-]{8,20}$/.test(ref)) {
      try { sessionStorage.setItem('pending_ref', ref) } catch {}
    }
  }, [searchParams])

  return (
    <motion.div
      className="min-h-screen relative overflow-hidden flex flex-col items-center"
      variants={pageVariants} initial="hidden" animate="show" exit="exit"
    >
      {/* Scroll progress bar */}
      <motion.div
        style={{ scaleX: scrollYProgress, transformOrigin: 'left' }}
        className="fixed top-0 left-0 right-0 h-[2px] bg-primary z-[60] pointer-events-none"
      />

      {/* Sticky header CTA */}
      <motion.div
        initial={false}
        animate={{ y: showStickyCta ? 0 : -64, opacity: showStickyCta ? 1 : 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 border-b border-surface"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      >
        <span className="font-sans text-[15px] font-bold text-foreground">Zenith</span>
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate('/practice/diagnostic')} size="sm" className="cta-gradient-btn text-[12px]">
            Thử ngay →
          </Button>
          {!user && (
            <Button onClick={onOpenAuth} variant="ghost" size="sm" className="text-[12px] border border-border">
              Đăng nhập
            </Button>
          )}
        </div>
      </motion.div>

      {/* ── Hero section ─────────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full overflow-hidden">
        {/* Aurora background blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="aurora-blob" style={{ width: 600, height: 600, top: '-10%', left: '-5%', background: 'radial-gradient(circle, #3B6FE8 0%, transparent 70%)', animationDuration: '22s' }} />
          <div className="aurora-blob" style={{ width: 500, height: 500, top: '10%', right: '-8%', background: 'radial-gradient(circle, #7C5CE8 0%, transparent 70%)', animationDuration: '18s', animationDelay: '-7s' }} />
          <div className="aurora-blob" style={{ width: 400, height: 400, bottom: '5%', left: '20%', background: 'radial-gradient(circle, #059669 0%, transparent 70%)', animationDuration: '26s', animationDelay: '-13s' }} />
        </div>
        {/* Grain texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" aria-hidden="true"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize: '200px' }}
        />

        <div className="flex flex-col items-center gap-10 text-center px-6 sm:px-8 pt-20 pb-16 w-full">
          <motion.div style={{ y: heroY }} className="flex flex-col items-center gap-5">
            <ZenithLogo variant="hero" />
            <span className="font-sans text-[11px] font-semibold text-primary tracking-[3px] uppercase">
              Kỳ thi tuyển sinh {getExamYear()} · Toán Lớp 10
            </span>
            <h1 className="font-sans text-foreground leading-[1.05] text-center"
              style={{ fontSize: 'clamp(3.2rem,7vw,5.5rem)', letterSpacing: '-0.025em', fontWeight: 800 }}>
              Học thật, đỗ thật.
            </h1>
            <p className="font-sans text-[17px] text-muted leading-relaxed max-w-[600px] text-center">
              Zenith xem bạn sai câu nào, tìm đúng chỗ mất điểm nhiều nhất, rồi luyện đúng chỗ đó thôi. Không tốn thời gian ôn những gì bạn đã biết rồi.
            </p>
          </motion.div>

          {/* Oracle input */}
          <div className="w-full max-w-xl flex flex-col items-center gap-4">
            <form
              className="w-full flex items-center gap-2 bg-surface/80 border border-info/30 rounded-xl px-4 py-3 focus-within:border-info/50 transition"
              style={{ backdropFilter: 'blur(8px)' }}
              onSubmit={e => {
                e.preventDefault()
                const q = e.target.query.value.trim()
                navigate(q ? `/oracle?q=${encodeURIComponent(q)}` : '/oracle')
              }}
            >
              <span className="text-info text-base select-none flex-shrink-0">✦</span>
              <input name="query" placeholder="Nhập bài toán cần giải..."
                className="flex-1 bg-transparent font-sans text-[15px] text-foreground placeholder-dim outline-none min-w-0" />
              <Button type="submit" size="sm" className="flex-shrink-0 font-semibold text-[13px]">Hỏi →</Button>
            </form>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 mb-3" data-testid="province-selector-wrap">
                <span className="font-sans text-[12px] text-dim">Tôi thi ở:</span>
                <Select
                  value={guestProvince || undefined}
                  onValueChange={v => handleProvinceChange({ target: { value: v } })}
                >
                  <SelectTrigger
                    data-testid="province-selector"
                    className="h-auto py-1 px-2 font-sans text-[12px] w-auto min-w-[120px]"
                  >
                    <SelectValue placeholder="Chọn tỉnh..." />
                  </SelectTrigger>
                  <SelectContent>
                    {VN_PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <motion.button onClick={() => navigate('/practice/diagnostic')}
                  className="px-5 py-2.5 rounded-xl font-sans text-[13px] font-bold cta-gradient-btn"
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                  Thi thử ngay — không cần đăng ký →
                </motion.button>
                <motion.button onClick={() => navigate('/diagnostic')}
                  className="px-5 py-2.5 rounded-xl font-sans text-[13px] font-semibold text-muted border border-surface bg-surface/60 hover:border-primary/30 hover:text-foreground transition"
                  style={{ backdropFilter: 'blur(4px)' }}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                  Kiểm tra năng lực
                </motion.button>
              </div>
              {!user && <p className="font-sans text-[11px] text-dim">Không cần đăng ký · Kết quả sau 5 phút</p>}
              {/* Objection strip */}
              <div className="flex flex-wrap gap-3 justify-center mt-4">
                {[
                  { q: 'Đề thi thật 63 tỉnh?', a: 'Có. 1,104 câu, cập nhật 2025' },
                  { q: 'Mất bao lâu?', a: '25 phút/ngày' },
                  { q: 'Có mất phí không?', a: 'Thử miễn phí. 29k/tháng khi sẵn sàng' },
                ].map(item => (
                  <div key={item.q} className="flex flex-col items-center px-4 py-2 rounded-xl border border-border bg-surface text-center min-w-[140px]">
                    <span className="font-sans text-[11px] text-dim">{item.q}</span>
                    <span className="font-sans text-[12px] font-semibold text-foreground mt-0.5">{item.a}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Today card — logged in */}
          {user && (
            <div className="w-full max-w-xl glass-card rounded-2xl px-5 py-4 flex items-center gap-5 flex-wrap">
              {session?.placement_needed && (
                <button onClick={() => navigate('/placement')}
                  className="flex items-center gap-1.5 font-sans text-[13px] font-semibold text-info hover:opacity-80 transition">
                  <span className="w-1.5 h-1.5 rounded-full bg-info" />
                  Bắt đầu kiểm tra năng lực →
                </button>
              )}
              {session?.pending_count > 0 && (
                <button onClick={() => navigate('/daily')}
                  className="flex items-center gap-1.5 font-sans text-[13px] font-semibold text-primary hover:opacity-80 transition">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {session.pending_count} câu sai đang chờ — thử lại không?
                </button>
              )}
              {(session?.learning_streak > 0 || streak > 0) && (
                <motion.span className="font-sans text-[13px] font-semibold text-primary"
                  animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}>
                  <span className="streak-fire">🔥</span> {session?.learning_streak ?? streak} ngày
                </motion.span>
              )}
              {daysUntil != null && <span className="font-sans text-[13px] font-semibold text-info">📅 Còn {daysUntil} ngày</span>}
              {session?.due_count > 0 && (
                <button onClick={() => navigate('/review')}
                  className="flex items-center gap-1.5 font-sans text-[13px] font-semibold text-success hover:opacity-80 transition">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  {session.due_count} câu cần ôn
                </button>
              )}
              {session?.remediation_concept && (session.remediation_concept.error_count ?? 0) >= 3 && (
                <button onClick={() => navigate('/review')}
                  className="flex items-center gap-1.5 font-sans text-[13px] font-semibold text-destructive hover:opacity-80 transition">
                  <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                  Sửa lỗi {session.remediation_concept.name_vi} →
                </button>
              )}
              {session?.advance_concept && !session?.is_complete && (
                <button onClick={() => navigate('/practice/adaptive')}
                  className="flex items-center gap-1.5 font-sans text-[13px] font-semibold text-info hover:opacity-80 transition">
                  ✦ Học {session.advance_concept.name_vi}
                </button>
              )}
              {readiness != null && <span className="font-sans text-[13px] font-semibold text-info">📊 {readiness.readiness}% sẵn sàng</span>}
              {session?.predicted_score != null && (
                <button onClick={() => navigate('/study-plan/adaptive')}
                  className="flex items-center gap-1.5 font-sans text-[13px] font-semibold hover:opacity-80 transition"
                  style={{ color: session.on_track ? 'var(--success)' : 'var(--accent)' }}>
                  {session.on_track ? '↗' : '⚠'} Dự kiến {session.predicted_score?.toFixed(1)}
                </button>
              )}
              <button onClick={() => navigate('/progress')} className="font-sans text-[12px] text-dim hover:text-muted transition">Bản đồ</button>
              <button onClick={() => navigate('/history')} className="ml-auto font-sans text-[12px] text-dim hover:text-muted transition">Lịch sử →</button>
            </div>
          )}

          {/* Ghost today card — guest only */}
          {!user && (
            <div className="w-full max-w-xl relative rounded-2xl border border-surface overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-5 flex-wrap blur-[3px] pointer-events-none select-none opacity-60">
                <span className="font-sans text-[13px] font-semibold text-primary">🔥 12 ngày</span>
                <span className="font-sans text-[13px] font-semibold text-info">📅 Còn 47 ngày</span>
                <span className="font-sans text-[13px] font-semibold text-success">📊 72% sẵn sàng</span>
                <span className="font-sans text-[13px] font-semibold text-info">↗ Dự kiến 7.5</span>
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-surface/60 backdrop-blur-[1px]">
                <button onClick={onOpenAuth}
                  className="px-5 py-2.5 rounded-xl font-sans text-[13px] font-bold text-background bg-primary hover:opacity-90 transition shadow-lg">
                  Đăng nhập để xem lộ trình của bạn →
                </button>
              </div>
            </div>
          )}

          {/* Proof strip */}
          <div className="flex items-center gap-2 flex-wrap justify-center font-sans text-[13px] text-dim">
            {[
              { value: '1,104', label: 'câu từ đề thi thật', color: '#6366F1' },
              { value: '63', label: 'tỉnh thành', color: '#6366F1' },
              { value: '6', label: 'dạng toán có Zenith AI', color: '#818CF8' },
              { value: 'FSRS', label: 'ghi nhớ thông minh', color: '#34D399' },
            ].map(({ value, label, color }, i, arr) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-[15px]" style={{ color }}>{value}</span>
                <span>{label}</span>
                {i < arr.length - 1 && <span className="text-border mx-2">·</span>}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bento grid features ───────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-10">
          <span className="font-sans text-[11px] font-semibold tracking-[3px] uppercase text-dim">Tính năng</span>
          <h2 className="font-sans font-bold text-foreground mt-2" style={{ fontSize: 'clamp(1.5rem,3vw,2.25rem)' }}>
            Những thứ app khác không có
          </h2>
        </div>
        <div className="grid grid-cols-12 gap-3">
          {BENTO_FEATURES.map(feat => (
            <motion.div
              key={feat.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              className={`${feat.col} glass-card rounded-2xl p-5 flex flex-col gap-3 overflow-hidden relative`}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${feat.accent}99, var(--primary-subtle))` }} />
              <div className="flex items-start gap-2">
                <span className="text-2xl flex-shrink-0">{feat.icon}</span>
                <div>
                  <p className="font-sans text-[14px] font-bold text-foreground">{feat.title}</p>
                  <p className="font-sans text-[12px] text-dim">{feat.desc}</p>
                </div>
              </div>
              {feat.stat && (
                <p className="font-sans font-bold" style={{ fontSize: 'clamp(1.75rem,4vw,2.5rem)', color: feat.accent }}>{feat.stat}</p>
              )}
              {feat.id === 'analysis' && feat.preview && (
                <div className="flex flex-col gap-1.5 mt-1">
                  {feat.preview.map(r => (
                    <div key={r.topic} className="flex flex-col gap-0.5">
                      <div className="flex justify-between font-sans text-[11px]">
                        <span className="text-muted">{r.topic}</span>
                        <span style={{ color: r.color }}>{r.pct}%</span>
                      </div>
                      <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                        <motion.div className="h-full rounded-full"
                          initial={{ width: 0 }}
                          whileInView={{ width: `${r.pct}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8, delay: 0.1 }}
                          style={{ background: r.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {feat.id === 'map' && feat.preview && (
                <div className="flex flex-col gap-1.5 mt-1">
                  {feat.preview.map(r => (
                    <div key={r.concept} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
                      <span className="font-sans text-[11px] text-muted flex-1 truncate">{r.concept}</span>
                      <span className="font-sans text-[11px] font-bold flex-shrink-0" style={{ color: r.color }}>{r.mastery}%</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="text-center mb-10">
          <span className="font-sans text-[11px] font-semibold tracking-[3px] uppercase text-dim">Cách hoạt động</span>
          <h2 className="font-sans font-bold text-foreground mt-2" style={{ fontSize: 'clamp(1.5rem,3vw,2.25rem)' }}>
            Dùng thế nào?
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { step: '01', title: 'Làm đề thật của tỉnh mình', desc: 'Đề từ tỉnh bạn, cập nhật 2025. Zenith ghi lại bạn sai câu nào — không chỉ tổng điểm.', color: '#6366F1' },
            { step: '02', title: 'Biết mình đang yếu chỗ nào', desc: 'Không phải \'sai 15/50 câu\'. Là: Hình học — bạn sai 7/8 câu phần đường tròn.', color: '#8B5CF6' },
            { step: '03', title: 'AI nhắc ôn đúng lúc bạn sắp quên', desc: 'Zenith nhắc bạn ôn lại câu đó đúng lúc bạn sắp quên. Không cần tự nhớ ôn — app tự nhắc.', color: '#06B6D4' },
          ].map(({ step, title, desc, color }, i) => (
            <motion.div key={step}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="glass-card rounded-2xl p-5 flex flex-col gap-3">
              <span className="font-sans font-bold leading-none" style={{ fontSize: 'clamp(2rem,4vw,3rem)', color: color + '44' }}>{step}</span>
              <p className="font-sans text-[14px] font-semibold text-foreground">{title}</p>
              <p className="font-sans text-[12px] text-dim leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Comparison table ─────────────────────────────────────────────────── */}
      <section className="py-16 px-4 max-w-3xl mx-auto" data-testid="comparison-table">
        <h2 className="font-sans text-[22px] font-bold text-foreground text-center mb-2">
          "Sách cho bạn đề. Zenith cho bạn chẩn đoán."
        </h2>
        <p className="font-sans text-[13px] text-dim text-center mb-8">Tại sao chẩn đoán quan trọng hơn làm đề tràn lan?</p>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-dim font-normal"></th>
                <th className="py-2 text-center text-dim font-normal">Sách luyện đề</th>
                <th className="py-2 text-center text-dim font-normal">YouTube</th>
                <th className="py-2 text-center font-bold text-primary border-b-2 border-primary bg-primary-subtle/30 rounded-t-lg px-2">Zenith</th>
              </tr>
            </thead>
            <tbody>
              {[
                { feature: 'Đề thi thật',             sach: true,  yt: false, zenith: true  },
                { feature: 'Chẩn đoán điểm yếu',      sach: false, yt: false, zenith: true  },
                { feature: 'AI giải Socratic',         sach: false, yt: false, zenith: true  },
                { feature: 'Lộ trình cá nhân',        sach: false, yt: false, zenith: true  },
                { feature: 'Ôn lại đúng lúc (FSRS)', sach: false, yt: false, zenith: true  },
              ].map(row => (
                <tr key={row.feature} className="border-b border-border/50">
                  <td className="py-2.5 text-foreground">{row.feature}</td>
                  <td className="py-2.5 text-center text-dim">{row.sach ? '✓' : '✗'}</td>
                  <td className="py-2.5 text-center text-dim">{row.yt ? '✓' : '✗'}</td>
                  <td className="py-2.5 text-center font-bold text-primary bg-[var(--primary-subtle)]/20 px-2" data-testid="zenith-cell">{row.zenith ? '✓' : '✗'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Score prediction ─────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.4 }}
          className="glass-card rounded-2xl p-8"
        >
          <div className="text-center mb-6">
            <span className="font-sans text-[11px] font-semibold tracking-[3px] uppercase text-dim">Dự đoán điểm</span>
            <h2 className="font-sans font-bold text-foreground mt-2" style={{ fontSize: 'clamp(1.25rem,2.5vw,1.75rem)' }}>
              Bạn có thể đạt bao nhiêu điểm?
            </h2>
            <p className="font-sans text-[13px] text-dim mt-1">Điều chỉnh điểm hiện tại để xem dự đoán Zenith</p>
          </div>
          <div className="max-w-lg mx-auto">
            <Demo4ScoreSlider onOpenAuth={onOpenAuth} />
          </div>
        </motion.div>
      </div>

      {/* ── Testimonials (auto-scroll) ────────────────────────────────────────── */}
      <div className="relative z-10 w-full py-16 overflow-hidden">
        <div className="text-center mb-8">
          <h2 className="font-sans font-bold text-foreground" style={{ fontSize: 'clamp(1.25rem,2.5vw,1.75rem)' }}>
            Học sinh nói gì về Zenith
          </h2>
        </div>
        <div className="relative w-full overflow-hidden">
          <div className="testimonials-strip flex gap-4 px-4" style={{ width: 'max-content' }}>
            {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
              <div key={i} className="glass-card rounded-2xl p-5 flex flex-col gap-3 flex-shrink-0" style={{ width: 280 }}>
                <p className="font-sans text-[13px] text-muted leading-relaxed italic flex-1">"{t.quote}"</p>
                <div className="pt-2 border-t border-border/30">
                  <p className="font-sans text-[13px] font-semibold text-foreground">{t.name}</p>
                  <p className="font-sans text-[11px] text-dim">{t.grade}</p>
                  <p className="font-sans text-[11px] text-success mt-0.5">✓ {t.result}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-20"
            style={{ background: 'linear-gradient(90deg, var(--background), transparent)' }} />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-20"
            style={{ background: 'linear-gradient(270deg, var(--background), transparent)' }} />
        </div>
      </div>

      {/* ── Exam phase / countdown strip ─────────────────────────────────────── */}
      {(() => {
        const d = getDaysUntilExam(user?.province ?? null)
        if (d == null) return null
        const phase = d > 60
          ? { bg: '#0D1A1F', border: '#134E4A', color: '#34D399', msg: `Giai đoạn nền tảng · Còn ${d} ngày — xây vững kiến thức cơ bản` }
          : d > 14
          ? { bg: '#1A130A', border: '#78350F', color: '#F2A20C', msg: `Giai đoạn luyện đề · Còn ${d} ngày — tập trung làm thật nhiều đề` }
          : { bg: '#1A0808', border: '#7F1D1D', color: '#EF4444', msg: `Giai đoạn nước rút · Còn ${d} ngày — tập trung tối đa, không học dàn trải` }
        return (
          <div className="relative z-10 w-full px-4 sm:px-8 py-3 flex items-center justify-center gap-3"
            style={{ background: phase.bg, borderTop: `1px solid ${phase.border}`, borderBottom: `1px solid ${phase.border}` }}>
            <span className="font-sans text-[13px] font-semibold" style={{ color: phase.color }}>{phase.msg}</span>
            <button onClick={() => navigate('/study-plan/adaptive')}
              className="flex-shrink-0 font-sans text-[12px] font-semibold underline underline-offset-2 hover:opacity-80 transition"
              style={{ color: phase.color }}>
              Xem kế hoạch →
            </button>
          </div>
        )
      })()}

      {/* ── Pricing ──────────────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <div className="h-px w-full mb-12" style={{ background: 'linear-gradient(90deg, transparent, var(--border), transparent)' }} />
        <div className="flex flex-col items-center gap-2 text-center mb-8">
          <span className="font-sans text-[28px] font-bold text-foreground">7 ngày — biết ngay 3 điểm yếu cần sửa</span>
          <p className="font-sans text-[14px] text-dim">Không cần thẻ ngân hàng · Hủy bất cứ lúc nào · Hoàn tiền 7 ngày nếu không hài lòng</p>
        </div>
        <div className="flex flex-col gap-3">
          {PLANS_MONTHLY.map((plan, i) => (
            <motion.div key={plan.tier}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.35, delay: i * 0.07 }}
              className="glass-card flex items-start justify-between gap-4 px-6 py-5 rounded-2xl"
              style={{ border: `1px solid ${plan.tier === 'student' ? '#6366F144' : 'var(--border)'}`, background: plan.tier === 'student' ? 'var(--primary-subtle)' : undefined }}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-sans text-[15px] font-bold text-foreground">{plan.label}</span>
                  {plan.badge && (
                    <span className="font-sans text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary">{plan.badge}</span>
                  )}
                </div>
                <span className="font-sans text-[12px] text-dim">⚡ {plan.credits.toLocaleString()} credits / tháng</span>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                  {plan.features.map(f => <span key={f} className="font-sans text-[12px] text-dim">✓ {f}</span>)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <span className="font-sans text-[16px] font-bold text-foreground">{plan.price}</span>
                {plan.tier !== 'basic' && (
                  <>
                    <motion.button
                      onClick={user ? () => navigate('/account') : onOpenAuth}
                      className="inline-flex items-center justify-center px-4 py-1.5 rounded-[var(--radius-md)] font-sans text-[12px] font-bold bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary)]/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                      {user ? (plan.tier === 'student' ? 'Bắt đầu học ngay' : 'Mở khóa toàn bộ') : 'Đăng nhập'}
                    </motion.button>
                    <span className="font-sans text-[10px] text-dim">✓ Hoàn tiền 7 ngày · Không hỏi lý do · = 1 cốc trà sữa/tuần</span>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-4">
          <span className="font-sans text-[13px] font-semibold text-muted text-center">Hoặc nạp thêm credits</span>
          <div className="flex gap-3 flex-wrap justify-center">
            {TOPUP_PACKAGES.map(pkg => (
              <div key={pkg.price} className="glass-card flex flex-col items-center gap-1 px-6 py-4 rounded-xl">
                <span className="font-sans text-[18px] font-bold text-primary">⚡ {pkg.credits}</span>
                <span className="font-sans text-[12px] text-dim">{pkg.price}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 pb-16">
        <h2 className="font-sans font-bold text-foreground text-center mb-6" style={{ fontSize: 'clamp(1.25rem,2.5vw,1.75rem)' }}>
          Câu hỏi thường gặp
        </h2>
        <div className="flex flex-col gap-2">
          {FAQ_ITEMS.map(item => <FaqItem key={item.q} q={item.q} a={item.a} />)}
        </div>
      </div>

      {/* ── CTA banner ───────────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full overflow-hidden">
        {/* Aurora blobs for CTA */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="aurora-blob" style={{ width: 500, height: 500, top: '-30%', left: '10%', background: 'radial-gradient(circle, #3B6FE8 0%, transparent 70%)', animationDuration: '20s' }} />
          <div className="aurora-blob" style={{ width: 400, height: 400, bottom: '-20%', right: '5%', background: 'radial-gradient(circle, #7C5CE8 0%, transparent 70%)', animationDuration: '24s', animationDelay: '-8s' }} />
        </div>
        <div className="flex flex-col items-center gap-6 text-center py-24 px-6 relative">
          <h2 className="font-sans font-bold text-foreground max-w-xl"
            style={{ fontSize: 'clamp(1.75rem,4vw,3rem)', letterSpacing: '-0.02em' }}>
            Thử ngay — chỉ mất 5 phút
          </h2>
          <p className="font-sans text-[15px] text-muted max-w-sm">
            Miễn phí · Không cần đăng ký · Kết quả sau 8 câu
          </p>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <motion.button onClick={() => navigate('/practice/diagnostic')}
              className="px-7 py-3.5 rounded-xl font-sans text-[15px] font-bold cta-gradient-btn"
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
              Thi thử ngay →
            </motion.button>
            {!user && (
              <motion.button onClick={onOpenAuth}
                className="px-7 py-3.5 rounded-xl font-sans text-[15px] font-semibold text-foreground border border-border bg-surface/60 hover:border-primary/40 transition"
                style={{ backdropFilter: 'blur(4px)' }}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                Đăng nhập với Google
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 w-full border-t border-border mt-8 px-6 sm:px-10 py-12">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-10 justify-between">

          {/* Brand block */}
          <div className="flex flex-col gap-3 max-w-[220px]">
            <span className="font-sans text-[16px] font-bold text-foreground">Zenith</span>
            <span className="font-sans text-[12px] text-dim leading-relaxed">
              Nền tảng luyện thi Toán THPT &amp; Lớp 10 được cá nhân hóa bởi AI.
            </span>
            <div className="flex gap-2 mt-1">
              <a href="https://github.com" target="_blank" rel="noreferrer" aria-label="GitHub"
                className="p-1.5 rounded-lg border border-border text-dim hover:text-muted hover:border-border-subtle transition">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.51 11.51 0 0 1 12 6.598c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>
              <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook"
                className="p-1.5 rounded-lg border border-border text-dim hover:text-muted hover:border-border-subtle transition">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073C24 5.446 18.627 0 12 0S0 5.446 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.025 1.791-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.971H15.83c-1.491 0-1.956.932-1.956 1.888v2.262h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Link columns */}
          <div className="flex gap-10 flex-wrap">
            <div className="flex flex-col gap-2">
              <span className="font-sans text-[10px] font-bold uppercase tracking-[2px] text-dim mb-1">Sản phẩm</span>
              {[['Thi thử', '/exams'], ['Luyện tập', '/exams?mode=practice'],
                ['Zenith AI', '/oracle'], ['⚗ Lab', '/exams?mode=lab'],
                ['Bản đồ kiến thức', '/mastery']].map(([label, path]) => (
                <button key={label} onClick={() => navigate(path)}
                  className="font-sans text-[12px] text-dim hover:text-muted transition text-left">{label}</button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-sans text-[10px] font-bold uppercase tracking-[2px] text-dim mb-1">Tài khoản</span>
              {[['Đăng nhập', null, onOpenAuth], ['Nâng cấp', '/account', null],
                ['Lịch sử thi', '/history', null]].map(([label, path, fn]) => (
                <button key={label} onClick={fn ?? (() => navigate(path))}
                  className="font-sans text-[12px] text-dim hover:text-muted transition text-left">{label}</button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-sans text-[10px] font-bold uppercase tracking-[2px] text-dim mb-1">Hỗ trợ</span>
              {[['Về chúng tôi', '#'], ['Phản hồi', '#'], ['Điều khoản', '#'], ['Riêng tư', '#']].map(([label, href]) => (
                <a key={label} href={href}
                  className="font-sans text-[12px] text-dim hover:text-muted transition">{label}</a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="max-w-5xl mx-auto mt-8 pt-4 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-sans text-[11px] text-dim">© {new Date().getFullYear()} Zenith. Tất cả đề thi từ nguồn chính thức.</p>
          <div className="flex gap-4">
            <a href="#" className="font-sans text-[11px] text-dim hover:text-muted transition">Điều khoản dịch vụ</a>
            <a href="#" className="font-sans text-[11px] text-dim hover:text-muted transition">Chính sách bảo mật</a>
          </div>
        </div>
      </footer>
    </motion.div>
  )
}
