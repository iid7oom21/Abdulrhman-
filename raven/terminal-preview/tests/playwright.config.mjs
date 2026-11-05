import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { defineConfig } = require(process.env.PLAYWRIGHT_TEST_MODULE || '@playwright/test');
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.mjs',
  timeout: 45000,
  expect: { timeout: 8000 },
  fullyParallel: true,
  workers: 2,
  retries: 0,
  outputDir: process.env.RAVEN_TEST_OUTPUT || '/tmp/raven-terminal-test-results',
  reporter: [['list'], ['json', { outputFile: process.env.RAVEN_TEST_REPORT || '/tmp/raven-terminal-test-report.json' }]],
  use: {
    baseURL: process.env.RAVEN_PREVIEW_URL || 'http://127.0.0.1:8786/raven/terminal-preview/',
    browserName: process.env.RAVEN_BROWSER || 'chromium',
    viewport: { width: 1440, height: 1000 },
    contextOptions: { reducedMotion: 'reduce' },
    actionTimeout: 10000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
