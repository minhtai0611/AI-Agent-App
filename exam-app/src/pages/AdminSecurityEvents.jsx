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
      <span className="px-2 py-0.5 rounded-full font-jakarta text-[11px] font-bold bg-red-500/20 text-red-400">
        HIGH
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 rounded-full font-jakarta text-[11px] font-bold bg-amber-500/20 text-amber-400">
      MEDIUM
    </span>
  )
}

function UserStatusChip({ isSuspended }) {
  if (isSuspended) {
    return (
      <span className="px-2 py-0.5 rounded-full font-jakarta text-[11px] font-bold bg-red-500/20 text-red-400">
        suspended
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 rounded-full font-jakarta text-[11px] font-bold bg-emerald-500/20 text-emerald-400">
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
    <div className="min-h-screen bg-[#0A0E1A] px-4 py-8">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="font-fraunces text-[22px] font-bold text-[#F8FAFC]">
            Security Events Dashboard
          </h1>
          <div className="flex items-center gap-2">
            {lastFetched && (
              <span className="font-jakarta text-[11px] text-[#475569]">
                Cập nhật lúc {formatTs(lastFetched.toISOString())}
              </span>
            )}
            {adminKey && (
              <button
                onClick={() => fetchEvents(adminKey)}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg font-jakarta text-[12px] font-semibold border border-[#1E2A44] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#2E3A54] transition disabled:opacity-50"
              >
                {loading ? 'Đang tải...' : 'Làm mới'}
              </button>
            )}
          </div>
        </div>

        {/* Admin key input or clear button */}
        {!adminKey ? (
          <form onSubmit={handleKeySubmit} className="flex flex-col gap-3 bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-6 max-w-md">
            <label className="font-jakarta text-[13px] font-semibold text-[#94A3B8]">
              Nhập Admin Key để tiếp tục
            </label>
            <input
              type="password"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              placeholder="Admin key…"
              className="px-4 py-2.5 rounded-xl border border-[#1E2A44] bg-[#111827] font-jakarta text-[13px] text-[#F0F4FF] placeholder-[#334155] focus:outline-none focus:border-amber-400 transition"
              autoFocus
            />
            {error && (
              <p className="font-jakarta text-[12px] text-red-400">{error}</p>
            )}
            <button
              type="submit"
              className="py-2.5 rounded-xl font-jakarta text-[13px] font-bold text-[#0A0E1A] transition"
              style={{ background: '#F2A20C' }}
            >
              Xác nhận
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-jakarta text-[12px] text-[#475569]">
              Key: <span className="text-[#64748B]">{'•'.repeat(8)}</span>
            </span>
            <button
              onClick={handleClearKey}
              className="px-3 py-1.5 rounded-lg font-jakarta text-[12px] border border-red-500/30 text-red-400 hover:border-red-500/60 transition"
            >
              Xoá key
            </button>
          </div>
        )}

        {/* Error state (when key is set but fetch failed) */}
        {adminKey && error && (
          <p className="font-jakarta text-[13px] text-red-400">{error}</p>
        )}

        {/* Events table */}
        {adminKey && !error && (
          <div className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl overflow-hidden">
            {loading && events.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <span className="font-jakarta text-[13px] text-[#475569]">Đang tải…</span>
              </div>
            ) : events.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <span className="font-jakarta text-[13px] text-[#475569]">Không có sự kiện nào.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-[#1E2A44]">
                      {['Thời gian', 'Loại sự kiện', 'Mức độ', 'User ID', 'Chi tiết', 'Trạng thái'].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-jakarta text-[11px] font-semibold text-[#475569] uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((ev, i) => (
                      <tr
                        key={ev.id ?? i}
                        className="border-b border-[#1E2A44]/50 hover:bg-[#111827]/60 transition"
                      >
                        <td className="px-4 py-3 font-jakarta text-[12px] text-[#64748B] whitespace-nowrap">
                          {formatTs(ev.created_at)}
                        </td>
                        <td className="px-4 py-3 font-jakarta text-[12px] text-[#94A3B8] whitespace-nowrap">
                          {ev.event_type || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <SeverityBadge severity={ev.confidence} />
                        </td>
                        <td className="px-4 py-3 font-jakarta text-[12px] text-[#64748B] whitespace-nowrap">
                          {ev.user_id || '—'}
                        </td>
                        <td className="px-4 py-3 font-jakarta text-[12px] text-[#94A3B8] max-w-[260px]">
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
            <div className="px-4 py-2 border-t border-[#1E2A44]/50">
              <span className="font-jakarta text-[11px] text-[#334155]">
                {events.length} sự kiện HIGH/MEDIUM
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
