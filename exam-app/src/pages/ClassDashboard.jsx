import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext.jsx'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { listClasses, createClass, joinClass, getClassResults } from '../api/aiClient.js'
import { useToast } from '../context/ToastContext.jsx'

export default function ClassDashboard() {
  usePageMeta('Lớp học', { noindex: true })
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedClass, setSelectedClass] = useState(null)
  const [classResults, setClassResults] = useState([])
  const [loadingResults, setLoadingResults] = useState(false)
  const [createName, setCreateName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (!user) { navigate('/'); return }
    listClasses().then(({ data, error }) => {
      if (!error && data) setClasses(data)
      setLoading(false)
    })
  }, [user, navigate])

  async function handleCreate(e) {
    e.preventDefault()
    if (!createName.trim()) return
    setCreating(true)
    const { data, error } = await createClass(createName.trim())
    setCreating(false)
    if (error) { toast.error(typeof error === 'string' ? error : 'Tạo lớp thất bại'); return }
    setClasses(prev => [data, ...prev])
    setCreateName('')
    toast.success('Đã tạo lớp học')
  }

  async function handleJoin(e) {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoining(true)
    const { data, error } = await joinClass(joinCode.trim().toUpperCase())
    setJoining(false)
    if (error) { toast.error(typeof error === 'string' ? error : 'Mã lớp không hợp lệ'); return }
    setClasses(prev => [data, ...prev])
    setJoinCode('')
    toast.success('Đã tham gia lớp học')
  }

  async function handleSelectClass(cls) {
    setSelectedClass(cls)
    if (cls.teacher_id === user?.id) {
      setLoadingResults(true)
      const { data } = await getClassResults(cls.id)
      setClassResults(data ?? [])
      setLoadingResults(false)
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-[#0A0E1A] px-4 py-10 max-w-3xl mx-auto flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <span className="font-fraunces text-[28px] font-bold text-[#F8FAFC]">Lớp học</span>
        <span className="font-jakarta text-[14px] text-[#64748B]">Tạo hoặc tham gia lớp học</span>
      </div>

      {/* Create class */}
      <div className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-6 flex flex-col gap-4">
        <span className="font-jakarta text-[13px] font-semibold text-[#94A3B8] uppercase tracking-wider">Tạo lớp mới (giáo viên)</span>
        <form onSubmit={handleCreate} className="flex gap-3">
          <input
            value={createName}
            onChange={e => setCreateName(e.target.value)}
            placeholder="Tên lớp học..."
            maxLength={60}
            className="flex-1 bg-[#141D2E] border border-[#2A3A5E] rounded-lg px-4 py-2.5 font-jakarta text-[14px] text-[#F8FAFC] placeholder-[#3A4A6E] focus:outline-none focus:border-[#F2A20C55]"
          />
          <button
            type="submit"
            disabled={creating || !createName.trim()}
            className="px-5 py-2.5 rounded-lg font-jakarta text-[13px] font-bold text-[#0A0E1A] bg-[#F2A20C] disabled:opacity-50 transition"
          >
            {creating ? '...' : 'Tạo'}
          </button>
        </form>
      </div>

      {/* Join class */}
      <div className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-6 flex flex-col gap-4">
        <span className="font-jakarta text-[13px] font-semibold text-[#94A3B8] uppercase tracking-wider">Tham gia lớp (học sinh)</span>
        <form onSubmit={handleJoin} className="flex gap-3">
          <input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Nhập mã lớp..."
            maxLength={20}
            className="flex-1 bg-[#141D2E] border border-[#2A3A5E] rounded-lg px-4 py-2.5 font-jakarta text-[14px] text-[#F8FAFC] placeholder-[#3A4A6E] focus:outline-none focus:border-[#6366F155] font-mono tracking-widest"
          />
          <button
            type="submit"
            disabled={joining || !joinCode.trim()}
            className="px-5 py-2.5 rounded-lg font-jakarta text-[13px] font-bold text-[#F8FAFC] bg-[#6366F1] disabled:opacity-50 transition"
          >
            {joining ? '...' : 'Vào lớp'}
          </button>
        </form>
      </div>

      {/* Class list */}
      <div className="flex flex-col gap-3">
        <span className="font-jakarta text-[13px] font-semibold text-[#94A3B8] uppercase tracking-wider">Lớp của bạn</span>
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2].map(i => (
              <div key={i} className="h-16 rounded-2xl bg-[#0D1221] border border-[#1E2A44] animate-pulse" />
            ))}
          </div>
        ) : classes.length === 0 ? (
          <p className="font-jakarta text-[13px] text-[#475569] text-center py-8">Bạn chưa tham gia lớp nào</p>
        ) : (
          classes.map(cls => (
            <motion.button
              key={cls.id}
              whileHover={{ scale: 1.01 }}
              onClick={() => handleSelectClass(cls)}
              className="flex items-center justify-between px-6 py-4 rounded-2xl border border-[#1E2A44] bg-[#0D1221] hover:border-[#2A3A5E] transition text-left"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-jakarta text-[15px] font-semibold text-[#F8FAFC]">{cls.name}</span>
                <span className="font-mono text-[12px] text-[#6366F1]">{cls.code}</span>
              </div>
              <div className="flex items-center gap-2">
                {cls.teacher_id === user?.id && (
                  <span className="font-jakarta text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400">GIÁO VIÊN</span>
                )}
                <span className="text-[#2A3A5E] text-lg">›</span>
              </div>
            </motion.button>
          ))
        )}
      </div>

      {/* Class results panel (teacher only) */}
      {selectedClass && selectedClass.teacher_id === user?.id && (
        <div className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="font-jakarta text-[15px] font-semibold text-[#F8FAFC]">Kết quả — {selectedClass.name}</span>
            <button onClick={() => setSelectedClass(null)} className="font-jakarta text-[12px] text-[#64748B] hover:text-[#94A3B8]">Đóng</button>
          </div>
          {loadingResults ? (
            <div className="h-20 rounded-xl bg-[#141D2E] animate-pulse" />
          ) : classResults.length === 0 ? (
            <p className="font-jakarta text-[13px] text-[#475569] text-center py-6">Chưa có học sinh nào nộp bài</p>
          ) : (
            <>
            {/* Mobile card view */}
            <div className="sm:hidden flex flex-col gap-2">
              {classResults.map((r, i) => (
                <div key={i} className="bg-[#141D2E] border border-[#1E2A44] rounded-xl p-4 flex flex-col gap-1">
                  <span className="font-jakarta text-[13px] font-semibold text-[#F0F4FF] truncate">{r.student_name ?? r.student_email ?? '—'}</span>
                  <span className="font-jakarta text-[12px] text-[#64748B] truncate">{r.exam_id}</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-jakarta text-[13px] font-bold" style={{ color: r.score >= 8 ? '#10B981' : r.score >= 5 ? '#F2A20C' : '#FB7185' }}>
                      {typeof r.score === 'number' ? r.score.toFixed(1) : '—'}
                    </span>
                    <span className="font-jakarta text-[11px] text-[#475569]">{r.finished_at ? new Date(r.finished_at).toLocaleDateString('vi-VN') : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full font-jakarta text-[13px]">
                <thead>
                  <tr className="text-[#475569] border-b border-[#1E2A44]">
                    <th className="text-left pb-3 pr-4">Học sinh</th>
                    <th className="text-left pb-3 pr-4">Đề thi</th>
                    <th className="text-right pb-3 pr-4">Điểm</th>
                    <th className="text-right pb-3">Ngày</th>
                  </tr>
                </thead>
                <tbody>
                  {classResults.map((r, i) => (
                    <tr key={i} className="border-b border-[#0F1828] last:border-0">
                      <td className="py-3 pr-4 text-[#94A3B8]">{r.student_name ?? r.student_email ?? '—'}</td>
                      <td className="py-3 pr-4 text-[#64748B] max-w-[160px] truncate">{r.exam_id}</td>
                      <td className="py-3 pr-4 text-right font-semibold" style={{ color: r.score >= 8 ? '#10B981' : r.score >= 5 ? '#F2A20C' : '#FB7185' }}>
                        {typeof r.score === 'number' ? r.score.toFixed(1) : '—'}
                      </td>
                      <td className="py-3 text-right text-[#475569]">{r.finished_at ? new Date(r.finished_at).toLocaleDateString('vi-VN') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
