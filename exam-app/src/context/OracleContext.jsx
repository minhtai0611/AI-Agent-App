import { createContext, useContext, useState, useMemo, useCallback } from 'react'

const OracleContext = createContext(null)

// Derive suggested prompts from current page context
function deriveSuggestedPrompts(pageContext) {
  if (!pageContext || Object.keys(pageContext).length === 0) {
    return ['Giải thích khái niệm', 'Hỏi bài toán', 'Kế hoạch ôn tập']
  }
  if (pageContext.inExam && pageContext.mode === 'timed') {
    return ['Gợi ý hướng giải', 'Giải thích khái niệm này', 'Câu này thuộc chủ đề gì?']
  }
  if (pageContext.inExam) {
    return ['Hướng dẫn từng bước', 'Giải thích công thức', 'Câu tương tự?']
  }
  if (pageContext.weakTopics?.length > 0) {
    return ['Tôi nên ôn gì trước?', 'Phân tích điểm yếu của tôi', 'Lập kế hoạch ôn tập']
  }
  if (pageContext.currentQuestion) {
    return ['Giải thích bài này', 'Gợi ý hướng đi', 'Tại sao đáp án sai?']
  }
  return ['Hỏi bài toán', 'Giải thích khái niệm', 'Kế hoạch ôn tập']
}

// oracleStatus drives the bubble CSS state machine:
//   'idle'        — default gentle pulse
//   'thinking'    — faster pulse while waiting for AI response
//   'celebrating' — spring pop on high-confidence correct answer
//   'error'       — subtle shake on validation failure
export const ORACLE_STATUS = { IDLE: 'idle', THINKING: 'thinking', CELEBRATING: 'celebrating', ERROR: 'error' }

export function OracleProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false)
  const [pageContext, setPageContextRaw] = useState({})
  const [unreadCount, setUnreadCount] = useState(0)
  const [oracleStatus, setOracleStatus] = useState(ORACLE_STATUS.IDLE)

  const open = useCallback(() => {
    setIsOpen(true)
    setUnreadCount(0)
  }, [])
  const close = useCallback(() => setIsOpen(false), [])

  const setPageContext = useCallback((ctx) => {
    setPageContextRaw(ctx || {})
  }, [])

  const suggestedPrompts = useMemo(() => deriveSuggestedPrompts(pageContext), [pageContext])

  const value = useMemo(() => ({
    isOpen, open, close,
    pageContext, setPageContext,
    suggestedPrompts,
    unreadCount, setUnreadCount,
    oracleStatus, setOracleStatus,
  }), [isOpen, open, close, pageContext, setPageContext, suggestedPrompts, unreadCount, oracleStatus])

  return <OracleContext.Provider value={value}>{children}</OracleContext.Provider>
}

export function useOracle() {
  const ctx = useContext(OracleContext)
  if (!ctx) throw new Error('useOracle must be used within OracleProvider')
  return ctx
}
