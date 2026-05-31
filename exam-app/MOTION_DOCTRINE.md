# Zenith Motion Doctrine v2 — Cognitive Science Edition

Grounded in Mayer's Cognitive Theory of Multimedia Learning (CTML) and behavioral research
from Duolingo and Brilliant.org. Animations serve three distinct cognitive functions mapped
to three tiers. Everything else is forbidden.

---

## Three-Tier Architecture

### Tier 1 — FEEDBACK (100–300ms, always on)
**Purpose:** Knowledge of Results — the student must know immediately whether an action succeeded.
**Principle:** Temporal contiguity. Cannot be disabled by the user.

| Animation | File | Duration |
|---|---|---|
| Correct answer flash (green) | `index.css` `z-correct-flash` | 500ms |
| Wrong answer shake | `index.css` `z-wrong-shake` | 280ms |
| Button press ripple | `index.css` `ripple-btn` | 400ms |
| Loading skeleton shimmer | `index.css` `shimmer` | 1.4s loop |
| Toast notification entrance | `index.css` `toast-in` | opacity only |

### Tier 2 — REVEAL (300–500ms, content-entry only, opacity only)
**Purpose:** Schema formation — chunk complex content into digestible pieces.
**Principle:** Stagger ≤ 5 items, ≤ 80ms between items, opacity only (no y-translate), fires once per session.

| Pattern | Where applied | Spec |
|---|---|---|
| Page transition | App.jsx `AnimatePresence` | 280ms enter, 180ms exit |
| Card list stagger | `listVariants` + `itemVariants` | 80ms stagger, opacity only |
| Score bar fill | Results.jsx | 250ms linear |
| Concept stage fade | ReviewSession.jsx | 200ms opacity |
| Scroll reveal (useInView) | StudyPlan, AdaptiveStudyPlan | 400ms, fires once |
| Checkpoint bar fill | StudyPlan.jsx `CheckpointBar` | 250ms linear |

### Tier 3 — CEREMONY (500ms–1.5s, milestone events only, spring physics)
**Purpose:** Dopamine reinforcement — reward meaningful achievement.
**Principle:** Spring physics (natural, interruptible). Infrequent (≤ once per session). Skippable.

| Event | Where | Component |
|---|---|---|
| Focus area resolved (✓ badge) | StudyPlan.jsx `FocusCard` | `AchievementCeremony` |
| Spaced repetition stage advance | ReviewSession.jsx `stageLabel` | spring scale pop |
| Score ≥ 9.0 ring pop | Results.jsx score SVG | `AchievementCeremony` |
| Mastery rank badge appear | Account.jsx profile | `AchievementCeremony` |
| Daily streak on completion | DailyChallenge.jsx | `AchievementCeremony` |
| Oracle celebrating response | OracleBubble.jsx | CSS `oracle-celebrating` keyframe |

---

## Oracle State Machine

The Oracle bubble uses CSS `data-oracle-state` attribute (not Framer Motion) for four states:

| State | Trigger | Animation |
|---|---|---|
| `idle` | Default | Slow 2.5s glow pulse |
| `thinking` | `setOracleStatus(THINKING)` on solve start | Fast 0.7s pulse loop |
| `celebrating` | High-confidence valid solve | 0.7s spring scale pop (plays once) |
| `error` | Solve error or timeout | 0.35s shake (plays once) |

State is managed via `OracleContext.oracleStatus` and `setOracleStatus`.
`ORACLE_STATUS` constants are exported from `OracleContext.jsx`.

---

## Forbidden (unchanged from v1)

- ✗ AmbientGlows floating orbs on non-landing pages
- ✗ react-countup number animations
- ✗ canvas-confetti decorative explosions (confetti is allowed on score ≥ 7 in Results.jsx, which is a product decision not a doctrine decoration)
- ✗ Spring/bounce on page transitions
- ✗ `whileHover` scale on text, icons, or inline elements
- ✗ `height`/`width` animations (triggers reflow, causes jank)
- ✗ Stagger > 5 items
- ✗ Ceremonies on every correct answer — Tier 3 only on genuine milestones
- ✗ y-translate in `itemVariants` or card variants

---

## Accessibility

`<MotionConfig reducedMotion="user">` is set at the App root (App.jsx).
When the user has `prefers-reduced-motion: reduce` enabled, all Framer Motion animations
resolve to their final state instantly. The Oracle CSS keyframes do NOT automatically
respect this — they are exempted because they are status indicators, not content animations.

---

## Key Files

| File | Role |
|---|---|
| `src/utils/animations.js` | `pageVariants`, `listVariants`, `itemVariants` |
| `src/components/AchievementCeremony.jsx` | Reusable Tier 3 spring wrapper |
| `src/hooks/useRevealOnScroll.js` | `useInView` wrapper for scroll reveals |
| `src/components/OracleBubble.jsx` | Oracle state machine consumer |
| `src/context/OracleContext.jsx` | `oracleStatus`, `setOracleStatus`, `ORACLE_STATUS` |
| `src/index.css` | All CSS keyframes + Oracle state selectors |
