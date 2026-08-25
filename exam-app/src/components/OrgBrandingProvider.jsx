import { useEffect } from 'react'
import { useOrgAuth } from '../context/OrgAuthContext.jsx'

// Reuses the app's existing CSS-custom-property theming (see exam-app/src/index.css'
// --primary/--primary-fg/etc. tokens) — no new theming mechanism, just an override.
export default function OrgBrandingProvider() {
  const { branding } = useOrgAuth() ?? {}

  useEffect(() => {
    const root = document.documentElement
    if (!branding) return
    if (branding.branding_primary_color) {
      root.style.setProperty('--primary', branding.branding_primary_color)
      root.style.setProperty('--primary-border', branding.branding_primary_color)
    }
    if (branding.branding_secondary_color) {
      root.style.setProperty('--primary-subtle', branding.branding_secondary_color)
    }
    return () => {
      root.style.removeProperty('--primary')
      root.style.removeProperty('--primary-border')
      root.style.removeProperty('--primary-subtle')
    }
  }, [branding])

  return null
}
