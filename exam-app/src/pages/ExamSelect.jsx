import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useExamDispatch } from '../context/ExamContext.jsx'
import { loadExams, loadQuestionsByIds } from '../api/index.js'

export default function ExamSelect() {
  const navigate = useNavigate()
  const dispatch = useExamDispatch()
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState(searchParams.get('mode') === 'practice' ? 'practice' : 'timed')
  const exams = loadExams()

  function handleStart(exam) {
    const questions = loadQuestionsByIds(exam.questionIds)
    dispatch({ type: 'START_EXAM', exam, questions, mode })
    navigate(`/test/${exam.id}`)
  }

  return (
    <div className="min-h-screen bg-[#111827] flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-10 py-4 bg-[#0D1521] border-b border-[#1E2D45]">
        <button onClick={() => navigate('/')} className="font-jakarta text-sm text-[#64748B] hover:text-[#94A3B8] transition">
          ← Trang chủ
        </button>
        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-[#1A2440] rounded-full p-1">
          {[
            { value: 'timed', label: 'Có thời gian' },
            { value: 'practice', label: 'Luyện tập' },
          ].map(opt => (
            <button key={opt.value} onClick={() => setMode(opt.value)}
              className={`px-5 py-2 rounded-full font-jakarta text-[13px] transition ${
                mode === opt.value ? 'bg-[#F2A20C] text-[#0A0E1A] font-semibold' : 'text-[#94A3B8]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </nav>
      {/* Content */}
      <div className="flex flex-col gap-6 p-10">
        <h1 className="font-fraunces text-[36px] font-bold text-[#F8FAFC]">Chọn đề thi</h1>
        <div className="flex flex-col gap-3">
          {exams.map((exam, idx) => (
            <div key={exam.id} className="bg-[#0D1521] rounded-xl px-6 py-5 flex flex-col gap-3"
              style={{ borderLeft: `3px solid ${idx === 0 ? '#F2A20C' : '#F2A20C99'}` }}>
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1.5">
                  <span className="font-jakarta text-[15px] font-semibold text-[#F8FAFC]">{exam.title}</span>
                  <span className="font-jakarta text-[13px] text-[#64748B]">
                    {exam.year} · {exam.totalQuestions} câu · {exam.duration} phút
                  </span>
                </div>
                <button onClick={() => handleStart(exam)}
                  className={`flex-shrink-0 px-5 py-2 rounded-md font-jakarta text-[13px] font-semibold transition ${
                    idx === 0
                      ? 'bg-[#F2A20C] text-[#0A0E1A] hover:opacity-90'
                      : 'bg-[#1A2440] border border-[#F2A20C] text-[#F2A20C] hover:bg-[#F2A20C]/10'
                  }`}>
                  Bắt đầu
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
