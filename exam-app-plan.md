# Implementation Plan: HCMC Grade 10 Exam Practice Platform

> Audit-revised version. Changes from audit marked **[CHANGED]**, removals **[REMOVED]**, additions **[ADDED]**.

---

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Frontend build | Vite + React + React Router | Fast setup, no CRA overhead |
| Styling | Tailwind CSS | Utility-first, no design system needed for mockup |
| State | Context + useReducer | Two slices (session, history) — Redux is overkill |
| Backend | None — static JSON + thin `api/` module | Mockup scope; module interface lets real API swap in later |
| AI | Pure JS rule-based `aiEngine.js` | Clean interface; LLM replaces the internals, not the callers |
| Persistence | localStorage | No auth complexity, history survives refresh |
| Charts | Recharts | Lightest React-native chart lib |

---

## Dependency Graph

```
data/ (JSON schemas + static datasets)
        │
        ├── engine/examEngine.js  ←  shuffle, timer, auto-submit
        │           │
        │           ├── pages/TestInterface.jsx
        │           │           │
        │           │           └── engine/scoringEngine.js
        │           │                       │
        │           │                       └── engine/aiEngine.js
        │           │                                   │
        │           │                                   └── components/AIInsights.jsx
        │           │
        │           └── pages/Results.jsx
        │
        └── api/index.js  ←  data loader abstraction
                    │
                    └── pages/ExamSelect.jsx
```

---

## Folder Structure

```
exam-app/
  scripts/
    crawl/
      index.js
      sources/
        questions/vndoc.js
        questions/thuvienhoclieu.js
        questions/loigiaihay.js
        schools/tuyensinh247.js
        schools/dantri.js
        schools/hcmedu.js
      pipeline/
        normalize.js
        tag.js
        dedupe.js
        validate.js
        merge.js
      output/
        raw/
        questions.json
        exams.json
        schools.json
        crawl-report.json
  src/
    api/index.js
    data/
      questions.json
      exams.json
      schools.json
    engine/
      examEngine.js
      scoringEngine.js
      aiEngine.js
    context/
      ExamContext.jsx
      HistoryContext.jsx
    pages/
      Landing.jsx
      ExamSelect.jsx
      TestInterface.jsx
      Results.jsx
      History.jsx
    components/
      Timer.jsx
      QuestionCard.jsx
      TopicBreakdownChart.jsx
      AIInsights.jsx
      SchoolList.jsx
    App.jsx
    main.jsx
  index.html
  tailwind.config.js
  vite.config.js
  package.json
```

---

## Data Schemas [CHANGED — C1, C2]

```jsonc
// questions.json
// choices: plain text only (no "A." prefix); correct: 0-based index
{
  "id": "q_vndoc_2024_001",
  "source": "vndoc",
  "year": 2024,
  "topic": "algebra",           // algebra | geometry | statistics | combinatorics
  "difficulty": "medium",       // easy | medium | hard
  "question": "Giải phương trình...",
  "choices": ["2", "-2", "1", "-1"],  // plain text; A/B/C/D assigned by index at render
  "correct": 0,                       // index into choices[] before shuffle
  "explanation": "..."                // null if not on source page
}

// exams.json
{
  "id": "hcmc_2024_math",
  "year": 2024,
  "title": "Đề thi thử Toán - TPHCM 2024",
  "duration": 90,
  "questionIds": ["q_vndoc_2024_001", "..."],
  "totalQuestions": 30
}

// schools.json
{
  "id": "thpt_le_hong_phong",
  "name": "THPT Lê Hồng Phong",
  "district": "Quận 5",
  "type": "chuyên",             // chuyên | chất_lượng_cao | thường
  "cutoffs": {
    "2020": { "math": 9.25, "total": 27.5 },
    "2021": { "math": 9.5,  "total": 28.0 },
    "2022": { "math": 9.5,  "total": 28.25 },
    "2023": { "math": 9.6,  "total": 28.5 },
    "2024": { "math": 9.65, "total": 28.75 }
  },
  "trend": "rising"             // rising | stable | falling
}

// result (localStorage)
{
  "id": "result_<timestamp>",
  "examId": "hcmc_2024_math",
  "startedAt": "<iso>",
  "finishedAt": "<iso>",
  "answers": { "q_vndoc_2024_001": 0, "...": null },  // chosen index; null = unanswered
  "score": 8.5,
  "maxScore": 10,
  "accuracy": 0.85,
  "timeSpent": 4320,
  "topicBreakdown": {
    "algebra":      { "correct": 8, "total": 10 },
    "geometry":     { "correct": 5, "total": 8 },
    "statistics":   { "correct": 4, "total": 7 },
    "combinatorics":{ "correct": 3, "total": 5 }
  }
}
```

**Rationale (C2):** `correct` stored as 0-based index — unambiguous after shuffle, avoids text-matching fragility.

---

## Phase 1: Foundation

### Task 1 — Project scaffold

**Files:** `package.json`, `vite.config.js`, `tailwind.config.js`, `src/main.jsx`, `src/App.jsx`

Acceptance criteria:
- [ ] `npm run dev` starts Vite dev server with no errors
- [ ] React Router renders a placeholder at `/`
- [ ] Tailwind classes apply (verify with one utility class)

Verification: `npm run dev` → browser loads blank shell

Dependencies: None · Scope: S

---

### Task 2 — Multi-source crawler for all static datasets [CHANGED — M2, M3, M4, m3]

**Files:** `scripts/crawl/` tree as shown in folder structure

**Dependencies: None** — crawler is standalone Node.js; does not require the React scaffold

**[ADDED — m3]** Install crawler-only dev deps before running:

```bash
npm install --save-dev axios cheerio
```

These are `devDependencies` — not bundled into the frontend build.

#### Dataset 1 — Exam questions

| Source | URL pattern | Extracts |
|---|---|---|
| `vndoc.com` | `/de-thi-thu-vao-lop-10-mon-toan` listing | Questions + inline answer keys |
| `thuvienhoclieu.com` | Tag: `đề thi thử toán lớp 10 TPHCM` | HCMC-specific papers, 2020–2024 |
| `loigiaihay.com` | `/de-thi-vao-lop-10` | Answer key fallback |

Parse strategy — server-rendered HTML, `axios` + `cheerio` sufficient:

```
Question regex:  /Câu\s*(\d+)[:.]\s*([\s\S]+?)(?=Câu\s*\d+|Đáp án|$)/gi
Choice regex:    /([A-D])[.)]\s*(.+?)(?=[A-D][.)]|$)/gi  → store text only, drop letter
Answer regex:    /Câu\s*(\d+)[:\s]*([A-D])/gi            → "A"→0, "B"→1, "C"→2, "D"→3
```

**[CHANGED — C1, C2]** `CHOICE_RE` captures letter + text separately; only text stored in `choices[]`. Answer letter converted to 0-based index and stored as `correct`.

**Topic tagger** (`pipeline/tag.js`):

```
algebra:       ["phương trình", "bất phương trình", "hàm số", "đa thức", "hệ phương trình", "căn thức"]
geometry:      ["tam giác", "hình tròn", "đường thẳng", "góc", "diện tích", "chu vi", "tiếp tuyến"]
statistics:    ["xác suất", "thống kê", "tần số", "trung bình cộng", "biểu đồ"]
combinatorics: ["tổ hợp", "chỉnh hợp", "hoán vị", "nhị thức Newton", "quy tắc đếm"]
Fallback: "algebra"
```

**Difficulty tagger** — by position within exam: Q1–10 → easy · Q11–25 → medium · Q26–30 → hard

#### Dataset 2 — School cutoff scores

- Primary: `tuyensinh247.com/diem-chuan-vao-lop-10-tphcm-[year].html` for years 2020–2024
- Secondary: `dantri.com.vn` — cross-validation; scores differing > 0.5 between sources flagged in `crawl-report.json`, not silently dropped

#### Dataset 3 — School profiles

- Source: `hcm.edu.vn` school directory — name, district, type (chuyên / chất lượng cao / thường)
- Merged with cutoff data via fuzzy name match (Levenshtein ≤ 2, diacritics-insensitive)
- `trend`: avg(2022–2024) vs avg(2020–2021); delta > 0.2 → rising · < -0.2 → falling · else stable

#### [ADDED — M4] `normalize.exams()` specification

Groups questions by `year`, produces per year:

```
id:             "hcmc_{year}_math"
year:           {year}
title:          "Đề thi thử Toán - TPHCM {year}"
duration:       90
questionIds:    [all q.id where q.year === year]
totalQuestions: questionIds.length
```

#### Orchestrator flow

```
1. Crawl questions → normalize (plain-text choices, index correct) → dedupe → tag → validate
2. Crawl schools   → merge hcmedu + tuyensinh247 + dantri → compute trend → validate
3. normalize.exams(questions) → exams.json
4. Write output/ + crawl-report.json
```

Rate limiting: 1.5 s between requests per domain. Check `/robots.txt` before crawling; skip domain and log warning on `Disallow`.

Run commands:

```json
"scripts": {
  "crawl":           "node scripts/crawl/index.js",
  "crawl:questions": "node scripts/crawl/index.js --only=questions",
  "crawl:schools":   "node scripts/crawl/index.js --only=schools",
  "crawl:validate":  "node scripts/crawl/pipeline/validate.js --check-only"
}
```

After running:

```bash
cp scripts/output/questions.json src/data/
cp scripts/output/exams.json     src/data/
cp scripts/output/schools.json   src/data/
```

Acceptance criteria:
- [ ] `npm run crawl` completes exit 0
- [ ] `questions.json`: ≥60 questions, 3+ years, `correct` is integer 0–3 on every entry
- [ ] Zero duplicates (validate.js reports 0 hash collisions)
- [ ] No single topic > 60% of total
- [ ] `schools.json`: ≥30 schools, ≥3 years of `{ math, total }` cutoffs, `trend` present on all
- [ ] Cross-source score conflicts flagged in `crawl-report.json`
- [ ] `npm run crawl:validate` exits non-zero with clear message on invalid output

Dependencies: None · Scope: L

---

### Task 3 — App shell (router + context + layout)

**Files:** `src/context/ExamContext.jsx`, `src/context/HistoryContext.jsx`, `src/App.jsx`

`ExamContext` state: `{ exam, questions, answers, mode, timeLeft, status }`
Actions: `START_EXAM` · `ANSWER_QUESTION` · `TICK` · `SUBMIT` · `RESET`

`HistoryContext`: loads localStorage on mount · exposes `addResult(result) → id` · `results[]`

Routes:
- `/` → Landing
- `/exams` → ExamSelect
- `/test/:examId` → TestInterface
- `/results/current` → Results (live session) **[CHANGED — C3]**
- `/results/:resultId` → Results (history lookup) **[CHANGED — C3]**
- `/history` → History

Acceptance criteria:
- [ ] All routes render without error
- [ ] `ExamContext` accessible from any child
- [ ] `HistoryContext` reads existing localStorage on mount
- [ ] Both `/results/current` and `/results/:resultId` handled by the same Results page **[ADDED — C3]**

Dependencies: T1, T2 · Scope: M

---

**Checkpoint 1** — `npm run dev`, navigate all routes, no console errors.

---

## Phase 2: Exam Engine

### Task 4 — ExamEngine module [CHANGED — C1, C2, m1]

**File:** `src/engine/examEngine.js`

```
shuffleArray(arr)
  Fisher-Yates. Returns new array.

shuffleChoices(question)
  Shuffles question.choices[]. Returns { choices: string[], correct: number }
  where correct is the new 0-based index of the originally-correct choice.
  Operates on plain-text choices; correct is always an integer 0–3.

createSession(exam, questions, mode)
  Returns initial ExamContext state.
  Timed mode:    timeLeft = exam.duration * 60
  Practice mode: timeLeft = null
  Calls shuffleArray on question order and shuffleChoices on each question.
  Stores shuffled correct index per question in session (source data not mutated).

tick(session)
  Returns new session with timeLeft decremented by 1.
  When timeLeft reaches 1 → sets status = 'timeout'.
  Pure function — does not call dispatch.
```

**[ADDED — m1]** Reducer relationship: the `TICK` reducer case in ExamContext calls `examEngine.tick(state)` and returns the result. Components dispatch `{ type: 'TICK' }` only — they never call `examEngine.tick()` directly.

Acceptance criteria:
- [ ] `shuffleArray` produces all permutations over 100 runs (statistical)
- [ ] `shuffleChoices` returns `{ choices[], correct: number }` where `correct` is valid index 0–3
- [ ] `createSession` timed mode: `timeLeft = exam.duration * 60`
- [ ] `createSession` practice mode: `timeLeft = null`
- [ ] `tick` at `timeLeft === 1` returns `status = 'timeout'`

Verification: `src/engine/__tests__/examEngine.test.js`

Dependencies: T2 · Scope: S

---

### Task 5 — ExamSelect page

**Files:** `src/pages/ExamSelect.jsx`, `src/pages/Landing.jsx`

Landing: hero copy + two CTAs ("Thi thử" → ExamSelect · "Luyện tập" → ExamSelect with mode pre-set).
ExamSelect: grid of exam cards (year, question count, duration), mode toggle (Timed / Practice), "Bắt đầu" dispatches `START_EXAM` and navigates to `/test/:examId`.

Acceptance criteria:
- [ ] All exams from `loadExams()` render as cards
- [ ] Mode toggle updates mode in context before navigation
- [ ] Navigating to `/test/:examId` with no prior `START_EXAM` redirects to `/exams`

Dependencies: T3, T4 · Scope: M

---

### Task 6 — TestInterface page [CHANGED — M1: practice mode fully specced here, T12 removed]

**Files:** `src/pages/TestInterface.jsx`, `src/components/QuestionCard.jsx`, `src/components/Timer.jsx`

Layout: progress indicator ("5 / 30"), timer top-right, question text, four choice buttons (A/B/C/D by array index), "Tiếp theo" / "Nộp bài".

**Practice mode** (fully specced — T12 removed):
- After selection: correct button highlighted green, wrong choice highlighted red
- Explanation shown below choices (`explanation !== null`)
- "Tiếp theo" gated until an answer is selected
- No timer shown or running

**Timed mode:**
- Timer counts down; `status === 'timeout'` dispatches `SUBMIT` → navigates to `/results/current`
- "Nộp bài" always visible; unanswered questions submitted as `null`

Auto-submit: `useEffect` watches `status`; on `'timeout'` dispatches `SUBMIT` and navigates.

Acceptance criteria:
- [ ] Answering records chosen index in `ExamContext.answers[questionId]`
- [ ] Timer counts down; reaching 0 auto-submits and navigates to `/results/current` **[CHANGED — C3]**
- [ ] Practice mode: correct green, wrong red, explanation shown, "Tiếp theo" gated
- [ ] Practice mode: no timer rendered or running
- [ ] Unanswered questions submit as `null`

Dependencies: T3, T4, T5 · Scope: M

---

**Checkpoint 2** — Full exam flow: Landing → ExamSelect → TestInterface → auto-submit → `/results/current`.

---

## Phase 3: Scoring & Results

### Task 7 — ScoringEngine module

**File:** `src/engine/scoringEngine.js`

```
scoreExam(session, questions)
→ { score, maxScore, accuracy, timeSpent, topicBreakdown, answeredCount }
  score:          (correct / total) * 10, rounded to 1dp
  topicBreakdown: { [topic]: { correct, total, accuracy } } for all 4 topics
  unanswered:     counted as incorrect
  result id:      generated as `result_${Date.now()}`
```

Acceptance criteria:
- [ ] 0 correct → 0.0; all correct → 10.0
- [ ] `topicBreakdown` covers all 4 topics
- [ ] Unanswered questions counted as incorrect
- [ ] Result object matches schema in T2

Dependencies: T2, T4 · Scope: S

---

### Task 8 — Results page [CHANGED — C3]

**File:** `src/pages/Results.jsx`

**[CHANGED — C3]** Navigation contract:
- Mounted at `/results/current` (post-submit): score session → `history.addResult(result)` returns `id` → `navigate('/results/' + id, { replace: true })`
- Mounted at `/results/:resultId` (direct link): load from `HistoryContext` by id; show "Không tìm thấy kết quả" if missing
- Mounted at `/results/current` with no active session: redirect to `/exams`

Layout: score badge (large), accuracy %, time spent, topic breakdown table (topic | correct/total | accuracy bar), "Xem phân tích AI" scroll anchor.

Acceptance criteria:
- [ ] At `/results/current` with live session: scores, saves, replaces URL with `/results/:id`
- [ ] At `/results/:id`: renders from localStorage without active session
- [ ] At `/results/current` with no session: redirects to `/exams`
- [ ] Score, accuracy, time correct for a known test case
- [ ] Result persisted to localStorage (verify with DevTools)

Dependencies: T3, T7 · Scope: M

---

### Task 9 — Topic breakdown chart [CHANGED — m2]

**File:** `src/components/TopicBreakdownChart.jsx`

**[ADDED — m2]** Prerequisites: `npm install recharts`

Recharts `BarChart` — x-axis: topics · y-axis: accuracy %. Color: green ≥ 70% · yellow 50–69% · red < 50%. Responsive (fills container width).

Acceptance criteria:
- [ ] `recharts` in `package.json` before this task starts
- [ ] Renders without Recharts errors
- [ ] Bar colors match accuracy thresholds
- [ ] Chart is responsive

Dependencies: T8 · Scope: S

---

**Checkpoint 3** — Full flow: Landing → Test → Results at canonical `/results/:id` with correct score and chart.

---

## Phase 4: AI Features

### Task 10 — AIEngine module [CHANGED — M3]

**File:** `src/engine/aiEngine.js`

```
analyzeResult(result, allResults, schools)
→ {
    predictedScoreRange: [low, high],
    percentile: number,
    weakTopics: string[],
    recommendations: [{ school, matchStrength, gap }],
    improvementStrategy: string[]
  }
```

**[CHANGED — M3]** School matching uses `school.cutoffs[latestYear].math` (0–10 scale, matches `result.score`):

```
latestYear = max(Object.keys(school.cutoffs))
cutoff     = school.cutoffs[latestYear].math

score >= cutoff - 0.3  →  'safety'
score >= cutoff - 0.6  →  'match'
else                   →  'reach'

Return top 3 closest by |score - cutoff| ascending.
```

Score prediction: ≥2 past results → average ± stddev · single result → score ± 0.5

Pluggable note: replace internals with `fetch('/api/ai/analyze', ...)` when LLM is ready — callers unchanged.

Acceptance criteria:
- [ ] `weakTopics` identifies all topics with `topicBreakdown[t].accuracy < 0.6`
- [ ] School matching uses `cutoffs[latestYear].math`, not `total`
- [ ] Returns exactly 3 school recommendations
- [ ] `predictedScoreRange` widens with ≥2 results vs single result
- [ ] Works with empty `allResults` (first attempt)

Dependencies: T2, T7 · Scope: M

---

### Task 11 — AIInsights component [CHANGED — m4]

**Files:** `src/components/AIInsights.jsx`, `src/components/SchoolList.jsx`

Layout: predicted score range card · weak topic chips (red/yellow) · improvement strategy numbered list · school list with match badge (Reach / Match / Safety) and math cutoff score.

Acceptance criteria:
- [ ] Shows "Chưa đủ dữ liệu phân tích" when called with no data
- [ ] School cards show name, district, math cutoff, match badge
- [ ] Weak topic chips visually distinct from strong topics

**[CHANGED — m4]** Dependencies: **T8, T10** — T9 removed (AIInsights and TopicBreakdownChart are siblings on Results page, not a dependency chain)

Scope: M

---

**Checkpoint 4** — Full flow with AI insights renders correctly for a submitted exam.

---

## Phase 5: History

### ~~Task 12 — Practice mode feedback~~ [REMOVED — M1]

Practice mode is fully specced and accepted in Task 6.

---

### Task 12 (renumbered) — History page

**Files:** `src/pages/History.jsx`, add `/history` route in `src/App.jsx`

List of past attempts sorted by date desc: exam title, date, score badge, "Xem chi tiết" → `/results/:id`.

Acceptance criteria:
- [ ] All localStorage results rendered, sorted date desc
- [ ] Empty state: "Chưa có lần thi nào"
- [ ] "Xem chi tiết" navigates to correct result

Dependencies: T3, T8 · Scope: S

---

**Checkpoint 5 (Final)** — All flows complete, no console errors, localStorage persistence verified, `/results/:id` direct links resolve correctly.

---

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Crawl source HTML restructures | High | `validate.js` hard-fails if output < 60 questions or < 30 schools |
| `correct` index out of range after shuffle | High | `shuffleChoices` asserts returned index is 0–3; test covers all 4 positions |
| `/results/current` mounted with no session | Medium | Redirect guard in Results page |
| Timer drift over long sessions | Low | Use `Date.now()` delta, not pure interval count |
| School cutoff cross-source conflict | Medium | Flag in `crawl-report.json`; never silently drop |

---

## Open Questions

1. **Auth scope**: History per-user (requires real auth) or anonymous localStorage? Plan assumes localStorage.
2. **Question count**: 30 questions/exam sufficient, or is 50 needed for Phase 1?
3. **Language**: UI strings Vietnamese — should code identifiers also be Vietnamese or English?

---

## Audit Fix Index

| ID | Severity | Description | Applied in |
|---|---|---|---|
| C1 | Critical | `choices` stored as plain text — no embedded letter prefix | T2 schema, T4 |
| C2 | Critical | `correct` stored as 0-based integer index, not letter string | T2 schema, T4, T7, T10 |
| C3 | Critical | Navigate to `/results/current`; Results page saves then replaces URL | T3, T6, T8 |
| M1 | Moderate | T12 (practice mode) merged into T6; standalone task removed | T6, Phase 5 |
| M2 | Moderate | T2 dependency changed to None | T2 |
| M3 | Moderate | AIEngine uses `cutoffs[latestYear].math`, not bare `cutoff` | T10 |
| M4 | Moderate | `normalize.exams()` behavior fully specified | T2 |
| m1 | Minor | T4 `tick()` / T3 `TICK` reducer relationship clarified | T4 |
| m2 | Minor | `npm install recharts` added as T9 prerequisite | T9 |
| m3 | Minor | `axios` + `cheerio` added as devDependencies in T2 | T2 |
| m4 | Minor | T11 dependencies corrected to T8, T10 (removed T9) | T11 |

---

*12 tasks total (original T12 removed, T13 renumbered to T12). All audit findings resolved.*
