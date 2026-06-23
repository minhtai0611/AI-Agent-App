import { useState, useEffect, useCallback, useRef } from 'react'
import {
  adminListUsers, adminDeleteUser, adminUnlockUser, adminResetUser,
  adminSuspendUser, adminUnsuspendUser, adminGrantCredits, adminSetSubscription, adminGetSecurityEvents,
  adminGetUserDevices, adminUpdateProfile,
} from '../api/aiClient.js'
import { PROVINCES } from '../data/provinces.js'
import { getSchoolsByProvince } from '../api/index.js'

const CONFIDENCE_COLOR = { high: '#F87171', medium: '#FCD34D', low: '#8194B3' }

function countryFlag(code) {
  if (!code || code.length !== 2) return ''
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0))
  )
}

function DevicesModal({ user, adminKey, onClose }) {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminGetUserDevices(adminKey, user.id).then(({ data }) => {
      setDevices(data ?? [])
      setLoading(false)
    })
  }, [adminKey, user.id])

  const latestProvince = devices[0]?.province ?? null
  const schools = getSchoolsByProvince(latestProvince)
  const gradeNum = parseInt(user.grade ?? '0', 10)
  const gradeLabel = gradeNum && gradeNum <= 9
    ? 'Trường THPT mục tiêu (thi vào lớp 10)'
    : 'Trường khu vực thi ĐH'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="max-w-md w-full glass-base border border-surface rounded-2xl p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
        <span className="font-sans text-[15px] font-bold text-foreground">
          Thiết bị — {user.display_name || user.email}
        </span>
        {loading ? (
          <span className="font-sans text-[12px] text-dim">Đang tải...</span>
        ) : devices.length === 0 ? (
          <span className="font-sans text-[12px] text-dim">Chưa có dữ liệu thiết bị.</span>
        ) : devices.map(d => (
          <div key={d.device_id}
            className="flex flex-col gap-0.5 px-3 py-2.5 rounded-xl bg-surface border border-surface">
            <span className="font-sans text-[12px] font-semibold text-foreground">
              {d.country_code ? countryFlag(d.country_code) + ' ' : ''}{d.city ?? '—'}
              {d.province ? ` · ${d.province}` : ''}
            </span>
            <span className="font-sans text-[11px] text-dim">{d.device_label}</span>
            <span className="font-sans text-[10px] text-dim">IP: {d.ip ?? '—'}</span>
            <span className="font-sans text-[10px] text-dim">
              Lần đầu: {formatDate(d.first_seen_at)} · Lần cuối: {formatDate(d.last_seen_at)}
            </span>
          </div>
        ))}
        {schools.length > 0 && (
          <>
            <div className="border-t border-surface" />
            <span className="font-sans text-[11px] font-semibold text-muted">{gradeLabel}</span>
            {schools.map(s => (
              <div key={s.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface border border-surface">
                <span className="font-sans text-[12px] text-foreground">{s.name}</span>
                <span className="font-sans text-[11px] text-dim">{s.type}</span>
              </div>
            ))}
          </>
        )}
        <button onClick={onClose}
          className="mt-2 w-full py-2 rounded-lg font-sans text-[13px] text-dim border border-surface hover:text-foreground transition">
          Đóng
        </button>
      </div>
    </div>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) } catch { return iso }
}

function StatusBadge({ user }) {
  if (user.is_locked) return <span className="px-2 py-0.5 rounded-full font-sans text-[11px] font-bold bg-[var(--destructive)]/20 text-[var(--destructive)]">Khóa</span>
  if (user.is_suspended) return <span className="px-2 py-0.5 rounded-full font-sans text-[11px] font-bold bg-[var(--accent-subtle)] text-[var(--accent)]">Tạm khoá</span>
  if (user.is_deactivated) return <span className="px-2 py-0.5 rounded-full font-sans text-[11px] font-bold bg-border/60 text-muted">Tạm ngưng</span>
  return <span className="px-2 py-0.5 rounded-full font-sans text-[11px] font-bold bg-[var(--success)]/20 text-[var(--success)]">Hoạt động</span>
}

function SubscriptionModal({ user, adminKey, onClose, onDone }) {
  const [tier, setTier] = useState(user.subscription_tier ?? 'basic')
  const [period, setPeriod] = useState(user.subscription_period ?? 'monthly')
  const [expiresAt, setExpiresAt] = useState('')
  const [bonusCredits, setBonusCredits] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setLoading(true)
    setError('')
    const body = { tier, period, bonus_credits: Number(bonusCredits) }
    if (expiresAt) body.expires_at = new Date(expiresAt).toISOString()
    const { error: err } = await adminSetSubscription(adminKey, user.id, body)
    setLoading(false)
    if (err) { setError(typeof err === 'string' ? err : 'Cập nhật thất bại'); return }
    onDone()
    onClose()
  }

  const TIERS = [
    { value: 'basic',    label: 'Basic' },
    { value: 'student',  label: 'Student' },
    { value: 'complete', label: 'Complete' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="max-w-sm w-full glass-base border border-surface rounded-2xl p-6 flex flex-col gap-4">
        <span className="font-sans text-[15px] font-bold text-foreground">Thay đổi gói — {user.display_name || user.email}</span>
        <p className="font-sans text-[11px] text-dim">Hiện tại: <span className="text-foreground font-semibold">{user.subscription_tier} / {user.subscription_period ?? 'monthly'}</span></p>

        <div className="flex flex-col gap-1.5">
          <span className="font-sans text-[11px] font-semibold text-muted">Gói</span>
          <div className="flex gap-2">
            {TIERS.map(t => (
              <button
                key={t.value}
                onClick={() => setTier(t.value)}
                className={`flex-1 py-2 rounded-lg font-sans text-[12px] font-semibold border transition ${
                  tier === t.value
                    ? 'bg-primary text-background border-primary'
                    : 'bg-surface border-surface text-muted hover:border-border'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="font-sans text-[11px] font-semibold text-muted">Chu kỳ</span>
          <div className="flex gap-2">
            {[['monthly', 'Tháng'], ['annual', 'Năm']].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setPeriod(v)}
                className={`flex-1 py-2 rounded-lg font-sans text-[12px] font-semibold border transition ${
                  period === v
                    ? 'bg-primary text-background border-primary'
                    : 'bg-surface border-surface text-muted hover:border-border'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="font-sans text-[11px] font-semibold text-muted">Ngày hết hạn (tuỳ chọn)</span>
          <input
            type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            className="px-4 py-2.5 rounded-xl border border-surface bg-surface font-sans text-[13px] text-foreground focus:outline-none focus:border-[var(--accent-border)] [color-scheme:only_dark]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="font-sans text-[11px] font-semibold text-muted">Credits thưởng (tuỳ chọn)</span>
          <input
            type="number" min="0" value={bonusCredits} onChange={e => setBonusCredits(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-surface bg-surface font-sans text-[13px] text-foreground focus:outline-none focus:border-[var(--accent-border)]"
            placeholder="0"
          />
        </div>

        {error && <p className="font-sans text-[12px] text-destructive">{error}</p>}
        <div className="flex gap-2">
          <button onClick={submit} disabled={loading} className="flex-1 py-2 rounded-lg font-sans text-[13px] font-bold bg-primary text-background disabled:opacity-40">
            {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg font-sans text-[13px] text-dim hover:text-foreground transition">Huỷ</button>
        </div>
      </div>
    </div>
  )
}

function GrantCreditsModal({ user, adminKey, onClose, onDone }) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    const n = parseInt(amount, 10)
    if (!n || n <= 0) { setError('Số credits phải lớn hơn 0'); return }
    setLoading(true)
    const { error: err } = await adminGrantCredits(adminKey, user.id, n)
    setLoading(false)
    if (err) { setError(typeof err === 'string' ? err : 'Thất bại'); return }
    onDone()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="max-w-sm w-full glass-base border border-surface rounded-2xl p-6 flex flex-col gap-4">
        <span className="font-sans text-[15px] font-bold text-foreground">Tặng Credits — {user.display_name || user.email}</span>
        <input
          type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-surface bg-surface font-sans text-[13px] text-foreground focus:outline-none focus:border-[var(--accent-border)]"
          placeholder="Số credits"
        />
        {error && <p className="font-sans text-[12px] text-[var(--destructive)]">{error}</p>}
        <div className="flex gap-2">
          <button onClick={submit} disabled={loading} className="flex-1 py-2 rounded-lg font-sans text-[13px] font-bold bg-primary text-background disabled:opacity-40">
            {loading ? 'Đang gửi...' : 'Xác nhận'}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg font-sans text-[13px] text-dim hover:text-foreground transition">Huỷ</button>
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
      <div className="max-w-sm w-full glass-base border border-surface rounded-2xl p-6 flex flex-col gap-4">
        <span className="font-sans text-[15px] font-bold text-[var(--accent)]">Tạm khoá — {user.display_name || user.email}</span>
        <input
          value={reason} onChange={e => setReason(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-surface bg-surface font-sans text-[13px] text-foreground focus:outline-none focus:border-[var(--accent-border)]"
          placeholder="Lý do (tuỳ chọn)"
        />
        {error && <p className="font-sans text-[12px] text-[var(--destructive)]">{error}</p>}
        <div className="flex gap-2">
          <button onClick={submit} disabled={loading} className="flex-1 py-2 rounded-lg font-sans text-[13px] font-bold border border-[var(--accent-border)]/40 text-[var(--accent)] hover:bg-[var(--accent)]/10 transition">
            {loading ? 'Đang xử lý...' : 'Tạm khoá'}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg font-sans text-[13px] text-dim hover:text-foreground transition">Huỷ</button>
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
      <div className="max-w-sm w-full glass-base border border-[var(--destructive)]/30 rounded-2xl p-6 flex flex-col gap-4">
        <span className="font-sans text-[15px] font-bold text-[var(--destructive)]">Reset tài khoản — {user.display_name || user.email}</span>
        <p className="font-sans text-[12px] text-muted">Hành động này sẽ xóa toàn bộ dữ liệu và đưa tài khoản về trạng thái ban đầu. Không thể hoàn tác.</p>
        <input
          value={confirm} onChange={e => setConfirm(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-surface bg-surface font-sans text-[13px] text-foreground focus:outline-none focus:border-[var(--destructive)]/60"
          placeholder={`Gõ "RESET" để xác nhận`}
        />
        {error && <p className="font-sans text-[12px] text-[var(--destructive)]">{error}</p>}
        <div className="flex gap-2">
          <button onClick={submit} disabled={loading || confirm !== 'RESET'} className="flex-1 py-2 rounded-lg font-sans text-[13px] font-bold disabled:opacity-40 transition bg-destructive text-white focus:outline-none">
            {loading ? 'Đang reset...' : 'Xác nhận Reset'}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg font-sans text-[13px] text-dim hover:text-foreground transition">Huỷ</button>
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
      <div className="max-w-sm w-full glass-base border border-[var(--destructive)]/30 rounded-2xl p-6 flex flex-col gap-4">
        <span className="font-sans text-[15px] font-bold text-[var(--destructive)]">Xóa tài khoản vĩnh viễn</span>
        <p className="font-sans text-[12px] text-muted">Tài khoản <strong className="text-foreground">{user.email}</strong> và toàn bộ dữ liệu sẽ bị xóa vĩnh viễn.</p>
        {error && <p className="font-sans text-[12px] text-[var(--destructive)]">{error}</p>}
        <div className="flex gap-2">
          <button onClick={submit} disabled={loading} className="flex-1 py-2 rounded-lg font-sans text-[13px] font-bold transition bg-destructive text-white disabled:opacity-40">
            {loading ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg font-sans text-[13px] text-dim hover:text-foreground transition">Huỷ</button>
        </div>
      </div>
    </div>
  )
}

function EditProfileModal({ user, adminKey, onClose, onDone }) {
  const [province, setProvince] = useState(user.province || '')
  const [grade, setGrade] = useState(user.grade || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setLoading(true)
    const body = {}
    if (province !== (user.province || '')) body.province = province || null
    if (grade !== (user.grade || '')) body.grade = grade || null
    const { error: err } = await adminUpdateProfile(adminKey, user.id, body)
    setLoading(false)
    if (err) { setError(typeof err === 'string' ? err : 'Thất bại'); return }
    onDone()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="max-w-sm w-full glass-base border border-surface rounded-2xl p-6 flex flex-col gap-4">
        <span className="font-sans text-[15px] font-bold text-foreground">Sửa hồ sơ — {user.display_name || user.email}</span>
        <div className="flex flex-col gap-1.5">
          <label className="font-sans text-[11px] text-dim">Tỉnh/Thành phố</label>
          <select
            value={province} onChange={e => setProvince(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-surface bg-surface font-sans text-[13px] text-foreground focus:outline-none focus:border-[var(--accent-border)]"
          >
            <option value="">— Chưa đặt —</option>
            {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="font-sans text-[11px] text-dim">Lớp</label>
          <select
            value={grade} onChange={e => setGrade(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-surface bg-surface font-sans text-[13px] text-foreground focus:outline-none focus:border-[var(--accent-border)]"
          >
            <option value="">— Chưa đặt —</option>
            {['9','10','11','12'].map(g => <option key={g} value={g}>Lớp {g}</option>)}
          </select>
        </div>
        {error && <p className="font-sans text-[12px] text-[var(--destructive)]">{error}</p>}
        <div className="flex gap-2">
          <button onClick={submit} disabled={loading} className="flex-1 py-2 rounded-lg font-sans text-[13px] font-bold bg-primary text-background disabled:opacity-40">
            {loading ? 'Đang lưu...' : 'Lưu'}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg font-sans text-[13px] text-dim hover:text-foreground transition">Huỷ</button>
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
      <div className="flex items-center gap-3 py-3 border-b border-surface last:border-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {(() => { const { status, label } = getOnlineStatus(user.last_seen_at); return (
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status === 'online' ? 'bg-success animate-pulse' : 'bg-muted'}`} title={label} />
            )})()}
            <span className="font-sans text-[13px] font-semibold text-foreground truncate">{user.display_name || '—'}</span>
            <StatusBadge user={user} />
            {user.pending_deletion_at && (
              <span className="px-2 py-0.5 rounded-full font-sans text-[11px] font-bold bg-[var(--destructive)]/20 text-[var(--destructive)]">
                Xóa {new Date(user.pending_deletion_at).toLocaleDateString('vi-VN')}
              </span>
            )}
          </div>
          <span className="font-sans text-[11px] text-dim">{user.email}</span>
          {(user.city || user.ip) && (
            <span className="font-sans text-[10px] text-dim truncate">
              {user.country_code ? countryFlag(user.country_code) + ' ' : ''}
              {user.city ?? '—'}
              {user.device_label ? ' · ' + user.device_label : ''}
              {user.ip ? ' · ' + user.ip : ''}
            </span>
          )}
        </div>
        <div className="hidden sm:flex flex-col items-end gap-0.5">
          <span className="font-sans text-[11px] text-muted">{user.subscription_tier}</span>
          <span className="font-sans text-[11px] text-[var(--accent)]">⚡ {user.credits_balance ?? 0}</span>
        </div>
        <div className="hidden md:flex items-center gap-1.5">
          {(user.last_tab_switches ?? 0) > 0 && (
            <span className={`font-sans text-[11px] px-1.5 py-0.5 rounded-full ${(user.last_tab_switches ?? 0) > 5 ? 'bg-[var(--destructive)]/20 text-[var(--destructive)]' : 'bg-border/60 text-dim'}`}
              title="Tab switches in last exam">
              ↹ {user.last_tab_switches}
            </span>
          )}
          {user.last_devtools === 1 && (
            <span className="font-sans text-[11px] px-1.5 py-0.5 rounded-full bg-[var(--destructive)]/20 text-[var(--destructive)]" title="DevTools detected in last exam">
              {'</>'}
            </span>
          )}
        </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            disabled={actionLoading}
            className="px-3 py-1.5 rounded-lg font-sans text-[11px] text-muted border border-surface hover:text-foreground hover:border-border transition"
          >
            {actionLoading ? '...' : 'Thao tác ▾'}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-20 w-44 bg-surface border border-surface rounded-xl shadow-xl overflow-hidden">
              {user.is_suspended ? (
                <button onClick={handleUnsuspend} className="w-full px-4 py-2.5 font-sans text-[12px] text-left text-emerald-400 hover:bg-surface transition">Bỏ tạm khoá</button>
              ) : (
                <button onClick={() => { setModal('suspend'); setMenuOpen(false) }} className="w-full px-4 py-2.5 font-sans text-[12px] text-left text-[var(--accent)] hover:bg-surface transition">Tạm khoá</button>
              )}
              {!!user.is_locked && (
                <button onClick={handleUnlock} className="w-full px-4 py-2.5 font-sans text-[12px] text-left text-emerald-400 hover:bg-surface transition">Mở khóa</button>
              )}
              <button onClick={() => { setModal('grant'); setMenuOpen(false) }} className="w-full px-4 py-2.5 font-sans text-[12px] text-left text-muted hover:bg-surface transition">Tặng Credits</button>
              <button onClick={() => { setModal('subscription'); setMenuOpen(false) }} className="w-full px-4 py-2.5 font-sans text-[12px] text-left text-muted hover:bg-surface transition">Thay đổi gói</button>
              <button onClick={() => { setModal('editProfile'); setMenuOpen(false) }} className="w-full px-4 py-2.5 font-sans text-[12px] text-left text-muted hover:bg-surface transition">Sửa hồ sơ</button>
              <button onClick={() => { setModal('devices'); setMenuOpen(false) }} className="w-full px-4 py-2.5 font-sans text-[12px] text-left text-muted hover:bg-surface transition">Thiết bị</button>
              <div className="border-t border-surface" />
              <button onClick={() => { setModal('reset'); setMenuOpen(false) }} className="w-full px-4 py-2.5 font-sans text-[12px] text-left text-[var(--accent)] hover:bg-surface transition">Reset tài khoản</button>
              <button onClick={() => { setModal('delete'); setMenuOpen(false) }} className="w-full px-4 py-2.5 font-sans text-[12px] text-left text-[var(--destructive)] hover:bg-surface transition">Xóa tài khoản</button>
            </div>
          )}
        </div>
      </div>

      {modal === 'grant' && <GrantCreditsModal user={user} adminKey={adminKey} onClose={() => setModal(null)} onDone={onRefresh} />}
      {modal === 'subscription' && <SubscriptionModal user={user} adminKey={adminKey} onClose={() => setModal(null)} onDone={onRefresh} />}
      {modal === 'suspend' && <SuspendModal user={user} adminKey={adminKey} onClose={() => setModal(null)} onDone={onRefresh} />}
      {modal === 'reset' && <ResetModal user={user} adminKey={adminKey} onClose={() => setModal(null)} onDone={onRefresh} />}
      {modal === 'delete' && <DeleteUserModal user={user} adminKey={adminKey} onClose={() => setModal(null)} onDone={onRefresh} />}
      {modal === 'devices' && <DevicesModal user={user} adminKey={adminKey} onClose={() => setModal(null)} />}
      {modal === 'editProfile' && <EditProfileModal user={user} adminKey={adminKey} onClose={() => setModal(null)} onDone={onRefresh} />}
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
        className="px-4 py-2.5 rounded-xl border border-surface bg-surface font-sans text-[13px] text-foreground focus:outline-none focus:border-[var(--accent-border)]"
        placeholder="Tìm theo email hoặc tên..."
      />

      {loading ? (
        <div className="flex justify-center py-10 font-sans text-dim text-[13px] animate-pulse">Đang tải...</div>
      ) : users.length === 0 ? (
        <div className="flex justify-center py-10 font-sans text-dim text-[13px]">Không tìm thấy người dùng</div>
      ) : (
        <div className="glass-base border border-surface rounded-2xl px-5 py-2">
          {users.map(u => (
            <UserRow key={u.id} user={u} adminKey={adminKey} onRefresh={() => fetchUsers(search, page)} />
          ))}
        </div>
      )}

      {total > LIMIT && (
        <div className="flex items-center justify-center gap-3">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg font-sans text-[12px] border border-surface text-muted disabled:opacity-40 hover:text-foreground transition">← Trước</button>
          <span className="font-sans text-[12px] text-dim">Trang {page} / {Math.ceil(total / LIMIT)}</span>
          <button disabled={page >= Math.ceil(total / LIMIT)} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg font-sans text-[12px] border border-surface text-muted disabled:opacity-40 hover:text-foreground transition">Sau →</button>
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
        <div className="flex justify-center py-10 font-sans text-dim text-[13px] animate-pulse">Đang tải...</div>
      ) : events.length === 0 ? (
        <div className="flex justify-center py-10 font-sans text-dim text-[13px]">Không có sự kiện gần đây</div>
      ) : (
        <div className="glass-base border border-surface rounded-2xl overflow-hidden">
          {events.map((ev, i) => (
            <div key={i} className="flex items-start gap-3 px-5 py-3 border-b border-surface last:border-0">
              <div className="mt-0.5 shrink-0">
                <span
                  className="inline-block w-2 h-2 rounded-full mt-1"
                  style={{ background: CONFIDENCE_COLOR[ev.confidence] ?? '#8194B3' }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-sans text-[12px] font-semibold text-foreground">{ev.event_type}</span>
                  <span className="font-sans text-[11px] px-1.5 py-0.5 rounded-full" style={{ color: CONFIDENCE_COLOR[ev.confidence] ?? '#8194B3', background: (CONFIDENCE_COLOR[ev.confidence] ?? '#8194B3') + '22' }}>{ev.confidence}</span>
                </div>
                <span className="font-sans text-[11px] text-dim">{ev.detail ?? '—'}</span>
              </div>
              <div className="shrink-0 text-right">
                <span className="font-sans text-[11px] text-dim">{formatDate(ev.created_at)}</span>
                {ev.user_email && <div className="font-sans text-[12px] text-dim truncate max-w-[120px]">{ev.user_email}</div>}
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
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <form onSubmit={handleKeySubmit} className="max-w-sm w-full glass-base border border-surface rounded-2xl p-8 flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <span className="font-sans text-[18px] font-bold text-foreground">Admin</span>
            <span className="font-sans text-[13px] text-dim">Nhập Admin Key để tiếp tục</span>
          </div>
          <input
            type="password" value={keyInput} onChange={e => setKeyInput(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-surface bg-surface font-sans text-[13px] text-foreground focus:outline-none focus:border-[var(--accent-border)]"
            placeholder="Admin Key"
            autoComplete="current-password"
          />
          {authError && <p className="font-sans text-[12px] text-[var(--destructive)]">{authError}</p>}
          <button
            type="submit" disabled={authLoading || !keyInput}
            className="py-2.5 rounded-xl font-sans text-[13px] font-bold disabled:opacity-40 transition bg-primary text-background"
          >
            {authLoading ? 'Đang xác thực...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <nav className="flex items-center justify-between px-6 glass-base border-b border-surface" style={{ height: 56 }}>
        <span className="font-sans text-[15px] font-bold text-[var(--accent)]">Zenith Admin</span>
        <button
          onClick={() => setAdminKey('')}
          className="font-sans text-[12px] text-dim hover:text-foreground transition"
        >
          Đăng xuất
        </button>
      </nav>

      <div className="max-w-3xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
        <div className="flex gap-1 glass-base border border-surface rounded-xl p-1">
          {[['users', 'Người dùng'], ['events', 'Sự kiện bảo mật']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-2 rounded-lg font-sans text-[13px] font-medium transition ${tab === key ? 'bg-primary text-background font-semibold' : 'text-dim hover:text-muted'}`}>
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
