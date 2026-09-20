import { defineConfig, devices } from "@playwright/test";

/**
 * C4 browser acceptance. Runs its own server on its own port because it needs
 * two things the other configs must not have:
 *
 * - `LESSON_CREATION_WORKER_ENABLED=true`, so the internal worker actually
 *   runs jobs. Every other config leaves it unset, which is deliberately
 *   disabled.
 * - The deterministic YouTube seam preloaded into the server process, so no
 *   real YouTube endpoint is reachable (plan Global Constraints).
 *
 * `reuseExistingServer` is false on purpose: a server already running without
 * the worker flag would make every job sit at "queued" forever and the failure
 * would look like a product bug.
 */
const PORT = 3002;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "lesson-creation-jobs.spec.ts",
  reporter: "list",
  // The worker claims one job per pass; serial keeps a slow pass from starving
  // a parallel spec and reading as a product failure.
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}`, locale: "en", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      LESSON_CREATION_WORKER_ENABLED: "true",
      NODE_OPTIONS: "--require ./tests/e2e/fixtures/youtube-stub.cjs",
    },
  },
});
