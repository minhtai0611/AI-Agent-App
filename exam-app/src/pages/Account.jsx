import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext.jsx'
import { useHistory } from '../context/HistoryContext.jsx'
import { getCreditLog, activateTrial } from '../api/aiClient.js'
import { pageVariants } from '../utils/animations.js'
import { usePageTitle } from '../hooks/usePageTitle.js'

const TIER_LABELS = { basic: 'Cơ bản', student: 'Học sinh', complete: 'Toàn diện' }
const TIER_COLORS = { basic: '#64748B', student: '#F2A20C', complete: '#10B981' }

const GRADE_LABELS = { '9': 'Lớp 9 trở xuống', '10': 'Lớp 10', '11': 'Lớp 11', '12': 'Lớp 12' }

const PLANS_MONTHLY = [
  { tier: 'basic', label: 'Cơ bản', price: 'Miễn phí', credits: 50, studyPlan: false, badge: null },
  { tier: 'student', label: 'Học sinh', price: '29,000đ/tháng', credits: 500, studyPlan: true, badge: 'PHỔ BIẾN' },
  { tier: 'complete', label: 'Toàn diện', price: '59,000đ/tháng', credits: 2000, studyPlan: true, badge: null },
]

const PLANS_ANNUAL = [
  { tier: 'basic', label: 'Cơ bản', price: 'Miễn phí', credits: 50, studyPlan: false, badge: null },
  { tier: 'student', label: 'Học sinh', price: '261,000đ/năm', credits: 500, studyPlan: true, badge: 'PHỔ BIẾN', bonus: '+1,000 Tia', effective: '21,750đ/tháng' },
  { tier: 'complete', label: 'Toàn diện', price: '531,000đ/năm', credits: 2000, studyPlan: true, badge: null, bonus: '+3,000 Tia', effective: '44,250đ/tháng' },
]

const TOPUP_PACKAGES = [
  { price: '15,000đ', credits: 150 },
  { price: '29,000đ', credits: 350 },
  { price: '59,000đ', credits: 800 },
]

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return iso
  }
}

function buildHeatmap(results) {
  const counts = {}
  for (const r of results) {
    const day = new Date(r.finishedAt).toISOString().slice(0, 10)
    counts[day] = (counts[day] ?? 0) + 1
  }
  const cells = []
  const end = new Date()
  for (let i = 363; i >= 0; i--) {
    const d = new Date(end)
    d.setDate(end.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    cells.push({ key, count: counts[key] ?? 0 })
  }
  return cells
}

function heatColor(count) {
  if (count === 0) return '#1E2A44'
  if (count === 1) return '#F2A20C33'
  if (count === 2) return '#F2A20C77'
  return '#F2A20C'
}

export default function Account() {
  usePageTitle('Tài khoản')
  const navigate = useNavigate()
  const { user, loading, updateProfile, refreshUser, refundCredits, logout, deleteAccount, deactivateAccount, reactivateAccount } = useAuth()
  const { results } = useHistory()
  const [creditLog, setCreditLog] = useState([])
  const [billing, setBilling] = useState('monthly')
  const [editMode, setEditMode] = useState(false)
  const [editGrade, setEditGrade] = useState('')
  const [editProvince, setEditProvince] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [trialActivating, setTrialActivating] = useState(false)
  const [trialDone, setTrialDone] = useState(false)
  const [trialError, setTrialError] = useState('')
  const [accountTab, setAccountTab] = useState('billing')
  const [showAllCredits, setShowAllCredits] = useState(false)
  const [avatarErr, setAvatarErr] = useState(false)
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteEmail, setDeleteEmail] = useState('')
  const [dangerLoading, setDangerLoading] = useState(false)
  const [dangerError, setDangerError] = useState('')
  const [reactivating, setReactivating] = useState(false)

  useEffect(() => {
    if (!user) return
    getCreditLog().then(({ data }) => {
      if (data) setCreditLog(data)
    })
  }, [user])

  useEffect(() => {
    if (!loading && !user) navigate('/', { replace: true })
  }, [loading, user, navigate])

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center font-jakarta text-[#475569]">
        Đang tải...
      </div>
    )
  }

  const tier = user.subscription_tier || 'basic'
  const plans = billing === 'annual' ? PLANS_ANNUAL : PLANS_MONTHLY

  async function handleSaveProfile() {
    setSaving(true)
    setSaveError('')
    try {
      await updateProfile({
        grade: editGrade || undefined,
        province: editProvince || undefined,
      })
      setEditMode(false)
    } catch (err) {
      setSaveError(err.message || 'Lưu thất bại, vui lòng thử lại')
    } finally {
      setSaving(false)
    }
  }

  const heatmap = buildHeatmap(results)

  return (
    <motion.div
      className="min-h-screen bg-[#0A0E1A] flex flex-col"
      variants={pageVariants} initial="hidden" animate="show"
    >
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 bg-[#0D1221] border-b border-[#1E2A44]" style={{ height: 64 }}>
        <button onClick={() => navigate(-1)} className="font-jakarta text-[13px] text-[#94A3B8] hover:text-[#F8FAFC] transition">
          ← Quay lại
        </button>
        <span className="font-jakarta text-[14px] font-semibold text-[#F8FAFC]">Tài khoản</span>
        <div />
      </nav>

      <div className="max-w-2xl mx-auto w-full px-4 py-10 flex flex-col gap-8">

        {/* Profile section */}
        <section className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <span className="font-fraunces text-[16px] font-semibold text-[#F8FAFC]">Hồ sơ</span>
            {!editMode && (
              <button
                onClick={() => { setEditMode(true); setEditGrade(user.grade || ''); setEditProvince(user.province || '') }}
                className="font-jakarta text-[12px] text-amber-400 hover:text-amber-300 transition"
              >
                Chỉnh sửa
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            {user.avatar_url && !avatarErr ? (
              <img
                src={user.avatar_url}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setAvatarErr(true)}
                className="w-14 h-14 rounded-full object-cover"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-amber-500 flex items-center justify-center font-bold text-lg text-black">
                {(user.display_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'}
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              <span className="font-fraunces text-[18px] font-bold text-[#F8FAFC]">{user.display_name}</span>
              <span className="font-jakarta text-[13px] text-[#64748B]">{user.email}</span>
            </div>
          </div>
          {editMode ? (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2 flex-wrap">
                {['9','10','11','12'].map(g => (
                  <button key={g} type="button" onClick={() => setEditGrade(g)}
                    className={`px-4 py-2 rounded-lg border font-jakarta text-[12px] font-medium transition ${
                      editGrade === g ? 'border-amber-400 text-amber-400 bg-amber-400/10' : 'border-[#1E2A44] text-[#64748B]'
                    }`}>
                    {GRADE_LABELS[g]}
                  </button>
                ))}
              </div>
              <input
                className="px-4 py-2.5 rounded-xl border border-[#1E2A44] bg-[#111827] font-jakarta text-[13px] text-[#F0F4FF] focus:outline-none focus:border-amber-400"
                placeholder="Tỉnh / Thành phố"
                value={editProvince}
                onChange={e => setEditProvince(e.target.value)}
              />
              {saveError && (
                <p className="font-jakarta text-[12px] text-red-400">{saveError}</p>
              )}
              <div className="flex gap-2">
                <button onClick={handleSaveProfile} disabled={saving}
                  className="px-5 py-2 rounded-lg font-jakarta text-[13px] font-bold transition"
                  style={{ background: '#F2A20C', color: '#0A0E1A' }}>
                  {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
                <button onClick={() => { setEditMode(false); setSaveError('') }} className="px-5 py-2 rounded-lg font-jakarta text-[13px] text-[#64748B] hover:text-[#F8FAFC] transition">
                  Huỷ
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-6">
              <div className="flex flex-col gap-0.5">
                <span className="font-jakarta text-[11px] text-[#475569]">Lớp</span>
                <span className="font-jakarta text-[13px] text-[#F0F4FF]">{GRADE_LABELS[user.grade] || '—'}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-jakarta text-[11px] text-[#475569]">Tỉnh / Thành phố</span>
                <span className="font-jakarta text-[13px] text-[#F0F4FF]">{user.province || '—'}</span>
              </div>
              {user.school_type && (
                <div className="flex flex-col gap-0.5">
                  <span className="font-jakarta text-[11px] text-[#475569]">Loại trường</span>
                  <span className="font-jakarta text-[13px] text-[#F0F4FF]">{user.school_type}</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Current plan */}
        <section className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-4">
          <span className="font-fraunces text-[16px] font-semibold text-[#F8FAFC]">Gói hiện tại</span>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-jakarta text-[13px] font-bold px-3 py-1 rounded-full"
              style={{ background: (TIER_COLORS[tier] || '#64748B') + '22', color: TIER_COLORS[tier] || '#64748B' }}>
              {TIER_LABELS[tier] || tier}
            </span>
            {user.subscription_period === 'annual' && (
              <span className="font-jakarta text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400">
                Hàng năm
              </span>
            )}
          </div>
          <div className="flex gap-6 flex-wrap">
            <div className="flex flex-col gap-0.5">
              <span className="font-jakarta text-[11px] text-[#475569]">Tia còn lại</span>
              <span className="font-fraunces text-[20px] font-bold text-amber-400">⚡ {user.credits_balance ?? 0}</span>
            </div>
            {user.credits_reset_at && (
              <div className="flex flex-col gap-0.5">
                <span className="font-jakarta text-[11px] text-[#475569]">Làm mới vào</span>
                <span className="font-jakarta text-[13px] text-[#F0F4FF]">{formatDate(user.credits_reset_at)}</span>
              </div>
            )}
            {user.subscription_expires_at && (
              <div className="flex flex-col gap-0.5">
                <span className="font-jakarta text-[11px] text-[#475569]">Hết hạn</span>
                <span className="font-jakarta text-[13px] text-[#F0F4FF]">{formatDate(user.subscription_expires_at)}</span>
              </div>
            )}
          </div>
        </section>

        {/* 7-day trial CTA — basic users who haven't used their trial */}
        {tier === 'basic' && !user.trial_used && !trialDone && (
          <section className="bg-gradient-to-br from-[#1A2A10] to-[#0D1521] border border-[#2D4A1A] rounded-2xl p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span className="font-fraunces text-[16px] font-semibold text-[#F8FAFC]">Dùng thử 7 ngày miễn phí</span>
              <p className="font-jakarta text-[13px] text-[#94A3B8]">
                Trải nghiệm gói Học sinh trong 7 ngày — đề thi đầy đủ, kế hoạch học AI và 500 Tia mỗi tháng.
              </p>
            </div>
            {trialError && <p className="font-jakarta text-[12px] text-red-400">{trialError}</p>}
            <button
              disabled={trialActivating}
              onClick={async () => {
                setTrialActivating(true)
                setTrialError('')
                const { error } = await activateTrial()
                setTrialActivating(false)
                if (error) {
                  setTrialError(typeof error === 'string' ? error : 'Kích hoạt thất bại, vui lòng thử lại')
                } else {
                  setTrialDone(true)
                  refundCredits(500)
                  await refreshUser()
                }
              }}
              className="self-start px-5 py-2.5 rounded-xl font-jakarta text-[13px] font-bold transition"
              style={{ background: trialActivating ? '#1E2A44' : '#10B981', color: trialActivating ? '#475569' : '#0A0E1A' }}
            >
              {trialActivating ? 'Đang kích hoạt...' : 'Kích hoạt dùng thử'}
            </button>
          </section>
        )}
        {trialDone && (
          <div className="px-5 py-4 rounded-2xl border border-[#2D4A1A] bg-[#0A1A0A] font-jakarta text-[13px] text-[#34D399]">
            Đã kích hoạt! Gói Học sinh của bạn sẽ hoạt động trong 7 ngày.
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-[#0D1221] border border-[#1E2A44] rounded-xl p-1">
          {[['billing', 'Gói & Thanh toán'], ['history', 'Lịch sử Tia']].map(([key, label]) => (
            <button key={key} onClick={() => setAccountTab(key)}
              className={`flex-1 py-2 rounded-lg font-jakarta text-[13px] font-medium transition ${
                accountTab === key ? 'bg-[#F2A20C] text-[#0A0E1A] font-semibold' : 'text-[#64748B] hover:text-[#94A3B8]'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Tab: Gói & Thanh toán */}
        {accountTab === 'billing' && (
          <section className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <span className="font-fraunces text-[16px] font-semibold text-[#F8FAFC]">Nâng cấp gói</span>
              <div className="flex items-center gap-1 bg-[#111827] rounded-full p-1">
                {['monthly', 'annual'].map(b => (
                  <button key={b} onClick={() => setBilling(b)}
                    className={`px-4 py-1.5 rounded-full font-jakarta text-[12px] transition ${billing === b ? 'bg-[#F2A20C] text-[#0A0E1A] font-semibold' : 'text-[#94A3B8]'}`}>
                    {b === 'monthly' ? 'Hàng tháng' : 'Hàng năm (−25%)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {plans.map(plan => (
                <div key={plan.tier}
                  className={`flex items-center justify-between gap-4 px-5 py-4 rounded-xl border transition ${
                    tier === plan.tier ? 'border-amber-400/60 bg-amber-400/5' : 'border-[#1E2A44] bg-[#111827]'
                  }`}>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-jakarta text-[14px] font-bold text-[#F0F4FF]">{plan.label}</span>
                      {plan.badge && (
                        <span className="font-jakarta text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400">
                          {plan.badge}
                        </span>
                      )}
                      {tier === plan.tier && (
                        <span className="font-jakarta text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-400">
                          Hiện tại
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-jakarta text-[12px] text-[#64748B]">⚡ {plan.credits.toLocaleString()} Tia/tháng</span>
                      {plan.studyPlan && <span className="font-jakarta text-[12px] text-emerald-400">✓ Kế hoạch học</span>}
                      {plan.bonus && <span className="font-jakarta text-[12px] text-amber-300">🎁 {plan.bonus}</span>}
                    </div>
                    {plan.effective && <span className="font-jakarta text-[11px] text-[#475569]">≈ {plan.effective}</span>}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="font-fraunces text-[15px] font-bold text-[#F0F4FF]">{plan.price}</span>
                    {tier !== plan.tier && plan.tier !== 'basic' && (
                      <span className="font-jakarta text-[11px] text-amber-400">Liên hệ nâng cấp</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2 px-5 py-4 rounded-xl border border-[#1E2A44] bg-[#0A0E1A] flex flex-col gap-2">
              <span className="font-jakarta text-[12px] font-semibold text-[#94A3B8]">Thanh toán (Chuyển khoản ngân hàng)</span>
              <span className="font-jakarta text-[12px] text-[#64748B]">
                Chuyển khoản theo số tài khoản được cung cấp và gửi email xác nhận. Kích hoạt trong 1–2 giờ làm việc.
              </span>
              <span className="font-jakarta text-[11px] text-[#475569]">
                * MoMo · VNPay · ZaloPay · PayOS sẽ sớm ra mắt
              </span>
            </div>

            <div id="topup" className="flex flex-col gap-3">
              <span className="font-jakarta text-[13px] font-semibold text-[#94A3B8]">Nạp thêm Tia</span>
              <div className="flex gap-3 flex-wrap">
                {TOPUP_PACKAGES.map(pkg => (
                  <div key={pkg.price}
                    className="flex-1 min-w-[100px] flex flex-col items-center gap-1 px-4 py-3 rounded-xl border border-[#1E2A44] bg-[#111827]">
                    <span className="font-fraunces text-[15px] font-bold text-amber-400">⚡ {pkg.credits}</span>
                    <span className="font-jakarta text-[12px] text-[#F0F4FF]">{pkg.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Tab: Lịch sử Tia */}
        {accountTab === 'history' && (
          <div className="flex flex-col gap-6">
            {results.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-4"
              >
                <span className="font-fraunces text-[16px] font-semibold text-[#F8FAFC]">Hoạt động học tập</span>
                <div className="overflow-x-auto">
                  <div className="flex gap-1" style={{ minWidth: 640 }}>
                    {Array.from({ length: 52 }, (_, week) => (
                      <div key={week} className="flex flex-col gap-1">
                        {heatmap.slice(week * 7, week * 7 + 7).map(({ key, count }) => (
                          <div
                            key={key}
                            title={`${key}: ${count} lần thi`}
                            className="w-3 h-3 rounded-sm"
                            style={{ background: heatColor(count) }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-jakarta text-[11px] text-[#475569]">Ít</span>
                  {[0, 1, 2, 3].map(c => (
                    <div key={c} className="w-3 h-3 rounded-sm" style={{ background: heatColor(c) }} />
                  ))}
                  <span className="font-jakarta text-[11px] text-[#475569]">Nhiều</span>
                </div>
              </motion.section>
            )}

            {creditLog.length > 0 ? (
              <section className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-4">
                <span className="font-fraunces text-[16px] font-semibold text-[#F8FAFC]">Lịch sử Tia</span>
                <div className="flex flex-col gap-1">
                  {(showAllCredits ? creditLog : creditLog.slice(0, 15)).map((entry, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-[#1E2A44] last:border-0">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-jakarta text-[12px] text-[#94A3B8]">{entry.reason}</span>
                        <span className="font-jakarta text-[11px] text-[#475569]">{formatDate(entry.created_at)}</span>
                      </div>
                      <span className={`font-fraunces text-[14px] font-bold ${entry.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {entry.delta > 0 ? '+' : ''}{entry.delta}
                      </span>
                    </div>
                  ))}
                </div>
                {creditLog.length > 15 && !showAllCredits && (
                  <button onClick={() => setShowAllCredits(true)}
                    className="font-jakarta text-[12px] text-amber-400 hover:text-amber-300 transition text-center">
                    + Xem thêm ({creditLog.length - 15} mục)
                  </button>
                )}
              </section>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                <span className="font-jakarta text-[#475569] text-[14px]">Chưa có giao dịch nào.</span>
                <span className="font-jakarta text-[#374151] text-[12px]">Sử dụng tính năng AI để xem lịch sử Tia của bạn.</span>
              </div>
            )}
          </div>
        )}

        {/* Account status banners */}
        {user.is_locked && (
          <div className="px-5 py-4 rounded-2xl border border-red-500/40 bg-red-500/8 flex flex-col gap-1">
            <span className="font-jakarta text-[13px] font-semibold text-red-400">Tài khoản bị khóa do hoạt động bất thường</span>
            <span className="font-jakarta text-[12px] text-[#94A3B8]">{user.lock_reason || 'Liên hệ hỗ trợ để mở khóa tài khoản.'}</span>
          </div>
        )}
        {user.is_deactivated && !user.is_locked && (
          <div className="px-5 py-4 rounded-2xl border border-amber-400/40 bg-amber-400/8 flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="font-jakarta text-[13px] font-semibold text-amber-400">Tài khoản đang bị tạm ngưng</span>
              <span className="font-jakarta text-[12px] text-[#94A3B8]">Bạn có thể kích hoạt lại bất kỳ lúc nào.</span>
            </div>
            <button
              disabled={reactivating}
              onClick={async () => {
                setReactivating(true)
                await reactivateAccount()
                setReactivating(false)
              }}
              className="shrink-0 px-4 py-2 rounded-lg font-jakarta text-[12px] font-bold transition"
              style={{ background: '#F2A20C', color: '#0A0E1A', opacity: reactivating ? 0.6 : 1 }}
            >
              {reactivating ? 'Đang kích hoạt...' : 'Kích hoạt lại'}
            </button>
          </div>
        )}

        {/* Danger Zone */}
        <section className="bg-[#0D1221] border border-red-500/20 rounded-2xl p-7 flex flex-col gap-5">
          <span className="font-fraunces text-[15px] font-semibold text-red-400">Vùng nguy hiểm</span>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex flex-col gap-0.5">
              <span className="font-jakarta text-[13px] font-semibold text-[#F0F4FF]">Tạm ngưng tài khoản</span>
              <span className="font-jakarta text-[12px] text-[#64748B]">Vô hiệu hóa tài khoản tạm thời. Bạn có thể kích hoạt lại sau.</span>
            </div>
            <button
              onClick={() => setShowDeactivateModal(true)}
              className="shrink-0 px-4 py-2 rounded-lg font-jakarta text-[12px] font-bold border border-amber-400/40 text-amber-400 hover:bg-amber-400/10 transition"
            >
              Tạm ngưng
            </button>
          </div>

          <div className="border-t border-[#1E2A44]" />

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex flex-col gap-0.5">
              <span className="font-jakarta text-[13px] font-semibold text-[#F0F4FF]">Xóa tài khoản vĩnh viễn</span>
              <span className="font-jakarta text-[12px] text-[#64748B]">Tất cả dữ liệu sẽ bị xóa và không thể khôi phục.</span>
            </div>
            <button
              onClick={() => { setShowDeleteModal(true); setDeleteEmail(''); setDangerError('') }}
              className="shrink-0 px-4 py-2 rounded-lg font-jakarta text-[12px] font-bold border border-red-500/40 text-red-400 hover:bg-red-500/10 transition"
            >
              Xóa tài khoản
            </button>
          </div>
        </section>

      </div>

      {/* Deactivate confirmation modal */}
      <AnimatePresence>
        {showDeactivateModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="max-w-sm w-full bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-5"
            >
              <span className="font-fraunces text-[16px] font-bold text-[#F8FAFC]">Tạm ngưng tài khoản?</span>
              <p className="font-jakarta text-[13px] text-[#94A3B8]">
                Bạn sẽ không thể sử dụng dịch vụ cho đến khi kích hoạt lại. Dữ liệu của bạn sẽ được giữ nguyên.
              </p>
              {dangerError && <p className="font-jakarta text-[12px] text-red-400">{dangerError}</p>}
              <div className="flex gap-2">
                <button
                  disabled={dangerLoading}
                  onClick={async () => {
                    setDangerLoading(true)
                    setDangerError('')
                    const { error } = await deactivateAccount()
                    setDangerLoading(false)
                    if (error) { setDangerError(typeof error === 'string' ? error : 'Thất bại, vui lòng thử lại') }
                    else { setShowDeactivateModal(false); logout() }
                  }}
                  className="flex-1 py-2.5 rounded-xl font-jakarta text-[13px] font-bold transition"
                  style={{ background: dangerLoading ? '#1E2A44' : '#F2A20C', color: dangerLoading ? '#475569' : '#0A0E1A' }}
                >
                  {dangerLoading ? 'Đang xử lý...' : 'Xác nhận tạm ngưng'}
                </button>
                <button
                  onClick={() => { setShowDeactivateModal(false); setDangerError('') }}
                  className="px-4 py-2.5 rounded-xl font-jakarta text-[13px] text-[#64748B] hover:text-[#F8FAFC] transition"
                >
                  Huỷ
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete account confirmation modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="max-w-sm w-full bg-[#0D1221] border border-red-500/30 rounded-2xl p-7 flex flex-col gap-5"
            >
              <span className="font-fraunces text-[16px] font-bold text-red-400">Xóa tài khoản vĩnh viễn</span>
              <p className="font-jakarta text-[13px] text-[#94A3B8]">
                Hành động này <strong className="text-[#F8FAFC]">không thể hoàn tác</strong>. Tất cả dữ liệu bao gồm lịch sử thi và Tia sẽ bị xóa.
              </p>
              <div className="flex flex-col gap-1.5">
                <span className="font-jakarta text-[12px] text-[#64748B]">Nhập địa chỉ email của bạn để xác nhận:</span>
                <input
                  className="px-4 py-2.5 rounded-xl border border-[#1E2A44] bg-[#111827] font-jakarta text-[13px] text-[#F0F4FF] focus:outline-none focus:border-red-400"
                  placeholder={user.email}
                  value={deleteEmail}
                  onChange={e => setDeleteEmail(e.target.value)}
                />
              </div>
              {dangerError && <p className="font-jakarta text-[12px] text-red-400">{dangerError}</p>}
              <div className="flex gap-2">
                <button
                  disabled={dangerLoading || deleteEmail !== user.email}
                  onClick={async () => {
                    setDangerLoading(true)
                    setDangerError('')
                    const { error } = await deleteAccount(deleteEmail)
                    setDangerLoading(false)
                    if (error) { setDangerError(typeof error === 'string' ? error : 'Thất bại, vui lòng thử lại') }
                    else { setShowDeleteModal(false); logout() }
                  }}
                  className="flex-1 py-2.5 rounded-xl font-jakarta text-[13px] font-bold transition disabled:opacity-40"
                  style={{ background: '#EF4444', color: '#fff' }}
                >
                  {dangerLoading ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
                </button>
                <button
                  onClick={() => { setShowDeleteModal(false); setDangerError(''); setDeleteEmail('') }}
                  className="px-4 py-2.5 rounded-xl font-jakarta text-[13px] text-[#64748B] hover:text-[#F8FAFC] transition"
                >
                  Huỷ
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  )
}
