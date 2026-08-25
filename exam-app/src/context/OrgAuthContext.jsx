import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { fetchMe, fetchBranding, logout as apiLogout } from '../api/org.js'

const OrgAuthContext = createContext(null)

export function OrgAuthProvider({ children }) {
  const [state, setState] = useState({ member: null, org: null, branding: null, status: 'loading' })

  useEffect(() => {
    fetchMe()
      .then(async ({ member, org }) => {
        const branding = await fetchBranding(org.id).catch(() => null)
        setState({ member, org, branding, status: 'authenticated' })
      })
      .catch(() => setState({ member: null, org: null, branding: null, status: 'anonymous' }))
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } finally {
      setState({ member: null, org: null, branding: null, status: 'anonymous' })
    }
  }, [])

  const isOrgSession = state.status === 'authenticated'

  return (
    <OrgAuthContext.Provider value={{ ...state, isOrgSession, logout }}>
      {children}
    </OrgAuthContext.Provider>
  )
}

export function useOrgAuth() {
  return useContext(OrgAuthContext)
}
