import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useExamDispatch } from '../context/ExamContext.jsx'
import { loadExams, loadThiThuExams, loadQuestionsByIds } from '../api/index.js'
import { motion } from 'framer-motion'

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
}
const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

const GROUPS = {
  timed: [
    {
      category: 'grade10',
      label: 'Thi vào lớp 10',
      description: 'Đề thi tuyển sinh THCS lên THPT',
      accent: '#3B82F6',
      tag: 'Lớp 10',
    },
    {
      category: 'thpt',
      label: 'Thi THPT Quốc gia',
      description: 'Đề thi & thi thử tốt nghiệp THPT',
      accent: '#F2A20C',
      tag: 'THPT',
    },
  ],
  practice: [
    {
      category: 'grade10',
      label: 'Luyện tập vào lớp 10',
      description: 'Đề thi tuyển sinh quốc tế — Ghana BECE & Ấn Độ CBSE',
      accent: '#3B82F6',
      tag: 'Lớp 10',
    },
    {
      category: 'thpt',
      label: 'Luyện tập THPT & Đại học',
      description: 'Đề quốc tế tương đương trình độ lớp 11–12 và đại học',
      accent: '#F2A20C',
      tag: 'THPT',
    },
  ],
}

export default function ExamSelect() {
  const navigate = useNavigate()
  const dispatch = useExamDispatch()
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState(searchParams.get('mode') === 'practice' ? 'practice' : 'timed')
  const exams = mode === 'timed' ? loadThiThuExams() : loadExams()

  function handleStart(exam) {
    const questions = loadQuestionsByIds(exam.questionIds)
    dispatch({ type: 'START_EXAM', exam, questions, mode: mode === 'timed' ? 'timed' : 'practice' })
    navigate(`/test/${exam.id}`)
  }

  const groups = GROUPS[mode]

  return (
    <div className="min-h-screen bg-[#111827] flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-10 py-4 bg-[#0D1521] border-b border-[#1E2D45]">
        <button onClick={() => navigate('/')} className="font-jakarta text-sm text-[#64748B] hover:text-[#94A3B8] transition">
          ← Trang chủ
        </button>
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
      <div className="flex flex-col gap-10 p-10">
        <h1 className="font-fraunces text-[36px] font-bold text-[#F8FAFC]">Chọn đề thi</h1>

        <motion.div
          className="flex flex-col gap-10"
          key={mode}
          variants={listVariants}
          initial="hidden"
          animate="show"
        >
          {groups.map(group => {
            const groupExams = exams.filter(e => e.category === group.category)
            if (groupExams.length === 0) return null
            return (
              <motion.section key={group.category} variants={cardVariants}>
                {/* Section header */}
                <div className="flex items-center gap-3 mb-4">
                  <span
                    className="font-jakarta text-[11px] font-bold tracking-[2px] uppercase px-2.5 py-1 rounded"
                    style={{ background: group.accent + '22', color: group.accent }}
                  >
                    {group.tag}
                  </span>
                  <div>
                    <h2 className="font-fraunces text-[22px] font-bold text-[#F8FAFC] leading-tight">{group.label}</h2>
                    <p className="font-jakarta text-[13px] text-[#64748B]">{group.description}</p>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px mb-4" style={{ background: group.accent + '33' }} />

                {/* Exam cards */}
                <div className="flex flex-col gap-3">
                  {groupExams.map(exam => (
                    <motion.div
                      key={exam.id}
                      variants={cardVariants}
                      whileHover={{ scale: 1.012 }}
                      className="bg-[#0D1521] rounded-xl px-6 py-5 flex flex-col gap-3"
                      style={{ borderLeft: `3px solid ${group.accent}99` }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-col gap-1.5">
                          <span className="font-jakarta text-[15px] font-semibold text-[#F8FAFC]">{exam.title}</span>
                          <span className="font-jakarta text-[13px] text-[#64748B]">
                            {exam.year} · {exam.totalQuestions} câu · {exam.duration} phút
                            {exam.source && ` · ${exam.source}`}
                          </span>
                        </div>
                        <button
                          onClick={() => handleStart(exam)}
                          className="flex-shrink-0 px-5 py-2 rounded-md font-jakarta text-[13px] font-semibold transition"
                          style={{
                            background: 'transparent',
                            border: `1px solid ${group.accent}`,
                            color: group.accent,
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = group.accent + '1A'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          Bắt đầu
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )
          })}
        </motion.div>
      </div>
    </div>
  )
}
