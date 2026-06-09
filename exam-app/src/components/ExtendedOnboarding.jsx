import { useState } from 'react'
import { motion } from 'framer-motion'
import { updateExtendedProfile } from '../api/aiClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const STAGE_LABELS = ['?', 'Sơ cấp', 'Đang học', 'Luyện tập', 'Vững', 'Thành thạo']

export default function ExtendedOnboarding({ onDone }) {
  const { refreshUser } = useAuth()
  const [targetSchool, setTargetSchool] = useState('')
  const [examDate, setExamDate] = useState('')
  const [weeklyHours, setWeeklyHours] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(skipAll = false) {
    setSaving(true)
    await updateExtendedProfile({
      target_school: skipAll ? undefined : (targetSchool.trim() || undefined),
      exam_date: skipAll ? undefined : (examDate || undefined),
      weekly_study_hours: skipAll ? undefined : (weeklyHours ? parseInt(weeklyHours) : undefined),
    })
    await refreshUser()
    setSaving(false)
    onDone?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/90 backdrop-blur-sm px-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-md bg-[#0D1221] border border-surface rounded-2xl p-8 flex flex-col gap-6"
      >
        <div className="flex flex-col gap-1">
          <span className="font-fraunces text-[20px] font-bold text-[#F8FAFC]">Một bước nữa thôi</span>
          <span className="font-jakarta text-[13px] text-dim">
            Giúp Zenith lên kế hoạch học phù hợp với mục tiêu của bạn. Có thể bỏ qua.
          </span>
        </div>

        <div className="flex flex-col gap-4">
          {/* Target school */}
          <div className="flex flex-col gap-1.5">
            <label className="font-jakarta text-[13px] font-semibold text-[#94A3B8]">
              Trường mục tiêu <span className="text-dim font-normal">(tùy chọn)</span>
            </label>
            <input
              type="text"
              value={targetSchool}
              onChange={e => setTargetSchool(e.target.value)}
              placeholder="VD: THPT Chuyên Lê Hồng Phong"
              maxLength={200}
              className="w-full px-4 py-3 rounded-xl border border-surface bg-[#111827] font-jakarta text-[13px] text-[#F0F4FF] placeholder-[#475569] focus:outline-none focus:border-[#F2A20C] transition"
            />
          </div>

          {/* Exam date */}
          <div className="flex flex-col gap-1.5">
            <label className="font-jakarta text-[13px] font-semibold text-[#94A3B8]">
              Ngày thi dự kiến <span className="text-dim font-normal">(tùy chọn)</span>
            </label>
            <input
              type="date"
              value={examDate}
              onChange={e => setExamDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-surface bg-[#111827] font-jakarta text-[13px] text-[#F0F4FF] focus:outline-none focus:border-[#F2A20C] transition"
              style={{ colorScheme: 'dark' }}
            />
          </div>

          {/* Weekly hours */}
          <div className="flex flex-col gap-1.5">
            <label className="font-jakarta text-[13px] font-semibold text-[#94A3B8]">
              Giờ học mỗi tuần <span className="text-dim font-normal">(tùy chọn)</span>
            </label>
            <div className="flex gap-2 flex-wrap">
              {[3, 5, 7, 10, 14].map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setWeeklyHours(h === parseInt(weeklyHours) ? '' : String(h))}
                  className={`px-4 py-2 rounded-xl border font-jakarta text-[12px] font-semibold transition ${
                    parseInt(weeklyHours) === h
                      ? 'border-[#F2A20C] bg-primary/10 text-primary'
                      : 'border-surface bg-[#111827] text-dim hover:border-primary/30 hover:text-[#94A3B8]'
                  }`}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-surface font-jakarta text-[13px] text-dim hover:text-[#94A3B8] hover:border-primary/30 transition"
          >
            Bỏ qua
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl font-jakarta text-[13px] font-bold text-[#0A0E1A] transition disabled:opacity-60"
            style={{ background: 'linear-gradient(180deg, #F2A20C 0%, #D97706 100%)' }}
          >
            {saving ? 'Đang lưu...' : 'Bắt đầu →'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
