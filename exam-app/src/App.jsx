import { Routes, Route, Navigate } from 'react-router-dom'
import { ExamProvider } from './context/ExamContext.jsx'
import { HistoryProvider } from './context/HistoryContext.jsx'
import Landing from './pages/Landing.jsx'
import ExamSelect from './pages/ExamSelect.jsx'
import TestInterface from './pages/TestInterface.jsx'
import Results from './pages/Results.jsx'
import History from './pages/History.jsx'
import StudyPlan from './pages/StudyPlan.jsx'
import MathOracle from './pages/MathOracle.jsx'

export default function App() {
  return (
    <HistoryProvider>
      <ExamProvider>
        <div className="min-h-screen bg-gray-50 text-gray-900">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/exams" element={<ExamSelect />} />
            <Route path="/test/:examId" element={<TestInterface />} />
            <Route path="/results/current" element={<Results />} />
            <Route path="/results/:resultId" element={<Results />} />
            <Route path="/history" element={<History />} />
            <Route path="/study-plan/:resultId" element={<StudyPlan />} />
            <Route path="/oracle" element={<MathOracle />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </ExamProvider>
    </HistoryProvider>
  )
}
