import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import { pageVariants } from '../utils/animations.js'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { useAuth } from '../context/AuthContext.jsx'
import AmbientGlows from '../components/AmbientGlows.jsx'
import { useHistory } from '../context/HistoryContext.jsx'
import { computeStreak } from '../utils/streak.js'
import { getDaysUntilExam, getExamYear } from '../utils/examCountdown.js'
import { useReadiness } from '../hooks/useReadiness.js'
import { loadQuestions } from '../api/index.js'
import { getSessionToday } from '../api/aiClient.js'
import { checkAndShowWeeklyReport } from '../utils/studyReminder.js'
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
    features: ['Tất cả gói Học sinh', 'Tạo đề AI riêng', 'Dự đoán điểm số', 'Kế hoạch thích nghi AI', 'Chiến lược thi', 'So sánh tỉnh thành'],
  },
]

const TOPUP_PACKAGES = [
  { price: '15,000đ', credits: 150 },
  { price: '29,000đ', credits: 350 },
  { price: '59,000đ', credits: 800 },
]


export default function Landing({ onOpenAuth }) {
  usePageMeta('', { description: 'Ôn tập Toán với 40+ đề thi thật từ 63 tỉnh thành — AI phát hiện lỗi sai, tạo kế hoạch học tập cá nhân hóa cho học sinh THPT & lớp 10.' })
  const navigate = useNavigate()
  const { user } = useAuth()
  const { results } = useHistory()
  const [searchParams] = useSearchParams()
  const [session, setSession] = useState(null) // server session data for logged-in users
  const [questionMap, setQuestionMap] = useState({})
  const streak = useMemo(() => computeStreak(results), [results])
  const daysUntil = user ? getDaysUntilExam(user.province) : null
  const readiness = useReadiness(results, questionMap)
  const { scrollY } = useScroll()
  const heroY = useTransform(scrollY, [0, 400], [0, -30])

  useEffect(() => {
    if (!user?.id) { setSession(null); return }
    getSessionToday().then(({ data }) => { if (data) setSession(data) }).catch(() => {})
  }, [user?.id])

  // Weekly report — fires once per week on Sun/Mon using available local data
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
      variants={pageVariants} initial="hidden" animate="show" exit="exit"
      style={{ background: 'radial-gradient(ellipse 140% 100% at 50% 35%, #1B2B4B 0%, #0A0E1A 100%)' }}
    >
      <AmbientGlows className="absolute inset-0 z-0" />
      {/* Hero section */}
      <div
        className="relative z-10 flex flex-col items-center gap-10 text-center px-6 sm:px-8 pt-20 pb-16 w-full"
      >
        <motion.div style={{ y: heroY }} className="flex flex-col items-center gap-5">
          <ZenithLogo variant="hero" />
          <span className="font-jakarta text-[0.6875rem] font-semibold text-primary tracking-[3px] uppercase">
            Kỳ thi tuyển sinh {getExamYear()} · Toán Lớp 10
          </span>
          <h1 className="font-fraunces text-[56px] sm:text-[72px] font-bold text-foreground leading-[1.05] text-center">
            <motion.span
              className="block"
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            >
              {['Học', 'để', 'hiểu,'].map((word, i) => (
                <motion.span
                  key={i}
                  className="inline-block mr-[0.25em]"
                  variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } } }}
                >{word}</motion.span>
              ))}
            </motion.span>
            <motion.span
              className="block"
              style={{ color: '#F2A20C' }}
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.22 } } }}
            >
              {['không', 'học', 'để', 'quên.'].map((word, i) => (
                <motion.span
                  key={i}
                  className="inline-block mr-[0.25em]"
                  variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } } }}
                >{word}</motion.span>
              ))}
            </motion.span>
          </h1>
          <p className="font-jakarta text-[17px] text-muted leading-relaxed max-w-[600px] text-center">
            Toán Oracle giải từng bước — bạn học cách tư duy, không chỉ học đáp án.<br />
            <span className="text-dim text-[15px]">
              40+ đề thật từ 63 tỉnh thành · AI phát hiện lỗi sai và chỉ cách sửa.
            </span>
          </p>
        </motion.div>

        {/* Oracle input + secondary links */}
        <div className="w-full max-w-xl flex flex-col items-center gap-4">
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
              className="flex-1 bg-transparent font-jakarta text-[15px] text-highlight placeholder-faint outline-none min-w-0"
            />
            <button type="submit"
              className="flex-shrink-0 px-4 py-1.5 rounded-lg bg-[#6366F1] text-white font-jakarta text-[0.8125rem] font-semibold hover:bg-[#4F46E5] transition">
              Hỏi →
            </button>
          </form>
          <div className="flex items-center gap-3">
            <motion.button onClick={() => navigate('/exams')}
              className="px-5 py-2.5 rounded-xl font-jakarta text-[0.8125rem] font-bold text-primary-fg bg-primary hover:opacity-90 transition"
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
              Thi thử ngay →
            </motion.button>
            <motion.button onClick={() => navigate('/diagnostic')}
              className="px-5 py-2.5 rounded-xl font-jakarta text-[0.8125rem] font-semibold text-muted border border-border hover:border-[#2A3A50] hover:text-highlight transition"
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
              Kiểm tra năng lực
            </motion.button>
          </div>
        </div>

        {/* Today card — logged-in users */}
        {user && (
          <div
            className="w-full max-w-xl bg-[#0D1527] border border-border rounded-2xl px-5 py-4 flex items-center gap-5 flex-wrap"
          >
            {session?.placement_needed && (
              <button onClick={() => navigate('/placement')}
                className="flex items-center gap-1.5 font-jakarta text-[0.8125rem] font-semibold text-[#6366F1] hover:opacity-80 transition">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] " />
                Bắt đầu kiểm tra năng lực →
              </button>
            )}
            {session?.pending_count > 0 && (
              <button onClick={() => navigate('/daily')}
                className="flex items-center gap-1.5 font-jakarta text-[0.8125rem] font-semibold text-primary hover:opacity-80 transition">
                <span className="w-1.5 h-1.5 rounded-full bg-primary " />
                {session.pending_count} câu sai đang chờ — thử lại không?
              </button>
            )}
            {(session?.learning_streak > 0 || streak > 0) && (
              <motion.span
                className="font-jakarta text-[0.8125rem] font-semibold text-primary"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                <span className="streak-fire">🔥</span> {session?.learning_streak ?? streak} ngày
              </motion.span>
            )}
            {daysUntil != null && (
              <span className="font-jakarta text-[0.8125rem] font-semibold text-[#818CF8]">📅 Còn {daysUntil} ngày</span>
            )}
            {(session?.due_count > 0) && (
              <button onClick={() => navigate('/review')}
                className="flex items-center gap-1.5 font-jakarta text-[0.8125rem] font-semibold text-[#34D399] hover:opacity-80 transition">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] " />
                {session.due_count} câu cần ôn
              </button>
            )}
            {session?.remediation_concept && (session.remediation_concept.error_count ?? 0) >= 3 && (
              <button onClick={() => navigate('/review')}
                className="flex items-center gap-1.5 font-jakarta text-[0.8125rem] font-semibold text-destructive hover:opacity-80 transition">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive " />
                Sửa lỗi {session.remediation_concept.name_vi} →
              </button>
            )}
            {session?.advance_concept && !session?.is_complete && (
              <button onClick={() => navigate('/practice/adaptive')}
                className="flex items-center gap-1.5 font-jakarta text-[0.8125rem] font-semibold text-[#818CF8] hover:opacity-80 transition">
                ✦ Học {session.advance_concept.name_vi}
              </button>
            )}
            {readiness != null && (
              <span className="font-jakarta text-[0.8125rem] font-semibold text-[#818CF8]">
                📊 {readiness.readiness}% sẵn sàng
              </span>
            )}
            {session?.predicted_score != null && (
              <button
                onClick={() => navigate('/study-plan/adaptive')}
                className="flex items-center gap-1.5 font-jakarta text-[0.8125rem] font-semibold hover:opacity-80 transition"
                style={{ color: session.on_track ? '#34D399' : '#F2A20C' }}
              >
                {session.on_track ? '↗' : '⚠'} Dự kiến {session.predicted_score?.toFixed(1)}
              </button>
            )}
            <button onClick={() => navigate('/progress')}
              className="font-jakarta text-xs text-faint hover:text-muted transition">
              Bản đồ
            </button>
            <button onClick={() => navigate('/history')}
              className="ml-auto font-jakarta text-xs text-faint hover:text-muted transition">
              Lịch sử →
            </button>
          </div>
        )}

        {/* Ghost Today card — guests only: teases personalization to drive signup */}
        {!user && (
          <div className="w-full max-w-xl relative rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-5 flex-wrap blur-[3px] pointer-events-none select-none opacity-60">
              <span className="font-jakarta text-[0.8125rem] font-semibold text-primary">🔥 12 ngày</span>
              <span className="font-jakarta text-[0.8125rem] font-semibold text-[#818CF8]">📅 Còn 47 ngày</span>
              <span className="font-jakarta text-[0.8125rem] font-semibold text-[#34D399]">📊 72% sẵn sàng</span>
              <span className="font-jakarta text-[0.8125rem] font-semibold text-[#818CF8]">↗ Dự kiến 7.5</span>
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
              <button
                onClick={onOpenAuth}
                className="px-5 py-2.5 rounded-xl font-jakarta text-[0.8125rem] font-bold text-primary-fg bg-primary hover:opacity-90 transition shadow-lg">
                Đăng nhập để xem lộ trình của bạn →
              </button>
            </div>
          </div>
        )}

        {/* Proof strip */}
        <div className="flex items-center gap-2 flex-wrap justify-center font-jakarta text-[0.8125rem] text-faint">
          {[
            { value: '1,104', label: 'câu từ đề thi thật', color: '#F2A20C' },
            { value: '63', label: 'tỉnh thành', color: '#F2A20C' },
            { value: '6', label: 'dạng toán có Oracle AI', color: '#818CF8' },
            { value: 'FSRS', label: 'ghi nhớ thông minh', color: '#34D399' },
          ].map(({ value, label, color }, i, arr) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="font-fraunces font-bold text-[15px]" style={{ color }}>{value}</span>
              <span>{label}</span>
              {i < arr.length - 1 && <span className="text-border mx-2">·</span>}
            </span>
          ))}
        </div>

        {/* Benefits strip */}
        <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-3 gap-3 px-0">
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
              className="flex flex-col gap-2 bg-[#0D1527] border border-border rounded-2xl px-5 py-4 text-left">
              <span className="text-xl" style={{ color: iconColor }}>{icon}</span>
              <span className="font-jakarta text-sm font-semibold text-highlight">{title}</span>
              <span className="font-jakarta text-xs text-dim leading-relaxed">{desc}</span>
            </div>
          ))}
        </div>
        {/* AI Analysis Demo */}
        <div className="w-full max-w-3xl flex flex-col sm:flex-row gap-6 items-stretch text-left">
          {/* Left: mock result card */}
          <div className="flex-1 bg-[#0D1527] border border-border rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-jakarta text-[0.6875rem] font-bold tracking-[2px] uppercase text-faint">Kết quả phân tích</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-fraunces text-[28px] font-bold text-primary">6.5</span>
              <div className="flex flex-col">
                <span className="font-jakarta text-xs text-muted font-semibold">Điểm THPT 2025</span>
                <span className="font-jakarta text-[0.6875rem] text-faint">Học sinh · Hà Nội</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {[
                { topic: 'Hàm số', pct: 42, color: '#EF4444' },
                { topic: 'Hình học không gian', pct: 55, color: '#F2A20C' },
                { topic: 'Tích phân', pct: 68, color: '#F2A20C' },
              ].map(({ topic, pct, color }) => (
                <div key={topic} className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-jakarta text-[0.6875rem] text-dim">
                    <span>{topic}</span><span style={{ color }}>{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border">
                    <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {['Sai quy tắc L\'Hôpital', 'Nhầm công thức thể tích'].map(tag => (
                <span key={tag} className="font-jakarta text-[0.625rem] px-2 py-0.5 rounded-full bg-[#EF444420] text-[#EF4444]">{tag}</span>
              ))}
            </div>
          </div>
          {/* Right: 3-step explanation */}
          <div className="flex-1 flex flex-col justify-center gap-4">
            <p className="font-fraunces text-[20px] font-bold text-foreground leading-tight">
              AI không chỉ chấm điểm — AI <span style={{ color: '#F2A20C' }}>tìm ra lỗi sai</span> của bạn
            </p>
            {[
              { step: '①', text: 'Đọc từng câu trả lời và so sánh với lời giải chuẩn' },
              { step: '②', text: 'Phát hiện pattern lỗi: sai công thức, sai dấu, lỗ hổng khái niệm' },
              { step: '③', text: 'Đề xuất bài luyện đúng điểm yếu — không luyện lan man' },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-start gap-3">
                <span className="font-fraunces text-[15px] font-bold text-primary flex-shrink-0">{step}</span>
                <span className="font-jakarta text-[0.8125rem] text-muted leading-relaxed">{text}</span>
              </div>
            ))}
            <button
              onClick={() => navigate('/exams')}
              className="self-start mt-2 font-jakarta text-[0.8125rem] font-semibold text-primary hover:opacity-80 transition">
              Làm bài thử để xem phân tích của bạn →
            </button>
          </div>
        </div>
      </div>

      {/* Exam phase / countdown strip */}
      {(() => {
        const d = getDaysUntilExam(user?.province ?? null)
        if (d == null) return null
        const phase = d > 60 ? { bg: '#0D1A1F', border: '#134E4A', color: '#34D399', msg: `Giai đoạn nền tảng · Còn ${d} ngày — xây vững kiến thức cơ bản` }
          : d > 14  ? { bg: '#1A130A', border: '#78350F', color: '#F2A20C', msg: `Giai đoạn luyện đề · Còn ${d} ngày — tập trung làm thật nhiều đề` }
          : { bg: '#1A0808', border: '#7F1D1D', color: '#EF4444', msg: `Giai đoạn nước rút · Còn ${d} ngày — tập trung tối đa, không học dàn trải` }
        return (
          <div className="relative z-10 w-full px-4 sm:px-8 py-3 flex items-center justify-center gap-3"
            style={{ background: phase.bg, borderTop: `1px solid ${phase.border}`, borderBottom: `1px solid ${phase.border}` }}>
            <span className="font-jakarta text-[0.8125rem] font-semibold" style={{ color: phase.color }}>{phase.msg}</span>
            <button onClick={() => navigate('/study-plan/adaptive')}
              className="flex-shrink-0 font-jakarta text-xs font-semibold underline underline-offset-2 hover:opacity-80 transition"
              style={{ color: phase.color }}>
              Xem kế hoạch →
            </button>
          </div>
        )
      })()}

      {/* Pricing section */}
      <div className="relative z-10 w-full max-w-3xl mx-auto px-4 sm:px-6 pb-24 flex flex-col gap-10">
        <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, #1E2A44, transparent)' }} />

        <div className="flex flex-col items-center gap-2 text-center">
          <span className="font-fraunces text-[28px] font-bold text-foreground">Bắt đầu miễn phí</span>
          <p className="font-jakarta text-sm text-dim">Không cần thẻ ngân hàng · Nâng cấp khi bạn sẵn sàng</p>
        </div>

        <div className="flex flex-col gap-3">
          {PLANS_MONTHLY.map(plan => (
            <div
              key={plan.tier}
              className="flex items-start justify-between gap-4 px-6 py-5 rounded-2xl border cursor-default"
              style={{
                background: plan.tier === 'student' ? '#0F1A10' : '#0D1221',
                border: `1px solid ${plan.tier === 'student' ? '#F2A20C44' : '#1E2A44'}`,
              }}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-jakarta text-[15px] font-bold text-highlight">{plan.label}</span>
                  {plan.badge && (
                    <span className="font-jakarta text-[0.625rem] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400">
                      {plan.badge}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-jakarta text-xs text-dim">⚡ {plan.credits.toLocaleString()} Tia / tháng</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                  {plan.features.map(f => (
                    <span key={f} className="font-jakarta text-xs text-dim">✓ {f}</span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <span className="font-fraunces text-[16px] font-bold text-highlight">{plan.price}</span>
                {plan.tier !== 'basic' && (
                  <>
                    <motion.button
                      onClick={user ? () => navigate('/account') : onOpenAuth}
                      className="ripple-btn px-4 py-1.5 rounded-lg font-jakarta text-xs font-bold text-primary-fg hover:opacity-90 transition"
                      style={{ background: '#F2A20C' }}
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                      {user ? (plan.tier === 'student' ? 'Bắt đầu học ngay' : 'Mở khóa toàn bộ') : 'Đăng nhập'}
                    </motion.button>
                    <span className="font-jakarta text-[0.625rem] text-faint">✓ Hoàn tiền trong 7 ngày</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Top-up packages */}
        <div className="flex flex-col gap-4">
          <span className="font-jakarta text-[0.8125rem] font-semibold text-muted text-center">Hoặc nạp thêm Tia</span>
          <div className="flex gap-3 flex-wrap justify-center">
            {TOPUP_PACKAGES.map(pkg => (
              <div key={pkg.price}
                className="flex flex-col items-center gap-1 px-6 py-4 rounded-xl border border-border bg-surface">
                <span className="font-fraunces text-[18px] font-bold text-amber-400">⚡ {pkg.credits}</span>
                <span className="font-jakarta text-xs text-dim">{pkg.price}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonials */}
        <div className="flex flex-col gap-5">
          <h2 className="font-fraunces text-[22px] font-bold text-foreground text-center">Học sinh nói gì về Zenith</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                name: 'Nguyễn Minh Anh',
                grade: 'Lớp 12 · Hà Nội',
                result: 'Đạt 8.0 Toán THPT 2024',
                quote: 'Oracle giải thích từng bước rõ ràng hơn sách giáo khoa. Mình hiểu bản chất, không chỉ nhớ công thức.',
              },
              {
                name: 'Trần Thảo Linh',
                grade: 'Lớp 9 · TP. Hồ Chí Minh',
                result: 'Đỗ THPT Chuyên Lê Hồng Phong',
                quote: 'AI chỉ đúng điểm yếu của mình là Hình học. Luyện đúng chỗ, tiết kiệm thời gian hơn nhiều.',
              },
              {
                name: 'Phạm Đức Huy',
                grade: 'Lớp 11 · Đà Nẵng',
                result: 'Tăng từ 5.5 lên 7.5 trong 2 tháng',
                quote: 'Thích nhất là thấy được mình đang ở đâu so với học sinh cùng tỉnh. Tạo động lực học hẳn.',
              },
            ].map(({ name, grade, result, quote }) => (
              <div key={name} className="flex flex-col gap-3 bg-[#0D1527] border border-border rounded-2xl px-5 py-4">
                <p className="font-jakarta text-[0.8125rem] text-muted leading-relaxed italic">"{quote}"</p>
                <div className="mt-auto pt-2 border-t border-border">
                  <p className="font-jakarta text-[0.8125rem] font-semibold text-highlight">{name}</p>
                  <p className="font-jakarta text-[0.6875rem] text-faint">{grade}</p>
                  <p className="font-jakarta text-[0.6875rem] text-[#34D399] mt-0.5">✓ {result}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="flex flex-col gap-4">
          <h2 className="font-fraunces text-[22px] font-bold text-foreground text-center">Câu hỏi thường gặp</h2>
          <div className="flex flex-col gap-2">
            {[
              {
                q: 'Zenith có khác gì so với ôn thi thông thường?',
                a: 'AI tìm ra lỗi sai cụ thể trong bài làm và đề xuất bài luyện phù hợp — không chỉ chấm điểm như các nền tảng thông thường.',
              },
              {
                q: 'Tôi có phải trả tiền không?',
                a: 'Miễn phí hoàn toàn để bắt đầu với 50 Tia và 1 đề thi thử. Nâng cấp khi bạn muốn dùng thêm tính năng AI.',
              },
              {
                q: 'Đề thi trên Zenith có thật không?',
                a: '1,104 câu hỏi từ đề thi chính thức của Bộ GD&ĐT và 63 tỉnh thành. Tất cả câu hỏi từ nguồn thật — không có câu do AI tạo ra.',
              },
              {
                q: 'Zenith dùng được cho học sinh lớp 9 thi vào lớp 10 không?',
                a: 'Có — Zenith bao gồm đề tuyển sinh lớp 10 từ các tỉnh thành trên toàn quốc.',
              },
            ].map(({ q, a }) => (
              <details key={q} className="group bg-[#0D1527] border border-border rounded-xl px-5 py-4 cursor-pointer">
                <summary className="font-jakarta text-sm font-semibold text-highlight list-none flex items-center justify-between gap-3">
                  {q}
                  <span className="text-faint group-open:rotate-180 transition-transform flex-shrink-0">▾</span>
                </summary>
                <p className="font-jakarta text-[0.8125rem] text-muted leading-relaxed mt-3">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-border mt-8 px-6 sm:px-10 py-8">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-6 justify-between">
          <div className="flex flex-col gap-2">
            <span className="font-fraunces text-[15px] font-bold text-highlight">Zenith</span>
            <span className="font-jakarta text-xs text-faint">Ôn thi Toán THPT & Lớp 10 cùng AI</span>
          </div>
          <div className="flex gap-8 flex-wrap">
            <div className="flex flex-col gap-2">
              <span className="font-jakarta text-[0.6875rem] font-bold uppercase tracking-[2px] text-[#334155]">Sản phẩm</span>
              {[['Thi thử', '/exams'], ['Luyện tập', '/exams?mode=practice'], ['Oracle AI', '/oracle'], ['⚗ Lab', '/exams?mode=lab']].map(([label, path]) => (
                <button key={label} onClick={() => navigate(path)}
                  className="font-jakarta text-xs text-faint hover:text-muted transition text-left">{label}</button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-jakarta text-[0.6875rem] font-bold uppercase tracking-[2px] text-[#334155]">Tài khoản</span>
              {[
                ['Đăng nhập', null, onOpenAuth],
                ['Nâng cấp', '/account', null],
              ].map(([label, path, fn]) => (
                <button key={label} onClick={fn ?? (() => navigate(path))}
                  className="font-jakarta text-xs text-faint hover:text-muted transition text-left">{label}</button>
              ))}
            </div>
          </div>
        </div>
        <p className="text-center font-jakarta text-[0.6875rem] text-border mt-6">© {new Date().getFullYear()} Zenith. Tất cả đề thi từ nguồn chính thức.</p>
      </footer>
    </motion.div>
  )
}
