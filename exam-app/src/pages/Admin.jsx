import { useState, useEffect, useCallback, useRef } from 'react'
import {
  adminListUsers, adminDeleteUser, adminUnlockUser, adminResetUser,
  adminSuspendUser, adminUnsuspendUser, adminGrantCredits, adminGetSecurityEvents,
} from '../api/aiClient.js'

const CONFIDENCE_COLOR = { high: '#EF4444', medium: '#F2A20C', low: '#64748B' }

function formatDate(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) } catch { return iso }
}

function StatusBadge({ user }) {
  if (user.is_locked) return <span className="px-2 py-0.5 rounded-full font-jakarta text-[11px] font-bold bg-red-500/20 text-red-400">Khóa</span>
  if (user.is_suspended) return <span className="px-2 py-0.5 rounded-full font-jakarta text-[11px] font-bold bg-amber-500/20 text-amber-400">Tạm khoá</span>
  if (user.is_deactivated) return <span className="px-2 py-0.5 rounded-full font-jakarta text-[11px] font-bold bg-slate-500/20 text-slate-400">Tạm ngưng</span>
  return <span className="px-2 py-0.5 rounded-full font-jakarta text-[11px] font-bold bg-emerald-500/20 text-emerald-400">Hoạt động</span>
}

function GrantCreditsModal({ user, adminKey, onClose, onDone }) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    const n = parseInt(amount, 10)
    if (!n || n <= 0) { setError('Số Tia phải lớn hơn 0'); return }
    setLoading(true)
    const { error: err } = await adminGrantCredits(adminKey, user.id, n)
    setLoading(false)
    if (err) { setError(typeof err === 'string' ? err : 'Thất bại'); return }
    onDone()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="max-w-sm w-full bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-6 flex flex-col gap-4">
        <span className="font-fraunces text-[15px] font-bold text-[#F8FAFC]">Tặng Tia — {user.display_name || user.email}</span>
        <input
          type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-[#1E2A44] bg-[#111827] font-jakarta text-[13px] text-[#F0F4FF] focus:outline-none focus:border-amber-400"
          placeholder="Số Tia"
        />
        {error && <p className="font-jakarta text-[12px] text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button onClick={submit} disabled={loading} className="flex-1 py-2 rounded-lg font-jakarta text-[13px] font-bold" style={{ background: '#F2A20C', color: '#0A0E1A', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Đang gửi...' : 'Xác nhận'}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg font-jakarta text-[13px] text-[#64748B] hover:text-[#F8FAFC] transition">Huỷ</button>
        </div>
      </div>
    </div>
  )
}

function SuspendModal({ user, adminKey, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setLoading(true)
    const { error: err } = await adminSuspendUser(adminKey, user.id, reason)
    setLoading(false)
    if (err) { setError(typeof err === 'string' ? err : 'Thất bại'); return }
    onDone()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="max-w-sm w-full bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-6 flex flex-col gap-4">
        <span className="font-fraunces text-[15px] font-bold text-amber-400">Tạm khoá — {user.display_name || user.email}</span>
        <input
          value={reason} onChange={e => setReason(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-[#1E2A44] bg-[#111827] font-jakarta text-[13px] text-[#F0F4FF] focus:outline-none focus:border-amber-400"
          placeholder="Lý do (tuỳ chọn)"
        />
        {error && <p className="font-jakarta text-[12px] text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button onClick={submit} disabled={loading} className="flex-1 py-2 rounded-lg font-jakarta text-[13px] font-bold border border-amber-400/40 text-amber-400 hover:bg-amber-400/10 transition">
            {loading ? 'Đang xử lý...' : 'Tạm khoá'}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg font-jakarta text-[13px] text-[#64748B] hover:text-[#F8FAFC] transition">Huỷ</button>
        </div>
      </div>
    </div>
  )
}

function ResetModal({ user, adminKey, onClose, onDone }) {
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setLoading(true)
    const { error: err } = await adminResetUser(adminKey, user.id)
    setLoading(false)
    if (err) { setError(typeof err === 'string' ? err : 'Thất bại'); return }
    onDone()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="max-w-sm w-full bg-[#0D1221] border border-red-500/30 rounded-2xl p-6 flex flex-col gap-4">
        <span className="font-fraunces text-[15px] font-bold text-red-400">Reset tài khoản — {user.display_name || user.email}</span>
        <p className="font-jakarta text-[12px] text-[#94A3B8]">Hành động này sẽ xóa toàn bộ dữ liệu và đưa tài khoản về trạng thái ban đầu. Không thể hoàn tác.</p>
        <input
          value={confirm} onChange={e => setConfirm(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-[#1E2A44] bg-[#111827] font-jakarta text-[13px] text-[#F0F4FF] focus:outline-none focus:border-red-400"
          placeholder={`Gõ "RESET" để xác nhận`}
        />
        {error && <p className="font-jakarta text-[12px] text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button onClick={submit} disabled={loading || confirm !== 'RESET'} className="flex-1 py-2 rounded-lg font-jakarta text-[13px] font-bold disabled:opacity-40 transition" style={{ background: '#EF4444', color: '#fff' }}>
            {loading ? 'Đang reset...' : 'Xác nhận Reset'}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg font-jakarta text-[13px] text-[#64748B] hover:text-[#F8FAFC] transition">Huỷ</button>
        </div>
      </div>
    </div>
  )
}

function DeleteUserModal({ user, adminKey, onClose, onDone }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setLoading(true)
    const { error: err } = await adminDeleteUser(adminKey, user.id)
    setLoading(false)
    if (err) { setError(typeof err === 'string' ? err : 'Thất bại'); return }
    onDone()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="max-w-sm w-full bg-[#0D1221] border border-red-500/30 rounded-2xl p-6 flex flex-col gap-4">
        <span className="font-fraunces text-[15px] font-bold text-red-400">Xóa tài khoản vĩnh viễn</span>
        <p className="font-jakarta text-[12px] text-[#94A3B8]">Tài khoản <strong className="text-[#F8FAFC]">{user.email}</strong> và toàn bộ dữ liệu sẽ bị xóa vĩnh viễn.</p>
        {error && <p className="font-jakarta text-[12px] text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button onClick={submit} disabled={loading} className="flex-1 py-2 rounded-lg font-jakarta text-[13px] font-bold transition" style={{ background: '#EF4444', color: '#fff', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg font-jakarta text-[13px] text-[#64748B] hover:text-[#F8FAFC] transition">Huỷ</button>
        </div>
      </div>
    </div>
  )
}

function getOnlineStatus(lastSeenAt) {
  if (!lastSeenAt) return { status: 'unknown', label: 'Chưa hoạt động' }
  const diff = (Date.now() - new Date(lastSeenAt).getTime()) / 1000
  if (diff < 120) return { status: 'online', label: 'Đang online' }
  if (diff < 3600) return { status: 'offline', label: `${Math.floor(diff / 60)} phút trước` }
  if (diff < 86400) return { status: 'offline', label: `${Math.floor(diff / 3600)} giờ trước` }
  return { status: 'offline', label: `${Math.floor(diff / 86400)} ngày trước` }
}

function UserRow({ user, adminKey, onRefresh }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [modal, setModal] = useState(null) // 'grant' | 'suspend' | 'reset' | 'delete'
  const [actionLoading, setActionLoading] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function onClickOutside(e) { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function handleUnsuspend() {
    setActionLoading(true)
    await adminUnsuspendUser(adminKey, user.id)
    setActionLoading(false)
    setMenuOpen(false)
    onRefresh()
  }

  async function handleUnlock() {
    setActionLoading(true)
    await adminUnlockUser(adminKey, user.id)
    setActionLoading(false)
    setMenuOpen(false)
    onRefresh()
  }

  return (
    <>
      <div className="flex items-center gap-3 py-3 border-b border-[#1E2A44] last:border-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {(() => { const { status, label } = getOnlineStatus(user.last_seen_at); return (
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} title={label} />
            )})()}
            <span className="font-jakarta text-[13px] font-semibold text-[#F0F4FF] truncate">{user.display_name || '—'}</span>
            <StatusBadge user={user} />
            {user.pending_deletion_at && (
              <span className="px-2 py-0.5 rounded-full font-jakarta text-[11px] font-bold bg-red-500/20 text-red-400">
                Xóa {new Date(user.pending_deletion_at).toLocaleDateString('vi-VN')}
              </span>
            )}
          </div>
          <span className="font-jakarta text-[11px] text-[#64748B]">{user.email}</span>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-0.5">
          <span className="font-jakarta text-[11px] text-[#94A3B8]">{user.subscription_tier}</span>
          <span className="font-jakarta text-[11px] text-amber-400">⚡ {user.credits_balance ?? 0}</span>
        </div>
        <div className="hidden md:flex items-center gap-1.5">
          {(user.last_tab_switches ?? 0) > 0 && (
            <span className={`font-jakarta text-[11px] px-1.5 py-0.5 rounded-full ${(user.last_tab_switches ?? 0) > 5 ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'}`}
              title="Tab switches in last exam">
              ↹ {user.last_tab_switches}
            </span>
          )}
          {user.last_devtools === 1 && (
            <span className="font-jakarta text-[11px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400" title="DevTools detected in last exam">
              {'</>'}
            </span>
          )}
        </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            disabled={actionLoading}
            className="px-3 py-1.5 rounded-lg font-jakarta text-[11px] text-[#94A3B8] border border-[#1E2A44] hover:text-[#F8FAFC] hover:border-[#475569] transition"
          >
            {actionLoading ? '...' : 'Thao tác ▾'}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-20 w-44 bg-[#111827] border border-[#1E2A44] rounded-xl shadow-xl overflow-hidden">
              {user.is_suspended ? (
                <button onClick={handleUnsuspend} className="w-full px-4 py-2.5 font-jakarta text-[12px] text-left text-emerald-400 hover:bg-[#1E2A44] transition">Bỏ tạm khoá</button>
              ) : (
                <button onClick={() => { setModal('suspend'); setMenuOpen(false) }} className="w-full px-4 py-2.5 font-jakarta text-[12px] text-left text-amber-400 hover:bg-[#1E2A44] transition">Tạm khoá</button>
              )}
              {user.is_locked && (
                <button onClick={handleUnlock} className="w-full px-4 py-2.5 font-jakarta text-[12px] text-left text-emerald-400 hover:bg-[#1E2A44] transition">Mở khóa</button>
              )}
              <button onClick={() => { setModal('grant'); setMenuOpen(false) }} className="w-full px-4 py-2.5 font-jakarta text-[12px] text-left text-[#94A3B8] hover:bg-[#1E2A44] transition">Tặng Tia</button>
              <div className="border-t border-[#1E2A44]" />
              <button onClick={() => { setModal('reset'); setMenuOpen(false) }} className="w-full px-4 py-2.5 font-jakarta text-[12px] text-left text-amber-400 hover:bg-[#1E2A44] transition">Reset tài khoản</button>
              <button onClick={() => { setModal('delete'); setMenuOpen(false) }} className="w-full px-4 py-2.5 font-jakarta text-[12px] text-left text-red-400 hover:bg-[#1E2A44] transition">Xóa tài khoản</button>
            </div>
          )}
        </div>
      </div>

      {modal === 'grant' && <GrantCreditsModal user={user} adminKey={adminKey} onClose={() => setModal(null)} onDone={onRefresh} />}
      {modal === 'suspend' && <SuspendModal user={user} adminKey={adminKey} onClose={() => setModal(null)} onDone={onRefresh} />}
      {modal === 'reset' && <ResetModal user={user} adminKey={adminKey} onClose={() => setModal(null)} onDone={onRefresh} />}
      {modal === 'delete' && <DeleteUserModal user={user} adminKey={adminKey} onClose={() => setModal(null)} onDone={onRefresh} />}
    </>
  )
}

function UsersTab({ adminKey }) {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const searchTimeout = useRef(null)
  const LIMIT = 20

  const fetchUsers = useCallback(async (s = search, p = page) => {
    setLoading(true)
    const { data, error } = await adminListUsers(adminKey, { search: s, page: p, limit: LIMIT })
    setLoading(false)
    if (data) { setUsers(data.users ?? data); setTotal(data.total ?? data.length) }
  }, [adminKey, search, page])

  useEffect(() => { fetchUsers(search, page) }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearchChange(e) {
    const val = e.target.value
    setSearch(val)
    setPage(1)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => fetchUsers(val, 1), 400)
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        value={search} onChange={handleSearchChange}
        className="px-4 py-2.5 rounded-xl border border-[#1E2A44] bg-[#111827] font-jakarta text-[13px] text-[#F0F4FF] focus:outline-none focus:border-amber-400"
        placeholder="Tìm theo email hoặc tên..."
      />

      {loading ? (
        <div className="flex justify-center py-10 font-jakarta text-[#475569] text-[13px] animate-pulse">Đang tải...</div>
      ) : users.length === 0 ? (
        <div className="flex justify-center py-10 font-jakarta text-[#475569] text-[13px]">Không tìm thấy người dùng</div>
      ) : (
        <div className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl px-5 py-2">
          {users.map(u => (
            <UserRow key={u.id} user={u} adminKey={adminKey} onRefresh={() => fetchUsers(search, page)} />
          ))}
        </div>
      )}

      {total > LIMIT && (
        <div className="flex items-center justify-center gap-3">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg font-jakarta text-[12px] border border-[#1E2A44] text-[#94A3B8] disabled:opacity-40 hover:text-[#F8FAFC] transition">← Trước</button>
          <span className="font-jakarta text-[12px] text-[#64748B]">Trang {page} / {Math.ceil(total / LIMIT)}</span>
          <button disabled={page >= Math.ceil(total / LIMIT)} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg font-jakarta text-[12px] border border-[#1E2A44] text-[#94A3B8] disabled:opacity-40 hover:text-[#F8FAFC] transition">Sau →</button>
        </div>
      )}
    </div>
  )
}

function SecurityEventsTab({ adminKey }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminGetSecurityEvents(adminKey).then(({ data }) => {
      if (data) setEvents(data)
      setLoading(false)
    })
  }, [adminKey])

  return (
    <div className="flex flex-col gap-3">
      {loading ? (
        <div className="flex justify-center py-10 font-jakarta text-[#475569] text-[13px] animate-pulse">Đang tải...</div>
      ) : events.length === 0 ? (
        <div className="flex justify-center py-10 font-jakarta text-[#475569] text-[13px]">Không có sự kiện gần đây</div>
      ) : (
        <div className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl overflow-hidden">
          {events.map((ev, i) => (
            <div key={i} className="flex items-start gap-3 px-5 py-3 border-b border-[#1E2A44] last:border-0">
              <div className="mt-0.5 shrink-0">
                <span
                  className="inline-block w-2 h-2 rounded-full mt-1"
                  style={{ background: CONFIDENCE_COLOR[ev.confidence] ?? '#64748B' }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-jakarta text-[12px] font-semibold text-[#F0F4FF]">{ev.event_type}</span>
                  <span className="font-jakarta text-[11px] px-1.5 py-0.5 rounded-full" style={{ color: CONFIDENCE_COLOR[ev.confidence] ?? '#64748B', background: (CONFIDENCE_COLOR[ev.confidence] ?? '#64748B') + '22' }}>{ev.confidence}</span>
                </div>
                <span className="font-jakarta text-[11px] text-[#64748B]">{ev.detail ?? '—'}</span>
              </div>
              <div className="shrink-0 text-right">
                <span className="font-jakarta text-[11px] text-[#475569]">{formatDate(ev.created_at)}</span>
                {ev.user_email && <div className="font-jakarta text-[12px] text-[#475569] truncate max-w-[120px]">{ev.user_email}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const ADMIN_SESSION_TIMEOUT = 30 * 60 * 1000

export default function Admin() {
  const [adminKey, setAdminKey] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [tab, setTab] = useState('users')
  const inactivityTimer = useRef(null)

  function resetInactivityTimer() {
    clearTimeout(inactivityTimer.current)
    inactivityTimer.current = setTimeout(() => {
      setAdminKey('')
    }, ADMIN_SESSION_TIMEOUT)
  }

  useEffect(() => {
    if (!adminKey) return
    resetInactivityTimer()
    window.addEventListener('mousemove', resetInactivityTimer)
    window.addEventListener('keydown', resetInactivityTimer)
    return () => {
      clearTimeout(inactivityTimer.current)
      window.removeEventListener('mousemove', resetInactivityTimer)
      window.removeEventListener('keydown', resetInactivityTimer)
    }
  }, [adminKey]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleKeySubmit(e) {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    const trimmedKey = keyInput.trim()
    const { error, status } = await adminListUsers(trimmedKey, { limit: 1 })
    setAuthLoading(false)
    if (error) {
      setAuthError(status === 401 ? 'Admin key không hợp lệ' : `Lỗi xác thực (${status ?? 'network'})`)
      return
    }
    setAdminKey(trimmedKey)
  }

  if (!adminKey) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center px-4">
        <form onSubmit={handleKeySubmit} className="max-w-sm w-full bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-8 flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <span className="font-fraunces text-[18px] font-bold text-[#F8FAFC]">Admin</span>
            <span className="font-jakarta text-[13px] text-[#64748B]">Nhập Admin Key để tiếp tục</span>
          </div>
          <input
            type="password" value={keyInput} onChange={e => setKeyInput(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-[#1E2A44] bg-[#111827] font-jakarta text-[13px] text-[#F0F4FF] focus:outline-none focus:border-amber-400"
            placeholder="Admin Key"
            autoComplete="current-password"
          />
          {authError && <p className="font-jakarta text-[12px] text-red-400">{authError}</p>}
          <button
            type="submit" disabled={authLoading || !keyInput}
            className="py-2.5 rounded-xl font-jakarta text-[13px] font-bold disabled:opacity-40 transition"
            style={{ background: '#F2A20C', color: '#0A0E1A' }}
          >
            {authLoading ? 'Đang xác thực...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex flex-col">
      <nav className="flex items-center justify-between px-6 bg-[#0D1221] border-b border-[#1E2A44]" style={{ height: 56 }}>
        <span className="font-fraunces text-[15px] font-bold text-amber-400">Zenith Admin</span>
        <button
          onClick={() => setAdminKey('')}
          className="font-jakarta text-[12px] text-[#64748B] hover:text-[#F8FAFC] transition"
        >
          Đăng xuất
        </button>
      </nav>

      <div className="max-w-3xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
        <div className="flex gap-1 bg-[#0D1221] border border-[#1E2A44] rounded-xl p-1">
          {[['users', 'Người dùng'], ['events', 'Sự kiện bảo mật']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-2 rounded-lg font-jakarta text-[13px] font-medium transition ${tab === key ? 'bg-[#F2A20C] text-[#0A0E1A] font-semibold' : 'text-[#64748B] hover:text-[#94A3B8]'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'users' && <UsersTab adminKey={adminKey} />}
        {tab === 'events' && <SecurityEventsTab adminKey={adminKey} />}
      </div>
    </div>
  )
}
