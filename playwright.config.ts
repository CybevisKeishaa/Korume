import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // `playwright.c4.config.ts` OWNS this spec (`testMatch`), and owning it means
  // two things this config cannot give it: `LESSON_CREATION_WORKER_ENABLED=true`,
  // without which every job sits at "queued" forever, and the preloaded YouTube
  // seam, without which the run would reach for the real endpoint. Left in the
  // default run it was three guaranteed failures on every pass — reported as
  // "pre-existing, needs an env var" by four separate branches since
  // 2026-09-13 and never closed, which is the cost of a red suite nobody can
  // read. `shadowing-*.spec.ts` is deliberately NOT ignored: `c3.config.ts`
  // matches it too, but it passes under this one as well.
  testIgnore: "lesson-creation-jobs.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    // Pinned, not inherited. Playwright's Chrome happens to send
    // Accept-Language: en-US, so next-intl would negotiate /en anyway — but
    // that is incidental. The regression suite runs on `en` by design (spec
    // D6), and must stay green once Plan 3 makes `vi` the fully-translated
    // default.
    locale: "en",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run build && npm run start",
    env: { E2E_ROUTE_ERROR: "1" },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
