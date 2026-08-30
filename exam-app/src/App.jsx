import { useState, lazy, Suspense, useCallback } from 'react'
import { MotionConfig, AnimatePresence } from 'framer-motion'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { ExamProvider } from './context/ExamContext.jsx'
import { HistoryProvider } from './context/HistoryContext.jsx'
import { OrgAuthProvider } from './context/OrgAuthContext.jsx'
import { useExamDispatch } from './context/ExamContext.jsx'
import { loadExamById, loadQuestionsByIds } from './api/index.js'
import Navbar from './components/Navbar.jsx'
import OfflineBanner from './components/OfflineBanner.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
import AmbientBackground from './components/motion/AmbientBackground.jsx'
import InstallPrompt from './components/InstallPrompt.jsx'
import RequireOrgRole from './components/RequireOrgRole.jsx'
import OrgBrandingProvider from './components/OrgBrandingProvider.jsx'
import { Toaster } from './components/ui/sonner.jsx'
import {
  ExamSelectSkeleton, ResultsPageSkeleton, HistoryPageSkeleton, QuestionCardSkeleton, SimplePageSkeleton,
  ConceptExplorerSkeleton,
} from './components/Skeleton.jsx'

const Landing = lazy(() => import('./pages/Landing.jsx'))
const ExamSelect = lazy(() => import('./pages/ExamSelect.jsx'))
const TestInterface = lazy(() => import('./pages/TestInterface.jsx'))
const Results = lazy(() => import('./pages/Results.jsx'))
const History = lazy(() => import('./pages/History.jsx'))
const ConceptExplorer = lazy(() => import('./pages/ConceptExplorer.jsx'))
const CasCalculator = lazy(() => import('./pages/CasCalculator.jsx'))
const LinearAlgebraWorkspace = lazy(() => import('./pages/LinearAlgebraWorkspace.jsx'))
const ProbabilitySimulator = lazy(() => import('./pages/ProbabilitySimulator.jsx'))
const MathPlayground = lazy(() => import('./pages/MathPlayground.jsx'))
const ContentAudit = lazy(() => import('./pages/ContentAudit.jsx'))
const OrgConsole = lazy(() => import('./pages/org/OrgConsole.jsx'))
const OrgMembers = lazy(() => import('./pages/org/OrgMembers.jsx'))
const OrgAuditLog = lazy(() => import('./pages/org/OrgAuditLog.jsx'))
const ContentLedger = lazy(() => import('./pages/org/ContentLedger.jsx'))
const OrgSettings = lazy(() => import('./pages/org/OrgSettings.jsx'))
const ContentLibrary = lazy(() => import('./pages/org/ContentLibrary.jsx'))
const CohortAnalytics = lazy(() => import('./pages/org/CohortAnalytics.jsx'))
const Integrations = lazy(() => import('./pages/org/Integrations.jsx'))
const Compliance = lazy(() => import('./pages/org/Compliance.jsx'))
const ContentGeneration = lazy(() => import('./pages/admin/ContentGeneration.jsx'))
const PendingReview = lazy(() => import('./pages/admin/PendingReview.jsx'))
const ProctoringSettings = lazy(() => import('./pages/admin/ProctoringSettings.jsx'))
const ProctoringReview = lazy(() => import('./pages/admin/ProctoringReview.jsx'))
const PsychometricFlags = lazy(() => import('./pages/admin/PsychometricFlags.jsx'))

function PageFallback() {
  const { pathname } = useLocation()
  if (pathname === '/exams') return <ExamSelectSkeleton />
  if (pathname.startsWith('/results')) return <ResultsPageSkeleton />
  if (pathname === '/history') return <HistoryPageSkeleton />
  if (pathname.startsWith('/concept/')) return <ConceptExplorerSkeleton />
  if (pathname.startsWith('/test/')) return (
    <div className="min-h-screen bg-background pt-12 px-4 flex flex-col gap-4 max-w-2xl mx-auto pt-8">
      <QuestionCardSkeleton />
    </div>
  )
  return <SimplePageSkeleton />
}

function AppInner() {
  const dispatch = useExamDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const isHiddenNavRoute = location.pathname.startsWith('/test/') || location.pathname === '/'

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

  return (
    <>
      <ScrollToTop />
      <AmbientBackground />
      <OrgBrandingProvider />
      <OfflineBanner />
      <InstallPrompt />
      {!isHiddenNavRoute && <Navbar />}
      <div className={`min-h-screen bg-background text-foreground${isHiddenNavRoute ? '' : ' pt-12'}`}>
        <Suspense fallback={<PageFallback />}>
          <AnimatePresence mode="wait" initial={false}>
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Landing />} />
              <Route path="/exams" element={<ExamSelect />} />
              <Route path="/test/:examId" element={<TestInterface />} />
              <Route path="/results/current" element={<Results />} />
              <Route path="/results/:resultId" element={<Results />} />
              <Route path="/history" element={<History />} />
              <Route path="/concept/:questionId" element={<ConceptExplorer />} />
              <Route path="/calculator" element={<CasCalculator />} />
              <Route path="/linalg" element={<LinearAlgebraWorkspace />} />
              <Route path="/probability" element={<ProbabilitySimulator />} />
              <Route path="/playground" element={<MathPlayground />} />
              <Route path="/content-audit" element={<ContentAudit />} />
              <Route path="/org" element={<RequireOrgRole min="admin"><OrgConsole /></RequireOrgRole>} />
              <Route path="/org/members" element={<RequireOrgRole min="admin"><OrgMembers /></RequireOrgRole>} />
              <Route path="/org/audit-log" element={<RequireOrgRole min="admin"><OrgAuditLog /></RequireOrgRole>} />
              <Route path="/org/content-ledger" element={<RequireOrgRole min="admin"><ContentLedger /></RequireOrgRole>} />
              <Route path="/org/settings" element={<RequireOrgRole min="admin"><OrgSettings /></RequireOrgRole>} />
              <Route path="/org/content" element={<RequireOrgRole min="admin"><ContentLibrary /></RequireOrgRole>} />
              <Route path="/org/analytics" element={<RequireOrgRole min="admin"><CohortAnalytics /></RequireOrgRole>} />
              <Route path="/org/integrations" element={<RequireOrgRole min="admin"><Integrations /></RequireOrgRole>} />
              <Route path="/org/compliance" element={<RequireOrgRole min="admin"><Compliance /></RequireOrgRole>} />
              <Route path="/org/agent/generate" element={<RequireOrgRole min="admin"><ContentGeneration /></RequireOrgRole>} />
              <Route path="/org/pending" element={<RequireOrgRole min="admin"><PendingReview /></RequireOrgRole>} />
              <Route path="/org/proctoring-settings" element={<RequireOrgRole min="admin"><ProctoringSettings /></RequireOrgRole>} />
              <Route path="/org/proctoring-review" element={<RequireOrgRole min="admin"><ProctoringReview /></RequireOrgRole>} />
              <Route path="/org/psychometric-flags" element={<RequireOrgRole min="admin"><PsychometricFlags /></RequireOrgRole>} />
              <Route path="*" element={<Navigate to="/exams" replace />} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </div>
      {resumeBanner && !resumeDismissed && (
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
      <OrgAuthProvider>
        <HistoryProvider>
          <ExamProvider>
            <AppInner />
            <Toaster />
          </ExamProvider>
        </HistoryProvider>
      </OrgAuthProvider>
    </MotionConfig>
  )
}
