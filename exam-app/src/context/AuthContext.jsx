import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { googleSignIn, emailLogin as apiEmailLogin, emailRegister as apiEmailRegister, getMe, postHistory, setLogoutRef, setRefreshUserRef, setCreditRefs, setCsrfToken, updateProfile as apiUpdateProfile, deleteAccount as apiDeleteAccount, deactivateAccount as apiDeactivateAccount, reactivateAccount as apiReactivateAccount, upsertDevice } from '../api/aiClient'
import axios from 'axios'
import { getDeviceId, getDeviceLabel, getLocation } from '../utils/deviceInfo'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const resetToLocalRef = useRef(null)

  // On mount: restore session from HttpOnly cookie via GET /users/me
  useEffect(() => {
    const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
    getMe().then(({ data, error }) => {
      if (error || !data) {
        // Try a silent refresh in case the access cookie expired
        axios.post(`${BASE}/api/refresh`, {}, { withCredentials: true })
          .then(res => {
            const newCsrf = res.data?.csrf_token
            if (newCsrf) setCsrfToken(newCsrf)
            return getMe()
          })
          .then(({ data: d2 }) => {
            if (d2) { setCsrfToken(d2.csrf_token); setUser(d2) }
          })
          .catch(() => {})
          .finally(() => setLoading(false))
      } else {
        if (data.csrf_token) setCsrfToken(data.csrf_token)
        setUser(data)
        setLoading(false)
      }
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

  // Proactively refresh the access token every 45 min so it never silently expires
  // while the user is idle on a page (access TTL is 1 hour; 45 min gives a safety margin).
  useEffect(() => {
    if (!user) return
    const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
    const id = setInterval(() => {
      axios.post(`${BASE}/api/refresh`, {}, { withCredentials: true })
        .then(res => { if (res.data?.csrf_token) setCsrfToken(res.data.csrf_token) })
        .catch(() => {})
    }, 45 * 60 * 1000)
    return () => clearInterval(id)
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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

    if (data.csrf_token) setCsrfToken(data.csrf_token)

    // Fetch full profile (includes grade, province, credits, tier, etc.)
    const { data: profile } = await getMe()
    if (profile?.csrf_token) setCsrfToken(profile.csrf_token)
    setUser(profile || data.user)

    // Fire-and-forget device location capture.
    // Deferred until profile is complete so the browser GPS permission dialog
    // does not collide with the profile-completion modal (location bug fix).
    const currentUser = profile || data.user
    if (currentUser?.grade && currentUser?.province) {
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
    }

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

  async function emailLogin(email, password) {
    const { data, error } = await apiEmailLogin(email, password)
    if (error || !data) throw new Error(error || 'Đăng nhập thất bại')
    if (data.csrf_token) setCsrfToken(data.csrf_token)
    const { data: profile } = await getMe()
    if (profile?.csrf_token) setCsrfToken(profile.csrf_token)
    setUser(profile || data.user)
    resetToLocalRef.current?.(false)
  }

  async function emailRegister(email, password) {
    const { data, error } = await apiEmailRegister(email, password)
    if (error || !data) throw new Error(error || 'Đăng ký thất bại')
    return data // caller handles "verification_sent" vs "debug_token"
  }

  async function refreshUser() {
    const { data } = await getMe()
    if (data) {
      if (data.csrf_token) setCsrfToken(data.csrf_token)
      setUser(data)
    }
  }

  async function updateProfile(fields) {
    const { data, error } = await apiUpdateProfile(fields)
    if (error) throw new Error(error)
    setUser(prev => {
      const next = { ...prev, ...data }
      // Profile just became complete — now safe to request GPS (modal is gone)
      if (next?.grade && next?.province && !(prev?.grade && prev?.province)) {
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
      }
      return next
    })
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
    const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
    // Clear cookies server-side (fire-and-forget — don't block UI)
    axios.post(`${BASE}/api/logout`, {}, { withCredentials: true }).catch(() => {})
    setCsrfToken(null)
    localStorage.removeItem('auth_token')  // remove legacy token if still present
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
    <AuthContext.Provider value={{ user, loading, login, emailLogin, emailRegister, logout, registerResetToLocal, updateProfile, refreshUser, deductCredits, refundCredits, deleteAccount, deactivateAccount, reactivateAccount }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
