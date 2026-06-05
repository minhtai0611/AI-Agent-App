# Zenith Demo Video — Data & Seed Plan

## 1. Demo User Profile

```json
{
  "id": 1,
  "email": "demo@zenith.vn",
  "display_name": "Nguyễn Minh Tuấn",
  "avatar_url": "https://ui-avatars.com/api/?name=Nguyen+Minh+Tuan&background=F2A20C&color=000",
  "grade": "12",
  "province": "Hà Nội",
  "school_type": "chuyên",
  "subscription_tier": "student",
  "subscription_period": "monthly",
  "credits_balance": 50,
  "mastery_rank": "Học sinh",
  "solid_concept_count": 18,
  "tos_accepted_at": "2025-06-01T00:00:00Z",
  "extended_onboarding_done": true
}
```

**Critical field notes:**
- `grade: "12"` — triggers university school suggestions in Results (`isCollegeUser = true`)
- `extended_onboarding_done: true` — suppresses ExtendedOnboarding modal on mount
- `subscription_tier: "student"` — enables AI analysis as free, unlocks study plan
- `credits_balance: 50` — passes ≥3 Tia check for analysis and ≥5 for study plan
- `province: "Hà Nội"` — activates province moat sorting in ExamSelect; Hà Nội exams float to top

---

## 2. Demo JWT Token

The frontend AuthContext validates only:
1. `token.split('.')[1]` is valid base64-decodable JSON
2. `payload.exp * 1000 > Date.now()`

The signature is never verified client-side. Use this pre-built token valid until 2036-01-01:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZW1haWwiOiJkZW1vQHplbml0aC52biIsImV4cCI6MjA4MjcxNTIwMH0.DEMO_SIG_PLACEHOLDER
```

**The `GET /users/me` route MUST be mocked** to return the demo user object, because the signature is not real. The `page.route('**/users/me')` mock in the Playwright spec handles this.

---

## 3. Demo Exam

**Exam ID:** `thpt_2024`  
**Title:** Đề thi THPT Quốc gia 2024 — Môn Toán  
**Duration:** 90 minutes  
**Questions:** 50  
**Source:** Bộ GD&ĐT — Kỳ thi THPT Quốc gia 2024  
**Category:** thpt  
**Mode:** thithu

**Why this exam:**
- Official national exam — maximum credibility for a Vietnamese audience
- Canonical 50-question, 90-minute format
- Appears first in ExamSelect when sorted by year descending with `mode=thithu`
- All 50 question IDs (`q_thpt24_001` through `q_thpt24_050`) confirmed present in `questions.json`

### Question ID Validation Table

These IDs must exist in `exam-app/src/data/questions.json` before recording:

| ID | Topic | Expected |
|----|-------|---------|
| q_thpt24_001 | geometry | present |
| q_thpt24_010 | algebra | present |
| q_thpt24_020 | calculus | present |
| q_thpt24_030 | functions | present |
| q_thpt24_050 | trigonometry | present |

The Playwright spec's `beforeAll` block validates these at runtime.

---

## 4. Pre-Fabricated Exam Result

**Result ID:** `result_demo_2024_001`  
**Score:** 7.6 / 10 (38/50 correct)  
**Score label:** "Khá giỏi" (≥ 6.5 threshold in Results.jsx)  
**Confetti:** fires (score ≥ 7.0 threshold)

### Topic Breakdown

| Topic | Correct | Total | Accuracy | Verdict |
|-------|---------|-------|----------|---------|
| functions | 7 | 8 | 87.5% | ✓ Tốt |
| algebra | 16 | 18 | 88.9% | ✓ Tốt |
| calculus | 4 | 7 | 57.1% | ⚠ Cần ôn |
| statistics | 2 | 3 | 66.7% | ⚠ Cần ôn |
| trigonometry | 2 | 2 | 100.0% | ✓ Tốt |
| geometry | 6 | 10 | 60.0% | ⚠ Cần ôn |
| combinatorics | 1 | 2 | 50.0% | ✗ Yếu |

### Full Result Object (inject into localStorage)

```json
{
  "id": "result_demo_2024_001",
  "examId": "thpt_2024",
  "startedAt": "2026-06-05T08:00:00.000Z",
  "finishedAt": "2026-06-05T09:15:00.000Z",
  "score": 7.6,
  "maxScore": 10,
  "accuracy": 0.76,
  "timeSpent": 4500,
  "answeredCount": 50,
  "topicBreakdown": {
    "functions":     { "correct": 7,  "total": 8,  "accuracy": 0.875  },
    "algebra":       { "correct": 16, "total": 18, "accuracy": 0.8889 },
    "calculus":      { "correct": 4,  "total": 7,  "accuracy": 0.5714 },
    "statistics":    { "correct": 2,  "total": 3,  "accuracy": 0.6667 },
    "trigonometry":  { "correct": 2,  "total": 2,  "accuracy": 1.0    },
    "geometry":      { "correct": 6,  "total": 10, "accuracy": 0.6    },
    "combinatorics": { "correct": 1,  "total": 2,  "accuracy": 0.5    }
  },
  "answers": {
    "q_thpt24_001": 3, "q_thpt24_002": 3, "q_thpt24_003": 2, "q_thpt24_004": 3,
    "q_thpt24_005": 1, "q_thpt24_006": 1, "q_thpt24_007": 1, "q_thpt24_008": 2,
    "q_thpt24_009": 2, "q_thpt24_010": 1, "q_thpt24_011": 2, "q_thpt24_012": 1,
    "q_thpt24_013": 1, "q_thpt24_014": 1, "q_thpt24_015": 1, "q_thpt24_016": 0,
    "q_thpt24_017": 1, "q_thpt24_018": 3, "q_thpt24_019": 1, "q_thpt24_020": 0,
    "q_thpt24_021": 2, "q_thpt24_022": 2, "q_thpt24_023": 3, "q_thpt24_024": 0,
    "q_thpt24_025": 1, "q_thpt24_026": 1, "q_thpt24_027": 1, "q_thpt24_028": 1,
    "q_thpt24_029": 1, "q_thpt24_030": 1, "q_thpt24_031": 1, "q_thpt24_032": 2,
    "q_thpt24_033": 1, "q_thpt24_034": 1, "q_thpt24_035": 2, "q_thpt24_036": 2,
    "q_thpt24_037": 0, "q_thpt24_038": 1, "q_thpt24_039": 1, "q_thpt24_040": 3,
    "q_thpt24_041": 1, "q_thpt24_042": 1, "q_thpt24_043": 1, "q_thpt24_044": 2,
    "q_thpt24_045": 1, "q_thpt24_046": 1, "q_thpt24_047": 1, "q_thpt24_048": 2,
    "q_thpt24_049": 1, "q_thpt24_050": 2
  },
  "timePerQuestion": {},
  "questionData": {}
}
```

---

## 5. Mock AI Streaming Responses

### 5a. POST /analyze/stream — NDJSON Chunks

Format: `{ "field": "...", "chunk": "..." }` then `{ "field": "...", "done": true }`

```ndjson
{"field":"summary","chunk":"Bạn đạt 7.6 điểm — kết quả "}
{"field":"summary","chunk":"khá tốt cho kỳ thi THPT. "}
{"field":"summary","chunk":"Điểm mạnh rõ rệt ở Đại số (89%) và Hàm số (88%). "}
{"field":"summary","chunk":"Cần tập trung cải thiện Hình học (60%) và Tích phân (57%)."}
{"field":"summary","done":true}
{"field":"weak_topics","chunk":"[\"geometry\",\"calculus\",\"combinatorics\"]"}
{"field":"weak_topics","done":true}
{"field":"recommendations","chunk":"[\"Ôn luyện thể tích khối chóp và khối trụ\",\"Luyện tích phân bằng đổi biến và tích phân từng phần\",\"Xem lại tổ hợp chỉnh hợp: có thứ tự và không thứ tự\"]"}
{"field":"recommendations","done":true}
{"field":"school_insight","chunk":"Với 7.6 điểm Toán, bạn có khả năng cao vào "}
{"field":"school_insight","chunk":"Đại học Bách Khoa Hà Nội (ngành Kỹ thuật), Đại học Kinh tế Quốc dân, "}
{"field":"school_insight","chunk":"và Học viện Ngân hàng. Cần thêm 0.4 điểm để đảm bảo cơ hội vào Đại học Khoa học Tự nhiên."}
{"field":"school_insight","done":true}
{"field":"schools","chunk":"[{\"name\":\"Đại học Bách Khoa Hà Nội\",\"score_range\":\"7.0 – 8.5\",\"type\":\"Công lập\",\"region_note\":\"Hà Nội\",\"note\":\"Ngành Kỹ thuật Cơ điện tử\"},{\"name\":\"Đại học Kinh tế Quốc dân\",\"score_range\":\"6.5 – 8.0\",\"type\":\"Công lập\",\"region_note\":\"Hà Nội\",\"note\":\"Ngành Kinh tế\"},{\"name\":\"Học viện Ngân hàng\",\"score_range\":\"6.5 – 7.5\",\"type\":\"Công lập\",\"region_note\":\"Hà Nội\",\"note\":\"Ngành Tài chính\"}]"}
{"field":"schools","done":true}
```

### 5b. POST /hint — JSON Response

```json
{
  "hint": "Tích phân $\\int_0^1 (2x+1)\\,dx$ — hãy tìm nguyên hàm của $(2x+1)$ trước. Nguyên hàm của $2x$ là $x^2$, của $1$ là $x$. Sau đó thay cận trên và cận dưới để tính kết quả.",
  "difficulty_note": "Dạng tích phân xác định cơ bản — luyện thêm với $\\int_a^b (ax+b)\\,dx$."
}
```

### 5c. POST /math-solve — Oracle JSON Response

```json
{
  "answer": {
    "steps": [
      "Xác định dạng bài: tích phân xác định tuyến tính $\\int_0^2 (3x^2 - 2x + 1)\\,dx$.",
      "Tìm nguyên hàm: $F(x) = x^3 - x^2 + x + C$.",
      "Áp dụng Newton-Leibniz: $F(2) - F(0) = (8 - 4 + 2) - 0 = 6$.",
      "Kết luận: $\\displaystyle\\int_0^2 (3x^2 - 2x + 1)\\,dx = \\boxed{6}$."
    ],
    "confidence": "high",
    "problem_type": "calculus"
  },
  "validation": { "valid": true, "issues": [] },
  "enriched": 2,
  "enriched_topics": ["calculus"],
  "retrieved_ids": ["wiki_calc_integral_01", "wiki_calc_newton_leibniz"],
  "wiki_assisted": true
}
```

### 5d. POST /study-plan — Cached in localStorage

```json
{
  "score_gap": "Cần cải thiện 0.4 điểm nữa để vào Đại học Khoa học Tự nhiên. Tập trung vào Hình học và Tích phân.",
  "focus_areas": [
    {
      "topic": "Hình học không gian",
      "error_pattern": "Sai ở tính thể tích và diện tích xung quanh của khối chóp và khối trụ.",
      "tasks": [
        "Ôn lại công thức V = (1/3) × S × h cho khối chóp đều",
        "Luyện 5 bài tập tính thể tích hình hộp chữ nhật và khối trụ",
        "Thực hành bài toán chứng minh hai mặt phẳng vuông góc"
      ],
      "checkpoint": { "target": 3 }
    },
    {
      "topic": "Tích phân",
      "error_pattern": "Nhầm lẫn giữa tích phân xác định và nguyên hàm — quên thay cận.",
      "tasks": [
        "Luyện ∫_a^b f(x)dx = F(b)−F(a) với 5 ví dụ cơ bản",
        "Thực hành đổi biến u = g(x) trong tích phân",
        "Giải 3 bài tích phân có điều kiện từ đề THPT 2022–2023"
      ],
      "checkpoint": { "target": 3 }
    }
  ]
}
```

---

## 6. Seed Strategy

### localStorage (via `page.addInitScript` — runs before React hydrates)

| Key | Value | Purpose |
|-----|-------|---------|
| `auth_token` | Demo JWT | AuthContext reads on mount; triggers `getMe()` |
| `user` | Demo user JSON | Fallback display before `getMe()` resolves |
| `exam_history` | `[demoResult]` | HistoryContext local-mode seed |
| `ai-analysis-1-result_demo_2024_001` | AI analysis JSON + `_source:"ai"` | Results.jsx cache → skips live `analyzeResultStream()` |
| `recovery-path-data-1-result_demo_2024_001` | Study plan JSON | StudyPlan.jsx reads cache; skips live `generateStudyPlan()` |

**Cache key formats (must match exactly):**
- AI analysis: `ai-analysis-${user.id}-${result.id}`
- Study plan: `recovery-path-data-${uid ?? 'guest'}-${id}`

### Network mocks (via `page.route()`)

| URL Pattern | Method | Response |
|-------------|--------|----------|
| `**/users/me` | GET | Demo user JSON |
| `**/analyze/stream` | POST | NDJSON from §5a (safety net if cache misses) |
| `**/hint` | POST | Hint JSON from §5b (with 800ms simulated delay) |
| `**/math-solve` | POST | Oracle JSON from §5c (with 1500ms simulated delay) |
| `**/study-plan` | POST | Study plan JSON from §5d (safety net) |
| `**/users/me/session/today` | GET | `{ "count": 3 }` |
| `**/users/me/credits/log` | GET | `{ "entries": [] }` |
| `**/users/me/history` | GET | `[demoResult]` |
| `**/users/me/history` | POST | `{ "streak_recovered": false }` |
| `**/wiki/status` | GET | `{ "phase": "ready", "units": 12500 }` |
| `**/math-stats` | GET | topic counts JSON |
| `**/percentile*` | GET | `{ "percentile": 22 }` |
| `**/users/me/adaptive-study-plan` | GET | `{ "focus_concepts": [], "in_progress_count": 0 }` |

### Pre-bundled data (no action needed)

- All 50 THPT 2024 questions in `exam-app/src/data/questions.json` — loaded locally by `loadQuestions()`
- Exam metadata in `exam-app/src/data/exams.json`
- `exam-app/src/data/schools.json` — school fit list

---

## 7. Data Assumptions

1. `questions.json` contains all 50 `q_thpt24_*` IDs at the correct indices
2. `exams.json` `thithu` filter returns `thpt_2024` as the top THPT result when sorted by year descending
3. `subscription_tier: "student"` passes the `isPaidUser` check in Results.jsx
4. `extended_onboarding_done: true` suppresses the ExtendedOnboarding modal (App.jsx line 125 check: `user.grade && !user.extended_onboarding_done`)
5. `confetti` fires when `score >= 7` — score 7.6 satisfies this
6. AI analysis cache key format: `ai-analysis-${user.id}-${result.id}` → `ai-analysis-1-result_demo_2024_001`
7. Study plan cache key format: `recovery-path-data-${uid}-${id}` → `recovery-path-data-1-result_demo_2024_001`
8. Setting `_source: "ai"` and `_streaming_done: true` in the cached analysis tells Results.jsx the analysis is complete and streaming should not restart
9. `POST /hint` deducts 1 Tia via `wrapOptimistic(1, ...)` — credits briefly show 49 before mock responds; this is acceptable for demo purposes
10. `POST /math-solve` uses a 130-second timeout in `slowClient` — the mock responds in 1.5s, well within this
11. "Hà Nội" must be a valid key in `province_patterns.json` for province tips to appear — verify before recording
12. Results navigates to `/results/result_demo_2024_001` — HistoryContext has the demo result in its array (seeded by localStorage `exam_history` key)
