import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import VantageLogo from './VantageLogo'
import { useOrgAuth } from '../context/OrgAuthContext.jsx'

function vNavigate(navigate, path) {
  // See utils/animations.js#viewNavigate — startViewTransition can reject with
  // InvalidStateError (hidden document, transition already in flight); the nav itself
  // still happens via the callback, so an unhandled rejection here is just noise.
  if (document.startViewTransition) {
    const transition = document.startViewTransition(() => navigate(path))
    transition.ready.catch(() => {})
  } else {
    navigate(path)
  }
}

const NAV = [
  { label: 'Thi thử', path: '/exams', icon: '📋' },
  { label: 'Lịch sử', path: '/history', icon: '🕘' },
]

const ORG_LINK = { label: 'Tổ chức', path: '/org', icon: '🏛️' }

const stellarReveal = {
  hidden: { opacity: 0, y: 32, filter: 'blur(8px)', scale: 0.96 },
  show: (i) => ({
    opacity: 1, y: 0, filter: 'blur(0px)', scale: 1,
    transition: { duration: 0.72, ease: [0.16, 1, 0.3, 1], delay: i * 0.055 },
  }),
}

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const go = (path) => { vNavigate(navigate, path); setMenuOpen(false) }
  const [menuOpen, setMenuOpen] = useState(false)
  const [supportsClipPath, setSupportsClipPath] = useState(true)
  const { status: orgStatus } = useOrgAuth() ?? {}
  const navLinks = orgStatus === 'authenticated' ? [...NAV, ORG_LINK] : NAV

  useEffect(() => {
    setSupportsClipPath(CSS.supports('clip-path', 'circle(0%)'))
  }, [])

  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  function isActive(path) {
    return location.pathname === path
  }

  return (
    <>
      <nav
        className="vantage-nav fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4"
        style={{ height: 48 }}
      >
        <div className="flex items-center gap-1">
          <VantageLogo variant="nav" onClick={() => go('/exams')} />

          <div className="hidden sm:flex items-center gap-0.5 ml-3">
            {navLinks.map(link => (
              <button
                key={link.path}
                onClick={() => go(link.path)}
                className={`nav-link-vantage px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${
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
        </div>

        <div className="flex sm:hidden items-center gap-2">
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
            <div className="nebula-wisp" style={{
              width: 360, height: 360,
              top: '-10%', right: '-15%',
              background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)',
            }} />
            <div className="nebula-wisp" style={{
              width: 280, height: 280,
              bottom: '10%', left: '-10%',
              background: 'radial-gradient(circle, var(--purple) 0%, transparent 70%)',
            }} />

            <div className="flex flex-col px-3 py-4 gap-1 relative z-10">
              {navLinks.map((link, i) => (
                <motion.button
                  key={link.path}
                  custom={i} variants={stellarReveal} initial="hidden" animate="show"
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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
