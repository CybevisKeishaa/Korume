import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3001);

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "shadowing-*.spec.ts",
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, locale: "en", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
