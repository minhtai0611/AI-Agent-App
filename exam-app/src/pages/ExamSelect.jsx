import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useExamDispatch } from '../context/ExamContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { loadExams, loadThiThuExams, loadQuestionsByIds } from '../api/index.js'
import { motion, AnimatePresence } from 'framer-motion'
import { usePageTitle } from '../hooks/usePageTitle.js'

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
    { category: 'grade10', label: 'Thi vào lớp 10', description: 'Đề thi tuyển sinh THCS lên THPT', accent: '#3B82F6', tag: 'Lớp 10' },
    { category: 'thpt', label: 'Thi THPT Quốc gia', description: 'Đề thi & thi thử tốt nghiệp THPT', accent: '#F2A20C', tag: 'THPT' },
  ],
  practice: [
    { category: 'grade10', label: 'Luyện tập vào lớp 10', description: 'Đề thi tuyển sinh quốc tế — Ghana BECE & Ấn Độ CBSE', accent: '#3B82F6', tag: 'Lớp 10' },
    { category: 'thpt', label: 'Luyện tập THPT & Đại học', description: 'Đề quốc tế tương đương trình độ lớp 11–12 và đại học', accent: '#F2A20C', tag: 'THPT' },
  ],
}

const TRIAL_KEY = 'guest_trial_used'
const FILTER_KEY = 'examselect_filter'

function loadSavedFilters() {
  try { return JSON.parse(sessionStorage.getItem(FILTER_KEY) || '{}') } catch { return {} }
}
function saveFilters(f) {
  try { sessionStorage.setItem(FILTER_KEY, JSON.stringify(f)) } catch {}
}

function getAllowedCategories(user) {
  if (!user) return null // guest — computed separately
  if (user.subscription_tier === 'complete') return ['grade10', 'thpt']
  const grade = user.grade ? parseInt(user.grade) : null
  if (!grade) return ['grade10', 'thpt'] // no grade set yet → show all until onboarding completes
  return grade <= 9 ? ['grade10'] : ['thpt']
}

export default function ExamSelect({ onOpenAuth }) {
  usePageTitle('Chọn đề thi')
  const navigate = useNavigate()
  const dispatch = useExamDispatch()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState(searchParams.get('mode') === 'practice' ? 'practice' : 'timed')
  const [previewExam, setPreviewExam] = useState(null)

  const saved = loadSavedFilters()
  const [filterYear, setFilterYear] = useState(saved.year ?? null)
  const [filterSearch, setFilterSearch] = useState(saved.search ?? '')

  const allExams = mode === 'timed' ? loadThiThuExams() : loadExams()
  const availableYears = [...new Set(allExams.map(e => e.year).filter(Boolean))].sort((a, b) => b - a)

  const exams = allExams.filter(e => {
    if (filterYear && e.year !== filterYear) return false
    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase()
      return (e.title || '').toLowerCase().includes(q) || String(e.year).includes(q) || (e.source || '').toLowerCase().includes(q)
    }
    return true
  })

  function setYear(y) {
    setFilterYear(y)
    saveFilters({ year: y, search: filterSearch })
  }
  function setSearch(s) {
    setFilterSearch(s)
    saveFilters({ year: filterYear, search: s })
  }

  const allowedCategories = getAllowedCategories(user)

  async function handleStart(exam) {
    if (!user) {
      const trialUsed = localStorage.getItem(TRIAL_KEY)
      if (trialUsed) {
        onOpenAuth?.()
        return
      }
      localStorage.setItem(TRIAL_KEY, '1')
    }
    const questions = await loadQuestionsByIds(exam.questionIds)
    dispatch({ type: 'START_EXAM', exam, questions, mode: mode === 'timed' ? 'timed' : 'practice' })
    navigate(`/test/${exam.id}`)
  }

  const groups = GROUPS[mode]

  function openPreview(exam) { setPreviewExam(exam) }
  function closePreview() { setPreviewExam(null) }
  function confirmStart(exam) { closePreview(); handleStart(exam) }

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex flex-col relative overflow-hidden">
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

      {/* Guest notice */}
      {!user && (
        <div className="mx-10 mt-6 px-5 py-3 rounded-xl border border-[#F2A20C33] bg-[#0D1521] flex items-center justify-between gap-3">
          <span className="font-jakarta text-[13px] text-[#94A3B8]">
            Bạn có <strong className="text-amber-400">1 đề thi miễn phí</strong>. Đăng nhập để làm thêm và nhận phân tích AI.
          </span>
          <button
            onClick={onOpenAuth}
            className="flex-shrink-0 px-4 py-1.5 rounded-lg font-jakarta text-[12px] font-bold"
            style={{ background: '#F2A20C', color: '#0A0E1A' }}
          >
            Đăng nhập
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 px-10 pt-6">
        <input
          type="search"
          placeholder="Tìm đề thi..."
          value={filterSearch}
          onChange={e => setSearch(e.target.value)}
          className="h-9 px-4 rounded-full border border-[#1E2A44] bg-[#111827] font-jakarta text-[13px] text-[#F0F4FF] placeholder-[#475569] focus:outline-none focus:border-[#F2A20C] w-48"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setYear(null)}
            className={`h-8 px-3 rounded-full font-jakarta text-[12px] font-medium border transition ${
              !filterYear ? 'border-[#F2A20C] bg-[#F2A20C22] text-[#F2A20C]' : 'border-[#1E2A44] text-[#64748B] hover:border-[#2A3A50]'
            }`}
          >Tất cả</button>
          {availableYears.map(y => (
            <button
              key={y}
              onClick={() => setYear(filterYear === y ? null : y)}
              className={`h-8 px-3 rounded-full font-jakarta text-[12px] font-medium border transition ${
                filterYear === y ? 'border-[#F2A20C] bg-[#F2A20C22] text-[#F2A20C]' : 'border-[#1E2A44] text-[#64748B] hover:border-[#2A3A50]'
              }`}
            >{y}</button>
          ))}
        </div>
      </div>

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
            // Grade/tier filter
            const categoryAllowed = !allowedCategories || allowedCategories.includes(group.category)
            const groupExams = exams.filter(e => e.category === group.category)
            if (groupExams.length === 0) return null
            return (
              <motion.section key={group.category} variants={cardVariants}>
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
                <div className="h-px mb-4" style={{ background: group.accent + '33' }} />

                {!categoryAllowed ? (
                  <div className="px-5 py-4 rounded-xl border border-[#1E2A44] bg-[#0D1521] flex items-center justify-between gap-4">
                    <span className="font-jakarta text-[13px] text-[#64748B]">
                      Nâng cấp lên gói <strong className="text-amber-400">Toàn diện</strong> để truy cập danh mục này.
                    </span>
                    <button
                      onClick={() => navigate('/account#topup')}
                      className="flex-shrink-0 px-4 py-1.5 rounded-lg font-jakarta text-[12px] font-bold"
                      style={{ background: '#F2A20C', color: '#0A0E1A' }}
                    >
                      Nâng cấp
                    </button>
                  </div>
                ) : (
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
                            onClick={() => openPreview(exam)}
                            className="flex-shrink-0 px-5 py-2 rounded-md font-jakarta text-[13px] font-semibold transition"
                            style={{ background: 'transparent', border: `1px solid ${group.accent}`, color: group.accent }}
                            onMouseEnter={e => e.currentTarget.style.background = group.accent + '1A'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            Bắt đầu
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.section>
            )
          })}
        </motion.div>
      </div>

      {/* Exam preview modal */}
      <AnimatePresence>
        {previewExam && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(10,14,26,0.88)', backdropFilter: 'blur(6px)' }}
            onClick={closePreview}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-[#1E2A44] p-7 flex flex-col gap-5"
              style={{ background: 'linear-gradient(180deg, #0F1628 0%, #0D1221 100%)' }}
            >
              <div className="flex flex-col gap-1.5">
                <span className="font-fraunces text-[18px] font-semibold text-[#F8FAFC]">{previewExam.title}</span>
                <span className="font-jakarta text-[13px] text-[#64748B]">{previewExam.year}</span>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex flex-col gap-0.5">
                  <span className="font-jakarta text-[11px] text-[#475569]">Số câu</span>
                  <span className="font-fraunces text-[16px] font-bold text-[#F8FAFC]">{previewExam.totalQuestions}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-jakarta text-[11px] text-[#475569]">Thời gian</span>
                  <span className="font-fraunces text-[16px] font-bold text-[#F8FAFC]">{previewExam.duration} phút</span>
                </div>
                {previewExam.source && (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-jakarta text-[11px] text-[#475569]">Nguồn</span>
                    <span className="font-jakarta text-[13px] text-[#94A3B8]">{previewExam.source}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-1">
                <button
                  onClick={closePreview}
                  className="flex-1 py-3 rounded-xl font-jakarta text-[13px] font-semibold border border-[#1E2A44] text-[#94A3B8] hover:text-[#F8FAFC] transition"
                >
                  Huỷ
                </button>
                <button
                  onClick={() => confirmStart(previewExam)}
                  className="flex-1 py-3 rounded-xl font-jakarta text-[13px] font-bold text-[#0A0E1A] hover:opacity-90 transition"
                  style={{ background: '#F2A20C' }}
                >
                  Bắt đầu thi
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
