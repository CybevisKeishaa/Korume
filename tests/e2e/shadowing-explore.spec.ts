import { test, expect } from "@playwright/test";
import enShadowing from "@/messages/en/shadowing.json";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/app-stores";

const EXPLORE_LESSON_ID = "e2e00000-0000-0000-0000-000000000002";
const EXPLORE_TITLE = "E2E Explore Lesson";

async function tabTo(page: import("@playwright/test").Page, target: import("@playwright/test").Locator, limit = 40): Promise<void> {
  for (let index = 0; index < limit; index += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => document.activeElement === element)) return;
  }
  throw new Error(`Keyboard focus did not reach the requested control within ${limit} Tab presses.`);
}

async function registerLearner(page: import("@playwright/test").Page): Promise<void> {
  const email = `e2e_shadowing_explore_${Date.now()}@example.com`;
  await page.goto("/en/register");
  await page.getByLabel("Name").fill("E2E Explore Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15_000 });
}

test("at 1023px, Explore exposes only the shared app-download handoff", async ({ page }) => {
  await page.setViewportSize({ width: 1023, height: 844 });
  await page.goto("/en/shadowing/explore");

  const handoff = page.getByRole("main", { name: enShadowing.mobileHandoff.title });
  await expect(handoff).toBeVisible();
  await expect(handoff.getByRole("link", { name: enShadowing.mobileHandoff.appStoreLabel })).toHaveAttribute("href", APP_STORE_URL);
  await expect(handoff.getByRole("link", { name: enShadowing.mobileHandoff.playStoreLabel })).toHaveAttribute("href", PLAY_STORE_URL);
  await expect(page.locator("[data-desktop-web]")).toBeHidden();
});

test("at 1024px, Explore exposes a seeded shelf card and keyboard-operable local preview", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await registerLearner(page);
  await page.goto("/en/shadowing/explore");
  await page.waitForLoadState("networkidle");

  const desktop = page.locator("[data-desktop-web]");
  await expect(desktop).toBeVisible();
  await expect(desktop.getByRole("heading", { level: 1, name: enShadowing.explore.title })).toBeVisible();
  await expect(desktop.getByRole("search", { name: enShadowing.hub.sections.search })).toBeVisible();
  await expect(desktop.getByRole("region", { name: enShadowing.explore.situations })).toBeVisible();

  const restaurant = desktop.getByRole("link", { name: enShadowing.situations.restaurant });
  await expect(restaurant).toHaveAttribute("href", /situation=restaurant/);
  const search = desktop.getByRole("search", { name: enShadowing.hub.sections.search }).getByRole("textbox");
  await search.focus();
  const submit = desktop.getByRole("button", { name: enShadowing.hub.sections.search });
  await tabTo(page, submit);
  await expect(submit).toBeFocused();
  await tabTo(page, restaurant);
  await expect(restaurant).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/situation=restaurant/);

  const preview = desktop.getByRole("button", { name: `${enShadowing.explore.preview}: ${EXPLORE_TITLE}` });
  await expect(preview).toHaveCount(1);
  const previewCard = preview.locator("xpath=ancestor::li");
  await expect(previewCard.getByRole("link", { name: `${enShadowing.hub.actions.start}: ${EXPLORE_TITLE}` })).toHaveCount(1);

  await search.focus();
  await tabTo(page, preview);
  await expect(preview).toBeFocused();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: EXPLORE_TITLE });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("いらっしゃいませ。")).toBeVisible();

  const close = drawer.getByRole("button", { name: enShadowing.explore.drawer.close });
  await tabTo(page, close, 10);
  await expect(close).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(drawer).toBeHidden();
  await expect(preview).toBeFocused();

  await page.route(`**/api/videos/${EXPLORE_LESSON_ID}/library`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { alreadyAdded: false } }) });
  });
  await page.keyboard.press("Enter");
  const add = drawer.getByRole("button", { name: enShadowing.explore.drawer.add });
  await tabTo(page, add, 10);
  await expect(add).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(drawer.getByRole("button", { name: enShadowing.explore.drawer.added })).toBeDisabled();

  await page.keyboard.press("Escape");
  await page.unroute(`**/api/videos/${EXPLORE_LESSON_ID}/library`);
  await page.route(`**/api/videos/${EXPLORE_LESSON_ID}/library`, async (route) => {
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
  });
  await page.keyboard.press("Enter");
  await tabTo(page, add, 10);
  await page.keyboard.press("Enter");
  await expect(drawer.getByRole("alert")).toHaveText(enShadowing.explore.drawer.addFailed);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
