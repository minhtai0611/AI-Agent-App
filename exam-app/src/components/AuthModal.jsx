import { useEffect, useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../context/AuthContext'
import { emailForgot, emailResendVerify } from '../api/aiClient'
import { Input } from './ui/input.jsx'
import { Button } from './ui/button.jsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog.jsx'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs.jsx'
import { Label } from './ui/label.jsx'

// Password strength: returns 0–4
function calcStrength(pw) {
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[!@#$%^&*()\-_=+\[\]{}|;:'",.<>?/`~]/.test(pw)) score++
  return score
}

const STRENGTH_LABELS = ['', 'Yếu', 'Trung bình', 'Mạnh', 'Rất mạnh']
const STRENGTH_COLORS = ['', 'var(--destructive)', 'var(--warning)', 'var(--success)', 'var(--primary)']

function PasswordStrengthBar({ password }) {
  const strength = calcStrength(password)
  if (!password) return null
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-1 flex-1 rounded-full transition-colors"
            style={{ background: i <= strength ? STRENGTH_COLORS[strength] : 'var(--border)' }} />
        ))}
      </div>
      <span className="font-sans text-[10px]" style={{ color: STRENGTH_COLORS[strength] }}>
        {STRENGTH_LABELS[strength]}
      </span>
    </div>
  )
}

export default function AuthModal({ open, onClose }) {
  const { login, emailLogin, emailRegister } = useAuth()
  const [tab, setTab] = useState('google')          // 'google' | 'email'
  const [emailMode, setEmailMode] = useState('login') // 'login' | 'register' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  // Reset state on open/close
  useEffect(() => {
    if (open) {
      setTab('google'); setEmailMode('login'); setEmail(''); setPassword('')
      setConfirmPw(''); setError(null); setLoading(false); setRegistered(false); setForgotSent(false)
    }
  }, [open])

  async function handleGoogleSuccess(credentialResponse) {
    setError(null); setLoading(true)
    try { await login(credentialResponse.credential); onClose() }
    catch (err) { setError(err.message || 'Đăng nhập thất bại.') }
    finally { setLoading(false) }
  }

  async function handleEmailSubmit(e) {
    e.preventDefault()
    setError(null); setLoading(true)
    try {
      if (emailMode === 'login') {
        await emailLogin(email, password)
        onClose()
      } else if (emailMode === 'register') {
        if (password !== confirmPw) { setError('Mật khẩu xác nhận không khớp.'); return }
        if (calcStrength(password) < 2) { setError('Mật khẩu quá yếu. Cần chữ hoa, số và ký tự đặc biệt.'); return }
        await emailRegister(email, password)
        setRegistered(true)
      } else if (emailMode === 'forgot') {
        await emailForgot(email)
        setForgotSent(true)
      }
    } catch (err) {
      const code = err.message
      if (code === 'email_taken') setError('Email này đã được đăng ký.')
      else if (code === 'email_google_only') setError('Email này dùng đăng nhập Google. Nhấn tab Google để đăng nhập.')
      else if (code === 'invalid_credentials') setError('Email hoặc mật khẩu không đúng.')
      else if (code === 'email_not_verified') setError('Tài khoản chưa được xác minh. Kiểm tra hộp thư đến.')
      else if (code === 'password_too_weak') setError('Mật khẩu quá yếu.')
      else if (code === 'too_many_attempts') setError('Quá nhiều lần thử. Vui lòng đợi vài phút.')
      else setError(err.message || 'Đã xảy ra lỗi. Thử lại sau.')
    } finally { setLoading(false) }
  }

  function switchMode(mode) { setEmailMode(mode); setError(null); setRegistered(false); setForgotSent(false) }

  const title = tab === 'google'
    ? 'Đăng nhập'
    : emailMode === 'register' ? 'Tạo tài khoản'
    : emailMode === 'forgot' ? 'Quên mật khẩu'
    : 'Đăng nhập'

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm bg-surface p-8 flex flex-col gap-5">
        <DialogHeader className="gap-1">
          <DialogTitle className="font-sans font-semibold text-foreground text-[17px]">{title}</DialogTitle>
          <DialogDescription className="font-sans text-dim text-[12px]">
            Lưu tiến trình và nhận phân tích AI cá nhân hóa.
          </DialogDescription>
        </DialogHeader>

        {/* Tab switcher */}
        <Tabs value={tab} onValueChange={v => { setTab(v); setError(null) }}>
          <TabsList className="w-full p-1 bg-background rounded-xl border border-border h-auto">
            <TabsTrigger
              value="google"
              className="flex-1 py-1.5 rounded-lg font-sans text-[12px] font-semibold data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=inactive]:text-dim hover:text-muted"
            >
              Google
            </TabsTrigger>
            <TabsTrigger
              value="email"
              className="flex-1 py-1.5 rounded-lg font-sans text-[12px] font-semibold data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=inactive]:text-dim hover:text-muted"
            >
              Email
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Google tab */}
        {tab === 'google' && (
          <div className="flex flex-col items-center gap-3">
            {loading ? (
              <span className="font-sans text-primary text-sm">Đang xử lý…</span>
            ) : (
              <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => {}} useOneTap={false} />
            )}
            {error && <p className="font-sans text-destructive text-[12px] text-center">{error}</p>}
          </div>
        )}

        {/* Email tab */}
        {tab === 'email' && (
          <>
            {/* Post-register success */}
            {registered ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <span className="text-3xl">✅</span>
                <p className="font-sans text-[13px] text-foreground text-center font-semibold">Kiểm tra email để xác minh tài khoản</p>
                <p className="font-sans text-[11px] text-dim text-center">Nhấn vào đường dẫn trong email từ Zenith để kích hoạt tài khoản.</p>
                <button onClick={() => emailResendVerify(email)}
                  className="font-sans text-[11px] text-primary hover:underline">Gửi lại email</button>
              </div>
            ) : forgotSent ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <span className="text-3xl">📧</span>
                <p className="font-sans text-[13px] text-foreground text-center font-semibold">Kiểm tra hộp thư đến</p>
                <p className="font-sans text-[11px] text-dim text-center">Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu.</p>
                <button onClick={() => switchMode('login')}
                  className="font-sans text-[11px] text-primary hover:underline">← Quay lại đăng nhập</button>
              </div>
            ) : (
              <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
                <div>
                  <Label htmlFor="auth-email" className="sr-only">Email</Label>
                  <Input id="auth-email" type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="Email" autoComplete="email"
                    className="h-auto py-2.5 px-3.5 rounded-xl bg-background font-sans text-[13px] placeholder:text-dim" />
                </div>

                {emailMode !== 'forgot' && (
                  <div>
                    <Label htmlFor="auth-password" className="sr-only">Mật khẩu</Label>
                    <Input id="auth-password" type="password" required value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Mật khẩu" autoComplete={emailMode === 'register' ? 'new-password' : 'current-password'}
                      className="h-auto py-2.5 px-3.5 rounded-xl bg-background font-sans text-[13px] placeholder:text-dim" />
                  </div>
                )}

                {emailMode === 'register' && (
                  <>
                    <PasswordStrengthBar password={password} />
                    <div>
                      <Label htmlFor="auth-confirm-password" className="sr-only">Xác nhận mật khẩu</Label>
                      <Input id="auth-confirm-password" type="password" required value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                        placeholder="Xác nhận mật khẩu" autoComplete="new-password"
                        className="h-auto py-2.5 px-3.5 rounded-xl bg-background font-sans text-[13px] placeholder:text-dim" />
                    </div>
                  </>
                )}

                {error && <p className="font-sans text-destructive text-[12px]">{error}</p>}

                <Button type="submit" disabled={loading} className="w-full font-bold text-[13px]">
                  {loading ? 'Đang xử lý…' : emailMode === 'register' ? 'Tạo tài khoản' : emailMode === 'forgot' ? 'Gửi link đặt lại' : 'Đăng nhập'}
                </Button>

                {/* Mode toggle links */}
                <div className="flex items-center justify-between pt-1">
                  {emailMode === 'login' ? (
                    <>
                      <button type="button" onClick={() => switchMode('forgot')}
                        className="font-sans text-[11px] text-dim hover:text-muted transition">Quên mật khẩu?</button>
                      <button type="button" onClick={() => switchMode('register')}
                        className="font-sans text-[11px] text-primary hover:underline">Tạo tài khoản →</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => switchMode('login')}
                      className="font-sans text-[11px] text-dim hover:text-muted transition mx-auto">← Đã có tài khoản</button>
                  )}
                </div>
              </form>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
