# AI Agent App

Zenith — AI-native adaptive learning system for Vietnamese students (FastAPI + Claude via ai-router proxy).

## Stack

- **Python** — FastAPI, pydantic-settings, tenacity, openai SDK (>=1.58.0)
- **Runtime** — uvicorn
- **AI** — Claude models via internal OpenAI-compatible proxy at `https://ai-router.locdo.tech`

## Dev commands

```bash
# Run both backend + frontend together (preferred)
npm install          # install concurrently (root, first time only)
npm run dev          # starts backend :8000 and frontend :5173 concurrently

# Backend only
pip install -r requirements.txt
PYTHONPATH=backend uvicorn app.main:app --reload   # http://localhost:8000
python3 -m pytest backend/tests/        # run tests

# Frontend only
cd exam-app && npm install && npm run dev   # http://localhost:5173
```

## Project structure

```
backend/app/
  config.py          # Settings (pydantic-settings), get_settings(); ALLOWED_ORIGINS for CORS
  dependencies.py    # get_ai_client() singleton (AsyncOpenAI)
  middleware.py      # RateLimitMiddleware — IP (20/min) + per-user (60/min) + rapid-fire hint detection
  abuse_detector.py # Background loop (5 min) — credit velocity, burst, score anomaly, new-account checks
  main.py            # FastAPI routes: /analyze /hint /explain /tutor /study-plan /health
                     #   + /auth/google, /users/me, /users/me/profile, /users/me/credits/log
                     #   + /admin/users/{id}/subscription|credits|suspend|unsuspend
                     #   + GET /admin/security-events
  agent/
    core.py          # call_with_retry() — tenacity retry wrapper for all AI calls
    memory.py        # compress_conversation() via Haiku (used by tutor memory update)
    exam_analyzer.py # analyze_exam_result() — grade+province → location-aware school recs
    hint_generator.py# generate_hint() — Socratic hints via Haiku
    exam_tutor.py    # run_tutor() — tutoring chat with exam context injected
    study_planner.py # generate_study_plan() — 4-week study plan with JSON fallback
  tests/
    test_ai_endpoints.py  # 9 pytest tests covering all AI endpoints (LLM mocked)

exam-app/src/
  api/
    index.js         # Static data loaders (questions, exams, schools)
    aiClient.js      # Axios client wrapping all backend endpoints; wrap() preserves structured errors
  components/
    AIInsights.jsx   # Renders AI analysis; handles 401/402/403 error codes + credit top-up CTA
    AIErrorBoundary.jsx  # React error boundary wrapping AI sections
    QuestionCard.jsx # Question renderer + hint (⚡1 credit) + explanation toggle (practice mode)
    ProfileOnboarding.jsx # Modal: grade (required) + province (required) + school type + ToS gate
    LowCreditBanner.jsx   # Sticky banner when credits_balance < 10; dismissible per session
    Navbar.jsx       # ⚡ credits badge → /account; avatar/name → /account
  pages/
    Results.jsx      # Async AI analysis with grade+province in payload; "Tạo Kế Hoạch" button
    StudyPlan.jsx    # /study-plan/:resultId — 4-week plan with localStorage checkbox progress
    Account.jsx      # /account — profile, tier/credits, pricing table (monthly/annual toggle), credit log
    ExamSelect.jsx   # Auth gate (1 guest trial), grade/tier filter, category lock for non-complete tiers
  context/
    ExamContext.jsx  # Exam state + hints: {} + SET_HINT action + useHints() hook
    AuthContext.jsx  # user (all profile fields), login, logout, updateProfile()
```

## User profile fields (users table)

| Field | Values | Effect |
|---|---|---|
| `grade` | '9','10','11','12' | ≤9 → grade10 exams only; 10-12 → thpt only |
| `province` | 63 VN provinces | AI school recs localized to province |
| `school_type` | 'chuyên','công lập','quốc tế' | Optional, informational |
| `subscription_tier` | 'basic','student','complete' | Controls exam access + study-plan gate |
| `subscription_period` | 'monthly','annual' | Annual shown with badge in Navbar/Account |
| `credits_balance` | integer ≥0 | Deducted per AI call; 402 when exhausted |
| `tos_accepted_at` | ISO timestamp | Required before any credit-deducting request |
| `is_suspended` | 0/1 | 403 account_suspended → suspension modal |

## AI credit costs

| Endpoint | Credits |
|---|---|
| `/hint` | 1 |
| `/explain` | 1 |
| `/analyze` | 3 |
| `/study-plan` | 5 (student/complete tier only) |

## Admin endpoints (require X-Admin-Key: current derived key)

Admin key rotates automatically (default: weekly). Get current key from `/data/admin_keys.txt` on HF Spaces or run `python tools/gen_admin_key.py`.

- `POST /admin/users/{id}/subscription` — set tier/period/expiry + bonus credits
- `POST /admin/users/{id}/credits` — grant top-up credits
- `POST /admin/users/{id}/suspend` — suspend with reason
- `POST /admin/users/{id}/unsuspend`
- `GET /admin/security-events` — recent HIGH/MEDIUM events with user status
- `POST /admin/generate-key-log` — (cron use only) derive + append current key to log; requires `X-Cron-Secret` header

## AI router rules (CRITICAL)

- **SDK**: `openai` (never `anthropic`)
- **Base URL**: `https://ai-router.locdo.tech/v2` (set via `ANTHROPIC_BASE_URL` env var)
- **Auth**: env var `ANTHROPIC_AUTH_TOKEN` — never hardcode
- **Model names use dots**: `claude-sonnet-4.6`, `claude-opus-4.6`, `claude-haiku-4.5`
- **Never hardcode model names** — use `settings.default_model` / `settings.opus_model` / `settings.haiku_model`
- **Never create a new client per request** — use singleton `get_ai_client()` from `dependencies.py`

## Model tiers

| Property | Model | Use |
|---|---|---|
| `settings.default_model` | `claude-sonnet-4.6` | Main agent loop |
| `settings.haiku_model` | `claude-haiku-4.5` | Cheap tasks: summarization, compression |
| `settings.opus_model` | `claude-opus-4.6` | Complex reasoning |

## Env vars

**`backend/.env`** (copy from `backend/.env.example`, never commit)

| Variable | Example value |
|---|---|
| `ANTHROPIC_BASE_URL` | `https://ai-router.locdo.tech` |
| `ANTHROPIC_AUTH_TOKEN` | *(your token)* |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | `claude-opus-4.6` |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | `claude-sonnet-4.6` |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | `claude-haiku-4.5` |
| `ALLOWED_ORIGINS` | `http://localhost:5173` |
| `SQLITE_PATH` | `./math_wiki.db` (local) / `/data/app.db` (HF Spaces) |
| `GOOGLE_CLIENT_ID` | *(Google OAuth client ID)* |
| `JWT_SECRET` | *(≥32 chars, required)* |
| `ADMIN_MASTER_SECRET` | *(≥32 chars — static master; effective key is HMAC-derived + time window)* |
| `ADMIN_KEY_ROTATION_PERIOD` | `weekly` *(daily\|weekly\|monthly\|quarterly\|annual)* |
| `ADMIN_KEY_LOG_PATH` | `./admin_keys.txt` (local) / `/data/admin_keys.txt` (HF Spaces) |
| `ADMIN_KEY_LOG_ENABLED` | `true` |
| `CRON_SECRET` | *(≥32 chars — authenticates POST /admin/generate-key-log from cron-job.org/GitHub Actions)* |

**`exam-app/.env`** (copy from `exam-app/.env.example`, never commit)

| Variable | Example value |
|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` |

## Key patterns

**Error handling** — wrap all `client.chat.completions.create()` with `call_with_retry()` from `agent/core.py`. Catches `RateLimitError` (retry), `APIConnectionError`, `APIStatusError`.

**Prefix caching** — static system prompt content first (e.g. `STATIC_EXAM_ANALYSIS_INSTRUCTIONS`); dynamic context (student name, score, weak topics) appended last.

**Pricing** — `PRICE_TABLE` in `tools/registry.py` maps product type → VND/m². Default fallback: 1,600,000 VND/m².

## Development workflow

This project uses two collaborating tools for code intelligence and structured work:

- **GitNexus MCP** — knowledge graph of 109 symbols and 162 relationships, indexed from the codebase. Use it to understand blast radius before editing, trace execution flows, and do safe renames.
- **agent-skills plugin** — structured workflow skills (spec, plan, build, test, review, etc.) that map to common engineering tasks.

### When to reach for each

| Task | Use |
|---|---|
| "What calls `run_agent()`?" / "What breaks if I change this?" | GitNexus: `gitnexus_impact`, `gitnexus_context` |
| "How does the tool loop work?" / "Find all entry points" | GitNexus: `gitnexus_query` |
| Adding a new feature end-to-end | agent-skills: `/spec` → `/plan` → `/build` |
| Fixing a bug with proof it's fixed | agent-skills: `/test` (Prove-It pattern) |
| Pre-merge check | agent-skills: `/review` + GitNexus: `gitnexus_detect_changes` |
| Renaming a symbol across files | GitNexus: `gitnexus_rename` |

### GitNexus rules

- **Before any coding task in `exam-app/` or `backend/`** — ALWAYS run `npx gitnexus analyze --embeddings` to refresh the index, then run the relevant GitNexus MCP tools (impact, context, query) before writing a single line of code.
- **Before editing any symbol** — run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius. Stop and warn the user on HIGH or CRITICAL risk.
- **Before committing** — run `gitnexus_detect_changes()` to verify only expected symbols were affected.
- **Never rename with find-and-replace** — use `gitnexus_rename` which understands the call graph.

### GitNexus skill files

| Goal | Skill |
|---|---|
| Architecture exploration | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / impact analysis | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Bug tracing | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Refactoring / rename / extract | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Full tool + resource reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |

### GitNexus index state

Indexed as **AI-Agent-App** — re-index with `gitnexus analyze /mnt/d/AI-Agent-App --skip-git` after significant changes.

### GitNexus MCP resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/AI-Agent-App/context` | Codebase overview, index freshness |
| `gitnexus://repo/AI-Agent-App/processes` | All execution flows |

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **AI-Agent-App** (5160 symbols, 14780 relationships, 273 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/AI-Agent-App/context` | Codebase overview, check index freshness |
| `gitnexus://repo/AI-Agent-App/clusters` | All functional areas |
| `gitnexus://repo/AI-Agent-App/processes` | All execution flows |
| `gitnexus://repo/AI-Agent-App/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

## Deploy commands

### Hugging Face Space (backend) — orphan push required

```bash
git checkout master
git checkout --orphan hf-deploy-new
git add -A
git commit -m "deploy: $(git log master --oneline -1 | cut -c1-7)"
git branch -D hf-deploy
git branch -m hf-deploy-new hf-deploy
git push --force space hf-deploy:main
git checkout master
```

**Never** use `git merge master` on hf-deploy — the repo history contains old binary files that HF rejects. The orphan commit has no parents, so none of that history is included.

### Cloudflare Pages (frontend) — must use `--branch=main`

```bash
cd exam-app
npm run build
npx wrangler pages deploy dist --project-name exam-app --branch=main --commit-dirty=true
```

**Always** pass `--branch=main`. Without it, wrangler creates a **Preview** deployment (not Production), and `exam-app-ey0.pages.dev` keeps serving the old bundle. The production URL only aliases Production deployments.
