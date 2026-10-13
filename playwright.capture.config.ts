import { defineConfig, devices } from "@playwright/test";

/**
 * Spec V1/V3 screenshot capture. Never builds: it runs against a server the operator started IN A WORKTREE
 * (branch on :3100, master baseline on :3101, both with E2E_ROUTE_ERROR=1), named by CAPTURE_BASE_URL, so it
 * can never measure a server built from somewhere else by accident. One worker: captures share one CPU.
 */
const baseURL = process.env.CAPTURE_BASE_URL;
if (!baseURL) throw new Error("set CAPTURE_BASE_URL (http://localhost:3100 branch, http://localhost:3101 baseline)");

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "*.capture.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 45 * 60_000,
  use: { baseURL, locale: "vi", trace: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
