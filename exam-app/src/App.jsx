import { useState, lazy, Suspense, useCallback } from 'react'
import { MotionConfig, AnimatePresence } from 'framer-motion'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { ExamProvider } from './context/ExamContext.jsx'
import { HistoryProvider } from './context/HistoryContext.jsx'
import { useAuth } from './context/AuthContext.jsx'
import { useExamDispatch } from './context/ExamContext.jsx'
import { loadExamById, loadQuestionsByIds } from './api/index.js'
import Navbar from './components/Navbar.jsx'
import AuthModal from './components/AuthModal.jsx'
import ProfileOnboarding from './components/ProfileOnboarding.jsx'
import ExtendedOnboarding from './components/ExtendedOnboarding.jsx'
import LowCreditBanner from './components/LowCreditBanner.jsx'
import OfflineBanner from './components/OfflineBanner.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
import InstallPrompt from './components/InstallPrompt.jsx'
import { OracleProvider } from './context/OracleContext.jsx'

const Landing = lazy(() => import('./pages/Landing.jsx'))
const ExamSelect = lazy(() => import('./pages/ExamSelect.jsx'))
const TestInterface = lazy(() => import('./pages/TestInterface.jsx'))
const Results = lazy(() => import('./pages/Results.jsx'))
const History = lazy(() => import('./pages/History.jsx'))
const StudyPlan = lazy(() => import('./pages/StudyPlan.jsx'))
const MathOracle = lazy(() => import('./pages/MathOracle.jsx'))
const Account = lazy(() => import('./pages/Account.jsx'))
const ReviewSession = lazy(() => import('./pages/ReviewSession.jsx'))
const Mistakes = lazy(() => import('./pages/Mistakes.jsx'))
const AdaptivePractice = lazy(() => import('./pages/AdaptivePractice.jsx'))
const DailyChallenge = lazy(() => import('./pages/DailyChallenge.jsx'))
const Admin = lazy(() => import('./pages/Admin.jsx'))
const AdminSecurityEvents = lazy(() => import('./pages/AdminSecurityEvents.jsx'))
const ShareView = lazy(() => import('./pages/ShareView.jsx'))
const ChallengeLanding = lazy(() => import('./pages/ChallengeLanding.jsx'))
const DiagnosticTest = lazy(() => import('./pages/DiagnosticTest.jsx'))
const GenerateExam = lazy(() => import('./pages/GenerateExam.jsx'))
const Progress = lazy(() => import('./pages/Progress.jsx'))
const AdaptiveStudyPlan = lazy(() => import('./pages/AdaptiveStudyPlan.jsx'))
const Placement = lazy(() => import('./pages/Placement.jsx'))
const ConceptMap = lazy(() => import('./pages/ConceptMap.jsx'))
const ErrorAnalysis = lazy(() => import('./pages/ErrorAnalysis.jsx'))

const PageFallback = () => <div className="min-h-screen bg-[#0A0E1A]" />

function SuspensionModal({ reason, onLogout }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
      <div className="max-w-sm w-full bg-[#0D1221] border border-red-500/40 rounded-2xl p-8 flex flex-col gap-5 text-center">
        <span className="text-red-400 text-4xl">⚠</span>
        <div className="flex flex-col gap-2">
          <span className="font-fraunces text-[18px] font-bold text-[#F8FAFC]">Tài khoản bị tạm khoá</span>
          {reason && <p className="font-jakarta text-[13px] text-[#94A3B8]">{reason}</p>}
          <p className="font-jakarta text-[12px] text-[#475569]">Liên hệ hỗ trợ nếu bạn cho rằng đây là nhầm lẫn.</p>
        </div>
        <button
          onClick={onLogout}
          className="w-full py-3 rounded-xl font-jakarta text-[13px] font-bold bg-[#1E2A44] text-[#94A3B8] hover:text-[#F8FAFC] transition"
        >
          Đăng xuất
        </button>
      </div>
    </div>
  )
}

function AppInner() {
  const [authOpen, setAuthOpen] = useState(false)
  const { user, loading, logout } = useAuth()
  const dispatch = useExamDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdminRoute = location.pathname === '/admin' || location.pathname === '/admin/security-events'

  const [resumeBanner] = useState(() => {
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key && key.startsWith('exam-draft-')) {
          const raw = sessionStorage.getItem(key)
          if (!raw) continue
          const draft = JSON.parse(raw)
          if (draft && draft.examId && draft.answers && Object.keys(draft.answers).length > 0) {
            return {
              examId: draft.examId,
              answers: draft.answers,
              mode: draft.mode || 'timed',
              answeredCount: Object.keys(draft.answers).length,
              userId: draft.userId ?? null,
            }
          }
        }
      }
    } catch {
      // ignore storage errors
    }
    return null
  })
  const [resumeDismissed, setResumeDismissed] = useState(false)

  const handleResume = useCallback(async () => {
    if (!resumeBanner) return
    const exam = loadExamById(resumeBanner.examId)
    if (!exam) {
      setResumeDismissed(true)
      sessionStorage.removeItem(`exam-draft-${resumeBanner.examId}`)
      return
    }
    let questions
    try {
      questions = await loadQuestionsByIds(exam.questionIds)
    } catch {
      setResumeDismissed(true)
      sessionStorage.removeItem(`exam-draft-${resumeBanner.examId}`)
      return
    }
    dispatch({ type: 'START_EXAM', exam, questions, mode: resumeBanner.mode || 'timed' })
    for (const [questionId, choiceIndex] of Object.entries(resumeBanner.answers)) {
      dispatch({ type: 'ANSWER_QUESTION', questionId, choiceIndex })
    }
    setResumeDismissed(true)
    navigate(`/test/${resumeBanner.examId}`)
  }, [resumeBanner, dispatch, navigate])

  const showOnboarding = !loading && user && !user.grade
  const showExtendedOnboarding = !loading && user && user.grade && !user.extended_onboarding_done
  const showLowCredit = !loading && user && (user.credits_balance ?? 0) < 10
  const showSuspension = !loading && Boolean(user?.is_suspended)
  const showLocked = !loading && Boolean(user?.is_locked)
  const showDeactivated = !loading && Boolean(user?.is_deactivated)

  return (
    <>
      <ScrollToTop />
      <OfflineBanner />
      <InstallPrompt />
      {!isAdminRoute && <Navbar onOpenAuth={() => setAuthOpen(true)} />}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      {showDeactivated && (
        <SuspensionModal reason="Tài khoản đã bị tạm xóa do không hoạt động. Liên hệ hỗ trợ để khôi phục tài khoản." onLogout={logout} />
      )}
      {!showDeactivated && showLocked && (
        <SuspensionModal reason={user.lock_reason || 'Tài khoản bị khóa do hoạt động bất thường. Liên hệ hỗ trợ để mở khóa.'} onLogout={logout} />
      )}
      {!showDeactivated && !showLocked && showSuspension && (
        <SuspensionModal reason={user.suspension_reason} onLogout={logout} />
      )}
      {!isAdminRoute && !showDeactivated && !showLocked && !showSuspension && showOnboarding && (
        <ProfileOnboarding onDone={() => {}} />
      )}
      {!isAdminRoute && !showDeactivated && !showLocked && !showSuspension && !showOnboarding && showExtendedOnboarding && (
        <ExtendedOnboarding onDone={() => {}} />
      )}
      <div className={`min-h-screen bg-[#0A0E1A] text-gray-900${isAdminRoute ? '' : ' pt-12'}`}>
        {showLowCredit && !isAdminRoute && !showOnboarding && !showDeactivated && !showLocked && !showSuspension && (
          <LowCreditBanner balance={user.credits_balance} />
        )}
        <Suspense fallback={<PageFallback />}>
          <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Landing onOpenAuth={() => setAuthOpen(true)} />} />
            <Route path="/exams" element={<ExamSelect onOpenAuth={() => setAuthOpen(true)} />} />
            <Route path="/test/:examId" element={<TestInterface />} />
            <Route path="/results/current" element={<Results onOpenAuth={() => setAuthOpen(true)} />} />
            <Route path="/results/:resultId" element={<Results onOpenAuth={() => setAuthOpen(true)} />} />
            <Route path="/history" element={<History />} />
            <Route path="/study-plan/:resultId" element={<StudyPlan />} />
            <Route path="/oracle" element={<MathOracle />} />
            <Route path="/account" element={<Account />} />
            <Route path="/review" element={<ReviewSession />} />
            <Route path="/mistakes" element={<Mistakes />} />
            <Route path="/practice/adaptive" element={<AdaptivePractice />} />
            <Route path="/daily" element={<DailyChallenge />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/security-events" element={<AdminSecurityEvents />} />
            <Route path="/share" element={<ShareView />} />
            <Route path="/challenge" element={<ChallengeLanding />} />
            <Route path="/diagnostic" element={<DiagnosticTest />} />
            <Route path="/generate-exam" element={<GenerateExam />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/study-plan/adaptive" element={<AdaptiveStudyPlan />} />
            <Route path="/placement" element={<Placement />} />
            <Route path="/concept-map" element={<ConceptMap />} />
            <Route path="/error-analysis" element={<ErrorAnalysis />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </AnimatePresence>
        </Suspense>
      </div>
      {resumeBanner && !resumeDismissed && (resumeBanner.userId ?? null) === (user?.id ?? null) && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0D1221] border-t border-[#F2A20C44] px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="font-jakarta text-[13px] font-semibold text-[#F8FAFC]">Bạn có bài thi đang dở</span>
            <span className="font-jakarta text-[11px] text-[#64748B]">{resumeBanner.answeredCount} câu đã trả lời · Tiếp tục từ điểm dừng?</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleResume} style={{ background: '#F2A20C', color: '#0A0E1A' }} className="px-4 py-2 rounded-lg font-jakarta text-[12px] font-bold">Tiếp tục</button>
            <button onClick={() => { setResumeDismissed(true); sessionStorage.removeItem(`exam-draft-${resumeBanner.examId}`) }} className="px-3 py-2 rounded-lg font-jakarta text-[12px] text-[#64748B] border border-[#1E2A44]">Bỏ qua</button>
          </div>
        </div>
      )}
    </>
  )
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <HistoryProvider>
        <ExamProvider>
          <OracleProvider>
            <AppInner />
          </OracleProvider>
        </ExamProvider>
      </HistoryProvider>
    </MotionConfig>
  )
}
