import { createContext, useContext, useEffect, useReducer, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { getHistory, postHistory } from '../api/aiClient'

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

  async function addResult(result) {
    const isServer = serverModeRef.current
    dispatch({ type: 'ADD', result, serverMode: isServer, userId: userIdRef.current })
    if (isServer) {
      // Fire-and-forget; failure is silent (result is already in local state)
      postHistory([{
        result_id: result.id,
        exam_id: result.examId ?? null,
        score: result.score ?? null,
        payload: result,
        created_at: result.createdAt ?? null,
      }])
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
