import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ZenithLogo from './ZenithLogo'

function vNavigate(navigate, path) {
  if (document.startViewTransition) {
    document.startViewTransition(() => navigate(path))
  } else {
    navigate(path)
  }
}

// Primary nav links for authenticated users
const AUTH_NAV = [
  { label: 'Trang chủ', path: '/home' },
  { label: 'Bài thi', path: '/exams' },
  { label: 'Ôn tập', path: '/review' },
  { label: 'Luyện tập', path: '/practice' },
  { label: 'Bản đồ', path: '/mastery' },
]

// Full route list for mobile sidebar
const MOBILE_NAV_PRIMARY = [
  { label: 'Trang chủ', path: '/home', icon: '⌂' },
  { label: 'Bài thi', path: '/exams', icon: '📋' },
  { label: 'Ôn tập', path: '/review', icon: '🔁' },
  { label: 'Luyện tập', path: '/practice', icon: '⚡' },
  { label: 'Bản đồ khái niệm', path: '/mastery', icon: '🗺' },
  { label: 'Lỗi sai', path: '/mistakes', icon: '✗' },
  { label: 'Tiến độ', path: '/progress', icon: '📊' },
]

export default function Navbar({ onOpenAuth }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const go = useCallback((path) => { vNavigate(navigate, path); setMenuOpen(false) }, [navigate])
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

  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  function handleLogout() {
    logout()
    go('/')
    setMenuOpen(false)
  }

  function initials(name) {
    if (!name) return '?'
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  }

  function isActive(path) {
    return location.pathname === path
  }

  const logoTarget = user ? '/home' : '/'

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4"
        style={{ height: 48, background: 'transparent' }}
      >
        {/* Left: Logo + authenticated nav links */}
        <div className="flex items-center gap-1">
          <ZenithLogo variant="nav" onClick={() => go(logoTarget)} />

          {/* Desktop nav links (authenticated only) */}
          {user && (
            <div className="hidden sm:flex items-center gap-0.5 ml-3">
              {AUTH_NAV.map(link => (
                <button
                  key={link.path}
                  onClick={() => go(link.path)}
                  className={`px-2.5 py-1.5 rounded-md font-jakarta text-[12px] transition-colors ${
                    isActive(link.path)
                      ? 'text-foreground font-semibold bg-surface/60'
                      : 'text-muted hover:text-foreground hover:bg-surface/40'
                  }`}
                >
                  {link.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: user controls (desktop) */}
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
                  onClick={() => go('/account')}
                  className="flex items-center gap-1 px-2.5 py-2 rounded-full border border-surface bg-surface/80 hover:border-primary/40 transition"
                  title="Credits"
                >
                  <span className="text-primary text-[11px]">⚡</span>
                  <span className="font-jakarta text-[12px] font-semibold text-primary">
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
                  onClick={() => go('/account')}
                />
              ) : (
                <div
                  className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-fg cursor-pointer"
                  onClick={() => go('/account')}
                >
                  {initials(user.custom_display_name || user.display_name)}
                </div>
              )}
              <button
                onClick={() => go('/account')}
                className="flex items-center gap-1.5 hover:opacity-80 transition"
              >
                <span className="text-gray-300 text-sm">
                  {user.custom_display_name || user.display_name}
                </span>
                {user.mastery_rank && user.mastery_rank !== 'Pemula' && (
                  <span className="font-jakarta text-[10px] font-semibold px-1.5 py-0.5 rounded-md border border-info/20 bg-info/5 text-info">
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
              className="text-sm px-3 py-2.5 rounded-md font-medium transition-colors bg-primary text-primary-fg"
            >
              Đăng nhập
            </button>
          )}
        </div>

        {/* Mobile: credits badge + hamburger */}
        <div className="flex sm:hidden items-center gap-2">
          {user?.credits_balance != null && (
            <button
              onClick={() => go('/account')}
              className="flex items-center gap-1 px-2.5 py-2 rounded-full border border-surface bg-surface/80"
            >
              <span className="text-primary text-[11px]">⚡</span>
              <span className="font-jakarta text-[12px] font-semibold text-primary">
                {user.credits_balance}
              </span>
            </button>
          )}
          <button
            className="flex items-center justify-center w-10 h-10 text-muted text-lg"
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Menu"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile sidebar drawer */}
      {menuOpen && (
        <div
          className="sm:hidden fixed top-12 left-0 right-0 bottom-0 z-40 flex flex-col overflow-y-auto"
          style={{ background: 'rgba(10,14,26,0.97)', backdropFilter: 'blur(16px)' }}
        >
          {user ? (
            <>
              {/* User identity row */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-surface">
                {user.avatar_url && !avatarError ? (
                  <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" onError={() => setAvatarError(true)}
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center font-jakarta text-sm font-bold text-primary-fg flex-shrink-0">
                    {initials(user.custom_display_name || user.display_name)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-jakarta text-[13px] font-semibold text-foreground truncate">
                    {user.custom_display_name || user.display_name}
                  </p>
                  {user.credits_balance != null && (
                    <p className="font-jakarta text-[11px] text-primary">⚡ {user.credits_balance}</p>
                  )}
                </div>
              </div>

              {/* Primary routes */}
              <div className="flex flex-col px-3 py-2">
                {MOBILE_NAV_PRIMARY.map(link => (
                  <button key={link.path} onClick={() => go(link.path)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-left font-jakarta text-[14px] transition-colors ${
                      isActive(link.path) ? 'bg-surface text-foreground font-semibold' : 'text-muted hover:text-foreground hover:bg-surface/50'
                    }`}>
                    <span className="w-5 text-center text-[15px] flex-shrink-0 opacity-70">{link.icon}</span>
                    {link.label}
                  </button>
                ))}
              </div>

              {/* Secondary: Zenith AI */}
              <div className="px-3 pb-2">
                <div className="border-t border-surface/60 my-1" />
                <button onClick={() => go('/oracle')}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-left font-jakarta text-[14px] transition-colors w-full ${
                    isActive('/oracle') ? 'bg-surface text-info font-semibold' : 'text-dim hover:text-muted hover:bg-surface/50'
                  }`}>
                  <span className="w-5 text-center text-[15px] flex-shrink-0 text-info/60">✦</span>
                  Zenith AI
                </button>
              </div>

              {/* Account + logout at bottom */}
              <div className="mt-auto px-3 pb-6">
                <div className="border-t border-surface/60 my-1" />
                <button onClick={() => go('/account')}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-left font-jakarta text-[14px] text-muted hover:text-foreground hover:bg-surface/50 transition-colors w-full">
                  <span className="w-5 text-center opacity-70">⚙</span>
                  Tài khoản
                </button>
                <button onClick={handleLogout}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-left font-jakarta text-[14px] text-dim hover:text-muted hover:bg-surface/50 transition-colors w-full">
                  <span className="w-5 text-center opacity-50">→</span>
                  Đăng xuất
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col px-3 py-4 gap-1">
              <button onClick={() => go('/exams')} className="flex items-center gap-3 px-3 py-3 rounded-xl text-left font-jakarta text-[14px] text-foreground hover:bg-surface/50 transition">
                <span className="w-5 text-center opacity-70">📋</span>
                Bài thi
              </button>
              <button onClick={() => { onOpenAuth(); setMenuOpen(false) }}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-left font-jakarta text-[14px] font-semibold text-primary hover:bg-surface/50 transition">
                <span className="w-5 text-center">→</span>
                Đăng nhập
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
