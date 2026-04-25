# AI Agent App

Vietnamese aluminum/glass door sales chatbot backend (FastAPI + Claude via ai-router proxy) **+ AI-powered exam app frontend**.

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
  middleware.py      # RateLimitMiddleware — 20 req/min per IP on AI endpoints
  main.py            # FastAPI routes: /chat /compress /analyze /hint /tutor /study-plan /health
  agent/
    core.py          # run_agent(), call_with_retry(), system prompt builder
    memory.py        # compress_conversation() via Haiku
    exam_analyzer.py # analyze_exam_result() — AI-powered results analysis
    hint_generator.py# generate_hint() — Socratic hints via Haiku
    exam_tutor.py    # run_tutor() — tutoring chat with exam context injected
    study_planner.py # generate_study_plan() — 4-week study plan with JSON fallback
  tools/
    registry.py      # Tool schemas (ALL_TOOLS), handle_tool_call(), PRICE_TABLE
  tests/
    test_ai_endpoints.py  # 9 pytest tests covering all AI endpoints (LLM mocked)

exam-app/src/
  api/
    index.js         # Static data loaders (questions, exams, schools)
    aiClient.js      # Axios client wrapping /analyze /hint /tutor /study-plan
  components/
    AIInsights.jsx   # Renders local or AI analysis; loading skeleton + offline badge
    AIErrorBoundary.jsx  # React error boundary wrapping AI sections
    QuestionCard.jsx # Question renderer + Socratic hint button + "Xem giải thích" toggle (practice mode only)
    TutorChat.jsx    # Slide-in chat drawer — AI tutor with exam context
  pages/
    Results.jsx      # Async AI analysis; "Hỏi AI Gia Sư" + "Tạo Kế Hoạch" buttons
    StudyPlan.jsx    # /study-plan/:resultId — 4-week plan with localStorage checkbox progress
  context/
    ExamContext.jsx  # Exam state + hints: {} + SET_HINT action + useHints() hook
```

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

**`.env` (backend root)**
```
ANTHROPIC_BASE_URL=https://ai-router.locdo.tech
ANTHROPIC_AUTH_TOKEN=<token>
ANTHROPIC_DEFAULT_OPUS_MODEL=claude-opus-4.6
ANTHROPIC_DEFAULT_SONNET_MODEL=claude-sonnet-4.6
ANTHROPIC_DEFAULT_HAIKU_MODEL=claude-haiku-4.5
ALLOWED_ORIGINS=http://localhost:5173
```

**`exam-app/.env`**
```
VITE_API_BASE_URL=http://localhost:8000
```

## Key patterns

**Error handling** — wrap all `client.chat.completions.create()` with `call_with_retry()` from `agent/core.py`. Catches `RateLimitError` (retry), `APIConnectionError`, `APIStatusError`.

**Prefix caching** — static system prompt content first (`STATIC_BASE_INSTRUCTIONS`, `STATIC_PRODUCT_CATALOG`); dynamic context (customer name, funnel stage) appended last.

**Tool loop** — `run_agent()` in `core.py` handles multi-turn tool calls until `finish_reason != "tool_calls"`.

**Pricing** — `PRICE_TABLE` in `tools/registry.py` maps product type → VND/m². Default fallback: 1,600,000 VND/m².

---

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

Indexed as **AI-Agent-App** — 109 nodes · 162 edges · 6 clusters · 6 execution flows. Not a git repo; re-index with `gitnexus analyze /mnt/d/AI-Agent-App --skip-git` after significant changes.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **AI-Agent-App** (768 symbols, 1332 relationships, 36 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
