import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar({ onOpenAuth }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [avatarError, setAvatarError] = useState(false)

  function handleLogout() {
    logout()
    navigate('/')
  }

  function initials(name) {
    if (!name) return '?'
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4"
      style={{ height: 48, background: '#0A0E1A', borderBottom: '1px solid #1e2640' }}
    >
      <span
        className="text-amber-400 font-semibold text-sm cursor-pointer"
        onClick={() => navigate('/')}
      >
        ExamApp
      </span>

      <div className="flex items-center gap-3">
        {user ? (
          <>
            {/* Credits badge — tappable → /account */}
            <button
              onClick={() => navigate('/account')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#1E2A44] bg-[#111827] hover:border-amber-500/50 transition"
              title="AI Điểm"
            >
              <span className="text-amber-400 text-[11px]">⚡</span>
              <span className="font-jakarta text-[12px] font-semibold text-amber-400">
                {user.credits_balance ?? 0}
              </span>
            </button>

            {user.avatar_url && !avatarError ? (
              <img
                src={user.avatar_url}
                alt={user.display_name || 'Avatar'}
                onError={() => setAvatarError(true)}
                className="w-7 h-7 rounded-full object-cover cursor-pointer"
                onClick={() => navigate('/account')}
              />
            ) : (
              <div
                className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold text-black cursor-pointer"
                onClick={() => navigate('/account')}
              >
                {initials(user.display_name)}
              </div>
            )}
            <span
              className="text-gray-300 text-sm hidden sm:block cursor-pointer hover:text-white transition"
              onClick={() => navigate('/account')}
            >
              {user.display_name}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Đăng xuất
            </button>
          </>
        ) : (
          <button
            onClick={onOpenAuth}
            className="text-sm px-3 py-1 rounded-md font-medium transition-colors"
            style={{ background: '#F2A20C', color: '#0A0E1A' }}
          >
            Đăng nhập
          </button>
        )}
      </div>
    </nav>
  )
}
