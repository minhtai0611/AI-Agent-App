# AI Agent App

Zenith — exam-taking app for Vietnamese students (grade-10 and THPT math exams). Started from a **clean, stripped-down baseline** (static exam content + question-taking/scoring only) after the 2026-08-23 strip-to-exam-core pass ([[project_strip_to_exam_core]]), but an AI router (`backend/app/agent/`, hitting `ai-router.locdo.tech`) and several AI-agent features have since been rebuilt on top of it — auditor/narrator content review, org-scoped question generation, and the Pure Mathematics Toolset (3D concept visualization, step-by-step CAS solving, a 2D graphing Math Playground, linear algebra, probability simulation). Every new agent feature extends this one router rather than standing up a second one. Don't assume the *old, pre-strip* AI/auth/credit architecture is current — check the code first — but do assume an AI router exists.

## Stack

- **Python** — FastAPI, pydantic-settings, aiosqlite
- **Runtime** — uvicorn
- **Frontend** — React (Vite), React Router, Framer Motion, GSAP, Recharts, Radix/shadcn UI (`@base-ui/react`)

## Dev commands

```bash
# Run both backend + frontend together (preferred)
npm install          # install concurrently (root, first time only)
npm run dev          # starts backend :8000 and frontend :5173 concurrently

# Backend only
pip install -r requirements.txt
PYTHONPATH=backend uvicorn app.main:app --reload   # http://localhost:8000
PYTHONPATH=backend python3 -m pytest backend/tests/ -q   # backend/tests/test_exams.py — 7 tests

# Frontend only
cd exam-app && npm install && npm run dev   # http://localhost:5173
cd exam-app && npm run test                 # vitest
```

## Project structure

```
backend/app/
  config.py          # Settings (pydantic-settings): allowed_origins, sqlite_path; get_settings()
  db.py              # AsyncSQLitePool — asyncpg-compatible wrapper over aiosqlite (single connection + lock)
  main.py            # lifespan seeds exams/questions/exam_questions from exam-app/src/data/*.json on first boot
                     #   routes: GET /health, GET /exams, GET /exams/{id}, GET /questions, POST /questions/batch,
                     #   plus /agent/*, /org/*, /cas/evaluate (see agent/ below)
  agent/             # AI router + agent features — all go through router_client.AiRouterClient
    router_client.py       # AiRouterClient — single ingress to ai-router.locdo.tech
    generator.py / verifier.py / orchestrator.py  # question generate→verify→gate pipeline
    auditor.py / narrator.py                      # content-review agents
    visualization_schema.py / visualization_generator.py  # Pure Math Toolset — 3D concept-explorer specs
                     #   (7 templates: pyramid/prism/sphere_cone/conic_section/vector_add/function_surface/
                     #   solid_of_revolution), generate→verify→gate via sympy, cached in question_visualizations
    step_solver.py          # Pure Math Toolset — step-by-step CAS solver: LLM only extracts the equation
                     #   (draft_equation) and captions already-verified steps (narrate_steps); sympy computes
                     #   and verifies every step. Cached in question_steps.
    plot_schema.py / plot_generator.py     # Pure Math Toolset — Math Playground natural-language entry only
                     #   (manually-typed curves render entirely client-side, never reach this file); LLM
                     #   proposes a PlotSpec (curves + optional intersect/tangent_at op), sympy independently
                     #   re-solves the op before the spec is trusted. Stateless, no caching table.
    linalg_schema.py / linalg_solver.py    # Pure Math Toolset — linear algebra workspace (add/multiply/
                     #   determinant/inverse/rank/rref/solve_system/eigen), sympy.Matrix + a manual Gauss-Jordan
                     #   step ledger; eigen only reachable via manual spec, never NL drafting. Stateless.
    stats_schema.py / stats_simulator.py   # Pure Math Toolset — discrete probability simulator (dice/coin;
                     #   "sampling" intentionally unimplemented/abstains). numpy runs the trials, sympy computes
                     #   the exact theoretical PMF; verification is tolerance-based, not exact. Stateless.
backend/tests/
  test_exams.py      # covers all 5 routes against a module-scoped seeded SQLite fixture
  test_visualization.py / test_step_solver.py / test_plot_generator.py / test_linalg_solver.py / test_stats_simulator.py / test_cas_evaluate.py

exam-app/src/
  api/
    index.js         # loadExams / loadThiThuExams / loadExamById / loadQuestionsByIds — static JSON with
                     #   optional live-backend fallback via _apiFetch; loadConceptSpec / loadStepSolution —
                     #   live-only AI-agent calls (no static fallback, nothing to fall back to)
  components/
    QuestionCard.jsx # Question renderer + static explanation toggle + "Xem các bước giải" AI step-solver panel
                     #   (practice mode only)
    Navbar.jsx       # VantageLogo + Thi thử / Lịch sử / Máy tính CAS / Đại số tuyến tính / Xác suất
    motion/scenes/concept/  # Pure Math Toolset Concept Explorer — one R3F/drei scene per visualization
                     #   template + registry.js (must stay in lockstep with visualization_schema.py) +
                     #   Static2DFallback.jsx (Tier-3-unavailable SVG fallback) + geometry.js (pure helpers)
  engine/
    casEngine.js     # mathjs wrapper for the CAS calculator + Math Playground — zero AI-router involvement
                     #   for manually-typed curves; compileFunctionOfX/toMathjsSyntax also back the playground
  pages/
    ConceptExplorer.jsx        # /concept/:questionId — AI-generated 3D visualization, GSAP-choreographed
    CasCalculator.jsx          # /calculator — mathlive input, live client-side CAS, optional backend "kiểm tra"
    MathPlayground.jsx         # /playground — mathlive expression-list + Mafs 2D canvas; the "mô tả bằng lời"
                     #   box is the only path calling POST /agent/plot, AI-populated curves converge on the
                     #   same row state manual typing uses (no special-cased AI-curve rendering)
    LinearAlgebraWorkspace.jsx # /linalg — grid matrix input, manual spec (no AI) or NL prompt
    ProbabilitySimulator.jsx   # /probability — dice/coin simulation, empirical-vs-theoretical histogram
    motion/          # Reveal3D.jsx, Scene3DLazy.jsx, scenes/ — GSAP/3D animation infra (Vantage rebrand)
  pages/
    ExamSelect.jsx   # Exam list + year/search filters + preview modal (briefing checklist, weak-topic warning)
    TestInterface.jsx# Timed/practice exam-taking flow; tab-switch pause overlay in timed mode
    Results.jsx      # Score hero + 4 tabs: Kết quả (radar chart), Nhận xét (local heuristic insights via
                     #   engine/aiEngine.js — NOT a backend AI call), Câu sai (wrong-answer review), Trường phù hợp
    History.jsx       # Past attempts, localStorage-backed
  context/
    ExamContext.jsx  # Exam-taking session state (pure, no auth dependency)
    HistoryContext.jsx # Pure localStorage history — no server sync
```

## Frontend brand identity (rebrand in progress)

exam-app's visible brand is being renamed from "Luminary" to **Vantage** — a full replacement of typography, icons, color palette, and visual-asset motif (not an extension of the old system). This is unrelated to the "Zenith" internal product name above; only the exam-app UI's consumer-facing brand changes.

- **Mark**: summit-beacon motif (geometric peak + radiant glow) replacing the old astrolabe mark (`AstrolabeMark`/`LuminaryLogo.jsx` → `VantageLogo.jsx`)
- **Typography**: Fraunces (display) + Inter (body/UI) — both confirmed full Vietnamese diacritic support — replacing Cormorant Garamond + Plus Jakarta Sans; JetBrains Mono kept for math/code
- **Icons**: Phosphor (`@phosphor-icons/react`) replacing `lucide-react`
- **Palette**: gold/amber "ascent" accent + indigo-dusk base replacing the cobalt/violet tokens; `--mastery-0..5` reskinned as base-camp→vantage-point
- **Animation**: GSAP (+ `@gsap/react`) added alongside framer-motion (not replacing it) for scroll choreography and a tiered 3D-transform system (CSS 3D on every route, GSAP-choreographed 3D on high-traffic pages, optional lazy-loaded WebGL on 1-2 hero/celebration surfaces only)

Full rollout plan (phases, file-level detail, rationale, sources) lives in the approved blueprint: `C:\Users\Tai Minh\.claude\plans\groovy-baking-beaver.md`. Check that plan's phase progress before assuming old "Luminary" naming/tokens are still current.

## Env vars

**`backend/.env`** (copy from `backend/.env.example`, never commit)

| Variable | Example value |
|---|---|
| `ALLOWED_ORIGINS` | `http://localhost:5173,https://exam-app-ey0.pages.dev` |
| `SQLITE_PATH` | `./app.db` (local) / `/data/app.db` (HF Spaces) |

**`exam-app/.env`** (copy from `exam-app/.env.example`, never commit)

| Variable | Example value |
|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` |

## Test suite

Single suite, no markers/tiers needed anymore:
```bash
PYTHONPATH=backend python3 -m pytest backend/tests/ -q   # backend/tests/test_exams.py
cd exam-app && npx vitest run                            # frontend
```

## Key patterns

**Static-JSON-first data flow** — `exam-app/src/api/index.js` reads exam/question data from the bundled `exam-app/src/data/{exams,questions}.json` and only falls back to the live backend (`_apiFetch`) when the static JSON doesn't have what's needed. The exam-taking flow works with the frontend alone; the backend's SQLite tables are just a seeded mirror of the same JSON for future backend-driven use.

**Local-only "AI" naming is not backend AI** — `exam-app/src/engine/aiEngine.js` (`analyzeResult`) and `exam-app/src/utils/studyReminder.js` are pure client-side heuristics (no imports, no network calls) despite the "ai" naming. Don't confuse them with the AI backend features that were removed — verify with a grep for imports before assuming either calls out to a model.

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

This project is indexed by GitNexus as **AI-Agent-App** (3606 symbols, 9022 relationships, 145 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

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
git rm --cached tools/pdfs/amc8_2019.pdf tools/pdfs/cemc_gauss8_2023.pdf tools/pdfs/ukmt_imc_2020.pdf tools/pdfs/ukmt_jmc_2019.pdf
git rm --cached exam-app/public/images/questions/*.png
git commit --amend --no-edit
git branch -D hf-deploy
git branch -m hf-deploy-new hf-deploy
git push --force space hf-deploy:main
git checkout -f master
```

**Never** use `git merge master` on hf-deploy — the repo history contains old binary files that HF rejects. The orphan commit has no parents, so none of that history is included.

**Binary files must be stripped after the initial commit via `git rm --cached` + `git commit --amend`.** HF Spaces rejects any push containing binary files — this includes `tools/pdfs/*.pdf` AND `exam-app/public/images/questions/*.png` (the question images are served by Cloudflare Pages, not the HF backend). `git rm --cached` before `git add -A` does not work because `git add -A` re-adds the files. The correct order is: commit everything first, then remove the binaries from the index with `--cached`, then amend.

**Use `git checkout -f master`** (force) when returning to master after the orphan branch. The PDF files remain as untracked working-tree files after `git rm --cached`, which causes a plain `git checkout master` to abort with "would be overwritten by checkout".

### Cloudflare Pages (frontend) — must use `--branch=main`

```bash
cd exam-app
VITE_API_BASE_URL=https://minhtai-ai-agent-app.hf.space npm run build
npx wrangler pages deploy dist --project-name exam-app --branch=main --commit-dirty=true
```

**Always** pass `--branch=main`. Without it, wrangler creates a **Preview** deployment (not Production), and `exam-app-ey0.pages.dev` keeps serving the old bundle. The production URL only aliases Production deployments.

**Always** set `VITE_API_BASE_URL` explicitly. `exam-app/.env.local` (used for local dev) takes precedence over `exam-app/.env` in Vite's env loading order, so omitting the explicit override bakes `localhost:8000` into the production bundle.
