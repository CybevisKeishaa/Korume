import { test, expect } from "@playwright/test";
import enShadowing from "@/messages/en/shadowing.json";
import enVideos from "@/messages/en/videos.json";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/app-stores";

async function registerLearner(page: import("@playwright/test").Page): Promise<void> {
  const email = `e2e_shadowing_hub_${Date.now()}@example.com`;

  await page.goto("/en/register");
  await page.getByLabel("Name").fill("E2E Shadowing Hub Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15_000 });
}

const HUB_REGIONS = [
  enShadowing.hub.sections.featured,
  enShadowing.hub.import.title,
  enShadowing.hub.sections.library,
  enShadowing.hub.sections.search,
  enShadowing.hub.sections.popular,
  enShadowing.hub.sections.continueLearning,
  enShadowing.hub.sections.recentlyAdded,
  enShadowing.hub.sections.recommended,
] as const;

const RAIL_CARDS = [
  enShadowing.hub.rail.preparation,
  enShadowing.hub.rail.todayGoal,
  enShadowing.hub.rail.weeklyProgress,
  enShadowing.hub.rail.suggestion,
] as const;

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

function expectSideBySide(
  mainBox: { x: number; y: number; width: number; height: number } | null,
  railBox: { x: number; y: number; width: number; height: number } | null,
): void {
  expect(mainBox).not.toBeNull();
  expect(railBox).not.toBeNull();
  if (!mainBox || !railBox) throw new Error("Hub main or rail has no layout box");

  expect(railBox.x).toBeGreaterThanOrEqual(mainBox.x + mainBox.width);
  expect(Math.min(mainBox.y + mainBox.height, railBox.y + railBox.height)).toBeGreaterThan(
    Math.max(mainBox.y, railBox.y),
  );
}

test("at 1023px, Shadowing exposes only the app-download handoff", async ({ page }) => {
  await page.setViewportSize({ width: 1023, height: 844 });
  await page.goto("/en/shadowing");

  const handoff = page.getByRole("main", { name: enShadowing.mobileHandoff.title });
  await expect(handoff).toBeVisible();
  await expect(handoff.getByRole("link", { name: enShadowing.mobileHandoff.appStoreLabel })).toHaveAttribute("href", APP_STORE_URL);
  await expect(handoff.getByRole("link", { name: enShadowing.mobileHandoff.playStoreLabel })).toHaveAttribute("href", PLAY_STORE_URL);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(page.locator("[data-desktop-web]")).toBeHidden();
});

test("at desktop widths, the Hub keeps every truthful region and a fixed rail through nav collapse", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await registerLearner(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/shadowing");
  await page.waitForLoadState("networkidle");

  const main = page.locator("[data-desktop-web] main");
  const rail = page.getByRole("complementary", { name: enShadowing.hub.railLabel });
  await expect(main).toBeVisible();
  await expect(rail).toBeVisible();

  for (const name of HUB_REGIONS) {
    await expect(main.getByRole("region", { name })).toBeVisible();
  }
  for (const name of RAIL_CARDS) {
    await expect(rail.getByRole("region", { name })).toBeVisible();
  }

  const importUrl = main.getByLabel("YouTube URL");
  await importUrl.focus();
  await page.keyboard.press("Tab");
  await expect(main.getByRole("button", { name: enShadowing.hub.import.title })).toBeFocused();

  let releaseImport!: () => void;
  const importResponse = new Promise<void>((resolve) => {
    releaseImport = resolve;
  });
  await page.route("**/api/videos/import", async (route) => {
    await importResponse;
    await route.fulfill({ status: 422, contentType: "application/json", body: "{}" });
  });
  await importUrl.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await main.getByRole("button", { name: enShadowing.hub.import.title }).click();
  await expect(main.getByRole("button", { name: enVideos.importing })).toBeDisabled();
  releaseImport();
  await expect(main.getByRole("alert")).toHaveText(
    "We couldn't fetch details for that video. Double-check the link and try again.",
  );

  const beforeMain = await main.boundingBox();
  const beforeRail = await rail.boundingBox();
  expect(beforeMain).not.toBeNull();
  expect(beforeRail).not.toBeNull();
  expect(beforeRail?.width).toBeCloseTo(300, 0);
  expectSideBySide(beforeMain, beforeRail);
  await assertNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Hide navigation" }).click();
  await expect(page.getByRole("button", { name: "Show navigation" })).toBeVisible();

  const afterMain = await main.boundingBox();
  const afterRail = await rail.boundingBox();
  expect(afterMain).not.toBeNull();
  expect(afterRail).not.toBeNull();
  expect(afterMain?.width).toBeGreaterThan(beforeMain?.width ?? 0);
  expect(afterRail?.width).toBeCloseTo(300, 0);
  expectSideBySide(afterMain, afterRail);
  await assertNoHorizontalOverflow(page);

  await expect(main).not.toContainText(/\b(?:ETA|estimated|\d{1,3}%|\d+\s*(?:min|minutes)\s+remaining)\b/i);
});
