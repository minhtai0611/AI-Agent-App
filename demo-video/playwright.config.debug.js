const { defineConfig, devices } = require('@playwright/test')
module.exports = defineConfig({
  testDir: '.',
  testMatch: '**/debug-demo.spec.ts',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1280, height: 800 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
