import { createContext, useContext, useReducer } from 'react'

const HistoryContext = createContext(null)

const STORAGE_KEY = 'exam_history'

function load() {
  try {
    const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    const seen = new Set()
    return arr.filter(r => r?.id && !seen.has(r.id) && seen.add(r.id))
  } catch {
    return []
  }
}

function save(results) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(results))
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const next = [action.result, ...state.filter(r => r.id !== action.result.id)]
      save(next)
      return next
    }
    case 'LOAD':
      return action.results
    default:
      return state
  }
}

export function HistoryProvider({ children }) {
  // Lazy initializer: load from localStorage synchronously on first render
  // so results are available before any child effects fire.
  const [results, dispatch] = useReducer(reducer, undefined, load)

  function addResult(result) {
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
