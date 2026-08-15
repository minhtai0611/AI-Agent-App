import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function VerifyEmail() {
  const navigate = useNavigate()

  useEffect(() => {
    const id = setTimeout(() => navigate('/', { replace: true }), 2500)
    return () => clearTimeout(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="bg-surface border border-border rounded-2xl p-10 flex flex-col items-center gap-5 w-full max-w-sm shadow-xl text-center">
        <span className="text-4xl">✅</span>
        <p className="font-sans text-[16px] font-semibold text-foreground">Tài khoản của bạn không cần xác minh.</p>
        <p className="font-sans text-[13px] text-dim">Đang chuyển hướng…</p>
      </div>
    </div>
  )
}
