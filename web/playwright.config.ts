import { defineConfig } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45000,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // tests share one database; run serially
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ?? 'postgres://sigma:sigma@localhost:55432/sigma',
      SESSION_SECRET:
        process.env.SESSION_SECRET ?? 'dev-only-secret-change-in-production-0123456789abcdef',
    },
  },
});
