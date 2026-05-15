import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { googleSignIn, getMe, postHistory, setLogoutRef, updateProfile as apiUpdateProfile } from '../api/aiClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const resetToLocalRef = useRef(null)

  // On mount: validate stored token
  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
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

  // Register / unregister logout callback for the Axios 401 interceptor
  useEffect(() => {
    setLogoutRef(logout)
    return () => setLogoutRef(null)
  })

  async function login(credential) {
    const { data, error } = await googleSignIn(credential)
    if (error || !data) throw new Error(error || 'Đăng nhập thất bại')

    localStorage.setItem('auth_token', data.access_token)

    // Fetch full profile (includes grade, province, credits, tier, etc.)
    const { data: profile } = await getMe()
    setUser(profile || data.user)

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

  async function updateProfile(fields) {
    const { data, error } = await apiUpdateProfile(fields)
    if (error) throw new Error(error)
    setUser(prev => ({ ...prev, ...data }))
    return data
  }

  function logout() {
    localStorage.removeItem('auth_token')
    setUser(null)
    resetToLocalRef.current?.(true)
  }

  function registerResetToLocal(fn) {
    resetToLocalRef.current = fn
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, registerResetToLocal, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
