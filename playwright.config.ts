import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests: a real browser against the whole running stack (PostgreSQL, the Duewise API and
 * this app behind nginx), started with `docker compose up -d --build`. Nothing is mocked.
 *
 *   npm run e2e                                   against http://localhost:3000
 *   E2E_BASE_URL=http://localhost:5173 npm run e2e   against the development server
 *
 * The tests create their own clients and invoices with unique names, so they can run against a
 * database that already has data, and run again without cleaning up.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // The browser's "today" must match Duewise's business time zone (BUSINESS_TIME_ZONE), or a
    // payment dated today can fall before an invoice issued "today" on the other side of midnight.
    timezoneId: process.env.E2E_TIME_ZONE ?? 'Asia/Kolkata',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
