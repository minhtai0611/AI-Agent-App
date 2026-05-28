import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import App from './App.jsx'
import './index.css'
import { pruneStorage } from './utils/storageManager.js'

pruneStorage()

// Touch ripple: set --ripple-x/y CSS vars on click for .ripple-btn
document.addEventListener('click', e => {
  const btn = e.target.closest('.ripple-btn')
  if (!btn) return
  const rect = btn.getBoundingClientRect()
  btn.style.setProperty('--ripple-x', `${e.clientX - rect.left}px`)
  btn.style.setProperty('--ripple-y', `${e.clientY - rect.top}px`)
}, { passive: true })

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </React.StrictMode>,
)
