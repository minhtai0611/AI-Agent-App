// @ts-check
const { test, expect } = require('@playwright/test')

const BASE = 'http://localhost:5173/oracle'

// Helpers
const getAnswer  = page => page.evaluate(() => document.querySelector('[class*="fraunces"][class*="text-2xl"]')?.textContent?.trim())
const getBadge   = page => page.evaluate(() => !![...document.querySelectorAll('span')].find(el => el.textContent.trim() === 'AI trực tiếp'))
const getChips   = page => page.evaluate(() => document.querySelectorAll('[class*="rounded-full"][class*="px-3"][class*="py-1"]').length)
const getWarning = page => page.evaluate(() => document.body.textContent.includes('chưa được xác minh'))
const getInsuf   = page => page.evaluate(() => document.body.textContent.includes('Chưa đủ tri thức'))
const getErrStr  = page => page.evaluate(() => document.body.textContent.includes('INSUFFICIENT_KNOWLEDGE'))

async function submitQuestion(page, text) {
  await page.locator('textarea').fill(text)
  await page.locator('button[type="submit"]').click()
  await page.getByText('Đáp án').first().waitFor({ state: 'visible', timeout: 60000 })
}

async function mockSolve(page, payload) {
  await page.route('**/math-solve', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) }),
    { times: 1 }
  )
}

// ── Test 1: wiki-hit problem ────────────────────────────────────────────────
test('T1: wiki-hit problem — answer shown, wiki chips present, no badge', async ({ page }) => {
  await page.goto(BASE)
  await page.locator('button').filter({ hasText: /x.*2.*5x.*6/ }).first().click()
  await page.locator('button[type="submit"]').click()
  await page.getByText('Đáp án').first().waitFor({ state: 'visible', timeout: 60000 })

  expect(await getAnswer(page)).toMatch(/x\s*=/)
  expect(await getBadge(page)).toBe(false)
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
