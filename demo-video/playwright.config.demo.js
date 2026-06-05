// @ts-check
/**
 * playwright.config.demo.js
 *
 * Isolated Playwright config for the demo video recording.
 * Uses a SEPARATE testDir ('demo-video') so this spec NEVER runs
 * with the existing test suite (which uses testDir: './tests').
 *
 * Run:
 *   npx playwright test demo-video/playwright-demo.spec.ts \
 *     --config demo-video/playwright.config.demo.js \
 *     --headed --project=chromium
 *
 * CI (production URL):
 *   DEMO_BASE_URL=https://exam-app-ey0.pages.dev \
 *   npx playwright test demo-video/playwright-demo.spec.ts \
 *     --config demo-video/playwright.config.demo.js \
 *     --project=chromium
 */
const { defineConfig, devices } = require('@playwright/test')

module.exports = defineConfig({
  // Scoped to this directory only — never overlaps with ./tests/
  // Path is relative to the config file location (demo-video/)
  testDir: '.',
  testMatch: '**/playwright-demo.spec.ts',

  // Generous timeout for all 8 scenes including humanType + scrollSlowly delays
  timeout: 240_000,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.DEMO_BASE_URL ?? 'http://localhost:5173',
    // Full HD for demo recording
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'dark',
    // Record video for every run — output goes to test-results/ (gitignored)
    video: {
      mode: 'on',
      size: { width: 1920, height: 1080 },
    },
    // Capture screenshot on failure only (per-scene screenshots handled manually in spec)
    screenshot: 'only-on-failure',
    // Slow down mouse movement for human-paced visual timing
    // (additional timing control is in humanType / scrollSlowly helpers)
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Chromium-specific: launch with full GPU for CSS animations
        launchOptions: {
          args: [
            '--disable-infobars',
            '--no-default-browser-check',
            '--no-first-run',
            // GPU acceleration: only useful when --headed; headless ignores it
            // and some WSL2 environments hang with --enable-gpu in headless mode
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
          ],
        },
      },
    },
  ],

  // No automatic dev server spin-up.
  // For local recording: start `npm --prefix exam-app run dev` manually.
  // For CI: app is already deployed to the production URL.
})
