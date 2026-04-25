import { useState, useEffect, useRef } from 'react'
import { sendTutorMessage } from '../api/aiClient.js'

export default function TutorChat({ open, onClose, examContext }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

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
    const text = input.trim()
    if (!text || loading) return
    const newMessages = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    const { data, error } = await sendTutorMessage({ messages: newMessages, exam_context: examContext })
    setLoading(false)
    if (data) {
      setMessages(data.messages)
    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: `Lỗi: ${error}` }])
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
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
        className="fixed top-0 right-0 h-full w-full max-w-sm z-50 flex flex-col bg-[#0D1221] border-l border-[#1E2A44] transition-transform duration-300"
        style={{ transform: open ? 'translateX(0)' : 'translateX(100%)' }}
      >
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
                    : 'bg-[#111827] border border-[#1E2A44] text-[#CBD5E1] rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#111827] border border-[#1E2A44] px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[#475569] animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-[#1E2A44] flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Hỏi gia sư..."
            rows={1}
            disabled={loading}
            className="flex-1 bg-[#111827] border border-[#1E2A44] rounded-xl px-3 py-2 font-jakarta text-[13px] text-[#F8FAFC] placeholder-[#475569] resize-none focus:outline-none focus:border-[#F2A20C] transition disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
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
