import { defineConfig, devices } from '@playwright/test'

// Exercise the actual production artifact under the same prefix as GitHub Pages.
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'pages-assets.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure' },
  timeout: 60_000,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'corepack yarn vite preview --base=/wenyan-English/ --host 127.0.0.1 --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174/wenyan-English/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
