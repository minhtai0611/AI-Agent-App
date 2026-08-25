// Institutions Phase 1 — org/admin API. Live-only, no static-JSON fallback: there is no
// offline-safe substitute for tenant-scoped identity/admin data (same precedent as
// reportQuestion/loadContentReports in api/index.js).
const _API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

async function _orgFetch(path, options = {}) {
  const res = await fetch(`${_API_BASE}${path}`, { credentials: 'include', ...options })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function login() {
  window.location.href = `${_API_BASE}/auth/login`
}

export async function logout() {
  return _orgFetch('/auth/logout', { method: 'POST' })
}

export async function fetchMe() {
  return _orgFetch('/auth/me')
}

export async function fetchMembers() {
  return _orgFetch('/org/members')
}

export async function updateMember(memberId, patch) {
  return _orgFetch(`/org/members/${encodeURIComponent(memberId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
}

export async function inviteMember(email, role) {
  return _orgFetch('/org/members/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role }),
  })
}

export async function fetchAuditLog() {
  return _orgFetch('/org/audit-log')
}

export async function fetchOrgSettings() {
  return _orgFetch('/org/settings')
}

export async function updateOrgSettings(patch) {
  return _orgFetch('/org/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
}

// --- Phase 2: branding, content library, analytics, integrations, compliance -----------

export async function fetchBranding(orgId) {
  return _orgFetch(`/org/${encodeURIComponent(orgId)}/branding`)
}

export async function updateBranding(patch) {
  return _orgFetch('/org/settings/branding', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
}

export async function getContentLibrary(status) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : ''
  return _orgFetch(`/org/content${qs}`)
}

export async function submitContentItem(body) {
  return _orgFetch('/org/content', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

export async function submitContentForReview(itemId) {
  return _orgFetch(`/org/content/${encodeURIComponent(itemId)}/submit`, { method: 'POST' })
}

export async function approveContentItem(itemId) {
  return _orgFetch(`/org/content/${encodeURIComponent(itemId)}/approve`, { method: 'POST' })
}

export async function getOrgExam(examId) {
  return _orgFetch(`/org/exams/${encodeURIComponent(examId)}`)
}

export async function postExamAttempt(body) {
  return _orgFetch('/org/exam-attempts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

export async function getCohortAnalytics(cohortId) {
  return _orgFetch(`/org/analytics/cohorts/${encodeURIComponent(cohortId)}`)
}

export async function getItemAnalytics() {
  return _orgFetch('/org/analytics/items')
}

export async function getApiKeys() {
  return _orgFetch('/org/integrations/keys')
}

export async function postApiKey(label, scopes) {
  return _orgFetch('/org/integrations/keys', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label, scopes }),
  })
}

export async function getWebhooks() {
  return _orgFetch('/org/webhooks')
}

export async function postWebhook(url, secret, eventTypes) {
  return _orgFetch('/org/webhooks', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, secret, eventTypes }),
  })
}

export async function getComplianceExport() {
  return _orgFetch('/org/compliance/export')
}

// --- Phase 3: proctoring settings, psychometric flags, at-risk signals -----------------

export async function getProctoringSettings() {
  return _orgFetch('/org/proctoring-settings')
}

export async function updateProctoringSettings(tierEnabled) {
  return _orgFetch('/org/proctoring-settings', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tierEnabled }),
  })
}

export async function getPsychometricFlags(status = 'open') {
  return _orgFetch(`/org/psychometric-flags?status=${encodeURIComponent(status)}`)
}

export async function dismissPsychometricFlag(flagId) {
  return _orgFetch(`/psychometric-flags/${encodeURIComponent(flagId)}/dismiss`, { method: 'POST' })
}

export async function postProctoringSession(examAttemptId, stakesTier) {
  return _orgFetch('/proctoring/sessions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ examAttemptId, stakesTier }),
  })
}

export async function postProctoringEvent(sessionId, event) {
  return _orgFetch(`/proctoring/sessions/${encodeURIComponent(sessionId)}/events`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event),
  })
}

export async function getFlaggedProctoringSessions(status = 'flagged') {
  return _orgFetch(`/org/proctoring-sessions?status=${encodeURIComponent(status)}`)
}

export async function reviewProctoringSession(sessionId) {
  return _orgFetch(`/org/proctoring-sessions/${encodeURIComponent(sessionId)}/review`, { method: 'POST' })
}
