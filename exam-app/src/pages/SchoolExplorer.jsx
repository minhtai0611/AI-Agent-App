import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { getSchoolsByProvince } from '../api/index.js'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { motion } from 'framer-motion'

const PROVINCES = [
  'Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ',
  'An Giang', 'Bà Rịa-Vũng Tàu', 'Bắc Giang', 'Bắc Kạn', 'Bạc Liêu',
  'Bắc Ninh', 'Bến Tre', 'Bình Định', 'Bình Dương', 'Bình Phước',
  'Bình Thuận', 'Cà Mau', 'Cao Bằng', 'Đắk Lắk', 'Đắk Nông',
  'Điện Biên', 'Đồng Nai', 'Đồng Tháp', 'Gia Lai', 'Hà Giang',
  'Hà Nam', 'Hà Tĩnh', 'Hải Dương', 'Hậu Giang', 'Hòa Bình',
  'Hưng Yên', 'Khánh Hòa', 'Kiên Giang', 'Kon Tum', 'Lai Châu',
  'Lâm Đồng', 'Lạng Sơn', 'Lào Cai', 'Long An', 'Nam Định',
  'Nghệ An', 'Ninh Bình', 'Ninh Thuận', 'Phú Thọ', 'Phú Yên',
  'Quảng Bình', 'Quảng Nam', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị',
  'Sóc Trăng', 'Sơn La', 'Tây Ninh', 'Thái Bình', 'Thái Nguyên',
  'Thanh Hóa', 'Thừa Thiên Huế', 'Tiền Giang', 'Trà Vinh', 'Tuyên Quang',
  'Vĩnh Long', 'Vĩnh Phúc', 'Yên Bái',
]

function cutoffColor(score) {
  if (score === null) return 'var(--dim)'
  if (score >= 9) return '#10B981'
  if (score >= 7) return '#F2A20C'
  return '#64748B'
}

export default function SchoolExplorer() {
  usePageMeta('Tra cứu điểm chuẩn trường THPT', {
    description: 'Xem điểm chuẩn toán THPT các trường theo tỉnh/thành và so sánh với điểm của bạn.',
  })
  const navigate = useNavigate()
  const { user } = useAuth()

  const [province, setProvince] = useState(user?.province || '')
  const [scoreInput, setScoreInput] = useState('')
  const [search, setSearch] = useState('')

  const schools = useMemo(() => {
    if (!province) return []
    return getSchoolsByProvince(province).sort((a, b) => {
      const ca = a.cutoff ?? -1
      const cb = b.cutoff ?? -1
      return cb - ca
    })
  }, [province])

  const filtered = useMemo(() => {
    if (!search) return schools
    const q = search.toLowerCase()
    return schools.filter(s => s.name?.toLowerCase().includes(q))
  }, [schools, search])

  const score = parseFloat(scoreInput)
  const hasScore = !isNaN(score) && score >= 0 && score <= 10

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
      className="min-h-screen bg-surface px-4 pt-12 pb-16">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <button onClick={() => navigate(-1)}
          className="self-start font-sans text-sm text-dim hover:text-muted transition flex items-center gap-1.5">
          ← Quay lại
        </button>

        <div>
          <h1 className="font-sans text-[28px] font-bold text-foreground leading-tight">Tra cứu điểm chuẩn</h1>
          <p className="font-sans text-[14px] text-dim mt-1">
            Chọn tỉnh/thành để xem điểm chuẩn môn Toán các trường THPT.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={province}
            onChange={e => { setProvince(e.target.value); setSearch('') }}
            className="flex-1 rounded-xl border border-surface bg-surface font-sans text-[14px] text-foreground px-4 py-2.5 outline-none focus:border-info transition"
          >
            <option value="">— Chọn tỉnh/thành —</option>
            {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <input
            type="number"
            min="0" max="10" step="0.1"
            value={scoreInput}
            onChange={e => setScoreInput(e.target.value)}
            placeholder="Điểm của bạn (0–10)"
            className="w-full sm:w-44 rounded-xl border border-surface bg-surface font-sans text-[14px] text-foreground px-4 py-2.5 outline-none focus:border-info transition"
          />
        </div>

        {province && (
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm tên trường…"
            className="rounded-xl border border-surface bg-surface font-sans text-[14px] text-foreground px-4 py-2.5 outline-none focus:border-info transition"
          />
        )}

        {/* Score legend */}
        {hasScore && schools.length > 0 && (
          <div className="flex items-center gap-2 font-sans text-[12px] text-dim px-1">
            <span className="w-2 h-2 rounded-full bg-success shrink-0" />
            Trường nằm trong tầm điểm của bạn (±1.5 điểm)
          </div>
        )}

        {/* School list */}
        {province && filtered.length === 0 && (
          <p className="font-sans text-[13px] text-dim text-center py-8">
            {search ? 'Không tìm thấy trường phù hợp.' : 'Không có dữ liệu cho tỉnh này.'}
          </p>
        )}

        {filtered.length > 0 && (
          <div className="flex flex-col gap-2">
            {filtered.map((school, i) => {
              const inRange = hasScore && school.cutoff !== null && Math.abs(score - school.cutoff) <= 1.5
              return (
                <div key={i}
                  className="rounded-xl border px-4 py-3 flex items-center justify-between gap-3 transition"
                  style={{
                    borderColor: inRange ? 'var(--primary-border)' : 'var(--border)',
                    background: inRange ? 'var(--primary-subtle)' : 'transparent',
                  }}>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-sans text-[14px] font-semibold text-foreground truncate">
                      {school.name}
                    </span>
                    <span className="font-sans text-[11px] text-dim">{school.province}</span>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-0.5">
                    {school.cutoff !== null ? (
                      <>
                        <span className="font-sans text-[18px] font-bold" style={{ color: cutoffColor(school.cutoff) }}>
                          {school.cutoff.toFixed(1)}
                        </span>
                        <span className="font-sans text-[10px] text-dim">điểm chuẩn</span>
                      </>
                    ) : (
                      <span className="font-sans text-[12px] text-dim">Chưa có</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!province && (
          <div className="rounded-xl border border-surface bg-surface p-8 text-center">
            <p className="font-sans text-[13px] text-dim">Chọn tỉnh/thành để xem danh sách trường.</p>
            {user?.province && (
              <button
                onClick={() => setProvince(user.province)}
                className="mt-3 font-sans text-[13px] font-semibold text-primary hover:underline">
                Dùng tỉnh của tôi ({user.province})
              </button>
            )}
          </div>
        )}

        <p className="font-sans text-[11px] text-dim text-center">
          Dữ liệu điểm chuẩn toán dựa trên kỳ tuyển sinh THPT gần nhất.
        </p>
      </div>
    </motion.div>
  )
}
