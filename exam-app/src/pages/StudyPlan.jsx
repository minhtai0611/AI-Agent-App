import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useHistory } from '../context/HistoryContext.jsx'
import { generateStudyPlan } from '../api/aiClient.js'
import { buildStudyPlanPayload } from '../api/index.js'

const STORAGE_KEY = (resultId) => `study-plan-progress-${resultId}`
const PLAN_CACHE_KEY = (resultId) => `study-plan-data-${resultId}`

function ProgressDots({ tasks, checked, onToggle }) {
  return (
    <div className="flex flex-col gap-2.5 mt-3">
      {tasks.map((task, i) => (
        <label key={i} className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={!!checked[i]}
            onChange={() => onToggle(i)}
            className="mt-0.5 flex-shrink-0 accent-[#F2A20C]"
          />
          <span className={`font-jakarta text-[13px] leading-relaxed transition ${checked[i] ? 'line-through text-[#475569]' : 'text-[#94A3B8] group-hover:text-[#F8FAFC]'}`}>
            {task}
          </span>
        </label>
      ))}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      <div className="h-8 w-48 bg-[#111827] rounded" />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-9 w-20 bg-[#111827] rounded-lg" />)}
      </div>
      <div className="h-40 bg-[#0D1221] border border-[#1E2A44] rounded-2xl" />
    </div>
  )
}

export default function StudyPlan() {
  const navigate = useNavigate()
  const { resultId } = useParams()
  const location = useLocation()
  const { results } = useHistory()
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeWeek, setActiveWeek] = useState(0)
  const [progress, setProgress] = useState({}) // { weekIndex: { taskIndex: bool } }

  const result = location.state?.result || results.find(r => r.id === resultId)
  const history = location.state?.history || results.filter(r => r.id !== resultId)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY(resultId))
    if (saved) setProgress(JSON.parse(saved))
  }, [resultId])

  useEffect(() => {
    if (!result) return

    // Return cached plan immediately if available
    const cacheKey = PLAN_CACHE_KEY(resultId)
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      setPlan(JSON.parse(cached))
      setLoading(false)
      return
    }

    setLoading(true)
    generateStudyPlan(buildStudyPlanPayload(result, history)).then(({ data, error: err }) => {
      setLoading(false)
      if (data) {
        localStorage.setItem(cacheKey, JSON.stringify(data))
        setPlan(data)
      } else {
        setError(true)
      }
    })
  }, [resultId]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleTask(weekIdx, taskIdx) {
    setProgress(prev => {
      const next = {
        ...prev,
        [weekIdx]: { ...prev[weekIdx], [taskIdx]: !prev[weekIdx]?.[taskIdx] },
      }
      localStorage.setItem(STORAGE_KEY(resultId), JSON.stringify(next))
      return next
    })
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center gap-4">
        <p className="font-jakarta text-[#94A3B8]">Không tìm thấy kết quả</p>
        <button onClick={() => navigate('/history')} className="font-jakarta text-sm text-[#F2A20C] underline">
          Xem lịch sử
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex flex-col">
      {/* NavBar */}
      <nav className="flex items-center justify-between px-8 bg-[#0D1221] border-b border-[#1E2A44]" style={{ height: 64 }}>
        <button
          onClick={() => navigate(-1)}
          className="font-jakarta text-[13px] text-[#94A3B8] hover:text-[#F8FAFC] transition"
        >
          ← Quay lại
        </button>
        <span className="font-jakarta text-[14px] font-semibold text-[#F8FAFC]">Kế hoạch học tập</span>
        <div className="w-20" />
      </nav>

      <div className="flex flex-col gap-7 max-w-2xl mx-auto w-full px-4 py-10">
        {loading ? (
          <Skeleton />
        ) : error ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <p className="font-jakarta text-[#94A3B8]">Không thể tạo kế hoạch học tập</p>
            <button
              onClick={() => { setError(false); setLoading(true); generateStudyPlan(buildStudyPlanPayload(result, history)).then(({ data }) => { setLoading(false); if (data) setPlan(data); else setError(true) }) }}
              className="px-5 py-2.5 rounded-xl font-jakarta text-[13px] font-semibold text-[#0A0E1A]"
              style={{ background: 'linear-gradient(180deg, #F2A20C 0%, #D97706 100%)' }}
            >
              Thử lại
            </button>
          </div>
        ) : plan ? (
          <>
            {/* Overview */}
            <div className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-7">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[#F2A20C]">✦</span>
                <span className="font-fraunces text-[16px] font-semibold text-[#F8FAFC]">Tổng quan</span>
              </div>
              <div className="font-jakarta text-[13px] text-[#94A3B8] leading-relaxed whitespace-pre-wrap">
                {plan.plan}
              </div>
            </div>

            {/* Week tabs */}
            <div className="flex gap-2 flex-wrap">
              {plan.weekly_schedule.map((w, i) => (
                <button
                  key={i}
                  onClick={() => setActiveWeek(i)}
                  className={`px-4 py-2 rounded-lg font-jakarta text-[12px] font-semibold transition ${
                    activeWeek === i
                      ? 'text-[#0A0E1A]'
                      : 'bg-[#111827] border border-[#1E2A44] text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                  style={activeWeek === i ? { background: 'linear-gradient(180deg, #F2A20C 0%, #D97706 100%)' } : {}}
                >
                  Tuần {w.week}
                </button>
              ))}
            </div>

            {/* Active week */}
            {plan.weekly_schedule[activeWeek] && (() => {
              const w = plan.weekly_schedule[activeWeek]
              const weekProgress = progress[activeWeek] || {}
              const done = w.tasks.filter((_, i) => weekProgress[i]).length
              return (
                <div className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-7">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-fraunces text-[16px] font-semibold text-[#F8FAFC]">
                      Tuần {w.week}: {w.focus}
                    </span>
                    <span className="font-jakarta text-[12px] text-[#475569]">{done}/{w.tasks.length}</span>
                  </div>
                  <div className="h-1 bg-[#1E2A44] rounded-full mb-4">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(done / w.tasks.length) * 100}%`, background: 'linear-gradient(90deg, #F2A20C, #10B981)' }}
                    />
                  </div>
                  <ProgressDots
                    tasks={w.tasks}
                    checked={weekProgress}
                    onToggle={(taskIdx) => toggleTask(activeWeek, taskIdx)}
                  />
                </div>
              )
            })()}
          </>
        ) : null}
      </div>
    </div>
  )
}
