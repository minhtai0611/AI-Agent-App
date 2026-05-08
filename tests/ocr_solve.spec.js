// @ts-check
const { test, expect } = require('@playwright/test')
const path = require('path')

const BASE = 'http://localhost:5173/oracle'
const IMAGE = path.resolve(__dirname, '../exam_0.JPG')

// Extract the first solvable sub-question from OCR output.
// For a multi-problem exam, picks the first leaf question (e.g. "1a)")
// or falls back to the first non-heading line with math content.
function extractFirstProblem(ocrText) {
  const lines = ocrText.split('\n').map(l => l.trim()).filter(Boolean)

  // Find the first sub-item line: starts with a), b), 1., etc. and has math
  const subItem = lines.find(l =>
    /^(\*\*)?[a-d]\)|^1\.|^\d+\.\s/.test(l) &&
    /[$\\√×÷=≤≥π]|[0-9]/.test(l)
  )
  if (subItem) return subItem.replace(/\*\*/g, '').trim()

  // Fallback: first line that contains math operators/numbers
  const mathLine = lines.find(l => /[$\\√=+\-×÷]/.test(l) && l.length > 10)
  if (mathLine) return mathLine.replace(/\*\*/g, '').trim()

  return lines.slice(0, 3).join(' ')
}

// Backend: 55s pipeline timeout × up to 2 retries + 1s wait = ~115s
// OCR: ~30s, wiki wait: ~10s, network headroom: 20s → 175s total
test('OCR exam_0.JPG → extract first sub-problem → solve', async ({ page }) => {
  test.setTimeout(220_000)

  await page.goto(BASE)

  // Wait for wiki index to settle (ready or failed) — button is disabled while building
  await page.waitForFunction(() => {
    const body = document.body.textContent ?? ''
    return !['Đang khởi động', 'Đang kiểm tra bộ nhớ đệm', 'Đang đọc kho tri thức',
             'Đang xây dựng chỉ mục vector', 'Đang lưu chỉ mục'].some(s => body.includes(s))
  }, null, { timeout: 60_000 }).catch(() => {})

  // ── Phase 1: OCR ──────────────────────────────────────────────────────────
  // Click the camera button so the browser opens a real file chooser,
  // then intercept it — this is the only way to trigger React's onChange.
  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.locator('button[title="Nhận diện ảnh"]').click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(IMAGE)

  // Wait for OCR spinner to appear (ocring=true → button spins), then for it to disappear
  await page.locator('span[style*="spin"]').waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {})
  await page.locator('span[style*="spin"]').waitFor({ state: 'hidden', timeout: 60_000 }).catch(() => {})

  const textarea = page.locator('textarea').first()
  const ocrText = await textarea.inputValue()

  // Log OCR error if textarea stayed empty
  if (!ocrText.trim()) {
    const errMsg = await page.evaluate(() => {
      const el = [...document.querySelectorAll('div')].find(d =>
        /EF4444/.test(d.className ?? '') && d.textContent?.trim()
      )
      return el?.textContent?.trim() ?? '(no error element found)'
    })
    console.log('--- OCR error ---\n' + errMsg + '\n-----------------')
  }

  expect(ocrText.trim().length, 'OCR returned empty text').toBeGreaterThan(10)

  console.log('--- OCR output (truncated to 400 chars) ---')
  console.log(ocrText.slice(0, 400))
  console.log('-------------------------------------------')
  expect(ocrText.trim().length).toBeGreaterThan(10)

  // ── Phase 2: trim to one solvable sub-problem ─────────────────────────────
  const problem = extractFirstProblem(ocrText)
  console.log('--- Problem sent to solve ---')
  console.log(problem)
  console.log('-----------------------------')

  // Replace textarea content with just the first problem
  await page.evaluate((text) => {
    const ta = document.querySelector('textarea')
    if (!ta) return
    const nativeInput = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    nativeInput.call(ta, text)
    ta.dispatchEvent(new Event('input', { bubbles: true }))
  }, problem)

  // ── Phase 3: solve ────────────────────────────────────────────────────────
  const submitBtn = page.locator('button[type="submit"]')
  await expect(submitBtn).toBeEnabled({ timeout: 10_000 })
  await submitBtn.click()

  // Wait for solution card OR error banner — whichever lands first
  await Promise.race([
    page.getByText('Lời giải', { exact: false }).waitFor({ state: 'visible', timeout: 130_000 }),
    page.locator('div').filter({ hasText: /Pipeline timed out|Không thể|AI service/ }).first()
      .waitFor({ state: 'visible', timeout: 130_000 }),
  ]).catch(() => {})

  // Log any error for diagnostics
  const errorText = await page.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find(d =>
      /EF4444/.test(d.className ?? '') && d.textContent?.trim()
    )
    return el?.textContent?.trim() ?? null
  })
  if (errorText) console.log('--- Backend error ---\n' + errorText + '\n---------------------')

  await expect(page.getByText('Lời giải', { exact: false })).toBeVisible({ timeout: 5_000 })

  const steps = await page.evaluate(() =>
    [...document.querySelectorAll('ol li div')].map(el => el.textContent?.trim()).filter(Boolean)
  )
  console.log('--- Solution steps ---')
  steps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`))
  console.log('---------------------')

  expect(steps.length).toBeGreaterThan(0)
})
