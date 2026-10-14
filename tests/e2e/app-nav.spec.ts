import { expect, test, type Page } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./fixtures/auth";
import { seedWorkspaceData, type WorkspaceData } from "./fixtures/workspace-data";
import { REVIEW_SUBMITTED_EVENT } from "@/lib/nav/nav-state";

/**
 * The learner sidebar in a real Chromium build (spec docs/superpowers/specs/2026-10-14-app-chrome-refresh-design.md
 * §5 E1–E7 + A1). `seedWorkspaceData` supplies the service-role client and the (focus) lesson: its main video is the
 * newest, so the Shadowing hub lists it (the dev seed row "E2E Seed Video" falls off the hub's list once it is seeded).
 */
test.describe.configure({ mode: "serial" });
let lesson: WorkspaceData;
let userId: string | undefined;

test.beforeAll(async () => { lesson = await seedWorkspaceData(); });
test.afterAll(async () => { await lesson?.cleanup(); });
test.afterEach(async () => {
  if (userId) {
    await lesson.admin.from("user_kanji_progress").delete().eq("user_id", userId);
    const deleted = await lesson.admin.auth.admin.deleteUser(userId);
    if (deleted.error) throw deleted.error;
    userId = undefined;
  }
});

const lessonTitle = () => new RegExp(`${lesson.prefix} 会話の練習`);
const nav = (page: Page) => page.getByRole("navigation", { name: "Main", exact: true });
const width = (page: Page) => nav(page).evaluate((el) => el.getBoundingClientRect().width);
// The width animates for ~200ms on a toggle (spec 3.2): wait for it to settle on the target, never read mid-flight.
const settlesAt = (page: Page, target: number) => expect.poll(async () => Math.abs((await width(page)) - target)).toBeLessThanOrEqual(0.5);

async function register(page: Page) {
  const email = uniqueEmail("e2e_appnav");
  await page.goto("/en/register");
  await registerViaUi(page, { name: "Nav Learner", email, password: "password123" });
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15_000 });
  userId = await lesson.userIdByEmail(email);
}

/** Client navigation Lessons → the seeded video card, landing in (focus) (its lesson header carries "Learning modes"). */
async function enterFocus(page: Page) {
  await nav(page).getByRole("link", { name: "Lessons", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/shadowing$/, { timeout: 15_000 });
  await page.getByRole("link", { name: lessonTitle() }).first().click();
  await expect(page).toHaveURL(/\/en\/shadowing\/.+$/, { timeout: 15_000 });
  await expect(page.getByRole("navigation", { name: "Learning modes" })).toHaveCount(1);
}

test("E1 the rail choice survives a reload", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 529 });
  await register(page);
  await page.getByRole("button", { name: "Collapse navigation" }).click();
  await page.reload();
  await expect(nav(page)).toHaveAttribute("data-collapsed", "true");
  expect(await width(page)).toBeCloseTo(72, 0);
  await page.getByRole("button", { name: "Expand navigation" }).click();
  await page.reload();
  await expect(nav(page)).toHaveAttribute("data-collapsed", "false");
  expect(await width(page)).toBeCloseTo(240, 0);
});

test("E2 (focus) is the rail and never overwrites the (app) choice", async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 529 });
  await register(page);
  await expect(nav(page)).toHaveAttribute("data-collapsed", "false");
  const sentinel = () => page.evaluate(() => (window as unknown as { __navSentinel?: number }).__navSentinel);
  await page.evaluate(() => { (window as unknown as { __navSentinel?: number }).__navSentinel = 1; });
  // client navigation into (focus)
  await enterFocus(page);
  expect(await sentinel()).toBe(1);
  await expect(nav(page)).toHaveAttribute("data-collapsed", "true");
  await page.getByRole("button", { name: "Expand navigation" }).click();
  await expect(nav(page)).toHaveAttribute("data-collapsed", "false");
  await page.getByRole("button", { name: "Collapse navigation" }).click();
  const cookie = async () => (await context.cookies()).find((c) => c.name === "korume_nav")?.value;
  expect(await cookie()).toBeUndefined();
  // client navigation back to (app)
  await nav(page).getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/dashboard$/);
  expect(await sentinel()).toBe(1);
  await expect(nav(page)).toHaveAttribute("data-collapsed", "false");
  await page.reload();
  await expect(nav(page)).toHaveAttribute("data-collapsed", "false");
  // collapsed (app) choice survives a full-load round trip through (focus)
  await page.getByRole("button", { name: "Collapse navigation" }).click();
  expect(await cookie()).toBe("collapsed");
  await page.goto("/en/shadowing");
  await page.getByRole("link", { name: lessonTitle() }).first().click();
  await expect(page).toHaveURL(/\/en\/shadowing\/.+$/, { timeout: 15_000 });
  await expect(page.getByRole("navigation", { name: "Learning modes" })).toHaveCount(1);
  await page.getByRole("button", { name: "Expand navigation" }).click();
  await expect(nav(page)).toHaveAttribute("data-collapsed", "false");
  await page.goto("/en/dashboard");
  await expect(nav(page)).toHaveAttribute("data-collapsed", "true");
  expect(await cookie()).toBe("collapsed");
});

test("E3 the review badge drops right after a saved review, same route", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 529 });
  await register(page);
  // /kanji/review without ?level= applies no level filter (getReviewQueue("kanji", undefined)), and due cards come
  // first, so any kanji seeded as due is the first card.
  const kanji = await lesson.admin.from("kanji").select("id").order("id").limit(1).single();
  if (kanji.error) throw kanji.error;
  const earlier = "2020-01-01T00:00:00.000Z"; // long past, so due; a literal (e2e sources never read the clock)
  const seeded = await lesson.admin.from("user_kanji_progress").insert({
    user_id: userId, kanji_id: kanji.data.id, srs_stage: 1, next_review_at: earlier, last_reviewed_at: earlier,
  });
  if (seeded.error) throw seeded.error;
  await page.goto("/en/kanji/review");
  const review = nav(page).getByRole("link", { name: /^Review/ });
  await expect(review).toHaveAccessibleName("Review, 1 due");
  const url = page.url();
  const navigations: string[] = [];
  page.on("framenavigated", (frame) => { if (frame === page.mainFrame()) navigations.push(frame.url()); });
  await page.getByRole("button", { name: /show answer/i }).click();
  await page.getByRole("button", { name: /good/i }).click();
  await expect(review).toHaveAccessibleName("Review");
  expect(page.url()).toBe(url);
  expect(navigations).toEqual([]);
});

async function topmostInside(page: Page, selector: string) {
  const result = await page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect();
    // The tooltip is pointer-events: none, and hit testing skips such elements, so elementFromPoint would always
    // report whatever is beneath it. Make it hittable for this one synchronous read: then the hit is the paint order.
    const element = el as HTMLElement;
    const previous = element.style.pointerEvents;
    element.style.pointerEvents = "auto";
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    element.style.pointerEvents = previous;
    const name = (node: Element | null) => node ? `${node.tagName.toLowerCase()}.${[...node.classList].join(".")}` : "none";
    return {
      inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, topmost: !!hit && el.contains(hit),
      hit: name(hit),
    };
  });
  console.log(`[E4] ${selector} on ${new URL(page.url()).pathname}: ${JSON.stringify(result)}`);
  return result;
}

/** Menu (both modes), rail tooltip (programmatic focus) and bell panel on whatever page `page` is on, in rail mode at the end. */
async function overlaysOnTop(page: Page) {
  const account = page.getByRole("button", { name: /'s account$/ });
  const menu = page.getByRole("menu");
  if ((await nav(page).getAttribute("data-collapsed")) === "false") {
    await account.click();
    expect(await topmostInside(page, '[role="menu"]')).toMatchObject({ inside: true, topmost: true });
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(account).toBeFocused();
    await page.getByRole("button", { name: "Collapse navigation" }).click();
    await settlesAt(page, 72);
  }
  await account.click();
  expect(await topmostInside(page, '[role="menu"]')).toMatchObject({ inside: true, topmost: true });
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await nav(page).getByRole("link", { name: "Kanji", exact: true }).focus();
  expect(await topmostInside(page, '[role="tooltip"]')).toMatchObject({ inside: true, topmost: true });
  await page.getByRole("button", { name: /^Notifications/ }).click();
  expect(await topmostInside(page, '[role="dialog"]')).toMatchObject({ inside: true });
  await page.keyboard.press("Escape");
}

test("E4 account menu, rail tooltip and bell panel sit on top, inside 1280x529 (Dashboard)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 529 });
  await register(page);
  await overlaysOnTop(page);
});

test("E4 the same overlays sit on top of a (focus) lesson page", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 529 });
  await register(page);
  await enterFocus(page);
  await expect(nav(page)).toHaveAttribute("data-collapsed", "true");
  await overlaysOnTop(page);
});

test("E4 R10 a rail item reached by Tab below the visible list shows its tooltip beside it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 529 });
  await register(page);
  await page.getByRole("button", { name: "Collapse navigation" }).click();
  await settlesAt(page, 72);
  // Focus stays on the toggle (now "Expand navigation"); the next Tab stop is the first rail item.
  await expect(page.getByRole("button", { name: "Expand navigation" })).toBeFocused();
  const scroll = nav(page).locator("[data-nav-scroll]");
  const hiddenIndex = await scroll.evaluate((el) => {
    const bottom = el.getBoundingClientRect().bottom;
    return Array.from(el.querySelectorAll(".app-nav__item")).findIndex((item) => item.getBoundingClientRect().top >= bottom);
  });
  expect(hiddenIndex).toBeGreaterThan(0);
  for (let i = 0; i <= hiddenIndex; i += 1) await page.keyboard.press("Tab");
  const target = scroll.locator(".app-nav__item").nth(hiddenIndex);
  await expect(target).toBeFocused();
  expect(await scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  // Two frames: any scroll event the scroll-into-view queues has been dispatched by then.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toHaveCount(1);
  expect(await tooltip.textContent()).toBe(await target.getAttribute("aria-label"));
  expect(await topmostInside(page, '[role="tooltip"]')).toMatchObject({ inside: true, topmost: true });
  // Beside the item where it sits now (after the scroll), not where it was before it.
  const item = await target.evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
  const tip = await tooltip.evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
  expect(Math.abs(tip.top + tip.height / 2 - (item.top + item.height / 2))).toBeLessThanOrEqual(1);
  expect(tip.left).toBeGreaterThanOrEqual(item.right);
});

test("E6 an expired session clears personal data and lands on sign-in", async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 529 });
  await register(page);
  await expect(nav(page).getByText("Nav Learner")).toBeVisible();
  const names = (await context.cookies()).map((c) => c.name);
  expect(names.filter((name) => name.startsWith("sb-")).length).toBeGreaterThan(0);
  await context.clearCookies({ name: /^sb-/ });
  // Drive useNavSummary itself, not a navigation: a link click would be redirected by the middleware before the hook
  // ever saw a 401 (final review I2). The probe records what the nav showed as the page went away.
  await page.evaluate((event) => {
    addEventListener("pagehide", () => {
      const main = document.querySelector('nav[aria-label="Main"]');
      sessionStorage.setItem("e6-name-at-unload", main?.textContent?.includes("Nav Learner") ? "present" : "gone");
    });
    dispatchEvent(new Event(event));
  }, REVIEW_SUBMITTED_EVENT);
  // Only the hook's reload can get here: nothing else started a navigation, and the middleware sends the reloaded
  // signed-out request to sign-in with this page as redirectTo.
  await expect(page).toHaveURL(/\/en\/login\?redirectTo=%2Fen%2Fdashboard$/, { timeout: 15_000 });
  expect(await page.evaluate(() => sessionStorage.getItem("e6-name-at-unload"))).toBe("gone");
  await expect(page.getByText("Nav Learner")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /'s account$/ })).toHaveCount(0);
});

test("E7 every interactive nav target is at least 44px tall", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 529 });
  await register(page);
  for (const collapsed of [false, true]) {
    if (collapsed) {
      await page.getByRole("button", { name: "Collapse navigation" }).click();
      await settlesAt(page, 72);
    }
    const heights = await nav(page).locator("a, button").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThanOrEqual(15);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(43.5);
    await page.getByRole("button", { name: /'s account$/ }).click();
    const items = await page.locator('[role="menu"] [role^="menuitem"]').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
    expect(items.length).toBe(4);
    for (const h of items) expect(h).toBeGreaterThanOrEqual(43.5);
    await page.keyboard.press("Escape");
  }
});

for (const [vw, vh, expanded, rail, row] of [[1280, 529, 240, 72, 44], [1440, 900, 270, 81, 44], [1920, 1080, 337.5, 101.25, 47.8]] as const) {
  test(`A1 sizes at ${vw}x${vh}`, async ({ page }) => {
    await page.setViewportSize({ width: vw, height: vh });
    await register(page);
    const rowHeight = () => nav(page).locator(".app-nav__item").first().evaluate((el) => el.getBoundingClientRect().height);
    const top = (selector: string) => nav(page).locator(selector).evaluate((el) => el.getBoundingClientRect().top);
    const measured: Record<string, number> = {};
    for (const mode of ["expanded", "rail"] as const) {
      if (mode === "rail") {
        await page.getByRole("button", { name: "Collapse navigation" }).click();
        await settlesAt(page, rail);
      }
      measured[`${mode} width`] = await width(page);
      measured[`${mode} row`] = await rowHeight();
      expect(Math.abs(measured[`${mode} width`]! - (mode === "expanded" ? expanded : rail))).toBeLessThanOrEqual(0.5);
      expect(Math.abs(measured[`${mode} row`]! - row)).toBeLessThanOrEqual(0.5);
      const scroll = nav(page).locator("[data-nav-scroll]");
      const headerBefore = await top(".app-nav__header");
      const footerBefore = await top(".app-nav__footer");
      await scroll.evaluate((el) => { el.scrollTop = el.scrollHeight; });
      measured[`${mode} list scrolled`] = await scroll.evaluate((el) => el.scrollTop);
      expect(await top(".app-nav__header")).toBeCloseTo(headerBefore, 0);
      expect(await top(".app-nav__footer")).toBeCloseTo(footerBefore, 0);
      await scroll.evaluate((el) => { el.scrollTop = 0; });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    console.log(`[A1] ${vw}x${vh}: ${JSON.stringify(measured)}`);
  });
}
