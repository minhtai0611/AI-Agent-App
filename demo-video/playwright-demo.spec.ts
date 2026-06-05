/**
 * playwright-demo.spec.ts
 *
 * Production-quality Playwright automation for the Zenith product demo video.
 * Records all 8 scenes (~84s) at 1920×1080.
 *
 * PRE-REQUISITES:
 *   1. Frontend running at http://localhost:5173  (npm --prefix exam-app run dev)
 *   2. Backend optional — all AI calls are mocked via page.route()
 *   3. npx playwright install chromium   (one-time setup)
 *
 * RUN:
 *   npx playwright test demo-video/playwright-demo.spec.ts \
 *     --config demo-video/playwright.config.demo.js \
 *     --headed --project=chromium
 *
 * CI (production URL):
 *   DEMO_BASE_URL=https://exam-app-ey0.pages.dev \
 *   npx playwright test demo-video/playwright-demo.spec.ts \
 *     --config demo-video/playwright.config.demo.js \
 *     --project=chromium
 *
 * OUTPUTS:
 *   demo-video/screenshots/  — per-scene PNG snapshots (gitignored, uploaded as CI artifact)
 *   test-results/            — Playwright video recording (gitignored)
 */

import { test, expect, Page, Route } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// ─── Configuration ───────────────────────────────────────────────────────────

const BASE_URL = process.env.DEMO_BASE_URL ?? 'http://localhost:5173'
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots')

// ─── Demo Data ───────────────────────────────────────────────────────────────

/**
 * A syntactically valid JWT whose payload decodes to the demo user.
 * exp = 2082715200 → 2036-01-01T00:00:00Z
 *
 * AuthContext.jsx validates only:
 *   (1) base64-decodable JSON middle segment
 *   (2) payload.exp * 1000 > Date.now()
 * The signature is never verified client-side.
 */
const DEMO_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJzdWIiOiIxIiwiZW1haWwiOiJkZW1vQHplbml0aC52biIsImV4cCI6MjA4MjcxNTIwMH0' +
  '.DEMO_SIG_PLACEHOLDER'

const DEMO_USER = {
  id: 1,
  email: 'demo@zenith.vn',
  display_name: 'Nguyễn Minh Tuấn',
  avatar_url:
    'https://ui-avatars.com/api/?name=Nguyen+Minh+Tuan&background=F2A20C&color=000',
  grade: '12',
  province: 'Hà Nội',
  school_type: 'chuyên',
  subscription_tier: 'student',
  subscription_period: 'monthly',
  credits_balance: 50,
  mastery_rank: 'Học sinh',
  solid_concept_count: 18,
  tos_accepted_at: '2025-06-01T00:00:00Z',
  // Prevents ExtendedOnboarding modal from blocking the UI
  extended_onboarding_done: true,
}

/** Pre-fabricated exam result — 38/50 = 7.6/10 */
const DEMO_RESULT = {
  id: 'result_demo_2024_001',
  examId: 'thpt_2024',
  startedAt: '2026-06-05T08:00:00.000Z',
  finishedAt: '2026-06-05T09:15:00.000Z',
  score: 7.6,
  maxScore: 10,
  accuracy: 0.76,
  timeSpent: 4500,
  answeredCount: 50,
  topicBreakdown: {
    functions:     { correct: 7,  total: 8,  accuracy: 0.875  },
    algebra:       { correct: 16, total: 18, accuracy: 0.8889 },
    calculus:      { correct: 4,  total: 7,  accuracy: 0.5714 },
    statistics:    { correct: 2,  total: 3,  accuracy: 0.6667 },
    trigonometry:  { correct: 2,  total: 2,  accuracy: 1.0    },
    geometry:      { correct: 6,  total: 10, accuracy: 0.6    },
    combinatorics: { correct: 1,  total: 2,  accuracy: 0.5    },
  },
  answers: {
    q_thpt24_001: 3, q_thpt24_002: 3, q_thpt24_003: 2, q_thpt24_004: 3,
    q_thpt24_005: 1, q_thpt24_006: 1, q_thpt24_007: 1, q_thpt24_008: 2,
    q_thpt24_009: 2, q_thpt24_010: 1, q_thpt24_011: 2, q_thpt24_012: 1,
    q_thpt24_013: 1, q_thpt24_014: 1, q_thpt24_015: 1, q_thpt24_016: 0,
    q_thpt24_017: 1, q_thpt24_018: 3, q_thpt24_019: 1, q_thpt24_020: 0,
    q_thpt24_021: 2, q_thpt24_022: 2, q_thpt24_023: 3, q_thpt24_024: 0,
    q_thpt24_025: 1, q_thpt24_026: 1, q_thpt24_027: 1, q_thpt24_028: 1,
    q_thpt24_029: 1, q_thpt24_030: 1, q_thpt24_031: 1, q_thpt24_032: 2,
    q_thpt24_033: 1, q_thpt24_034: 1, q_thpt24_035: 2, q_thpt24_036: 2,
    q_thpt24_037: 0, q_thpt24_038: 1, q_thpt24_039: 1, q_thpt24_040: 3,
    q_thpt24_041: 1, q_thpt24_042: 1, q_thpt24_043: 1, q_thpt24_044: 2,
    q_thpt24_045: 1, q_thpt24_046: 1, q_thpt24_047: 1, q_thpt24_048: 2,
    q_thpt24_049: 1, q_thpt24_050: 2,
  },
  timePerQuestion: {},
  questionData: {},
}

/** Pre-built AI analysis — stored in localStorage to skip live streaming */
const DEMO_AI_ANALYSIS = {
  summary:
    'Bạn đạt 7.6 điểm — kết quả khá tốt cho kỳ thi THPT. Điểm mạnh rõ rệt ở Đại số (89%) và Hàm số (88%). Cần tập trung cải thiện Hình học (60%) và Tích phân (57%).',
  weak_topics: ['geometry', 'calculus', 'combinatorics'],
  recommendations: [
    'Ôn luyện thể tích khối chóp và khối trụ — chiếm 40% câu Hình học sai',
    'Luyện tính tích phân bằng phương pháp đổi biến và tích phân từng phần',
    'Xem lại tổ hợp chỉnh hợp: phân biệt có thứ tự / không thứ tự',
  ],
  school_insight:
    'Với 7.6 điểm Toán, bạn có khả năng cao vào Đại học Bách Khoa Hà Nội (ngành Kỹ thuật), Đại học Kinh tế Quốc dân, và Học viện Ngân hàng. Cần thêm 0.4 điểm để đảm bảo cơ hội vào Đại học Khoa học Tự nhiên — Hà Nội.',
  schools: [
    {
      name: 'Đại học Bách Khoa Hà Nội',
      score_range: '7.0 – 8.5',
      type: 'Công lập',
      region_note: 'Hà Nội',
      note: 'Ngành Kỹ thuật Cơ điện tử, Khoa học Máy tính',
    },
    {
      name: 'Đại học Kinh tế Quốc dân',
      score_range: '6.5 – 8.0',
      type: 'Công lập',
      region_note: 'Hà Nội',
      note: 'Ngành Kinh tế, Quản trị Kinh doanh',
    },
    {
      name: 'Học viện Ngân hàng',
      score_range: '6.5 – 7.5',
      type: 'Công lập',
      region_note: 'Hà Nội',
      note: 'Ngành Tài chính - Ngân hàng',
    },
  ],
  // These flags tell Results.jsx the analysis is complete — no live stream needed
  _source: 'ai',
  _streaming_done: true,
}

const DEMO_STUDY_PLAN = {
  score_gap:
    'Cần cải thiện 0.4 điểm nữa để vào Đại học Khoa học Tự nhiên. Tập trung vào Hình học và Tích phân.',
  focus_areas: [
    {
      topic: 'Hình học không gian',
      error_pattern:
        'Sai ở tính thể tích và diện tích xung quanh của khối chóp và khối trụ.',
      tasks: [
        'Ôn lại công thức V = (1/3) × S × h cho khối chóp đều',
        'Luyện 5 bài tập tính thể tích hình hộp chữ nhật và khối trụ',
        'Thực hành bài toán chứng minh hai mặt phẳng vuông góc',
      ],
      checkpoint: { target: 3 },
    },
    {
      topic: 'Tích phân',
      error_pattern:
        'Nhầm lẫn giữa tích phân xác định và nguyên hàm — quên thay cận.',
      tasks: [
        'Luyện ∫_a^b f(x)dx = F(b)−F(a) với 5 ví dụ cơ bản',
        'Thực hành đổi biến u = g(x) trong tích phân',
        'Giải 3 bài tích phân có điều kiện từ đề THPT 2022–2023',
      ],
      checkpoint: { target: 3 },
    },
  ],
}

// Build NDJSON body for /analyze/stream mock
const ANALYZE_NDJSON = [
  { field: 'summary', chunk: 'Bạn đạt 7.6 điểm — kết quả ' },
  { field: 'summary', chunk: 'khá tốt cho kỳ thi THPT. ' },
  { field: 'summary', chunk: 'Điểm mạnh rõ rệt ở Đại số (89%) và Hàm số (88%). ' },
  { field: 'summary', chunk: 'Cần tập trung cải thiện Hình học (60%) và Tích phân (57%).' },
  { field: 'summary', done: true },
  { field: 'weak_topics', chunk: '["geometry","calculus","combinatorics"]' },
  { field: 'weak_topics', done: true },
  { field: 'recommendations', chunk: '["Ôn luyện thể tích khối chóp và khối trụ","Luyện tích phân bằng đổi biến","Xem lại tổ hợp chỉnh hợp"]' },
  { field: 'recommendations', done: true },
  { field: 'school_insight', chunk: 'Với 7.6 điểm Toán, bạn có khả năng cao vào ' },
  { field: 'school_insight', chunk: 'Đại học Bách Khoa Hà Nội, Đại học Kinh tế Quốc dân, và Học viện Ngân hàng.' },
  { field: 'school_insight', done: true },
  { field: 'schools', chunk: '[{"name":"Đại học Bách Khoa Hà Nội","score_range":"7.0 – 8.5","type":"Công lập","region_note":"Hà Nội"},{"name":"Đại học Kinh tế Quốc dân","score_range":"6.5 – 8.0","type":"Công lập","region_note":"Hà Nội"},{"name":"Học viện Ngân hàng","score_range":"6.5 – 7.5","type":"Công lập","region_note":"Hà Nội"}]' },
  { field: 'schools', done: true },
].map((o) => JSON.stringify(o)).join('\n')

// ─── Helper Functions ────────────────────────────────────────────────────────

/** Types text at human speed (60–120ms per character) */
async function humanType(page: Page, selector: string, text: string) {
  const el = page.locator(selector)
  await el.click()
  for (const char of text) {
    await el.type(char)
    await page.waitForTimeout(60 + Math.floor(Math.random() * 60))
  }
}

/**
 * Scrolls smoothly over `duration` ms by `distance` pixels.
 * Simulates a human reading pace rather than an instant jump.
 */
async function scrollSlowly(page: Page, distance = 400, duration = 1200) {
  const steps = 20
  const stepSize = distance / steps
  const delay = duration / steps
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, stepSize)
    await page.waitForTimeout(delay)
  }
}

/**
 * Waits until a text node stops growing (streaming complete).
 * Polls the element's textContent every 300ms; resolves when content
 * has been stable for two consecutive ticks (≥600ms unchanged).
 */
async function waitForStreamingComplete(
  page: Page,
  selector: string,
  timeoutMs = 15_000
) {
  const start = Date.now()
  let prev = ''
  let stableCount = 0
  while (Date.now() - start < timeoutMs) {
    const current = (await page.locator(selector).textContent().catch(() => '')) ?? ''
    if (current === prev && current !== '') {
      if (++stableCount >= 2) return
    } else {
      stableCount = 0
    }
    prev = current
    await page.waitForTimeout(300)
  }
  console.warn(`[waitForStreamingComplete] timed out after ${timeoutMs}ms on ${selector}`)
}

/** Takes a screenshot and saves to demo-video/screenshots/ */
async function shot(page: Page, name: string) {
  const filepath = path.join(SCREENSHOTS_DIR, `${name}.png`)
  await page.screenshot({ path: filepath, fullPage: false })
}

// ─── Route Mocks ─────────────────────────────────────────────────────────────

/**
 * Registers all network mocks. Must be called before page.goto()
 * so auth mock intercepts the initial getMe() fetch on mount.
 */
async function setupMocks(page: Page) {
  // GET /users/me — returns demo user; prevents real JWT validation
  await page.route('**/users/me', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DEMO_USER) })
    } else {
      await route.continue()
    }
  })

  // POST /analyze/stream — NDJSON safety net (localStorage cache takes priority)
  await page.route('**/analyze/stream', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: ANALYZE_NDJSON })
  })

  // POST /hint — simulated 800ms latency so loading spinner is visible
  await page.route('**/hint', async (route: Route) => {
    await page.waitForTimeout(800)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        hint: 'Tích phân $\\int_0^1 (2x+1)\\,dx$ — tìm nguyên hàm của $(2x+1)$ trước. Nguyên hàm của $2x$ là $x^2$, của $1$ là $x$. Sau đó thay cận trên và cận dưới.',
        difficulty_note: 'Dạng tích phân xác định cơ bản — luyện thêm với $\\int_a^b (ax+b)\\,dx$.',
      }),
    })
  })

  // POST /math-solve — simulated 1.5s Oracle "thinking" delay
  await page.route('**/math-solve', async (route: Route) => {
    await page.waitForTimeout(1500)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        answer: {
          steps: [
            'Xác định dạng bài: tích phân xác định tuyến tính $\\int_0^2 (3x^2 - 2x + 1)\\,dx$.',
            'Tìm nguyên hàm: $F(x) = x^3 - x^2 + x + C$.',
            'Áp dụng Newton-Leibniz: $F(2) - F(0) = (8 - 4 + 2) - 0 = 6$.',
            'Kết luận: $\\displaystyle\\int_0^2 (3x^2 - 2x + 1)\\,dx = \\boxed{6}$.',
          ],
          confidence: 'high',
          problem_type: 'calculus',
        },
        validation: { valid: true, issues: [] },
        enriched: 2,
        enriched_topics: ['calculus'],
        retrieved_ids: ['wiki_calc_integral_01', 'wiki_calc_newton_leibniz'],
        wiki_assisted: true,
      }),
    })
  })

  // POST /study-plan — safety net if localStorage cache key misses
  await page.route('**/study-plan', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DEMO_STUDY_PLAN) })
  })

  // Utility stubs to prevent null errors in Account and Oracle pages
  await page.route('**/users/me/session/today', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 3 }) })
  })
  await page.route('**/users/me/credits/log', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })
  await page.route('**/users/me/history', async (route: Route) => {
    const method = route.request().method()
    if (method === 'GET') {
      // HistoryContext maps server shape: { result_id, exam_id, score, created_at, payload }
      // getAccessibleExamIds needs the full chain (thpt_2020..thpt_2024) passed ≥ 5.0
      // to unlock thpt_2024. Include all 12 chain exams as past results.
      const chainExams = [
        'thpt_2020', 'thpt_2021', 'thpt_2022', 'intl_amc12_2022', 'intl_amc10a_2022',
        'intl_amc10_2023', 'thpt_2023', 'intl_ib_sl_2023', 'intl_ksat_2023',
        'intl_act_math_2023', 'intl_hsc_adv_2023',
      ]
      const dummy = chainExams.map((examId, i) => ({
        result_id: `result_chain_${i}`,
        exam_id: examId,
        score: 7.0,
        created_at: `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
        payload: JSON.stringify({ finishedAt: `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`, answers: {} }),
      }))
      const serverHistory = [
        ...dummy,
        {
          result_id: DEMO_RESULT.id,
          exam_id: DEMO_RESULT.examId,
          score: DEMO_RESULT.score,
          created_at: DEMO_RESULT.finishedAt,
          payload: JSON.stringify(DEMO_RESULT),
        },
      ]
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(serverHistory) })
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ streak_recovered: false }) })
    }
  })
  await page.route('**/wiki/status', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ phase: 'ready', units: 12500 }) })
  })
  await page.route('**/math-stats', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ wiki_units: 12500, problems: 3200, topics: { calculus: 820, algebra: 1100, geometry: 680 } }) })
  })
  await page.route('**/percentile*', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ percentile: 22 }) })
  })
  await page.route('**/users/me/adaptive-study-plan', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ focus_concepts: [], in_progress_count: 0 }) })
  })
  await page.route('**/users/me/grade-change-request', async (route: Route) => {
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not found' }) })
  })
  await page.route('**/users/me/referral', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: null, referred_count: 0 }) })
  })
  await page.route('**/insights/simulation-brief', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ brief: null }) })
  })
}

// ─── localStorage Init Script ─────────────────────────────────────────────────

/**
 * Returns an IIFE string that seeds localStorage before React hydrates.
 * Inlined as a string (not a function closure) because addInitScript
 * serializes this to the browser context where TypeScript constants are unavailable.
 */
function buildInitScript(demoUser: object, demoResult: object, demoAnalysis: object, demoStudyPlan: object, jwt: string): string {
  const userId = (demoUser as { id: number }).id
  const resultId = (demoResult as { id: string }).id

  return `(function() {
    localStorage.setItem('auth_token', ${JSON.stringify(jwt)});
    localStorage.setItem('user', ${JSON.stringify(JSON.stringify(demoUser))});
    localStorage.setItem('exam_history', ${JSON.stringify(JSON.stringify([demoResult]))});

    // AI analysis cache key: "ai-analysis-{userId}-{resultId}"
    var analysisKey = 'ai-analysis-${userId}-${resultId}';
    localStorage.setItem(analysisKey, ${JSON.stringify(JSON.stringify({ data: demoAnalysis, ts: Date.now() }))});

    // Study plan cache key: "recovery-path-data-{userId}-{resultId}"
    var planKey = 'recovery-path-data-${userId}-${resultId}';
    localStorage.setItem(planKey, ${JSON.stringify(JSON.stringify(demoStudyPlan))});

    // Suppress "resume draft?" session banner
    sessionStorage.clear();

    // Suppress guest trial flag
    localStorage.removeItem('guest_trial_used');
  })();`
}

// ─── Pre-test Validation ─────────────────────────────────────────────────────

/**
 * Validates that required question IDs exist in the bundled questions.json.
 * Fails fast with a clear message if any ID is missing — prevents silent demo breakage
 * when question IDs are renamed or reshuffled between versions.
 */
test.beforeAll(async () => {
  const questionsPath = path.join(__dirname, '..', 'exam-app', 'src', 'data', 'questions.json')
  if (!fs.existsSync(questionsPath)) {
    console.warn('[demo] questions.json not found at expected path — skipping ID validation')
    return
  }
  const questions: Array<{ id: string }> = JSON.parse(fs.readFileSync(questionsPath, 'utf-8'))
  const ids = new Set(questions.map((q) => q.id))
  const required = ['q_thpt24_001', 'q_thpt24_010', 'q_thpt24_020', 'q_thpt24_030', 'q_thpt24_050']
  const missing = required.filter((id) => !ids.has(id))
  if (missing.length > 0) {
    throw new Error(
      `[demo] Required question IDs not found in questions.json: ${missing.join(', ')}\n` +
      'The pre-fabricated exam result will break. Update demo-data-plan.md with the correct IDs.'
    )
  }
  console.log('[demo] Question ID validation passed ✓')

  // Ensure screenshots directory exists
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  }
})

// ─── Main Test ───────────────────────────────────────────────────────────────

test.use({
  viewport: { width: 1920, height: 1080 },
  colorScheme: 'dark',
})

test('Zenith product demo — 8 scenes', async ({ page }) => {
  // Capture network and console events for diagnostics
  page.on('request', req => {
    if (req.url().includes('localhost:8000')) {
      console.log(`[net] REQ ${req.method()} ${req.url()}`)
    }
  })
  page.on('response', res => {
    if (res.url().includes('localhost:8000')) {
      console.log(`[net] RES ${res.status()} ${res.url()}`)
    }
  })
  page.on('requestfailed', req => {
    if (req.url().includes('localhost:8000')) {
      console.log(`[net] FAIL ${req.url()} — ${req.failure()?.errorText}`)
    }
  })
  page.on('pageerror', err => console.log(`[pageerror] ${err.message}`))

  // Seed localStorage before any page script runs
  await page.addInitScript(
    buildInitScript(DEMO_USER, DEMO_RESULT, DEMO_AI_ANALYSIS, DEMO_STUDY_PLAN, DEMO_JWT)
  )

  // Register all route mocks before goto()
  await setupMocks(page)

  // ── Scene 1: Landing — Hero + Feature Carousel (0:00–0:08) ───────────────

  await test.step('Scene 1: Landing — hero load + feature carousel', async () => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })

    // Give React time to mount and resolve getMe()
    await page.waitForTimeout(3000)

    // Dump page state for diagnostics
    const h1Count = await page.evaluate(() => document.querySelectorAll('h1').length)
    const bodySnippet = await page.evaluate(() => document.body.innerText.slice(0, 150))
    const authToken = await page.evaluate(() => localStorage.getItem('auth_token')?.slice(0, 20))
    console.log(`[diag] h1s: ${h1Count}, auth: ${authToken}, body: ${bodySnippet.replace(/\n/g, '|')}`)

    // Wait for hero headline (h1 with Fraunces font — unique on landing)
    await page.getByRole('heading', { level: 1 }).first().waitFor({ state: 'visible' })

    // Let entrance stagger animation complete (350ms stagger × ~6 words ≈ 2.1s)
    await page.waitForTimeout(2500)

    await shot(page, '01-landing-hero')

    // Feature carousel auto-cycles every ~4s — wait for one full cycle
    await page.waitForTimeout(4000)

    await shot(page, '01-landing-carousel')
  })

  // ── Scene 2: Exam Select → Preview → Start (0:08–0:17) ──────────────────

  await test.step('Scene 2: ExamSelect — filter, preview, start', async () => {
    await page.goto(`${BASE_URL}/exams`)

    // Verify auth — display name should appear in Navbar
    await page.getByText('Nguyễn Minh Tuấn', { exact: false }).first().waitFor({
      state: 'visible',
      timeout: 8000,
    })

    // Verify no blocking onboarding modal (grade:'12' + extended_onboarding_done:true)
    await expect(page.locator('text=Hoàn thiện hồ sơ')).toHaveCount(0)

    // Wait for exam cards AND history to load (history unlocks the access chain)
    // thpt_2024 is at chain index 11 — HistoryContext must load from /history first
    await page.waitForTimeout(3000)

    await shot(page, '02-exam-select-grid')

    // Type in search to filter to THPT 2024 Quốc gia specifically
    const searchInput = page.getByPlaceholder('Tìm đề thi...')
    await searchInput.waitFor({ state: 'visible' })
    await humanType(page, '[placeholder="Tìm đề thi..."]', 'THPT Quốc gia 2024')
    await page.waitForTimeout(800)

    await shot(page, '02-exam-select-filtered')

    // Find the accessible "Bắt đầu" button on the THPT 2024 card
    // After chain history loads, thpt_2024 is unlocked and shows the Bắt đầu button
    const examTitle = page.getByText('Đề thi THPT Quốc gia 2024', { exact: false }).first()
    await examTitle.waitFor({ state: 'visible', timeout: 8000 })

    // The accessible exam card has a "Bắt đầu" outline button (not "Bắt đầu thi")
    // Locate the button in the same section row
    const cardRow = examTitle.locator('xpath=ancestor::div[@class and contains(@class,"flex")]').nth(1)
    const openPreviewBtn = cardRow.getByRole('button', { name: 'Bắt đầu' }).first()
    if (await openPreviewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await openPreviewBtn.click()
    } else {
      // Fallback: click the title itself — some card layouts use title as the trigger
      await examTitle.click()
    }

    // Preview modal
    const startExamBtn = page.getByRole('button', { name: 'Bắt đầu thi' })
    await startExamBtn.waitFor({ state: 'visible', timeout: 8000 })
    await page.waitForTimeout(600) // let modal animation settle

    await shot(page, '02-exam-preview-modal')

    await startExamBtn.click()

    // TestInterface mounts — wait for question counter
    await page.getByText('Câu 1', { exact: false }).waitFor({ state: 'visible', timeout: 10000 })

    await shot(page, '02-test-started')
  })

  // ── Scene 3: TestInterface — Exam + Hint (0:17–0:29) ─────────────────────

  await test.step('Scene 3: TestInterface — keyboard shortcuts + progress', async () => {
    // Timed mode exam is now active (started in Scene 2)

    // Show Q1 briefly before answering
    await page.waitForTimeout(1200)
    await shot(page, '03-q1-unanswered')

    // Answer Q1 with keyboard shortcut B (index 1)
    // TestInterface.jsx keyboard handler maps 'b'|'B' → choiceIndex 1
    await page.keyboard.press('b')
    await page.waitForTimeout(800)
    await shot(page, '03-q1-answered')

    // Navigate to Q2 with arrow key, answer C
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(500)
    await page.keyboard.press('c')
    await page.waitForTimeout(700)

    // Navigate to Q3, answer A
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(500)
    await page.keyboard.press('a')
    await page.waitForTimeout(600)

    // Navigate to Q4 to show progress dots
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(500)
    await shot(page, '03-q4-progress')

    // Navigate to Q5
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(500)
    await page.keyboard.press('b')
    await page.waitForTimeout(700)
    await shot(page, '03-q5-answered')

    // Pause on the test interface to show the full UI (timer, dots, answer choices)
    await page.waitForTimeout(1500)
  })

  // ── Scene 4: Results — Score + Confetti + AI + Schools (0:29–0:47) ────────

  await test.step('Scene 4: Results — score CountUp + confetti + streaming AI + school cards', async () => {
    // Navigate directly to the pre-seeded result
    // HistoryContext has DEMO_RESULT (seeded by exam_history key)
    await page.goto(`${BASE_URL}/results/result_demo_2024_001`)

    // Wait for the score label (Results.jsx renders "Khá giỏi" for score ≥ 6.5)
    await page.getByText('Khá giỏi').waitFor({ state: 'visible', timeout: 8000 })
    await page.waitForTimeout(500)

    // CountUp animation runs ~1.8s — let it complete before screenshotting
    await page.waitForTimeout(2000)

    // Confetti fires when score ≥ 7.0 — score 7.6 triggers it (~1.9s after mount)
    // Give it an extra second to be visible in the screenshot
    await page.waitForTimeout(1000)

    await shot(page, '04-score-confetti')

    // Scroll to AI analysis section
    await scrollSlowly(page, 400, 2000)

    // AI analysis is pre-cached in localStorage — renders immediately with animation
    const analysisSection = page.getByText('Phân tích AI').first()
    await analysisSection.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null)

    await shot(page, '04-ai-analysis')
    await page.waitForTimeout(800)

    // Scroll back up slightly to show the radar chart
    await scrollSlowly(page, -200, 1000)
    const radarSection = page.getByText('Hồ sơ năng lực').first()
    await radarSection.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null)

    await shot(page, '04-radar-chart')
    await page.waitForTimeout(600)

    // Switch to school recommendations tab
    const schoolTab = page.getByRole('button', { name: /Trường phù hợp/ })
    if (await schoolTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await schoolTab.click()
      await page.waitForTimeout(800)

      // School cards — grade:12 shows university suggestions
      await page.getByText('Đại học Bách Khoa Hà Nội', { exact: false }).first()
        .waitFor({ state: 'visible', timeout: 5000 }).catch(() => null)

      await shot(page, '04-school-cards')
    } else {
      // School cards may be in a different section on this version
      await scrollSlowly(page, 300, 1500)
      await shot(page, '04-school-section')
    }

    await page.waitForTimeout(1000)
  })

  // ── Scene 5: Oracle AI — Streaming Solution (0:47–0:59) ──────────────────

  await test.step('Scene 5: Oracle — type calculus problem, streaming solution', async () => {
    await page.goto(`${BASE_URL}/oracle`)

    // Wait for Oracle page heading
    await page.locator('h1, h2').filter({ hasText: /Oracle|Toán/ }).first()
      .waitFor({ state: 'visible', timeout: 8000 })
    await page.waitForTimeout(800)

    await shot(page, '05-oracle-ready')

    // The textarea — identified by oracle-textarea class or placeholder
    const textarea = page.locator('textarea').first()
    await textarea.waitFor({ state: 'visible', timeout: 5000 })

    await humanType(page, 'textarea', 'Tính tích phân ∫₀² (3x² - 2x + 1) dx')

    await page.waitForTimeout(600)
    await shot(page, '05-oracle-typed')

    // Submit — Ctrl+Enter is the keyboard shortcut
    await page.keyboard.press('Control+Enter')

    // Oracle enters "thinking" state
    await page.waitForTimeout(600)
    await shot(page, '05-oracle-loading')

    // Mock responds after 1.5s — wait for first step text
    await page.getByText('Xác định dạng bài', { exact: false }).first()
      .waitFor({ state: 'visible', timeout: 8000 })

    await shot(page, '05-oracle-step1')
    await page.waitForTimeout(800)

    // Click "Tiếp theo →" if available to reveal subsequent steps
    const nextBtn = page.getByRole('button', { name: /Tiếp theo/ })
    if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nextBtn.click()
      await page.waitForTimeout(600)
      await shot(page, '05-oracle-step2')

      if (await nextBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await nextBtn.click()
        await page.waitForTimeout(600)
        await shot(page, '05-oracle-step3')
      }
    }

    // Scroll to show the final boxed answer
    await scrollSlowly(page, 250, 1000)
    await page.waitForTimeout(600)

    await shot(page, '05-oracle-complete')
  })

  // ── Scene 6: Study Plan — Recovery Path + Checkpoint (0:59–1:09) ─────────

  await test.step('Scene 6: Study Plan — focus areas + checkpoint bar', async () => {
    await page.goto(`${BASE_URL}/study-plan/result_demo_2024_001`)

    // Study plan reads from localStorage cache — no API call needed
    await page.getByText('Kế hoạch', { exact: false }).first()
      .waitFor({ state: 'visible', timeout: 8000 })
    await page.waitForTimeout(600)

    // Score gap / goal section
    const goalText = page.getByText('Cần cải thiện', { exact: false }).first()
    await goalText.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null)

    await shot(page, '06-study-plan-goal')
    await page.waitForTimeout(600)

    // First FocusCard — "Hình học không gian" (auto-expanded at index 0)
    const focusCard1 = page.getByText('Hình học không gian', { exact: false }).first()
    await focusCard1.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null)

    await shot(page, '06-focus-card-open')

    // Scroll to checkpoint bar
    await scrollSlowly(page, 200, 1000)
    const checkpoint = page.getByText('Checkpoint', { exact: false }).first()
    await checkpoint.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null)

    // Hold on checkpoint bar so the 2/3 fill animation is visible
    await page.waitForTimeout(2000)
    await shot(page, '06-checkpoint-bar')

    // Click second FocusCard to demonstrate expandable mechanic
    const focusCard2 = page.getByText('Tích phân', { exact: false }).first()
    if (await focusCard2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await focusCard2.click()
      await page.waitForTimeout(600)
      await shot(page, '06-focus-card-2')
    }
  })

  // ── Scene 7: Account — Mastery Rank + Pricing (1:09–1:20) ────────────────

  await test.step('Scene 7: Account — credit gauge, mastery rank, pricing table', async () => {
    await page.goto(`${BASE_URL}/account`)

    // Wait for page to load — credit balance appears in header
    await page.waitForTimeout(1500)

    // Credits balance "50" visible
    const creditsText = page.getByText('50', { exact: false }).first()
    await creditsText.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null)

    await shot(page, '07-account-credits')
    await page.waitForTimeout(600)

    // Mastery rank badge — "Học sinh" visible
    const rankBadge = page.getByText('Học sinh', { exact: false }).first()
    await rankBadge.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null)

    await shot(page, '07-mastery-rank')
    await page.waitForTimeout(400)

    // Scroll to pricing section
    await scrollSlowly(page, 700, 2500)

    // Pricing table — look for tier names
    const completeTier = page.getByText('Toàn diện').first()
    await completeTier.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null)

    await shot(page, '07-pricing-table')
    await page.waitForTimeout(600)

    // "PHỔ BIẾN" badge on the Student plan — most visually distinctive element
    const popularBadge = page.getByText('PHỔ BIẾN', { exact: false }).first()
    if (await popularBadge.isVisible({ timeout: 3000 }).catch(() => false)) {
      await shot(page, '07-popular-badge')
    }

    // Final frame — hold on pricing for the CTA
    await page.waitForTimeout(1500)
    await shot(page, '07-final-frame')
  })
})
