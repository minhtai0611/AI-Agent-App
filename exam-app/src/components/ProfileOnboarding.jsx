import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'

import { useAuth } from '../context/AuthContext.jsx'
import { acceptTos } from '../api/aiClient.js'
import { PROVINCES } from '../data/provinces.js'
import { loadSchools } from '../api/index.js'

const GRADES = [
  { value: '9', label: 'Lớp 9 trở xuống', sub: 'Thi vào lớp 10' },
  { value: '10', label: 'Lớp 10', sub: 'Học sinh THPT' },
  { value: '11', label: 'Lớp 11', sub: 'Học sinh THPT' },
  { value: '12', label: 'Lớp 12', sub: 'Chuẩn bị thi THPT' },
]

const SCHOOL_TYPES = [
  { value: 'chuyên', label: 'Trường chuyên' },
  { value: 'công lập', label: 'Trường công lập' },
  { value: 'quốc tế', label: 'Trường quốc tế' },
]

const TOS_CONTENT = [
  'Dịch vụ cung cấp đề thi và phân tích AI cho mục đích học tập cá nhân.',
  'Tài khoản chỉ dành cho một người sử dụng — không chia sẻ hoặc chuyển nhượng.',
  'Nội dung đề thi thuộc bản quyền của nhà cung cấp — không sao chép hay phân phối.',
  'Chúng tôi có quyền đình chỉ tài khoản vi phạm điều khoản sử dụng.',
]

const PRIVACY_CONTENT = [
  'Chúng tôi thu thập email, tên và ảnh đại diện từ Google để xác thực tài khoản.',
  'Lịch sử thi và kết quả được lưu để cá nhân hóa phân tích AI của bạn.',
  'Dữ liệu của bạn không được bán hoặc chia sẻ với bên thứ ba.',
  'Bạn có thể yêu cầu xóa tài khoản và toàn bộ dữ liệu bất kỳ lúc nào.',
]

function LegalModal({ title, items, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-surface border border-border rounded-2xl p-6 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="font-sans font-bold text-[16px] font-bold text-foreground">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="text-dim hover:text-foreground text-lg leading-none"
            aria-label="Đóng"
          >×</button>
        </div>
        <ul className="flex flex-col gap-2.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
              <span className="font-sans text-xs text-muted leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="self-end px-4 py-2 rounded-lg font-sans text-xs font-semibold bg-primary text-background"
        >
          Đã hiểu
        </button>
      </div>
    </div>
  )
}

export default function ProfileOnboarding({ onDone }) {
  const { updateProfile } = useAuth()
  const [grade, setGrade] = useState('')
  const [province, setProvince] = useState('')
  const [schoolType, setSchoolType] = useState('')
  const [targetSchool, setTargetSchool] = useState('')
  const [tosAccepted, setTosAccepted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeModal, setActiveModal] = useState(null)

  const provinceSuggestions = useMemo(() => {
    if (!province) return []
    return loadSchools()
      .filter(s => s.province === province)
      .map(s => s.name)
      .slice(0, 8)
  }, [province])

  const canSubmit = grade && province && tosAccepted && !saving

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError('')
    try {
      await updateProfile({
        grade,
        province,
        school_type: schoolType || undefined,
        target_school: targetSchool || undefined,
      })
      await acceptTos()
      onDone?.()
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', stiffness: 340, damping: 28 }}
          className="w-full max-w-md bg-surface border border-border rounded-2xl p-8 flex flex-col gap-6"
        >
          <div className="flex flex-col gap-1">
            <span className="font-sans font-bold text-[22px] font-bold text-foreground">Hoàn thiện hồ sơ</span>
            <span className="font-sans text-[0.8125rem] text-dim">Để cá nhân hóa đề thi và phân tích AI phù hợp với bạn</span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Grade */}
            <div className="flex flex-col gap-2">
              <label className="font-sans text-[0.8125rem] font-semibold text-muted">Lớp học <span className="text-red-400">*</span></label>
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

            {/* Province */}
            <div className="flex flex-col gap-2">
              <label className="font-sans text-[0.8125rem] font-semibold text-muted">Tỉnh / Thành phố <span className="text-red-400">*</span></label>
              <select
                value={province}
                onChange={e => setProvince(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border bg-surface-elevated font-sans text-[0.8125rem] text-foreground focus:outline-none focus:border-primary appearance-none"
              >
                <option value="">Chọn tỉnh / thành phố...</option>
                {PROVINCES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Target school (optional, province-filtered suggestions) */}
            <div className="flex flex-col gap-2">
              <label className="font-sans text-[0.8125rem] font-semibold text-muted">Trường mục tiêu <span className="text-faint font-normal">(tùy chọn)</span></label>
              <input
                type="text"
                value={targetSchool}
                onChange={e => setTargetSchool(e.target.value)}
                placeholder="Ví dụ: THPT Chuyên Lê Hồng Phong"
                className="w-full px-4 py-3 rounded-xl border border-border bg-surface-elevated font-sans text-[0.8125rem] text-foreground focus:outline-none focus:border-primary placeholder:text-faint"
              />
              {provinceSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {provinceSuggestions.map(name => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setTargetSchool(name)}
                      className={`px-3 py-1 rounded-full font-sans text-[0.6875rem] border transition ${
                        targetSchool === name
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-surface text-dim hover:border-primary/40'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* School type (optional) */}
            <div className="flex flex-col gap-2">
              <label className="font-sans text-[0.8125rem] font-semibold text-muted">Loại trường <span className="text-faint font-normal">(tùy chọn)</span></label>
              <div className="flex gap-2">
                {SCHOOL_TYPES.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSchoolType(prev => prev === s.value ? '' : s.value)}
                    className={`flex-1 py-2.5 rounded-xl border transition font-sans text-xs font-medium ${
                      schoolType === s.value
                        ? 'border-info bg-info/5 text-info'
                        : 'border-border bg-surface-elevated text-dim hover:border-primary/30'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ToS */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={tosAccepted}
                onChange={e => setTosAccepted(e.target.checked)}
                className="mt-0.5 accent-[#166534] w-4 h-4 flex-shrink-0"
              />
              <span className="font-sans text-xs text-dim">
                Tôi đồng ý với{' '}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setActiveModal('tos') }}
                  className="text-[var(--primary)] underline underline-offset-2 hover:text-[var(--accent)]"
                >
                  Điều khoản sử dụng
                </button>
                {' '}và{' '}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setActiveModal('privacy') }}
                  className="text-[var(--primary)] underline underline-offset-2 hover:text-[var(--accent)]"
                >
                  Chính sách bảo mật
                </button>
                {' '}của dịch vụ
              </span>
            </label>

            {error && (
              <p className="font-sans text-xs text-red-400">{error}</p>
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
              {saving ? 'Đang lưu...' : 'Bắt đầu học'}
            </button>
          </form>
        </motion.div>
      </div>

      {activeModal === 'tos' && (
        <LegalModal
          title="Điều khoản sử dụng"
          items={TOS_CONTENT}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'privacy' && (
        <LegalModal
          title="Chính sách bảo mật"
          items={PRIVACY_CONTENT}
          onClose={() => setActiveModal(null)}
        />
      )}
    </>
  )
}
