import axios from 'axios'

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const client = axios.create({ baseURL: BASE, timeout: 30000 })
const slowClient = axios.create({ baseURL: BASE, timeout: 130000 })

let _logoutRef = null
export function setLogoutRef(fn) { _logoutRef = fn }

function _attachInterceptors(instance) {
  instance.interceptors.request.use(config => {
    const token = localStorage.getItem('auth_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })
  instance.interceptors.response.use(
    res => res,
    err => {
      if (err.response?.status === 401) {
        localStorage.removeItem('auth_token')
        _logoutRef?.()
      }
      return Promise.reject(err)
    }
  )
}

_attachInterceptors(client)
_attachInterceptors(slowClient)

function wrap(promise) {
  return promise
    .then(res => ({ data: res.data, error: null }))
    .catch(err => {
      if (!err.response) return { data: null, error: 'Không kết nối được server — hãy kiểm tra backend đang chạy' }
      return { data: null, error: err.response.data?.detail || err.message || 'Lỗi kết nối' }
    })
}

export function analyzeResult(payload) {
  return wrap(client.post('/analyze', payload))
}

export function getHint(payload) {
  return wrap(client.post('/hint', payload))
}

export function getExplanation(payload) {
  return wrap(client.post('/explain', payload))
}

export function sendTutorMessage(payload) {
  return wrap(client.post('/tutor', payload))
}

export function generateStudyPlan(payload) {
  return wrap(slowClient.post('/study-plan', payload))
}

export function solveMath(question) {
  return wrap(slowClient.post('/math-solve', { question }))
}

export function getMathStats() {
  return wrap(client.get('/math-stats'))
}

export function reviewMath(problem, solution) {
  return wrap(slowClient.post('/math-review', { problem, solution }))
}

export function ocrImage(file) {
  const form = new FormData()
  form.append('file', file)
  return wrap(slowClient.post('/math-ocr', form))
}

export function getWikiStatus() {
  return wrap(client.get('/wiki/status'))
}

export function generateWeekQuiz(payload) {
  return wrap(slowClient.post('/study-plan-quiz', payload))
}

export function googleSignIn(idToken) {
  return wrap(client.post('/auth/google', { id_token: idToken }))
}

export function getMe() {
  return wrap(client.get('/users/me'))
}

export function postHistory(entries) {
  return wrap(client.post('/users/me/history', entries))
}

export function getHistory() {
  return wrap(client.get('/users/me/history'))
}
