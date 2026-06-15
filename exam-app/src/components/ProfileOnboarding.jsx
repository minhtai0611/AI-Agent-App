import { useState } from 'react'
import { motion } from 'framer-motion'

import { useAuth } from '../context/AuthContext.jsx'

const GRADES = [
  { value: '9', label: 'Lớp 9 trở xuống', sub: 'Thi vào lớp 10' },
  { value: '10', label: 'Lớp 10', sub: 'Học sinh THPT' },
  { value: '11', label: 'Lớp 11', sub: 'Học sinh THPT' },
  { value: '12', label: 'Lớp 12', sub: 'Chuẩn bị thi THPT' },
]

export default function ProfileOnboarding({ onDone }) {
  const { updateProfile } = useAuth()
  const [grade, setGrade] = useState('')
  const [province] = useState(() => localStorage.getItem('guest_province') || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = grade && !saving

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError('')
    try {
      await updateProfile({
        grade,
        ...(province ? { province } : {}),
      })
      onDone?.()
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="w-full max-w-md bg-surface border border-border rounded-2xl p-8 flex flex-col gap-6"
      >
        <div className="flex flex-col gap-1">
          <span className="font-sans font-bold text-[22px] text-foreground">Hoàn thiện hồ sơ</span>
          <span className="font-sans text-[0.8125rem] text-dim">Để cá nhân hóa đề thi và phân tích AI phù hợp với bạn</span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Grade */}
          <div className="flex flex-col gap-2">
            <label className="font-sans text-[0.8125rem] font-semibold text-muted">Lớp học <span className="text-destructive">*</span></label>
            <p className="font-sans text-[13px] text-dim text-center mb-4">
              Để Zenith hiển thị đúng đề thi cho cấp độ của bạn
            </p>
            <div className="grid grid-cols-2 gap-2">
              {GRADES.map(g => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGrade(g.value)}
                  className={`flex flex-col items-start px-4 py-3 rounded-xl border transition text-left ${
                    grade === g.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-surface-elevated hover:border-primary/30'
                  }`}
                >
                  <span className={`font-sans text-[0.8125rem] font-semibold ${grade === g.value ? 'text-primary' : 'text-foreground'}`}>{g.label}</span>
                  <span className="font-sans text-[0.6875rem] text-faint">{g.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="font-sans text-xs text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-3 rounded-xl font-sans text-sm font-bold transition"
            style={{
              background: canSubmit ? 'var(--primary)' : 'var(--border)',
              color: canSubmit ? 'var(--primary-fg)' : 'var(--fg-tertiary)',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {saving ? 'Đang lưu...' : 'Bắt đầu →'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
