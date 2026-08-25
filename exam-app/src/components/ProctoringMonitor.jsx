import { useState, useEffect, useRef } from 'react'
import { useOrgAuth } from '../context/OrgAuthContext.jsx'
import { postProctoringSession, postProctoringEvent } from '../api/org.js'

// Institutions Phase 3 — visible half of the proctoring scaffold. No camera/identity vendor
// is wired up yet (see backend/app/proctoring/vendor_client.py); this widget only surfaces
// the tier the org has opted into and forwards signals TestInterface already tracks
// (tab-switch count, dev-tools open) as proctoring events. Silently inert for anonymous/local
// exam sessions and for orgs with the proctoring tier set to 'none'.
const TIER_LABELS = {
  ai_review: 'AI đang rà soát',
  identity_plus_ai: 'Xác minh danh tính + AI',
  human_escalation: 'Giám sát viên trực tiếp',
}

export default function ProctoringMonitor({ examId, stakesTier = 'low', tabSwitchCount = 0, devToolsOpen = false }) {
  const { isOrgSession } = useOrgAuth()
  const [session, setSession] = useState(null)
  const lastTabCount = useRef(0)
  const devToolsFlagged = useRef(false)

  useEffect(() => {
    if (!isOrgSession) return
    let cancelled = false
    postProctoringSession(examId, stakesTier)
      .then(s => { if (!cancelled && s.tier !== 'none') setSession(s) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [isOrgSession, examId, stakesTier])

  useEffect(() => {
    if (!session || tabSwitchCount <= lastTabCount.current) return
    lastTabCount.current = tabSwitchCount
    postProctoringEvent(session.id, {
      type: 'tab_switch', severity: tabSwitchCount >= 3 ? 'high' : 'medium', count: tabSwitchCount,
    }).catch(() => {})
  }, [session, tabSwitchCount])

  useEffect(() => {
    if (!session || !devToolsOpen || devToolsFlagged.current) return
    devToolsFlagged.current = true
    postProctoringEvent(session.id, { type: 'devtools_open', severity: 'high' }).catch(() => {})
  }, [session, devToolsOpen])

  if (!session) return null

  return (
    <div
      className="fixed top-14 right-3 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--border)] bg-[var(--surface-elevated)]"
      title="Bài thi này đang được tổ chức của bạn giám sát"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
      <span className="font-sans text-[10px] font-medium text-dim">{TIER_LABELS[session.tier] ?? 'Giám sát'}</span>
    </div>
  )
}
