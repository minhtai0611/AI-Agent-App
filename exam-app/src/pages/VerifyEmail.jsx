import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { emailVerify } from '../api/aiClient'
import { useAuth } from '../context/AuthContext'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const [status, setStatus] = useState('loading') // loading | success | error
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const token = params.get('token')
    if (!token) { setStatus('error'); setErrorMsg('Đường dẫn không hợp lệ.'); return }

    emailVerify(token).then(({ data, error }) => {
      if (error || !data) {
        setStatus('error')
        setErrorMsg(
          error === 'invalid_or_expired_token'
            ? 'Đường dẫn xác minh đã hết hạn hoặc đã được sử dụng.'
            : 'Xác minh thất bại. Vui lòng thử lại.'
        )
      } else {
        setStatus('success')
        refreshUser?.()
        setTimeout(() => navigate('/exams', { replace: true }), 2500)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="bg-surface border border-border rounded-2xl p-10 flex flex-col items-center gap-5 w-full max-w-sm shadow-xl text-center">
        {status === 'loading' && (
          <>
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="font-sans text-[14px] text-muted">Đang xác minh tài khoản…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <span className="text-4xl">✅</span>
            <p className="font-sans text-[16px] font-semibold text-foreground">Tài khoản đã được xác minh!</p>
            <p className="font-sans text-[13px] text-dim">Đang chuyển hướng đến trang bài thi…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <span className="text-4xl">❌</span>
            <p className="font-sans text-[16px] font-semibold text-foreground">Xác minh thất bại</p>
            <p className="font-sans text-[13px] text-dim">{errorMsg}</p>
            <button onClick={() => navigate('/', { replace: true })}
              className="mt-2 font-sans text-[13px] text-primary hover:underline">
              Về trang chủ
            </button>
          </>
        )}
      </div>
    </div>
  )
}
