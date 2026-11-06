import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { advance, FAKE_YT_STATE, fakeYt, installFakeYouTube } from "./fixtures/fake-youtube";
import { seedLearner, type Learner } from "./typography/learner";

/**
 * port-kanji Task 6 / spec §5.1: the inspect modal is `?kanji=<literal>` over any protected page, proven in a real
 * browser before its content exists — open from `/kanji` and from the lesson drawer, ‹ › on one history entry,
 * Esc / ✕ / Back / Forward / refresh / shared link, focus return, the lesson untouched underneath, garbage ignored,
 * and the Review button still a page. One learner for the file (the typography fixture), a fresh context per test.
 */
test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1280, height: 529 } });

let learner: Learner;
let session: Awaited<ReturnType<BrowserContext["storageState"]>>;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ locale: "en" });
  learner = await seedLearner(await context.newPage());
  session = await context.storageState();
  await context.close();
});
test.afterAll(async () => { await learner?.cleanup(); });

async function open(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ storageState: session, viewport: { width: 1280, height: 529 }, locale: "en" });
  await context.route(/youtube\.com|youtube-nocookie\.com|ytimg\.com|googlevideo\.com/, (route) => route.abort());
  return { context, page: await context.newPage() };
}

const modal = (page: Page) => page.locator("dialog");
const glyphLinks = (page: Page) => page.locator("main a[href*='kanji=']");
const glyphOf = async (page: Page, index: number) => ((await glyphLinks(page).nth(index).locator("span").first().textContent()) ?? "").trim();
const historyLength = (page: Page) => page.evaluate(() => window.history.length);
const search = (page: Page) => new URL(page.url()).searchParams;
const path = (page: Page) => new URL(page.url()).pathname + new URL(page.url()).search;

test("1 · /kanji?level=N5: click → ‹ › on one entry → Esc is Back, focus on the glyph → Forward reopens → Back closes", async ({ browser }) => {
  const { context, page } = await open(browser);
  await page.goto("/en/kanji?level=N5");
  const first = await glyphOf(page, 0);
  const second = await glyphOf(page, 1);
  expect(first).not.toBe("");
  expect(second).not.toBe(first);

  await glyphLinks(page).nth(0).click();
  await expect(modal(page)).toBeVisible();
  await expect(modal(page).getByText(first, { exact: true })).toBeVisible();
  await expect.poll(() => search(page).get("kanji")).toBe(first);
  expect(search(page).get("from")).toBe("level:N5");
  expect(search(page).get("level")).toBe("N5");
  const entries = await historyLength(page);

  await modal(page).getByRole("button", { name: "Next kanji" }).click();
  await expect.poll(() => search(page).get("kanji")).toBe(second);
  await expect(modal(page).getByText(second, { exact: true })).toBeVisible();
  expect(await historyLength(page)).toBe(entries);

  await page.keyboard.press("Escape");
  await expect(modal(page)).toBeHidden();
  await expect.poll(() => path(page)).toBe("/en/kanji?level=N5");
  await expect(glyphLinks(page).nth(0)).toBeFocused();

  await page.goForward();
  await expect(modal(page)).toBeVisible();
  await expect.poll(() => search(page).get("kanji")).toBe(second);
  await expect(modal(page).getByText(second, { exact: true })).toBeVisible();

  await page.goBack();
  await expect(modal(page)).toBeHidden();
  await expect.poll(() => path(page)).toBe("/en/kanji?level=N5");
  await expect(page.getByRole("heading", { level: 1, name: "Kanji" })).toBeVisible();
  await context.close();
});

test("2 · a shared link (?kanji= on the first URL): open; ✕ stays on /kanji, focus on the page heading", async ({ browser }) => {
  const { context, page } = await open(browser);
  await page.goto(`/en/kanji?kanji=${encodeURIComponent("日")}`);
  await expect(modal(page)).toBeVisible();
  await expect(modal(page).getByText("日", { exact: true })).toBeVisible();
  await expect(modal(page).getByText("Nhật")).toBeVisible();
  await expect(modal(page).getByRole("link", { name: "Open its own page" })).toHaveAttribute("href", /\/kanji\/%E6%97%A5$/);
  await expect(modal(page).getByRole("button", { name: "Next kanji" })).toHaveCount(0); // no `from`, no ‹ ›

  await modal(page).getByRole("button", { name: "Close" }).click();
  await expect(modal(page)).toBeHidden();
  await expect.poll(() => path(page)).toBe("/en/kanji");
  await expect(page.getByRole("heading", { level: 1, name: "Kanji" })).toBeFocused();
  await context.close();
});

test("3 · refresh with ?kanji= reopens the modal, and its close then stays on the page", async ({ browser }) => {
  const { context, page } = await open(browser);
  await page.goto("/en/kanji?level=N5");
  const first = await glyphOf(page, 0);
  await glyphLinks(page).nth(0).click();
  await expect.poll(() => search(page).get("kanji")).toBe(first);
  await page.reload();
  await expect(modal(page)).toBeVisible();
  await expect(modal(page).getByText(first, { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modal(page)).toBeHidden();
  await expect.poll(() => path(page)).toBe("/en/kanji?level=N5");
  await context.close();
});

test("4 · lesson drawer → View full details → modal over the playing lesson; close leaves video and drawer as they were", async ({ browser }) => {
  const { context, page } = await open(browser);
  await installFakeYouTube(page);
  await page.goto(`/en/shadowing/${learner.lesson.videoId}`);
  await expect(page.getByTestId("fake-yt")).toHaveCount(1);
  await expect.poll(async () => (await fakeYt(page)).seeks.length).toBeGreaterThan(0);

  // Play (the same steps as shadowing-intelligence.spec.ts) and let the clock run.
  const box = await page.locator("[data-workspace-player-video]").boundingBox();
  if (!box) throw new Error("player video has no box");
  await page.mouse.move(box.x + 8, box.y + 8);
  await page.getByRole("region", { name: "Player" }).getByRole("button", { name: "Play", exact: true }).last().click();
  await expect.poll(async () => (await fakeYt(page)).state).toBe(FAKE_YT_STATE.PLAYING);
  await advance(page, 1.5);

  // Select 今日 in a line → the popover's kanji → the drawer's quick inspect.
  // Line 1 is the one playing at 1.5 s, so auto-follow keeps it on screen (the popover anchors to the selection).
  const line = page.locator("li[data-index='0'] [data-line-id]");
  await line.scrollIntoViewIfNeeded();
  await line.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (node.parentElement?.closest("rt, rp") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const first = walker.nextNode() as Text;
    const range = document.createRange();
    range.setStart(first, 0);
    range.setEnd(first, Math.min(2, first.length));
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page.getByRole("dialog").getByRole("button", { name: "Kanji 今" }).click();
  const drawer = page.getByRole("region", { name: "Study tools" });
  const quickInspect = drawer.getByRole("article", { name: "Kanji 今" });
  await expect(quickInspect).toBeVisible();
  const before = await fakeYt(page);
  expect(before.state).toBe(FAKE_YT_STATE.PLAYING);

  await quickInspect.getByRole("link", { name: "View full details" }).click();
  await expect(modal(page)).toBeVisible();
  await expect(modal(page).getByText("今", { exact: true })).toBeVisible();
  await expect.poll(() => search(page).get("kanji")).toBe("今");
  expect(new URL(page.url()).pathname).toBe(`/en/shadowing/${learner.lesson.videoId}`);

  // Esc closes only the modal: the workspace's own Esc (close the Inspector) must not fire.
  await page.keyboard.press("Escape");
  await expect(modal(page)).toBeHidden();
  await expect.poll(() => search(page).get("kanji")).toBeNull();
  const after = await fakeYt(page);
  expect(after.mounts).toBe(before.mounts);
  expect(after.state).toBe(before.state);
  expect(Math.abs(after.time - before.time)).toBeLessThanOrEqual(0.5);
  await expect(quickInspect).toBeVisible();
  await expect(drawer.getByRole("heading", { level: 3 })).toHaveText("今");
  await context.close();
});

test("5 · garbage ?kanji= opens nothing and adds no history entry", async ({ browser }) => {
  const { context, page } = await open(browser);
  for (const raw of ["abc", encodeURIComponent("日本"), "%E0%A4"]) {
    await page.goto(`/en/kanji?level=N5&kanji=${raw}`);
    await expect(page.getByRole("heading", { level: 1, name: "Kanji" })).toBeVisible();
    await expect(glyphLinks(page).first()).toBeVisible();
    const entries = await historyLength(page);
    const url = page.url();
    await page.waitForTimeout(300); // nothing is scheduled to change the URL; give a stray replace the chance to show
    await expect(modal(page)).toBeHidden();
    expect(page.url()).toBe(url);
    expect(await historyLength(page)).toBe(entries);
  }
  await context.close();
});

test("6 · /kanji's Review button is the /kanji/review page, not a modal", async ({ browser }) => {
  const { context, page } = await open(browser);
  await page.goto("/en/kanji?level=N5");
  await page.locator("main").getByRole("link", { name: "Review", exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/en/kanji/review");
  await expect(modal(page)).toBeHidden();
  await context.close();
});
