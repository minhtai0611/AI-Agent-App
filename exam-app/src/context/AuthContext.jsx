import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { googleSignIn, getMe, postHistory, setLogoutRef, setRefreshUserRef, setCreditRefs, updateProfile as apiUpdateProfile, deleteAccount as apiDeleteAccount, deactivateAccount as apiDeactivateAccount, reactivateAccount as apiReactivateAccount, upsertDevice } from '../api/aiClient'
import { getDeviceId, getDeviceLabel, getLocation } from '../utils/deviceInfo'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const resetToLocalRef = useRef(null)

  // On mount: validate stored token (check expiry before API call)
  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      if (payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('auth_token')
        setLoading(false)
        return
      }
    } catch {
      localStorage.removeItem('auth_token')
      setLoading(false)
      return
    }
    getMe().then(({ data, error }) => {
      if (error || !data) {
        localStorage.removeItem('auth_token')
      } else {
        setUser(data)
      }
      setLoading(false)
    })
  }, [])

  // Register / unregister logout + refresh callbacks for the Axios interceptor
  useEffect(() => {
    setLogoutRef(logout)
    setRefreshUserRef(refreshUser)
    return () => { setLogoutRef(null); setRefreshUserRef(null) }
  })

  // Keep credit refs current so aiClient.js optimistic deduction stays in sync
  useEffect(() => {
    setCreditRefs(deductCredits, refundCredits)
  })

  // Refresh user data when tab regains focus (catches server-side credit/tier changes)
  useEffect(() => {
    if (!user) return
    let lastRefresh = Date.now()
    function onVisible() {
      if (document.visibilityState === 'visible' && Date.now() - lastRefresh > 60_000) {
        lastRefresh = Date.now()
        refreshUser()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function login(credential) {
    let pendingRef = null
    try { pendingRef = sessionStorage.getItem('pending_ref') } catch { /* ignore */ }
    const { data, error } = await googleSignIn(credential, pendingRef)
    if (error || !data) throw new Error(error || 'Đăng nhập thất bại')

    localStorage.setItem('auth_token', data.access_token)
    localStorage.removeItem('guest_trial_used')

    // Fetch full profile (includes grade, province, credits, tier, etc.)
    const { data: profile } = await getMe()
    setUser(profile || data.user)

    // Fire-and-forget device location capture — must never block login
    ;(async () => {
      try {
        const loc = await getLocation()
        await upsertDevice({
          device_id: getDeviceId(),
          device_label: getDeviceLabel(),
          city: loc?.city ?? null,
          province: loc?.province ?? null,
          country: loc?.country ?? null,
          country_code: loc?.country_code ?? null,
        })
      } catch { /* silent */ }
    })()

    // Clear pending referral code after use
    try { sessionStorage.removeItem('pending_ref') } catch { /* ignore */ }

    // Sync local history to server then clear local copy
    try {
      const local = JSON.parse(localStorage.getItem('exam_history') ?? '[]')
      if (local.length > 0) {
        await postHistory(local)
        localStorage.removeItem('exam_history')
      }
    } catch {
      // non-fatal — history sync failure shouldn't block login
    }

    // Tell HistoryContext to switch to server mode
    resetToLocalRef.current?.(false)
  }

  async function refreshUser() {
    const { data } = await getMe()
    if (data) setUser(data)
  }

  async function updateProfile(fields) {
    const { data, error } = await apiUpdateProfile(fields)
    if (error) throw new Error(error)
    setUser(prev => ({ ...prev, ...data }))
    return data
  }

  function deductCredits(amount) {
    setUser(prev => prev ? { ...prev, credits_balance: Math.max(0, (prev.credits_balance ?? 0) - amount) } : prev)
  }

  function refundCredits(amount) {
    setUser(prev => prev ? { ...prev, credits_balance: (prev.credits_balance ?? 0) + amount } : prev)
  }

  function logout() {
    const uid = user?.id
    localStorage.removeItem('auth_token')
    localStorage.removeItem('guest_trial_used')
    localStorage.removeItem('offline_queue_size')
    // Clear user-namespaced keys so next user gets a clean slate
    if (uid) {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(`user-${uid}-`)) localStorage.removeItem(key)
      }
    }
    localStorage.removeItem('exam_history')
    setUser(null)
    resetToLocalRef.current?.(true)
  }

  async function deleteAccount(confirmEmail) {
    const { error } = await apiDeleteAccount(confirmEmail)
    if (error) throw new Error(typeof error === 'string' ? error : 'Xóa tài khoản thất bại')
    logout()
  }

  async function deactivateAccount() {
    const { error } = await apiDeactivateAccount()
    if (error) throw new Error(typeof error === 'string' ? error : 'Tạm ngưng thất bại')
    logout()
  }

  async function reactivateAccount() {
    const { error } = await apiReactivateAccount()
    if (error) throw new Error(typeof error === 'string' ? error : 'Kích hoạt lại thất bại')
    await refreshUser()
  }

  function registerResetToLocal(fn) {
    resetToLocalRef.current = fn
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, registerResetToLocal, updateProfile, refreshUser, deductCredits, refundCredits, deleteAccount, deactivateAccount, reactivateAccount }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
