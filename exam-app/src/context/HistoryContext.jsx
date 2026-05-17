import { createContext, useContext, useEffect, useReducer, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { getHistory, postHistory } from '../api/aiClient'
import { enqueueHistoryEntry, flushQueue, getPendingCount } from '../utils/offlineSync'

const HistoryContext = createContext(null)

const GUEST_KEY = 'exam_history'

function storageKey(userId) {
  return userId ? `user-${userId}-exam_history` : GUEST_KEY
}

function loadLocal(userId) {
  try {
    const arr = JSON.parse(localStorage.getItem(storageKey(userId)) ?? '[]')
    const seen = new Set()
    return arr.filter(r => r?.id && !seen.has(r.id) && seen.add(r.id))
  } catch {
    return []
  }
}

function saveLocal(results, userId) {
  localStorage.setItem(storageKey(userId), JSON.stringify(results))
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const next = [action.result, ...state.filter(r => r.id !== action.result.id)]
      if (!action.serverMode) saveLocal(next, action.userId)
      return next
    }
    case 'LOAD':
      return action.results
    default:
      return state
  }
}

export function HistoryProvider({ children }) {
  const { user, registerResetToLocal } = useAuth()
  const [serverMode, setServerMode] = useState(!!user)
  const serverModeRef = useRef(serverMode)
  const userIdRef = useRef(user?.id ?? null)

  const [results, dispatch] = useReducer(reducer, undefined, () => loadLocal(null))

  // Keep refs in sync so closures always have current values
  useEffect(() => { serverModeRef.current = serverMode }, [serverMode])
  useEffect(() => { userIdRef.current = user?.id ?? null }, [user])

  // Register callback so AuthContext can flip server mode on login/logout
  useEffect(() => {
    registerResetToLocal?.((useLocal) => {
      setServerMode(!useLocal)
      if (useLocal) {
        dispatch({ type: 'LOAD', results: loadLocal(null) })
      }
    })
  }, [registerResetToLocal])

  // When user becomes authenticated, fetch history from server
  useEffect(() => {
    if (!user) return
    setServerMode(true)
    getHistory().then(({ data }) => {
      if (!data) return
      // Map server shape (result_id, payload) → local shape (id, ...)
      const mapped = data.map(r => {
        const payload = typeof r.payload === 'string' ? JSON.parse(r.payload) : (r.payload || {})
        return {
          id: r.result_id,
          examId: r.exam_id,
          score: r.score,
          createdAt: r.created_at,
          ...payload,
        }
      })
      dispatch({ type: 'LOAD', results: mapped })
    })
  }, [user])

  // Flush offline queue whenever user comes back online (and is authenticated)
  useEffect(() => {
    function handleOnline() {
      if (!serverModeRef.current) return
      flushQueue(postHistory)
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  // Also try to flush on login (user may have been offline before authenticating)
  useEffect(() => {
    if (!user || !navigator.onLine) return
    if (getPendingCount() > 0) flushQueue(postHistory)
  }, [user])

  async function addResult(result) {
    const isServer = serverModeRef.current
    dispatch({ type: 'ADD', result, serverMode: isServer, userId: userIdRef.current })

    if (isServer) {
      const entry = {
        result_id: result.id,
        exam_id: result.examId ?? null,
        score: result.score ?? null,
        payload: { ...result, durationSeconds: result.timeSpent ?? null },
        created_at: result.createdAt ?? null,
      }
      if (!navigator.onLine) {
        // Device is offline — queue for later sync
        enqueueHistoryEntry(entry)
      } else {
        // Online — post now; if it fails, queue for retry
        postHistory([entry]).then(({ error }) => {
          if (error) enqueueHistoryEntry(entry)
        })
      }
    }
    return result.id
  }

  return (
    <HistoryContext.Provider value={{ results, addResult }}>
      {children}
    </HistoryContext.Provider>
  )
}

export function useHistory() {
  return useContext(HistoryContext)
}
