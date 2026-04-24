import { createContext, useContext, useReducer } from 'react'
import { createSession, tick } from '../engine/examEngine.js'

const ExamContext = createContext(null)
const ExamDispatch = createContext(null)

const initialState = {
  exam: null,
  questions: [],
  answers: {},
  mode: 'timed',
  timeLeft: null,
  status: 'idle', // idle | active | timeout | submitted
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
