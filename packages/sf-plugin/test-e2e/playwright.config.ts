import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: [['list']],
  use: {
    browserName: 'chromium',
    channel: 'chrome',
    headless: true,
    screenshot: 'off',
    trace: 'off',
    video: 'off',
    actionTimeout: 30_000,
    navigationTimeout: 90_000,
  },
});
