import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  LineChart, Line, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { useAuth } from '../context/AuthContext.jsx'
import { useHistory } from '../context/HistoryContext.jsx'
import { loadQuestions } from '../api/index.js'
import { getCreditLog, activateTrial, getReferral, updateUsername, examStrategy, compareProvince, updateExtendedProfile, useStreakFreeze, getChartInsights, getPeerStats, getWeeklyInsight, getSimulationBriefing } from '../api/aiClient.js'
import { useReadiness } from '../hooks/useReadiness.js'
import { pageVariants } from '../utils/animations.js'
import AchievementCeremony from '../components/AchievementCeremony.jsx'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { useToast } from '../context/ToastContext.jsx'
import { computeStreak, computeStreakPersonalBest, getStreakRecoveryStatus } from '../utils/streak.js'
import { getDaysUntilExam } from '../utils/examCountdown.js'
import { computeBadges, BADGE_DEFS } from '../utils/badges.js'
import { TOPIC_LABELS } from '../utils/topicLabels.js'
import { requestStudyReminder } from '../utils/studyReminder.js'
import { getInitialTab, formatCreditSessions, TAB_PROGRESS, TAB_ANALYTICS, TAB_AITIA, TAB_SETTINGS } from '../utils/accountHelpers.js'
import { interpretScoreTrend, getTodayFocus, getNextMilestone } from '../utils/insights.js'
import { getMasteryProgress, MASTERY_TIERS } from '../utils/masteryRank.js'
import { generateWeeklyReport } from '../utils/weeklyReport.js'
import { getStudyNudge } from '../utils/studyNudge.js'
import { classifyLearner } from '../utils/learnerArchetype.js'
import { getScoreProjection } from '../utils/scoreProjection.js'
import { useAIPreferences } from '../hooks/useAIPreferences.js'
import { getTopupRecommendation, getTrialUrgency, getAnnualSavingsDays } from '../utils/monetization.js'
import { getGoalStatus } from '../utils/goalAlignment.js'
import { getExamPhase } from '../utils/examUrgency.js'
import { generateProgressReport, reportToText } from '../utils/progressReport.js'
import { getSessionPatterns } from '../utils/sessionPatterns.js'
import { getAdvisorMessage } from '../utils/advisorMessage.js'
import { getSimulationMode, getScoreConfidenceInterval, getDailySimulationPlan } from '../utils/examSimulation.js'
import { getProvinceNarrative } from '../utils/provinceNarrative.js'
import { getProvincialContext, getDifficultyInsight } from '../utils/provincialData.js'
import { getTierGap } from '../utils/tierGap.js'
import { getUpgradeContext } from '../utils/upgradeContext.js'
import { getStreakFreezeInfo } from '../utils/streakFreeze.js'
import { getTopicNodes, getPriorityTopics } from '../utils/learningGraph.js'
import { SpotlightCard } from '../components/SpotlightCard.jsx'
import { AnimatedShinyText } from '../components/ui/animated-shiny-text.jsx'
import { ShimmerButton } from '../components/ui/shimmer-button.jsx'
// ─── Constants ───────────────────────────────────────────────────────────────

const REASON_LABELS = {
  'analyze':                    'Phân tích kết quả',
  'hint':                       'Gợi ý câu hỏi',
  'explain':                    'Giải thích đáp án',
  'study-plan':                 'Kế hoạch học tập',
  'subscription_bonus_student': 'Nâng cấp gói Học sinh',
  'subscription_bonus_complete':'Nâng cấp gói Toàn diện',
  'admin_grant':                   'Nạp Tia',
  'trial_activation':              'Kích hoạt dùng thử',
  'grade_change_request':          'Yêu cầu đổi lớp',
  'grade_change_rejection_refund': 'Hoàn Tia (từ chối đổi lớp)',
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



// ─── Sub-components ───────────────────────────────────────────────────────────

function StatChip({ icon, value, label }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4">
      <span className="font-fraunces text-[17px] font-bold text-primary">
        <span className={icon === '🔥' ? 'streak-fire' : undefined}>{icon}</span> {value}
      </span>
      <span className="font-jakarta text-[0.6875rem] text-dim">{label}</span>
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 rounded-lg font-jakarta text-[0.8125rem] font-medium transition ${
        active ? 'bg-primary text-primary-fg font-semibold' : 'text-dim hover:text-muted'
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
      <span className="font-jakarta text-[0.6875rem] text-faint">Năng lượng học tập còn lại</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Account() {
  usePageMeta('Tài khoản', { noindex: true })
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
  // Grade change request state
  const [gradeRequest,       setGradeRequest]       = useState(null)   // {status, current_grade, requested_grade, ...}
  const [gradeRequestLoading, setGradeRequestLoading] = useState(false)
  const [showGradeChangeForm, setShowGradeChangeForm] = useState(false)
  const [gradeChangeTarget,   setGradeChangeTarget]   = useState('')
  const [gradeChangeReason,   setGradeChangeReason]   = useState('')
  const [gradeChangeError,    setGradeChangeError]    = useState('')
  const [gradeChangeSubmitting, setGradeChangeSubmitting] = useState(false)
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
  const [freezeLoading,   setFreezeLoading]   = useState(false)
  const [freezeError,     setFreezeError]     = useState('')
  const [freezeSuccess,   setFreezeSuccess]   = useState(false)

  // ── Heatmap scroll ref ──
  // ── Mastery rank advancement animation ──

  // ── AI chart insights (Sprint 16) ──
  const [chartInsights,        setChartInsights]        = useState(null)
  const [chartInsightsLoading, setChartInsightsLoading] = useState(false)
  const chartInsightsFetched = useRef(false)
  const [peerStats, setPeerStats] = useState(null)
  const peerStatsFetched = useRef(false)

  // ── Weekly AI summary ──
  const [weeklyAISummary,        setWeeklyAISummary]        = useState(null)
  const [weeklyAISummaryLoading, setWeeklyAISummaryLoading] = useState(false)
  const weeklyAISummaryFetched = useRef(false)

  // Pre-populate weekly summary from sessionStorage on mount (prevents re-fetch on tab switch)
  useEffect(() => {
    const cached = sessionStorage.getItem('zenith_weekly_summary')
    if (cached) {
      setWeeklyAISummary(cached)
      weeklyAISummaryFetched.current = true
    }
  }, [])

  // ── Simulation briefing (MOAT 6) ──
  const [simBriefing, setSimBriefing] = useState(null)
  const simBriefingFetched = useRef(false)


  const toast = useToast()


  // ── All derived memos — MUST be before any conditional return (Rules of Hooks) ──
  const tier   = user?.subscription_tier || 'basic'
  const radarData     = useMemo(() => aggregateTopicAccuracy(results), [results])
  const sparkData     = useMemo(() => {
    const sorted = [...results].sort((a, b) => new Date(a.finishedAt) - new Date(b.finishedAt)).slice(-10)
    return sorted.map((r, i) => ({ i, score: r.score ?? 0 }))
  }, [results])
  const daysUntil     = user ? getDaysUntilExam(user.province) : null
  const streak        = useMemo(() => computeStreak(results), [results])
  const earnedBadgeIds = useMemo(() => new Set(computeBadges(results).map(b => b.id)), [results])
  const avgScore = results.length
    ? (results.reduce((s, r) => s + (r.score ?? 0), 0) / results.length).toFixed(1)
    : '—'
  const heatmapCells  = useMemo(() => buildHeatmap(results), [results])
  const topicNodes    = useMemo(() => getTopicNodes(radarData), [radarData])
  const priorityTopics = useMemo(() => getPriorityTopics(topicNodes), [topicNodes])
  const trendInsight  = useMemo(() => interpretScoreTrend(sparkData), [sparkData])
  const todayFocus    = useMemo(() => getTodayFocus(radarData), [radarData])
  const nextMilestone = useMemo(() => getNextMilestone(results, earnedBadgeIds), [results, earnedBadgeIds])
  const streakPB      = useMemo(() => computeStreakPersonalBest(results), [results])
  const masteryProgress = useMemo(() => user?.mastery_rank
    ? getMasteryProgress(user.mastery_rank, user.solid_concept_count ?? 0)
    : null, [user?.mastery_rank, user?.solid_concept_count])
  const weeklyReport  = useMemo(() => generateWeeklyReport(results, radarData), [results, radarData])
  const studyNudge    = useMemo(() => getStudyNudge(results), [results])
  const examPhase     = useMemo(() => getExamPhase(daysUntil), [daysUntil])
  const simulationMode = useMemo(() => getSimulationMode(daysUntil), [daysUntil])
  const weakTopics    = useMemo(
    () => [...radarData].sort((a, b) => a.score - b.score).slice(0, 2).map(d => d.topic),
    [radarData]
  )
  const scoreCI       = useMemo(() => getScoreConfidenceInterval(sparkData, user?.target_score ?? null), [sparkData, user?.target_score])
  const dailyPlan     = useMemo(() => getDailySimulationPlan(simulationMode, weakTopics.slice(0, 2)), [simulationMode, weakTopics])
  const archetype     = useMemo(() => classifyLearner(results), [results])
  const scoreProjection = useMemo(() => getScoreProjection(sparkData, daysUntil), [sparkData, daysUntil])
  const topupRec      = useMemo(() => getTopupRecommendation(creditLog, user?.credits_balance ?? 0, TOPUP_PACKAGES), [creditLog, user?.credits_balance])
  const trialUrgency  = useMemo(() => getTrialUrgency(user), [user])
  const studentSavingsDays  = useMemo(() => getAnnualSavingsDays(29000, 261000), [])
  const completeSavingsDays = useMemo(() => getAnnualSavingsDays(59000, 531000), [])
  const goalStatus    = useMemo(() => getGoalStatus(user, sparkData), [user, sparkData])
  const sessionPatterns = useMemo(() => getSessionPatterns(results), [results])
  const progressReport = useMemo(
    () => generateProgressReport(user, results, streak, streakPB, radarData),
    [user, results, streak, streakPB, radarData]
  )
  const advisorMsg    = useMemo(() => getAdvisorMessage({
    results, streak, streakPB, sessionPatterns, scoreProjection, goalStatus,
    weeklyReport, examPhase, progressReport,
  }), [results, streak, streakPB, sessionPatterns, scoreProjection, goalStatus, weeklyReport, examPhase, progressReport])
  const provinceNarrative = useMemo(() => getProvinceNarrative(provinceData), [provinceData])
  const tierGap = useMemo(() => getTierGap(tier), [tier])
  const provincialCtx = useMemo(() => getProvincialContext(user?.province), [user?.province])
  const difficultyInsight = useMemo(
    () => getDifficultyInsight(user?.province, parseFloat(avgScore) || null),
    [user?.province, avgScore]
  )
  const runwayDays = useMemo(() => {
    if (!creditLog.length) return null
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    const spent = creditLog
      .filter(e => e.delta < 0 && new Date(e.created_at).getTime() > cutoff)
      .reduce((s, e) => s + Math.abs(e.delta), 0)
    if (!spent) return null
    const dailyRate = spent / 7
    return Math.round((user?.credits_balance ?? 0) / dailyRate)
  }, [creditLog, user?.credits_balance])
  const lastExamDate = results.length > 0 ? results[results.length - 1].finishedAt : null
  const todayExamCount = results.filter(r => {
    const d = new Date(r.finishedAt)
    const today = new Date()
    return d.getFullYear() === today.getFullYear() &&
           d.getMonth() === today.getMonth() &&
           d.getDate() === today.getDate()
  }).length
  const streakRecovery = getStreakRecoveryStatus(lastExamDate, streak, todayExamCount)
  const urgencyColor  = examPhase?.colorPrimary ?? '#818CF8'

  // ── Data fetching ──
  useEffect(() => {
    if (!user) return
    getCreditLog().then(({ data }) => { if (data) setCreditLog(data) }).catch(() => {})
    getReferral().then(  ({ data }) => { if (data) setReferral(data) }).catch(() => {})
  }, [user])

  useEffect(() => {
    if (!loading && !user) navigate('/', { replace: true })
  }, [loading, user, navigate])


  // Fetch AI chart insights once when analytics tab opens with enough data
  useEffect(() => {
    if (activeTab !== TAB_ANALYTICS) return
    if (results.length < 5) return
    if (chartInsightsFetched.current) return
    chartInsightsFetched.current = true

    const sparkPayload = [...results]
      .sort((a, b) => new Date(a.finishedAt) - new Date(b.finishedAt))
      .slice(-10)
      .map(r => ({ date: r.finishedAt, score: r.score ?? 0 }))

    const radarPayload = aggregateTopicAccuracy(results).map(({ topic, score }) => ({
      topic,
      score: score / 100,
    }))

    const heatCells = buildHeatmap(results)
    const activeDays = heatCells.filter(c => c.count > 0).length
    const streakDays = (() => {
      let best = 0, cur = 0
      for (const c of heatCells) { if (c.count > 0) { cur++; best = Math.max(best, cur) } else cur = 0 }
      return best
    })()
    const heatPayload = {
      total_sessions: results.length,
      active_days: activeDays,
      best_streak: streakDays,
    }

    setChartInsightsLoading(true)
    getChartInsights({ spark_data: sparkPayload, radar_data: radarPayload, heatmap_summary: heatPayload })
      .then(({ data }) => { if (data) setChartInsights(data) })
      .finally(() => setChartInsightsLoading(false))
  }, [activeTab, results])

  useEffect(() => {
    if (activeTab !== TAB_ANALYTICS) return
    if (peerStatsFetched.current) return
    peerStatsFetched.current = true
    getPeerStats().then(({ data }) => { if (data) setPeerStats(data) }).catch(() => setPeerStats(null))
  }, [activeTab])

  // Fetch AI weekly summary once when analytics tab opens with weeklyReport data
  useEffect(() => {
    if (activeTab !== TAB_ANALYTICS) return
    if (!weeklyReport) return
    if (weeklyAISummaryFetched.current) return
    weeklyAISummaryFetched.current = true

    const prevWeek = results.filter(r => {
      const t = new Date(r.finishedAt).getTime()
      const now = Date.now()
      return t >= now - 14 * 24 * 60 * 60 * 1000 && t < now - 7 * 24 * 60 * 60 * 1000
    })
    const prevAvg = prevWeek.length
      ? prevWeek.reduce((s, r) => s + (r.score ?? 0), 0) / prevWeek.length
      : parseFloat(weeklyReport.avgScore)
    const scoreDelta = parseFloat(weeklyReport.avgScore) - prevAvg

    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    const recentDates = new Set(
      results
        .filter(r => new Date(r.finishedAt).getTime() >= cutoff)
        .map(r => new Date(r.finishedAt).toDateString())
    )

    setWeeklyAISummaryLoading(true)
    getWeeklyInsight({
      exam_count: weeklyReport.examCount,
      avg_score: parseFloat(weeklyReport.avgScore),
      score_delta: scoreDelta,
      top_weak_topic: weeklyReport.topWeakTopic ?? null,
      streak,
      days_studied: recentDates.size,
    })
      .then(({ data }) => {
        if (data?.summary) {
          setWeeklyAISummary(data.summary)
          sessionStorage.setItem('zenith_weekly_summary', data.summary)
        }
      })
      .finally(() => setWeeklyAISummaryLoading(false))
  }, [activeTab, weeklyReport, results, streak])


  // ── Simulation briefing fetch (MOAT 6) ──
  useEffect(() => {
    if (!simulationMode) return
    if (simBriefingFetched.current) return
    simBriefingFetched.current = true
    const payload = {
      days_until_exam: simulationMode.daysUntil,
      projected_score: scoreCI?.projectedScore ?? null,
      target_score: user?.target_score ?? null,
      weak_topics: weakTopics.slice(0, 3),
      exam_count: results.length,
    }
    getSimulationBriefing(payload).then(({ data }) => {
      if (data?.briefing) setSimBriefing(data.briefing)
    }).catch(() => { simBriefingFetched.current = false })
  }, [simulationMode, scoreCI, user?.target_score, weakTopics, results.length])

  // Grade change request — must be before the early return (Rules of Hooks)
  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token || !user?.grade) return
    const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
    fetch(`${BASE}/users/me/grade-change-request`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setGradeRequest(data))
      .catch(() => {})
  }, [user?.grade])

  // ── Loading skeleton ──
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <nav className="flex items-center px-8 bg-surface border-b border-border" style={{ height: 64 }}>
          <div className="skeleton h-4 w-16 rounded" />
        </nav>
        <div className="max-w-2xl mx-auto w-full px-4 py-10 flex flex-col gap-8">
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-4">
              <div className="skeleton h-5 w-32 rounded" />
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-5/6 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Additional non-hook derived values (all useMemos declared above early-return) ──
  const plans  = billing === 'annual' ? PLANS_ANNUAL : PLANS_MONTHLY
  const readinessPct   = readiness?.readiness ?? 0
  const readinessColor = readinessPct >= 70 ? '#34D399' : readinessPct >= 40 ? '#F2A20C' : '#EF4444'
  const readinessLabel = readinessPct >= 70 ? 'Sẵn sàng tốt' : readinessPct >= 40 ? 'Đang tiến bộ' : 'Cần luyện thêm'

  // ── Handlers ──
  async function handleSaveProfile() {
    setSaving(true); setSaveError('')
    try {
      await updateProfile({ province: editProvince || undefined })
      setEditMode(false)
      toast.success('Đã lưu hồ sơ')
    } catch (err) {
      const msg = err.message || 'Lưu thất bại, vui lòng thử lại'
      setSaveError(msg); toast.error(msg)
    } finally { setSaving(false) }
  }

  async function handleSubmitGradeChange() {
    if (!gradeChangeTarget) { setGradeChangeError('Vui lòng chọn lớp muốn đổi.'); return }
    if (gradeChangeReason.trim().length < 30) { setGradeChangeError('Lý do cần ít nhất 30 ký tự.'); return }
    setGradeChangeSubmitting(true); setGradeChangeError('')
    const token = localStorage.getItem('auth_token')
    const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
    try {
      const res = await fetch(`${BASE}/users/me/grade-change-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requested_grade: gradeChangeTarget, justification: gradeChangeReason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail?.code === 'grade_change_cooldown'
        ? `Cần đợi thêm ${data.detail.days_remaining} ngày nữa.`
        : (typeof data?.detail === 'string' ? data.detail : 'Gửi yêu cầu thất bại.'))
      setGradeRequest({ status: 'pending', requested_grade: gradeChangeTarget, current_grade: user.grade })
      setShowGradeChangeForm(false)
      setGradeChangeReason('')
      toast.success('Yêu cầu đổi lớp đã được gửi. Admin sẽ duyệt trong thời gian sớm nhất.')
    } catch (err) {
      setGradeChangeError(err.message || 'Gửi yêu cầu thất bại.')
    } finally { setGradeChangeSubmitting(false) }
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
      className="min-h-screen bg-background flex flex-col"
      variants={pageVariants} initial="hidden" animate="show" exit="exit"
    >
      {/* ── Persistent header ──────────────────────────────────────────── */}
      <div className="bg-surface border-b border-border">
        {/* Top row: avatar + name + actions */}
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-4 flex items-center gap-4 relative">
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
              <p className="font-fraunces text-[18px] font-bold text-foreground truncate">{user.custom_display_name || user.display_name}</p>
              {user.mastery_rank && (
                <AchievementCeremony trigger={Boolean(user.mastery_rank)}>
                  <AnimatedShinyText
                    className="font-jakarta text-[0.625rem] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      background: (MASTERY_RANK_COLORS[user.mastery_rank] ?? '#64748B') + '22',
                      color: MASTERY_RANK_COLORS[user.mastery_rank] ?? '#64748B',
                    }}
                    shimmerWidth={50}
                  >
                    {MASTERY_RANK_LABELS[user.mastery_rank] ?? user.mastery_rank}
                  </AnimatedShinyText>
                </AchievementCeremony>
              )}
            </div>
            <p className="font-jakarta text-xs text-dim truncate">{user.email}</p>
          </div>
          {/* Actions — secondary, muted */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => { setActiveTab(TAB_PROGRESS); setEditMode(true); setEditGrade(user.grade || ''); setEditProvince(user.province || '') }}
              className="px-2.5 py-1.5 rounded-lg font-jakarta text-[0.6875rem] text-amber-400 hover:bg-amber-400/10 transition"
            >
              ✏️ Sửa
            </button>
            <button
              onClick={logout}
              className="px-2.5 py-1.5 rounded-lg font-jakarta text-[0.6875rem] text-faint hover:text-muted transition"
            >
              Đăng xuất
            </button>
          </div>
          {/* Settings gear — mobile only */}
          <button
            className="lg:hidden absolute top-4 right-4 p-2 rounded-xl text-faint glass-base"
            onClick={() => setActiveTab(TAB_SETTINGS)}
            aria-label="Cài đặt"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>

        {/* Stat chips */}
        <motion.div
          className="max-w-2xl mx-auto px-4 pb-4 flex items-center justify-around border-t border-border pt-3"
          initial="hidden" animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } }}
        >
          <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } } }}>
            <StatChip icon="🔥" value={streak || 0} label={streakPB > streak ? `ngày (PB ${streakPB})` : 'ngày streak'} />
          </motion.div>
          <div className="w-px h-8 bg-border" />
          <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } } }}>
            <StatChip icon="📊" value={results.length} label="bài thi" />
          </motion.div>
          <div className="w-px h-8 bg-border" />
          <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } } }}>
            <StatChip icon="⭐" value={avgScore} label="điểm tb" />
          </motion.div>
          <div className="w-px h-8 bg-border" />
          <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } } }}>
            <StatChip icon="⚡" value={formatCreditSessions(user.credits_balance ?? 0)} label="AI còn lại" />
          </motion.div>
          {(user.solid_concept_count ?? 0) > 0 && (
            <>
              <div className="w-px h-8 bg-border" />
              <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } } }}>
                <StatChip icon="🧠" value={user.solid_concept_count} label="khái niệm" />
              </motion.div>
            </>
          )}
        </motion.div>

        {/* Tab bar + settings gear icon */}
        <div className="max-w-2xl mx-auto px-4 pb-0 hidden lg:flex items-end gap-0">
          {[
            [TAB_PROGRESS,  'Tiến Độ'],
            [TAB_ANALYTICS, 'Phân Tích'],
            [TAB_AITIA,     'AI & Tia'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 py-3 font-jakarta text-[0.8125rem] font-medium border-b-2 transition ${
                activeTab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-dim hover:text-muted'
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
                ? 'border-primary text-primary'
                : 'border-transparent text-dim hover:text-muted'
            }`}
          >
            ⚙
          </button>
        </div>
      </div>

      {/* ── Tab content ───────────────────────────────────────────────── */}
      <div className="max-w-2xl lg:max-w-5xl mx-auto w-full px-4 py-8 flex flex-col gap-6 pb-20 lg:pb-0">

        {/* ── AI Advisor Message — always visible ───────────────────────── */}
        {advisorMsg && (
          <div className={`flex items-start gap-3 px-5 py-4 rounded-2xl border ${
            advisorMsg.category === 'urgent'
              ? 'border-destructive/40 bg-destructive/5'
              : advisorMsg.category === 'optimization'
              ? 'border-info/40 bg-info/5'
              : advisorMsg.category === 'goal'
              ? 'border-success/40 bg-success/5'
              : 'border-primary/20 bg-primary/5'
          }`}>
            <span className="text-[18px] flex-shrink-0 mt-0.5">
              {advisorMsg.category === 'urgent' ? '🚨'
                : advisorMsg.category === 'optimization' ? '💡'
                : advisorMsg.category === 'goal' ? '🎯'
                : advisorMsg.category === 'progress' ? '📈'
                : advisorMsg.category === 'consistency' ? '🔄'
                : '✨'}
            </span>
            <p className="font-jakarta text-[0.8125rem] text-highlight leading-snug">{advisorMsg.message}</p>
          </div>
        )}

        {/* ════════════════ TAB 1: TIẾN ĐỘ ════════════════ */}
        {activeTab === TAB_PROGRESS && (
          <>
            {/* ── Readiness hero ───────────────────────────────────────── */}
            {readiness != null && (
              <section className="bg-surface border border-border rounded-2xl p-7 flex flex-col items-center gap-4">
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
                  <span className="font-jakarta text-xs text-dim">Mức sẵn sàng · 30 ngày gần nhất</span>
                </div>
                {daysUntil != null && examPhase && (
                  <div
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border"
                    style={{ borderColor: urgencyColor + '33', background: examPhase.bg }}
                  >
                    <span className="text-[15px]">{examPhase.icon}</span>
                    <span className="font-fraunces text-[15px] font-bold" style={{ color: urgencyColor }}>{daysUntil} ngày</span>
                    <span className="font-jakarta text-xs" style={{ color: urgencyColor + 'CC' }}>{examPhase.label}</span>
                  </div>
                )}
              </section>
            )}

            {/* Streak recovery nudge */}
            {streakRecovery?.canRecover && (
              <div className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ background: '#1A1205', border: '1px solid #F2A20C44' }}>
                <span className="streak-fire text-lg">🔥</span>
                <p className="text-sm" style={{ color: '#F2A20C' }}>
                  {streakRecovery.reason}
                </p>
              </div>
            )}

            {/* Exam simulation mode — shown for daysUntil ≤ 14 */}
            {simulationMode ? (
              <section className="border rounded-2xl p-6 flex flex-col gap-3"
                style={{
                  background: simulationMode.intensity === 'max' ? '#1A0505' : simulationMode.intensity === 'high' ? '#1A0A05' : '#1A1205',
                  borderColor: simulationMode.intensity === 'max' ? '#EF444480' : simulationMode.intensity === 'high' ? '#F9731680' : '#F2A20C80',
                }}>
                {/* Header row: intensity badge + CTA button */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-[18px]">{simulationMode.intensity === 'max' ? '🚨' : simulationMode.intensity === 'high' ? '🔴' : '🟠'}</span>
                    <span className="font-jakarta text-[0.6875rem] font-bold px-2.5 py-1 rounded-full"
                      style={{ background: simulationMode.intensity === 'max' ? '#EF444422' : simulationMode.intensity === 'high' ? '#F9731622' : '#F2A20C22', color: simulationMode.intensity === 'max' ? '#EF4444' : simulationMode.intensity === 'high' ? '#F97316' : '#F2A20C' }}>
                      CHẾ ĐỘ ÔN THI — {simulationMode.intensity === 'max' ? 'TỐI ĐA' : simulationMode.intensity === 'high' ? 'CAO' : 'TRUNG BÌNH'}
                    </span>
                  </div>
                  <button onClick={() => navigate('/exam-select')}
                    className="px-4 py-2 rounded-xl font-jakarta text-xs font-bold transition flex-shrink-0"
                    style={{ background: simulationMode.intensity === 'max' ? '#EF4444' : simulationMode.intensity === 'high' ? '#F97316' : '#F2A20C', color: '#0A0E1A' }}>
                    Thi thử ngay →
                  </button>
                </div>
                {/* Existing briefing + focus tip */}
                <p className="font-jakarta text-[0.8125rem] text-highlight leading-snug">{simulationMode.briefing}</p>
                <p className="font-jakarta text-xs text-muted leading-snug">{simulationMode.focusTip}</p>
                {/* Score confidence interval */}
                {scoreCI && (
                  <p className="font-jakarta text-xs leading-snug"
                    style={{ color: scoreCI.onTrack ? '#4ADE80' : '#FBBF24' }}>
                    Dự đoán điểm thi: <strong>{scoreCI.projectedScore.toFixed(1)}</strong> (khoảng {scoreCI.low.toFixed(1)}–{scoreCI.high.toFixed(1)}) · Độ tin cậy: {scoreCI.confidenceLabel}
                  </p>
                )}
                {/* Daily simulation plan */}
                {dailyPlan && (
                  <p className="font-jakarta text-xs text-muted-fg leading-snug">{dailyPlan.todayMessage}</p>
                )}
                {/* AI briefing */}
                {simBriefing && (
                  <p className="font-jakarta text-xs text-muted leading-snug italic">{simBriefing}</p>
                )}
              </section>
            ) : (
              /* No exam date set → prompt user to configure one */
              !user?.exam_date ? (
                <section className="rounded-2xl p-5 flex items-center gap-4"
                  style={{ background: '#0D1521', border: '1px solid #1E2A44' }}>
                  <span className="text-2xl">📅</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#CBD5E1' }}>
                      Đặt ngày thi để kích hoạt chế độ ôn thi
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
                      Cài đặt → Mục tiêu học tập → Ngày thi
                    </p>
                  </div>
                </section>
              ) : null  // has exam_date but > 14 days away — show nothing (simulation not needed yet)
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
                    <span className="font-jakarta text-[0.6875rem] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: urgencyColor + '22', color: urgencyColor }}>
                      {examPhase.label}
                    </span>
                  </div>
                  <span className="font-jakarta text-[0.8125rem] text-highlight leading-snug mt-1">{examPhase.headline}</span>
                </div>
                <button
                  onClick={() => navigate('/exam-select')}
                  className="px-4 py-2 rounded-xl font-jakarta text-xs font-bold transition flex-shrink-0"
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
                  ? 'bg-destructive/5 border-red-500/40'
                  : goalStatus.status === 'steady'
                  ? 'bg-surface border-border'
                  : goalStatus.status === 'ahead'
                  ? 'bg-success/5 border-emerald-500/40'
                  : 'bg-surface border-border'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-fraunces text-sm font-semibold text-foreground">
                        {goalStatus.status === 'ahead' ? '🎯' : goalStatus.status === 'at_risk' ? '⚠️' : goalStatus.status === 'no_data' ? '📋' : '📈'}
                        {' '}{goalStatus.headline}
                      </span>
                    </div>
                    <p className="font-jakarta text-xs text-muted leading-snug">{goalStatus.detail}</p>
                  </div>
                  <button
                    onClick={() => setActiveTab(TAB_SETTINGS)}
                    className="font-jakarta text-[0.6875rem] text-faint hover:text-dim transition flex-shrink-0"
                  >
                    Sửa mục tiêu →
                  </button>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg bg-background border border-border">
                    <span className="font-jakarta text-[0.625rem] text-faint">Còn lại</span>
                    <span className="font-fraunces text-sm font-bold" style={{ color: urgencyColor }}>{goalStatus.daysUntil} ngày</span>
                  </div>
                  {goalStatus.projectedScore != null && (
                    <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg bg-background border border-border">
                      <span className="font-jakarta text-[0.625rem] text-faint">Dự đoán</span>
                      <span className="font-fraunces text-sm font-bold text-emerald-400">{goalStatus.projectedScore.toFixed(1)}</span>
                    </div>
                  )}
                  {goalStatus.targetSchool && (
                    <div className="flex flex-col gap-0.5 px-3 py-2 rounded-lg bg-background border border-border max-w-[200px]">
                      <span className="font-jakarta text-[0.625rem] text-faint">Trường mục tiêu</span>
                      <span className="font-jakarta text-xs font-semibold text-highlight truncate">{goalStatus.targetSchool}</span>
                    </div>
                  )}
                  {goalStatus.weeklyHours && (
                    <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg bg-background border border-border">
                      <span className="font-jakarta text-[0.625rem] text-faint">Giờ/tuần</span>
                      <span className="font-fraunces text-sm font-bold text-info">{goalStatus.weeklyHours}h</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Mastery rank progression */}
            {masteryProgress && (
              <section className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="font-fraunces text-[15px] font-semibold text-foreground">Cấp độ học tập</span>
                  {masteryProgress.next && (
                    <span className="font-jakarta text-[0.6875rem] text-dim">
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
                      <span className="font-fraunces text-sm font-bold text-foreground">{masteryProgress.current.label}</span>
                      {masteryProgress.next && (
                        <span className="font-jakarta text-xs text-dim">{masteryProgress.next.icon} {masteryProgress.next.label}</span>
                      )}
                    </div>
                    <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-info transition-all duration-700"
                        style={{ width: `${Math.round(masteryProgress.pct * 100)}%` }}
                      />
                    </div>
                    <span className="font-jakarta text-[0.6875rem] text-dim">
                      {user.solid_concept_count ?? 0} khái niệm vững chắc
                      {masteryProgress.next ? ` · mục tiêu ${masteryProgress.next.minSolid}` : ' · cấp cao nhất'}
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* Profile card */}
            <section className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <span className="font-fraunces text-[16px] font-semibold text-foreground">Thông tin học sinh</span>
              </div>

              {/* Edit form (province only — grade has its own section below) */}
              {editMode ? (
                <div className="flex flex-col gap-3">
                  <input
                    className="px-4 py-2.5 rounded-xl border border-border bg-surface-elevated font-jakarta text-[0.8125rem] text-highlight focus:outline-none focus:border-amber-400"
                    placeholder="Tỉnh / Thành phố"
                    value={editProvince}
                    onChange={e => setEditProvince(e.target.value)}
                  />
                  {saveError && <p className="font-jakarta text-xs text-red-400">{saveError}</p>}
                  <div className="flex gap-2">
                    <button onClick={handleSaveProfile} disabled={saving}
                      className="px-5 py-2 rounded-lg font-jakarta text-[0.8125rem] font-bold transition"
                      style={{ background: '#F2A20C', color: '#0A0E1A' }}>
                      {saving ? 'Đang lưu...' : 'Lưu'}
                    </button>
                    <button onClick={() => { setEditMode(false); setSaveError('') }}
                      className="px-5 py-2 rounded-lg font-jakarta text-[0.8125rem] text-dim hover:text-foreground transition">
                      Huỷ
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-6 flex-wrap">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-jakarta text-[0.6875rem] text-faint">Lớp</span>
                    <span className="font-jakarta text-[0.8125rem] text-highlight">{GRADE_LABELS[user.grade] || '—'}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-jakarta text-[0.6875rem] text-faint">Tỉnh / Thành phố</span>
                    <span className="font-jakarta text-[0.8125rem] text-highlight">{user.province || '—'}</span>
                  </div>
                  {user.school_type && (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-jakarta text-[0.6875rem] text-faint">Loại trường</span>
                      <span className="font-jakarta text-[0.8125rem] text-highlight">{user.school_type}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Grade change tri-state widget */}
              {user.grade && (() => {
                const isPending = gradeRequest?.status === 'pending'
                const isApproved = gradeRequest?.status === 'approved'
                return (
                  <div className="pt-3 border-t border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-jakarta text-xs text-dim">Thay đổi lớp học</span>
                      {isPending && <span className="font-jakarta text-[0.6875rem] px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400">Đang chờ duyệt</span>}
                      {isApproved && <span className="font-jakarta text-[0.6875rem] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">Đã duyệt</span>}
                    </div>

                    {isPending ? (
                      <p className="font-jakarta text-xs text-dim">
                        Yêu cầu đổi sang <strong className="text-amber-400">{GRADE_LABELS[gradeRequest.requested_grade]}</strong> đang chờ admin duyệt.
                      </p>
                    ) : showGradeChangeForm ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex gap-2 flex-wrap">
                          {['9','10','11','12'].filter(g => g !== user.grade).map(g => (
                            <button key={g} type="button" onClick={() => setGradeChangeTarget(g)}
                              className={`px-4 py-2 rounded-lg border font-jakarta text-xs font-medium transition ${
                                gradeChangeTarget === g ? 'border-amber-400 text-amber-400 bg-amber-400/10' : 'border-border text-dim'
                              }`}>
                              {GRADE_LABELS[g]}
                            </button>
                          ))}
                        </div>
                        <textarea
                          className="px-4 py-2.5 rounded-xl border border-border bg-surface-elevated font-jakarta text-[0.8125rem] text-highlight focus:outline-none focus:border-amber-400 resize-none"
                          placeholder="Lý do đổi lớp (ít nhất 30 ký tự)..."
                          rows={3}
                          value={gradeChangeReason}
                          onChange={e => { setGradeChangeReason(e.target.value); setGradeChangeError('') }}
                        />
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-border">
                          <span className="text-amber-400 text-[0.8125rem]">⚡</span>
                          <span className="font-jakarta text-xs text-dim">Chi phí xét duyệt: <strong className="text-amber-400">5 Tia</strong> · Sau khi duyệt cần đợi 90 ngày để đổi tiếp.</span>
                        </div>
                        {gradeChangeError && <p className="font-jakarta text-xs text-red-400">{gradeChangeError}</p>}
                        <div className="flex gap-2">
                          <button onClick={handleSubmitGradeChange} disabled={gradeChangeSubmitting}
                            className="px-5 py-2 rounded-lg font-jakarta text-[0.8125rem] font-bold transition"
                            style={{ background: '#F2A20C', color: '#0A0E1A' }}>
                            {gradeChangeSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu →'}
                          </button>
                          <button onClick={() => { setShowGradeChangeForm(false); setGradeChangeError(''); setGradeChangeReason(''); setGradeChangeTarget('') }}
                            className="px-5 py-2 rounded-lg font-jakarta text-[0.8125rem] text-dim hover:text-foreground transition">
                            Huỷ
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowGradeChangeForm(true)}
                        className="font-jakarta text-xs text-faint hover:text-amber-400 transition underline underline-offset-2"
                      >
                        Yêu cầu đổi lớp
                      </button>
                    )}
                  </div>
                )
              })()}

            </section>

            {/* Username card */}
            <section className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="font-fraunces text-[15px] font-semibold text-foreground">Tên hiển thị</span>
                <span className="font-jakarta text-xs text-dim">Tên phải là duy nhất · 2–30 ký tự</span>
              </div>
              <div className="flex gap-2">
                <input
                  value={usernameInput}
                  onChange={e => { setUsernameInput(e.target.value); setUsernameError('') }}
                  placeholder={user.custom_display_name || user.display_name || 'Nhập tên mới...'}
                  maxLength={30}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-surface-elevated font-jakarta text-[0.8125rem] text-highlight placeholder-faint focus:outline-none focus:border-amber-400"
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
                  className="ripple-btn px-5 py-2.5 rounded-xl font-jakarta text-[0.8125rem] font-bold disabled:opacity-40 transition"
                  style={{ background: '#F2A20C', color: '#0A0E1A' }}>
                  {usernameLoading ? '...' : 'Lưu'}
                </button>
              </div>
              {usernameError && <p className="font-jakarta text-xs text-red-400">{usernameError}</p>}
            </section>

            {/* Complete tier features: Strategy + Province Comparison */}
            {user.subscription_tier === 'complete' && (
              <section className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-5">
                <span className="font-fraunces text-[15px] font-semibold text-foreground">Tính năng Toàn diện</span>

                {/* Exam Strategy */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-jakarta text-[0.8125rem] font-semibold text-highlight">Tư vấn chiến lược thi</span>
                      <span className="font-jakarta text-[0.6875rem] text-dim">AI phân tích điểm yếu và lên kế hoạch ôn thi cá nhân hoá · 1 lần/tháng</span>
                    </div>
                    <button onClick={handleExamStrategy} disabled={strategyLoading}
                      className="flex-shrink-0 px-4 py-2 rounded-lg font-jakarta text-xs font-bold disabled:opacity-60 transition"
                      style={{ background: '#10B981', color: '#0A0E1A' }}>
                      {strategyLoading ? 'Đang tạo...' : 'Lấy chiến lược'}
                    </button>
                  </div>
                  {strategyError && <p className="font-jakarta text-xs text-amber-400">{strategyError}</p>}
                  {strategyResult?.strategy && (
                    <div className="bg-background border border-border rounded-xl p-4">
                      <p className="font-jakarta text-[0.8125rem] text-muted-fg leading-relaxed whitespace-pre-wrap">{strategyResult.strategy}</p>
                    </div>
                  )}
                </div>

                <div className="border-t border-border" />

                {/* Province comparison */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-jakarta text-[0.8125rem] font-semibold text-highlight">So sánh với tỉnh thành</span>
                      <span className="font-jakarta text-[0.6875rem] text-dim">Xem bạn đứng ở vị trí nào so với học sinh cùng tỉnh · 30 ngày qua</span>
                    </div>
                    <button onClick={handleCompareProvince} disabled={provinceLoading}
                      className="flex-shrink-0 px-4 py-2 rounded-lg font-jakarta text-xs font-bold disabled:opacity-60 transition bg-info text-white">
                      {provinceLoading ? 'Đang tải...' : 'So sánh'}
                    </button>
                  </div>
                  {provinceData && provinceNarrative && (
                    <div className="flex flex-col gap-3">
                      {/* Narrative card */}
                      <div className={`flex flex-col gap-2 px-4 py-4 rounded-xl border ${
                        provinceNarrative.sentiment === 'above' ? 'border-emerald-500/40 bg-emerald-500/5' :
                        provinceNarrative.sentiment === 'below' ? 'border-amber-400/40 bg-amber-400/5' :
                        'border-info/40 bg-info/5'
                      }`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-jakarta text-[0.8125rem] font-semibold text-highlight">{provinceNarrative.headline}</span>
                          {provinceNarrative.badge && (
                            <span className={`font-jakarta text-[0.625rem] font-bold px-2 py-0.5 rounded-full ${
                              provinceNarrative.sentiment === 'above' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-400/20 text-amber-400'
                            }`}>{provinceNarrative.badge}</span>
                          )}
                        </div>
                        <span className="font-jakarta text-xs text-muted leading-snug">{provinceNarrative.detail}</span>
                      </div>
                      {/* Secondary numbers */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col gap-0.5 bg-background border border-border rounded-xl px-4 py-3">
                          <span className="font-jakarta text-[0.625rem] text-faint">Điểm của bạn</span>
                          <span className="font-jakarta text-[17px] font-bold text-primary">{provinceData.your_avg}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 bg-background border border-border rounded-xl px-4 py-3">
                          <span className="font-jakarta text-[0.625rem] text-faint">TB {provinceData.province}</span>
                          <span className="font-jakarta text-[17px] font-bold text-muted">{provinceData.province_avg}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 bg-background border border-border rounded-xl px-4 py-3">
                          <span className="font-jakarta text-[0.625rem] text-faint">Phần trăm xếp</span>
                          <span className="font-jakarta text-[17px] font-bold text-success">
                            {provinceData.percentile != null ? `Top ${100 - provinceData.percentile}%` : '—'}
                          </span>
                        </div>
                      </div>
                      {/* MOAT2: provincial difficulty intelligence */}
                      {provincialCtx && (
                        <div className="flex flex-col gap-1.5 px-4 py-3 rounded-xl bg-background border border-border">
                          <span className="font-jakarta text-[0.6875rem] text-faint">
                            Độ khó tỉnh {user.province}: <span className="text-primary font-semibold">{provincialCtx.difficultyLabel}</span>
                            {' · '}Điểm chuẩn TB: <span className="text-muted font-semibold">{provincialCtx.typical_cutoff}</span>
                            {' · '}Trường top: <span className="text-success font-semibold">{provincialCtx.top_schools_cutoff}</span>
                          </span>
                          {difficultyInsight && (
                            <span className="font-jakarta text-[0.6875rem] text-dim italic leading-snug">{difficultyInsight}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Upgrade context — strategy + province for non-complete users */}
            {user.subscription_tier !== 'complete' && (
              <section className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-5">
                <span className="font-fraunces text-[15px] font-semibold text-foreground">Tính năng AI nâng cao</span>

                {/* Strategy upgrade context */}
                {(() => {
                  const ctx = getUpgradeContext(tier, 'strategy')
                  return (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-jakarta text-[0.8125rem] font-semibold text-muted">Tư vấn chiến lược thi</span>
                          <span className="font-jakarta text-[0.6875rem] text-faint">AI phân tích điểm yếu và lên kế hoạch ôn thi cá nhân hoá · 1 lần/tháng</span>
                        </div>
                        <button
                          onClick={() => setUpgradeCtxVisible(v => ({ ...v, strategy: !v.strategy }))}
                          className="flex-shrink-0 px-4 py-2 rounded-lg font-jakarta text-xs font-bold transition opacity-60 cursor-not-allowed"
                          style={{ background: '#1E2A44', color: '#64748B' }}
                        >
                          Lấy chiến lược
                        </button>
                      </div>
                      {upgradeCtxVisible.strategy && ctx && (
                        <div className="flex flex-col gap-2 px-4 py-3 rounded-xl border border-info/30 bg-info/5">
                          <span className="font-jakarta text-xs text-info/80 leading-snug">{ctx.pitch}</span>
                          <button
                            onClick={() => {
                              setActiveTab(TAB_AITIA)
                              setTimeout(() => document.querySelector('#upgrade-plans')?.scrollIntoView({ behavior: 'smooth' }), 100)
                            }}
                            className="self-start font-jakarta text-xs font-bold text-info hover:text-info/80 transition"
                          >
                            Nâng cấp →
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })()}

                <div className="border-t border-border" />

                {/* Province upgrade context */}
                {(() => {
                  const ctx = getUpgradeContext(tier, 'province')
                  return (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-jakarta text-[0.8125rem] font-semibold text-muted">So sánh với tỉnh thành</span>
                          <span className="font-jakarta text-[0.6875rem] text-faint">Xem bạn đứng ở vị trí nào so với học sinh cùng tỉnh · 30 ngày qua</span>
                        </div>
                        <button
                          onClick={() => setUpgradeCtxVisible(v => ({ ...v, province: !v.province }))}
                          className="flex-shrink-0 px-4 py-2 rounded-lg font-jakarta text-xs font-bold transition opacity-60 cursor-not-allowed"
                          style={{ background: '#1E2A44', color: '#64748B' }}
                        >
                          So sánh
                        </button>
                      </div>
                      {upgradeCtxVisible.province && ctx && (
                        <div className="flex flex-col gap-2 px-4 py-3 rounded-xl border border-info/30 bg-info/5">
                          <span className="font-jakarta text-xs text-info/80 leading-snug">{ctx.pitch}</span>
                          <button
                            onClick={() => {
                              setActiveTab(TAB_AITIA)
                              setTimeout(() => document.querySelector('#upgrade-plans')?.scrollIntoView({ behavior: 'smooth' }), 100)
                            }}
                            className="self-start font-jakarta text-xs font-bold text-info hover:text-info/80 transition"
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
              <section className="bg-surface border border-border rounded-2xl p-7 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-info/10 border border-info/20 flex items-center justify-center text-[28px] flex-shrink-0">
                  {archetype.icon}
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-jakarta text-[0.625rem] font-semibold text-info uppercase tracking-wide">Phong cách học của bạn</span>
                  <span className="font-fraunces text-[16px] font-bold text-foreground">{archetype.label}</span>
                  <span className="font-jakarta text-xs text-muted leading-snug">{archetype.desc}</span>
                </div>
              </section>
            )}

            {/* Next milestone */}
            {nextMilestone && (
              <section className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-3">
                <span className="font-fraunces text-[15px] font-semibold text-foreground">Mục tiêu tiếp theo</span>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-info/10 border border-info/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-[22px]">{nextMilestone.icon}</span>
                  </div>
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <span className="font-fraunces text-sm font-bold text-foreground">{nextMilestone.label}</span>
                    <span className="font-jakarta text-xs text-muted">{nextMilestone.progress}</span>
                    <div className="w-full h-1.5 bg-border rounded-full overflow-hidden mt-0.5">
                      <div
                        className="h-full rounded-full bg-info transition-all duration-700"
                        style={{ width: `${Math.round(nextMilestone.pct * 100)}%` }}
                      />
                    </div>
                  </div>
                  {nextMilestone.remaining != null && (
                    <span className="font-jakarta text-[0.6875rem] text-info font-semibold flex-shrink-0">
                      còn {nextMilestone.remaining}
                    </span>
                  )}
                </div>
              </section>
            )}

            {/* Badges grid */}
            <section className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-4">
              <span className="font-fraunces text-[15px] font-semibold text-foreground">Huy hiệu</span>
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                initial="hidden"
                animate="visible"
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } }}
              >
                {BADGE_DEFS.map(b => {
                  const earned = earnedBadgeIds.has(b.id)
                  return (
                    <motion.div
                      key={b.id}
                      variants={{
                        hidden:   { opacity: 0, scale: 0.85 },
                        visible:  { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 20 } },
                      }}
                      className={`relative flex items-start gap-3 px-4 py-3 rounded-xl border transition ${
                        earned ? 'border-amber-400/40 bg-amber-400/5' : 'border-border bg-surface-elevated opacity-50 grayscale'
                      }`}
                    >
                      {earned && (
                        <motion.div
                          className="absolute inset-0 rounded-xl pointer-events-none"
                          animate={{ boxShadow: ['0 0 0 0 rgba(251,191,36,0)', '0 0 12px 2px rgba(251,191,36,0.18)', '0 0 0 0 rgba(251,191,36,0)'] }}
                          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      )}
                      <motion.span
                        className="text-[24px] flex-shrink-0"
                        animate={earned ? { scale: [1, 1.12, 1] } : {}}
                        transition={earned ? { duration: 2, repeat: Infinity, ease: 'easeInOut', delay: Math.random() * 1.5 } : {}}
                      >
                        {b.icon}
                      </motion.span>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-jakarta text-xs font-semibold text-highlight">{b.label}</span>
                        <span className="font-jakarta text-[0.6875rem] text-dim">
                          {earned ? b.desc : badgeProgress(b.id)}
                        </span>
                      </div>
                    </motion.div>
                  )
                })}
              </motion.div>
            </section>

            {/* Progress share card */}
            {progressReport && (
              <section className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-fraunces text-[15px] font-semibold text-foreground">Báo cáo học tập</span>
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-jakarta text-xs font-semibold bg-info/10 text-info border border-info/20 hover:bg-info/20 transition"
                  >
                    <span>📤</span> Chia sẻ
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="flex flex-col items-center gap-0.5 px-3 py-3 rounded-xl bg-background border border-border">
                    <span className="font-fraunces text-[20px] font-bold text-highlight">{progressReport.totalExams}</span>
                    <span className="font-jakarta text-[0.625rem] text-dim">Bài thi</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 px-3 py-3 rounded-xl bg-background border border-border">
                    <span className="font-fraunces text-[20px] font-bold text-amber-400">{progressReport.avgScore}</span>
                    <span className="font-jakarta text-[0.625rem] text-dim">Điểm TB</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 px-3 py-3 rounded-xl bg-background border border-border">
                    <span className={`font-fraunces text-[20px] font-bold ${progressReport.scoreImprovement > 0 ? 'text-emerald-400' : progressReport.scoreImprovement < 0 ? 'text-red-400' : 'text-highlight'}`}>
                      {progressReport.scoreImprovement > 0 ? '+' : ''}{progressReport.scoreImprovement}
                    </span>
                    <span className="font-jakarta text-[0.625rem] text-dim">Cải thiện</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 px-3 py-3 rounded-xl bg-background border border-border">
                    <span className="font-fraunces text-[20px] font-bold text-highlight">{progressReport.streakDays}</span>
                    <span className="font-jakarta text-[0.625rem] text-dim">Streak ngày</span>
                  </div>
                </div>
                {progressReport.topTopics.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="font-jakarta text-[0.6875rem] font-semibold text-muted">Điểm mạnh</span>
                    <div className="flex flex-wrap gap-2">
                      {progressReport.topTopics.map(t => (
                        <span key={t} className="font-jakarta text-[0.6875rem] px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {progressReport.weakTopics.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="font-jakarta text-[0.6875rem] font-semibold text-muted">Cần ôn thêm</span>
                    <div className="flex flex-wrap gap-2">
                      {progressReport.weakTopics.map(t => (
                        <span key={t} className="font-jakarta text-[0.6875rem] px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-400">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

          </>
        )}

        {/* ════════════════ TAB 2: PHÂN TÍCH ════════════════ */}
        {activeTab === TAB_ANALYTICS && (
          <>
            {/* Adaptive study nudge */}
            {studyNudge && (
              <div className="flex items-start gap-3 px-5 py-4 rounded-2xl border border-primary/20 bg-primary/5">
                <span className="text-[20px] flex-shrink-0 mt-px">💪</span>
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="font-jakarta text-[0.8125rem] text-highlight leading-snug">{studyNudge}</span>
                  <button
                    onClick={() => navigate('/exam-select')}
                    className="self-start mt-1.5 px-3 py-1 rounded-lg font-jakarta text-[0.6875rem] font-semibold bg-primary text-primary-fg hover:bg-[#F59E0B] transition-colors"
                  >
                    Ôn luyện ngay →
                  </button>
                </div>
              </div>
            )}

            {/* Weekly report card */}
            {weeklyReport && (
              <section className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-fraunces text-[15px] font-semibold text-foreground">Báo cáo tuần này</span>
                  <span className="font-jakarta text-[0.6875rem] text-faint">7 ngày qua</span>
                </div>
                <p className="font-jakarta text-[0.8125rem] text-muted leading-relaxed">{weeklyReport.summary}</p>
                <div className="flex gap-4 pt-1">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-fraunces text-[20px] font-bold text-foreground">{weeklyReport.examCount}</span>
                    <span className="font-jakarta text-[0.6875rem] text-dim">bài thi</span>
                  </div>
                  <div className="w-px bg-border" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-fraunces text-[20px] font-bold text-foreground">{weeklyReport.avgScore}</span>
                    <span className="font-jakarta text-[0.6875rem] text-dim">điểm trung bình</span>
                  </div>
                  {weeklyReport.topWeakTopic && (
                    <>
                      <div className="w-px bg-border" />
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-fraunces text-sm font-bold text-primary truncate">{weeklyReport.topWeakTopic}</span>
                        <span className="font-jakarta text-[0.6875rem] text-dim">cần ôn nhất</span>
                      </div>
                    </>
                  )}
                </div>
                {(weeklyAISummaryLoading || weeklyAISummary) && (
                  <p className="font-jakarta text-xs italic text-dim leading-relaxed mt-1">
                    {weeklyAISummaryLoading ? '...' : weeklyAISummary}
                  </p>
                )}
              </section>
            )}

            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <span className="text-[48px]">📊</span>
                <span className="font-fraunces text-[18px] text-foreground">Chưa có dữ liệu</span>
                <span className="font-jakarta text-[0.8125rem] text-dim">Hoàn thành ít nhất một bài thi để xem thống kê.</span>
              </div>
            ) : (
              <>
                {/* Advisor message card */}
                {advisorMsg && (
                  <section className="rounded-2xl p-5 flex items-start gap-4"
                    style={{ background: '#0D1521', border: '1px solid #1E2A44' }}>
                    <span className="text-2xl mt-0.5">🤖</span>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-semibold uppercase tracking-wider"
                        style={{ color: '#818CF8' }}>
                        Nhận xét AI
                      </p>
                      <p className="text-sm leading-relaxed" style={{ color: '#CBD5E1' }}>
                        {advisorMsg.message}
                      </p>
                    </div>
                  </section>
                )}

                {/* Score sparkline */}
                <section className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-3">
                  <span className="font-fraunces text-[15px] font-semibold text-foreground">Xu hướng điểm số</span>
                  <span className="font-jakarta text-[0.6875rem] text-faint">10 bài thi gần nhất</span>
                  <ResponsiveContainer width="100%" height={100}>
                    <LineChart data={sparkData}>
                      <Line
                        type="monotone" dataKey="score"
                        stroke="#F2A20C" strokeWidth={2}
                        dot={false} isAnimationActive={false}
                      />
                      {user?.target_score && (
                        <ReferenceLine
                          y={user.target_score}
                          stroke="#818CF8"
                          strokeDasharray="4 2"
                          label={{ value: `Mục tiêu ${user.target_score}`, fill: '#818CF8', fontSize: 10, position: 'insideTopRight' }}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                  {trendInsight && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-background border border-border">
                      <span className="text-[0.8125rem] mt-px">💡</span>
                      <span className="font-jakarta text-xs text-muted">{trendInsight}</span>
                    </div>
                  )}
                  {scoreProjection && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-success/5 border border-success/20">
                      <span className="text-[0.8125rem] mt-px">🎯</span>
                      <span className="font-jakarta text-xs text-success">{scoreProjection.summary}</span>
                    </div>
                  )}
                  {(chartInsightsLoading || chartInsights?.spark_insight) && (
                    <p className="font-jakarta text-xs italic text-dim mt-1">
                      {chartInsightsLoading ? '...' : chartInsights.spark_insight}
                    </p>
                  )}
                </section>


                {/* Today's focus */}
                {todayFocus && (
                  <section className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-3">
                    <span className="font-fraunces text-[15px] font-semibold text-foreground">Trọng tâm hôm nay</span>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-[22px]">🎯</span>
                      </div>
                      <div className="flex flex-col gap-0.5 flex-1">
                        <span className="font-fraunces text-[16px] font-bold text-foreground">{todayFocus.topic}</span>
                        <span className="font-jakarta text-xs text-muted">Độ chính xác hiện tại: <span className="text-primary font-semibold">{todayFocus.score}%</span></span>
                      </div>
                      <button
                        onClick={() => navigate('/exam-select')}
                        className="px-3 py-1.5 rounded-lg bg-primary text-primary-fg font-jakarta text-xs font-semibold hover:bg-[#F59E0B] transition-colors flex-shrink-0"
                      >
                        Luyện ngay
                      </button>
                    </div>
                  </section>
                )}

                {/* ─── MOAT 1: Learning Graph ─────────────────────────────── */}
                <section className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-5">
                  <div className="flex flex-col gap-1">
                    <span className="font-fraunces text-[15px] font-semibold text-foreground">Lộ trình học tập — Điểm mấu chốt tiếp theo</span>
                    <span className="font-jakarta text-[0.6875rem] text-faint">Các chủ đề bạn cần chinh phục để mở khoá kiến thức nâng cao</span>
                  </div>

                  {/* Priority topics (up to 3) */}
                  {priorityTopics.length === 0 ? (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-background border border-border">
                      <span className="text-[0.8125rem]">📊</span>
                      <span className="font-jakarta text-xs text-dim">Chưa đủ dữ liệu — làm thêm bài thi để xem gợi ý</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {priorityTopics.map(node => {
                        const prereqLabels = node.prereqs
                          .map(pid => topicNodes.find(n => n.id === pid)?.label ?? pid)
                        return (
                          <div key={node.id} className="flex flex-col gap-2 px-4 py-3 rounded-xl bg-background border border-border">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-jakarta text-[0.8125rem] font-semibold text-foreground">{node.label}</span>
                              <span
                                className="font-jakarta text-[0.625rem] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: '#EF444420', color: '#EF4444', border: '1px solid #EF444440' }}
                              >
                                Yếu
                              </span>
                            </div>
                            {/* Mastery bar */}
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${Math.round((node.mastery ?? 0) * 100)}%`, background: '#EF4444' }}
                                />
                              </div>
                              <span className="font-jakarta text-[0.625rem] text-[#EF4444] font-semibold flex-shrink-0">
                                {Math.round((node.mastery ?? 0) * 100)}%
                              </span>
                            </div>
                            {prereqLabels.length > 0 && (
                              <span className="font-jakarta text-[0.6875rem] text-faint">
                                Cần học trước: <span className="text-muted">{prereqLabels.join(', ')}</span>
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <button
                    onClick={() => navigate('/progress')}
                    className="self-start font-jakarta text-xs text-dim hover:text-muted transition"
                  >
                    Xem bản đồ học tập →
                  </button>
                </section>
                {/* ─── end Learning Graph ─────────────────────────────────── */}


              </>
            )}
          </>
        )}

        {/* ════════════════ TAB 3: AI & TIA ════════════════ */}
        {activeTab === TAB_AITIA && (
          <>
            {/* Credit gauge + runway */}
            <section className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-4 items-center">
              <CreditGauge balance={user.credits_balance ?? 0} tier={tier} />
              {runwayDays !== null && (
                <p className="font-jakarta text-xs text-dim text-center">
                  Theo tốc độ học hiện tại, đủ cho ~<span className="text-amber-400 font-semibold">{runwayDays} ngày</span> học tập AI.
                </p>
              )}
              <div className="flex gap-6 flex-wrap justify-center">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-jakarta text-[0.6875rem] text-faint">Gói hiện tại</span>
                  <span className="font-jakarta text-[0.8125rem] font-bold px-3 py-0.5 rounded-full"
                    style={{ background: (TIER_COLORS[tier] || '#64748B') + '22', color: TIER_COLORS[tier] || '#64748B' }}>
                    {TIER_LABELS[tier] || tier}
                  </span>
                </div>
                {user.subscription_period === 'annual' && (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-jakarta text-[0.6875rem] text-faint">Chu kỳ</span>
                    <span className="font-jakarta text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">Hàng năm</span>
                  </div>
                )}
                {user.credits_reset_at && (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-jakarta text-[0.6875rem] text-faint">Làm mới vào</span>
                    <span className="font-jakarta text-[0.8125rem] text-highlight">{formatDate(user.credits_reset_at)}</span>
                  </div>
                )}
                {user.subscription_expires_at && (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-jakarta text-[0.6875rem] text-faint">Hết hạn</span>
                    <span className="font-jakarta text-[0.8125rem] text-highlight">{formatDate(user.subscription_expires_at)}</span>
                  </div>
                )}
              </div>
            </section>

            {/* 7-day trial CTA */}
            {tier === 'basic' && !user.trial_used && !trialDone && (
              <section className="glass-base rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <span className="font-fraunces text-[16px] font-semibold text-foreground">Trải nghiệm AI học tập đầy đủ — 7 ngày miễn phí</span>
                  <p className="font-jakarta text-[0.8125rem] text-muted">
                    Mở khóa toàn bộ AI hỗ trợ trong 7 ngày: kế hoạch học cá nhân hoá, phân tích không giới hạn và 500 năng lượng học tập.
                  </p>
                </div>
                {trialError && <p className="font-jakarta text-xs text-red-400">{trialError}</p>}
                <ShimmerButton
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
                  className="self-start text-[0.8125rem]"
                  background={trialActivating ? 'rgba(30,42,68,1)' : 'linear-gradient(135deg, #065f46, #10B981)'}
                >
                  {trialActivating ? 'Đang kích hoạt...' : 'Kích hoạt dùng thử'}
                </ShimmerButton>
              </section>
            )}
            {trialDone && (
              <div className="px-5 py-4 rounded-2xl glass-base font-jakarta text-[0.8125rem] text-success">
                Đã kích hoạt! Gói Học sinh của bạn sẽ hoạt động trong 7 ngày.
              </div>
            )}

            {/* Trial urgency banner */}
            {trialUrgency && (
              <section className="border rounded-2xl p-5 flex flex-col gap-3"
                style={{ background: 'linear-gradient(135deg, #1A0E0A 0%, #0D1521 100%)', borderColor: trialUrgency.daysLeft <= 1 ? '#EF444460' : '#F2A20C60' }}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex flex-col gap-1">
                    <span className="font-fraunces text-sm font-semibold text-highlight">{trialUrgency.message}</span>
                    <span className="font-jakarta text-xs text-muted">Sau khi hết hạn bạn sẽ mất quyền truy cập vào:</span>
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
                    <span key={item} className="font-jakarta text-[0.6875rem] px-2.5 py-1 rounded-full bg-primary/5 border border-primary/20 text-primary">
                      {item}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Tier gap — "Bạn đang bỏ lỡ..." card */}
            {tierGap && (
              <section className="bg-surface border border-info/30 rounded-2xl p-6 flex flex-col gap-4">
                <span className="font-fraunces text-[15px] font-semibold text-foreground">Bạn đang bỏ lỡ...</span>
                <div className="flex flex-wrap gap-2">
                  {tierGap.missingFeatures.map(f => (
                    <span key={f} className="font-jakarta text-[0.6875rem] px-3 py-1.5 rounded-full border border-info/40 bg-info/10 text-info/80">
                      {f}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => document.querySelector('#upgrade-plans')?.scrollIntoView({ behavior: 'smooth' })}
                  className="self-start px-5 py-2.5 rounded-xl font-jakarta text-[0.8125rem] font-bold transition bg-info text-white"
                >
                  {tierGap.ctaLabel} →
                </button>
              </section>
            )}


            {/* Plan cards */}
            <section id="upgrade-plans" className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <span className="font-fraunces text-[16px] font-semibold text-foreground">Nâng cấp gói</span>
                <div className="flex items-center gap-1 bg-surface-elevated rounded-full p-1">
                  {['monthly', 'annual'].map(b => (
                    <button key={b} onClick={() => setBilling(b)}
                      className={`px-4 py-1.5 rounded-full font-jakarta text-xs transition ${billing === b ? 'bg-primary text-primary-fg font-semibold' : 'text-muted'}`}>
                      {b === 'monthly' ? 'Hàng tháng' : 'Hàng năm (−25%)'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {plans.map(plan => (
                  <div key={plan.tier}
                    className={`flex items-center justify-between gap-4 px-5 py-4 rounded-xl border transition ${
                      tier === plan.tier ? 'border-amber-400/60 bg-amber-400/5' : 'border-border bg-surface-elevated'
                    }`}>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-jakarta text-sm font-bold text-highlight">{plan.label}</span>
                        {plan.badge && (
                          <span className="font-jakarta text-[0.625rem] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400">{plan.badge}</span>
                        )}
                        {tier === plan.tier && (
                          <span className="font-jakarta text-[0.625rem] font-bold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-400">Hiện tại</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-jakarta text-xs text-dim">⚡ {plan.credits.toLocaleString()} Tia/tháng</span>
                        {plan.bonus && <span className="font-jakarta text-xs text-amber-300">🎁 {plan.bonus}</span>}
                      </div>
                      {plan.features && (
                        <div className="flex flex-col gap-1 mt-1">
                          {plan.features.map(f => (
                            <span key={f} className="font-jakarta text-xs text-muted flex items-center gap-1.5">
                              <span className="text-emerald-400 text-[0.625rem]">✓</span>{f}
                            </span>
                          ))}
                        </div>
                      )}
                      {plan.effective && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-jakarta text-[0.6875rem] text-faint">≈ {plan.effective}</span>
                          {billing === 'annual' && plan.tier === 'student' && studentSavingsDays > 0 && (
                            <span className="font-jakarta text-[0.625rem] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                              +{studentSavingsDays} ngày học tập AI miễn phí
                            </span>
                          )}
                          {billing === 'annual' && plan.tier === 'complete' && completeSavingsDays > 0 && (
                            <span className="font-jakarta text-[0.625rem] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                              +{completeSavingsDays} ngày học tập AI miễn phí
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className="font-fraunces text-[15px] font-bold text-highlight">{plan.price}</span>
                      {tier !== plan.tier && plan.tier !== 'basic' && (
                        <span className="font-jakarta text-[0.6875rem] text-amber-400">Liên hệ nâng cấp</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-4 rounded-xl border border-border bg-background flex flex-col gap-1.5">
                <span className="font-jakarta text-xs font-semibold text-muted">Thanh toán (Chuyển khoản ngân hàng)</span>
                <span className="font-jakarta text-xs text-dim">
                  Chuyển khoản theo số tài khoản được cung cấp và gửi email xác nhận. Kích hoạt trong 1–2 giờ làm việc.
                </span>
                <span className="font-jakarta text-[0.6875rem] text-faint">* MoMo · VNPay · ZaloPay · PayOS sẽ sớm ra mắt</span>
              </div>
            </section>

            {/* Top-up packages */}
            <section id="topup" className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-4">
              <span className="font-fraunces text-[15px] font-semibold text-foreground">Nạp thêm Tia</span>

              {/* Personalized recommendation */}
              {topupRec ? (
                <div className="flex flex-col gap-3">
                  <p className="font-jakarta text-xs text-muted">{topupRec.reasoning}</p>
                  <button
                    onClick={() => setTopupPkg(topupRec.pack)}
                    className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl border border-amber-400/50 bg-amber-400/5 hover:bg-amber-400/10 transition w-full text-left"
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-jakarta text-[0.625rem] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400">{topupRec.pack.label}</span>
                        <span className="font-jakarta text-[0.6875rem] text-dim">Gợi ý cho bạn</span>
                      </div>
                      <span className="font-fraunces text-[18px] font-bold text-amber-400">⚡ {topupRec.pack.credits} Tia</span>
                      <span className="font-jakarta text-[0.6875rem] text-dim">Đủ cho ~{topupRec.coversDays} ngày học tập AI</span>
                    </div>
                    <span className="font-fraunces text-[16px] font-bold text-highlight flex-shrink-0">{topupRec.pack.price}</span>
                  </button>
                  <button
                    onClick={() => {}}
                    className="font-jakarta text-[0.6875rem] text-faint hover:text-dim transition text-center"
                    onClickCapture={(e) => { e.preventDefault(); e.stopPropagation() }}
                  >
                    Xem tất cả gói →
                  </button>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 hidden" aria-hidden="true">
                    {TOPUP_PACKAGES.map(pkg => (
                      <button key={pkg.price} onClick={() => setTopupPkg(pkg)}
                        className="flex flex-col items-center gap-1.5 px-4 py-4 rounded-xl border border-border bg-surface-elevated hover:border-amber-400/50 hover:bg-amber-400/5 transition">
                        <span className="font-jakarta text-[0.625rem] font-bold px-2 py-0.5 rounded-full bg-border text-muted">{pkg.label}</span>
                        <span className="font-fraunces text-[18px] font-bold text-amber-400">⚡ {pkg.credits}</span>
                        <span className="font-jakarta text-xs text-highlight">{pkg.price}</span>
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
                      className="flex flex-col items-center gap-1.5 px-4 py-4 rounded-xl border border-border bg-surface-elevated hover:border-amber-400/50 hover:bg-amber-400/5 transition"
                    >
                      <span className="font-jakarta text-[0.625rem] font-bold px-2 py-0.5 rounded-full bg-border text-muted">{pkg.label}</span>
                      <span className="font-fraunces text-[18px] font-bold text-amber-400">⚡ {pkg.credits}</span>
                      <span className="font-jakarta text-xs text-highlight">{pkg.price}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Credit log */}
            {creditLog.length > 0 && (
              <section className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-4">
                <span className="font-fraunces text-[15px] font-semibold text-foreground">Lịch sử Tia</span>
                <div className="flex flex-col gap-1">
                  {(showAllCredits ? creditLog : creditLog.slice(0, 8)).map((entry, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-jakarta text-xs text-muted">{REASON_LABELS[entry.reason] ?? entry.reason}</span>
                        <span className="font-jakarta text-[0.6875rem] text-faint">{formatDate(entry.created_at)}</span>
                      </div>
                      <span className={`font-fraunces text-sm font-bold ${entry.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {entry.delta > 0 ? '+' : ''}{entry.delta}
                      </span>
                    </div>
                  ))}
                </div>
                {creditLog.length > 8 && !showAllCredits && (
                  <button onClick={() => setShowAllCredits(true)}
                    className="font-jakarta text-xs text-amber-400 hover:text-amber-300 transition text-center">
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
            {/* Streak Freeze */}
            {(() => {
              const freezeInfo = getStreakFreezeInfo(user)
              const tierLabel = { basic: 'Basic', student: 'Student', complete: 'Complete' }[user.subscription_tier] ?? user.subscription_tier
              return (
                <section className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[20px]">🧊</span>
                    <span className="font-fraunces text-[15px] font-semibold text-foreground">Streak Freeze</span>
                    {user.subscription_tier === 'basic' && (
                      <span className="font-jakarta text-[0.625rem] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400 border border-amber-400/30">
                        Cần nâng cấp
                      </span>
                    )}
                  </div>
                  <p className="font-jakarta text-xs text-dim leading-relaxed">
                    Dùng freeze để bảo vệ streak khi bạn bỏ lỡ một ngày. Gói {tierLabel} được {freezeInfo.weeklyQuota} freeze/tuần.
                  </p>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-jakarta text-xs font-semibold text-muted">Số freeze còn lại</span>
                      <span className="font-fraunces text-[22px] font-bold text-highlight">
                        {freezeInfo.balance}
                        <span className="font-jakarta text-[0.8125rem] font-normal text-faint ml-1">/ {freezeInfo.weeklyQuota} tuần</span>
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <button
                        disabled={!freezeInfo.canFreeze || freezeLoading}
                        title={
                          freezeInfo.lockedReason === 'upgrade'
                            ? 'Nâng cấp lên Student hoặc Complete để dùng tính năng này'
                            : freezeInfo.lockedReason === 'empty'
                            ? 'Bạn đã hết freeze cho tuần này'
                            : ''
                        }
                        onClick={async () => {
                          setFreezeLoading(true)
                          setFreezeError('')
                          setFreezeSuccess(false)
                          const { data, error } = await useStreakFreeze()
                          if (error) {
                            setFreezeError(
                              error === 'streak_freeze_not_available'
                                ? 'Tính năng này yêu cầu gói Student hoặc Complete.'
                                : error === 'no_freezes_remaining'
                                ? 'Bạn đã hết freeze cho tuần này.'
                                : 'Không thể dùng freeze. Thử lại sau.'
                            )
                          } else {
                            setFreezeSuccess(true)
                            await refreshUser()
                          }
                          setFreezeLoading(false)
                        }}
                        className="px-4 py-2.5 rounded-xl font-jakarta text-[0.8125rem] font-bold transition disabled:cursor-not-allowed"
                        style={{
                          background: freezeInfo.canFreeze && !freezeLoading ? '#3B82F6' : '#1E2A44',
                          color: freezeInfo.canFreeze && !freezeLoading ? '#F8FAFC' : '#475569',
                          opacity: freezeLoading ? 0.7 : 1,
                        }}
                      >
                        {freezeLoading ? 'Đang xử lý...' : 'Dùng freeze hôm nay'}
                      </button>
                      {freezeSuccess && (
                        <span className="font-jakarta text-[0.6875rem] text-emerald-400">Đã dùng freeze ✓</span>
                      )}
                      {freezeError && (
                        <span className="font-jakarta text-[0.6875rem] text-red-400">{freezeError}</span>
                      )}
                    </div>
                  </div>
                </section>
              )
            })()}

            {/* AI Learning Preferences */}
            <section className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <span className="font-fraunces text-[15px] font-semibold text-foreground">Tùy chỉnh AI học tập</span>
                {aiIsCustomized && (
                  <span className="font-jakarta text-[0.625rem] font-bold px-2 py-0.5 rounded-full bg-info/10 text-info border border-info/20">
                    Đã tùy chỉnh
                  </span>
                )}
              </div>

              {/* hint_style */}
              <div className="flex flex-col gap-2">
                <span className="font-jakarta text-xs font-semibold text-muted">Phong cách gợi ý</span>
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
                          ? 'border-info bg-info/10 text-foreground'
                          : 'border-border bg-background text-dim hover:border-info/30'
                      }`}
                    >
                      <span className="font-jakarta text-xs font-semibold">{label}</span>
                      <span className="font-jakarta text-[0.625rem] mt-0.5">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* explanation_depth */}
              <div className="flex flex-col gap-2">
                <span className="font-jakarta text-xs font-semibold text-muted">Độ chi tiết giải thích</span>
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
                          ? 'border-success bg-success/10 text-foreground'
                          : 'border-border bg-background text-dim hover:border-[#10B98150]'
                      }`}
                    >
                      <span className="font-jakarta text-xs font-semibold">{label}</span>
                      <span className="font-jakarta text-[0.625rem] mt-0.5">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* language_mix */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="font-jakarta text-[0.8125rem] font-semibold text-highlight">Pha tiếng Anh thuật ngữ toán</span>
                  <span className="font-jakarta text-[0.6875rem] text-dim">AI có thể dùng thuật ngữ toán tiếng Anh khi cần rõ hơn.</span>
                </div>
                <button
                  onClick={() => setAIPrefs({ ...aiPrefs, language_mix: aiPrefs.language_mix === 'mixed' ? 'vietnamese-only' : 'mixed' })}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${aiPrefs.language_mix === 'mixed' ? 'bg-info' : 'bg-border'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${aiPrefs.language_mix === 'mixed' ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* weak_topic_focus */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="font-jakarta text-[0.8125rem] font-semibold text-highlight">Ưu tiên chủ đề yếu</span>
                  <span className="font-jakarta text-[0.6875rem] text-dim">AI tự động nhấn mạnh vào khu vực bạn còn yếu nhất.</span>
                </div>
                <button
                  onClick={() => setAIPrefs({ ...aiPrefs, weak_topic_focus: !aiPrefs.weak_topic_focus })}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${aiPrefs.weak_topic_focus ? 'bg-primary' : 'bg-border'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${aiPrefs.weak_topic_focus ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* encouragement_level */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold" style={{ color: '#94A3B8' }}>
                  Mức độ động viên
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 'minimal',  label: 'Ít' },
                    { value: 'moderate', label: 'Vừa' },
                    { value: 'high',     label: 'Nhiều' },
                  ].map(opt => (
                    <button key={opt.value}
                      onClick={() => setAIPrefs({ ...aiPrefs, encouragement_level: opt.value })}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{
                        background: aiPrefs.encouragement_level === opt.value ? '#818CF8' : '#1E2A44',
                        color: aiPrefs.encouragement_level === opt.value ? '#fff' : '#94A3B8',
                      }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

            </section>

            {/* Learning goals */}
            <section className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <span className="font-fraunces text-[15px] font-semibold text-foreground">Mục tiêu học tập</span>
                {goalSaved && (
                  <span className="font-jakarta text-[0.6875rem] text-emerald-400">Đã lưu ✓</span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-jakarta text-xs font-semibold text-muted">Ngày thi dự kiến</label>
                <input
                  type="date"
                  value={goalExamDate}
                  onChange={e => { setGoalExamDate(e.target.value); setGoalSaved(false) }}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background font-jakarta text-[0.8125rem] text-highlight focus:outline-none focus:border-primary transition [color-scheme:only_dark]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-jakarta text-xs font-semibold text-muted">Trường mục tiêu</label>
                <input
                  type="text"
                  value={goalSchool}
                  onChange={e => { setGoalSchool(e.target.value); setGoalSaved(false) }}
                  placeholder="VD: THPT Chuyên Lê Hồng Phong"
                  maxLength={200}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background font-jakarta text-[0.8125rem] text-highlight placeholder-faint focus:outline-none focus:border-primary transition"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-jakarta text-xs font-semibold text-muted">Số giờ học mỗi tuần</label>
                <input
                  type="number"
                  value={goalHours}
                  onChange={e => { setGoalHours(e.target.value); setGoalSaved(false) }}
                  min={1} max={168} placeholder="VD: 10"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background font-jakarta text-[0.8125rem] text-highlight placeholder-faint focus:outline-none focus:border-primary transition"
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
                className="self-start px-5 py-2.5 rounded-xl font-jakarta text-[0.8125rem] font-bold transition"
                style={{ background: goalSaving ? '#1E2A44' : '#F2A20C', color: goalSaving ? '#475569' : '#0A0E1A' }}
              >
                {goalSaving ? 'Đang lưu...' : 'Lưu mục tiêu'}
              </button>
            </section>

            {/* Account status */}
            <section className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-4">
              <span className="font-fraunces text-[15px] font-semibold text-foreground">Trạng thái tài khoản</span>
              <div className="flex items-center gap-3">
                {!!user.is_locked ? (
                  <span className="font-jakarta text-xs font-bold px-3 py-1 rounded-full bg-red-500/20 text-red-400">Đã khóa</span>
                ) : !!user.is_deactivated ? (
                  <span className="font-jakarta text-xs font-bold px-3 py-1 rounded-full bg-amber-400/20 text-amber-400">Tạm ngưng</span>
                ) : (
                  <span className="font-jakarta text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400">Hoạt động</span>
                )}
              </div>
              {!!user.is_locked && (
                <p className="font-jakarta text-xs text-muted">{user.lock_reason || 'Liên hệ hỗ trợ để mở khóa tài khoản.'}</p>
              )}
              {!!user.is_deactivated && !user.is_locked && (
                <div className="flex items-center justify-between gap-4">
                  <span className="font-jakarta text-xs text-muted">Bạn có thể kích hoạt lại bất kỳ lúc nào.</span>
                  <button
                    disabled={reactivating}
                    onClick={async () => { setReactivating(true); await reactivateAccount(); setReactivating(false) }}
                    className="shrink-0 px-4 py-2 rounded-lg font-jakarta text-xs font-bold transition"
                    style={{ background: '#F2A20C', color: '#0A0E1A', opacity: reactivating ? 0.6 : 1 }}
                  >
                    {reactivating ? 'Đang kích hoạt...' : 'Kích hoạt lại'}
                  </button>
                </div>
              )}
            </section>

            {/* Notifications */}
            <section className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-4">
              <span className="font-fraunces text-[15px] font-semibold text-foreground">Thông báo</span>
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="font-jakarta text-[0.8125rem] font-semibold text-highlight">Nhắc nhở học tập hàng ngày</span>
                  <span className="font-jakarta text-[0.6875rem] text-dim">Nhận thông báo nhắc ôn luyện mỗi ngày.</span>
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
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${reminderEnabled ? 'bg-amber-400' : 'bg-border'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${reminderEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>
              {reminderEnabled && (
                <div className="flex items-center gap-3 pt-1">
                  <span className="font-jakarta text-xs text-muted">Giờ nhắc nhở:</span>
                  <select
                    value={reminderHour}
                    onChange={e => {
                      const h = parseInt(e.target.value, 10)
                      setReminderHour(h)
                      localStorage.setItem('study_reminder_hour', String(h))
                    }}
                    className="px-3 py-1.5 rounded-lg border border-border bg-surface-elevated font-jakarta text-xs text-highlight focus:outline-none focus:border-amber-400/60"
                  >
                    {Array.from({ length: 18 }, (_, i) => i + 6).map(h => (
                      <option key={h} value={h}>{h}:00</option>
                    ))}
                  </select>
                </div>
              )}
            </section>


            {/* Share & Earn — referral */}
            {referral?.referral_code && (
              <section className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="font-fraunces text-[15px] font-semibold text-foreground">Chia sẻ & Kiếm Tia</span>
                  <span className="font-jakarta text-xs text-dim">
                    Bạn và người được mời đều nhận <span className="text-amber-400">⚡ 50 Tia</span> khi họ đăng ký.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly value={referralUrl}
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-background font-jakarta text-[0.6875rem] text-dim select-all"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(referralUrl)
                        .then(() => toast.success('Đã sao chép link giới thiệu'))
                        .catch(() => {})
                    }}
                    className="px-3 py-2 rounded-lg font-jakarta text-xs font-bold flex-shrink-0"
                    style={{ background: '#F2A20C', color: '#0A0E1A' }}
                  >
                    Sao chép
                  </button>
                </div>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Ôn thi cùng Zenith nhé! Dùng link này để nhận 50 Tia miễn phí: ${referralUrl}`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="self-start flex items-center gap-2 px-4 py-2 rounded-lg font-jakarta text-xs font-semibold bg-[#25D366] text-white hover:opacity-90 transition"
                >
                  <span>💬</span> Chia sẻ qua WhatsApp
                </a>
                {(referral.successful_referrals ?? 0) > 0 && (
                  <div className="flex items-center gap-3 pt-1 border-t border-border">
                    <span className="font-jakarta text-xs text-dim">
                      <span className="text-amber-400 font-bold">{referral.successful_referrals}</span> người đã tham gia qua link
                    </span>
                    <span className="font-jakarta text-xs text-amber-400">
                      ⚡ {(referral.successful_referrals ?? 0) * 50} Tia đã kiếm
                    </span>
                  </div>
                )}
              </section>
            )}

            {/* Danger Zone — collapsed by default */}
            <section className="bg-surface border border-red-500/20 rounded-2xl p-7 flex flex-col gap-4">
              <button
                onClick={() => setDangerOpen(v => !v)}
                className="flex items-center gap-2 font-jakarta text-[0.8125rem] text-red-400 hover:text-red-300 transition self-start"
              >
                <span>Xóa hoặc tạm ngưng tài khoản</span>
                <span className="text-[0.625rem]">{dangerOpen ? '▲' : '▼'}</span>
              </button>

              <AnimatePresence>
                {dangerOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden flex flex-col gap-5"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap pt-2 border-t border-border">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-jakarta text-[0.8125rem] font-semibold text-highlight">Tạm ngưng tài khoản</span>
                        <span className="font-jakarta text-xs text-dim">Vô hiệu hóa tài khoản tạm thời. Bạn có thể kích hoạt lại sau.</span>
                      </div>
                      <button
                        onClick={() => setShowDeactivateModal(true)}
                        className="shrink-0 px-4 py-2 rounded-lg font-jakarta text-xs font-bold border border-amber-400/40 text-amber-400 hover:bg-amber-400/10 transition"
                      >
                        Tạm ngưng
                      </button>
                    </div>
                    <div className="border-t border-border" />
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-jakarta text-[0.8125rem] font-semibold text-highlight">Xóa tài khoản vĩnh viễn</span>
                        <span className="font-jakarta text-xs text-dim">Tất cả dữ liệu sẽ bị xóa và không thể khôi phục.</span>
                      </div>
                      <button
                        onClick={() => { setShowDeleteModal(true); setDeleteEmail(''); setDangerError('') }}
                        className="shrink-0 px-4 py-2 rounded-lg font-jakarta text-xs font-bold border border-red-500/40 text-red-400 hover:bg-red-500/10 transition"
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
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              className="max-w-sm w-full bg-surface border border-border rounded-2xl p-7 flex flex-col gap-5"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-fraunces text-[16px] font-bold text-foreground">Nạp ⚡ {topupPkg.credits} Tia</p>
                  <p className="font-jakarta text-[0.8125rem] text-dim mt-0.5">{topupPkg.price} · Chuyển khoản ngân hàng</p>
                </div>
                <button onClick={() => { setTopupPkg(null); setCopyBankDone(false) }} className="text-faint hover:text-foreground text-xl leading-none">×</button>
              </div>

              <div className="flex flex-col gap-3 bg-surface-elevated rounded-xl p-4">
                {[
                  ['Ngân hàng', BANK_INFO.bank_name],
                  ['Số tài khoản', BANK_INFO.account_number],
                  ['Chủ tài khoản', BANK_INFO.account_name],
                  ['Số tiền', topupPkg.price],
                  ['Nội dung CK', `TOPUP ${user.email} ${topupPkg.credits}TIA`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <span className="font-jakarta text-[0.6875rem] text-faint">{label}</span>
                    <span className="font-jakarta text-xs font-semibold text-highlight text-right">{value}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  const text = `Ngân hàng: ${BANK_INFO.bank_name}\nSố TK: ${BANK_INFO.account_number}\nChủ TK: ${BANK_INFO.account_name}\nSố tiền: ${topupPkg.price}\nNội dung: TOPUP ${user.email} ${topupPkg.credits}TIA`
                  navigator.clipboard?.writeText(text).then(() => setCopyBankDone(true)).catch(() => {})
                }}
                className="py-2.5 rounded-xl font-jakarta text-[0.8125rem] font-bold transition"
                style={{ background: copyBankDone ? '#10B981' : '#F2A20C', color: '#0A0E1A' }}
              >
                {copyBankDone ? '✓ Đã sao chép' : 'Sao chép thông tin'}
              </button>
              <p className="font-jakarta text-[0.6875rem] text-faint text-center">
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
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              className="max-w-sm w-full bg-surface border border-border rounded-2xl p-7 flex flex-col gap-5"
            >
              <span className="font-fraunces text-[16px] font-bold text-foreground">Tạm ngưng tài khoản?</span>
              <p className="font-jakarta text-[0.8125rem] text-muted">
                Bạn sẽ không thể sử dụng dịch vụ cho đến khi kích hoạt lại. Dữ liệu của bạn sẽ được giữ nguyên.
              </p>
              {dangerError && <p className="font-jakarta text-xs text-red-400">{dangerError}</p>}
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
                  className="flex-1 py-2.5 rounded-xl font-jakarta text-[0.8125rem] font-bold transition"
                  style={{ background: dangerLoading ? '#1E2A44' : '#F2A20C', color: dangerLoading ? '#475569' : '#0A0E1A' }}
                >
                  {dangerLoading ? 'Đang xử lý...' : 'Xác nhận tạm ngưng'}
                </button>
                <button
                  onClick={() => { setShowDeactivateModal(false); setDangerError('') }}
                  className="px-4 py-2.5 rounded-xl font-jakarta text-[0.8125rem] text-dim hover:text-foreground transition"
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
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              className="max-w-sm w-full bg-surface border border-red-500/30 rounded-2xl p-7 flex flex-col gap-5"
            >
              <span className="font-fraunces text-[16px] font-bold text-red-400">Xóa tài khoản vĩnh viễn</span>
              <p className="font-jakarta text-[0.8125rem] text-muted">
                Hành động này <strong className="text-foreground">không thể hoàn tác</strong>. Tất cả dữ liệu bao gồm lịch sử thi và Tia sẽ bị xóa.
              </p>
              <div className="flex flex-col gap-1.5">
                <span className="font-jakarta text-xs text-dim">Nhập địa chỉ email của bạn để xác nhận:</span>
                <input
                  className="px-4 py-2.5 rounded-xl border border-border bg-surface-elevated font-jakarta text-[0.8125rem] text-highlight focus:outline-none focus:border-red-400"
                  placeholder={user.email}
                  value={deleteEmail}
                  onChange={e => setDeleteEmail(e.target.value)}
                />
              </div>
              {dangerError && <p className="font-jakarta text-xs text-red-400">{dangerError}</p>}
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
                  className="flex-1 py-2.5 rounded-xl font-jakarta text-[0.8125rem] font-bold transition disabled:opacity-40"
                  style={{ background: '#EF4444', color: '#fff' }}
                >
                  {dangerLoading ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
                </button>
                <button
                  onClick={() => { setShowDeleteModal(false); setDangerError(''); setDeleteEmail('') }}
                  className="px-4 py-2.5 rounded-xl font-jakarta text-[0.8125rem] text-dim hover:text-foreground transition"
                >
                  Huỷ
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile bottom navigation — hidden on lg+ */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 pb-safe"
        style={{ background: '#0A0E1A', borderTop: '1px solid #1E2A44', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        {[
          { id: TAB_PROGRESS,  label: 'Tiến Độ',   icon: '📈' },
          { id: TAB_ANALYTICS, label: 'Phân Tích',  icon: '🧠' },
          { id: TAB_AITIA,     label: 'AI & Tia',   icon: '⚡' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex flex-col items-center gap-0.5 py-2 px-4 rounded-xl transition-colors"
            style={{
              color: activeTab === tab.id ? '#818CF8' : '#64748B',
              background: activeTab === tab.id ? '#818CF822' : 'transparent',
              minWidth: 72,
            }}
          >
            <span className="text-xl">{tab.icon}</span>
            <span className="text-[0.625rem] font-semibold">{tab.label}</span>
          </button>
        ))}
      </nav>

    </motion.div>
  )
}
