import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 30000,
})

const slowClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 90000,
})

function wrap(promise) {
  return promise
    .then(res => ({ data: res.data, error: null }))
    .catch(err => ({ data: null, error: err?.response?.data?.detail || err.message || 'Lỗi kết nối' }))
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
