import { expect, test } from "@playwright/test";
import enPronunciation from "@/messages/en/pronunciation.json";
import { registerViaUi } from "./fixtures/auth";

async function registerLearner(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/en/register");
  await registerViaUi(page, {
    name: "E2E Pronunciation Tester",
    // A UUID, not Date.now(): parallel workers collided on the same millisecond (run state, 2026-09-28).
    email: `e2e_pronunciation_${crypto.randomUUID()}@example.com`,
    password: "password123",
  });
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15_000 });
}

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

test("at 1280px, pronunciation discovery controls share the heading row and search", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 529 });
  await registerLearner(page);
  await page.goto("/en/pronunciation");

  const title = page.getByRole("heading", { name: enPronunciation.hub.title });
  const header = title.locator("..");
  const search = page.getByRole("searchbox", { name: enPronunciation.hub.searchLabel });
  const trigger = page.getByRole("button", { name: enPronunciation.hub.filterToggleLabel });
  await expect(title).toBeVisible();
  await expect(search).toBeVisible();
  await expect(trigger).toBeVisible();

  const [headerBox, searchBox, triggerBox] = await Promise.all([
    header.boundingBox(),
    search.boundingBox(),
    trigger.boundingBox(),
  ]);
  expect(headerBox).not.toBeNull();
  expect(searchBox).not.toBeNull();
  expect(triggerBox).not.toBeNull();
  if (!headerBox || !searchBox || !triggerBox) throw new Error("Pronunciation header controls have no layout box");

  // `header` is the eyebrow/h1/subtitle block alone, so the controls must
  // start past its RIGHT edge — not merely past its middle — to share its row.
  const headerRight = headerBox.x + headerBox.width;
  const headerBottom = headerBox.y + headerBox.height;
  expect(searchBox.x).toBeGreaterThanOrEqual(headerRight);
  expect(triggerBox.x).toBeGreaterThan(searchBox.x + searchBox.width);
  expect(Math.abs(searchBox.y + searchBox.height - headerBottom)).toBeLessThanOrEqual(8);
  expect(Math.abs(triggerBox.y + triggerBox.height - headerBottom)).toBeLessThanOrEqual(8);
  expect(searchBox.width).toBeGreaterThanOrEqual(200);

  await trigger.click();
  const panel = page.getByRole("dialog");
  await expect(panel).toBeVisible();
  expect((await panel.boundingBox())?.width).toBeGreaterThan(120);
  await expect(panel.getByRole("link").first()).toHaveAttribute("href", /^\/en\/pronunciation/);

  await search.fill("restaurant");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/en\/pronunciation\?q=restaurant$/);
});

// Not 320: below 1024 every route renders only the app-store handoff, and
// `mobile-app-handoff.spec.ts` owns WCAG 1.4.10 there. 1024 is the narrowest
// width at which this page is painted at all.
test("at 1024px, pronunciation renders without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await registerLearner(page);
  await page.goto("/en/pronunciation");
  await expect(page.getByRole("heading", { name: enPronunciation.hub.title })).toBeVisible();
  await assertNoHorizontalOverflow(page);
});

test("at 1280px, the featured course region is visible and its preview is responsive", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 529 });
  await registerLearner(page);
  await page.goto("/en/pronunciation");
  const hero = page.getByRole("region", { name: enPronunciation.hub.featuredCourse });
  await expect(hero).toBeVisible();
  const heroBox = await hero.boundingBox();
  expect(heroBox).not.toBeNull();
  expect(heroBox?.width).toBeGreaterThan(0);
  expect(heroBox?.height).toBeGreaterThan(0);
  // The hero sits BELOW the search row with a real gap, not flush against it.
  const searchBox = await page.getByRole("search", { name: enPronunciation.hub.searchLabel }).boundingBox();
  expect(searchBox).not.toBeNull();
  expect((heroBox?.y ?? 0) - ((searchBox?.y ?? 0) + (searchBox?.height ?? 0))).toBeGreaterThanOrEqual(16);
  // The seed puts a lesson in `everyday-conversation`, so a course hero MUST render:
  // no `if (count)` escape hatch that would let an empty page pass (L-004).
  const preview = hero.getByRole("link", { name: new RegExp(`^${enPronunciation.hub.previewCourse}:`) });
  await expect(preview).toBeVisible();
  await preview.click();
  await expect(page).toHaveURL(/\/en\/pronunciation\/collections\/everyday-conversation$/);
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toBeVisible();
  expect((await heading.boundingBox())?.height ?? 0).toBeGreaterThan(0);
  await page.setViewportSize({ width: 1024, height: 900 });
  await assertNoHorizontalOverflow(page);
});
