import { useState, lazy, Suspense, useCallback, useEffect, useRef } from 'react'
import { useGoogleOneTapLogin } from '@react-oauth/google'
import { MotionConfig, AnimatePresence } from 'framer-motion'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { ExamProvider } from './context/ExamContext.jsx'
import { HistoryProvider } from './context/HistoryContext.jsx'
import { useAuth } from './context/AuthContext.jsx'
import { useHistory } from './context/HistoryContext.jsx'
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
const Learn = lazy(() => import('./pages/Learn.jsx'))
const Placement = lazy(() => import('./pages/Placement.jsx'))
const ConceptMap = lazy(() => import('./pages/ConceptMap.jsx'))
const ErrorAnalysis = lazy(() => import('./pages/ErrorAnalysis.jsx'))
const Home = lazy(() => import('./pages/Home.jsx'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail.jsx'))
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'))

const PageFallback = () => <div className="min-h-screen bg-background" />

function SuspensionModal({ reason, onLogout }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
      <div className="max-w-sm w-full bg-surface border border-destructive/40 rounded-2xl p-8 flex flex-col gap-5 text-center">
        <span className="text-destructive text-4xl">⚠</span>
        <div className="flex flex-col gap-2">
          <span className="font-sans text-[18px] font-bold text-foreground">Tài khoản bị tạm khoá</span>
          {reason && <p className="font-sans text-[0.8125rem] text-muted">{reason}</p>}
          <p className="font-sans text-xs text-faint">Liên hệ hỗ trợ nếu bạn cho rằng đây là nhầm lẫn.</p>
        </div>
        <button
          onClick={onLogout}
          className="w-full py-3 rounded-xl font-sans text-[0.8125rem] font-bold bg-border text-muted hover:text-foreground transition"
        >
          Đăng xuất
        </button>
      </div>
    </div>
  )
}

function GoogleOneTap() {
  const { user, login } = useAuth()
  useGoogleOneTapLogin({
    onSuccess: async ({ credential }) => {
      try { await login(credential) } catch (_) {}
    },
    onError: () => {},
    disabled: !!user,
    cancel_on_tap_outside: true,
  })
  return null
}

function AppInner() {
  const [authOpen, setAuthOpen] = useState(false)
  const { user, loading, logout } = useAuth()
  const { results } = useHistory()
  const dispatch = useExamDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const isHiddenNavRoute = location.pathname === '/admin'
    || location.pathname === '/admin/security-events'
    || location.pathname.startsWith('/test/')

  // Post-login redirect: if user just logged in and a redirect path was saved, navigate there
  const prevUserRef = useRef(user)
  useEffect(() => {
    const wasLoggedOut = !prevUserRef.current
    prevUserRef.current = user
    if (wasLoggedOut && user) {
      const redirectPath = localStorage.getItem('post_login_redirect')
      if (redirectPath) {
        localStorage.removeItem('post_login_redirect')
        navigate(redirectPath)
      }
    }
  }, [user, navigate])

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
  const showExtendedOnboarding = !loading && user && user.grade && !user.extended_onboarding_done && results.length >= 1
  const showLowCredit = !loading && user && (user.credits_balance ?? 0) < 15
  const showSuspension = !loading && Boolean(user?.is_suspended)
  const showLocked = !loading && Boolean(user?.is_locked)
  const showDeactivated = !loading && Boolean(user?.is_deactivated)

  return (
    <>
      <GoogleOneTap />
      <ScrollToTop />
      <OfflineBanner />
      <InstallPrompt />
      {!isHiddenNavRoute && <Navbar onOpenAuth={() => setAuthOpen(true)} />}
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
      {!isHiddenNavRoute && !showDeactivated && !showLocked && !showSuspension && showOnboarding && (
        <ProfileOnboarding onDone={() => { if (results.length === 0) navigate('/practice/diagnostic') }} />
      )}
      {!isHiddenNavRoute && !showDeactivated && !showLocked && !showSuspension && !showOnboarding && showExtendedOnboarding && (
        <ExtendedOnboarding onDone={() => {}} />
      )}
      <div className={`min-h-screen bg-background text-foreground${isHiddenNavRoute ? '' : ' pt-12'}`}>
        {showLowCredit && !isHiddenNavRoute && !showOnboarding && !showDeactivated && !showLocked && !showSuspension && (
          <LowCreditBanner balance={user.credits_balance} />
        )}
        <Suspense fallback={<PageFallback />}>
          <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            {/* Root: authenticated → /home, guest → Landing */}
            <Route path="/" element={
              loading
                ? <PageFallback />
                : user
                  ? <Navigate to="/home" replace />
                  : <Landing onOpenAuth={() => setAuthOpen(true)} />
            } />
            {/* Authenticated home */}
            <Route path="/home" element={
              loading
                ? <PageFallback />
                : user
                  ? <Home />
                  : <Navigate to="/" replace />
            } />
            {/* Core exam flow */}
            <Route path="/exams" element={<ExamSelect onOpenAuth={() => setAuthOpen(true)} />} />
            <Route path="/test/:examId" element={<TestInterface />} />
            <Route path="/results/current" element={<Results onOpenAuth={() => setAuthOpen(true)} />} />
            <Route path="/results/:resultId" element={<Results onOpenAuth={() => setAuthOpen(true)} />} />
            <Route path="/history" element={<History />} />
            <Route path="/study-plan/:resultId" element={<StudyPlan />} />
            <Route path="/oracle" element={<MathOracle />} />
            <Route path="/account" element={<Account />} />
            <Route path="/review" element={<ReviewSession />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/mistakes" element={<Mistakes />} />
            {/* Learning routes — canonical paths */}
            <Route path="/practice" element={<AdaptivePractice />} />
            <Route path="/practice/daily" element={<DailyChallenge />} />
            <Route path="/practice/diagnostic" element={<DiagnosticTest onOpenAuth={() => setAuthOpen(true)} />} />
            <Route path="/mastery" element={<ConceptMap />} />
            {/* Legacy redirects — keep old URLs alive */}
            <Route path="/practice/adaptive" element={<Navigate to="/practice" replace />} />
            <Route path="/daily" element={<Navigate to="/practice/daily" replace />} />
            <Route path="/diagnostic" element={<Navigate to="/practice/diagnostic" replace />} />
            <Route path="/concept-map" element={<Navigate to="/mastery" replace />} />
            {/* Other pages */}
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/security-events" element={<AdminSecurityEvents />} />
            <Route path="/share" element={<ShareView />} />
            <Route path="/challenge" element={<ChallengeLanding />} />
            <Route path="/generate-exam" element={<GenerateExam />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/study-plan" element={<AdaptiveStudyPlan />} />
            <Route path="/study-plan/adaptive" element={<Navigate to="/study-plan" replace />} />
            <Route path="/placement" element={<Placement />} />
            <Route path="/error-analysis" element={<ErrorAnalysis />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </AnimatePresence>
        </Suspense>
      </div>
      {resumeBanner && !resumeDismissed && (resumeBanner.userId ?? null) === (user?.id ?? null) && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-primary/25 px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="font-sans text-[0.8125rem] font-semibold text-foreground">Bạn có bài thi đang dở</span>
            <span className="font-sans text-[0.6875rem] text-dim">{resumeBanner.answeredCount} câu đã trả lời · Tiếp tục từ điểm dừng?</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleResume} className="px-4 py-2 rounded-lg font-sans text-xs font-bold bg-primary text-primary-fg">Tiếp tục</button>
            <button onClick={() => { setResumeDismissed(true); sessionStorage.removeItem(`exam-draft-${resumeBanner.examId}`) }} className="px-3 py-2 rounded-lg font-sans text-xs text-dim border border-border">Bỏ qua</button>
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
