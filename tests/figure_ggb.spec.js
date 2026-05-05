// @ts-check
// Comprehensive GeoGebra figure tests — covers all math domains and edge cases.
const { test, expect } = require('@playwright/test')

const BASE = 'http://localhost:5173/oracle'

// ── Shared helpers ────────────────────────────────────────────────────────────

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
        const push = cmd => window._ggbCommands.push(cmd)
        this._api = {
          evalCommand: push,
          setVisible: (name, v) => push(`setVisible(${name},${v})`),
          setFilling: (name, v) => push(`setFilling(${name},${v})`),
          setColor:   (name, r, g, b) => push(`setColor(${name},${r},${g},${b})`),
        }
      }
      inject(_idOrEl) { window._ggbInjectCount++ }
      getAppletObject() { return this._api }
    }
  })
}

async function mockSolve(page, payload) {
  await page.route('**/math-solve', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) }),
    { times: 1 }
  )
}

async function submitQuestion(page) {
  await page.locator('button').filter({ hasText: /x.*2.*5x.*6/ }).first().click()
  await page.locator('button[type="submit"]').click()
  await page.getByText('Bài toán').first().waitFor({ state: 'visible', timeout: 60000 })
}

function geoPayload(commands, opts = {}) {
  return {
    label: opts.label ?? 'geometry',
    answer: {
      problem_type: opts.type ?? 'proof',
      steps: opts.steps ?? ['Step 1', 'Step 2'],
      final_answer: opts.answer ?? 'QED',
      confidence: 'high',
      used_knowledge_ids: [],
      figure: commands != null ? { type: 'geogebra', data: commands } : undefined,
    },
    validation: { valid: true, issues: [] },
    retrieved_ids: [],
    wiki_assisted: false,
  }
}

// Wait for GeoGebra polling to forward commands (max 2 s — stub responds in ~300 ms)
async function waitForCommands(page) {
  await page.waitForFunction(() => window._ggbCommands?.length > 0, { timeout: 2000 })
}

// ── Suite A: Geometry domains ─────────────────────────────────────────────────

test.describe('A: Geometry', () => {
  test('A1: basic triangle — vertices, segments, circumcircle', async ({ page }) => {
    await stubGeoGebra(page)
    await page.goto(BASE)
    await mockSolve(page, geoPayload([
      'A = (0, 4)',
      'B = (-3, 0)',
      'C = (3, 0)',
      'Segment(A, B)',
      'Segment(B, C)',
      'Segment(C, A)',
      'c = Circumcircle(A, B, C)',
      'ZoomIn(1)',
    ].join('\n')))
    await submitQuestion(page)
    await expect(page.getByText('Hình minh họa', { exact: false })).toBeVisible()
    await waitForCommands(page)

    const cmds = await page.evaluate(() => window._ggbCommands)
    expect(cmds.some(c => c.includes('A = (0, 4)'))).toBe(true)
    expect(cmds.some(c => /Segment/.test(c))).toBe(true)
    expect(cmds.some(c => /Circumcircle/.test(c))).toBe(true)
    expect(cmds.some(c => c === 'ZoomIn(1)')).toBe(true)
    await expect(page.getByText('Không thể tải GeoGebra')).not.toBeVisible()
  })

  test('A2: altitude foot and orthocenter — PerpendicularFoot + Intersect', async ({ page }) => {
    await stubGeoGebra(page)
    await page.goto(BASE)
    await mockSolve(page, geoPayload([
      'A = (0, 5)',
      'B = (-3, 0)',
      'C = (4, 0)',
      'Segment(A, B)',
      'Segment(B, C)',
      'Segment(C, A)',
      'lBC = Line(B, C)',
      'lAC = Line(A, C)',
      'D = PerpendicularFoot(A, lBC)',
      'E = PerpendicularFoot(B, lAC)',
      'altAD = Line(A, D)',
      'altBE = Line(B, E)',
      'H = Intersect(altAD, altBE)',
      'Segment(A, D)',
      'Segment(B, E)',
      'HideObject(lBC)',
      'HideObject(lAC)',
      'HideObject(altAD)',
      'HideObject(altBE)',
      'ZoomIn(1)',
    ].join('\n')))
    await submitQuestion(page)
    await expect(page.getByText('Hình minh họa', { exact: false })).toBeVisible()
    await waitForCommands(page)

    const cmds = await page.evaluate(() => window._ggbCommands)
    expect(cmds.some(c => /PerpendicularFoot/.test(c))).toBe(true)
    expect(cmds.some(c => /Intersect/.test(c))).toBe(true)
    expect(cmds.some(c => /HideObject/.test(c))).toBe(true)
    // Must never contain the banned Foot() function
    expect(cmds.every(c => !/\bFoot\(/.test(c))).toBe(true)
  })

  test('A3: cyclic quadrilateral — Polygon + Circumcircle, no Circle(Midpoint(…)) pattern', async ({ page }) => {
    await stubGeoGebra(page)
    await page.goto(BASE)
    await mockSolve(page, geoPayload([
      'A = (0, 5)',
      'B = (-3, 0)',
      'C = (4, 0)',
      'lBC = Line(B, C)',
      'lAC = Line(A, C)',
      'D = PerpendicularFoot(A, lBC)',
      'F = PerpendicularFoot(B, lAC)',
      'altAD = Line(A, D)',
      'altBF = Line(B, F)',
      'H = Intersect(altAD, altBF)',
      'HideObject(lBC)',
      'HideObject(lAC)',
      'HideObject(altAD)',
      'HideObject(altBF)',
      'Segment(A, B)',
      'Segment(B, C)',
      'Segment(C, A)',
      'poly = Polygon(B, D, H, F)',
      'circBDHF = Circumcircle(B, D, H)',
      'SetColor(poly, "SteelBlue")',
      'SetFilling(poly, 0.15)',
      'ZoomIn(1)',
    ].join('\n')))
    await submitQuestion(page)
    await waitForCommands(page)

    const cmds = await page.evaluate(() => window._ggbCommands)
    expect(cmds.some(c => /Polygon/.test(c))).toBe(true)
    expect(cmds.some(c => /Circumcircle/.test(c))).toBe(true)
    expect(cmds.some(c => /SetColor/.test(c))).toBe(true)
    // Ensure the banned Circle(Midpoint…) pattern was not used
    expect(cmds.every(c => !/Circle\(Midpoint/.test(c))).toBe(true)
  })

  test('A4: incircle and angle bisector', async ({ page }) => {
    await stubGeoGebra(page)
    await page.goto(BASE)
    await mockSolve(page, geoPayload([
      'A = (0, 5)',
      'B = (-4, 0)',
      'C = (4, 0)',
      'Segment(A, B)',
      'Segment(B, C)',
      'Segment(C, A)',
      'ic = Incircle(A, B, C)',
      'bisA = AngleBisector(B, A, C)',
      'HideObject(bisA)',
      'ZoomIn(1)',
    ].join('\n')))
    await submitQuestion(page)
    await waitForCommands(page)

    const cmds = await page.evaluate(() => window._ggbCommands)
    expect(cmds.some(c => /Incircle/.test(c))).toBe(true)
    expect(cmds.some(c => /AngleBisector/.test(c))).toBe(true)
  })

  test('A5: midpoint and perpendicular bisector', async ({ page }) => {
    await stubGeoGebra(page)
    await page.goto(BASE)
    await mockSolve(page, geoPayload([
      'A = (-3, 0)',
      'B = (3, 0)',
      'C = (0, 4)',
      'Segment(A, B)',
      'Segment(B, C)',
      'Segment(C, A)',
      'M = Midpoint(A, B)',
      'pb = PerpendicularBisector(A, B)',
      'HideObject(pb)',
      'ZoomIn(1)',
    ].join('\n')))
    await submitQuestion(page)
    await waitForCommands(page)

    const cmds = await page.evaluate(() => window._ggbCommands)
    expect(cmds.some(c => /Midpoint/.test(c))).toBe(true)
    expect(cmds.some(c => /PerpendicularBisector/.test(c))).toBe(true)
  })

  test('A6: right triangle — specific right-angle coordinates', async ({ page }) => {
    await stubGeoGebra(page)
    await page.goto(BASE)
    await mockSolve(page, geoPayload([
      'A = (0, 0)',
      'B = (5, 0)',
      'C = (0, 3)',
      'Segment(A, B)',
      'Segment(B, C)',
      'Segment(C, A)',
      'lBC = Line(B, C)',
      'H = PerpendicularFoot(A, lBC)',
      'Segment(A, H)',
      'HideObject(lBC)',
      'ZoomIn(1)',
    ].join('\n'), { type: 'right-triangle' }))
    await submitQuestion(page)
    await waitForCommands(page)

    const cmds = await page.evaluate(() => window._ggbCommands)
    expect(cmds.some(c => c.includes('A = (0, 0)'))).toBe(true)
    expect(cmds.some(c => /PerpendicularFoot/.test(c))).toBe(true)
    expect(cmds.every(c => !/\bFoot\(/.test(c))).toBe(true)
  })
})

// ── Suite B: Calculus / Functions ─────────────────────────────────────────────

test.describe('B: Functions and Calculus', () => {
  test('B1: parabola with roots and vertex', async ({ page }) => {
    await stubGeoGebra(page)
    await page.goto(BASE)
    await mockSolve(page, geoPayload(
      'f(x) = x^2 - 5x + 6\nRoot(f)\nZoomIn(1)',
      { label: 'functions', type: 'function' }
    ))
    await submitQuestion(page)
    await waitForCommands(page)

    const cmds = await page.evaluate(() => window._ggbCommands)
    expect(cmds.some(c => /f\(x\).*=/.test(c))).toBe(true)
    expect(cmds.some(c => /Root/.test(c))).toBe(true)
    expect(cmds.some(c => c === 'ZoomIn(1)')).toBe(true)
  })

  test('B2: tangent line at a point', async ({ page }) => {
    await stubGeoGebra(page)
    await page.goto(BASE)
    await mockSolve(page, geoPayload(
      'f(x) = x^2\ntang = Tangent(f, (2, f(2)))\nZoomIn(1)',
      { label: 'calculus', type: 'derivative' }
    ))
    await submitQuestion(page)
    await waitForCommands(page)

    const cmds = await page.evaluate(() => window._ggbCommands)
    expect(cmds.some(c => /Tangent/.test(c))).toBe(true)
    expect(cmds.some(c => /f\(x\)/.test(c))).toBe(true)
  })

  test('B3: definite integral region', async ({ page }) => {
    await stubGeoGebra(page)
    await page.goto(BASE)
    await mockSolve(page, geoPayload(
      'f(x) = x^2\nIntegral(f, 0, 3)\nZoomIn(1)',
      { label: 'calculus', type: 'integral' }
    ))
    await submitQuestion(page)
    await waitForCommands(page)

    const cmds = await page.evaluate(() => window._ggbCommands)
    expect(cmds.some(c => /Integral/.test(c))).toBe(true)
  })

  test('B4: asymptote and rational function', async ({ page }) => {
    await stubGeoGebra(page)
    await page.goto(BASE)
    await mockSolve(page, geoPayload(
      'f(x) = (x + 1) / (x - 2)\nAsymptote(f)\nZoomIn(1)',
      { label: 'functions', type: 'rational' }
    ))
    await submitQuestion(page)
    await waitForCommands(page)

    const cmds = await page.evaluate(() => window._ggbCommands)
    expect(cmds.some(c => /Asymptote/.test(c))).toBe(true)
  })

  test('B5: two functions intersection', async ({ page }) => {
    await stubGeoGebra(page)
    await page.goto(BASE)
    await mockSolve(page, geoPayload([
      'f(x) = x^2',
      'g(x) = 2x + 3',
      'lf = Line((0,3),(1,5))',
      'P = Intersect(f, g)',
      'ZoomIn(1)',
    ].join('\n'), { label: 'functions', type: 'intersection' }))
    await submitQuestion(page)
    await waitForCommands(page)

    const cmds = await page.evaluate(() => window._ggbCommands)
    expect(cmds.some(c => /f\(x\)/.test(c))).toBe(true)
    expect(cmds.some(c => /g\(x\)/.test(c))).toBe(true)
  })
})

// ── Suite C: Other math domains ────────────────────────────────────────────────

test.describe('C: Trig, Vectors, Inequalities', () => {
  test('C1: trigonometry — sine curve on unit circle', async ({ page }) => {
    await stubGeoGebra(page)
    await page.goto(BASE)
    await mockSolve(page, geoPayload(
      'uc = Circle((0,0), 1)\nf(x) = sin(x)\nZoomIn(1)',
      { label: 'trigonometry', type: 'trig' }
    ))
    await submitQuestion(page)
    await waitForCommands(page)

    const cmds = await page.evaluate(() => window._ggbCommands)
    expect(cmds.some(c => /sin/.test(c))).toBe(true)
    expect(cmds.some(c => /Circle/.test(c))).toBe(true)
  })

  test('C2: vector diagram', async ({ page }) => {
    await stubGeoGebra(page)
    await page.goto(BASE)
    await mockSolve(page, geoPayload(
      'v = Vector((0,0),(3,4))\nw = Vector((0,0),(1,-2))\nZoomIn(1)',
      { label: 'vectors', type: 'vector' }
    ))
    await submitQuestion(page)
    await waitForCommands(page)

    const cmds = await page.evaluate(() => window._ggbCommands)
    expect(cmds.some(c => /Vector/.test(c))).toBe(true)
  })

  test('C3: inequality — shaded region', async ({ page }) => {
    await stubGeoGebra(page)
    await page.goto(BASE)
    await mockSolve(page, geoPayload(
      'y > x^2 - 4\ny < 2x + 1\nZoomIn(1)',
      { label: 'inequalities', type: 'inequality' }
    ))
    await submitQuestion(page)
    await waitForCommands(page)

    const cmds = await page.evaluate(() => window._ggbCommands)
    expect(cmds.some(c => /y\s*[<>]/.test(c))).toBe(true)
  })

  test('C4: statistics histogram', async ({ page }) => {
    await stubGeoGebra(page)
    await page.goto(BASE)
    await mockSolve(page, geoPayload(
      'Histogram({2, 4, 4, 5, 6, 7, 7, 8, 9, 10})\nZoomIn(1)',
      { label: 'statistics', type: 'histogram' }
    ))
    await submitQuestion(page)
    await waitForCommands(page)

    const cmds = await page.evaluate(() => window._ggbCommands)
    expect(cmds.some(c => /Histogram/.test(c))).toBe(true)
  })
})

// ── Suite D: Edge cases ───────────────────────────────────────────────────────

test.describe('D: Edge cases', () => {
  test('D1: no figure for pure arithmetic — section absent', async ({ page }) => {
    await page.goto(BASE)
    await mockSolve(page, {
      label: 'arithmetic',
      answer: {
        problem_type: 'arithmetic',
        steps: ['315 + 478 = 793'],
        final_answer: '793',
        confidence: 'high',
        used_knowledge_ids: [],
        // no figure field
      },
      validation: { valid: true, issues: [] },
      retrieved_ids: [],
      wiki_assisted: false,
    })
    await submitQuestion(page)

    await expect(page.getByText('Bài toán')).toBeVisible()
    await expect(page.getByText('Hình minh họa', { exact: false })).not.toBeVisible()
  })

  test('D2: figure with null data — section absent, no crash', async ({ page }) => {
    await page.goto(BASE)
    await mockSolve(page, geoPayload(null))
    await submitQuestion(page)

    await expect(page.getByText('Bài toán')).toBeVisible()
    await expect(page.getByText('Hình minh họa', { exact: false })).not.toBeVisible()
  })

  test('D3: figure with data=null and error field — section absent, no crash', async ({ page }) => {
    await page.goto(BASE)
    await mockSolve(page, {
      label: 'geometry',
      answer: {
        problem_type: 'proof',
        steps: ['Step 1'],
        final_answer: 'QED',
        confidence: 'high',
        used_knowledge_ids: [],
        figure: { type: 'geogebra', data: null, error: 'LLM returned empty GeoGebra commands' },
      },
      validation: { valid: true, issues: [] },
      retrieved_ids: [],
      wiki_assisted: false,
    })
    await submitQuestion(page)

    await expect(page.getByText('Bài toán')).toBeVisible()
    await expect(page.getByText('Hình minh họa', { exact: false })).not.toBeVisible()
  })

  test('D4: single-line minimal commands — ZoomIn(1) only', async ({ page }) => {
    await stubGeoGebra(page)
    await page.goto(BASE)
    await mockSolve(page, geoPayload('A = (0,0)\nB = (3,4)\nSegment(A, B)\nZoomIn(1)'))
    await submitQuestion(page)
    await expect(page.getByText('Hình minh họa', { exact: false })).toBeVisible()
    await waitForCommands(page)

    const cmds = await page.evaluate(() => window._ggbCommands)
    expect(cmds.length).toBe(4)
    expect(cmds[cmds.length - 1]).toBe('ZoomIn(1)')
  })

  test('D5: commands forwarded in exact order', async ({ page }) => {
    await stubGeoGebra(page)
    await page.goto(BASE)
    const ordered = ['A = (0,0)', 'B = (4,0)', 'C = (2,3)', 'Segment(A, B)', 'Segment(B, C)', 'Segment(C, A)', 'ZoomIn(1)']
    await mockSolve(page, geoPayload(ordered.join('\n')))
    await submitQuestion(page)
    await waitForCommands(page)

    const cmds = await page.evaluate(() => window._ggbCommands)
    expect(cmds).toEqual(ordered)
  })

  test('D6: GeoGebra applet params — classic, language vi, no toolbar', async ({ page }) => {
    await stubGeoGebra(page)
    await page.goto(BASE)
    await mockSolve(page, geoPayload('A = (0,0)\nZoomIn(1)'))
    await submitQuestion(page)
    await expect(page.getByText('Hình minh họa', { exact: false })).toBeVisible()

    const params = await page.evaluate(() => window._ggbParams)
    expect(params.appName).toBe('classic')
    expect(params.language).toBe('vi')
    expect(params.showToolBar).toBe(false)
    expect(params.showAlgebraInput).toBe(false)
    expect(params.showMenuBar).toBe(false)
    expect(params.enableRightClick).toBe(false)
    expect(params.height).toBe(360)
  })

  test('D7: two independent submissions each render their own figure', async ({ page }) => {
    // Geometry submission
    await stubGeoGebra(page)
    await page.goto(BASE)
    await mockSolve(page, geoPayload('A = (0,0)\nB = (3,0)\nC = (0,4)\nSegment(A, B)\nSegment(B, C)\nSegment(C, A)\nZoomIn(1)'))
    await submitQuestion(page)
    await expect(page.getByText('Hình minh họa', { exact: false })).toBeVisible()
    await waitForCommands(page)
    const geoCmds = await page.evaluate(() => window._ggbCommands.slice())
    expect(geoCmds.some(c => /Segment/.test(c))).toBe(true)

    // Navigate fresh; addInitScript re-runs and resets _ggbCommands
    await page.goto(BASE)
    await mockSolve(page, geoPayload('f(x) = x^3 - 3x\nRoot(f)\nZoomIn(1)', { label: 'functions' }))
    await submitQuestion(page)
    await expect(page.getByText('Hình minh họa', { exact: false })).toBeVisible()
    await waitForCommands(page)
    const funcCmds = await page.evaluate(() => window._ggbCommands)
    expect(funcCmds.some(c => /f\(x\)/.test(c))).toBe(true)
    expect(funcCmds.some(c => /Root/.test(c))).toBe(true)
  })

  test('D8: large command set — 30 lines forwarded without truncation', async ({ page }) => {
    await stubGeoGebra(page)
    await page.goto(BASE)
    const lines = Array.from({ length: 28 }, (_, i) => `P${i} = (${i}, ${i % 5})`)
    lines.push('ZoomIn(1)')
    await mockSolve(page, geoPayload(lines.join('\n')))
    await submitQuestion(page)
    await page.waitForFunction(
      n => window._ggbCommands?.length >= n,
      lines.length,
      { timeout: 3000 }
    )

    const cmds = await page.evaluate(() => window._ggbCommands)
    expect(cmds.length).toBe(lines.length)
  })

  test('D9: empty lines in commands are skipped', async ({ page }) => {
    await stubGeoGebra(page)
    await page.goto(BASE)
    // Commands with blank lines between them (LLM sometimes inserts spacing)
    await mockSolve(page, geoPayload('A = (0,0)\n\nB = (3,4)\n\nSegment(A, B)\n\nZoomIn(1)'))
    await submitQuestion(page)
    await waitForCommands(page)

    const cmds = await page.evaluate(() => window._ggbCommands)
    // Blank lines must not appear in forwarded commands
    expect(cmds.every(c => c.trim() !== '')).toBe(true)
    expect(cmds).toContain('A = (0,0)')
    expect(cmds).toContain('B = (3,4)')
    expect(cmds).toContain('ZoomIn(1)')
  })

  test('D10: Vietnamese number theory problem — no figure section', async ({ page }) => {
    await page.goto(BASE)
    await mockSolve(page, {
      label: 'number_theory',
      answer: {
        problem_type: 'divisibility',
        steps: ['Vì n(n+1) là tích hai số tự nhiên liên tiếp nên chia hết cho 2'],
        final_answer: 'n(n+1) chia hết cho 2',
        confidence: 'high',
        used_knowledge_ids: [],
        // no figure — number theory
      },
      validation: { valid: true, issues: [] },
      retrieved_ids: [],
      wiki_assisted: false,
    })
    await submitQuestion(page)

    await expect(page.getByText('Bài toán')).toBeVisible()
    await expect(page.getByText('Hình minh họa', { exact: false })).not.toBeVisible()
  })

  test('D11: complex geometry — many constructions, all commands reach GeoGebra', async ({ page }) => {
    await stubGeoGebra(page)
    await page.goto(BASE)
    // Simulates a rich problem: triangle + two altitude feet + orthocenter + circumcircle + incircle
    const commands = [
      'A = (1, 6)',
      'B = (-4, 0)',
      'C = (5, 0)',
      'Segment(A, B)',
      'Segment(B, C)',
      'Segment(C, A)',
      'lBC = Line(B, C)',
      'lAC = Line(A, C)',
      'lAB = Line(A, B)',
      'D = PerpendicularFoot(A, lBC)',
      'E = PerpendicularFoot(B, lAC)',
      'F = PerpendicularFoot(C, lAB)',
      'altAD = Line(A, D)',
      'altBE = Line(B, E)',
      'H = Intersect(altAD, altBE)',
      'Segment(A, D)',
      'Segment(B, E)',
      'Segment(C, F)',
      'HideObject(lBC)',
      'HideObject(lAC)',
      'HideObject(lAB)',
      'HideObject(altAD)',
      'HideObject(altBE)',
      'circ = Circumcircle(A, B, C)',
      'ic = Incircle(A, B, C)',
      'ZoomIn(1)',
    ]
    await mockSolve(page, geoPayload(commands.join('\n')))
    await submitQuestion(page)
    await page.waitForFunction(
      n => window._ggbCommands?.length >= n,
      commands.length,
      { timeout: 3000 }
    )

    const cmds = await page.evaluate(() => window._ggbCommands)
    expect(cmds.length).toBe(commands.length)
    expect(cmds.every(c => !/\bFoot\(/.test(c))).toBe(true)
    expect(cmds.every(c => !/Circle\(Midpoint/.test(c))).toBe(true)
    expect(cmds.some(c => /Circumcircle/.test(c))).toBe(true)
    expect(cmds.some(c => /Incircle/.test(c))).toBe(true)
  })
})
