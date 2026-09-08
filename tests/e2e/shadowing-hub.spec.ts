import { test, expect } from "@playwright/test";

async function registerLearner(page: import("@playwright/test").Page): Promise<void> {
  const email = `e2e_shadowing_hub_${Date.now()}@example.com`;

  await page.goto("/en/register");
  await page.getByLabel("Name").fill("E2E Shadowing Hub Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15_000 });
}

test("the Shadowing Hub keeps core study controls usable without fabricated progress", async ({ page }) => {
  await registerLearner(page);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/shadowing");
  await page.waitForLoadState("networkidle");

  const main = page.getByRole("main");
  await expect(main).toHaveCount(1);
  await expect(main.getByRole("heading", { name: "Shadowing Hub", level: 1 })).toBeVisible();
  await expect(main.getByRole("search", { name: "Search lessons" })).toBeVisible();
  await expect(main.getByLabel("YouTube URL")).toBeVisible();

  let releaseImport!: () => void;
  const importResponse = new Promise<void>((resolve) => {
    releaseImport = resolve;
  });
  await page.route("**/api/videos/import", async (route) => {
    await importResponse;
    await route.fulfill({ status: 422, contentType: "application/json", body: "{}" });
  });
  await main.getByLabel("YouTube URL").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await main.getByRole("button", { name: "Import video" }).click();
  await expect(main.getByRole("button", { name: "Importingâ€¦" })).toBeDisabled();
  releaseImport();
  await expect(main.getByRole("alert")).toHaveText(
    "We couldn't fetch details for that video. Double-check the link and try again.",
  );

  // The import is keyboard-operable in the empty-learning state. Focusing the
  // URL field and advancing with Tab is intentionally a native keyboard path,
  // not a programmatic button click.
  await main.getByLabel("YouTube URL").focus();
  await page.keyboard.press("Tab");
  await expect(main.getByRole("button", { name: "Import video" })).toBeFocused();

  await expect(page.getByRole("complementary", { name: "Learning continuity" })).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  // A fresh learner has no server-backed building job, percentage, ETA, or
  // weekly shadowing history to display. Its honest empty state must remain
  // visible instead of being replaced by Figma sample progress.
  await expect(main).not.toContainText(/\b(?:ETA|estimated|\d{1,3}%|\d+\s*(?:min|minutes)\s+remaining)\b/i);

  await page.setViewportSize({ width: 1536, height: 900 });
  await expect(page.getByRole("complementary", { name: "Learning continuity" })).toBeVisible();
});
