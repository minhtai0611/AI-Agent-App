import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from './ui/button.jsx'
import { Badge } from './ui/badge.jsx'
import { useAuth } from '../context/AuthContext'
import LuminaryLogo from './LuminaryLogo'
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

const stellarReveal = {
  hidden: { opacity: 0, y: 32, filter: 'blur(8px)', scale: 0.96 },
  show: (i) => ({
    opacity: 1, y: 0, filter: 'blur(0px)', scale: 1,
    transition: { duration: 0.72, ease: [0.16, 1, 0.3, 1], delay: i * 0.055 },
  }),
}

export default function Navbar({ onOpenAuth }) {
  const { user, logout, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const go = useCallback((path) => { vNavigate(navigate, path); setMenuOpen(false) }, [navigate])
  const [avatarError, setAvatarError] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [supportsClipPath, setSupportsClipPath] = useState(true)
  const [pendingSync, setPendingSync] = useState(
    parseInt(localStorage.getItem('offline_queue_size') ?? '0', 10)
  )

  useEffect(() => {
    setSupportsClipPath(CSS.supports('clip-path', 'circle(0%)'))
  }, [])

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
        className="luminary-nav fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4"
        style={{ height: 48 }}
      >
        {/* Left: Logo + authenticated nav links */}
        <div className="flex items-center gap-1">
          <LuminaryLogo variant="nav" onClick={() => go(logoTarget)} />

          {user && (
            <div className="hidden sm:flex items-center gap-0.5 ml-3">
              {AUTH_NAV.map(link => (
                <button
                  key={link.path}
                  onClick={() => go(link.path)}
                  className={`nav-link-luminary px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${
                    isActive(link.path) ? 'active font-semibold' : ''
                  }`}
                  style={{
                    color: isActive(link.path) ? 'var(--foreground)' : 'var(--fg-secondary)',
                  }}
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
                <span className="text-[10px] text-[var(--warning)] border border-[var(--accent-border)] rounded px-1.5 py-0.5">
                  {pendingSync} chờ đồng bộ
                </span>
              )}
              {user.credits_balance != null && (
                <CreditsTooltip userId={user?.id} creditsBalance={user?.credits_balance ?? 0}>
                  <button
                    onClick={() => go('/account')}
                    className="flex items-center gap-1 px-2 py-1 rounded transition hover:opacity-80"
                    title="Credits"
                  >
                    <span style={{ color: 'var(--primary)', fontSize: 11 }}>✦</span>
                    <span className="text-[12px] font-semibold" style={{ color: 'var(--primary)' }}>
                      {user.credits_balance}
                    </span>
                  </button>
                </CreditsTooltip>
              )}
              {user.avatar_url && !avatarError ? (
                <img
                  src={user.avatar_url}
                  alt={user.display_name || 'Avatar'}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                  className="w-7 h-7 rounded-full object-cover cursor-pointer ring-1 ring-[var(--primary)]/30"
                  onClick={() => go('/account')}
                />
              ) : (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer ring-1 ring-[var(--primary)]/30"
                  style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}
                  onClick={() => go('/account')}
                >
                  {initials(user.custom_display_name || user.display_name)}
                </div>
              )}
              <button
                onClick={() => go('/account')}
                className="flex items-center gap-1.5 hover:opacity-80 transition"
              >
                <span className="text-sm" style={{ color: 'var(--fg-secondary)' }}>
                  {user.custom_display_name || user.display_name}
                </span>
                {user.mastery_rank && user.mastery_rank !== 'Pemula' && (
                  <Badge className="text-[10px] border-[var(--primary-border)] bg-[var(--primary-subtle)] text-[var(--primary)] px-1.5 py-0.5 rounded-md">
                    {user.mastery_rank}
                  </Badge>
                )}
              </button>
              <button
                onClick={handleLogout}
                title="Đăng xuất"
                className="text-sm transition-colors hover:opacity-80"
                style={{ color: 'var(--fg-tertiary)' }}
              >
                ↗
              </button>
            </>
          ) : (
            <Button onClick={onOpenAuth} size="sm">
              Đăng nhập
            </Button>
          )}
        </div>

        {/* Mobile: credits badge + hamburger */}
        <div className="flex sm:hidden items-center gap-2">
          {authLoading && <div className="skeleton w-16 h-7 rounded-full" />}
          {!authLoading && user?.credits_balance != null && (
            <button
              onClick={() => go('/account')}
              className="flex items-center gap-1 px-2 py-1 rounded transition hover:opacity-80"
            >
              <span style={{ color: 'var(--primary)', fontSize: 11 }}>✦</span>
              <span className="text-[12px] font-semibold" style={{ color: 'var(--primary)' }}>
                {user.credits_balance}
              </span>
            </button>
          )}
          <button
            className="flex items-center justify-center w-10 h-10 text-lg transition hover:opacity-80"
            style={{ color: 'var(--fg-secondary)' }}
            onClick={() => setMenuOpen(v => !v)}
            aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile: portal overlay — expands from hamburger corner */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="portal-overlay"
            className="sm:hidden fixed inset-0 z-30 overflow-y-auto"
            style={{
              top: 48,
              background: 'var(--background)',
            }}
            initial={supportsClipPath
              ? { clipPath: 'circle(0% at calc(100% - 28px) 28px)' }
              : { opacity: 0 }}
            animate={supportsClipPath
              ? { clipPath: 'circle(150% at calc(100% - 28px) 28px)' }
              : { opacity: 1 }}
            exit={supportsClipPath
              ? { clipPath: 'circle(0% at calc(100% - 28px) 28px)' }
              : { opacity: 0 }}
            transition={{ duration: 0.42, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Nebula wisps inside portal */}
            <div className="nebula-wisp" style={{
              width: 360, height: 360,
              top: '-10%', right: '-15%',
              background: 'radial-gradient(circle, #3B6FE8 0%, transparent 70%)',
            }} />
            <div className="nebula-wisp" style={{
              width: 280, height: 280,
              bottom: '10%', left: '-10%',
              background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)',
            }} />

            {user ? (
              <div className="flex flex-col min-h-full pt-2 relative z-10">
                {/* User identity row */}
                <motion.div
                  custom={0} variants={stellarReveal} initial="hidden" animate="show"
                  className="flex items-center gap-3 px-5 py-4 border-b"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {user.avatar_url && !avatarError ? (
                    <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" onError={() => setAvatarError(true)}
                      className="w-9 h-9 rounded-full object-cover flex-shrink-0 ring-1 ring-[var(--primary)]/30" />
                  ) : (
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-sans text-sm font-bold flex-shrink-0 ring-1 ring-[var(--primary)]/30"
                      style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}>
                      {initials(user.custom_display_name || user.display_name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                      {user.custom_display_name || user.display_name}
                    </p>
                    {user.credits_balance != null && (
                      <p className="text-[11px]" style={{ color: 'var(--primary)' }}>✦ {user.credits_balance}</p>
                    )}
                  </div>
                </motion.div>

                {/* Primary routes */}
                <div className="flex flex-col px-3 py-2">
                  {MOBILE_NAV_PRIMARY.map((link, i) => (
                    <motion.button
                      key={link.path}
                      custom={i + 1} variants={stellarReveal} initial="hidden" animate="show"
                      onClick={() => go(link.path)}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl text-left text-[14px] transition-colors"
                      style={{
                        color: isActive(link.path) ? 'var(--foreground)' : 'var(--fg-secondary)',
                        background: isActive(link.path) ? 'var(--surface)' : 'transparent',
                        fontWeight: isActive(link.path) ? 600 : 400,
                      }}
                    >
                      <span className="w-5 text-center text-[15px] flex-shrink-0 opacity-70">{link.icon}</span>
                      {link.label}
                    </motion.button>
                  ))}
                </div>

                {/* Secondary: AI Oracle */}
                <div className="px-3 pb-2">
                  <div className="border-t my-1" style={{ borderColor: 'var(--border)' }} />
                  <motion.button
                    custom={MOBILE_NAV_PRIMARY.length + 1} variants={stellarReveal} initial="hidden" animate="show"
                    onClick={() => go('/oracle')}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-left text-[14px] transition-colors w-full"
                    style={{
                      color: isActive('/oracle') ? 'var(--primary)' : 'var(--fg-tertiary)',
                      background: isActive('/oracle') ? 'var(--surface)' : 'transparent',
                      fontWeight: isActive('/oracle') ? 600 : 400,
                    }}
                  >
                    <span className="w-5 text-center text-[15px] flex-shrink-0" style={{ color: 'var(--primary)' }}>✦</span>
                    Hỏi AI
                  </motion.button>
                </div>

                {/* Account + logout at bottom */}
                <div className="mt-auto px-3 pb-8">
                  <div className="border-t my-1" style={{ borderColor: 'var(--border)' }} />
                  <motion.button
                    custom={MOBILE_NAV_PRIMARY.length + 2} variants={stellarReveal} initial="hidden" animate="show"
                    onClick={() => go('/account')}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-left text-[14px] transition-colors w-full hover:opacity-80"
                    style={{ color: 'var(--fg-secondary)' }}
                  >
                    <span className="w-5 text-center opacity-70">⚙</span>
                    Tài khoản
                  </motion.button>
                  <motion.button
                    custom={MOBILE_NAV_PRIMARY.length + 3} variants={stellarReveal} initial="hidden" animate="show"
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-left text-[14px] transition-colors w-full hover:opacity-80"
                    style={{ color: 'var(--fg-tertiary)' }}
                  >
                    <span className="w-5 text-center opacity-50">↗</span>
                    Đăng xuất
                  </motion.button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col px-3 py-4 gap-1 relative z-10">
                <motion.button
                  custom={0} variants={stellarReveal} initial="hidden" animate="show"
                  onClick={() => go('/exams')}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-left text-[14px] transition hover:opacity-80"
                  style={{ color: 'var(--foreground)' }}
                >
                  <span className="w-5 text-center opacity-70">📋</span>
                  Bài thi
                </motion.button>
                <motion.button
                  custom={1} variants={stellarReveal} initial="hidden" animate="show"
                  onClick={() => { onOpenAuth(); setMenuOpen(false) }}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-left text-[14px] font-semibold transition hover:opacity-80"
                  style={{ color: 'var(--primary)' }}
                >
                  <span className="w-5 text-center">→</span>
                  Đăng nhập
                </motion.button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
