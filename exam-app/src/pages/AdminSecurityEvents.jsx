import { useState, useEffect, useCallback } from 'react'
import { adminGetSecurityEvents } from '../api/aiClient.js'

const SESSION_KEY = 'admin_security_key'

function formatTs(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${dd}/${mm} ${hh}:${min}`
  } catch { return iso }
}

function truncate(str, n = 80) {
  if (!str) return '—'
  return str.length > n ? str.slice(0, n) + '…' : str
}

function SeverityBadge({ severity }) {
  if (!severity) return null
  const upper = severity.toUpperCase()
  if (upper === 'HIGH') {
    return (
      <span className="px-2 py-0.5 rounded-full font-sans text-[11px] font-bold bg-[var(--destructive)]/20 text-[var(--destructive)]">
        HIGH
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 rounded-full font-sans text-[11px] font-bold bg-[var(--warning)]/20 text-[var(--warning)]">
      MEDIUM
    </span>
  )
}

function UserStatusChip({ isSuspended }) {
  if (isSuspended) {
    return (
      <span className="px-2 py-0.5 rounded-full font-sans text-[11px] font-bold bg-[var(--destructive)]/20 text-[var(--destructive)]">
        suspended
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 rounded-full font-sans text-[11px] font-bold bg-success/20 text-success">
      active
    </span>
  )
}

export default function AdminSecurityEvents() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem(SESSION_KEY) || '')
  const [keyInput, setKeyInput] = useState('')
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastFetched, setLastFetched] = useState(null)

  const fetchEvents = useCallback(async (key) => {
    if (!key) return
    setLoading(true)
    setError('')
    const { data, error: err, status } = await adminGetSecurityEvents(key)
    setLoading(false)
    if (status === 401 || status === 403) {
      setError('Sai admin key')
      sessionStorage.removeItem(SESSION_KEY)
      setAdminKey('')
      return
    }
    if (err) {
      setError(typeof err === 'string' ? err : 'Lỗi tải dữ liệu')
      return
    }
    setEvents(Array.isArray(data) ? data : [])
    setLastFetched(new Date())
  }, [])

  useEffect(() => {
    if (adminKey) fetchEvents(adminKey)
  }, [adminKey, fetchEvents])

  function handleKeySubmit(e) {
    e.preventDefault()
    const trimmed = keyInput.trim()
    if (!trimmed) return
    sessionStorage.setItem(SESSION_KEY, trimmed)
    setAdminKey(trimmed)
    setKeyInput('')
  }

  function handleClearKey() {
    sessionStorage.removeItem(SESSION_KEY)
    setAdminKey('')
    setEvents([])
    setError('')
  }

  return (
    <div className="min-h-screen bg-surface px-4 py-8">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="font-sans text-[22px] font-bold text-foreground">
            Security Events Dashboard
          </h1>
          <div className="flex items-center gap-2">
            {lastFetched && (
              <span className="font-sans text-[11px] text-dim">
                Cập nhật lúc {formatTs(lastFetched.toISOString())}
              </span>
            )}
            {adminKey && (
              <button
                onClick={() => fetchEvents(adminKey)}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg font-sans text-[12px] font-semibold border border-surface text-muted hover:text-foreground hover:border-surface transition disabled:opacity-50"
              >
                {loading ? 'Đang tải...' : 'Làm mới'}
              </button>
            )}
          </div>
        </div>

        {/* Admin key input or clear button */}
        {!adminKey ? (
          <form onSubmit={handleKeySubmit} className="flex flex-col gap-3 glass-base border border-surface rounded-2xl p-6 max-w-md">
            <label className="font-sans text-[13px] font-semibold text-muted">
              Nhập Admin Key để tiếp tục
            </label>
            <input
              type="password"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              placeholder="Admin key…"
              className="px-4 py-2.5 rounded-xl border border-surface bg-surface font-sans text-[13px] text-foreground placeholder-[#334155] focus:outline-none focus:border-[var(--accent-border)] transition"
              autoFocus
            />
            {error && (
              <p className="font-sans text-[12px] text-[var(--destructive)]">{error}</p>
            )}
            <button
              type="submit"
              className="py-2.5 rounded-xl font-sans text-[13px] font-bold text-background transition bg-primary"
            >
              Xác nhận
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-sans text-[12px] text-dim">
              Key: <span className="text-dim">{'•'.repeat(8)}</span>
            </span>
            <button
              onClick={handleClearKey}
              className="px-3 py-1.5 rounded-lg font-sans text-[12px] border border-[var(--destructive)]/30 text-[var(--destructive)] hover:border-[var(--destructive)]/60 transition"
            >
              Xoá key
            </button>
          </div>
        )}

        {/* Error state (when key is set but fetch failed) */}
        {adminKey && error && (
          <p className="font-sans text-[13px] text-[var(--destructive)]">{error}</p>
        )}

        {/* Events table */}
        {adminKey && !error && (
          <div className="glass-base border border-surface rounded-2xl overflow-hidden">
            {loading && events.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <span className="font-sans text-[13px] text-dim">Đang tải…</span>
              </div>
            ) : events.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <span className="font-sans text-[13px] text-dim">Không có sự kiện nào.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-surface">
                      {['Thời gian', 'Loại sự kiện', 'Mức độ', 'User ID', 'Chi tiết', 'Trạng thái'].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-sans text-[11px] font-semibold text-dim uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((ev, i) => (
                      <tr
                        key={ev.id ?? i}
                        className="border-b border-surface/50 hover:bg-surface/60 transition"
                      >
                        <td className="px-4 py-3 font-sans text-[12px] text-dim whitespace-nowrap">
                          {formatTs(ev.created_at)}
                        </td>
                        <td className="px-4 py-3 font-sans text-[12px] text-muted whitespace-nowrap">
                          {ev.event_type || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <SeverityBadge severity={ev.confidence} />
                        </td>
                        <td className="px-4 py-3 font-sans text-[12px] text-dim whitespace-nowrap">
                          {ev.user_id || '—'}
                        </td>
                        <td className="px-4 py-3 font-sans text-[12px] text-muted max-w-[260px]">
                          <span title={ev.detail || ''}>
                            {truncate(ev.detail)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <UserStatusChip isSuspended={ev.is_suspended} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="px-4 py-2 border-t border-surface/50">
              <span className="font-sans text-[11px] text-dim">
                {events.length} sự kiện HIGH/MEDIUM
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
