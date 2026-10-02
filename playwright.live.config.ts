import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

/**
 * The Ep.729 live gate (spec §8): the real YouTube iframe on a lesson seeded locally with
 * `scripts/seed-real-lesson.ts`. It runs against a server the operator already started IN THE WORKTREE
 * (`npm run build && npm run start`): it never builds, so it cannot rebuild `.next` under anyone, and the
 * webServer command only explains what is missing. Branded Chrome, not Chromium: YouTube serves H.264,
 * which Chromium builds cannot decode. One worker: the measurement shares one network and one CPU.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "*.live.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report/live" }]],
  timeout: 180_000,
  use: { baseURL, locale: "en", trace: "retain-on-failure" },
  projects: [{ name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
  webServer: {
    command: "node -e \"console.error('Start the worktree server on :3000 first: npm run build && npm run start'); process.exit(1)\"",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 10_000,
  },
});
