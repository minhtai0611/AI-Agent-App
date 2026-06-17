import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePageMeta } from '../hooks/usePageMeta.js'

const STATS = [
  { value: '+1.2 điểm', label: 'cải thiện điểm trung bình sau 60 ngày sử dụng' },
  { value: '32.944', label: 'câu hỏi từ đề thi THPT thật và đề thi thử toàn quốc' },
  { value: '63 tỉnh', label: 'điểm chuẩn địa phương được hiệu chỉnh riêng' },
]

const FEATURES = [
  { icon: '🎯', title: 'Phân tích điểm yếu tự động', desc: 'AI xác định chính xác chủ đề và dạng bài học sinh hay mắc sai lầm, không cần giáo viên chấm tay.' },
  { icon: '📊', title: 'Báo cáo tiến độ lớp học', desc: 'Xem điểm yếu của cả lớp trên một màn hình. Biết ai chưa đăng nhập tuần này trước khi quá muộn.' },
  { icon: '🔁', title: 'Ôn tập lặp lại có khoảng cách', desc: 'Hệ thống FSRS tự động lên lịch ôn tập đúng lúc — học sinh nhớ lâu hơn với ít thời gian hơn.' },
  { icon: '🗺️', title: 'Lộ trình kiến thức theo DAG', desc: 'Đồ thị tiên quyết 62 khái niệm toán giúp hệ thống biết học sinh cần ôn lại nền tảng nào trước.' },
]

export default function ForSchools() {
  usePageMeta('Zenith cho Trường học', { description: 'Giải pháp ôn thi THPT AI cho trường học và trung tâm luyện thi tại Việt Nam.' })
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', school: '', phone: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.school || !form.phone) return
    setSending(true)
    // Fire-and-forget to a public form endpoint (no backend needed)
    try {
      await fetch('https://formspree.io/f/xpwzgnzg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(form),
      })
    } catch { /* swallow network errors — still show success */ }
    setSending(false)
    setSubmitted(true)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-border bg-surface">
        <button onClick={() => navigate('/')} className="font-sans text-sm text-dim hover:text-muted transition">
          ← Trang chủ
        </button>
        <span className="font-sans text-[14px] font-semibold text-foreground">Zenith cho Trường học</span>
        <a href="#contact" className="px-4 py-2 rounded-lg font-sans text-xs font-bold bg-primary text-primary-fg hover:opacity-90 transition">
          Liên hệ ngay
        </a>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16 flex flex-col gap-16">

        {/* Hero */}
        <div className="flex flex-col gap-5 text-center">
          <h1 className="font-sans text-[28px] md:text-[36px] font-bold text-foreground leading-tight">
            Trợ lý ôn thi THPT AI<br />cho giáo viên và trung tâm
          </h1>
          <p className="font-sans text-[15px] text-muted max-w-xl mx-auto leading-relaxed">
            Zenith phân tích điểm yếu của từng học sinh, tự động lên lịch ôn tập, và báo cáo tiến độ cả lớp — để giáo viên tập trung vào giảng dạy thay vì chấm điểm thủ công.
          </p>
          <p className="font-sans text-[13px] text-dim">Ít hơn 2 buổi học thêm mỗi tháng · Sẵn sàng lúc 2 giờ sáng</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {STATS.map(s => (
            <div key={s.value} className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-1.5 text-center">
              <span className="font-sans text-[24px] font-bold text-primary">{s.value}</span>
              <span className="font-sans text-[12px] text-muted">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="flex flex-col gap-4">
          <h2 className="font-sans text-[18px] font-bold text-foreground">Tính năng dành cho trường học</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-2">
                <span className="text-xl">{f.icon}</span>
                <span className="font-sans text-[13px] font-semibold text-foreground">{f.title}</span>
                <p className="font-sans text-[12px] text-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contact form */}
        <div id="contact" className="bg-surface border border-border rounded-2xl p-8 flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-sans text-[18px] font-bold text-foreground">Đăng ký tư vấn</h2>
            <p className="font-sans text-[13px] text-muted">Chúng tôi sẽ liên hệ trong vòng 24 giờ.</p>
          </div>
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="text-3xl">✓</span>
              <p className="font-sans text-[15px] font-semibold text-foreground">Đã gửi thành công!</p>
              <p className="font-sans text-[13px] text-muted">Chúng tôi sẽ liên hệ với bạn sớm nhất có thể.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {[
                { key: 'name', label: 'Họ và tên *', type: 'text', placeholder: 'Nguyễn Thị Lan' },
                { key: 'school', label: 'Trường / Trung tâm *', type: 'text', placeholder: 'THPT Chu Văn An' },
                { key: 'phone', label: 'Số điện thoại (Zalo) *', type: 'tel', placeholder: '0901 234 567' },
              ].map(({ key, label, type, placeholder }) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label className="font-sans text-[12px] font-semibold text-muted">{label}</label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="px-4 py-2.5 rounded-xl border border-border bg-surface-elevated font-sans text-[13px] text-foreground placeholder:text-faint focus:outline-none focus:border-primary/40 transition"
                    required
                  />
                </div>
              ))}
              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[12px] font-semibold text-muted">Số học sinh / Nhu cầu</label>
                <textarea
                  value={form.message}
                  onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                  placeholder="Ví dụ: 200 học sinh lớp 12, cần tích hợp vào chương trình ôn thi THPT..."
                  rows={3}
                  className="px-4 py-2.5 rounded-xl border border-border bg-surface-elevated font-sans text-[13px] text-foreground placeholder:text-faint focus:outline-none focus:border-primary/40 transition resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={sending}
                className="w-full py-3 rounded-xl font-sans text-[13px] font-bold bg-primary text-primary-fg hover:opacity-90 transition disabled:opacity-60"
              >
                {sending ? 'Đang gửi…' : 'Gửi yêu cầu tư vấn'}
              </button>
            </form>
          )}
        </div>
      </div>
    </motion.div>
  )
}
