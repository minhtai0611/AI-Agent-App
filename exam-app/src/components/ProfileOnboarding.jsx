import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { Button } from './ui/button.jsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog.jsx'
import { Progress } from './ui/progress.jsx'

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
    <Dialog open>
      <DialogContent className="max-w-md [&>button:last-child]:hidden">
        <DialogHeader className="gap-2">
          <DialogTitle className="font-sans font-bold text-[22px]">Hoàn thiện hồ sơ</DialogTitle>
          <DialogDescription className="font-sans text-[0.8125rem] text-dim">
            Để cá nhân hóa đề thi và phân tích AI phù hợp với bạn
          </DialogDescription>
          <Progress value={grade ? 100 : 0} className="h-1 mt-1" />
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-2">
          <div className="flex flex-col gap-2">
            <label className="font-sans text-[0.8125rem] font-semibold text-muted">Lớp học <span className="text-destructive">*</span></label>
            <p className="font-sans text-[13px] text-dim text-center mb-2">
              Để Vantage hiển thị đúng đề thi cho cấp độ của bạn
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

          <Button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-3 font-bold text-sm"
          >
            {saving ? 'Đang lưu...' : 'Bắt đầu →'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
