import { test } from '@playwright/test'

const DEMO_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJzdWIiOiIxIiwiZW1haWwiOiJkZW1vQHplbml0aC52biIsImV4cCI6MjA4MjcxNTIwMH0' +
  '.DEMO_SIG_PLACEHOLDER'

test('debug: check localStorage + network', async ({ page }) => {
  // Capture all console messages
  const logs: string[] = []
  page.on('console', msg => logs.push(`[console][${msg.type()}] ${msg.text()}`))
  page.on('pageerror', err => logs.push(`[pageerror] ${err.message}`))

  // Track network requests
  const requests: string[] = []
  page.on('request', req => requests.push(`REQ: ${req.method()} ${req.url()}`))
  page.on('response', res => requests.push(`RES: ${res.status()} ${res.url()}`))
  page.on('requestfailed', req => requests.push(`FAIL: ${req.method()} ${req.url()} — ${req.failure()?.errorText}`))

  // Seed localStorage before page scripts
  await page.addInitScript(`(function() {
    localStorage.setItem('auth_token', '${DEMO_JWT}');
    console.log('[init] auth_token set');
  })()`)

  // Mock /users/me
  await page.route('**/users/me', async (route) => {
    console.log('ROUTE MOCK HIT: ' + route.request().url())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, email: 'demo@zenith.vn', display_name: 'Test User', grade: '12', subscription_tier: 'student', credits_balance: 50, tos_accepted_at: '2025-01-01', extended_onboarding_done: true })
    })
  })

  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' })
  
  // Wait a bit then check state
  await page.waitForTimeout(5000)

  // Check localStorage
  const authToken = await page.evaluate(() => localStorage.getItem('auth_token'))
  console.log('auth_token in browser:', authToken ? authToken.slice(0, 30) + '...' : 'NULL')

  // Check page content
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 200))
  console.log('body text:', bodyText)

  // Check what's rendered in DOM
  const h1Count = await page.evaluate(() => document.querySelectorAll('h1').length)
  console.log('h1 count:', h1Count)

  console.log('--- NETWORK REQUESTS ---')
  requests.forEach(r => console.log(r))

  console.log('--- CONSOLE LOGS ---')
  logs.forEach(l => console.log(l))
})
