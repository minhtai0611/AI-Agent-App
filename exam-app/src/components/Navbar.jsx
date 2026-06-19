import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ZenithLogo from './ZenithLogo'
import CreditsTooltip from './CreditsTooltip'
import { NavbarSkeleton } from './Skeleton.jsx'

function vNavigate(navigate, path) {
  if (document.startViewTransition) {
    document.startViewTransition(() => navigate(path))
  } else {
    navigate(path)
  }
}

const AUTH_NAV = [
  { label: 'Trang chủ', path: '/home' },
  { label: 'Thi thử', path: '/exams' },
  { label: 'Ôn sai', path: '/review' },
  { label: 'Luyện yếu', path: '/practice' },
  { label: 'Hỏi AI', path: '/oracle' },
  { label: 'Tiến độ', path: '/mastery' },
]

const MOBILE_NAV_PRIMARY = [
  { label: 'Trang chủ', path: '/home', icon: '⌂' },
  { label: 'Thi thử', path: '/exams', icon: '📋' },
  { label: 'Ôn sai', path: '/review', icon: '🔁' },
  { label: 'Luyện yếu', path: '/practice', icon: '⚡' },
  { label: 'Bản đồ khái niệm', path: '/mastery', icon: '🗺' },
  { label: 'Lỗi sai', path: '/mistakes', icon: '✗' },
  { label: 'Tiến độ', path: '/progress', icon: '📊' },
]

export default function Navbar({ onOpenAuth }) {
  const { user, logout, loading: authLoading } = useAuth()
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
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 bg-[var(--background)] border-b border-[var(--border)]"
        style={{ height: 48 }}
      >
        {/* Left: Logo + authenticated nav links */}
        <div className="flex items-center gap-1">
          <ZenithLogo variant="nav" onClick={() => go(logoTarget)} />

          {user && (
            <div className="hidden sm:flex items-center gap-0.5 ml-3">
              {AUTH_NAV.map(link => (
                <button
                  key={link.path}
                  onClick={() => go(link.path)}
                  className={`px-2.5 py-1.5 rounded-md font-sans text-[12px] transition-colors ${
                    isActive(link.path)
                      ? 'text-[var(--foreground)] font-semibold bg-[var(--surface)]'
                      : 'text-[var(--fg-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]'
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
          {authLoading ? (
            <NavbarSkeleton />
          ) : user ? (
            <>
              {pendingSync > 0 && (
                <span className="font-sans text-[10px] text-[var(--warning)] border border-[var(--accent-border)] rounded px-1.5 py-0.5">
                  {pendingSync} chờ đồng bộ
                </span>
              )}
              {user.credits_balance != null && (
                <div className="relative">
                  <button
                    onClick={() => go('/account')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary-border)] transition"
                    title="Credits"
                  >
                    <span className="text-[var(--primary)] text-[11px]">⚡</span>
                    <span className="font-sans text-[12px] font-semibold text-[var(--primary)]">
                      {user.credits_balance}
                    </span>
                  </button>
                  <CreditsTooltip
                    userId={user?.id}
                    creditsBalance={user?.credits_balance ?? 0}
                  />
                </div>
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
                  className="w-7 h-7 rounded-full bg-[var(--primary)] flex items-center justify-center text-xs font-bold text-[var(--primary-fg)] cursor-pointer"
                  onClick={() => go('/account')}
                >
                  {initials(user.custom_display_name || user.display_name)}
                </div>
              )}
              <button
                onClick={() => go('/account')}
                className="flex items-center gap-1.5 hover:opacity-80 transition"
              >
                <span className="text-[var(--fg-secondary)] text-sm">
                  {user.custom_display_name || user.display_name}
                </span>
                {user.mastery_rank && user.mastery_rank !== 'Pemula' && (
                  <span className="font-sans text-[10px] font-semibold px-1.5 py-0.5 rounded-md border border-[var(--primary-border)] bg-[var(--primary-subtle)] text-[var(--primary)]">
                    {user.mastery_rank}
                  </span>
                )}
              </button>
              <button
                onClick={handleLogout}
                className="text-sm text-[var(--fg-tertiary)] hover:text-[var(--fg-secondary)] transition-colors"
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <button
              onClick={onOpenAuth}
              className="btn-primary text-sm px-3 py-2"
            >
              Đăng nhập
            </button>
          )}
        </div>

        {/* Mobile: credits badge + hamburger */}
        <div className="flex sm:hidden items-center gap-2">
          {authLoading && <div className="skeleton w-16 h-7 rounded-full" />}
          {!authLoading && user?.credits_balance != null && (
            <button
              onClick={() => go('/account')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)]"
            >
              <span className="text-[var(--primary)] text-[11px]">⚡</span>
              <span className="font-sans text-[12px] font-semibold text-[var(--primary)]">
                {user.credits_balance}
              </span>
            </button>
          )}
          <button
            className="flex items-center justify-center w-10 h-10 text-[var(--fg-secondary)] text-lg"
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Menu"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile sidebar drawer */}
      {menuOpen && (
        <div className="sm:hidden fixed top-12 left-0 right-0 bottom-0 z-40 flex flex-col overflow-y-auto bg-[var(--background)] border-t border-[var(--border)]">
          {user ? (
            <>
              {/* User identity row */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)]">
                {user.avatar_url && !avatarError ? (
                  <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" onError={() => setAvatarError(true)}
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[var(--primary)] flex items-center justify-center font-sans text-sm font-bold text-[var(--primary-fg)] flex-shrink-0">
                    {initials(user.custom_display_name || user.display_name)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-sans text-[13px] font-semibold text-[var(--foreground)] truncate">
                    {user.custom_display_name || user.display_name}
                  </p>
                  {user.credits_balance != null && (
                    <p className="font-sans text-[11px] text-[var(--primary)]">⚡ {user.credits_balance}</p>
                  )}
                </div>
              </div>

              {/* Primary routes */}
              <div className="flex flex-col px-3 py-2">
                {MOBILE_NAV_PRIMARY.map(link => (
                  <button key={link.path} onClick={() => go(link.path)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-left font-sans text-[14px] transition-colors ${
                      isActive(link.path)
                        ? 'bg-[var(--surface)] text-[var(--foreground)] font-semibold'
                        : 'text-[var(--fg-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]'
                    }`}>
                    <span className="w-5 text-center text-[15px] flex-shrink-0 opacity-70">{link.icon}</span>
                    {link.label}
                  </button>
                ))}
              </div>

              {/* Secondary: Zenith AI */}
              <div className="px-3 pb-2">
                <div className="border-t border-[var(--border)] my-1" />
                <button onClick={() => go('/oracle')}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-left font-sans text-[14px] transition-colors w-full ${
                    isActive('/oracle')
                      ? 'bg-[var(--surface)] text-[var(--primary)] font-semibold'
                      : 'text-[var(--fg-tertiary)] hover:text-[var(--fg-secondary)] hover:bg-[var(--surface)]'
                  }`}>
                  <span className="w-5 text-center text-[15px] flex-shrink-0 text-[var(--primary)]">✦</span>
                  Hỏi AI
                </button>
              </div>

              {/* Account + logout at bottom */}
              <div className="mt-auto px-3 pb-6">
                <div className="border-t border-[var(--border)] my-1" />
                <button onClick={() => go('/account')}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-left font-sans text-[14px] text-[var(--fg-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors w-full">
                  <span className="w-5 text-center opacity-70">⚙</span>
                  Tài khoản
                </button>
                <button onClick={handleLogout}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-left font-sans text-[14px] text-[var(--fg-tertiary)] hover:text-[var(--fg-secondary)] hover:bg-[var(--surface)] transition-colors w-full">
                  <span className="w-5 text-center opacity-50">→</span>
                  Đăng xuất
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col px-3 py-4 gap-1">
              <button onClick={() => go('/exams')} className="flex items-center gap-3 px-3 py-3 rounded-xl text-left font-sans text-[14px] text-[var(--foreground)] hover:bg-[var(--surface)] transition">
                <span className="w-5 text-center opacity-70">📋</span>
                Bài thi
              </button>
              <button onClick={() => { onOpenAuth(); setMenuOpen(false) }}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-left font-sans text-[14px] font-semibold text-[var(--primary)] hover:bg-[var(--surface)] transition">
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
