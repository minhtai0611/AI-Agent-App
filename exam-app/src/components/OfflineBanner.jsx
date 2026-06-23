import { useState, useEffect } from 'react'
import { getPendingCount } from '../utils/offlineSync'
import { Button } from './ui/button.jsx'

export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine)
  const [dismissed, setDismissed] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    function onOnline() {
      setOnline(true)
      setDismissed(false)
      if (getPendingCount() > 0) {
        setSyncing(true)
        // Hide syncing indicator after 3s (flush happens in HistoryContext)
        setTimeout(() => setSyncing(false), 3000)
      }
    }
    function onOffline() { setOnline(false); setSyncing(false) }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  if (syncing) {
    return (
      <div className="fixed top-12 left-0 right-0 z-30 flex items-center gap-3 px-4 py-2 glass-base border-b border-success/20">
        <span className="w-3 h-3 rounded-full border border-success border-t-transparent animate-spin flex-shrink-0" />
        <span className="font-sans text-[12px] text-success">Đã có mạng — đang đồng bộ kết quả...</span>
      </div>
    )
  }

  if (online || dismissed) return null

  return (
    <div className="fixed top-12 left-0 right-0 z-30 flex items-center justify-between px-4 py-2 glass-base border-b border-primary/20">
      <span className="font-sans text-[12px] text-primary/80">
        Không có mạng — tính năng AI không khả dụng · Đề thi vẫn hoạt động bình thường
      </span>
      <Button
        variant="ghost"
        onClick={() => setDismissed(true)}
        className="text-dim hover:text-muted ml-3 flex-shrink-0 h-auto p-0 text-lg leading-none"
        aria-label="Đóng"
      >×</Button>
    </div>
  )
}
