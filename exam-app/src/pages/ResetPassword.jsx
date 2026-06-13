import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { emailReset } from '../api/aiClient'

function calcStrength(pw) {
  let s = 0
  if (pw.length >= 8) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[!@#$%^&*()\-_=+\[\]{}|;:'",.<>?/`~]/.test(pw)) s++
  return s
}
const STRENGTH_LABELS = ['', 'Yếu', 'Trung bình', 'Mạnh', 'Rất mạnh']
const STRENGTH_COLORS = ['', '#EF4444', '#F59E0B', '#22C55E', '#166534']

function PasswordStrengthBar({ password }) {
  const s = calcStrength(password)
  if (!password) return null
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-1 flex-1 rounded-full transition-colors"
            style={{ background: i <= s ? STRENGTH_COLORS[s] : 'var(--border)' }} />
        ))}
      </div>
      <span className="font-sans text-[10px]" style={{ color: STRENGTH_COLORS[s] }}>{STRENGTH_LABELS[s]}</span>
    </div>
  )
}

export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Mật khẩu xác nhận không khớp.'); return }
    if (calcStrength(password) < 2) { setError('Mật khẩu quá yếu. Cần chữ hoa, số và ký tự đặc biệt.'); return }
    setLoading(true)
    const { error: err } = await emailReset(token, password)
    setLoading(false)
    if (err) {
      setError(
        err === 'invalid_or_expired_token' ? 'Đường dẫn đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu lại.' :
        err === 'password_too_weak' ? 'Mật khẩu quá yếu.' :
        'Đặt lại mật khẩu thất bại. Vui lòng thử lại.'
      )
    } else {
      setDone(true)
      setTimeout(() => navigate('/', { replace: true }), 3000)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="bg-surface border border-border rounded-2xl p-10 flex flex-col items-center gap-4 w-full max-w-sm shadow-xl text-center">
          <span className="text-4xl">❌</span>
          <p className="font-sans text-[14px] text-muted">Đường dẫn không hợp lệ.</p>
          <button onClick={() => navigate('/')} className="font-sans text-[13px] text-primary hover:underline">Về trang chủ</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="bg-surface border border-border rounded-2xl p-8 flex flex-col gap-5 w-full max-w-sm shadow-xl">
        {done ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <span className="text-4xl">✅</span>
            <p className="font-sans text-[16px] font-semibold text-foreground">Mật khẩu đã được đặt lại!</p>
            <p className="font-sans text-[13px] text-dim">Đang chuyển hướng về trang chủ…</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <h1 className="font-sans font-semibold text-foreground text-[17px]">Đặt lại mật khẩu</h1>
              <p className="font-sans text-dim text-[12px]">Nhập mật khẩu mới cho tài khoản của bạn.</p>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Mật khẩu mới" autoComplete="new-password"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background font-sans text-[13px] text-foreground placeholder:text-dim focus:outline-none focus:border-primary transition" />
              <PasswordStrengthBar password={password} />
              <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Xác nhận mật khẩu" autoComplete="new-password"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background font-sans text-[13px] text-foreground placeholder:text-dim focus:outline-none focus:border-primary transition" />
              {error && <p className="font-sans text-destructive text-[12px]">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-xl font-sans text-[13px] font-bold bg-primary text-primary-fg hover:opacity-90 disabled:opacity-50 transition">
                {loading ? 'Đang xử lý…' : 'Đặt lại mật khẩu'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
