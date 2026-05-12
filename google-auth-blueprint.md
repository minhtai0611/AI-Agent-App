# Implementation Plan: Google Sign-Up / Sign-In

## Overview

Add Google OAuth 2.0 authentication to the exam app. The frontend obtains a Google ID token via the `GoogleLogin` component from `@react-oauth/google`, posts it to `POST /auth/google` on the backend, which verifies it with Google's public keys via `google-auth` (async-safe via `asyncio.to_thread`), upserts a `users` row, and returns a 7-day HS256 JWT (`PyJWT`). The JWT lives in `localStorage`; all subsequent API calls carry it via an Axios request interceptor. Exam history syncs to the server on first login and is fetched server-side on every subsequent load.

No auth SaaS — pure Google + FastAPI + PostgreSQL.

---

## Resolved Design Decisions

### Q1 — Sign-in optional or required?
**Optional.** Anonymous users keep full access. After completing an exam, `Results.jsx` shows a passive dismissible banner: *"Đăng nhập để lưu kết quả vào tài khoản"*. No gate, no redirect. Rationale: reducing friction is more important than forcing accounts for a study tool.

### Q2 — JWT expiry: 7 days or session?
**7-day fixed expiry.** No refresh tokens (avoids rotation complexity). On any 401, the Axios response interceptor auto-logouts the user and re-opens `AuthModal`. Rationale: students study across multiple days; session-only tokens would be constantly re-authenticating.

### Q3 — One Client ID or separate for dev / prod?
**One Google OAuth Client ID.** In Google Cloud Console → Credentials → OAuth 2.0 Client → add both `http://localhost:5173` and the HF Space URL (e.g. `https://<user>-<app>.hf.space`) as Authorised JavaScript Origins. Same `VITE_GOOGLE_CLIENT_ID` value in both `.env` files. HF Space secret `GOOGLE_CLIENT_ID` mirrors the backend `.env` value.

---

## Architecture Decisions

- **Token verification**: `google-auth` (`google.oauth2.id_token.verify_oauth2_token`) — official JWKS handling, built-in key caching. Wrapped in `asyncio.to_thread()` because the library is synchronous (makes a blocking urllib call the first time to fetch Google's public keys).
- **Session token**: HS256 JWT via `PyJWT` (actively maintained, clean API). `sub=user_id`, `exp=now+7d`.
- **Frontend SDK**: `@react-oauth/google` — `GoogleLogin` component returns `credentialResponse.credential` (the Google ID token) directly. Do **not** use `useGoogleLogin(flow='implicit')` — that returns an OAuth access token, not an ID token the backend can verify.
- **Axios auth layer**: Request interceptor on existing `client` + `slowClient` in `aiClient.js` reads `localStorage.auth_token` and attaches `Authorization: Bearer`. Response interceptor calls a module-level `_logoutRef` on 401, which `AuthContext` sets on mount (avoids needing to reach into React from outside).
- **DB pool access**: new endpoints use `request.app.state.pool` (consistent with existing codebase pattern).
- **History strategy**: `localStorage` for anonymous users. On first login: bulk-POST local history to server then clear local copy. On subsequent authenticated loads: fetch from `GET /users/me/history`. On logout: revert to `localStorage` mode.
- **Rate limiting `/auth/google`**: extend `RateLimitMiddleware` to also cover `/auth/google` at a tighter limit (10 req/min) to prevent brute-force token stuffing.

---

## Phase 1: Backend — Schema & Dependencies

### Task 1: Add `users` + `exam_results` tables to `_SCHEMA_DDL` (XS)

**Description:** Append two DDL strings to the `_SCHEMA_DDL` list in `main.py`. Both are idempotent (`IF NOT EXISTS`). `exam_results` has a FK to `users(id)` so `users` must be listed first.

`users`: `id SERIAL PK`, `google_sub TEXT UNIQUE NOT NULL`, `email TEXT NOT NULL`, `display_name TEXT`, `avatar_url TEXT`, `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()`

`exam_results`: `result_id TEXT PK`, `user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `exam_id TEXT`, `score FLOAT`, `payload JSONB`, `created_at TIMESTAMPTZ DEFAULT NOW()`

**Acceptance criteria:**
- [ ] Both tables created on startup with correct columns and constraints
- [ ] Re-running startup (e.g. Spaces restart) does not error

**Verification:**
- [ ] `psql $DATABASE_URL -c "\d users"` and `"\d exam_results"` show expected schemas

**Dependencies:** None — safe to implement in parallel with Tasks 2 and 3

**Files touched:**
- `backend/app/main.py`

**Estimated scope:** XS

---

### Task 2: Add auth config to `Settings` (XS)

**Description:** Add `google_client_id: str` and `jwt_secret: str` to `Settings`. Add a startup validator that raises `RuntimeError` if `jwt_secret` is empty. Document both in `backend/.env.example` with a comment pointing to Google Cloud Console.

**Acceptance criteria:**
- [ ] `settings.google_client_id` and `settings.jwt_secret` load from `.env`
- [ ] App refuses to start with a clear error if `JWT_SECRET` is blank
- [ ] `backend/.env.example` updated

**Verification:**
- [ ] `JWT_SECRET= PYTHONPATH=backend python -c "from app.config import get_settings; get_settings()"` raises `RuntimeError`

**Dependencies:** None — parallelizable with Tasks 1 and 3

**Files touched:**
- `backend/app/config.py`
- `backend/.env.example`

**Estimated scope:** XS

---

### Task 3: Add Python auth dependencies (XS)

**Description:** Add `PyJWT>=2.8` and `google-auth>=2.28` to `requirements.txt`. `google-auth` already pulls in `requests` as a transitive dep.

**Acceptance criteria:**
- [ ] `pip install -r requirements.txt` succeeds, no conflicts with existing deps
- [ ] `import jwt; import google.oauth2.id_token` both work in the app process

**Verification:**
- [ ] `pip install -r requirements.txt && python -c "import jwt, google.oauth2.id_token; print('ok')"` exits 0

**Dependencies:** None — parallelizable with Tasks 1 and 2

**Files touched:**
- `backend/requirements.txt`

**Estimated scope:** XS

---

## Checkpoint: Foundation

- [ ] `users` and `exam_results` tables exist in Postgres
- [ ] `settings.google_client_id` and `settings.jwt_secret` load without errors
- [ ] `PyJWT` and `google-auth` importable

---

## Phase 2: Backend — Auth Logic & Endpoints

### Task 4: Create `backend/app/auth.py` (S)

**Description:** Three pure functions — no I/O side effects, fully unit-testable.

```python
# Wraps synchronous google library in a thread to avoid blocking the event loop
async def verify_google_token(id_token_str: str) -> dict:
    payload = await asyncio.to_thread(
        google.oauth2.id_token.verify_oauth2_token,
        id_token_str,
        google.auth.transport.requests.Request(),
        settings.google_client_id,
    )
    return payload  # contains: sub, email, name, picture

def create_jwt(user_id: int) -> str:
    # HS256, exp = now + 7 days

def decode_jwt(token: str) -> dict:
    # raises jwt.ExpiredSignatureError or jwt.InvalidTokenError on bad token
```

**Acceptance criteria:**
- [ ] `verify_google_token` raises `ValueError` on invalid or expired Google token (wrap `google.auth.exceptions.GoogleAuthError`)
- [ ] `create_jwt` embeds `sub=str(user_id)`, `exp=now+7d`, `iat=now`
- [ ] `decode_jwt` raises on tampered or expired JWT
- [ ] Tests mock `asyncio.to_thread` — no real network calls

**Verification:**
- [ ] `pytest backend/tests/test_auth.py -v` — all pass

**Dependencies:** Tasks 2, 3

**Files touched:**
- `backend/app/auth.py` (new)
- `backend/tests/test_auth.py` (new)

**Estimated scope:** S

---

### Task 5: Create `POST /auth/google` endpoint (S)

**Description:** Body: `{ "id_token": str }`. Flow: verify → upsert user via `INSERT … ON CONFLICT (google_sub) DO UPDATE` → return JWT + user object. Uses `request.app.state.pool` for DB access.

```sql
INSERT INTO users (google_sub, email, display_name, avatar_url, created_at, updated_at)
VALUES ($1, $2, $3, $4, NOW(), NOW())
ON CONFLICT (google_sub) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = NOW()
RETURNING id, email, display_name, avatar_url
```

Response shape:
```json
{ "access_token": "...", "user": { "id": 1, "email": "...", "display_name": "...", "avatar_url": "..." } }
```

Rate limit: extend `RateLimitMiddleware` to treat `/auth/google` as a protected path at 10 req/min per IP.

**Acceptance criteria:**
- [ ] 200 + JWT on valid Google token
- [ ] 401 (never 500) on invalid/expired token — error detail: `"Invalid or expired Google token"`
- [ ] Upsert: second call for same account updates `display_name`/`avatar_url`, no duplicate row
- [ ] 10 req/min rate limit applied

**Verification:**
- [ ] `pytest backend/tests/test_auth_endpoint.py -v` — all pass (DB connection and `verify_google_token` mocked)

**Dependencies:** Tasks 1, 4

**Files touched:**
- `backend/app/main.py`
- `backend/app/middleware.py` (extend rate limit paths)
- `backend/tests/test_auth_endpoint.py` (new)

**Estimated scope:** S

---

### Task 6: `get_current_user` FastAPI dependency (XS)

**Description:** Reads `Authorization: Bearer <token>` from the request header, calls `decode_jwt`, returns `CurrentUser(user_id: int, email: str)`. Returns HTTP 401 on missing header, expired token, or invalid token — never 500.

**Acceptance criteria:**
- [ ] `Depends(get_current_user)` injects `CurrentUser` into any route
- [ ] Missing header → `401 Not authenticated`
- [ ] Expired JWT → `401 Token expired`
- [ ] Verified via tests in `test_auth_endpoint.py` (shared fixture)

**Dependencies:** Task 4

**Files touched:**
- `backend/app/dependencies.py`

**Estimated scope:** XS

---

### Task 7: User profile + history endpoints (S)

**Description:** Three new protected routes (all require `Depends(get_current_user)`):

| Method | Path | Body / Response |
|--------|------|-----------------|
| `GET` | `/users/me` | → `{ id, email, display_name, avatar_url }` |
| `POST` | `/users/me/history` | `[{ result_id, exam_id, score, payload, created_at }]` → bulk upsert via `INSERT … ON CONFLICT (result_id) DO NOTHING` |
| `GET` | `/users/me/history` | → `[{ result_id, exam_id, score, payload, created_at }]` ordered newest-first |

**Acceptance criteria:**
- [ ] All three return 401 without a valid JWT
- [ ] `POST /users/me/history` is idempotent (re-POST same `result_id` silently no-ops)
- [ ] `GET /users/me/history` returns only rows owned by the requesting user (no cross-user leakage)

**Verification:**
- [ ] `pytest backend/tests/test_user_endpoints.py -v` — all pass

**Dependencies:** Tasks 1, 6

**Files touched:**
- `backend/app/main.py`
- `backend/tests/test_user_endpoints.py` (new)

**Estimated scope:** S

---

## Checkpoint: Backend Auth

- [ ] `python -m pytest backend/tests/ -v` — all pass (including pre-existing tests)
- [ ] `PYTHONPATH=backend uvicorn app.main:app --reload` starts without errors
- [ ] `/auth/google`, `/users/me`, `/users/me/history` appear in `/docs`

---

## Phase 3: Frontend — Auth Infrastructure

### Task 8: Install `@react-oauth/google`, add env var (XS)

**Description:** `npm install @react-oauth/google` in `exam-app/`. Add `VITE_GOOGLE_CLIENT_ID` to `exam-app/.env.example` with comment: *"Same value as GOOGLE_CLIENT_ID — one OAuth client, multiple Authorised Origins in Google Cloud Console"*.

**Acceptance criteria:**
- [ ] `import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'` resolves
- [ ] `exam-app/.env.example` updated
- [ ] `npm run build` succeeds

**Dependencies:** None

**Files touched:**
- `exam-app/package.json`
- `exam-app/.env.example`

**Estimated scope:** XS

---

### Task 9: Add auth interceptors to `aiClient.js` (S)

**Description:** Add a request interceptor and a response interceptor to both `client` and `slowClient`. Also export `setLogoutRef(fn)` so `AuthContext` can register a logout callback that the response interceptor calls on 401.

```js
// module-level
let _logoutRef = null
export function setLogoutRef(fn) { _logoutRef = fn }

// request interceptor (same for client + slowClient)
instance.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// response interceptor
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
```

**Acceptance criteria:**
- [ ] Every request that follows login carries `Authorization: Bearer <token>`
- [ ] A 401 response from any endpoint clears the token and triggers logout
- [ ] Unauthenticated requests (no token) are unaffected — header simply absent
- [ ] No new Axios instance created — interceptors applied to existing `client`/`slowClient`

**Verification:**
- [ ] Manual: login → open DevTools Network → any AI request shows `Authorization` header
- [ ] Manual: manually set `auth_token` in localStorage to `garbage` → next AI request returns 401 → user is logged out

**Dependencies:** Task 8

**Files touched:**
- `exam-app/src/api/aiClient.js`

**Estimated scope:** S

---

### Task 10: Create `AuthContext.jsx` (S)

**Description:** Provides `{ user, login(credential), logout, loading }`.

- **Init**: reads `auth_token` from localStorage → calls `GET /users/me` to validate → sets `user` (or clears token if 401).
- **`login(credential)`**: POSTs `{ id_token: credential }` to `/auth/google` → stores `access_token` in `localStorage.auth_token` → sets `user` → calls history sync (see Task 13).
- **`logout()`**: clears `localStorage.auth_token` → sets `user=null` → notifies `HistoryContext` to revert to localStorage mode (via a `resetToLocal()` callback registered at mount).
- Calls `setLogoutRef(logout)` on mount, `setLogoutRef(null)` on unmount.

**Acceptance criteria:**
- [ ] `useAuth()` returns `user=null` before login and after logout
- [ ] Token persisted across page refresh (re-validated via `/users/me` probe)
- [ ] Stale/tampered token cleared automatically at init
- [ ] `loading=true` during init probe, `false` after

**Verification:**
- [ ] Manual: login → refresh → still logged in
- [ ] Manual: corrupt `auth_token` in DevTools → refresh → auto logout

**Dependencies:** Task 9

**Files touched:**
- `exam-app/src/context/AuthContext.jsx` (new)

**Estimated scope:** S

---

### Task 11: Wrap `App` with providers (XS)

**Description:** In `main.jsx`, wrap the root with `GoogleOAuthProvider` (reads `VITE_GOOGLE_CLIENT_ID`) then `AuthProvider`. Order matters: `GoogleOAuthProvider` must be outermost.

**Acceptance criteria:**
- [ ] `useAuth()` accessible in any component
- [ ] No console errors on cold load

**Dependencies:** Task 10

**Files touched:**
- `exam-app/src/main.jsx`

**Estimated scope:** XS

---

## Phase 4: Frontend — UI

### Task 12: Create `AuthModal` component (S)

**Description:** Centered modal overlay (backdrop click + Escape to dismiss). Contains the `GoogleLogin` component from `@react-oauth/google` which renders Google's branded button and returns `credentialResponse.credential` (the ID token) in `onSuccess`. Passes credential to `AuthContext.login()`. Shows loading spinner while backend call is in flight. Shows inline error on failure. Do **not** use `useGoogleLogin(flow='implicit')` — that returns an access token, not an ID token.

Styling: dark background `#0A0E1A`, amber border `#F2A20C`, matches existing theme.

**Acceptance criteria:**
- [ ] Google popup opens on button click (not a redirect)
- [ ] On success: modal closes, `user` set in context
- [ ] On Google popup cancel (user closes popup): no error shown, modal stays open
- [ ] On backend error: error text shown in modal, button re-enabled
- [ ] Escape key and backdrop click close the modal
- [ ] Focus trapped inside modal while open

**Verification:**
- [ ] Manual: click → Google popup → sign in → modal dismisses, navbar shows avatar
- [ ] Manual: click → Google popup → press Cancel → modal stays open, no error

**Dependencies:** Task 10

**Files touched:**
- `exam-app/src/components/AuthModal.jsx` (new)

**Estimated scope:** S

---

### Task 13: Add persistent Navbar with auth state (S)

**Description:** Fixed 48px top navbar rendered in `App.jsx` outside `<Routes>` (all pages get `pt-12`). Right side: logged out → `"Đăng nhập"` button (opens `AuthModal`). Logged in → Google avatar `<img>` (fallback: initials div) + display name + `"Đăng xuất"` button. Logout calls `AuthContext.logout()` and navigates to `/`.

Also manages `AuthModal` open state (single instance at app level, no duplication across pages).

**Acceptance criteria:**
- [ ] Navbar visible on every route: `/`, `/exams`, `/test/:id`, `/results/*`, `/history`, `/oracle`
- [ ] Avatar `src` points to Google picture URL; on `onError` falls back to a div with initials
- [ ] Existing page layouts undisturbed (only `pt-12` added to page root divs)
- [ ] `AuthModal` rendered once in `App.jsx`, opened via shared state

**Verification:**
- [ ] Navigate through all routes — navbar present, no layout breaks
- [ ] Login → avatar shows; logout → "Đăng nhập" shows; refresh → state preserved

**Dependencies:** Tasks 11, 12

**Files touched:**
- `exam-app/src/components/Navbar.jsx` (new)
- `exam-app/src/App.jsx`
- `exam-app/src/pages/Landing.jsx`, `ExamSelect.jsx`, `TestInterface.jsx`, `Results.jsx`, `History.jsx`, `StudyPlan.jsx`, `MathOracle.jsx` — add `pt-12` to outermost div

**Estimated scope:** S

---

## Checkpoint: Auth UI

- [ ] Full sign-in flow works in browser: click → Google popup → logged in → avatar shown
- [ ] Page refresh preserves login state
- [ ] All existing routes render without errors or layout shifts

---

## Phase 5: History Sync

### Task 14: Sync history on login; fetch from server when authenticated (S)

**Description:** Two changes:

**1. On login** (inside `AuthContext.login()`, after JWT is stored):
```js
const localHistory = JSON.parse(localStorage.getItem('exam_history') ?? '[]')
if (localHistory.length > 0) {
  await postHistory(localHistory)        // POST /users/me/history
  localStorage.removeItem('exam_history')
}
```
`postHistory` is a new function in `aiClient.js`.

**2. `HistoryContext` becomes auth-aware:**
- On mount (or when `user` changes to non-null): fetch `GET /users/me/history` and load into state.
- `addResult`: if logged in, also POST the single result to `/users/me/history`; always update local state.
- On logout (`resetToLocal()` called by `AuthContext`): revert to reading/writing `localStorage.exam_history`.

**Acceptance criteria:**
- [ ] Anonymous users: history in localStorage, no regression
- [ ] First login: local history POSTed, localStorage cleared, server history loaded
- [ ] Subsequent loads while authenticated: history from server
- [ ] After logout: history reverts to localStorage (new anonymous results go there)
- [ ] Re-login: does not duplicate results (POST idempotent via `ON CONFLICT DO NOTHING`)

**Verification:**
- [ ] Manual: complete exam anonymously → sign in → `GET /users/me/history` returns the result
- [ ] Manual: sign out → complete another exam → sign in → both results visible

**Dependencies:** Tasks 7, 10

**Files touched:**
- `exam-app/src/context/AuthContext.jsx`
- `exam-app/src/context/HistoryContext.jsx`
- `exam-app/src/api/aiClient.js`

**Estimated scope:** S

---

### Task 15: Add sign-in nudge to Results page (XS)

**Description:** In `Results.jsx`, if `useAuth().user === null`, render a dismissible banner below the score card: *"Đăng nhập để lưu kết quả vào tài khoản của bạn →"*. Clicking it opens `AuthModal` (via a callback prop or context-managed state). Dismissal stored in component state (not persisted — it reappears each visit while logged out).

**Acceptance criteria:**
- [ ] Banner visible on `/results/current` and `/results/:id` when logged out
- [ ] Banner absent when logged in
- [ ] Dismiss button (`×`) hides it for the session
- [ ] Clicking the CTA text opens `AuthModal`

**Verification:**
- [ ] Manual: complete exam while logged out → see banner → click CTA → modal opens
- [ ] Manual: complete exam while logged in → no banner

**Dependencies:** Tasks 12, 13

**Files touched:**
- `exam-app/src/pages/Results.jsx`

**Estimated scope:** XS

---

## Checkpoint: Complete

- [ ] Full anonymous → sign-in → history synced flow works end-to-end
- [ ] `python -m pytest backend/tests/ -v` — all pass
- [ ] `cd exam-app && npm run build` — no errors
- [ ] No regressions: exam, results, oracle, study-plan, history all function normally

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Google popup blocked by browser | High | `GoogleLogin` uses GIS button (trusted origin) — less likely to be blocked than `window.open`. Document popup-blocker requirement. |
| `google.auth.transport.requests.Request()` blocks event loop | High | Wrapped in `asyncio.to_thread()` in Task 4 — non-negotiable |
| `JWT_SECRET` rotation invalidates all sessions | Med | On rotate: all users auto-logout on next 401, re-authenticate. Acceptable for this app scale. |
| HF Space cold start: `_logoutRef=null` during 401 at init | Low | Init 401 handled by `AuthContext` directly (clear token, set `user=null`) — interceptor path is only for in-session 401s |
| Google profile picture URL changes or expires | Low | `avatar_url` refreshed on every login via upsert — stays current |
| `@react-oauth/google` renders Google button in iframe; limited style control | Low | Modal background is styled by us; the button itself uses Google's brand, which builds user trust |
| HF Space missing `GOOGLE_CLIENT_ID` / `JWT_SECRET` secrets | High | Document both in `backend/.env.example` with explicit HF Spaces setup note |

---

## Pre-Implementation Setup Checklist

Before writing any code, complete these one-time manual steps:

1. **Google Cloud Console**
   - Create project (or use existing)
   - Enable *Google Identity* API
   - Create *OAuth 2.0 Client ID* (type: Web application)
   - Add Authorised JavaScript Origins: `http://localhost:5173` and `https://<your-hf-space>.hf.space`
   - Copy the Client ID → `VITE_GOOGLE_CLIENT_ID` (frontend) and `GOOGLE_CLIENT_ID` (backend)

2. **Generate JWT secret**
   - `python -c "import secrets; print(secrets.token_hex(32))"` → `JWT_SECRET`

3. **Add HF Space secrets** (Settings → Variables and secrets)
   - `GOOGLE_CLIENT_ID`, `JWT_SECRET`, `DATABASE_URL`
