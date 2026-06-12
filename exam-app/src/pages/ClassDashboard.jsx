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
    <div className="min-h-screen bg-surface px-4 py-10 max-w-3xl mx-auto flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <span className="font-sans text-[28px] font-bold text-foreground">Lớp học</span>
        <span className="font-sans text-[14px] text-dim">Tạo hoặc tham gia lớp học</span>
      </div>

      {/* Create class */}
      <div className="glass-base border border-surface rounded-2xl p-6 flex flex-col gap-4">
        <span className="font-sans text-[13px] font-semibold text-muted uppercase tracking-wider">Tạo lớp mới (giáo viên)</span>
        <form onSubmit={handleCreate} className="flex gap-3">
          <input
            value={createName}
            onChange={e => setCreateName(e.target.value)}
            placeholder="Tên lớp học..."
            maxLength={60}
            className="flex-1 bg-surface border border-surface rounded-lg px-4 py-2.5 font-sans text-[14px] text-foreground placeholder-faint focus:outline-none focus:border-primary/30"
          />
          <button
            type="submit"
            disabled={creating || !createName.trim()}
            className="px-5 py-2.5 rounded-lg font-sans text-[13px] font-bold text-background bg-primary disabled:opacity-50 transition"
          >
            {creating ? '...' : 'Tạo'}
          </button>
        </form>
      </div>

      {/* Join class */}
      <div className="glass-base border border-surface rounded-2xl p-6 flex flex-col gap-4">
        <span className="font-sans text-[13px] font-semibold text-muted uppercase tracking-wider">Tham gia lớp (học sinh)</span>
        <form onSubmit={handleJoin} className="flex gap-3">
          <input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Nhập mã lớp..."
            maxLength={20}
            className="flex-1 bg-surface border border-surface rounded-lg px-4 py-2.5 font-sans text-[14px] text-foreground placeholder-faint focus:outline-none focus:border-info/30 font-mono tracking-widest"
          />
          <button
            type="submit"
            disabled={joining || !joinCode.trim()}
            className="px-5 py-2.5 rounded-lg font-sans text-[13px] font-bold text-foreground bg-info disabled:opacity-50 transition"
          >
            {joining ? '...' : 'Vào lớp'}
          </button>
        </form>
      </div>

      {/* Class list */}
      <div className="flex flex-col gap-3">
        <span className="font-sans text-[13px] font-semibold text-muted uppercase tracking-wider">Lớp của bạn</span>
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2].map(i => (
              <div key={i} className="h-16 rounded-2xl glass-base border border-surface animate-pulse" />
            ))}
          </div>
        ) : classes.length === 0 ? (
          <p className="font-sans text-[13px] text-dim text-center py-8">Bạn chưa tham gia lớp nào</p>
        ) : (
          classes.map(cls => (
            <motion.button
              key={cls.id}
              whileHover={{ scale: 1.01 }}
              onClick={() => handleSelectClass(cls)}
              className="flex items-center justify-between px-6 py-4 rounded-2xl border border-surface glass-base hover:border-surface transition text-left"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-sans text-[15px] font-semibold text-foreground">{cls.name}</span>
                <span className="font-mono text-[12px] text-info">{cls.code}</span>
              </div>
              <div className="flex items-center gap-2">
                {cls.teacher_id === user?.id && (
                  <span className="font-sans text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)]">GIÁO VIÊN</span>
                )}
                <span className="text-faint text-lg">›</span>
              </div>
            </motion.button>
          ))
        )}
      </div>

      {/* Class results panel (teacher only) */}
      {selectedClass && selectedClass.teacher_id === user?.id && (
        <div className="glass-base border border-surface rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="font-sans text-[15px] font-semibold text-foreground">Kết quả — {selectedClass.name}</span>
            <button onClick={() => setSelectedClass(null)} className="font-sans text-[12px] text-dim hover:text-muted">Đóng</button>
          </div>
          {loadingResults ? (
            <div className="h-20 rounded-xl bg-surface animate-pulse" />
          ) : classResults.length === 0 ? (
            <p className="font-sans text-[13px] text-dim text-center py-6">Chưa có học sinh nào nộp bài</p>
          ) : (
            <>
            {/* Mobile card view */}
            <div className="sm:hidden flex flex-col gap-2">
              {classResults.map((r, i) => (
                <div key={i} className="bg-surface border border-surface rounded-xl p-4 flex flex-col gap-1">
                  <span className="font-sans text-[13px] font-semibold text-foreground truncate">{r.student_name ?? r.student_email ?? '—'}</span>
                  <span className="font-sans text-[12px] text-dim truncate">{r.exam_id}</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-sans text-[13px] font-bold" style={{ color: r.score >= 8 ? '#10B981' : r.score >= 5 ? '#F2A20C' : '#FB7185' }}>
                      {typeof r.score === 'number' ? r.score.toFixed(1) : '—'}
                    </span>
                    <span className="font-sans text-[11px] text-dim">{r.finished_at ? new Date(r.finished_at).toLocaleDateString('vi-VN') : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full font-sans text-[13px]">
                <thead>
                  <tr className="text-dim border-b border-surface">
                    <th className="text-left pb-3 pr-4">Học sinh</th>
                    <th className="text-left pb-3 pr-4">Đề thi</th>
                    <th className="text-right pb-3 pr-4">Điểm</th>
                    <th className="text-right pb-3">Ngày</th>
                  </tr>
                </thead>
                <tbody>
                  {classResults.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="py-3 pr-4 text-muted">{r.student_name ?? r.student_email ?? '—'}</td>
                      <td className="py-3 pr-4 text-dim max-w-[160px] truncate">{r.exam_id}</td>
                      <td className="py-3 pr-4 text-right font-semibold" style={{ color: r.score >= 8 ? '#10B981' : r.score >= 5 ? '#F2A20C' : '#FB7185' }}>
                        {typeof r.score === 'number' ? r.score.toFixed(1) : '—'}
                      </td>
                      <td className="py-3 text-right text-dim">{r.finished_at ? new Date(r.finished_at).toLocaleDateString('vi-VN') : '—'}</td>
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
