# AI Agent App

Vietnamese aluminum/glass door sales chatbot backend (FastAPI + Claude via ai-router proxy).

## Stack

- **Python** — FastAPI, pydantic-settings, tenacity, openai SDK (>=1.58.0)
- **Runtime** — uvicorn
- **AI** — Claude models via internal OpenAI-compatible proxy at `https://ai-router.locdo.tech`

## Dev commands

```bash
pip install -r requirements.txt
uvicorn backend.app.main:app --reload
```

## Project structure

```
backend/app/
  config.py          # Settings (pydantic-settings), get_settings()
  dependencies.py    # get_ai_client() singleton (AsyncOpenAI)
  main.py            # FastAPI routes: POST /chat, POST /compress, GET /health
  agent/
    core.py          # run_agent(), call_with_retry(), system prompt builder
    memory.py        # compress_conversation() via Haiku
  tools/
    registry.py      # Tool schemas (ALL_TOOLS), handle_tool_call(), PRICE_TABLE
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

## Env vars (.env)

```
ANTHROPIC_BASE_URL=https://ai-router.locdo.tech
ANTHROPIC_AUTH_TOKEN=<token>
ANTHROPIC_DEFAULT_OPUS_MODEL=claude-opus-4.6
ANTHROPIC_DEFAULT_SONNET_MODEL=claude-sonnet-4.6
ANTHROPIC_DEFAULT_HAIKU_MODEL=claude-haiku-4.5
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

- **Before editing any symbol** — run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius. Stop and warn the user on HIGH or CRITICAL risk.
- **Before committing** — run `gitnexus_detect_changes()` to verify only expected symbols were affected.
- **Never rename with find-and-replace** — use `gitnexus_rename` which understands the call graph.
- If the index is stale, run `gitnexus analyze /mnt/d/AI-Agent-App --skip-git` before querying.

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
