import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useOracle } from '../context/OracleContext.jsx'
import TutorChat from './TutorChat.jsx'

const SUPPRESS_PATHS = ['/', '/admin', '/generate', '/diagnostic']

export default function OracleBubble() {
  const location = useLocation()
  const { isOpen, open, close, pageContext, unreadCount } = useOracle()

  const hide = SUPPRESS_PATHS.some(p =>
    p === '/' ? location.pathname === '/' : location.pathname.startsWith(p)
  )
  if (hide) return null

  // Bubble icon and glow change with context
  const inTimedExam = pageContext?.inExam && pageContext?.mode === 'timed'
  const onResults = pageContext?.weakTopics?.length > 0 && !pageContext?.inExam
  const bubbleIcon = onResults ? '📊' : '⚡'
  const glowColor = inTimedExam ? '#3B82F6' : '#F2A20C'

  return (
    <>
      <TutorChat open={isOpen} onClose={close} />

      <AnimatePresence>
        {!isOpen && (
          <motion.button
            key="oracle-bubble"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
              opacity: 1,
              scale: 1,
              boxShadow: inTimedExam
                ? `0 0 0 0 ${glowColor}40`
                : [`0 0 0 0 ${glowColor}40`, `0 0 8px 4px ${glowColor}30`, `0 0 0 0 ${glowColor}40`],
            }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            onClick={open}
            aria-label="Mở AI Gia Sư"
            className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(135deg, #1E2A44 0%, #0D1221 100%)', border: `1.5px solid ${glowColor}60` }}
          >
            <span className="text-xl">{bubbleIcon}</span>
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center font-jakarta text-[10px] font-bold text-[#0A0E1A]"
                style={{ background: glowColor }}
              >
                {unreadCount}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </>
  )
}
