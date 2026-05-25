import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  LineChart, Line, ResponsiveContainer,
} from 'recharts'
import { useAuth } from '../context/AuthContext.jsx'
import { useHistory } from '../context/HistoryContext.jsx'
import { loadQuestions } from '../api/index.js'
import { getCreditLog, activateTrial, getReferral, updateUsername, examStrategy, compareProvince, updateExtendedProfile } from '../api/aiClient.js'
import { useReadiness } from '../hooks/useReadiness.js'
import { pageVariants } from '../utils/animations.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import { useToast } from '../context/ToastContext.jsx'
import { computeStreak, computeStreakPersonalBest } from '../utils/streak.js'
import { getDaysUntilExam } from '../utils/examCountdown.js'
import { computeBadges, BADGE_DEFS } from '../utils/badges.js'
import { TOPIC_LABELS } from '../utils/topicLabels.js'
import { requestStudyReminder } from '../utils/studyReminder.js'
import { getInitialTab, formatCreditSessions, TAB_PROGRESS, TAB_ANALYTICS, TAB_AITIA, TAB_SETTINGS } from '../utils/accountHelpers.js'
import { interpretScoreTrend, interpretTopicRadar, interpretHeatmap, getTodayFocus, getNextMilestone } from '../utils/insights.js'
import { getMasteryProgress, MASTERY_TIERS } from '../utils/masteryRank.js'
import { generateWeeklyReport } from '../utils/weeklyReport.js'
import { getStudyNudge } from '../utils/studyNudge.js'
import { classifyLearner } from '../utils/learnerArchetype.js'
import { getLearnerTimeline } from '../utils/learnerTimeline.js'
import { getScoreProjection } from '../utils/scoreProjection.js'
import { useAIPreferences } from '../hooks/useAIPreferences.js'
import { getTopupRecommendation, getTrialUrgency, getAnnualSavingsDays } from '../utils/monetization.js'
import { getGoalStatus } from '../utils/goalAlignment.js'
import { getExamPhase } from '../utils/examUrgency.js'
import { generateProgressReport, reportToText } from '../utils/progressReport.js'
import { getSessionPatterns } from '../utils/sessionPatterns.js'
import { getAdvisorMessage } from '../utils/advisorMessage.js'
import { getSimulationMode } from '../utils/examSimulation.js'
import { getProvinceNarrative } from '../utils/provinceNarrative.js'
import { getTierGap } from '../utils/tierGap.js'
import { getUpgradeContext } from '../utils/upgradeContext.js'

// ─── Constants ───────────────────────────────────────────────────────────────

const REASON_LABELS = {
  'analyze':                    'Phân tích kết quả',
  'hint':                       'Gợi ý câu hỏi',
  'explain':                    'Giải thích đáp án',
  'study-plan':                 'Kế hoạch học tập',
  'subscription_bonus_student': 'Nâng cấp gói Học sinh',
  'subscription_bonus_complete':'Nâng cấp gói Toàn diện',
  'admin_grant':                'Nạp Tia',
  'trial_activation':           'Kích hoạt dùng thử',
}

const TIER_LABELS  = { basic: 'Cơ bản', student: 'Học sinh', complete: 'Toàn diện' }

// Display names for mastery ranks (backend values → Vietnamese learner labels)
const MASTERY_RANK_LABELS = {
  'Pemula':    'Tân học viên',
  'Học sinh':  'Học sinh Tiến bộ',
  'Sinh viên': 'Chiến sĩ Tri thức',
  'Chuyên gia':'Ngôi sao Zenith',
}
const MASTERY_RANK_COLORS = {
  'Pemula':    '#64748B',
  'Học sinh':  '#818CF8',
  'Sinh viên': '#F2A20C',
  'Chuyên gia':'#10B981',
}
const TIER_COLORS  = { basic: '#64748B', student: '#F2A20C', complete: '#10B981' }
const TIER_ALLOC   = { basic: 50, student: 500, complete: 2000 }
const GRADE_LABELS = { '9': 'Lớp 9 trở xuống', '10': 'Lớp 10', '11': 'Lớp 11', '12': 'Lớp 12' }

const PLANS_MONTHLY = [
  { tier: 'basic',    label: 'Cơ bản',    price: 'Miễn phí',       credits: 50,   studyPlan: false, badge: null,
    features: ['5 Oracle/ngày', 'Tất cả chế độ thi', 'Thử thách hằng ngày'] },
  { tier: 'student',  label: 'Học sinh',  price: '29,000đ/tháng',  credits: 500,  studyPlan: true,  badge: 'PHỔ BIẾN',
    features: ['Oracle không giới hạn', 'AI Phân tích miễn phí', 'Thưởng chuỗi học', 'Xu hướng 30 ngày', 'Kế hoạch học AI'] },
  { tier: 'complete', label: 'Toàn diện', price: '59,000đ/tháng',  credits: 2000, studyPlan: true,  badge: null,
    features: ['Tất cả gói Học sinh', 'Tạo đề AI riêng', 'Dự đoán điểm số', 'AI Gia sư ghi nhớ', 'Chiến lược thi', 'So sánh tỉnh thành'] },
]
const PLANS_ANNUAL = [
  { tier: 'basic',    label: 'Cơ bản',    price: 'Miễn phí',        credits: 50,   studyPlan: false, badge: null,
    features: ['5 Oracle/ngày', 'Tất cả chế độ thi', 'Thử thách hằng ngày'] },
  { tier: 'student',  label: 'Học sinh',  price: '261,000đ/năm',    credits: 500,  studyPlan: true,  badge: 'PHỔ BIẾN', bonus: '+1,000 Tia', effective: '21,750đ/tháng',
    features: ['Oracle không giới hạn', 'AI Phân tích miễn phí', 'Thưởng chuỗi học', 'Xu hướng 30 ngày', 'Kế hoạch học AI'] },
  { tier: 'complete', label: 'Toàn diện', price: '531,000đ/năm',    credits: 2000, studyPlan: true,  badge: null, bonus: '+3,000 Tia', effective: '44,250đ/tháng',
    features: ['Tất cả gói Học sinh', 'Tạo đề AI riêng', 'Dự đoán điểm số', 'AI Gia sư ghi nhớ', 'Chiến lược thi', 'So sánh tỉnh thành'] },
]
const TOPUP_PACKAGES = [
  { price: '15,000đ', credits: 150, label: 'Starter' },
  { price: '29,000đ', credits: 350, label: 'Phổ biến' },
  { price: '59,000đ', credits: 800, label: 'Tiết kiệm' },
]

// Bank details for top-up modal (static — displayed with transfer instructions)
const BANK_INFO = {
  bank_name:      'Vietcombank',
  account_number: '1234567890',
  account_name:   'CONG TY ZENITH EDU',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return iso }
}

function buildHeatmap(results) {
  const counts = {}
  for (const r of results) {
    const day = new Date(r.finishedAt).toISOString().slice(0, 10)
    counts[day] = (counts[day] ?? 0) + 1
  }
  const cells = []
  const end = new Date()
  for (let i = 364; i >= 0; i--) {
    const d = new Date(end)
    d.setDate(end.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    cells.push({ key, count: counts[key] ?? 0, month: d.getMonth(), dow: d.getDay() })
  }
  return cells
}

function aggregateTopicAccuracy(results) {
  const totals = {}
  for (const r of results) {
    for (const [topic, tb] of Object.entries(r.topicBreakdown ?? {})) {
      if (!totals[topic]) totals[topic] = { correct: 0, total: 0 }
      totals[topic].correct += Math.round((tb.accuracy ?? 0) * (tb.total ?? 1))
      totals[topic].total   += tb.total ?? 1
    }
  }
  return Object.entries(totals).map(([topic, { correct, total }]) => ({
    topic: TOPIC_LABELS[topic] ?? topic,
    score: total > 0 ? Math.round(correct / total * 100) : 0,
  }))
}

function heatColor(count) {
  if (count === 0) return '#1E2A44'
  if (count === 1) return 'rgba(180,83,9,0.60)'
  if (count === 2) return 'rgba(180,83,9,0.70)'
  return 'rgba(242,162,12,0.80)'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatChip({ icon, value, label }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4">
      <span className="font-fraunces text-[17px] font-bold text-[#F2A20C]">{icon} {value}</span>
      <span className="font-jakarta text-[11px] text-[#64748B]">{label}</span>
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 rounded-lg font-jakarta text-[13px] font-medium transition ${
        active ? 'bg-[#F2A20C] text-[#0A0E1A] font-semibold' : 'text-[#64748B] hover:text-[#94A3B8]'
      }`}
    >
      {children}
    </button>
  )
}

// Credit gauge (half-circle SVG)
function CreditGauge({ balance, tier }) {
  const alloc = TIER_ALLOC[tier] ?? 50
  const pct   = Math.min(balance / alloc, 1)
  const color = pct > 0.6 ? '#10B981' : pct > 0.2 ? '#F2A20C' : '#EF4444'

  // SVG arc: cx=60, cy=60, r=50, semicircle from 180° to 0°
  const r = 50, cx = 60, cy = 60
  const circumference = Math.PI * r
  const dashOffset = circumference * (1 - pct)

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="120" height="70" viewBox="0 0 120 70">
        {/* background track */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="#1E2A44" strokeWidth="10" strokeLinecap="round"
        />
        {/* fill */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x={cx} y={cy - 4} textAnchor="middle" fill="#F0F4FF" fontSize="16" fontWeight="bold" fontFamily="serif">
          {balance}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="#64748B" fontSize="9" fontFamily="sans-serif">
          / {alloc.toLocaleString()}
        </text>
      </svg>
      <span className="font-jakarta text-[11px] text-[#475569]">Năng lượng học tập còn lại</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Account() {
  usePageTitle('Tài khoản')
  const navigate  = useNavigate()
  const { user, loading, updateProfile, refreshUser, refundCredits, logout, deleteAccount, deactivateAccount, reactivateAccount } = useAuth()
  const { results } = useHistory()
  const [questionMap, setQuestionMap] = useState({})
  useEffect(() => {
    loadQuestions().then(qs => setQuestionMap(Object.fromEntries(qs.map(q => [q.id, q])))).catch(() => {})
  }, [])
  const readiness = useReadiness(results, questionMap)

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState(() =>
    typeof window !== 'undefined' ? getInitialTab(window.location.hash) : TAB_PROGRESS
  )

  // ── API data ──
  const [creditLog,  setCreditLog]  = useState([])
  const [referral,   setReferral]   = useState(null)

  // ── Billing tab ──
  const [billing,      setBilling]      = useState('monthly')
  const [showAllCredits, setShowAllCredits] = useState(false)
  const [topupPkg,     setTopupPkg]     = useState(null)   // selected package for modal
  const [copyBankDone, setCopyBankDone] = useState(false)

  // ── Profile edit ──
  const [editMode,     setEditMode]     = useState(false)
  const [editGrade,    setEditGrade]    = useState('')
  const [editProvince, setEditProvince] = useState('')
  const [saving,       setSaving]       = useState(false)
  const [saveError,    setSaveError]    = useState('')
  const [avatarErr,    setAvatarErr]    = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [usernameLoading, setUsernameLoading] = useState(false)

  // ── Complete tier features ──
  const [strategyLoading, setStrategyLoading] = useState(false)
  const [strategyResult,  setStrategyResult]  = useState(null)
  const [strategyError,   setStrategyError]   = useState('')
  const [provinceData,    setProvinceData]    = useState(null)
  const [provinceLoading, setProvinceLoading] = useState(false)

  // ── Trial ──
  const [trialActivating, setTrialActivating] = useState(false)
  const [trialDone,       setTrialDone]       = useState(false)
  const [trialError,      setTrialError]      = useState('')

  // ── Danger Zone ──
  const [dangerOpen,          setDangerOpen]          = useState(false)
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)
  const [showDeleteModal,     setShowDeleteModal]     = useState(false)
  const [deleteEmail,         setDeleteEmail]         = useState('')
  const [dangerLoading,       setDangerLoading]       = useState(false)
  const [dangerError,         setDangerError]         = useState('')
  const [reactivating,        setReactivating]        = useState(false)

  // ── Settings ──
  const [reminderEnabled, setReminderEnabled] = useState(
    () => !!localStorage.getItem('study_reminder_enabled')
  )
  const [reminderHour, setReminderHour] = useState(
    () => {
      const stored = localStorage.getItem('study_reminder_hour')
      return stored ? parseInt(stored, 10) : 20
    }
  )
  const { preferences: aiPrefs, setPreferences: setAIPrefs, isCustomized: aiIsCustomized } = useAIPreferences()

  // ── Upgrade context inline messages ──
  const [upgradeCtxVisible, setUpgradeCtxVisible] = useState({}) // featureId → bool

  // ── Goal settings form ──
  const [goalExamDate,    setGoalExamDate]    = useState(() => user?.exam_date ?? '')
  const [goalSchool,      setGoalSchool]      = useState(() => user?.target_school ?? '')
  const [goalHours,       setGoalHours]       = useState(() => user?.weekly_study_hours?.toString() ?? '')
  const [goalSaving,      setGoalSaving]      = useState(false)
  const [goalSaved,       setGoalSaved]       = useState(false)

  // ── Heatmap scroll ref ──
  const heatScrollRef = useRef(null)

  const toast = useToast()

  // ── Data fetching ──
  useEffect(() => {
    if (!user) return
    getCreditLog().then(({ data }) => { if (data) setCreditLog(data) })
    getReferral().then(  ({ data }) => { if (data) setReferral(data) })
  }, [user])

  useEffect(() => {
    if (!loading && !user) navigate('/', { replace: true })
  }, [loading, user, navigate])

  // Auto-scroll heatmap to today (right edge) when analytics tab opens
  useEffect(() => {
    if (activeTab === TAB_ANALYTICS && heatScrollRef.current) {
      heatScrollRef.current.scrollLeft = heatScrollRef.current.scrollWidth
    }
  }, [activeTab])

  // ── Loading skeleton ──
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex flex-col">
        <nav className="flex items-center px-8 bg-[#0D1521] border-b border-[#1E2A44]" style={{ height: 64 }}>
          <div className="skeleton h-4 w-16 rounded" />
        </nav>
        <div className="max-w-2xl mx-auto w-full px-4 py-10 flex flex-col gap-8">
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-4">
              <div className="skeleton h-5 w-32 rounded" />
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-5/6 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Derived values ──
  const tier   = user.subscription_tier || 'basic'
  const plans  = billing === 'annual' ? PLANS_ANNUAL : PLANS_MONTHLY
  const streak = useMemo(() => computeStreak(results), [results])
  const daysUntil = user ? getDaysUntilExam(user.province) : null
  const earnedBadgeIds = useMemo(() => new Set(computeBadges(results).map(b => b.id)), [results])
  const avgScore = results.length
    ? (results.reduce((s, r) => s + (r.score ?? 0), 0) / results.length).toFixed(1)
    : '—'

  // Readiness display helpers
  const readinessPct   = readiness?.readiness ?? 0
  const readinessColor = readinessPct >= 70 ? '#34D399' : readinessPct >= 40 ? '#F2A20C' : '#EF4444'
  const readinessLabel = readinessPct >= 70 ? 'Sẵn sàng tốt' : readinessPct >= 40 ? 'Đang tiến bộ' : 'Cần luyện thêm'

  const radarData    = useMemo(() => aggregateTopicAccuracy(results), [results])
  const heatmapCells = useMemo(() => buildHeatmap(results), [results])
  const sparkData    = useMemo(() => {
    const sorted = [...results].sort((a, b) => new Date(a.finishedAt) - new Date(b.finishedAt)).slice(-10)
    return sorted.map((r, i) => ({ i, score: r.score ?? 0 }))
  }, [results])

  // Insight interpretations (deterministic, no LLM cost)
  const trendInsight    = useMemo(() => interpretScoreTrend(sparkData), [sparkData])
  const radarInsight    = useMemo(() => interpretTopicRadar(radarData), [radarData])
  const heatmapInsight  = useMemo(() => interpretHeatmap(results), [results])
  const todayFocus      = useMemo(() => getTodayFocus(radarData), [radarData])
  const nextMilestone   = useMemo(() => getNextMilestone(results, earnedBadgeIds), [results, earnedBadgeIds])

  // Sprint 3: streak personal best, mastery progression, weekly report, urgency
  const streakPB        = useMemo(() => computeStreakPersonalBest(results), [results])
  const masteryProgress = useMemo(() => user.mastery_rank
    ? getMasteryProgress(user.mastery_rank, user.solid_concept_count ?? 0)
    : null, [user.mastery_rank, user.solid_concept_count])
  const weeklyReport    = useMemo(() => generateWeeklyReport(results, radarData), [results, radarData])
  const studyNudge      = useMemo(() => getStudyNudge(results), [results])
  const examPhase      = useMemo(() => getExamPhase(daysUntil), [daysUntil])
  const simulationMode = useMemo(() => getSimulationMode(daysUntil), [daysUntil])
  const urgencyColor = examPhase?.colorPrimary ?? '#818CF8'

  // Sprint 5: learner identity + score projection
  const archetype       = useMemo(() => classifyLearner(results), [results])
  const timeline        = useMemo(() => getLearnerTimeline(results), [results])
  const scoreProjection = useMemo(() => getScoreProjection(sparkData, daysUntil), [sparkData, daysUntil])

  // Sprint 6: monetization intelligence
  const topupRec      = useMemo(() => getTopupRecommendation(creditLog, user.credits_balance ?? 0, TOPUP_PACKAGES), [creditLog, user.credits_balance])
  const trialUrgency  = useMemo(() => getTrialUrgency(user), [user])
  const studentSavingsDays  = useMemo(() => getAnnualSavingsDays(29000, 261000), [])
  const completeSavingsDays = useMemo(() => getAnnualSavingsDays(59000, 531000), [])

  // Sprint 7: goal-aligned intelligence
  const goalStatus = useMemo(() => getGoalStatus(user, sparkData), [user, sparkData])

  // Sprint 9: progress share report
  const progressReport = useMemo(
    () => generateProgressReport(user, results, streak, streakPB, radarData),
    [user, results, streak, streakPB, radarData]
  )

  // Sprint 10: session timing patterns
  const sessionPatterns = useMemo(() => getSessionPatterns(results), [results])

  // Sprint 11: advisor message — context synthesis across all analytics
  const advisorMsg = useMemo(() => getAdvisorMessage({
    results,
    streak,
    streakPB,
    sessionPatterns,
    scoreProjection,
    goalStatus,
    weeklyReport,
    examPhase,
    progressReport,
  }), [results, streak, streakPB, sessionPatterns, scoreProjection, goalStatus, weeklyReport, examPhase, progressReport])

  // Sprint 12: province narrative, tier gap, upgrade context
  const provinceNarrative = useMemo(() => getProvinceNarrative(provinceData), [provinceData])
  const tierGap = useMemo(() => getTierGap(tier), [tier])

  // Daily spend rate (last 7 days from creditLog)
  const runwayDays = useMemo(() => {
    if (!creditLog.length) return null
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    const spent = creditLog
      .filter(e => e.delta < 0 && new Date(e.created_at).getTime() > cutoff)
      .reduce((s, e) => s + Math.abs(e.delta), 0)
    if (!spent) return null
    const dailyRate = spent / 7
    return Math.round((user.credits_balance ?? 0) / dailyRate)
  }, [creditLog, user.credits_balance])

  // Heatmap: group into 52 weeks, derive month labels
  const weeks = useMemo(() => {
    const w = []
    for (let i = 0; i < 52; i++) w.push(heatmapCells.slice(i * 7, i * 7 + 7))
    return w
  }, [heatmapCells])

  const monthLabels = useMemo(() => {
    // For each week, record month if first cell of week starts a new month
    const labels = {}
    for (let w = 0; w < weeks.length; w++) {
      const first = weeks[w][0]
      if (!first) continue
      const prevFirst = w > 0 ? weeks[w - 1][0] : null
      if (!prevFirst || first.month !== prevFirst.month) {
        labels[w] = `T${first.month + 1}`
      }
    }
    return labels
  }, [weeks])

  // ── Handlers ──
  async function handleSaveProfile() {
    setSaving(true); setSaveError('')
    try {
      await updateProfile({ grade: editGrade || undefined, province: editProvince || undefined })
      setEditMode(false)
      toast.success('Đã lưu hồ sơ')
    } catch (err) {
      const msg = err.message || 'Lưu thất bại, vui lòng thử lại'
      setSaveError(msg); toast.error(msg)
    } finally { setSaving(false) }
  }

  const referralUrl = `${import.meta.env.VITE_APP_URL || 'https://exam-app-ey0.pages.dev'}/?ref=${referral?.referral_code || ''}`

  async function handleExamStrategy() {
    setStrategyLoading(true); setStrategyError(''); setStrategyResult(null)
    const { data, error, status } = await examStrategy()
    setStrategyLoading(false)
    if (data?.strategy) {
      setStrategyResult(data)
    } else if (status === 429 && data?.code === 'strategy_cooldown') {
      setStrategyError(`Đã dùng tháng này. Có thể dùng lại từ ${data.next_available ?? 'tháng sau'}`)
    } else {
      setStrategyError(error ?? 'Không lấy được chiến lược, thử lại sau')
    }
  }

  async function handleCompareProvince() {
    setProvinceLoading(true); setProvinceData(null)
    const { data, error, status } = await compareProvince()
    setProvinceLoading(false)
    if (data?.province) {
      setProvinceData(data)
    } else if (status === 422) {
      toast.error('Cần cài tỉnh thành trong hồ sơ để so sánh')
    } else {
      toast.error(error ?? 'Không lấy được dữ liệu')
    }
  }

  // ── Badge progress hints ──
  function badgeProgress(id) {
    if (id === 'perfect') {
      const max = results.length ? Math.max(...results.map(r => r.score ?? 0)) : 0
      return `Điểm cao nhất: ${max.toFixed ? max.toFixed(1) : max}`
    }
    if (id === 'ten_exams') return `Hoàn thành ${results.length}/10 bài`
    if (id === 'fast')      return 'Chưa nộp bài sớm'
    if (id === 'improving') return 'Cần cải thiện ≥2đ cùng một đề'
    return ''
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <motion.div
      className="min-h-screen bg-[#0A0E1A] flex flex-col"
      variants={pageVariants} initial="hidden" animate="show"
    >
      {/* ── Persistent header ──────────────────────────────────────────── */}
      <div className="bg-[#0D1521] border-b border-[#1E2A44]">
        {/* Top row: avatar + name + actions */}
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-4 flex items-center gap-4">
          {/* Avatar */}
          {user.avatar_url && !avatarErr ? (
            <img
              src={user.avatar_url} alt="" referrerPolicy="no-referrer"
              onError={() => setAvatarErr(true)}
              className="w-14 h-14 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-amber-500 flex items-center justify-center font-bold text-lg text-black flex-shrink-0">
              {((user.custom_display_name || user.display_name) || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'}
            </div>
          )}
          {/* Name + mastery rank + email */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-fraunces text-[18px] font-bold text-[#F8FAFC] truncate">{user.custom_display_name || user.display_name}</p>
              {user.mastery_rank && (
                <span
                  className="font-jakarta text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    background: (MASTERY_RANK_COLORS[user.mastery_rank] ?? '#64748B') + '22',
                    color: MASTERY_RANK_COLORS[user.mastery_rank] ?? '#64748B',
                  }}
                >
                  {MASTERY_RANK_LABELS[user.mastery_rank] ?? user.mastery_rank}
                </span>
              )}
            </div>
            <p className="font-jakarta text-[12px] text-[#64748B] truncate">{user.email}</p>
          </div>
          {/* Actions — secondary, muted */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => { setActiveTab(TAB_PROGRESS); setEditMode(true); setEditGrade(user.grade || ''); setEditProvince(user.province || '') }}
              className="px-2.5 py-1.5 rounded-lg font-jakarta text-[11px] text-amber-400 hover:bg-amber-400/10 transition"
            >
              ✏️ Sửa
            </button>
            <button
              onClick={logout}
              className="px-2.5 py-1.5 rounded-lg font-jakarta text-[11px] text-[#475569] hover:text-[#94A3B8] transition"
            >
              Đăng xuất
            </button>
          </div>
        </div>

        {/* Stat chips */}
        <div className="max-w-2xl mx-auto px-4 pb-4 flex items-center justify-around border-t border-[#1E2A44] pt-3">
          <StatChip icon="🔥" value={streak || 0} label={streakPB > streak ? `ngày (PB ${streakPB})` : 'ngày streak'} />
          <div className="w-px h-8 bg-[#1E2A44]" />
          <StatChip icon="📊" value={results.length} label="bài thi" />
          <div className="w-px h-8 bg-[#1E2A44]" />
          <StatChip icon="⭐" value={avgScore} label="điểm tb" />
          <div className="w-px h-8 bg-[#1E2A44]" />
          <StatChip icon="⚡" value={formatCreditSessions(user.credits_balance ?? 0)} label="AI còn lại" />
          {(user.solid_concept_count ?? 0) > 0 && (
            <>
              <div className="w-px h-8 bg-[#1E2A44]" />
              <StatChip icon="🧠" value={user.solid_concept_count} label="khái niệm" />
            </>
          )}
        </div>

        {/* Tab bar + settings gear icon */}
        <div className="max-w-2xl mx-auto px-4 pb-0 flex items-end gap-0">
          {[
            [TAB_PROGRESS,  'Tiến Độ'],
            [TAB_ANALYTICS, 'Phân Tích'],
            [TAB_AITIA,     'AI & Tia'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 py-3 font-jakarta text-[13px] font-medium border-b-2 transition ${
                activeTab === key
                  ? 'border-[#F2A20C] text-[#F2A20C]'
                  : 'border-transparent text-[#64748B] hover:text-[#94A3B8]'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setActiveTab(TAB_SETTINGS)}
            title="Cài đặt"
            className={`px-4 py-3 border-b-2 transition text-[15px] ${
              activeTab === TAB_SETTINGS
                ? 'border-[#F2A20C] text-[#F2A20C]'
                : 'border-transparent text-[#64748B] hover:text-[#94A3B8]'
            }`}
          >
            ⚙
          </button>
        </div>
      </div>

      {/* ── Tab content ───────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto w-full px-4 py-8 flex flex-col gap-6">

        {/* ── AI Advisor Message — always visible ───────────────────────── */}
        {advisorMsg && (
          <div className={`flex items-start gap-3 px-5 py-4 rounded-2xl border ${
            advisorMsg.category === 'urgent'
              ? 'border-red-500/40 bg-[#1A0808]'
              : advisorMsg.category === 'optimization'
              ? 'border-[#818CF840] bg-[#818CF808]'
              : advisorMsg.category === 'goal'
              ? 'border-emerald-500/40 bg-[#0A1A12]'
              : 'border-[#F2A20C33] bg-[#F2A20C08]'
          }`}>
            <span className="text-[18px] flex-shrink-0 mt-0.5">
              {advisorMsg.category === 'urgent' ? '🚨'
                : advisorMsg.category === 'optimization' ? '💡'
                : advisorMsg.category === 'goal' ? '🎯'
                : advisorMsg.category === 'progress' ? '📈'
                : advisorMsg.category === 'consistency' ? '🔄'
                : '✨'}
            </span>
            <p className="font-jakarta text-[13px] text-[#F0F4FF] leading-snug">{advisorMsg.message}</p>
          </div>
        )}

        {/* ════════════════ TAB 1: TIẾN ĐỘ ════════════════ */}
        {activeTab === TAB_PROGRESS && (
          <>
            {/* ── Readiness hero ───────────────────────────────────────── */}
            {readiness != null && (
              <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col items-center gap-4">
                {/* Large ring */}
                <svg width="88" height="88" viewBox="0 0 88 88">
                  <circle cx="44" cy="44" r="36" fill="none" stroke="#1E2A44" strokeWidth="7" />
                  <circle cx="44" cy="44" r="36" fill="none" stroke={readinessColor} strokeWidth="7"
                    strokeDasharray={`${2 * Math.PI * 36}`}
                    strokeDashoffset={`${2 * Math.PI * 36 * (1 - readinessPct / 100)}`}
                    strokeLinecap="round"
                    transform="rotate(-90 44 44)"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                  />
                  <text x="44" y="49" textAnchor="middle" fill={readinessColor} fontSize="18" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="700">{readinessPct}%</text>
                </svg>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-fraunces text-[18px] font-bold" style={{ color: readinessColor }}>{readinessLabel}</span>
                  <span className="font-jakarta text-[12px] text-[#64748B]">Mức sẵn sàng · 30 ngày gần nhất</span>
                </div>
                {daysUntil != null && examPhase && (
                  <div
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border"
                    style={{ borderColor: urgencyColor + '33', background: examPhase.bg }}
                  >
                    <span className="text-[15px]">{examPhase.icon}</span>
                    <span className="font-fraunces text-[15px] font-bold" style={{ color: urgencyColor }}>{daysUntil} ngày</span>
                    <span className="font-jakarta text-[12px]" style={{ color: urgencyColor + 'CC' }}>{examPhase.label}</span>
                  </div>
                )}
              </section>
            )}

            {/* Exam simulation mode — shown for daysUntil ≤ 14 */}
            {simulationMode && (
              <section className="border rounded-2xl p-6 flex flex-col gap-3"
                style={{
                  background: simulationMode.intensity === 'max' ? '#1A0505' : simulationMode.intensity === 'high' ? '#1A0A05' : '#1A1205',
                  borderColor: simulationMode.intensity === 'max' ? '#EF444480' : simulationMode.intensity === 'high' ? '#F9731680' : '#F2A20C80',
                }}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-[18px]">{simulationMode.intensity === 'max' ? '🚨' : simulationMode.intensity === 'high' ? '🔴' : '🟠'}</span>
                    <span className="font-jakarta text-[11px] font-bold px-2.5 py-1 rounded-full"
                      style={{ background: simulationMode.intensity === 'max' ? '#EF444422' : simulationMode.intensity === 'high' ? '#F9731622' : '#F2A20C22', color: simulationMode.intensity === 'max' ? '#EF4444' : simulationMode.intensity === 'high' ? '#F97316' : '#F2A20C' }}>
                      CHẾ ĐỘ ÔN THI — {simulationMode.intensity === 'max' ? 'TỐI ĐA' : simulationMode.intensity === 'high' ? 'CAO' : 'TRUNG BÌNH'}
                    </span>
                  </div>
                  <button onClick={() => navigate('/exam-select')}
                    className="px-4 py-2 rounded-xl font-jakarta text-[12px] font-bold transition flex-shrink-0"
                    style={{ background: simulationMode.intensity === 'max' ? '#EF4444' : simulationMode.intensity === 'high' ? '#F97316' : '#F2A20C', color: '#0A0E1A' }}>
                    Thi thử ngay →
                  </button>
                </div>
                <p className="font-jakarta text-[13px] text-[#F0F4FF] leading-snug">{simulationMode.briefing}</p>
                <p className="font-jakarta text-[12px] text-[#94A3B8] leading-snug">{simulationMode.focusTip}</p>
              </section>
            )}

            {/* Exam urgency phase banner — shown for <60 days */}
            {examPhase && daysUntil != null && daysUntil < 60 && (
              <section
                className="border rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap"
                style={{ background: examPhase.bg, borderColor: examPhase.border }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[16px]">{examPhase.icon}</span>
                    <span className="font-jakarta text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: urgencyColor + '22', color: urgencyColor }}>
                      {examPhase.label}
                    </span>
                  </div>
                  <span className="font-jakarta text-[13px] text-[#F0F4FF] leading-snug mt-1">{examPhase.headline}</span>
                </div>
                <button
                  onClick={() => navigate('/exam-select')}
                  className="px-4 py-2 rounded-xl font-jakarta text-[12px] font-bold transition flex-shrink-0"
                  style={{ background: urgencyColor, color: '#0A0E1A' }}
                >
                  {examPhase.cta}
                </button>
              </section>
            )}

            {/* Goal alignment card */}
            {goalStatus && (
              <section className={`border rounded-2xl p-6 flex flex-col gap-3 ${
                goalStatus.status === 'at_risk'
                  ? 'bg-[#1A0A0A] border-red-500/40'
                  : goalStatus.status === 'steady'
                  ? 'bg-[#0D1521] border-[#1E2A44]'
                  : goalStatus.status === 'ahead'
                  ? 'bg-[#0A1A12] border-emerald-500/40'
                  : 'bg-[#0D1521] border-[#1E2A44]'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-fraunces text-[14px] font-semibold text-[#F8FAFC]">
                        {goalStatus.status === 'ahead' ? '🎯' : goalStatus.status === 'at_risk' ? '⚠️' : goalStatus.status === 'no_data' ? '📋' : '📈'}
                        {' '}{goalStatus.headline}
                      </span>
                    </div>
                    <p className="font-jakarta text-[12px] text-[#94A3B8] leading-snug">{goalStatus.detail}</p>
                  </div>
                  <button
                    onClick={() => setActiveTab(TAB_SETTINGS)}
                    className="font-jakarta text-[11px] text-[#475569] hover:text-[#64748B] transition flex-shrink-0"
                  >
                    Sửa mục tiêu →
                  </button>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg bg-[#0A0E1A] border border-[#1E2A44]">
                    <span className="font-jakarta text-[10px] text-[#475569]">Còn lại</span>
                    <span className="font-fraunces text-[14px] font-bold" style={{ color: urgencyColor }}>{goalStatus.daysUntil} ngày</span>
                  </div>
                  {goalStatus.projectedScore != null && (
                    <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg bg-[#0A0E1A] border border-[#1E2A44]">
                      <span className="font-jakarta text-[10px] text-[#475569]">Dự đoán</span>
                      <span className="font-fraunces text-[14px] font-bold text-emerald-400">{goalStatus.projectedScore.toFixed(1)}</span>
                    </div>
                  )}
                  {goalStatus.targetSchool && (
                    <div className="flex flex-col gap-0.5 px-3 py-2 rounded-lg bg-[#0A0E1A] border border-[#1E2A44] max-w-[200px]">
                      <span className="font-jakarta text-[10px] text-[#475569]">Trường mục tiêu</span>
                      <span className="font-jakarta text-[12px] font-semibold text-[#F0F4FF] truncate">{goalStatus.targetSchool}</span>
                    </div>
                  )}
                  {goalStatus.weeklyHours && (
                    <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg bg-[#0A0E1A] border border-[#1E2A44]">
                      <span className="font-jakarta text-[10px] text-[#475569]">Giờ/tuần</span>
                      <span className="font-fraunces text-[14px] font-bold text-[#818CF8]">{goalStatus.weeklyHours}h</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Mastery rank progression */}
            {masteryProgress && (
              <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">Cấp độ học tập</span>
                  {masteryProgress.next && (
                    <span className="font-jakarta text-[11px] text-[#64748B]">
                      còn {masteryProgress.needed} khái niệm đến {masteryProgress.next.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-[24px] flex-shrink-0"
                    style={{ background: (MASTERY_TIERS.find(t => t.id === user.mastery_rank)?.id ? '#818CF81A' : '#64748B1A') }}>
                    {masteryProgress.current.icon}
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-fraunces text-[14px] font-bold text-[#F8FAFC]">{masteryProgress.current.label}</span>
                      {masteryProgress.next && (
                        <span className="font-jakarta text-[12px] text-[#64748B]">{masteryProgress.next.icon} {masteryProgress.next.label}</span>
                      )}
                    </div>
                    <div className="w-full h-2 bg-[#1E2A44] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#818CF8] transition-all duration-700"
                        style={{ width: `${Math.round(masteryProgress.pct * 100)}%` }}
                      />
                    </div>
                    <span className="font-jakarta text-[11px] text-[#64748B]">
                      {user.solid_concept_count ?? 0} khái niệm vững chắc
                      {masteryProgress.next ? ` · mục tiêu ${masteryProgress.next.minSolid}` : ' · cấp cao nhất'}
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* Profile card */}
            <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <span className="font-fraunces text-[16px] font-semibold text-[#F8FAFC]">Thông tin học sinh</span>
              </div>

              {/* Edit form */}
              {editMode ? (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2 flex-wrap">
                    {['9','10','11','12'].map(g => (
                      <button key={g} type="button" onClick={() => setEditGrade(g)}
                        className={`px-4 py-2 rounded-lg border font-jakarta text-[12px] font-medium transition ${
                          editGrade === g ? 'border-amber-400 text-amber-400 bg-amber-400/10' : 'border-[#1E2A44] text-[#64748B]'
                        }`}>
                        {GRADE_LABELS[g]}
                      </button>
                    ))}
                  </div>
                  <input
                    className="px-4 py-2.5 rounded-xl border border-[#1E2A44] bg-[#111827] font-jakarta text-[13px] text-[#F0F4FF] focus:outline-none focus:border-amber-400"
                    placeholder="Tỉnh / Thành phố"
                    value={editProvince}
                    onChange={e => setEditProvince(e.target.value)}
                  />
                  {saveError && <p className="font-jakarta text-[12px] text-red-400">{saveError}</p>}
                  <div className="flex gap-2">
                    <button onClick={handleSaveProfile} disabled={saving}
                      className="px-5 py-2 rounded-lg font-jakarta text-[13px] font-bold transition"
                      style={{ background: '#F2A20C', color: '#0A0E1A' }}>
                      {saving ? 'Đang lưu...' : 'Lưu'}
                    </button>
                    <button onClick={() => { setEditMode(false); setSaveError('') }}
                      className="px-5 py-2 rounded-lg font-jakarta text-[13px] text-[#64748B] hover:text-[#F8FAFC] transition">
                      Huỷ
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-6 flex-wrap">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-jakarta text-[11px] text-[#475569]">Lớp</span>
                    <span className="font-jakarta text-[13px] text-[#F0F4FF]">{GRADE_LABELS[user.grade] || '—'}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-jakarta text-[11px] text-[#475569]">Tỉnh / Thành phố</span>
                    <span className="font-jakarta text-[13px] text-[#F0F4FF]">{user.province || '—'}</span>
                  </div>
                  {user.school_type && (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-jakarta text-[11px] text-[#475569]">Loại trường</span>
                      <span className="font-jakarta text-[13px] text-[#F0F4FF]">{user.school_type}</span>
                    </div>
                  )}
                </div>
              )}

            </section>

            {/* Username card */}
            <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">Tên hiển thị</span>
                <span className="font-jakarta text-[12px] text-[#64748B]">Tên phải là duy nhất · 2–30 ký tự</span>
              </div>
              <div className="flex gap-2">
                <input
                  value={usernameInput}
                  onChange={e => { setUsernameInput(e.target.value); setUsernameError('') }}
                  placeholder={user.custom_display_name || user.display_name || 'Nhập tên mới...'}
                  maxLength={30}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[#1E2A44] bg-[#111827] font-jakarta text-[13px] text-[#F0F4FF] placeholder-[#475569] focus:outline-none focus:border-amber-400"
                />
                <button
                  disabled={usernameLoading || !usernameInput.trim()}
                  onClick={async () => {
                    setUsernameLoading(true)
                    setUsernameError('')
                    const { data, error, status } = await updateUsername(usernameInput.trim())
                    setUsernameLoading(false)
                    if (error) {
                      setUsernameError(status === 409 ? 'Tên này đã được dùng bởi người khác' : (typeof error === 'string' ? error : 'Lỗi khi lưu tên'))
                    } else {
                      await refreshUser()
                      setUsernameInput('')
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl font-jakarta text-[13px] font-bold disabled:opacity-40 transition"
                  style={{ background: '#F2A20C', color: '#0A0E1A' }}>
                  {usernameLoading ? '...' : 'Lưu'}
                </button>
              </div>
              {usernameError && <p className="font-jakarta text-[12px] text-red-400">{usernameError}</p>}
            </section>

            {/* Complete tier features: Strategy + Province Comparison */}
            {user.subscription_tier === 'complete' && (
              <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-5">
                <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">Tính năng Toàn diện</span>

                {/* Exam Strategy */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-jakarta text-[13px] font-semibold text-[#F0F4FF]">Tư vấn chiến lược thi</span>
                      <span className="font-jakarta text-[11px] text-[#64748B]">AI phân tích điểm yếu và lên kế hoạch ôn thi cá nhân hoá · 1 lần/tháng</span>
                    </div>
                    <button onClick={handleExamStrategy} disabled={strategyLoading}
                      className="flex-shrink-0 px-4 py-2 rounded-lg font-jakarta text-[12px] font-bold disabled:opacity-60 transition"
                      style={{ background: '#10B981', color: '#0A0E1A' }}>
                      {strategyLoading ? 'Đang tạo...' : 'Lấy chiến lược'}
                    </button>
                  </div>
                  {strategyError && <p className="font-jakarta text-[12px] text-amber-400">{strategyError}</p>}
                  {strategyResult?.strategy && (
                    <div className="bg-[#0A0E1A] border border-[#1E2A44] rounded-xl p-4">
                      <p className="font-jakarta text-[13px] text-[#CBD5E1] leading-relaxed whitespace-pre-wrap">{strategyResult.strategy}</p>
                    </div>
                  )}
                </div>

                <div className="border-t border-[#1E2A44]" />

                {/* Province comparison */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-jakarta text-[13px] font-semibold text-[#F0F4FF]">So sánh với tỉnh thành</span>
                      <span className="font-jakarta text-[11px] text-[#64748B]">Xem bạn đứng ở vị trí nào so với học sinh cùng tỉnh · 30 ngày qua</span>
                    </div>
                    <button onClick={handleCompareProvince} disabled={provinceLoading}
                      className="flex-shrink-0 px-4 py-2 rounded-lg font-jakarta text-[12px] font-bold disabled:opacity-60 transition"
                      style={{ background: '#818CF8', color: '#F8FAFC' }}>
                      {provinceLoading ? 'Đang tải...' : 'So sánh'}
                    </button>
                  </div>
                  {provinceData && provinceNarrative && (
                    <div className="flex flex-col gap-3">
                      {/* Narrative card */}
                      <div className={`flex flex-col gap-2 px-4 py-4 rounded-xl border ${
                        provinceNarrative.sentiment === 'above' ? 'border-emerald-500/40 bg-emerald-500/5' :
                        provinceNarrative.sentiment === 'below' ? 'border-amber-400/40 bg-amber-400/5' :
                        'border-[#818CF8]/40 bg-[#818CF8]/5'
                      }`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-jakarta text-[13px] font-semibold text-[#F0F4FF]">{provinceNarrative.headline}</span>
                          {provinceNarrative.badge && (
                            <span className={`font-jakarta text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              provinceNarrative.sentiment === 'above' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-400/20 text-amber-400'
                            }`}>{provinceNarrative.badge}</span>
                          )}
                        </div>
                        <span className="font-jakarta text-[12px] text-[#94A3B8] leading-snug">{provinceNarrative.detail}</span>
                      </div>
                      {/* Secondary numbers */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col gap-0.5 bg-[#0A0E1A] border border-[#1E2A44] rounded-xl px-4 py-3">
                          <span className="font-jakarta text-[10px] text-[#475569]">Điểm của bạn</span>
                          <span className="font-jakarta text-[17px] font-bold text-[#F2A20C]">{provinceData.your_avg}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 bg-[#0A0E1A] border border-[#1E2A44] rounded-xl px-4 py-3">
                          <span className="font-jakarta text-[10px] text-[#475569]">TB {provinceData.province}</span>
                          <span className="font-jakarta text-[17px] font-bold text-[#94A3B8]">{provinceData.province_avg}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 bg-[#0A0E1A] border border-[#1E2A44] rounded-xl px-4 py-3">
                          <span className="font-jakarta text-[10px] text-[#475569]">Phần trăm xếp</span>
                          <span className="font-jakarta text-[17px] font-bold text-[#10B981]">
                            {provinceData.percentile != null ? `Top ${100 - provinceData.percentile}%` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Upgrade context — strategy + province for non-complete users */}
            {user.subscription_tier !== 'complete' && (
              <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-5">
                <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">Tính năng AI nâng cao</span>

                {/* Strategy upgrade context */}
                {(() => {
                  const ctx = getUpgradeContext(tier, 'strategy')
                  return (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-jakarta text-[13px] font-semibold text-[#94A3B8]">Tư vấn chiến lược thi</span>
                          <span className="font-jakarta text-[11px] text-[#475569]">AI phân tích điểm yếu và lên kế hoạch ôn thi cá nhân hoá · 1 lần/tháng</span>
                        </div>
                        <button
                          onClick={() => setUpgradeCtxVisible(v => ({ ...v, strategy: !v.strategy }))}
                          className="flex-shrink-0 px-4 py-2 rounded-lg font-jakarta text-[12px] font-bold transition opacity-60 cursor-not-allowed"
                          style={{ background: '#1E2A44', color: '#64748B' }}
                        >
                          Lấy chiến lược
                        </button>
                      </div>
                      {upgradeCtxVisible.strategy && ctx && (
                        <div className="flex flex-col gap-2 px-4 py-3 rounded-xl border border-[#818CF8]/30 bg-[#818CF8]/5">
                          <span className="font-jakarta text-[12px] text-[#A5B4FC] leading-snug">{ctx.pitch}</span>
                          <button
                            onClick={() => {
                              setActiveTab(TAB_AITIA)
                              setTimeout(() => document.querySelector('#upgrade-plans')?.scrollIntoView({ behavior: 'smooth' }), 100)
                            }}
                            className="self-start font-jakarta text-[12px] font-bold text-[#818CF8] hover:text-[#A5B4FC] transition"
                          >
                            Nâng cấp →
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })()}

                <div className="border-t border-[#1E2A44]" />

                {/* Province upgrade context */}
                {(() => {
                  const ctx = getUpgradeContext(tier, 'province')
                  return (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-jakarta text-[13px] font-semibold text-[#94A3B8]">So sánh với tỉnh thành</span>
                          <span className="font-jakarta text-[11px] text-[#475569]">Xem bạn đứng ở vị trí nào so với học sinh cùng tỉnh · 30 ngày qua</span>
                        </div>
                        <button
                          onClick={() => setUpgradeCtxVisible(v => ({ ...v, province: !v.province }))}
                          className="flex-shrink-0 px-4 py-2 rounded-lg font-jakarta text-[12px] font-bold transition opacity-60 cursor-not-allowed"
                          style={{ background: '#1E2A44', color: '#64748B' }}
                        >
                          So sánh
                        </button>
                      </div>
                      {upgradeCtxVisible.province && ctx && (
                        <div className="flex flex-col gap-2 px-4 py-3 rounded-xl border border-[#818CF8]/30 bg-[#818CF8]/5">
                          <span className="font-jakarta text-[12px] text-[#A5B4FC] leading-snug">{ctx.pitch}</span>
                          <button
                            onClick={() => {
                              setActiveTab(TAB_AITIA)
                              setTimeout(() => document.querySelector('#upgrade-plans')?.scrollIntoView({ behavior: 'smooth' }), 100)
                            }}
                            className="self-start font-jakarta text-[12px] font-bold text-[#818CF8] hover:text-[#A5B4FC] transition"
                          >
                            Nâng cấp →
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </section>
            )}

            {/* Learner archetype */}
            {archetype && (
              <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#818CF81A] border border-[#818CF833] flex items-center justify-center text-[28px] flex-shrink-0">
                  {archetype.icon}
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-jakarta text-[10px] font-semibold text-[#818CF8] uppercase tracking-wide">Phong cách học của bạn</span>
                  <span className="font-fraunces text-[16px] font-bold text-[#F8FAFC]">{archetype.label}</span>
                  <span className="font-jakarta text-[12px] text-[#94A3B8] leading-snug">{archetype.desc}</span>
                </div>
              </section>
            )}

            {/* Next milestone */}
            {nextMilestone && (
              <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-3">
                <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">Mục tiêu tiếp theo</span>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#818CF81A] border border-[#818CF833] flex items-center justify-center flex-shrink-0">
                    <span className="text-[22px]">{nextMilestone.icon}</span>
                  </div>
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <span className="font-fraunces text-[14px] font-bold text-[#F8FAFC]">{nextMilestone.label}</span>
                    <span className="font-jakarta text-[12px] text-[#94A3B8]">{nextMilestone.progress}</span>
                    <div className="w-full h-1.5 bg-[#1E2A44] rounded-full overflow-hidden mt-0.5">
                      <div
                        className="h-full rounded-full bg-[#818CF8] transition-all duration-700"
                        style={{ width: `${Math.round(nextMilestone.pct * 100)}%` }}
                      />
                    </div>
                  </div>
                  {nextMilestone.remaining != null && (
                    <span className="font-jakarta text-[11px] text-[#818CF8] font-semibold flex-shrink-0">
                      còn {nextMilestone.remaining}
                    </span>
                  )}
                </div>
              </section>
            )}

            {/* Badges grid */}
            <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-4">
              <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">Huy hiệu</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BADGE_DEFS.map(b => {
                  const earned = earnedBadgeIds.has(b.id)
                  return (
                    <div
                      key={b.id}
                      className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition ${
                        earned ? 'border-amber-400/40 bg-amber-400/5' : 'border-[#1E2A44] bg-[#111827] opacity-50 grayscale'
                      }`}
                    >
                      <span className="text-[24px] flex-shrink-0">{b.icon}</span>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-jakarta text-[12px] font-semibold text-[#F0F4FF]">{b.label}</span>
                        <span className="font-jakarta text-[11px] text-[#64748B]">
                          {earned ? b.desc : badgeProgress(b.id)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Progress share card */}
            {progressReport && (
              <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">Báo cáo học tập</span>
                  <button
                    onClick={() => {
                      const text = reportToText(progressReport)
                      if (navigator.share) {
                        navigator.share({ title: 'Báo cáo học tập Zenith', text }).catch(() => {})
                      } else {
                        navigator.clipboard?.writeText(text)
                          .then(() => toast.success('Đã sao chép báo cáo'))
                          .catch(() => {})
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-jakarta text-[12px] font-semibold bg-[#818CF820] text-[#818CF8] border border-[#818CF833] hover:bg-[#818CF830] transition"
                  >
                    <span>📤</span> Chia sẻ
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="flex flex-col items-center gap-0.5 px-3 py-3 rounded-xl bg-[#0A0E1A] border border-[#1E2A44]">
                    <span className="font-fraunces text-[20px] font-bold text-[#F0F4FF]">{progressReport.totalExams}</span>
                    <span className="font-jakarta text-[10px] text-[#64748B]">Bài thi</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 px-3 py-3 rounded-xl bg-[#0A0E1A] border border-[#1E2A44]">
                    <span className="font-fraunces text-[20px] font-bold text-amber-400">{progressReport.avgScore}</span>
                    <span className="font-jakarta text-[10px] text-[#64748B]">Điểm TB</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 px-3 py-3 rounded-xl bg-[#0A0E1A] border border-[#1E2A44]">
                    <span className={`font-fraunces text-[20px] font-bold ${progressReport.scoreImprovement > 0 ? 'text-emerald-400' : progressReport.scoreImprovement < 0 ? 'text-red-400' : 'text-[#F0F4FF]'}`}>
                      {progressReport.scoreImprovement > 0 ? '+' : ''}{progressReport.scoreImprovement}
                    </span>
                    <span className="font-jakarta text-[10px] text-[#64748B]">Cải thiện</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 px-3 py-3 rounded-xl bg-[#0A0E1A] border border-[#1E2A44]">
                    <span className="font-fraunces text-[20px] font-bold text-[#F0F4FF]">{progressReport.streakDays}</span>
                    <span className="font-jakarta text-[10px] text-[#64748B]">Streak ngày</span>
                  </div>
                </div>
                {progressReport.topTopics.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="font-jakarta text-[11px] font-semibold text-[#94A3B8]">Điểm mạnh</span>
                    <div className="flex flex-wrap gap-2">
                      {progressReport.topTopics.map(t => (
                        <span key={t} className="font-jakarta text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {progressReport.weakTopics.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="font-jakarta text-[11px] font-semibold text-[#94A3B8]">Cần ôn thêm</span>
                    <div className="flex flex-wrap gap-2">
                      {progressReport.weakTopics.map(t => (
                        <span key={t} className="font-jakarta text-[11px] px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-400">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Learner timeline */}
            {timeline.length > 0 && (
              <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-4">
                <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">Hành trình học tập</span>
                <div className="flex flex-col gap-0">
                  {timeline.map((event, idx) => (
                    <div key={event.type} className="flex gap-3 relative">
                      {/* Vertical line */}
                      {idx < timeline.length - 1 && (
                        <div className="absolute left-[19px] top-8 bottom-0 w-px bg-[#1E2A44]" />
                      )}
                      <div className="w-10 h-10 rounded-full bg-[#0A0E1A] border border-[#1E2A44] flex items-center justify-center text-[16px] flex-shrink-0 z-10">
                        {event.icon}
                      </div>
                      <div className="flex flex-col gap-0.5 pb-4 min-w-0">
                        <span className="font-jakarta text-[13px] font-semibold text-[#F0F4FF]">
                          {event.label}{event.extra ? ` — ${event.extra} điểm` : ''}
                        </span>
                        <span className="font-jakarta text-[11px] text-[#475569]">
                          {new Date(event.date).toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* ════════════════ TAB 2: PHÂN TÍCH ════════════════ */}
        {activeTab === TAB_ANALYTICS && (
          <>
            {/* Adaptive study nudge */}
            {studyNudge && (
              <div className="flex items-start gap-3 px-5 py-4 rounded-2xl border border-[#F2A20C33] bg-[#F2A20C0A]">
                <span className="text-[20px] flex-shrink-0 mt-px">💪</span>
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="font-jakarta text-[13px] text-[#F0F4FF] leading-snug">{studyNudge}</span>
                  <button
                    onClick={() => navigate('/exam-select')}
                    className="self-start mt-1.5 px-3 py-1 rounded-lg font-jakarta text-[11px] font-semibold bg-[#F2A20C] text-[#0A0E1A] hover:bg-[#F59E0B] transition-colors"
                  >
                    Ôn luyện ngay →
                  </button>
                </div>
              </div>
            )}

            {/* Weekly report card */}
            {weeklyReport && (
              <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">Báo cáo tuần này</span>
                  <span className="font-jakarta text-[11px] text-[#475569]">7 ngày qua</span>
                </div>
                <p className="font-jakarta text-[13px] text-[#94A3B8] leading-relaxed">{weeklyReport.summary}</p>
                <div className="flex gap-4 pt-1">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-fraunces text-[20px] font-bold text-[#F8FAFC]">{weeklyReport.examCount}</span>
                    <span className="font-jakarta text-[11px] text-[#64748B]">bài thi</span>
                  </div>
                  <div className="w-px bg-[#1E2A44]" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-fraunces text-[20px] font-bold text-[#F8FAFC]">{weeklyReport.avgScore}</span>
                    <span className="font-jakarta text-[11px] text-[#64748B]">điểm trung bình</span>
                  </div>
                  {weeklyReport.topWeakTopic && (
                    <>
                      <div className="w-px bg-[#1E2A44]" />
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-fraunces text-[14px] font-bold text-[#F2A20C] truncate">{weeklyReport.topWeakTopic}</span>
                        <span className="font-jakarta text-[11px] text-[#64748B]">cần ôn nhất</span>
                      </div>
                    </>
                  )}
                </div>
              </section>
            )}

            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <span className="text-[48px]">📊</span>
                <span className="font-fraunces text-[18px] text-[#F8FAFC]">Chưa có dữ liệu</span>
                <span className="font-jakarta text-[13px] text-[#64748B]">Hoàn thành ít nhất một bài thi để xem thống kê.</span>
              </div>
            ) : (
              <>
                {/* Score sparkline */}
                <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-3">
                  <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">Xu hướng điểm số</span>
                  <span className="font-jakarta text-[11px] text-[#475569]">10 bài thi gần nhất</span>
                  <ResponsiveContainer width="100%" height={100}>
                    <LineChart data={sparkData}>
                      <Line
                        type="monotone" dataKey="score"
                        stroke="#F2A20C" strokeWidth={2}
                        dot={false} isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  {trendInsight && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[#0A0E1A] border border-[#1E2A44]">
                      <span className="text-[13px] mt-px">💡</span>
                      <span className="font-jakarta text-[12px] text-[#94A3B8]">{trendInsight}</span>
                    </div>
                  )}
                  {scoreProjection && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[#10B9810D] border border-[#10B98133]">
                      <span className="text-[13px] mt-px">🎯</span>
                      <span className="font-jakarta text-[12px] text-[#34D399]">{scoreProjection.summary}</span>
                    </div>
                  )}
                </section>

                {/* Topic radar */}
                {radarData.length > 0 && (
                  <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-3">
                    <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">Độ chính xác theo chủ đề</span>
                    <ResponsiveContainer width="100%" height={220}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#1E2A44" />
                        <PolarAngleAxis dataKey="topic" tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'Plus Jakarta Sans, sans-serif' }} />
                        <Radar dataKey="score" stroke="#F2A20C" fill="#F2A20C" fillOpacity={0.18} />
                      </RadarChart>
                    </ResponsiveContainer>
                    {radarInsight && (
                      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[#0A0E1A] border border-[#1E2A44]">
                        <span className="text-[13px] mt-px">💡</span>
                        <span className="font-jakarta text-[12px] text-[#94A3B8]">{radarInsight}</span>
                      </div>
                    )}
                  </section>
                )}

                {/* Learning DNA grid */}
                {radarData.length > 0 && (
                  <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-4">
                    <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">Learning DNA</span>
                    <span className="font-jakarta text-[11px] text-[#475569]">Bản đồ điểm mạnh và điểm yếu của bạn</span>
                    <div className="flex flex-col gap-2">
                      {[...radarData].sort((a, b) => b.score - a.score).map(({ topic, score }) => {
                        const color = score >= 70 ? '#10B981' : score >= 45 ? '#F2A20C' : '#EF4444'
                        const label = score >= 70 ? 'Mạnh' : score >= 45 ? 'Trung bình' : 'Cần ôn'
                        return (
                          <div key={topic} className="flex items-center gap-3">
                            <span className="font-jakarta text-[11px] text-[#94A3B8] w-28 flex-shrink-0 truncate">{topic}</span>
                            <div className="flex-1 h-2 bg-[#1E2A44] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${score}%`, background: color }}
                              />
                            </div>
                            <span className="font-jakarta text-[10px] font-semibold w-16 text-right flex-shrink-0" style={{ color }}>
                              {score}% · {label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )}

                {/* Activity heatmap */}
                <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-4">
                  <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">Hoạt động học tập</span>
                  <div className="flex gap-3">
                    {/* Day-of-week labels */}
                    <div className="flex flex-col gap-[2px] pt-5 flex-shrink-0">
                      {['', 'T2', '', 'T4', '', 'T6', ''].map((label, i) => (
                        <div key={i} className="h-3.5 flex items-center">
                          <span className="font-jakarta text-[9px] text-[#475569] w-4 text-right">{label}</span>
                        </div>
                      ))}
                    </div>
                    {/* Grid */}
                    <div
                      ref={heatScrollRef}
                      className="overflow-x-auto flex-1"
                      style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(242,162,12,0.35) transparent' }}
                    >
                      <div style={{ minWidth: weeks.length * 18 }}>
                        {/* Month labels */}
                        <div className="flex gap-[2px] mb-1">
                          {weeks.map((_, wi) => (
                            <div key={wi} className="w-3.5 flex-shrink-0 font-jakarta text-[9px] text-[#475569]">
                              {monthLabels[wi] ?? ''}
                            </div>
                          ))}
                        </div>
                        {/* Week columns */}
                        <div className="flex gap-[2px]">
                          {weeks.map((week, wi) => (
                            <div key={wi} className="flex flex-col gap-[2px]">
                              {week.map(({ key, count }) => (
                                <div
                                  key={key}
                                  title={`${key}: ${count} bài thi`}
                                  className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                                  style={{ background: heatColor(count) }}
                                />
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Legend */}
                  <div className="flex items-center gap-2">
                    <span className="font-jakarta text-[11px] text-[#475569]">Ít</span>
                    {[0, 1, 2, 3].map(c => (
                      <div key={c} className="w-3.5 h-3.5 rounded-sm" style={{ background: heatColor(c) }} />
                    ))}
                    <span className="font-jakarta text-[11px] text-[#475569]">Nhiều</span>
                  </div>
                  {heatmapInsight && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[#0A0E1A] border border-[#1E2A44]">
                      <span className="text-[13px] mt-px">💡</span>
                      <span className="font-jakarta text-[12px] text-[#94A3B8]">{heatmapInsight}</span>
                    </div>
                  )}
                </section>

                {/* Session timing patterns */}
                {sessionPatterns && (
                  <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-4">
                    <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">Nhịp học tập theo ngày</span>

                    {/* Day-of-week mini bar chart */}
                    <div className="flex items-end gap-1.5 h-16">
                      {sessionPatterns.dayPattern.map(day => {
                        const maxCount = Math.max(...sessionPatterns.dayPattern.map(d => d.count), 1)
                        const heightPct = day.count === 0 ? 4 : Math.max(12, Math.round((day.count / maxCount) * 100))
                        const isActive = day.dayIndex === sessionPatterns.mostActiveDay.dayIndex
                        const isBest   = sessionPatterns.bestScoreDay?.dayIndex === day.dayIndex
                        return (
                          <div key={day.dayIndex} className="flex flex-col items-center gap-1 flex-1">
                            <div
                              className="w-full rounded-sm transition-all"
                              style={{
                                height: `${heightPct}%`,
                                background: isBest ? '#10B981' : isActive ? '#F2A20C' : day.count > 0 ? '#818CF8' : '#1E2A44',
                                opacity: day.count === 0 ? 0.4 : 1,
                              }}
                            />
                            <span className="font-jakarta text-[9px] text-[#475569]">
                              {day.dayName.replace('Chủ nhật', 'CN').replace('Thứ ', '')}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    <div className="flex flex-wrap gap-3 text-[11px] font-jakarta text-[#64748B]">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#F2A20C] inline-block" /> Tích cực nhất</span>
                      {sessionPatterns.bestScoreDay && (
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400 inline-block" /> Điểm cao nhất</span>
                      )}
                    </div>

                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[#0A0E1A] border border-[#1E2A44]">
                      <span className="text-[13px] mt-px">💡</span>
                      <span className="font-jakarta text-[12px] text-[#94A3B8]">{sessionPatterns.insight}</span>
                    </div>
                  </section>
                )}

                {/* Today's focus */}
                {todayFocus && (
                  <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-3">
                    <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">Trọng tâm hôm nay</span>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-[#F2A20C1A] border border-[#F2A20C33] flex items-center justify-center flex-shrink-0">
                        <span className="text-[22px]">🎯</span>
                      </div>
                      <div className="flex flex-col gap-0.5 flex-1">
                        <span className="font-fraunces text-[16px] font-bold text-[#F8FAFC]">{todayFocus.topic}</span>
                        <span className="font-jakarta text-[12px] text-[#94A3B8]">Độ chính xác hiện tại: <span className="text-[#F2A20C] font-semibold">{todayFocus.score}%</span></span>
                      </div>
                      <button
                        onClick={() => navigate('/exam-select')}
                        className="px-3 py-1.5 rounded-lg bg-[#F2A20C] text-[#0A0E1A] font-jakarta text-[12px] font-semibold hover:bg-[#F59E0B] transition-colors flex-shrink-0"
                      >
                        Luyện ngay
                      </button>
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}

        {/* ════════════════ TAB 3: AI & TIA ════════════════ */}
        {activeTab === TAB_AITIA && (
          <>
            {/* Credit gauge + runway */}
            <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-4 items-center">
              <CreditGauge balance={user.credits_balance ?? 0} tier={tier} />
              {runwayDays !== null && (
                <p className="font-jakarta text-[12px] text-[#64748B] text-center">
                  Theo tốc độ học hiện tại, đủ cho ~<span className="text-amber-400 font-semibold">{runwayDays} ngày</span> học tập AI.
                </p>
              )}
              <div className="flex gap-6 flex-wrap justify-center">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-jakarta text-[11px] text-[#475569]">Gói hiện tại</span>
                  <span className="font-jakarta text-[13px] font-bold px-3 py-0.5 rounded-full"
                    style={{ background: (TIER_COLORS[tier] || '#64748B') + '22', color: TIER_COLORS[tier] || '#64748B' }}>
                    {TIER_LABELS[tier] || tier}
                  </span>
                </div>
                {user.subscription_period === 'annual' && (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-jakarta text-[11px] text-[#475569]">Chu kỳ</span>
                    <span className="font-jakarta text-[12px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">Hàng năm</span>
                  </div>
                )}
                {user.credits_reset_at && (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-jakarta text-[11px] text-[#475569]">Làm mới vào</span>
                    <span className="font-jakarta text-[13px] text-[#F0F4FF]">{formatDate(user.credits_reset_at)}</span>
                  </div>
                )}
                {user.subscription_expires_at && (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-jakarta text-[11px] text-[#475569]">Hết hạn</span>
                    <span className="font-jakarta text-[13px] text-[#F0F4FF]">{formatDate(user.subscription_expires_at)}</span>
                  </div>
                )}
              </div>
            </section>

            {/* 7-day trial CTA */}
            {tier === 'basic' && !user.trial_used && !trialDone && (
              <section className="bg-gradient-to-br from-[#1A2A10] to-[#0D1521] border border-[#2D4A1A] rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <span className="font-fraunces text-[16px] font-semibold text-[#F8FAFC]">Trải nghiệm AI học tập đầy đủ — 7 ngày miễn phí</span>
                  <p className="font-jakarta text-[13px] text-[#94A3B8]">
                    Mở khóa toàn bộ AI hỗ trợ trong 7 ngày: kế hoạch học cá nhân hoá, phân tích không giới hạn và 500 năng lượng học tập.
                  </p>
                </div>
                {trialError && <p className="font-jakarta text-[12px] text-red-400">{trialError}</p>}
                <button
                  disabled={trialActivating}
                  onClick={async () => {
                    setTrialActivating(true); setTrialError('')
                    const { error } = await activateTrial()
                    setTrialActivating(false)
                    if (error) {
                      setTrialError(typeof error === 'string' ? error : 'Kích hoạt thất bại, vui lòng thử lại')
                    } else {
                      setTrialDone(true); refundCredits(500); await refreshUser()
                    }
                  }}
                  className="self-start px-5 py-2.5 rounded-xl font-jakarta text-[13px] font-bold transition"
                  style={{ background: trialActivating ? '#1E2A44' : '#10B981', color: trialActivating ? '#475569' : '#0A0E1A' }}
                >
                  {trialActivating ? 'Đang kích hoạt...' : 'Kích hoạt dùng thử'}
                </button>
              </section>
            )}
            {trialDone && (
              <div className="px-5 py-4 rounded-2xl border border-[#2D4A1A] bg-[#0A1A0A] font-jakarta text-[13px] text-[#34D399]">
                Đã kích hoạt! Gói Học sinh của bạn sẽ hoạt động trong 7 ngày.
              </div>
            )}

            {/* Trial urgency banner */}
            {trialUrgency && (
              <section className="border rounded-2xl p-5 flex flex-col gap-3"
                style={{ background: 'linear-gradient(135deg, #1A0E0A 0%, #0D1521 100%)', borderColor: trialUrgency.daysLeft <= 1 ? '#EF444460' : '#F2A20C60' }}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex flex-col gap-1">
                    <span className="font-fraunces text-[14px] font-semibold text-[#F0F4FF]">{trialUrgency.message}</span>
                    <span className="font-jakarta text-[12px] text-[#94A3B8]">Sau khi hết hạn bạn sẽ mất quyền truy cập vào:</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} className="w-2 h-2 rounded-full transition-colors"
                        style={{ background: i < (7 - trialUrgency.daysLeft) ? '#F2A20C' : '#1E2A44' }} />
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {trialUrgency.lossItems.map(item => (
                    <span key={item} className="font-jakarta text-[11px] px-2.5 py-1 rounded-full bg-[#F2A20C15] border border-[#F2A20C30] text-[#F2A20C]">
                      {item}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Tier gap — "Bạn đang bỏ lỡ..." card */}
            {tierGap && (
              <section className="bg-[#0D1521] border border-[#818CF8]/30 rounded-2xl p-6 flex flex-col gap-4">
                <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">Bạn đang bỏ lỡ...</span>
                <div className="flex flex-wrap gap-2">
                  {tierGap.missingFeatures.map(f => (
                    <span key={f} className="font-jakarta text-[11px] px-3 py-1.5 rounded-full border border-[#818CF8]/40 bg-[#818CF8]/8 text-[#A5B4FC]">
                      {f}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => document.querySelector('#upgrade-plans')?.scrollIntoView({ behavior: 'smooth' })}
                  className="self-start px-5 py-2.5 rounded-xl font-jakarta text-[13px] font-bold transition"
                  style={{ background: '#818CF8', color: '#0A0E1A' }}
                >
                  {tierGap.ctaLabel} →
                </button>
              </section>
            )}

            {/* Plan cards */}
            <section id="upgrade-plans" className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <span className="font-fraunces text-[16px] font-semibold text-[#F8FAFC]">Nâng cấp gói</span>
                <div className="flex items-center gap-1 bg-[#111827] rounded-full p-1">
                  {['monthly', 'annual'].map(b => (
                    <button key={b} onClick={() => setBilling(b)}
                      className={`px-4 py-1.5 rounded-full font-jakarta text-[12px] transition ${billing === b ? 'bg-[#F2A20C] text-[#0A0E1A] font-semibold' : 'text-[#94A3B8]'}`}>
                      {b === 'monthly' ? 'Hàng tháng' : 'Hàng năm (−25%)'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {plans.map(plan => (
                  <div key={plan.tier}
                    className={`flex items-center justify-between gap-4 px-5 py-4 rounded-xl border transition ${
                      tier === plan.tier ? 'border-amber-400/60 bg-amber-400/5' : 'border-[#1E2A44] bg-[#111827]'
                    }`}>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-jakarta text-[14px] font-bold text-[#F0F4FF]">{plan.label}</span>
                        {plan.badge && (
                          <span className="font-jakarta text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400">{plan.badge}</span>
                        )}
                        {tier === plan.tier && (
                          <span className="font-jakarta text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-400">Hiện tại</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-jakarta text-[12px] text-[#64748B]">⚡ {plan.credits.toLocaleString()} Tia/tháng</span>
                        {plan.bonus && <span className="font-jakarta text-[12px] text-amber-300">🎁 {plan.bonus}</span>}
                      </div>
                      {plan.features && (
                        <div className="flex flex-col gap-1 mt-1">
                          {plan.features.map(f => (
                            <span key={f} className="font-jakarta text-[12px] text-[#94A3B8] flex items-center gap-1.5">
                              <span className="text-emerald-400 text-[10px]">✓</span>{f}
                            </span>
                          ))}
                        </div>
                      )}
                      {plan.effective && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-jakarta text-[11px] text-[#475569]">≈ {plan.effective}</span>
                          {billing === 'annual' && plan.tier === 'student' && studentSavingsDays > 0 && (
                            <span className="font-jakarta text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                              +{studentSavingsDays} ngày học tập AI miễn phí
                            </span>
                          )}
                          {billing === 'annual' && plan.tier === 'complete' && completeSavingsDays > 0 && (
                            <span className="font-jakarta text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                              +{completeSavingsDays} ngày học tập AI miễn phí
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className="font-fraunces text-[15px] font-bold text-[#F0F4FF]">{plan.price}</span>
                      {tier !== plan.tier && plan.tier !== 'basic' && (
                        <span className="font-jakarta text-[11px] text-amber-400">Liên hệ nâng cấp</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-4 rounded-xl border border-[#1E2A44] bg-[#0A0E1A] flex flex-col gap-1.5">
                <span className="font-jakarta text-[12px] font-semibold text-[#94A3B8]">Thanh toán (Chuyển khoản ngân hàng)</span>
                <span className="font-jakarta text-[12px] text-[#64748B]">
                  Chuyển khoản theo số tài khoản được cung cấp và gửi email xác nhận. Kích hoạt trong 1–2 giờ làm việc.
                </span>
                <span className="font-jakarta text-[11px] text-[#475569]">* MoMo · VNPay · ZaloPay · PayOS sẽ sớm ra mắt</span>
              </div>
            </section>

            {/* Top-up packages */}
            <section id="topup" className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-4">
              <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">Nạp thêm Tia</span>

              {/* Personalized recommendation */}
              {topupRec ? (
                <div className="flex flex-col gap-3">
                  <p className="font-jakarta text-[12px] text-[#94A3B8]">{topupRec.reasoning}</p>
                  <button
                    onClick={() => setTopupPkg(topupRec.pack)}
                    className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl border border-amber-400/50 bg-amber-400/5 hover:bg-amber-400/10 transition w-full text-left"
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-jakarta text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400">{topupRec.pack.label}</span>
                        <span className="font-jakarta text-[11px] text-[#64748B]">Gợi ý cho bạn</span>
                      </div>
                      <span className="font-fraunces text-[18px] font-bold text-amber-400">⚡ {topupRec.pack.credits} Tia</span>
                      <span className="font-jakarta text-[11px] text-[#64748B]">Đủ cho ~{topupRec.coversDays} ngày học tập AI</span>
                    </div>
                    <span className="font-fraunces text-[16px] font-bold text-[#F0F4FF] flex-shrink-0">{topupRec.pack.price}</span>
                  </button>
                  <button
                    onClick={() => {}}
                    className="font-jakarta text-[11px] text-[#475569] hover:text-[#64748B] transition text-center"
                    onClickCapture={(e) => { e.preventDefault(); e.stopPropagation() }}
                  >
                    Xem tất cả gói →
                  </button>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 hidden" aria-hidden="true">
                    {TOPUP_PACKAGES.map(pkg => (
                      <button key={pkg.price} onClick={() => setTopupPkg(pkg)}
                        className="flex flex-col items-center gap-1.5 px-4 py-4 rounded-xl border border-[#1E2A44] bg-[#111827] hover:border-amber-400/50 hover:bg-amber-400/5 transition">
                        <span className="font-jakarta text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1E2A44] text-[#94A3B8]">{pkg.label}</span>
                        <span className="font-fraunces text-[18px] font-bold text-amber-400">⚡ {pkg.credits}</span>
                        <span className="font-jakarta text-[12px] text-[#F0F4FF]">{pkg.price}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {TOPUP_PACKAGES.map(pkg => (
                    <button
                      key={pkg.price}
                      onClick={() => setTopupPkg(pkg)}
                      className="flex flex-col items-center gap-1.5 px-4 py-4 rounded-xl border border-[#1E2A44] bg-[#111827] hover:border-amber-400/50 hover:bg-amber-400/5 transition"
                    >
                      <span className="font-jakarta text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1E2A44] text-[#94A3B8]">{pkg.label}</span>
                      <span className="font-fraunces text-[18px] font-bold text-amber-400">⚡ {pkg.credits}</span>
                      <span className="font-jakarta text-[12px] text-[#F0F4FF]">{pkg.price}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Credit log */}
            {creditLog.length > 0 && (
              <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-4">
                <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">Lịch sử Tia</span>
                <div className="flex flex-col gap-1">
                  {(showAllCredits ? creditLog : creditLog.slice(0, 8)).map((entry, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-[#1E2A44] last:border-0">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-jakarta text-[12px] text-[#94A3B8]">{REASON_LABELS[entry.reason] ?? entry.reason}</span>
                        <span className="font-jakarta text-[11px] text-[#475569]">{formatDate(entry.created_at)}</span>
                      </div>
                      <span className={`font-fraunces text-[14px] font-bold ${entry.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {entry.delta > 0 ? '+' : ''}{entry.delta}
                      </span>
                    </div>
                  ))}
                </div>
                {creditLog.length > 8 && !showAllCredits && (
                  <button onClick={() => setShowAllCredits(true)}
                    className="font-jakarta text-[12px] text-amber-400 hover:text-amber-300 transition text-center">
                    + Xem thêm ({creditLog.length - 8} mục)
                  </button>
                )}
              </section>
            )}
          </>
        )}

        {/* ════════════════ CÀI ĐẶT (via gear icon) ════════════════ */}
        {activeTab === TAB_SETTINGS && (
          <>
            {/* AI Learning Preferences */}
            <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">Tùy chỉnh AI học tập</span>
                {aiIsCustomized && (
                  <span className="font-jakarta text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#818CF820] text-[#818CF8] border border-[#818CF833]">
                    Đã tùy chỉnh
                  </span>
                )}
              </div>

              {/* hint_style */}
              <div className="flex flex-col gap-2">
                <span className="font-jakarta text-[12px] font-semibold text-[#94A3B8]">Phong cách gợi ý</span>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { v: 'socratic', label: 'Socratic',   desc: 'Đặt câu hỏi gợi mở' },
                    { v: 'direct',   label: 'Trực tiếp',  desc: 'Giải thích rõ ràng' },
                    { v: 'visual',   label: 'Trực quan',  desc: 'Từng bước có sơ đồ' },
                  ].map(({ v, label, desc }) => (
                    <button
                      key={v}
                      onClick={() => setAIPrefs({ ...aiPrefs, hint_style: v })}
                      className={`flex flex-col items-start px-4 py-2.5 rounded-xl border transition text-left ${
                        aiPrefs.hint_style === v
                          ? 'border-[#818CF8] bg-[#818CF81A] text-[#F8FAFC]'
                          : 'border-[#1E2A44] bg-[#0A0E1A] text-[#64748B] hover:border-[#818CF850]'
                      }`}
                    >
                      <span className="font-jakarta text-[12px] font-semibold">{label}</span>
                      <span className="font-jakarta text-[10px] mt-0.5">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* explanation_depth */}
              <div className="flex flex-col gap-2">
                <span className="font-jakarta text-[12px] font-semibold text-[#94A3B8]">Độ chi tiết giải thích</span>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { v: 'brief',        label: 'Ngắn gọn',    desc: '1–2 câu' },
                    { v: 'detailed',     label: 'Chi tiết',     desc: 'Giải thích rõ ràng' },
                    { v: 'step-by-step', label: 'Từng bước',    desc: 'Phân tích từng phần' },
                  ].map(({ v, label, desc }) => (
                    <button
                      key={v}
                      onClick={() => setAIPrefs({ ...aiPrefs, explanation_depth: v })}
                      className={`flex flex-col items-start px-4 py-2.5 rounded-xl border transition text-left ${
                        aiPrefs.explanation_depth === v
                          ? 'border-[#10B981] bg-[#10B9811A] text-[#F8FAFC]'
                          : 'border-[#1E2A44] bg-[#0A0E1A] text-[#64748B] hover:border-[#10B98150]'
                      }`}
                    >
                      <span className="font-jakarta text-[12px] font-semibold">{label}</span>
                      <span className="font-jakarta text-[10px] mt-0.5">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* language_mix */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="font-jakarta text-[13px] font-semibold text-[#F0F4FF]">Pha tiếng Anh thuật ngữ toán</span>
                  <span className="font-jakarta text-[11px] text-[#64748B]">AI có thể dùng thuật ngữ toán tiếng Anh khi cần rõ hơn.</span>
                </div>
                <button
                  onClick={() => setAIPrefs({ ...aiPrefs, language_mix: aiPrefs.language_mix === 'mixed' ? 'vietnamese-only' : 'mixed' })}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${aiPrefs.language_mix === 'mixed' ? 'bg-[#818CF8]' : 'bg-[#1E2A44]'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${aiPrefs.language_mix === 'mixed' ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* weak_topic_focus */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="font-jakarta text-[13px] font-semibold text-[#F0F4FF]">Ưu tiên chủ đề yếu</span>
                  <span className="font-jakarta text-[11px] text-[#64748B]">AI tự động nhấn mạnh vào khu vực bạn còn yếu nhất.</span>
                </div>
                <button
                  onClick={() => setAIPrefs({ ...aiPrefs, weak_topic_focus: !aiPrefs.weak_topic_focus })}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${aiPrefs.weak_topic_focus ? 'bg-[#F2A20C]' : 'bg-[#1E2A44]'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${aiPrefs.weak_topic_focus ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>
            </section>

            {/* Learning goals */}
            <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">Mục tiêu học tập</span>
                {goalSaved && (
                  <span className="font-jakarta text-[11px] text-emerald-400">Đã lưu ✓</span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-jakarta text-[12px] font-semibold text-[#94A3B8]">Ngày thi dự kiến</label>
                <input
                  type="date"
                  value={goalExamDate}
                  onChange={e => { setGoalExamDate(e.target.value); setGoalSaved(false) }}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full px-4 py-3 rounded-xl border border-[#1E2A44] bg-[#0A0E1A] font-jakarta text-[13px] text-[#F0F4FF] focus:outline-none focus:border-[#F2A20C] transition [color-scheme:dark]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-jakarta text-[12px] font-semibold text-[#94A3B8]">Trường mục tiêu</label>
                <input
                  type="text"
                  value={goalSchool}
                  onChange={e => { setGoalSchool(e.target.value); setGoalSaved(false) }}
                  placeholder="VD: THPT Chuyên Lê Hồng Phong"
                  maxLength={200}
                  className="w-full px-4 py-3 rounded-xl border border-[#1E2A44] bg-[#0A0E1A] font-jakarta text-[13px] text-[#F0F4FF] placeholder-[#475569] focus:outline-none focus:border-[#F2A20C] transition"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-jakarta text-[12px] font-semibold text-[#94A3B8]">Số giờ học mỗi tuần</label>
                <input
                  type="number"
                  value={goalHours}
                  onChange={e => { setGoalHours(e.target.value); setGoalSaved(false) }}
                  min={1} max={168} placeholder="VD: 10"
                  className="w-full px-4 py-3 rounded-xl border border-[#1E2A44] bg-[#0A0E1A] font-jakarta text-[13px] text-[#F0F4FF] placeholder-[#475569] focus:outline-none focus:border-[#F2A20C] transition"
                />
              </div>

              <button
                disabled={goalSaving}
                onClick={async () => {
                  setGoalSaving(true); setGoalSaved(false)
                  await updateExtendedProfile({
                    exam_date:           goalExamDate || undefined,
                    target_school:       goalSchool.trim() || undefined,
                    weekly_study_hours:  goalHours ? parseInt(goalHours) : undefined,
                  })
                  await refreshUser()
                  setGoalSaving(false); setGoalSaved(true)
                }}
                className="self-start px-5 py-2.5 rounded-xl font-jakarta text-[13px] font-bold transition"
                style={{ background: goalSaving ? '#1E2A44' : '#F2A20C', color: goalSaving ? '#475569' : '#0A0E1A' }}
              >
                {goalSaving ? 'Đang lưu...' : 'Lưu mục tiêu'}
              </button>
            </section>

            {/* Account status */}
            <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-4">
              <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">Trạng thái tài khoản</span>
              <div className="flex items-center gap-3">
                {!!user.is_locked ? (
                  <span className="font-jakarta text-[12px] font-bold px-3 py-1 rounded-full bg-red-500/20 text-red-400">Đã khóa</span>
                ) : !!user.is_deactivated ? (
                  <span className="font-jakarta text-[12px] font-bold px-3 py-1 rounded-full bg-amber-400/20 text-amber-400">Tạm ngưng</span>
                ) : (
                  <span className="font-jakarta text-[12px] font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400">Hoạt động</span>
                )}
              </div>
              {!!user.is_locked && (
                <p className="font-jakarta text-[12px] text-[#94A3B8]">{user.lock_reason || 'Liên hệ hỗ trợ để mở khóa tài khoản.'}</p>
              )}
              {!!user.is_deactivated && !user.is_locked && (
                <div className="flex items-center justify-between gap-4">
                  <span className="font-jakarta text-[12px] text-[#94A3B8]">Bạn có thể kích hoạt lại bất kỳ lúc nào.</span>
                  <button
                    disabled={reactivating}
                    onClick={async () => { setReactivating(true); await reactivateAccount(); setReactivating(false) }}
                    className="shrink-0 px-4 py-2 rounded-lg font-jakarta text-[12px] font-bold transition"
                    style={{ background: '#F2A20C', color: '#0A0E1A', opacity: reactivating ? 0.6 : 1 }}
                  >
                    {reactivating ? 'Đang kích hoạt...' : 'Kích hoạt lại'}
                  </button>
                </div>
              )}
            </section>

            {/* Notifications */}
            <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-4">
              <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">Thông báo</span>
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="font-jakarta text-[13px] font-semibold text-[#F0F4FF]">Nhắc nhở học tập hàng ngày</span>
                  <span className="font-jakarta text-[11px] text-[#64748B]">Nhận thông báo nhắc ôn luyện mỗi ngày.</span>
                </div>
                <button
                  onClick={async () => {
                    if (!reminderEnabled) {
                      await requestStudyReminder()
                      setReminderEnabled(true)
                    } else {
                      localStorage.removeItem('study_reminder_enabled')
                      setReminderEnabled(false)
                    }
                  }}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${reminderEnabled ? 'bg-amber-400' : 'bg-[#1E2A44]'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${reminderEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>
              {reminderEnabled && (
                <div className="flex items-center gap-3 pt-1">
                  <span className="font-jakarta text-[12px] text-[#94A3B8]">Giờ nhắc nhở:</span>
                  <select
                    value={reminderHour}
                    onChange={e => {
                      const h = parseInt(e.target.value, 10)
                      setReminderHour(h)
                      localStorage.setItem('study_reminder_hour', String(h))
                    }}
                    className="px-3 py-1.5 rounded-lg border border-[#1E2A44] bg-[#111827] font-jakarta text-[12px] text-[#F0F4FF] focus:outline-none focus:border-amber-400/60"
                  >
                    {Array.from({ length: 18 }, (_, i) => i + 6).map(h => (
                      <option key={h} value={h}>{h}:00</option>
                    ))}
                  </select>
                </div>
              )}
            </section>

            {/* Lớp học */}
            <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-6 flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="font-jakarta text-[14px] font-semibold text-[#F8FAFC]">Lớp học</span>
                <span className="font-jakarta text-[12px] text-[#64748B]">Tham gia lớp học hoặc quản lý lớp (giáo viên)</span>
              </div>
              <button
                onClick={() => navigate('/class')}
                className="flex-shrink-0 px-5 py-2 rounded-lg font-jakarta text-[13px] font-bold text-[#F8FAFC] bg-[#6366F1] hover:opacity-90 transition"
              >
                Vào lớp →
              </button>
            </section>

            {/* Share & Earn — referral */}
            {referral?.referral_code && (
              <section className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">Chia sẻ & Kiếm Tia</span>
                  <span className="font-jakarta text-[12px] text-[#64748B]">
                    Bạn và người được mời đều nhận <span className="text-amber-400">⚡ 50 Tia</span> khi họ đăng ký.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly value={referralUrl}
                    className="flex-1 px-3 py-2 rounded-lg border border-[#1E2A44] bg-[#0A0E1A] font-jakarta text-[11px] text-[#64748B] select-all"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(referralUrl)
                        .then(() => toast.success('Đã sao chép link giới thiệu'))
                        .catch(() => {})
                    }}
                    className="px-3 py-2 rounded-lg font-jakarta text-[12px] font-bold flex-shrink-0"
                    style={{ background: '#F2A20C', color: '#0A0E1A' }}
                  >
                    Sao chép
                  </button>
                </div>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Ôn thi cùng Zenith nhé! Dùng link này để nhận 50 Tia miễn phí: ${referralUrl}`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="self-start flex items-center gap-2 px-4 py-2 rounded-lg font-jakarta text-[12px] font-semibold bg-[#25D366] text-white hover:opacity-90 transition"
                >
                  <span>💬</span> Chia sẻ qua WhatsApp
                </a>
                {(referral.successful_referrals ?? 0) > 0 && (
                  <div className="flex items-center gap-3 pt-1 border-t border-[#1E2A44]">
                    <span className="font-jakarta text-[12px] text-[#64748B]">
                      <span className="text-amber-400 font-bold">{referral.successful_referrals}</span> người đã tham gia qua link
                    </span>
                    <span className="font-jakarta text-[12px] text-amber-400">
                      ⚡ {(referral.successful_referrals ?? 0) * 50} Tia đã kiếm
                    </span>
                  </div>
                )}
              </section>
            )}

            {/* Danger Zone — collapsed by default */}
            <section className="bg-[#0D1521] border border-red-500/20 rounded-2xl p-7 flex flex-col gap-4">
              <button
                onClick={() => setDangerOpen(v => !v)}
                className="flex items-center gap-2 font-jakarta text-[13px] text-red-400 hover:text-red-300 transition self-start"
              >
                <span>Xóa hoặc tạm ngưng tài khoản</span>
                <span className="text-[10px]">{dangerOpen ? '▲' : '▼'}</span>
              </button>

              <AnimatePresence>
                {dangerOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden flex flex-col gap-5"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap pt-2 border-t border-[#1E2A44]">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-jakarta text-[13px] font-semibold text-[#F0F4FF]">Tạm ngưng tài khoản</span>
                        <span className="font-jakarta text-[12px] text-[#64748B]">Vô hiệu hóa tài khoản tạm thời. Bạn có thể kích hoạt lại sau.</span>
                      </div>
                      <button
                        onClick={() => setShowDeactivateModal(true)}
                        className="shrink-0 px-4 py-2 rounded-lg font-jakarta text-[12px] font-bold border border-amber-400/40 text-amber-400 hover:bg-amber-400/10 transition"
                      >
                        Tạm ngưng
                      </button>
                    </div>
                    <div className="border-t border-[#1E2A44]" />
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-jakarta text-[13px] font-semibold text-[#F0F4FF]">Xóa tài khoản vĩnh viễn</span>
                        <span className="font-jakarta text-[12px] text-[#64748B]">Tất cả dữ liệu sẽ bị xóa và không thể khôi phục.</span>
                      </div>
                      <button
                        onClick={() => { setShowDeleteModal(true); setDeleteEmail(''); setDangerError('') }}
                        className="shrink-0 px-4 py-2 rounded-lg font-jakarta text-[12px] font-bold border border-red-500/40 text-red-400 hover:bg-red-500/10 transition"
                      >
                        Xóa tài khoản
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </>
        )}

      </div>

      {/* ── Top-up package modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {topupPkg && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
            onClick={() => { setTopupPkg(null); setCopyBankDone(false) }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="max-w-sm w-full bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-5"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-fraunces text-[16px] font-bold text-[#F8FAFC]">Nạp ⚡ {topupPkg.credits} Tia</p>
                  <p className="font-jakarta text-[13px] text-[#64748B] mt-0.5">{topupPkg.price} · Chuyển khoản ngân hàng</p>
                </div>
                <button onClick={() => { setTopupPkg(null); setCopyBankDone(false) }} className="text-[#475569] hover:text-[#F8FAFC] text-xl leading-none">×</button>
              </div>

              <div className="flex flex-col gap-3 bg-[#111827] rounded-xl p-4">
                {[
                  ['Ngân hàng', BANK_INFO.bank_name],
                  ['Số tài khoản', BANK_INFO.account_number],
                  ['Chủ tài khoản', BANK_INFO.account_name],
                  ['Số tiền', topupPkg.price],
                  ['Nội dung CK', `TOPUP ${user.email} ${topupPkg.credits}TIA`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <span className="font-jakarta text-[11px] text-[#475569]">{label}</span>
                    <span className="font-jakarta text-[12px] font-semibold text-[#F0F4FF] text-right">{value}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  const text = `Ngân hàng: ${BANK_INFO.bank_name}\nSố TK: ${BANK_INFO.account_number}\nChủ TK: ${BANK_INFO.account_name}\nSố tiền: ${topupPkg.price}\nNội dung: TOPUP ${user.email} ${topupPkg.credits}TIA`
                  navigator.clipboard?.writeText(text).then(() => setCopyBankDone(true)).catch(() => {})
                }}
                className="py-2.5 rounded-xl font-jakarta text-[13px] font-bold transition"
                style={{ background: copyBankDone ? '#10B981' : '#F2A20C', color: '#0A0E1A' }}
              >
                {copyBankDone ? '✓ Đã sao chép' : 'Sao chép thông tin'}
              </button>
              <p className="font-jakarta text-[11px] text-[#475569] text-center">
                Sau khi chuyển khoản, Tia sẽ được cộng trong 1–2 giờ làm việc.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Deactivate modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showDeactivateModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="max-w-sm w-full bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-5"
            >
              <span className="font-fraunces text-[16px] font-bold text-[#F8FAFC]">Tạm ngưng tài khoản?</span>
              <p className="font-jakarta text-[13px] text-[#94A3B8]">
                Bạn sẽ không thể sử dụng dịch vụ cho đến khi kích hoạt lại. Dữ liệu của bạn sẽ được giữ nguyên.
              </p>
              {dangerError && <p className="font-jakarta text-[12px] text-red-400">{dangerError}</p>}
              <div className="flex gap-2">
                <button
                  disabled={dangerLoading}
                  onClick={async () => {
                    setDangerLoading(true); setDangerError('')
                    const { error } = await deactivateAccount()
                    setDangerLoading(false)
                    if (error) { setDangerError(typeof error === 'string' ? error : 'Thất bại, vui lòng thử lại') }
                    else { setShowDeactivateModal(false); logout() }
                  }}
                  className="flex-1 py-2.5 rounded-xl font-jakarta text-[13px] font-bold transition"
                  style={{ background: dangerLoading ? '#1E2A44' : '#F2A20C', color: dangerLoading ? '#475569' : '#0A0E1A' }}
                >
                  {dangerLoading ? 'Đang xử lý...' : 'Xác nhận tạm ngưng'}
                </button>
                <button
                  onClick={() => { setShowDeactivateModal(false); setDangerError('') }}
                  className="px-4 py-2.5 rounded-xl font-jakarta text-[13px] text-[#64748B] hover:text-[#F8FAFC] transition"
                >
                  Huỷ
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete account modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="max-w-sm w-full bg-[#0D1521] border border-red-500/30 rounded-2xl p-7 flex flex-col gap-5"
            >
              <span className="font-fraunces text-[16px] font-bold text-red-400">Xóa tài khoản vĩnh viễn</span>
              <p className="font-jakarta text-[13px] text-[#94A3B8]">
                Hành động này <strong className="text-[#F8FAFC]">không thể hoàn tác</strong>. Tất cả dữ liệu bao gồm lịch sử thi và Tia sẽ bị xóa.
              </p>
              <div className="flex flex-col gap-1.5">
                <span className="font-jakarta text-[12px] text-[#64748B]">Nhập địa chỉ email của bạn để xác nhận:</span>
                <input
                  className="px-4 py-2.5 rounded-xl border border-[#1E2A44] bg-[#111827] font-jakarta text-[13px] text-[#F0F4FF] focus:outline-none focus:border-red-400"
                  placeholder={user.email}
                  value={deleteEmail}
                  onChange={e => setDeleteEmail(e.target.value)}
                />
              </div>
              {dangerError && <p className="font-jakarta text-[12px] text-red-400">{dangerError}</p>}
              <div className="flex gap-2">
                <button
                  disabled={dangerLoading || deleteEmail !== user.email}
                  onClick={async () => {
                    setDangerLoading(true); setDangerError('')
                    const { error } = await deleteAccount(deleteEmail)
                    setDangerLoading(false)
                    if (error) { setDangerError(typeof error === 'string' ? error : 'Thất bại, vui lòng thử lại') }
                    else { setShowDeleteModal(false); logout() }
                  }}
                  className="flex-1 py-2.5 rounded-xl font-jakarta text-[13px] font-bold transition disabled:opacity-40"
                  style={{ background: '#EF4444', color: '#fff' }}
                >
                  {dangerLoading ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
                </button>
                <button
                  onClick={() => { setShowDeleteModal(false); setDangerError(''); setDeleteEmail('') }}
                  className="px-4 py-2.5 rounded-xl font-jakarta text-[13px] text-[#64748B] hover:text-[#F8FAFC] transition"
                >
                  Huỷ
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  )
}
