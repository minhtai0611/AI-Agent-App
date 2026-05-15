import { createContext, useContext, useEffect, useReducer, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { getHistory, postHistory } from '../api/aiClient'

const HistoryContext = createContext(null)

const STORAGE_KEY = 'exam_history'

function loadLocal() {
  try {
    const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    const seen = new Set()
    return arr.filter(r => r?.id && !seen.has(r.id) && seen.add(r.id))
  } catch {
    return []
  }
}

function saveLocal(results) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(results))
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const next = [action.result, ...state.filter(r => r.id !== action.result.id)]
      if (!action.serverMode) saveLocal(next)
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

  const [results, dispatch] = useReducer(reducer, undefined, loadLocal)

  // Keep ref in sync so addResult closure always has the current value
  useEffect(() => { serverModeRef.current = serverMode }, [serverMode])

  // Register callback so AuthContext can flip server mode on login/logout
  useEffect(() => {
    registerResetToLocal?.((useLocal) => {
      setServerMode(!useLocal)
      if (useLocal) {
        // Revert to localStorage snapshot
        dispatch({ type: 'LOAD', results: loadLocal() })
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
    dispatch({ type: 'ADD', result, serverMode: isServer })
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
