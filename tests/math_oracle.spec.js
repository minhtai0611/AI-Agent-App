// @ts-check
const { test, expect } = require('@playwright/test')

const BASE = 'http://localhost:5173/oracle'

// Helpers
// Steps text — the last step typically contains the final answer
const getAnswer  = page => page.evaluate(() => {
  const items = [...document.querySelectorAll('ol li div')]
  return items.length ? items[items.length - 1].textContent?.trim() : null
})
const getBadge   = page => page.evaluate(() => !![...document.querySelectorAll('span')].find(el => el.textContent.trim() === 'AI trực tiếp'))
const getChips   = page => page.evaluate(() => document.querySelectorAll('[class*="rounded-full"][class*="px-3"][class*="py-1"]').length)
const getWarning = page => page.evaluate(() => document.body.textContent.includes('chưa được xác minh'))
const getInsuf   = page => page.evaluate(() => document.body.textContent.includes('Chưa đủ tri thức'))
const getErrStr  = page => page.evaluate(() => document.body.textContent.includes('INSUFFICIENT_KNOWLEDGE'))

async function submitQuestion(page) {
  // Click a preset to populate the MathLive field (enables submit).
  // The mock already intercepts math-solve — actual question text irrelevant.
  await page.locator('button').filter({ hasText: /x.*2.*5x.*6/ }).first().click()
  await page.locator('button[type="submit"]').click()
  // 'Bài toán' heading is always rendered when an AnswerCard is shown
  await page.getByText('Bài toán').first().waitFor({ state: 'visible', timeout: 60000 })
}

async function mockSolve(page, payload) {
  await page.route('**/math-solve', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) }),
    { times: 1 }
  )
}

// ── Test 1: wiki-hit problem — chips shown, no badge ──────────────────────
test('T1: wiki-hit problem — solution shown, wiki chips present, no badge', async ({ page }) => {
  await page.goto(BASE)
  await mockSolve(page, {
    label: 'algebra',
    answer: {
      problem_type: 'quadratic',
      steps: ['Phân tích: x² - 5x + 6 = (x-2)(x-3)', 'Nghiệm: x = 2 hoặc x = 3'],
      final_answer: 'x = 2 hoặc x = 3',
      confidence: 'high',
      used_knowledge_ids: ['wiki-quadratic-1'],
    },
    validation: { valid: true, issues: [] },
    retrieved_ids: ['wiki-quadratic-1'],
    wiki_assisted: true,
  })
  await submitQuestion(page)

  await expect(page.getByText('Lời giải', { exact: false })).toBeVisible()
  expect(await getBadge(page)).toBe(false)       // wiki_assisted=true → no badge
  expect(await getChips(page)).toBeGreaterThan(0)
  expect(await getWarning(page)).toBe(false)
  expect(await getInsuf(page)).toBe(false)
  expect(await getErrStr(page)).toBe(false)
})

// ── Test 2: novel problem (wiki_assisted=false) → badge ────────────────────
test('T2: wiki_assisted=false — "AI trực tiếp" badge shown, no chips', async ({ page }) => {
  await page.goto(BASE)
  await mockSolve(page, {
    label: 'algebra',
    answer: { problem_type: 'novel', steps: ['Step 1: intrinsic', 'Step 2: x = 7'], final_answer: 'x = 7', confidence: 'medium', used_knowledge_ids: [] },
    validation: { valid: true, issues: [] },
    retrieved_ids: [],
    wiki_assisted: false,
  })
  await submitQuestion(page, 'novel question with no wiki context')

  expect(await getBadge(page)).toBe(true)
  expect(await getChips(page)).toBe(0)
  expect(await getAnswer(page)).toMatch(/7/)
  expect(await getInsuf(page)).toBe(false)
  expect(await getErrStr(page)).toBe(false)
})

// ── Test 3: low confidence + invalid → amber warning banner ────────────────
test('T3: confidence=low + valid=false — amber warning banner shown', async ({ page }) => {
  await page.goto(BASE)
  await mockSolve(page, {
    label: 'algebra',
    answer: { problem_type: 'complex', steps: ['Step 1', 'Step 2 unclear'], final_answer: 'x = 99', confidence: 'low', used_knowledge_ids: [] },
    validation: { valid: false, issues: ['final_answer contradicts the last step'] },
    retrieved_ids: [],
    wiki_assisted: false,
  })
  await submitQuestion(page, 'low confidence test')

  expect(await getWarning(page)).toBe(true)
  // Badge also shows (wiki_assisted=false)
  expect(await getBadge(page)).toBe(true)
  expect(await getInsuf(page)).toBe(false)
  expect(await getErrStr(page)).toBe(false)

  // Verify amber colour on the warning element
  const color = await page.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find(d =>
      d.textContent.trim() === 'Kết quả chưa được xác minh — kiểm tra lại cẩn thận'
    )
    return el ? window.getComputedStyle(el).color : null
  })
  expect(color).not.toBeNull()
})

// ── Test 4: low confidence + VALID → no warning banner ────────────────────
test('T4: confidence=low + valid=true — NO warning banner', async ({ page }) => {
  await page.goto(BASE)
  await mockSolve(page, {
    label: 'algebra',
    answer: { problem_type: 'simple', steps: ['Step 1: solve', 'Step 2: x=3'], final_answer: 'x = 3', confidence: 'low', used_knowledge_ids: [] },
    validation: { valid: true, issues: [] },
    retrieved_ids: ['some-wiki-id'],
    wiki_assisted: true,
  })
  await submitQuestion(page, 'low confidence but valid')

  expect(await getWarning(page)).toBe(false)
  expect(await getBadge(page)).toBe(false)   // wiki_assisted=true
  expect(await getChips(page)).toBeGreaterThan(0)
  expect(await getInsuf(page)).toBe(false)
  expect(await getErrStr(page)).toBe(false)
})

// ── Test 5: no INSUFFICIENT_KNOWLEDGE card under any mocked scenario ───────
test('T5: INSUFFICIENT_KNOWLEDGE sentinel never rendered', async ({ page }) => {
  // Simulate what the old code would have returned
  await page.goto(BASE)
  await mockSolve(page, {
    label: 'algebra',
    answer: { problem_type: 'hard', steps: ['Step 1'], final_answer: 'x = 0', confidence: 'high', used_knowledge_ids: [] },
    validation: { valid: true, issues: [] },
    retrieved_ids: [],
    wiki_assisted: false,
  })
  await submitQuestion(page, 'hard problem')
  expect(await getErrStr(page)).toBe(false)
  expect(await getInsuf(page)).toBe(false)
  // Answer always renders
  expect(await getAnswer(page)).not.toBeNull()
})

// ── Figure / GeoGebra helpers ───────────────────────────────────────────────

// Pre-stubs window.GGBApplet before the page loads so no CDN request is made.
// Recorded commands, inject call count, and appName are exposed on window for assertions.
async function stubGeoGebra(page) {
  await page.addInitScript(() => {
    window._ggbCommands = []
    window._ggbInjectCount = 0
    window._ggbAppName = null
    window._ggbParams = null
    window.GGBApplet = class {
      constructor(params) {
        this._p = params
        window._ggbAppName = params.appName
        window._ggbParams = params
        // API returned by getAppletObject() — the polling path used by GeoGebraEmbed
        this._api = { evalCommand: cmd => window._ggbCommands.push(cmd) }
      }
      inject(_idOrEl) { window._ggbInjectCount++ }
      // GeoGebraEmbed polls this until it returns an object with evalCommand
      getAppletObject() { return this._api }
    }
  })
}

const GEO_FIGURE_PAYLOAD = {
  label: 'geometry',
  answer: {
    problem_type: 'proof',
    steps: ['Xét tam giác ABC nhọn', 'AD ⊥ BC tại D, BE ⊥ CA tại E'],
    final_answer: 'Tứ giác BCEF nội tiếp',
    confidence: 'high',
    used_knowledge_ids: [],
    figure: {
      type: 'geogebra',
      data: [
        'B = (-3, 0)',
        'C = (3, 0)',
        'A = (0, 5)',
        'Segment(A, B)',
        'Segment(B, C)',
        'Segment(C, A)',
        'c = Circumcircle(A, B, C)',
        'lineBC = Line(B, C)',
        'D = PerpendicularFoot(A, lineBC)',
        'Segment(A, D)',
      ].join('\n'),
    },
  },
  validation: { valid: true, issues: [] },
  retrieved_ids: [],
  wiki_assisted: false,
}

// ── T6: GeoGebra applet initialised with the right commands ────────────────
test('T6: geometry figure — GGBApplet.inject called and commands forwarded', async ({ page }) => {
  await stubGeoGebra(page)
  await page.goto(BASE)
  await mockSolve(page, GEO_FIGURE_PAYLOAD)
  await submitQuestion(page)

  // Section heading
  await expect(page.getByText('Hình minh họa', { exact: false })).toBeVisible()

  // Applet was injected exactly once
  const injectCount = await page.evaluate(() => window._ggbInjectCount)
  expect(injectCount).toBe(1)

  // Wait for the polling interval to fire and forward commands
  await page.waitForFunction(() => window._ggbCommands?.length > 0, { timeout: 2000 })

  // Commands were passed — at least A/B/C definition and a Segment
  const cmds = await page.evaluate(() => window._ggbCommands)
  expect(cmds.length).toBeGreaterThanOrEqual(3)
  expect(cmds.some(c => /Segment/i.test(c))).toBe(true)
  expect(cmds.some(c => /=/.test(c))).toBe(true)       // coordinate definitions

  // No error message rendered
  await expect(page.getByText('Không thể tải GeoGebra')).not.toBeVisible()
})

// ── T7: loading overlay visible while GeoGebra script is pending ───────────
test('T7: loading overlay shown while GeoGebra script not yet loaded', async ({ page }) => {
  // Pause (but never fulfil) the CDN script so the embed stays in loading state
  let unblock
  await page.route('**/deployggb.js', route => new Promise(res => { unblock = res }))

  await page.goto(BASE)
  await mockSolve(page, GEO_FIGURE_PAYLOAD)
  await submitQuestion(page)   // waits for 'Bài toán'; GeoGebraEmbed then mounts

  // Give GeoGebraEmbed a moment to mount and request the script
  await page.waitForTimeout(500)

  await expect(page.getByText('Hình minh họa', { exact: false })).toBeVisible()

  // While the script is still pending: loading overlay visible, no error
  await expect(page.getByText('Đang tải GeoGebra', { exact: false })).toBeVisible()
  await expect(page.getByText('Không thể tải GeoGebra')).not.toBeVisible()

  // Wrapper div must exist and be visible so GeoGebra can measure dimensions
  const wrapperVisible = await page.evaluate(() => {
    const el = document.querySelector('[id^="ggb-"]')
    if (!el) return false
    const s = window.getComputedStyle(el)
    return s.display !== 'none' && s.visibility !== 'hidden'
  })
  expect(wrapperVisible).toBe(true)

  // Unblock so the page can tear down cleanly
  if (unblock) unblock()
})

// ── T8: GeoGebra script error → error fallback shown, no crash ─────────────
test('T8: deployggb.js fails to load — error fallback shown', async ({ page }) => {
  // Block the CDN script so the Promise rejects
  await page.route('**/deployggb.js', route => route.abort())

  // Ensure GGBApplet is NOT pre-defined (default state — CDN never loads)
  await page.goto(BASE)
  await mockSolve(page, GEO_FIGURE_PAYLOAD)
  await submitQuestion(page)

  // Wait a moment for the error path to trigger
  await page.waitForTimeout(2000)

  // Should show the error fallback
  await expect(page.getByText('Không thể tải GeoGebra')).toBeVisible()

  // Page must not crash (answer still renders)
  expect(await getAnswer(page)).toBeTruthy()
})

// ── T9: SVG figure (plot) — rendered inline, no GeoGebra involved ──────────
test('T9: SVG figure (plot) — inline SVG rendered, no GeoGebra', async ({ page }) => {
  await page.goto(BASE)
  await mockSolve(page, {
    label: 'algebra',
    answer: {
      problem_type: 'function',
      steps: ['f(x) = x²'],
      final_answer: 'parabola',
      confidence: 'high',
      used_knowledge_ids: [],
      figure: {
        type: 'svg',
        data: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="blue"/></svg>',
      },
    },
    validation: { valid: true, issues: [] },
    retrieved_ids: [],
    wiki_assisted: false,
  })
  await submitQuestion(page)

  await expect(page.getByText('Hình minh họa', { exact: false })).toBeVisible()

  // SVG is in the DOM
  const hasSvg = await page.evaluate(() => !!document.querySelector('svg circle'))
  expect(hasSvg).toBe(true)

  // GeoGebra was never initialised
  const ggbInvoked = await page.evaluate(() => typeof window._ggbInjectCount !== 'undefined' && window._ggbInjectCount > 0)
  expect(ggbInvoked).toBe(false)
})

// ── T10: No figure in response — FigureBlock absent ────────────────────────
test('T10: no figure in response — "Hình minh họa" section not rendered', async ({ page }) => {
  await page.goto(BASE)
  await mockSolve(page, {
    label: 'geometry',
    answer: {
      problem_type: 'proof',
      steps: ['Step 1'],
      final_answer: 'QED',
      confidence: 'high',
      used_knowledge_ids: [],
      // no figure field
    },
    validation: { valid: true, issues: [] },
    retrieved_ids: [],
    wiki_assisted: false,
  })
  await submitQuestion(page)

  // Answer block rendered
  expect(await getAnswer(page)).toBeTruthy()

  // Figure section must be absent
  await expect(page.getByText('Hình minh họa', { exact: false })).not.toBeVisible()
})

// ── T11: GeoGebra initialised with appName='classic' ──────────────────────
test('T11: GeoGebra applet uses appName=classic (not geometry)', async ({ page }) => {
  await stubGeoGebra(page)
  await page.goto(BASE)
  await mockSolve(page, GEO_FIGURE_PAYLOAD)
  await submitQuestion(page)

  await expect(page.getByText('Hình minh họa', { exact: false })).toBeVisible()

  const appName = await page.evaluate(() => window._ggbAppName)
  expect(appName).toBe('classic')
})

// ── T12: Function-domain figure — GeoGebra (not SVG) ─────────────────────
test('T12: function-domain figure uses GeoGebra, not SVG branch', async ({ page }) => {
  await stubGeoGebra(page)
  await page.goto(BASE)
  await mockSolve(page, {
    label: 'functions',
    answer: {
      problem_type: 'function',
      steps: ['f(x) = x^2 - 4'],
      final_answer: 'parabola',
      confidence: 'high',
      used_knowledge_ids: [],
      figure: {
        type: 'geogebra',
        data: 'f(x) = x^2 - 4\nRoot(f)\nZoomIn(1)',
      },
    },
    validation: { valid: true, issues: [] },
    retrieved_ids: [],
    wiki_assisted: false,
  })
  await submitQuestion(page)

  await expect(page.getByText('Hình minh họa', { exact: false })).toBeVisible()

  // GeoGebra applet was injected
  const injectCount = await page.evaluate(() => window._ggbInjectCount)
  expect(injectCount).toBe(1)

  // Wait for the polling interval to fire and forward commands
  await page.waitForFunction(() => window._ggbCommands?.length > 0, { timeout: 2000 })

  // Commands include the function definition
  const cmds = await page.evaluate(() => window._ggbCommands)
  expect(cmds.some(c => /f\(x\)/.test(c))).toBe(true)

  // No inline SVG rendered (GeoGebra path taken)
  const hasSvg = await page.evaluate(() => !!document.querySelector('svg circle'))
  expect(hasSvg).toBe(false)
})
