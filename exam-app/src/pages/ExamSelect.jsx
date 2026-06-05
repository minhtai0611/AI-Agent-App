import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useExamDispatch } from '../context/ExamContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useHistory } from '../context/HistoryContext.jsx'
import { loadExams, loadThiThuExams, loadQuestionsByIds, loadExamById, getAccessibleExamIds } from '../api/index.js'
import { ocrExam } from '../api/aiClient.js'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants, viewNavigate } from '../utils/animations.js'
import AmbientGlows from '../components/AmbientGlows.jsx'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { buildBriefing } from '../utils/examBriefing.js'

const listVariants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}
const cardVariants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
}
const hoverProps = {
  whileHover: { scale: 1.015 },
  whileTap:   { scale: 0.98 },
  transition: { type: 'spring', stiffness: 400, damping: 25 },
}

const GROUPS = {
  timed: [
    { category: 'grade10', label: 'Thi vào lớp 10', description: 'Đề thi tuyển sinh THCS lên THPT', accent: '#3B82F6', tag: 'Lớp 10' },
    { category: 'thpt', label: 'Thi THPT Quốc gia', description: 'Đề thi & thi thử tốt nghiệp THPT', accent: '#F2A20C', tag: 'THPT' },
  ],
  practice: [
    { category: 'grade10', label: 'Luyện tập vào lớp 10', description: 'Đề thi tuyển sinh quốc tế — Ghana BECE & Ấn Độ CBSE', accent: '#3B82F6', tag: 'Lớp 10' },
    { category: 'thpt', label: 'Luyện tập THPT & Đại học', description: 'SAT, ACT, A-Level, AMC 12, HSC Úc, Singapore H2 & nhiều đề quốc tế khác', accent: '#F2A20C', tag: 'THPT' },
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

function getAllowedCategories() {
  return ['grade10', 'thpt']
}

export default function ExamSelect({ onOpenAuth }) {
  usePageMeta('Chọn đề thi', { description: 'Đề thi THPT & lớp 10 từ 63 tỉnh thành · Luyện tập toán có thời gian · Công cụ Lab AI.' })
  const navigate = useNavigate()
  const dispatch = useExamDispatch()
  const { user } = useAuth()
  const { results } = useHistory()
  const [searchParams] = useSearchParams()
  const urlMode = searchParams.get('mode')
  const [mode, setMode] = useState(
    ['practice', 'lab'].includes(urlMode) ? urlMode : 'timed'
  )
  const [previewExam, setPreviewExam] = useState(null)
  const [expandedCategories, setExpandedCategories] = useState({})

  const saved = loadSavedFilters()
  const [filterYear, setFilterYear] = useState(saved.year ?? null)
  const [filterSearch, setFilterSearch] = useState(saved.search ?? '')
  const [allExams, setAllExams] = useState([])
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrError, setOcrError] = useState('')
  const [ocrQuestions, setOcrQuestions] = useState(null)
  const ocrInputRef = useRef(null)

  useEffect(() => {
    if (mode === 'lab') { setAllExams([]); return }
    const fn = mode === 'timed' ? loadThiThuExams : loadExams
    fn().then(data => setAllExams(data))
  }, [mode])

  const mistakeCount = useMemo(() => {
    const seen = new Set()
    for (const r of results) {
      for (const qId of Object.keys(r.answers ?? {})) seen.add(qId)
    }
    return seen.size
  }, [results])

  const { accessible: accessibleExamIds, prerequisites: examPrerequisites } = useMemo(
    () => getAccessibleExamIds(results, allExams),
    [results, allExams]
  )

  const bestScores = useMemo(() => {
    const map = {}
    for (const r of results) {
      if (map[r.examId] === undefined || r.score > map[r.examId]) map[r.examId] = r.score
    }
    return map
  }, [results])

  const availableYears = [...new Set(allExams.map(e => e.year).filter(Boolean))].sort((a, b) => b - a)

  const exams = useMemo(() => {
    const filtered = allExams.filter(e => {
      if (filterYear && e.year !== filterYear) return false
      if (filterSearch.trim()) {
        const q = filterSearch.toLowerCase()
        return (e.title || '').toLowerCase().includes(q) || String(e.year).includes(q) || (e.source || '').toLowerCase().includes(q)
      }
      return true
    })

    // Province moat: sort province-matching exams to the top when user has a province set
    const province = user?.province
    if (!province || filterSearch.trim()) return filtered
    const pLower = province.toLowerCase()
    return [...filtered].sort((a, b) => {
      const aMatch = (a.title || '').toLowerCase().includes(pLower) || (a.source || '').toLowerCase().includes(pLower)
      const bMatch = (b.title || '').toLowerCase().includes(pLower) || (b.source || '').toLowerCase().includes(pLower)
      if (aMatch && !bMatch) return -1
      if (!aMatch && bMatch) return 1
      return 0
    })
  }, [allExams, filterYear, filterSearch, user?.province])

  function setYear(y) {
    setFilterYear(y)
    saveFilters({ year: y, search: filterSearch })
  }
  function setSearch(s) {
    setFilterSearch(s)
    saveFilters({ year: filterYear, search: s })
  }

  async function handleOcrUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setOcrError('Ảnh quá lớn — tối đa 5 MB'); return }
    setOcrLoading(true)
    setOcrError('')
    setOcrQuestions(null)
    const { data, error } = await ocrExam(file)
    setOcrLoading(false)
    if (error) { setOcrError(typeof error === 'string' ? error : 'Không đọc được ảnh — thử lại với ảnh rõ hơn'); return }
    if (!data?.questions?.length) { setOcrError('Không tìm thấy câu hỏi nào trong ảnh'); return }
    setOcrQuestions(data.questions)
    e.target.value = ''
  }

  function startOcrExam() {
    if (!ocrQuestions?.length) return
    const fakeExam = {
      id: `ocr-${Date.now()}`,
      title: 'Đề thi từ ảnh',
      questionIds: ocrQuestions.map(q => q.id),
      duration: Math.ceil(ocrQuestions.length * 1.5),
      source: 'ocr',
    }
    dispatch({ type: 'START_EXAM', exam: fakeExam, questions: ocrQuestions, mode: 'practice' })
    navigate(`/test/${fakeExam.id}`)
  }

  const allowedCategories = getAllowedCategories()

  const motivationalHeader = useMemo(() => {
    if (!results || results.length === 0) return 'Bắt đầu với một đề thi phù hợp với trình độ của bạn.'
    const sorted = [...results].sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))
    const last = sorted[0]
    const bestByExam = {}
    for (const r of results) {
      if (!bestByExam[r.examId] || r.score > bestByExam[r.examId]) bestByExam[r.examId] = r.score
    }
    const personalBest = Math.max(...Object.values(bestByExam))
    const recentBestExamId = Object.entries(bestByExam).find(([, s]) => s === personalBest)?.[0]
    if (recentBestExamId && last.examId === recentBestExamId && results.filter(r => r.examId === recentBestExamId).length >= 2) {
      return `Bạn vừa đạt kỷ lục ${personalBest} điểm — hãy thử thách tiếp!`
    }
    const lastTitle = loadExamById(last.examId)?.title ?? null
    return lastTitle ? `Chào mừng trở lại! Tiếp tục từ ${lastTitle} →` : 'Chào mừng trở lại! Chọn một đề thi để tiếp tục.'
  }, [results])

  async function handleStart(exam) {
    if (!user) {
      const trialUsed = localStorage.getItem(TRIAL_KEY)
      if (trialUsed) {
        onOpenAuth?.()
        return
      }
      localStorage.setItem(TRIAL_KEY, '1')
    }
    const questions = await loadQuestionsByIds(exam.questionIds, !!user)
    dispatch({ type: 'START_EXAM', exam, questions, mode: mode === 'timed' ? 'timed' : 'practice' })
    viewNavigate(navigate, `/test/${exam.id}`)
  }

  const groups = GROUPS[mode] ?? []

  function openPreview(exam) { setPreviewExam(exam) }
  function closePreview() { setPreviewExam(null) }
  function confirmStart(exam) { closePreview(); handleStart(exam) }

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show" exit="exit"
      className="min-h-screen bg-[#0A0E1A] flex flex-col relative overflow-hidden">
      <AmbientGlows className="fixed inset-0 z-0 pointer-events-none" />
      {/* Nav */}
      <nav className="flex items-center justify-between px-10 py-4 bg-[#0D1521] border-b border-[#1E2D45]">
        <button onClick={() => navigate('/')} className="font-jakarta text-sm text-[#64748B] hover:text-[#94A3B8] transition">
          ← Trang chủ
        </button>
        <div className="flex items-center gap-1 bg-[#1A2440] rounded-full p-1">
          {[
            { value: 'timed',    label: 'Có thời gian' },
            { value: 'practice', label: 'Luyện tập' },
            { value: 'lab',      label: '⚗ Lab' },
          ].map(opt => (
            <button key={opt.value} onClick={() => setMode(opt.value)}
              className={`px-3 py-2 rounded-full font-jakarta text-[12px] transition ${
                mode === opt.value
                  ? opt.value === 'lab'
                    ? 'bg-[#818CF8] text-white font-semibold'
                    : 'bg-[#F2A20C] text-[#0A0E1A] font-semibold'
                  : 'text-[#94A3B8]'
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

      {/* Filter bar — hidden in Lab mode */}
      <div className={`flex flex-wrap items-center gap-3 px-10 pt-6${mode === 'lab' ? ' hidden' : ''}`}>
        <input
          type="search"
          placeholder="Tìm đề thi..."
          value={filterSearch}
          onChange={e => setSearch(e.target.value)}
          className="h-9 px-4 rounded-full border border-[#1E2A44] bg-[#111827] font-jakarta text-[13px] text-[#F0F4FF] placeholder-[#475569] focus:outline-none focus:border-[#F2A20C] w-48"
        />
        {/* OCR upload */}
        {user && (
          <>
            <input ref={ocrInputRef} type="file" accept="image/*" className="hidden" onChange={handleOcrUpload} />
            <button
              onClick={() => ocrInputRef.current?.click()}
              disabled={ocrLoading}
              className="h-9 px-4 rounded-full border border-[#6366F144] bg-[#6366F111] font-jakarta text-[12px] font-semibold text-[#818CF8] hover:border-[#6366F188] transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {ocrLoading ? <><span className="animate-spin">⟳</span> Đang đọc...</> : <>📷 Tải ảnh đề thi</>}
            </button>
          </>
        )}
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

      {/* OCR result panel */}
      {(ocrError || ocrQuestions) && (
        <div className="mx-10 mt-4 px-5 py-4 rounded-xl flex items-center justify-between gap-4"
          style={{ background: ocrError ? '#1A0808' : '#0A1A10', border: `1px solid ${ocrError ? '#EF444440' : '#10B98140'}` }}>
          {ocrError ? (
            <span className="font-jakarta text-[13px] text-red-400">{ocrError}</span>
          ) : (
            <>
              <span className="font-jakarta text-[13px] text-emerald-400">
                ✓ Đọc được <strong>{ocrQuestions.length}</strong> câu hỏi từ ảnh
              </span>
              <button
                onClick={startOcrExam}
                className="px-5 py-2 rounded-lg font-jakarta text-[13px] font-bold text-[#0A0E1A] bg-[#10B981] hover:opacity-90 transition flex-shrink-0"
              >
                Bắt đầu luyện tập →
              </button>
            </>
          )}
          <button onClick={() => { setOcrError(''); setOcrQuestions(null) }}
            className="text-[#475569] hover:text-[#94A3B8] text-lg flex-shrink-0">✕</button>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col gap-10 p-10">
        <div className="flex flex-col gap-2">
          <h1 className="font-fraunces text-[36px] font-bold text-[#F8FAFC]">Chọn đề thi</h1>
          <p className="font-jakarta text-[14px] text-[#64748B]">{motivationalHeader}</p>
        </div>

        {/* ── ⚗ Lab mode ──────────────────────────────────────────────────── */}
        {mode === 'lab' && (
          <motion.div key="lab" variants={listVariants} initial="hidden" animate="show"
            className="flex flex-col gap-6">

            <div className="flex flex-col gap-1">
              <span className="font-jakarta text-[11px] font-bold tracking-[3px] uppercase text-[#475569]">Công cụ thực nghiệm</span>
              <p className="font-jakarta text-[13px] text-[#475569]">AI-powered tools — khác với đề thi thật, dùng để khám phá và thực nghiệm</p>
            </div>

            {/* Hero: Oracle */}
            <motion.button variants={cardVariants}
              onClick={() => navigate('/oracle')}
              className="w-full text-left rounded-2xl p-6 flex items-center justify-between gap-4 border transition relative overflow-hidden"
              style={{ borderColor: '#6366F144', background: 'linear-gradient(135deg, #0D1521 50%, #130d2a 100%)' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#6366F188'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#6366F144'}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✦</span>
                  <span className="font-jakarta text-[17px] font-bold text-[#F8FAFC]">Toán Oracle</span>
                  <span className="font-jakarta text-[10px] font-bold tracking-[2px] uppercase px-2 py-0.5 rounded"
                    style={{ background: '#6366F122', color: '#818CF8' }}>Oracle AI</span>
                </div>
                <span className="font-jakarta text-[13px] text-[#64748B] leading-relaxed max-w-sm">
                  Nhập bất kỳ bài toán nào — Oracle giải từng bước chi tiết và chấm bài của bạn
                </span>
              </div>
              <span className="font-jakarta text-[13px] font-semibold flex-shrink-0" style={{ color: '#818CF8' }}>Mở Oracle →</span>
            </motion.button>

            {/* Grid: secondary tools */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {user?.subscription_tier === 'complete' && (
                <motion.button variants={cardVariants}
                  onClick={() => navigate('/generate-exam')}
                  className="text-left rounded-2xl p-5 flex flex-col gap-3 border transition"
                  style={{ borderColor: '#F2A20C33', background: 'linear-gradient(135deg, #0D1521 60%, #1a120a 100%)' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#F2A20C66'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#F2A20C33'}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl">✦</span>
                    <span className="font-jakarta text-[10px] font-bold tracking-[2px] uppercase px-2 py-0.5 rounded"
                      style={{ background: '#F2A20C22', color: '#F2A20C' }}>Toàn diện</span>
                  </div>
                  <div>
                    <p className="font-jakarta text-[14px] font-semibold text-[#F8FAFC]">Tạo đề riêng</p>
                    <p className="font-jakarta text-[12px] text-[#64748B] mt-0.5">AI tạo đề theo chủ đề & độ khó bạn chọn</p>
                  </div>
                  <span className="font-jakarta text-[12px] font-semibold mt-auto" style={{ color: '#F2A20C' }}>Tạo đề →</span>
                </motion.button>
              )}

              {/* Lab feature cards */}
              {[
                { label: 'Bản đồ khái niệm', desc: 'Visualize mối liên hệ giữa các chủ đề Toán', path: '/concept-map', accent: '#818CF8' },
                { label: 'Phân tích lỗi sai', desc: 'AI phân tích pattern lỗi trong toàn bộ lịch sử thi', path: '/error-analysis', accent: '#FB7185' },
              ].map(({ label, desc, path, accent }) => (
                <motion.button key={label}
                  onClick={() => navigate(path)}
                  className="rounded-2xl p-5 border border-[#1E2A44] flex flex-col gap-2 text-left transition hover:border-[#2A3A50] hover:bg-[#111827]"
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <p className="font-jakarta text-[14px] font-semibold text-[#F8FAFC]">{label}</p>
                  <p className="font-jakarta text-[12px] text-[#64748B]">{desc}</p>
                  <span className="font-jakarta text-[12px] font-semibold mt-auto transition" style={{ color: accent }}>Mở →</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Exam list: timed / practice / applied / olympiad ─────────────── */}
        {mode !== 'lab' && (
          <motion.div
            className="flex flex-col gap-10"
            key={mode}
            variants={listVariants}
            initial="hidden"
            animate="show"
          >
          {groups.map(group => {
            const categoryAllowed = !allowedCategories || allowedCategories.includes(group.category)
            const groupExams = exams.filter(e => e.category === group.category)
            const groupKey = group.category
            if (groupExams.length === 0) return null
            return (
              <motion.section key={groupKey + mode} variants={cardVariants}>
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
                ) : (() => {
                  const SHOW_FIRST = 5
                  const isExpanded = !!expandedCategories[groupKey + mode]
                  const visibleExams = isExpanded ? groupExams : groupExams.slice(0, SHOW_FIRST)
                  const hiddenCount = groupExams.length - SHOW_FIRST
                  return (
                    <div className="flex flex-col gap-3">
                      {visibleExams.map(exam => {
                        const isLocked = !accessibleExamIds.has(exam.id)
                        const prereqId = examPrerequisites[exam.id]
                        const prereqExam = prereqId ? allExams.find(e => e.id === prereqId) : null
                        const prereqScore = prereqId != null ? (bestScores[prereqId] ?? null) : null
                        const scoreGap = prereqScore !== null ? Math.max(0, 5.0 - prereqScore).toFixed(1) : null
                        const encouragement = prereqScore === null
                          ? `Hãy bắt đầu với đề ${prereqExam?.year ?? ''} trước nhé!`
                          : prereqScore < 3
                            ? `Ôn thêm một chút, bạn sắp mở được đề này rồi!`
                            : `Gần rồi! Cần thêm ${scoreGap} điểm nữa.`

                        if (isLocked) {
                          return (
                            <motion.div
                              key={exam.id}
                              variants={cardVariants}
                              className="rounded-xl px-6 py-5 flex flex-col gap-3 opacity-60"
                              style={{ background: '#0A0E1A', border: '1px solid #1E2A44' }}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex flex-col gap-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[#64748B]">🔒</span>
                                    <span className="font-jakarta text-[15px] font-semibold text-[#64748B]">{exam.title}</span>
                                  </div>
                                  <span className="font-jakarta text-[13px] text-[#475569]">
                                    {exam.year} · {exam.totalQuestions} câu · {exam.duration} phút
                                  </span>
                                </div>
                                {prereqExam && (
                                  <button
                                    onClick={() => openPreview(prereqExam)}
                                    className="flex-shrink-0 px-4 py-2 rounded-md font-jakarta text-[12px] font-semibold transition"
                                    style={{ background: 'transparent', border: '1px solid #2A3A5E', color: '#64748B' }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = group.accent; e.currentTarget.style.color = group.accent }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A3A5E'; e.currentTarget.style.color = '#64748B' }}
                                  >
                                    Làm đề {prereqExam.year} →
                                  </button>
                                )}
                              </div>
                              <div className="flex flex-col gap-1.5 pt-1 border-t border-[#1E2A44]">
                                <span className="font-jakarta text-[12px] text-[#475569]">
                                  Yêu cầu: đề {prereqExam?.year ?? ''} đạt ≥ 5.0 điểm
                                </span>
                                {prereqScore !== null && (
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 rounded-full bg-[#1E2A44] overflow-hidden">
                                      <div
                                        className="h-full rounded-full transition-all"
                                        style={{ width: `${Math.min(100, (prereqScore / 5.0) * 100)}%`, background: prereqScore >= 5.0 ? '#10B981' : group.accent }}
                                      />
                                    </div>
                                    <span className="font-mono text-[11px] text-[#64748B]">{prereqScore.toFixed(1)} / 5.0</span>
                                  </div>
                                )}
                                <span className="font-jakarta text-[11px] text-[#475569] italic">{encouragement}</span>
                              </div>
                            </motion.div>
                          )
                        }

                        return (
                          <motion.div
                            key={exam.id}
                            variants={cardVariants}
                            {...hoverProps}
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
                        )
                      })}
                      {!isExpanded && hiddenCount > 0 && (
                        <button
                          onClick={() => setExpandedCategories(prev => ({ ...prev, [groupKey + mode]: true }))}
                          className="font-jakarta text-[13px] text-center py-2.5 rounded-xl border border-dashed border-[#1E2A44] text-[#475569] hover:text-[#94A3B8] hover:border-[#2A3A5E] transition">
                          + Xem thêm ({hiddenCount} đề)
                        </button>
                      )}
                    </div>
                  )
                })()}
              </motion.section>
            )
          })}
          </motion.div>
        )}

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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
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
              {/* Pre-exam briefing — only shown when user has history */}
              {(() => {
                if (!results || results.length === 0) return null
                const briefing = buildBriefing(results, previewExam)
                if (!briefing) return null
                return (
                  <div className="rounded-xl bg-[#0A1628] border border-[#1E3A5E] px-4 py-3.5 flex flex-col gap-2">
                    <span className="font-jakarta text-[11px] font-bold text-[#3B82F6] uppercase tracking-wider">Chuẩn bị trước khi thi</span>
                    <p className="font-jakarta text-[13px] text-[#94A3B8] leading-relaxed">{briefing.message}</p>
                    <div className="flex flex-wrap gap-1.5 mt-0.5">
                      {briefing.weakTopics.map(w => (
                        <span key={w.topic} className="px-2.5 py-1 rounded-full bg-[#2A0F14] border border-[#5A1A24] font-jakarta text-[11px] text-[#FB7185]">
                          {w.label} · {w.accuracy}%
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })()}
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
    </motion.div>
  )
}
