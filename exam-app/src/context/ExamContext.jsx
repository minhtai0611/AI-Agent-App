import { createContext, useContext, useReducer } from 'react'
import { createSession, tick } from '../engine/examEngine.js'

const ExamContext = createContext(null)
const ExamDispatch = createContext(null)

const initialState = {
  exam: null,
  questions: [],
  answers: {},
  hints: {},
  flags: {},
  mode: 'timed',
  timeLeft: null,
  status: 'idle', // idle | active | paused | timeout | submitted
  timePerQuestion: {},
}

function reducer(state, action) {
  switch (action.type) {
    case 'START_EXAM': {
      const session = createSession(action.exam, action.questions, action.mode)
      return { ...state, ...session, status: 'active' }
    }
    case 'ANSWER_QUESTION':
      return {
        ...state,
        answers: { ...state.answers, [action.questionId]: action.choiceIndex },
      }
    case 'SET_HINT': {
      const prev = state.hints[action.questionId] || { count: 0, texts: [] }
      return {
        ...state,
        hints: {
          ...state.hints,
          [action.questionId]: {
            count: action.count,
            texts: [...prev.texts, action.text],
          },
        },
      }
    }
    case 'TOGGLE_FLAG':
      return {
        ...state,
        flags: {
          ...state.flags,
          [action.questionId]: !state.flags[action.questionId],
        },
      }
    case 'PAUSE':
      return { ...state, status: 'paused' }
    case 'RESUME':
      return { ...state, status: 'active' }
    case 'RECORD_TIME':
      return {
        ...state,
        timePerQuestion: {
          ...state.timePerQuestion,
          [action.questionId]: (state.timePerQuestion[action.questionId] ?? 0) + action.seconds,
        },
      }
    case 'TICK':
      return tick(state)
    case 'SUBMIT':
      return { ...state, status: 'submitted' }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

export function ExamProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return (
    <ExamDispatch.Provider value={dispatch}>
      <ExamContext.Provider value={state}>
        {children}
      </ExamContext.Provider>
    </ExamDispatch.Provider>
  )
}

export function useExam() {
  return useContext(ExamContext)
}

export function useExamDispatch() {
  return useContext(ExamDispatch)
}

export function useHints() {
  const { hints } = useContext(ExamContext)
  const dispatch = useContext(ExamDispatch)
  const setHint = (questionId, count, text) =>
    dispatch({ type: 'SET_HINT', questionId, count, text })
  return { hints, setHint }
}

export function useFlags() {
  const { flags } = useContext(ExamContext)
  const dispatch = useContext(ExamDispatch)
  const toggleFlag = (questionId) => dispatch({ type: 'TOGGLE_FLAG', questionId })
  return { flags, toggleFlag }
}
