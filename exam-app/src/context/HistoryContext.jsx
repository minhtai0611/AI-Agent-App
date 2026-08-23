import { createContext, useContext, useEffect, useReducer } from 'react'

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
      saveLocal(next)
      return next
    }
    case 'LOAD':
      return action.results
    default:
      return state
  }
}

export function HistoryProvider({ children }) {
  const [results, dispatch] = useReducer(reducer, undefined, loadLocal)

  // Cross-tab sync: reload history when another tab completes an exam
  useEffect(() => {
    function handleStorage(e) {
      if (e.key !== STORAGE_KEY) return
      dispatch({ type: 'LOAD', results: loadLocal() })
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  async function addResult(result) {
    dispatch({ type: 'ADD', result })
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
