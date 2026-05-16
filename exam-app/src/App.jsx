import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ExamProvider } from './context/ExamContext.jsx'
import { HistoryProvider } from './context/HistoryContext.jsx'
import { useAuth } from './context/AuthContext.jsx'
import Navbar from './components/Navbar.jsx'
import AuthModal from './components/AuthModal.jsx'
import ProfileOnboarding from './components/ProfileOnboarding.jsx'
import LowCreditBanner from './components/LowCreditBanner.jsx'
import OfflineBanner from './components/OfflineBanner.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
import Landing from './pages/Landing.jsx'
import ExamSelect from './pages/ExamSelect.jsx'
import TestInterface from './pages/TestInterface.jsx'
import Results from './pages/Results.jsx'
import History from './pages/History.jsx'
import StudyPlan from './pages/StudyPlan.jsx'
import MathOracle from './pages/MathOracle.jsx'
import Account from './pages/Account.jsx'
import ReviewSession from './pages/ReviewSession.jsx'
import Mistakes from './pages/Mistakes.jsx'
import AdaptivePractice from './pages/AdaptivePractice.jsx'
import DailyChallenge from './pages/DailyChallenge.jsx'

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

  const showOnboarding = !loading && user && !user.grade
  const showLowCredit = !loading && user && (user.credits_balance ?? 0) < 10
  const showSuspension = !loading && Boolean(user?.is_suspended)

  return (
    <>
      <ScrollToTop />
      <OfflineBanner />
      <Navbar onOpenAuth={() => setAuthOpen(true)} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      {showSuspension && (
        <SuspensionModal reason={user.suspension_reason} onLogout={logout} />
      )}
      {!showSuspension && showOnboarding && (
        <ProfileOnboarding onDone={() => {}} />
      )}
      <div className="min-h-screen bg-[#0A0E1A] text-gray-900 pt-12">
        {showLowCredit && !showOnboarding && (
          <LowCreditBanner balance={user.credits_balance} />
        )}
        <Routes>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  )
}

export default function App() {
  return (
    <HistoryProvider>
      <ExamProvider>
        <AppInner />
      </ExamProvider>
    </HistoryProvider>
  )
}
