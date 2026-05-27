import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ZenithLogo from './ZenithLogo'
export default function Navbar({ onOpenAuth }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [avatarError, setAvatarError] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pendingSync, setPendingSync] = useState(
    parseInt(localStorage.getItem('offline_queue_size') ?? '0', 10)
  )

  useEffect(() => {
    function onStorage(e) {
      if (e.key === 'offline_queue_size') {
        setPendingSync(parseInt(e.newValue ?? '0', 10))
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])


  // Close drawer on navigation
  useEffect(() => { setMenuOpen(false) }, [])

  function handleLogout() {
    logout()
    navigate('/')
    setMenuOpen(false)
  }

  function go(path) {
    navigate(path)
    setMenuOpen(false)
  }

  function initials(name) {
    if (!name) return '?'
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  }

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4"
        style={{
          height: 48,
          background: 'transparent',
        }}
      >
        <ZenithLogo variant="nav" onClick={() => navigate('/')} />

        {/* Desktop nav items */}
        <div className="hidden sm:flex items-center gap-3">
          {user ? (
            <>
              {pendingSync > 0 && (
                <span className="font-jakarta text-[10px] text-amber-400/70 border border-amber-400/30 rounded px-1.5 py-0.5">
                  {pendingSync} chờ đồng bộ
                </span>
              )}
              {user.credits_balance != null && (
                <button
                  onClick={() => navigate('/account')}
                  className="flex items-center gap-1 px-2.5 py-2 rounded-full border border-[#1E2A44] bg-[#111827]/80 hover:border-amber-500/50 transition"
                  title="Tia"
                >
                  <span className="text-amber-400 text-[11px]">⚡</span>
                  <span className="font-jakarta text-[12px] font-semibold text-amber-400">
                    {user.credits_balance}
                  </span>
                </button>
              )}
              {user.avatar_url && !avatarError ? (
                <img
                  src={user.avatar_url}
                  alt={user.display_name || 'Avatar'}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                  className="w-7 h-7 rounded-full object-cover cursor-pointer"
                  onClick={() => navigate('/account')}
                />
              ) : (
                <div
                  className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold text-black cursor-pointer"
                  onClick={() => navigate('/account')}
                >
                  {initials(user.custom_display_name || user.display_name)}
                </div>
              )}
              <button
                onClick={() => navigate('/account')}
                className="flex items-center gap-1.5 hover:opacity-80 transition"
              >
                <span className="text-gray-300 text-sm">
                  {user.custom_display_name || user.display_name}
                </span>
                {user.mastery_rank && user.mastery_rank !== 'Pemula' && (
                  <span className="font-jakarta text-[10px] font-semibold px-1.5 py-0.5 rounded-md border border-[#6366F130] bg-[#6366F10A] text-[#818CF8]">
                    {user.mastery_rank}
                  </span>
                )}
              </button>
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
              className="text-sm px-3 py-2.5 rounded-md font-medium transition-colors"
              style={{ background: '#F2A20C', color: '#0A0E1A' }}
            >
              Đăng nhập
            </button>
          )}
        </div>

        {/* Mobile: credits badge + hamburger */}
        <div className="flex sm:hidden items-center gap-2">
          {user?.credits_balance != null && (
            <button
              onClick={() => navigate('/account')}
              className="flex items-center gap-1 px-2.5 py-2 rounded-full border border-[#1E2A44] bg-[#111827]/80"
            >
              <span className="text-amber-400 text-[11px]">⚡</span>
              <span className="font-jakarta text-[12px] font-semibold text-amber-400">
                {user.credits_balance}
              </span>
            </button>
          )}
          <button
            className="flex items-center justify-center w-10 h-10 text-[#94A3B8] text-lg"
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Menu"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="sm:hidden fixed top-12 left-0 right-0 bg-[#0D1221] border-b border-[#1E2A44] px-4 py-3 flex flex-col gap-1 z-40">
          <button onClick={() => go('/exams')} className="py-3 text-left font-jakarta text-[14px] text-[#F0F4FF] hover:text-white transition">
            Thi thử
          </button>
          <button onClick={() => go('/exams?mode=practice')} className="py-3 text-left font-jakarta text-[14px] text-[#94A3B8] hover:text-white transition">
            Luyện tập
          </button>
          <button onClick={() => go('/exams?mode=special')} className="py-3 text-left font-jakarta text-[14px] text-[#94A3B8] hover:text-white transition">
            Chế độ đặc biệt
          </button>
          {user ? (
            <>
              <button onClick={() => go('/account')} className="py-3 text-left font-jakarta text-[14px] text-[#94A3B8] hover:text-white transition">
                Tài khoản
              </button>
              <button onClick={handleLogout} className="py-3 text-left font-jakarta text-[14px] text-[#64748B] hover:text-[#94A3B8] transition">
                Đăng xuất
              </button>
            </>
          ) : (
            <button onClick={() => { onOpenAuth(); setMenuOpen(false) }}
              className="py-3 text-left font-jakarta text-[14px] font-semibold text-[#F2A20C]">
              Đăng nhập
            </button>
          )}
        </div>
      )}
    </>
  )
}
