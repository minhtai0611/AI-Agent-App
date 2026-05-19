## Auth & Credit System

### Auth-required endpoints
All AI endpoints (`/analyze`, `/hint`, `/explain`, `/study-plan`) require a valid JWT in `Authorization: Bearer <token>`. The token is obtained from `POST /auth/google`.

### Credit deduction per feature
| Feature | Endpoint | Credits |
|---|---|---|
| Socratic hint | POST /hint | 1 |
| Answer explanation | POST /explain | 1 |
| Result analysis | POST /analyze | 3 |
| Study plan | POST /study-plan | 5 |

`/study-plan` also requires `subscription_tier` ∈ {student, complete} — returns 403 `tier_required` otherwise.

### Getting the current admin key

Admin keys rotate automatically (default: weekly). Get the current key from either:
1. **HF Spaces** → Files tab → `/data/admin_keys.txt` → copy the latest line's key
2. **Local fallback**: `python tools/gen_admin_key.py` (prompts for `ADMIN_MASTER_SECRET`)

### Granting manual top-ups (admin)
```
POST /admin/users/{user_id}/credits
X-Admin-Key: <current derived key from admin_keys.txt or gen_admin_key.py>
{"amount": 500, "reason": "manual_topup_bank_transfer"}
```

### Activating subscriptions (admin)
```
POST /admin/users/{user_id}/subscription
X-Admin-Key: <current derived key>
{"tier": "student", "period": "monthly", "expires_at": "2026-06-15T00:00:00Z", "bonus_credits": 0}
```

### Suspending abusive accounts (admin)
```
POST /admin/users/{user_id}/suspend
X-Admin-Key: <current derived key>
{"reason": "credit_velocity abuse"}
```

The abuse detector (`backend/app/abuse_detector.py`) runs every 5 minutes and auto-suspends on HIGH-confidence signals (credit velocity, burst >100 req/10min). MEDIUM-confidence events are logged to `security_events` for manual review via `GET /admin/security-events`.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **AI-Agent-App** (4539 symbols, 12516 relationships, 248 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
