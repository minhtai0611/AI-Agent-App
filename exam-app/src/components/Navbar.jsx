import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import VantageLogo from './VantageLogo'
import { useOrgAuth } from '../context/OrgAuthContext.jsx'
import { useTheme } from '../hooks/useTheme.js'

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

// Cấm emoji trong UI (design-system.html §06) — mọi glyph dưới đây là SVG
// kẻ tay 1.5px hoặc ký hiệu typographic thuần (☾/☀/▾/✕/☰), không phải emoji.
const PRIMARY = [
  { label: 'Thi thử', path: '/exams' },
  { label: 'Lịch sử', path: '/history' },
]

const TOOLS = [
  { label: 'Máy tính CAS', path: '/calculator' },
  { label: 'Đại số tuyến tính', path: '/linalg' },
  { label: 'Xác suất', path: '/probability' },
  { label: 'Math Playground', path: '/playground' },
]

const ORG_LINK = { label: 'Tổ chức', path: '/org' }

function SunIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.5M12 19v2.5M4.4 4.4l1.8 1.8M17.8 17.8l1.8 1.8M2.5 12H5M19 12h2.5M4.4 19.6l1.8-1.8M17.8 6.2l1.8-1.8" />
    </svg>
  )
}
function MoonIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" />
    </svg>
  )
}
function ChevronIcon({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      className="flex items-center justify-center w-8 h-8 rounded-md transition-colors"
      style={{ color: 'var(--ink-2)', border: '1px solid var(--line)', background: 'var(--paper)' }}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

function ToolsDropdown({ isActive, go }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const active = TOOLS.some(t => isActive(t.path))

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[12px] transition-colors"
        style={{
          fontFamily: 'var(--font-mono)',
          color: active ? 'var(--ink)' : 'var(--ink-2)',
          fontWeight: active ? 600 : 400,
        }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        CÔNG CỤ <ChevronIcon />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            role="menu"
            className="absolute top-full left-0 mt-1.5 py-1.5 min-w-[188px]"
            style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', boxShadow: 'var(--shadow-md)' }}
          >
            {TOOLS.map(tool => (
              <button
                key={tool.path}
                role="menuitem"
                onClick={() => { go(tool.path); setOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-[13px] transition-colors"
                style={{
                  color: isActive(tool.path) ? 'var(--ink)' : 'var(--ink-2)',
                  fontWeight: isActive(tool.path) ? 600 : 400,
                }}
              >
                {tool.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const go = (path) => { vNavigate(navigate, path); setMenuOpen(false) }
  const [menuOpen, setMenuOpen] = useState(false)
  const { status: orgStatus } = useOrgAuth() ?? {}
  const links = orgStatus === 'authenticated' ? [...PRIMARY, ORG_LINK] : PRIMARY

  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  function isActive(path) {
    return location.pathname === path
  }

  return (
    <>
      <nav
        className="vantage-nav fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
        style={{ height: 48 }}
      >
        <div className="flex items-center gap-1">
          <VantageLogo variant="nav" onClick={() => go('/exams')} />

          <div className="hidden sm:flex items-center gap-0.5 ml-4">
            {links.map(link => (
              <button
                key={link.path}
                onClick={() => go(link.path)}
                className="px-2.5 py-1.5 rounded-md text-[12px] transition-colors"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: isActive(link.path) ? 'var(--ink)' : 'var(--ink-2)',
                  fontWeight: isActive(link.path) ? 600 : 400,
                }}
              >
                {link.label.toUpperCase()}
              </button>
            ))}
            <ToolsDropdown isActive={isActive} go={go} />
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => go('/exams')}
            className="px-3 py-1.5 text-[11.5px] font-bold transition-colors"
            style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--ink)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-sm)',
              background: 'var(--paper)',
            }}
          >
            VÀO ÔN THI ▲
          </button>
        </div>

        <div className="flex sm:hidden items-center gap-2">
          <ThemeToggle />
          <button
            className="flex items-center justify-center w-9 h-9 transition"
            style={{ color: 'var(--ink-2)' }}
            onClick={() => setMenuOpen(v => !v)}
            aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
          >
            {menuOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="mobile-nav-overlay"
            className="sm:hidden fixed inset-0 z-40 overflow-y-auto"
            style={{ top: 48, background: 'var(--paper)' }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex flex-col px-3 py-4 gap-0.5 relative z-10">
              {[...links, ...TOOLS].map((link) => (
                <button
                  key={link.path}
                  onClick={() => go(link.path)}
                  className="flex items-center gap-3 px-3 py-3 text-left text-[14px] transition-colors"
                  style={{
                    color: isActive(link.path) ? 'var(--ink)' : 'var(--ink-2)',
                    background: isActive(link.path) ? 'var(--paper-2)' : 'transparent',
                    fontWeight: isActive(link.path) ? 600 : 400,
                    borderBottom: '1px solid var(--line-soft)',
                  }}
                >
                  {link.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
