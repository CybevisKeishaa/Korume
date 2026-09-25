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
  //
  // ⚠️ Ignoring it here would otherwise have left it runnable only by someone
  // who already knew this config existed — L-004's own words, "a guard no
  // command invokes is not a weaker version of a vacuous assertion, it is the
  // same defect in better clothes". So it ships as an invocation:
  // `npm run test:e2e:c4`. That command builds into the SAME `.next` as this
  // config and runs with `reuseExistingServer: false`, so it must not run
  // concurrently with `npm run test:e2e` — it would rebuild underneath it.
  //
  // `c3` deliberately gets NO such script: its specs already run here, so one
  // would only add a second build of the same coverage, and
  // `playwright.c3.config.ts` sets `reuseExistingServer: true`, which is how
  // a run ends up measuring a server built from somebody else's worktree
  // (`docs/lessons.md` L-004, the `desktop-density-pass` evidence).
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
