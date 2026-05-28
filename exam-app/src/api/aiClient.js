import axios from 'axios'
import { loadPreferences } from '../utils/aiPreferences.js'

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const client = axios.create({ baseURL: BASE, timeout: 30000 })
const slowClient = axios.create({ baseURL: BASE, timeout: 130000 })

let _logoutRef = null
export function setLogoutRef(fn) { _logoutRef = fn }

let _refreshUserRef = null
export function setRefreshUserRef(fn) { _refreshUserRef = fn }

// Optimistic credit helpers — wired in by AuthContext on mount
let _deductRef = null
let _refundRef = null
export function setCreditRefs(deduct, refund) { _deductRef = deduct; _refundRef = refund }

const _ACCOUNT_STATUS_CODES = new Set(['account_locked', 'account_suspended', 'account_deactivated'])

function _attachInterceptors(instance) {
  instance.interceptors.request.use(config => {
    const token = localStorage.getItem('auth_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })
  instance.interceptors.response.use(
    res => res,
    err => {
      const status = err.response?.status
      const code = err.response?.data?.detail?.code ?? err.response?.data?.code
      if (status === 401) {
        localStorage.removeItem('auth_token')
        _logoutRef?.()
      } else if (status === 403 && _ACCOUNT_STATUS_CODES.has(code)) {
        // Refresh user so App.jsx picks up the new account status flag and shows the modal
        _refreshUserRef?.()
      }
      return Promise.reject(err)
    }
  )
}

// Separate instance for admin requests — no 401 auto-logout (admin key failures must not log out the user)
const adminClient = axios.create({ baseURL: BASE, timeout: 30000 })

_attachInterceptors(client)
_attachInterceptors(slowClient)

async function withRetry(fn, attempts = 2) {
  for (let i = 0; i <= attempts; i++) {
    try { return await fn() }
    catch (err) {
      const status = err?.response?.status
      // Don't retry 4xx (auth/credits/tier errors) or last attempt
      if (i === attempts || (status && status < 500)) throw err
      await new Promise(r => setTimeout(r, 800 * (i + 1)))
    }
  }
}

function wrap(promise) {
  return promise
    .then(res => ({ data: res.data, error: null, status: res.status }))
    .catch(err => {
      if (!err.response) return { data: null, error: 'Không kết nối được server — hãy kiểm tra backend đang chạy', status: 0 }
      const detail = err.response.data?.detail
      // Preserve structured error objects (e.g. 402 insufficient_credits)
      return { data: null, error: detail ?? err.message ?? 'Lỗi kết nối', status: err.response.status }
    })
}

function wrapRetry(fn) {
  return wrap(withRetry(fn).catch(err => Promise.reject(err)))
}

// Deducts `cost` Tia immediately, refunds if the server returns 402.
async function wrapOptimistic(cost, fn) {
  if (!navigator.onLine) return { data: null, error: 'Bạn đang ngoại tuyến — kết nối mạng để dùng tính năng AI', status: 0 }
  _deductRef?.(cost)
  const result = await wrap(withRetry(fn).catch(err => Promise.reject(err)))
  if (result.status === 402) _refundRef?.(cost)
  return result
}

function withAIPrefs(payload) {
  return { ai_preferences: loadPreferences(), ...payload }
}

export function analyzeResult(payload) {
  return wrapOptimistic(3, () => client.post('/analyze', withAIPrefs(payload)))
}

// Streams AI analysis as NDJSON field-by-field.
// onUpdate({ field: accumulatedValue, ... }) is called (via RAF) as content arrives.
// Returns { data: analysisObj, error, status } when the stream ends.
export async function analyzeResultStream(payload, onUpdate, signal) {
  if (!navigator.onLine) return { data: null, error: 'Bạn đang ngoại tuyến — kết nối mạng để dùng tính năng AI', status: 0 }
  const token = localStorage.getItem('auth_token')
  if (!token) return { data: null, error: 'not authenticated', status: 401 }
  _deductRef?.(3)

  const fieldData = {}   // accumulated field text (raw)
  const pending = {}     // batched updates waiting for next RAF
  let rafId = null

  const flush = () => {
    rafId = null
    if (Object.keys(pending).length === 0) return
    const snap = { ...pending }
    Object.keys(pending).forEach(k => delete pending[k])
    onUpdate?.(snap)
  }

  try {
    const res = await fetch(`${BASE}/analyze/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(withAIPrefs(payload)),
      signal,
    })
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}))
      if (res.status === 402) _refundRef?.(3)
      return { data: null, error: detail?.detail ?? `HTTP ${res.status}`, status: res.status }
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')  // handles Vietnamese 3-byte sequences across chunks
    let lineBuffer = ''

    while (true) {
      if (signal?.aborted) { reader.cancel(); return { data: null, error: 'aborted', status: 0 } }
      const { value, done } = await reader.read()
      if (done) break
      lineBuffer += decoder.decode(value, { stream: true })
      const lines = lineBuffer.split('\n')
      lineBuffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const event = JSON.parse(line)
          if (event.error) return { data: null, error: event.error, status: 502 }
          const { field, chunk, done: isDone } = event
          if (!field) continue

          if (isDone) {
            // Field complete — try to JSON-decode string escape sequences
            const raw = fieldData[field] ?? ''
            let final = raw
            try { final = JSON.parse('"' + raw + '"') } catch { /* keep raw */ }
            fieldData[field] = final
          } else if (chunk) {
            fieldData[field] = (fieldData[field] ?? '') + chunk
            pending[field] = fieldData[field]
            if (!rafId) rafId = requestAnimationFrame(flush)
          }
        } catch { /* ignore malformed line */ }
      }
    }

    // Flush any remaining buffered updates
    if (rafId) cancelAnimationFrame(rafId)
    flush()

    // Parse array fields from JSON strings
    for (const f of ['weak_topics', 'recommendations', 'schools']) {
      if (typeof fieldData[f] === 'string') {
        try { fieldData[f] = JSON.parse(fieldData[f]) } catch { /* leave as string */ }
      }
    }

    return { data: fieldData, error: null, status: 200 }
  } catch (err) {
    if (rafId) cancelAnimationFrame(rafId)
    if (err.name === 'AbortError') return { data: null, error: 'aborted', status: 0 }
    return { data: null, error: err?.message ?? 'Stream error', status: 0 }
  }
}

export function getHint(payload) {
  return wrapOptimistic(1, () => client.post('/hint', withAIPrefs(payload)))
}

export function getExplanation(payload) {
  return wrapOptimistic(1, () => client.post('/explain', withAIPrefs(payload)))
}

export function sendTutorMessage(payload) {
  return wrapOptimistic(1, () => client.post('/tutor', withAIPrefs(payload)))
}

export function generateStudyPlan(payload) {
  return wrapRetry(() => slowClient.post('/study-plan', payload))
}

export async function solveMath(question, imageFile) {
  let imagePayload = {}
  if (imageFile) {
    try {
      const buf = await imageFile.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      imagePayload = {
        image_base64: btoa(binary),
        image_mime: imageFile.type || 'image/jpeg',
      }
    } catch { /* ignore serialisation errors — proceed without image */ }
  }
  return wrap(slowClient.post('/math-solve', { question, ...imagePayload }))
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


export function googleSignIn(idToken, ref) {
  return wrap(client.post('/auth/google', { id_token: idToken, ...(ref ? { ref } : {}) }))
}

// ── Learning Graph / Review endpoints ────────────────────────────────────────

export function migrateReviewItems(items) {
  return wrap(client.post('/users/me/review-items', { items }))
}

export function getDueReviewItems() {
  return wrap(client.get('/users/me/review-items/due'))
}

export function answerReviewItem(itemId, quality, responseTimeSeconds = null) {
  return wrap(client.post(`/users/me/review-items/${itemId}/answer`, {
    quality,
    response_time_seconds: responseTimeSeconds,
  }))
}

export function getConceptMastery() {
  return wrap(client.get('/users/me/concept-mastery'))
}

export function getSessionToday() {
  return wrap(client.get('/users/me/session/today'))
}

export function completeSession() {
  return wrap(client.post('/users/me/session/complete'))
}

export function useStreakFreeze() {
  return wrap(client.post('/users/me/streak-freeze'))
}

export function getAdaptiveStudyPlan() {
  return wrap(client.get('/users/me/adaptive-study-plan'))
}

export function seedDiagnostic(weights) {
  return wrap(client.post('/users/me/diagnostic-seed', { weights }))
}

export function submitPlacement(answers) {
  return wrap(client.post('/users/me/placement', { answers }))
}

export function getMe() {
  return wrap(client.get('/users/me'))
}

export function updateExtendedProfile(payload) {
  return wrap(client.post('/users/me/profile/extended', payload))
}

export function updateProfile(payload) {
  return wrap(client.post('/users/me/profile', payload))
}

export function updateUsername(username) {
  return wrap(client.patch('/users/me/username', { username }))
}

export function acceptTos() {
  return wrap(client.post('/users/me/tos-accept'))
}

export function activateTrial() {
  return wrap(client.post('/users/me/trial'))
}

export function reportQuestion(questionId, reason) {
  return wrap(client.post(`/questions/${questionId}/report`, { reason }))
}

export function getCreditLog() {
  return wrap(client.get('/users/me/credits/log'))
}

export function classifyError(question, wrongChoice, correctChoice) {
  return wrap(client.post('/classify-error', { question, wrong_choice: wrongChoice, correct_choice: correctChoice }))
}

export function getPercentile(examId, score) {
  return wrap(client.get(`/results/${encodeURIComponent(examId)}/percentile`, { params: { score } }))
}

export function generateAdaptivePractice(payload) {
  return wrapOptimistic(payload.count ?? 5, () => client.post('/adaptive-practice', payload))
}

export function getReferral() {
  return wrap(client.get('/users/me/referral'))
}

export function createClass(name) {
  return wrap(client.post('/classes', { name }))
}

export function joinClass(code) {
  return wrap(client.post('/classes/join', { code }))
}

export function listClasses() {
  return wrap(client.get('/classes'))
}

export function getClassResults(classId) {
  return wrap(client.get(`/classes/${classId}/results`))
}

export function ocrExam(file) {
  const form = new FormData()
  form.append('file', file)
  return wrap(client.post('/ocr/exam', form))
}

export function postHistory(entries) {
  return wrap(client.post('/users/me/history', entries))
}

export function getHistory() {
  return wrap(client.get('/users/me/history'))
}

export const deleteAccount = (confirmEmail) =>
  wrap(client.delete('/users/me', { data: { confirm_email: confirmEmail } }))

export const deactivateAccount = () =>
  wrap(client.post('/users/me/deactivate'))

export const reactivateAccount = () =>
  wrap(client.post('/users/me/reactivate'))

export const adminListUsers = (key, { search = '', page = 1, limit = 20 } = {}) =>
  wrap(adminClient.get('/admin/users', { params: { search, page, limit }, headers: { 'x-admin-key': key } }))

export const adminDeleteUser = (key, userId) =>
  wrap(adminClient.delete(`/admin/users/${userId}`, { headers: { 'x-admin-key': key } }))

export const adminUnlockUser = (key, userId) =>
  wrap(adminClient.post(`/admin/users/${userId}/unlock`, {}, { headers: { 'x-admin-key': key } }))

export const adminResetUser = (key, userId) =>
  wrap(adminClient.post(`/admin/users/${userId}/reset`, {}, { headers: { 'x-admin-key': key } }))

export const adminSuspendUser = (key, userId, reason) =>
  wrap(adminClient.post(`/admin/users/${userId}/suspend`, { reason }, { headers: { 'x-admin-key': key } }))

export const adminUnsuspendUser = (key, userId) =>
  wrap(adminClient.post(`/admin/users/${userId}/unsuspend`, {}, { headers: { 'x-admin-key': key } }))

export const adminGrantCredits = (key, userId, amount) =>
  wrap(adminClient.post(`/admin/users/${userId}/credits`, { amount }, { headers: { 'x-admin-key': key } }))

export const adminGetSecurityEvents = (key) =>
  wrap(adminClient.get('/admin/security-events', { headers: { 'x-admin-key': key } }))

export const getPaymentConfig = () =>
  wrap(client.get('/payment/config'))

export const getDailyChallenge = () =>
  wrap(client.get('/daily-challenge'))

export const submitDailyScore = ({ question_id, correct }) =>
  wrap(client.post('/daily-challenge/score', { question_id, correct }))

export const generateExam = (topicFocus, difficulty = 'medium', count = 10) =>
  wrap(client.post('/generate-exam', { topic_focus: topicFocus, difficulty, count }))

export const predictScore = () =>
  wrap(client.get('/predict-score'))

export const examStrategy = () =>
  wrap(client.post('/strategy', {}))

export const compareProvince = () =>
  wrap(client.get('/compare/province'))

export const getChartInsights = (payload) =>
  wrap(client.post('/insights/charts', payload))

export const getWeeklyInsight = (payload) =>
  wrap(client.post('/insights/weekly', payload))

export const getPeerStats = () =>
  wrap(client.get('/insights/peer-stats'))

// ── Sprint 19: Teacher class integration ─────────────────────────────────────

export const getClassInfo = () =>
  wrap(client.get('/teacher-classes/me'))

export const joinTeacherClass = (class_code) =>
  wrap(client.post('/teacher-classes/join', { class_code }))

// ── Sprint 21: MOAT 5 — Study Partner Matching ────────────────────────────────

export const getPartnerCandidates = () =>
  wrap(client.get('/study-partners/candidates'))

export const connectPartner = (partner_id) =>
  wrap(client.post('/study-partners/connect', { partner_id }))

export const getMyPartners = () =>
  wrap(client.get('/study-partners/me'))

export const respondToPartner = (request_id, action) =>
  wrap(client.post('/study-partners/respond', { request_id, action }))

export const getSimulationBriefing = (payload) =>
  wrap(client.post('/insights/simulation-brief', payload))
