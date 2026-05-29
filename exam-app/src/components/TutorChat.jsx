import { useState, useEffect, useRef } from 'react'
import Markdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { sendTutorMessage } from '../api/aiClient.js'
import { useOracle } from '../context/OracleContext.jsx'

const MIN_WIDTH = 280
const MAX_WIDTH = 720
const DEFAULT_WIDTH = 384
const STORAGE_KEY = 'tutor-panel-width'

export default function TutorChat({ open, onClose }) {
  const { pageContext: examContext, suggestedPrompts } = useOracle()
  const [messages, setMessages] = useState([])
  const [hasText, setHasText] = useState(false)
  const [loading, setLoading] = useState(false)
  const [panelWidth, setPanelWidth] = useState(
    () => Number(localStorage.getItem(STORAGE_KEY)) || DEFAULT_WIDTH
  )
  const isDragging = useRef(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const isComposing = useRef(false)

  // Send greeting on first open
  useEffect(() => {
    if (!open || messages.length > 0) return
    sendGreeting()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Trap focus when open
  useEffect(() => {
    if (!open) return
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  async function sendGreeting() {
    setLoading(true)
    const { data } = await sendTutorMessage({ messages: [], exam_context: examContext })
    setLoading(false)
    if (data) setMessages(data.messages)
  }

  async function handleSend() {
    const text = (inputRef.current?.value || '').trim()
    if (!text || loading) return
    if (inputRef.current) inputRef.current.value = ''
    setHasText(false)
    const newMessages = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setLoading(true)
    const { data, error } = await sendTutorMessage({ messages: newMessages, exam_context: examContext })
    setLoading(false)
    if (data) {
      setMessages(data.messages)
    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: `Lỗi: ${error}` }])
    }
  }

  async function sendChip(text) {
    if (loading) return
    const newMessages = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setLoading(true)
    const { data, error } = await sendTutorMessage({ messages: newMessages, exam_context: examContext })
    setLoading(false)
    if (data) setMessages(data.messages)
    else setMessages(prev => [...prev, { role: 'assistant', content: `Lỗi: ${error}` }])
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing.current) {
      e.preventDefault()
      handleSend()
    }
  }

  function startDrag(e) {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    function onMove(ev) {
      if (!isDragging.current) return
      const w = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - ev.clientX))
      setPanelWidth(w)
    }

    function onUp(ev) {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      const w = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - ev.clientX))
      localStorage.setItem(STORAGE_KEY, String(w))
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="AI Gia sư"
        className="fixed top-0 right-0 h-full z-50 flex flex-col bg-[#0D1221] border-l border-[#1E2A44] transition-opacity duration-200"
        style={{
          width: panelWidth,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        {/* Drag handle */}
        <div
          onMouseDown={startDrag}
          className="absolute top-0 left-0 h-full w-1.5 z-10 cursor-col-resize group flex items-center justify-start"
          title="Kéo để thay đổi kích thước"
        >
          <div className="w-0.5 h-12 rounded-full bg-[#1E2A44] group-hover:bg-[#F2A20C] transition-colors duration-150 ml-0.5" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E2A44]">
          <div className="flex items-center gap-2">
            <span className="text-[#F2A20C]">✦</span>
            <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">AI Gia Sư</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[#475569] hover:text-[#F8FAFC] hover:bg-[#1E2A44] transition"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {messages.filter(m => m.role !== 'system').map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl font-jakarta text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#F2A20C] text-[#0A0E1A] font-medium rounded-br-sm'
                    : 'bg-[#111827] border border-[#1E2A44] text-[#CBD5E1] rounded-bl-sm prose-tutor'
                }`}
              >
                {msg.role === 'user' ? msg.content : (
                  <Markdown
                    remarkPlugins={[[remarkMath, { singleDollarTextMath: true }], remarkGfm]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="text-[#F2A20C] font-semibold">{children}</strong>,
                      ul: ({ children }) => <ul className="list-disc pl-4 mb-1 space-y-0.5">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 mb-1 space-y-0.5">{children}</ol>,
                      li: ({ children }) => <li className="leading-snug">{children}</li>,
                      pre: ({ children }) => <pre className="bg-[#1E2A44] text-[#93C5FD] p-2 rounded text-[12px] font-mono overflow-x-auto my-1">{children}</pre>,
                      code: ({ children }) => <code className="bg-[#1E2A44] text-[#93C5FD] px-1 rounded text-[12px] font-mono">{children}</code>,
                      table: ({ children }) => <div className="overflow-x-auto my-2"><table className="w-full text-[12px] border-collapse">{children}</table></div>,
                      thead: ({ children }) => <thead className="bg-[#1E2A44]">{children}</thead>,
                      th: ({ children }) => <th className="px-2 py-1.5 text-left text-[#F2A20C] font-semibold border border-[#2A3A60]">{children}</th>,
                      td: ({ children }) => <td className="px-2 py-1.5 text-[#CBD5E1] border border-[#1E2A44]">{children}</td>,
                      tr: ({ children }) => <tr className="even:bg-[#0F1628]">{children}</tr>,
                    }}
                  >
                    {msg.content}
                  </Markdown>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#111827] border border-[#1E2A44] px-4 py-3 rounded-2xl rounded-bl-sm">
                <span className="font-jakarta text-[13px] text-[#475569]">Đang soạn…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggested prompts — show when only the greeting exists */}
        {messages.filter(m => m.role !== 'system').length <= 1 && !loading && suggestedPrompts?.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {suggestedPrompts.map(p => (
              <button
                key={p}
                onClick={() => sendChip(p)}
                className="px-3 py-1.5 rounded-full border border-[#1E2A44] font-jakarta text-[12px] text-[#64748B] hover:border-amber-500 hover:text-amber-400 transition"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 border-t border-[#1E2A44] flex gap-2">
          <textarea
            ref={inputRef}
            onInput={e => setHasText(e.target.value.trim().length > 0)}
            onCompositionStart={() => { isComposing.current = true }}
            onCompositionEnd={e => {
              isComposing.current = false
              setHasText(e.target.value.trim().length > 0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Hỏi gia sư..."
            rows={1}
            disabled={loading}
            className="flex-1 bg-[#111827] border border-[#1E2A44] rounded-xl px-3 py-2 font-jakarta text-[13px] text-[#F8FAFC] placeholder-[#475569] resize-none focus:outline-none focus:border-[#F2A20C] transition disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={loading || !hasText}
            className="px-4 py-2 rounded-xl font-jakarta text-[12px] font-bold text-[#0A0E1A] disabled:opacity-40 transition"
            style={{ background: 'linear-gradient(180deg, #F2A20C 0%, #D97706 100%)' }}
          >
            Gửi
          </button>
        </div>
      </div>
    </>
  )
}
