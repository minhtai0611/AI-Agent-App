import { useState, useEffect } from 'react'

const DISMISSED_KEY = 'pwa_install_dismissed'

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return
    const handler = e => {
      e.preventDefault()
      setPrompt(e)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    setVisible(false)
    localStorage.setItem(DISMISSED_KEY, '1')
  }

  async function install() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setVisible(false)
    else dismiss()
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-16 left-4 right-4 z-50 max-w-sm mx-auto"
      style={{ background: '#0D1221', border: '1px solid #F2A20C33', borderRadius: 16, padding: '16px 20px' }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-jakarta text-[13px] font-semibold text-[#F8FAFC]">Thêm vào màn hình chính</span>
          <span className="font-jakarta text-[11px] text-[#64748B]">Trải nghiệm nhanh hơn, offline được</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={install}
            className="px-4 py-1.5 rounded-lg font-jakarta text-[12px] font-bold"
            style={{ background: '#F2A20C', color: '#0A0E1A' }}
          >
            Thêm
          </button>
          <button onClick={dismiss} className="text-[#475569] hover:text-[#94A3B8] text-lg leading-none">×</button>
        </div>
      </div>
    </div>
  )
}
