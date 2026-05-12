import { useEffect, useRef, useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../context/AuthContext'

export default function AuthModal({ open, onClose }) {
  const { login } = useAuth()
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const backdropRef = useRef(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Reset error when reopened
  useEffect(() => { if (open) setError(null) }, [open])

  if (!open) return null

  async function handleSuccess(credentialResponse) {
    setError(null)
    setLoading(true)
    try {
      await login(credentialResponse.credential)
      onClose()
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại, vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  function handleBackdropClick(e) {
    if (e.target === backdropRef.current) onClose()
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Đăng nhập"
    >
      <div
        className="relative rounded-xl p-8 flex flex-col items-center gap-5 w-80"
        style={{ background: '#0A0E1A', border: '1px solid #F2A20C' }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-gray-400 hover:text-white text-xl leading-none"
          aria-label="Đóng"
        >
          ×
        </button>

        <h2 className="text-white text-lg font-semibold">Đăng nhập</h2>
        <p className="text-gray-400 text-sm text-center">
          Lưu kết quả thi và theo dõi tiến trình học tập của bạn.
        </p>

        {loading ? (
          <div className="text-amber-400 text-sm">Đang xử lý…</div>
        ) : (
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => { /* user closed popup — no error shown */ }}
            useOneTap={false}
          />
        )}

        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}
      </div>
    </div>
  )
}
