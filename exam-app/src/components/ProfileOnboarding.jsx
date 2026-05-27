import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext.jsx'
import { acceptTos } from '../api/aiClient.js'

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

const PROVINCES = [
  'An Giang', 'Bà Rịa - Vũng Tàu', 'Bắc Giang', 'Bắc Kạn', 'Bạc Liêu',
  'Bắc Ninh', 'Bến Tre', 'Bình Định', 'Bình Dương', 'Bình Phước',
  'Bình Thuận', 'Cà Mau', 'Cao Bằng', 'Cần Thơ', 'Đà Nẵng',
  'Đắk Lắk', 'Đắk Nông', 'Điện Biên', 'Đồng Nai', 'Đồng Tháp',
  'Gia Lai', 'Hà Giang', 'Hà Nam', 'Hà Nội', 'Hà Tĩnh',
  'Hải Dương', 'Hải Phòng', 'Hậu Giang', 'Hòa Bình', 'Hưng Yên',
  'Khánh Hòa', 'Kiên Giang', 'Kon Tum', 'Lai Châu', 'Lâm Đồng',
  'Lạng Sơn', 'Lào Cai', 'Long An', 'Nam Định', 'Nghệ An',
  'Ninh Bình', 'Ninh Thuận', 'Phú Thọ', 'Phú Yên', 'Quảng Bình',
  'Quảng Nam', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị', 'Sóc Trăng',
  'Sơn La', 'Tây Ninh', 'Thái Bình', 'Thái Nguyên', 'Thanh Hóa',
  'Thừa Thiên Huế', 'Tiền Giang', 'TP. Hồ Chí Minh', 'Trà Vinh', 'Tuyên Quang',
  'Vĩnh Long', 'Vĩnh Phúc', 'Yên Bái',
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
        className="w-full max-w-sm bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-6 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="font-fraunces text-[16px] font-bold text-[#F8FAFC]">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="text-[#64748B] hover:text-[#F8FAFC] text-lg leading-none"
            aria-label="Đóng"
          >×</button>
        </div>
        <ul className="flex flex-col gap-2.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#F2A20C] flex-shrink-0" />
              <span className="font-jakarta text-[12px] text-[#94A3B8] leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="self-end px-4 py-2 rounded-lg font-jakarta text-[12px] font-semibold text-[#0A0E1A]"
          style={{ background: '#F2A20C' }}
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
  const [tosAccepted, setTosAccepted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeModal, setActiveModal] = useState(null)

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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0E1A]/90 backdrop-blur-sm px-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-md bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-8 flex flex-col gap-6"
        >
          <div className="flex flex-col gap-1">
            <span className="font-fraunces text-[22px] font-bold text-[#F8FAFC]">Hoàn thiện hồ sơ</span>
            <span className="font-jakarta text-[13px] text-[#64748B]">Để cá nhân hóa đề thi và phân tích AI phù hợp với bạn</span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Grade */}
            <div className="flex flex-col gap-2">
              <label className="font-jakarta text-[13px] font-semibold text-[#94A3B8]">Lớp học <span className="text-red-400">*</span></label>
              <div className="grid grid-cols-2 gap-2">
                {GRADES.map(g => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setGrade(g.value)}
                    className={`flex flex-col items-start px-4 py-3 rounded-xl border transition text-left ${
                      grade === g.value
                        ? 'border-[#F2A20C] bg-[#F2A20C11]'
                        : 'border-[#1E2A44] bg-[#111827] hover:border-[#2A3A50]'
                    }`}
                  >
                    <span className={`font-jakarta text-[13px] font-semibold ${grade === g.value ? 'text-[#F2A20C]' : 'text-[#F0F4FF]'}`}>{g.label}</span>
                    <span className="font-jakarta text-[11px] text-[#475569]">{g.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Province */}
            <div className="flex flex-col gap-2">
              <label className="font-jakarta text-[13px] font-semibold text-[#94A3B8]">Tỉnh / Thành phố <span className="text-red-400">*</span></label>
              <select
                value={province}
                onChange={e => setProvince(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#1E2A44] bg-[#111827] font-jakarta text-[13px] text-[#F0F4FF] focus:outline-none focus:border-[#F2A20C] appearance-none"
              >
                <option value="">Chọn tỉnh / thành phố...</option>
                {PROVINCES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* School type (optional) */}
            <div className="flex flex-col gap-2">
              <label className="font-jakarta text-[13px] font-semibold text-[#94A3B8]">Loại trường <span className="text-[#475569] font-normal">(tùy chọn)</span></label>
              <div className="flex gap-2">
                {SCHOOL_TYPES.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSchoolType(prev => prev === s.value ? '' : s.value)}
                    className={`flex-1 py-2.5 rounded-xl border transition font-jakarta text-[12px] font-medium ${
                      schoolType === s.value
                        ? 'border-[#3B82F6] bg-[#3B82F611] text-[#3B82F6]'
                        : 'border-[#1E2A44] bg-[#111827] text-[#64748B] hover:border-[#2A3A50]'
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
                className="mt-0.5 accent-amber-400 w-4 h-4 flex-shrink-0"
              />
              <span className="font-jakarta text-[12px] text-[#64748B]">
                Tôi đồng ý với{' '}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setActiveModal('tos') }}
                  className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
                >
                  Điều khoản sử dụng
                </button>
                {' '}và{' '}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setActiveModal('privacy') }}
                  className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
                >
                  Chính sách bảo mật
                </button>
                {' '}của dịch vụ
              </span>
            </label>

            {error && (
              <p className="font-jakarta text-[12px] text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3 rounded-xl font-jakarta text-[14px] font-bold transition"
              style={{
                background: canSubmit ? 'linear-gradient(180deg, #F2A20C 0%, #D97706 100%)' : '#1E2A44',
                color: canSubmit ? '#0A0E1A' : '#475569',
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
