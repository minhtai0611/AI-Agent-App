import axios from 'axios'
import { loadPreferences } from '../utils/aiPreferences.js'

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const client = axios.create({ baseURL: BASE, timeout: 30000, withCredentials: true })
const slowClient = axios.create({ baseURL: BASE, timeout: 130000, withCredentials: true })

// CSRF token — stored in memory only (never localStorage/cookie)
let _csrfToken = null
export function setCsrfToken(t) { _csrfToken = t }
export function getCsrfToken() { return _csrfToken }

let _logoutRef = null
export function setLogoutRef(fn) { _logoutRef = fn }

let _refreshUserRef = null
export function setRefreshUserRef(fn) { _refreshUserRef = fn }

// Optimistic credit helpers — wired in by AuthContext on mount
let _deductRef = null
let _refundRef = null
export function setCreditRefs(deduct, refund) { _deductRef = deduct; _refundRef = refund }

const _ACCOUNT_STATUS_CODES = new Set(['account_locked', 'account_suspended', 'account_deactivated'])
const _CSRF_METHODS = new Set(['post', 'put', 'delete', 'patch'])

// Serialize concurrent 401 → refresh requests (Amendment C2)
let _isRefreshing = false
let _pendingQueue = []

function _queueRequest() {
  return new Promise((resolve, reject) => _pendingQueue.push({ resolve, reject }))
}
function _drainQueue(csrfToken, error) {
  _pendingQueue.forEach(p => error ? p.reject(error) : p.resolve(csrfToken))
  _pendingQueue = []
}

function _attachInterceptors(instance) {
  instance.interceptors.request.use(config => {
    // Inject CSRF token on mutation requests (not on auth endpoints — they set the token)
    if (_csrfToken && _CSRF_METHODS.has(config.method?.toLowerCase())) {
      config.headers['X-CSRF-Token'] = _csrfToken
    }
    return config
  })
  instance.interceptors.response.use(
    res => res,
    async err => {
      const status = err.response?.status
      const code = err.response?.data?.detail?.code ?? err.response?.data?.code
      const config = err.config

      if (status === 401 && !config?._retried) {
        if (_isRefreshing) {
          // Wait for the in-flight refresh, then retry
          return _queueRequest().then(csrf => {
            setCsrfToken(csrf)
            config._retried = true
            return instance(config)
          }).catch(e => Promise.reject(e))
        }
        _isRefreshing = true
        try {
          const res = await axios.post(`${BASE}/api/refresh`, {}, { withCredentials: true })
          const newCsrf = res.data?.csrf_token
          if (newCsrf) setCsrfToken(newCsrf)
          _drainQueue(newCsrf)
          config._retried = true
          return instance(config)
        } catch (_refreshErr) {
          _drainQueue(null, _refreshErr)
          _logoutRef?.()
          return Promise.reject(err)
        } finally {
          _isRefreshing = false
        }
      }

      if (status === 403 && _ACCOUNT_STATUS_CODES.has(code)) {
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
      if (!err.response) return { data: null, error: 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.', status: 0 }
      const detail = err.response.data?.detail
      // Preserve structured error objects (e.g. 402 insufficient_credits)
      return { data: null, error: detail ?? err.message ?? 'Lỗi kết nối', status: err.response.status }
    })
}

function wrapRetry(fn) {
  return wrap(withRetry(fn).catch(err => Promise.reject(err)))
}

// Deducts `cost` Tia immediately, refunds if the server returns 402.
async function wrapOptimistic(cost, fn, featureName = '') {
  if (!navigator.onLine) return { data: null, error: 'Bạn đang ngoại tuyến — kết nối mạng để dùng tính năng AI', status: 0 }
  _deductRef?.(cost)
  const result = await wrap(withRetry(fn).catch(err => Promise.reject(err)))
  if (result.status === 402) {
    _refundRef?.(cost)
  } else if (result.data && featureName) {
    window.dispatchEvent(new CustomEvent('credit_spent', { detail: { cost, feature: featureName } }))
  }
  return result
}

function withAIPrefs(payload) {
  return { ai_preferences: loadPreferences(), ...payload }
}

export function analyzeResult(payload) {
  return wrapOptimistic(3, () => client.post('/analyze', withAIPrefs(payload)), 'Phân tích bài thi')
}

// Streams AI analysis as NDJSON field-by-field.
// onUpdate({ field: accumulatedValue, ... }) is called (via RAF) as content arrives.
// Returns { data: analysisObj, error, status } when the stream ends.
export async function analyzeResultStream(payload, onUpdate, signal) {
  if (!navigator.onLine) return { data: null, error: 'Bạn đang ngoại tuyến — kết nối mạng để dùng tính năng AI', status: 0 }
  if (!_csrfToken) return { data: null, error: 'not authenticated', status: 401 }
  _deductRef?.(3)

  const ARRAY_FIELDS = new Set(['weak_topics', 'recommendations', 'schools'])
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
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': _csrfToken ?? '' },
      credentials: 'include',
      body: JSON.stringify(withAIPrefs(payload)),
      signal,
    })
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}))
      console.error('[analyzeResultStream] HTTP error:', res.status, detail)
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
          if (event.error) return { data: Object.keys(fieldData).length ? fieldData : null, error: event.error, status: Object.keys(fieldData).length ? 200 : 502 }
          const { field, chunk, done: isDone } = event
          if (!field) continue

          if (isDone) {
            // Field complete — decode escape sequences for strings, parse JSON for arrays
            const raw = fieldData[field] ?? ''
            let final = raw
            if (ARRAY_FIELDS.has(field)) {
              try { final = JSON.parse(raw) } catch { /* keep as string */ }
            } else {
              try { final = JSON.parse('"' + raw + '"') } catch { /* keep raw */ }
            }
            fieldData[field] = final
            pending[field] = final
            if (!rafId) rafId = requestAnimationFrame(flush)
          } else if (chunk) {
            fieldData[field] = (fieldData[field] ?? '') + chunk
            const raw = fieldData[field]
            let pendingValue = raw
            if (ARRAY_FIELDS.has(field)) {
              try { pendingValue = JSON.parse(raw) } catch { /* keep as string until complete */ }
            }
            pending[field] = pendingValue
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
    console.error('[analyzeResultStream] stream error:', err)
    return { data: null, error: err?.message ?? 'Stream error', status: 0 }
  }
}

export function getHint(payload) {
  return wrapOptimistic(1, () => client.post('/hint', withAIPrefs(payload)), 'Gợi ý AI')
}

export function getExplanation(payload) {
  return wrapOptimistic(1, () => client.post('/explain', withAIPrefs(payload)), 'Giải thích AI')
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

export const emailRegister    = (email, password)     => wrap(client.post('/auth/email/register',        { email, password }))
export const emailVerify      = (token)               => wrap(client.post('/auth/email/verify',          { token }))
export const emailLogin       = (email, password)     => wrap(client.post('/auth/email/login',           { email, password }))
export const emailForgot      = (email)               => wrap(client.post('/auth/email/forgot-password', { email }))
export const emailReset       = (token, new_password) => wrap(client.post('/auth/email/reset-password',  { token, new_password }))
export const emailResendVerify = (email)              => wrap(client.post('/auth/email/resend-verify',   { email }))

export function upsertDevice(payload) {
  return wrap(client.post('/users/me/device', payload))
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

export function getConceptMasteryHistory(conceptId) {
  return wrap(client.get(`/users/me/concept-mastery/${conceptId}/history`))
}

export function getReviewItemCounts() {
  return wrap(client.get('/users/me/review-items/counts'))
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

export function adaptiveNextQuestion(payload) {
  return wrap(client.post('/questions/adaptive-next', payload))
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

export const adminSetSubscription = (key, userId, body) =>
  wrap(adminClient.post(`/admin/users/${userId}/subscription`, body, { headers: { 'x-admin-key': key } }))

export const adminGetSecurityEvents = (key) =>
  wrap(adminClient.get('/admin/security-events', { headers: { 'x-admin-key': key } }))

export const adminGetQuestionReports = (key, { limit = 50, offset = 0 } = {}) =>
  wrap(adminClient.get('/admin/question-reports', { params: { limit, offset }, headers: { 'x-admin-key': key } }))

export const adminUpdateProfile = (key, userId, body) =>
  wrap(adminClient.post(`/admin/users/${userId}/profile`, body, { headers: { 'x-admin-key': key } }))

export const analyzeErrorPatterns = () =>
  wrap(slowClient.post('/analyze/error-patterns', {}))

// Streams generated exam questions one-by-one via NDJSON.
// onQuestion({ index, question }) called per question.
// Returns { questions: [...], exam_id, error, status }
export async function generateExamStream(topicFocus, difficulty = 'medium', count = 10, onQuestion, signal) {
  if (!navigator.onLine) return { questions: [], error: 'Bạn đang ngoại tuyến', status: 0 }
  if (!_csrfToken) return { questions: [], error: 'not authenticated', status: 401 }
  _deductRef?.(5)

  const questions = []
  try {
    const res = await fetch(`${BASE}/generate-exam/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': _csrfToken ?? '' },
      credentials: 'include',
      body: JSON.stringify({ topic_focus: topicFocus, difficulty, count }),
      signal,
    })
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}))
      if (res.status === 402) _refundRef?.(5)
      return { questions: [], error: detail?.detail ?? `HTTP ${res.status}`, status: res.status }
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buf = ''
    let examId = null

    while (true) {
      if (signal?.aborted) { reader.cancel(); return { questions, error: 'aborted', status: 0 } }
      const { value, done } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const evt = JSON.parse(line)
          if (evt.error) return { questions, error: evt.error, status: 502 }
          if (evt.done) { examId = evt.exam_id; break }
          if (evt.question) {
            questions.push(evt.question)
            onQuestion?.({ index: evt.index, question: evt.question })
          }
        } catch { /* ignore */ }
      }
    }
    return { questions, exam_id: examId, error: null, status: 200 }
  } catch (err) {
    if (err.name === 'AbortError') return { questions, error: 'aborted', status: 0 }
    _refundRef?.(5)
    return { questions, error: err?.message ?? 'Stream error', status: 0 }
  }
}

export const adminGetUserDevices = (key, userId) =>
  wrap(adminClient.get(`/admin/users/${userId}/devices`, { headers: { 'x-admin-key': key } }))

export const getPaymentConfig = () =>
  wrap(client.get('/payment/config'))

export const getDailyChallenge = () =>
  wrap(client.get('/daily-challenge'))

export const submitDailyScore = ({ question_id, correct }) =>
  wrap(client.post('/daily-challenge/score', { question_id, correct }))

export const generateExam = (topicFocus, difficulty = 'medium', count = 10) =>
  wrap(slowClient.post('/generate-exam', { topic_focus: topicFocus, difficulty, count }))

export const predictScore = () =>
  wrap(client.get('/predict-score'))

export const getExamDistribution = (examId) =>
  wrap(client.get(`/exams/${encodeURIComponent(examId)}/distribution`))

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
