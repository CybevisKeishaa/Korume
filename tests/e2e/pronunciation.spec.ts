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
  // The popover is named after the control that opened it.
  const panel = page.getByRole("dialog", { name: enPronunciation.hub.filterToggleLabel });
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

test("at desktop widths, a fresh learner sees the four honest Pronunciation Studio rail cards", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await registerLearner(page);
  await page.goto("/en/pronunciation");
  const rail = page.getByRole("complementary", { name: enPronunciation.hub.rail.label });
  for (const title of [enPronunciation.hub.rail.today.title, enPronunciation.hub.rail.weekly.title, enPronunciation.hub.rail.sensei.title, enPronunciation.hub.rail.recent.title]) {
    await expect(rail.getByRole("region", { name: title })).toBeVisible();
  }
  const today = rail.getByRole("region", { name: enPronunciation.hub.rail.today.title });
  await expect(today.locator(".text-heading", { hasText: "0" })).toBeVisible();
  await expect(today.getByText(enPronunciation.hub.rail.today.minutesUnit, { exact: true })).toBeVisible();
  await expect(rail.getByText(enPronunciation.hub.rail.scoreMissing)).toBeVisible();
  await expect(rail.getByText(enPronunciation.hub.rail.notEnoughData, { exact: true })).toHaveCount(3);
  await expect(rail.getByText("Confidence")).toHaveCount(0);
  await expect(rail.getByText(enPronunciation.hub.rail.sensei.empty)).toBeVisible();
  await expect(rail.getByText(enPronunciation.hub.rail.recent.empty)).toBeVisible();

  await page.setViewportSize({ width: 1024, height: 900 });
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

test("at 1280px, a learning path saved from the shelf stays saved and is listed under Saved paths", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 529 });
  await registerLearner(page);
  await page.goto("/en/pronunciation");

  const { paths } = enPronunciation.hub;
  // A toggle keeps ONE name; aria-pressed carries the state.
  const saveName = paths.save.replace("{title}", "Everyday Conversation");
  const shelfToggle = () => page.getByRole("region", { name: paths.title }).getByRole("button", { name: saveName });
  // The seed gives `everyday-conversation` a lesson, so its card MUST be on the shelf.
  await shelfToggle().scrollIntoViewIfNeeded();
  await expect(shelfToggle()).toHaveAttribute("aria-pressed", "false");
  const saved = page.waitForResponse((response) => response.url().includes("/save") && response.request().method() === "PUT");
  await shelfToggle().click();
  expect((await saved).status()).toBe(200);

  // Client-side navigation, not a reload: a reload would hide a stale router cache.
  // Scoped: the Shadowing Collections shelf has its own "View all".
  await page.getByRole("region", { name: paths.title }).getByRole("link", { name: new RegExp(`^${paths.viewAll}`) }).click();
  await expect(page).toHaveURL(/\/en\/pronunciation\/paths$/);
  const savedSection = page.getByRole("region", { name: paths.saved });
  await expect(savedSection.getByRole("heading", { level: 3, name: "Everyday Conversation" })).toBeVisible();

  // Unsave from the Saved section: the All-paths copy of the same path must follow.
  const removed = page.waitForResponse((response) => response.url().includes("/save") && response.request().method() === "DELETE");
  await savedSection.getByRole("button", { name: saveName }).click();
  expect((await removed).status()).toBe(200);
  const allToggle = page.getByRole("region", { name: paths.all }).getByRole("button", { name: saveName });
  await expect(allToggle).toHaveAttribute("aria-pressed", "false");
  await expect(allToggle).toBeFocused();
  await expect(savedSection.getByRole("heading", { level: 3, name: "Everyday Conversation" })).toHaveCount(0);

  // Back to the studio through the app, and the shelf shows the server's answer.
  await page.getByRole("link", { name: enPronunciation.hub.backToPronunciation }).click();
  await expect(page).toHaveURL(/\/en\/pronunciation$/);
  await expect(shelfToggle()).toHaveAttribute("aria-pressed", "false");

  await page.goto("/en/pronunciation/paths");
  await page.setViewportSize({ width: 1024, height: 900 });
  await assertNoHorizontalOverflow(page);
});

test("at 1280px, the situation, goal and shadowing collection shelves render the seeded lesson and link where it practises", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 529 });
  await registerLearner(page);
  await page.goto("/en/pronunciation");
  const { hub } = enPronunciation;

  // The seed tags its lesson `restaurant`, so that tile MUST render (L-004: no escape hatch).
  const situations = page.getByRole("region", { name: hub.situations.title });
  const restaurant = situations.getByRole("link", { name: hub.situations.startLabel.replace("{situation}", "Restaurant") });
  await restaurant.scrollIntoViewIfNeeded();
  await expect(restaurant).toBeVisible();
  expect((await restaurant.boundingBox())?.height ?? 0).toBeGreaterThan(0);

  // The seed puts the lesson in `improve-pitch-accent`; a fresh learner has no sessions, so no badge.
  const goals = page.getByRole("region", { name: hub.goals.title });
  const start = goals.getByRole("link", { name: /Improve Pitch Accent/ });
  await expect(start).toHaveAttribute("href", "/en/shadowing/e2e00000-0000-0000-0000-000000000002");
  await expect(goals.getByText(hub.goals.recommended)).toHaveCount(0);
  await expect(goals.getByRole("button")).toHaveCount(0);

  // `beginner-foundation` holds the lesson, whose transcript has three lines.
  const collections = page.getByRole("region", { name: hub.shadowingCollections.title });
  const card = collections.getByRole("link", { name: /Beginner Foundation/ });
  await expect(card).toContainText("3 sentences");
  await expect(collections.getByRole("link", { name: new RegExp(`^${hub.shadowingCollections.viewAll}`) })).toHaveAttribute("href", "/en/shadowing/explore");
  await card.click();
  await expect(page).toHaveURL(/\/en\/pronunciation\/collections\/beginner-foundation$/);

  await page.goto("/en/pronunciation");
  await page.getByRole("region", { name: hub.situations.title }).getByRole("link", { name: hub.situations.startLabel.replace("{situation}", "Restaurant") }).click();
  await expect(page).toHaveURL(/\/en\/pronunciation\?filter=situation%3Arestaurant$/);
  await page.setViewportSize({ width: 1024, height: 900 });
  await assertNoHorizontalOverflow(page);
});

test("at 1280px, JLPT Speaking shows the seeded level, unpracticed and unscored, and opens its lessons", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 529 });
  await registerLearner(page);
  await page.goto("/en/pronunciation");
  const { jlptSpeaking } = enPronunciation.hub;

  // The seed's one lesson is N5, so the N5 card MUST render (L-004) and no other level may.
  const shelf = page.getByRole("region", { name: jlptSpeaking.title });
  const n5 = shelf.getByRole("link", { name: /^N5/ });
  await n5.scrollIntoViewIfNeeded();
  await expect(n5).toBeVisible();
  await expect(shelf.getByRole("listitem")).toHaveCount(1);
  // A fresh learner: a measured 0% practiced, and no score is a dash, never a 0.
  await expect(n5).toContainText("1 lesson");
  await expect(n5).toContainText("0% practiced");
  await expect(n5).toContainText(jlptSpeaking.noScore);
  expect((await n5.boundingBox())?.height ?? 0).toBeGreaterThan(0);

  await n5.click();
  await expect(page).toHaveURL(/\/en\/pronunciation\?filter=level%3An5$/);
  await expect(page.getByRole("link", { name: /E2E Explore Lesson/ }).first()).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 900 });
  await assertNoHorizontalOverflow(page);
});

test("at 1280px, Sort & display applies through the URL, is saved to the profile, and a reset is never served stale", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 529 });
  await registerLearner(page);
  const { display, searchLabel } = enPronunciation.hub;
  await page.goto("/en/pronunciation?q=Explore");
  await expect(page.getByRole("searchbox", { name: searchLabel })).toHaveAttribute("placeholder", "Search by lesson title");

  const trigger = page.getByRole("button", { name: display.trigger });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: display.title });
  await dialog.getByRole("radio", { name: display.shortest }).check();
  await dialog.getByRole("checkbox", { name: display.hideCompleted }).check();
  const saved = page.waitForResponse((response) => response.url().includes("/api/user/preferences") && response.request().method() === "PATCH");
  await dialog.getByRole("button", { name: display.apply }).click();
  expect((await saved).status()).toBe(200);
  await expect(page).toHaveURL(/\/en\/pronunciation\?q=Explore&sort=shortest&hideCompleted=true$/);
  // The seeded lesson (180 s) still matches: the view shapes results, it does not empty them.
  await expect(page.getByRole("link", { name: /E2E Explore Lesson/ }).first()).toBeVisible();

  // A bare visit sets no display param, so the saved profile applies.
  await page.goto("/en/pronunciation?q=Explore");
  await page.getByRole("button", { name: display.trigger }).click();
  await expect(page.getByRole("radio", { name: display.shortest })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: display.hideCompleted })).toBeChecked();

  // Reset lands on this SAME URL; the router must not serve its pre-save payload (review I1).
  await page.getByRole("button", { name: display.reset }).click();
  const reset = page.waitForResponse((response) => response.url().includes("/api/user/preferences") && response.request().method() === "PATCH");
  await page.getByRole("button", { name: display.apply }).click();
  expect((await reset).status()).toBe(200);
  await expect(page).toHaveURL(/\/en\/pronunciation\?q=Explore$/);
  const reopened = page.getByRole("button", { name: display.trigger });
  await expect(reopened).not.toHaveClass(/bg-primary /);
  await reopened.click();
  await expect(page.getByRole("radio", { name: display.recommended })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: display.hideCompleted })).not.toBeChecked();
  await page.keyboard.press("Escape");
  await expect(reopened).toBeFocused();
});

test("at 1280px, a non-default display uses All lessons and Reset restores curated shelves", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await registerLearner(page);
  await page.goto("/en/pronunciation");

  const { display, paths, allLessons } = enPronunciation.hub;
  await page.getByRole("button", { name: display.trigger }).click();
  const dialog = page.getByRole("dialog", { name: display.title });
  await dialog.getByRole("radio", { name: display.shortest }).check();
  await dialog.getByRole("button", { name: display.apply }).click();
  await expect(page.getByRole("heading", { name: allLessons })).toBeVisible();
  await expect(page.getByRole("heading", { name: paths.title })).toHaveCount(0);

  await page.getByRole("button", { name: new RegExp(`^${display.trigger}`) }).click();
  await page.getByRole("button", { name: display.reset }).click();
  await page.getByRole("button", { name: display.apply }).click();
  await expect(page.getByRole("region", { name: paths.title })).toBeVisible();
  await expect(page.getByRole("heading", { name: allLessons })).toHaveCount(0);
});

test("at 1280px, Sort & display settles in and fades out, and reduced motion makes both instant", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await registerLearner(page);
  await page.goto("/en/pronunciation");
  const { display } = enPronunciation.hub;
  const trigger = page.getByRole("button", { name: display.trigger });
  const dialog = page.getByRole("dialog", { name: display.title });
  const motion = () => dialog.evaluate((node) => {
    const style = getComputedStyle(node);
    return { name: style.animationName, duration: parseFloat(style.animationDuration) };
  });

  await trigger.click();
  await expect(dialog).toBeVisible();
  expect(await motion()).toEqual({ name: "surface-in", duration: 0.3 });
  // Radix keeps the closing dialog mounted for its exit animation, then removes it.
  await page.keyboard.press("Escape");
  expect((await motion()).name).toBe("surface-out");
  await expect(dialog).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await trigger.click();
  await expect(dialog).toBeVisible();
  expect((await motion()).duration).toBeLessThan(0.001);
});
