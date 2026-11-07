import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { advance, FAKE_YT_STATE, fakeYt, installFakeYouTube } from "./fixtures/fake-youtube";
import { seedLearner, type Learner } from "./typography/learner";

/**
 * port-kanji Task 6 / spec §5.1: the inspect modal is `?kanji=<literal>` over any protected page, proven in a real
 * browser before its content exists — open from `/kanji` and from the lesson drawer, ‹ › on one history entry,
 * Esc / ✕ / Back / Forward / refresh / shared link, focus return, the lesson untouched underneath, garbage ignored,
 * and the Review button still a page; Task 7: the favorite persists and lands in the "Saved kanji" strip, Add to Review
 * puts a dictionary-only kanji into the review deck; Task 9: the review in the (focus) chrome, one viewport in every state. One learner for the file (the typography fixture), a fresh context per test.
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

async function open(browser: Browser, viewport = { width: 1280, height: 529 }): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ storageState: session, viewport, locale: "en" });
  await context.route(/youtube\.com|youtube-nocookie\.com|ytimg\.com|googlevideo\.com/, (route) => route.abort());
  return { context, page: await context.newPage() };
}

const modal = (page: Page) => page.locator("dialog");
// The level grid's glyphs (the "Saved kanji" strip above it opens with from=favorites).
const glyphLinks = (page: Page) => page.locator("main a[href*='from=level']");
const glyphOf = async (page: Page, index: number) => ((await glyphLinks(page).nth(index).locator("span").first().textContent()) ?? "").trim();
// The inspect content repeats the glyph (words, composition): the heading is the one that names the kanji shown.
const glyph = (page: Page, literal: string) => modal(page).getByRole("heading", { name: literal, exact: true });
const historyLength = (page: Page) => page.evaluate(() => window.history.length);
const search = (page: Page) => new URL(page.url()).searchParams;
const path = (page: Page) => new URL(page.url()).pathname + new URL(page.url()).search;

test("1 · /kanji?level=N5: click → ‹ › on one entry → Esc is Back, focus on the glyph → Forward reopens → Back closes", async ({ browser }) => {
  const { context, page } = await open(browser);
  await page.goto("/en/kanji?level=N5");
  const first = await glyphOf(page, 0);
  const second = await glyphOf(page, 1);
  const third = await glyphOf(page, 2);
  expect(first).not.toBe("");
  expect(new Set([first, second, third]).size).toBe(3);

  await glyphLinks(page).nth(0).click();
  await expect(modal(page)).toBeVisible();
  await expect(glyph(page, first)).toBeVisible();
  await expect.poll(() => search(page).get("kanji")).toBe(first);
  expect(search(page).get("from")).toBe("level:N5");
  expect(search(page).get("level")).toBe("N5");
  const entries = await historyLength(page);

  await modal(page).getByRole("button", { name: "Next kanji" }).click();
  await expect.poll(() => search(page).get("kanji")).toBe(second);
  await expect(glyph(page, second)).toBeVisible();
  expect(await historyLength(page)).toBe(entries);

  // Keyboard ‹ ›: the focused button stays mounted across the load, so focus stays on it (R10).
  const nextButton = modal(page).getByRole("button", { name: "Next kanji" });
  const prevButton = modal(page).getByRole("button", { name: "Previous kanji" });
  await nextButton.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => search(page).get("kanji")).toBe(third);
  await expect(glyph(page, third)).toBeVisible();
  await expect(nextButton).toBeFocused();
  await prevButton.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => search(page).get("kanji")).toBe(second);
  await expect(glyph(page, second)).toBeVisible();
  await expect(prevButton).toBeFocused();
  expect(await historyLength(page)).toBe(entries);

  await page.keyboard.press("Escape");
  await expect(modal(page)).toBeHidden();
  await expect.poll(() => path(page)).toBe("/en/kanji?level=N5");
  await expect(glyphLinks(page).nth(0)).toBeFocused();

  await page.goForward();
  await expect(modal(page)).toBeVisible();
  await expect.poll(() => search(page).get("kanji")).toBe(second);
  await expect(glyph(page, second)).toBeVisible();

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
  await expect(glyph(page, "日")).toBeVisible();
  await expect(modal(page).getByText("Nhật", { exact: true })).toBeVisible();
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
  await expect(glyph(page, first)).toBeVisible();
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
  await expect(glyph(page, "今")).toBeVisible();
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

test("7 · ♡ Favorite persists across reload and shows in the /kanji strip, which reopens it", async ({ browser }) => {
  const { context, page } = await open(browser);
  await page.goto(`/en/kanji?kanji=${encodeURIComponent("日")}`);
  const favorite = () => modal(page).getByRole("button", { name: "Favorite" });
  await expect(favorite()).toHaveAttribute("aria-pressed", "false");
  await favorite().click();
  await expect(favorite()).toHaveAttribute("aria-pressed", "true");
  await expect(modal(page).locator("[aria-live='polite']")).toHaveText("Added to favorites."); // the server said yes
  await page.reload();
  await expect(favorite()).toHaveAttribute("aria-pressed", "true");
  await modal(page).getByRole("button", { name: "Close" }).click();
  await expect(modal(page)).toBeHidden();
  const saved = page.getByRole("region", { name: "Saved kanji" }).getByRole("link", { name: /日/ });
  await expect(saved).toHaveAttribute("href", /from=favorites/);
  await saved.click();
  await expect(glyph(page, "日")).toBeVisible();
  await context.close();
});

test("8 · + Add to Review on a dictionary-only kanji → 'In review' → it is in /kanji/review", async ({ browser }) => {
  const { context, page } = await open(browser);
  await page.goto(`/en/kanji?kanji=${encodeURIComponent("𠮟")}`);
  await expect(glyph(page, "𠮟")).toBeVisible();
  await expect(modal(page).getByText("Not in your review deck yet.")).toBeVisible();
  await modal(page).getByRole("button", { name: "Add to Review" }).first().click(); // the header one
  await expect(modal(page).getByRole("button", { name: "In review" })).toBeDisabled();
  await expect(modal(page).locator("[aria-live='polite']")).toHaveText("Added to your review deck.");
  await expect(modal(page).getByText("SRS stage")).toBeVisible();
  // The default deck is due rows soonest first: the fixture's own due row (if any) comes before 𠮟. Walk the deck.
  await page.goto("/en/kanji/review");
  const main = page.locator("main");
  let seen = false;
  for (let card = 1; card <= 5 && !seen; card++) {
    await expect(main.getByText(new RegExp(`^${card} / \\d+$`))).toBeVisible();
    seen = (await main.getByText("𠮟", { exact: true }).count()) > 0;
    if (!seen) {
      await page.keyboard.press("Space");
      await page.keyboard.press("3");
    }
  }
  expect(seen).toBe(true);
  await context.close();
});

// Every block ends above the CTA footer: a column that overflows its row would paint under it without any scroll.
const blocksOverflow = (page: Page, root: string) =>
  page.locator(root).evaluate((article) => {
    const footerTop = (article.querySelector("footer") as HTMLElement).getBoundingClientRect().top;
    return [...article.querySelectorAll("section[aria-label]")]
      .filter((section) => section.getBoundingClientRect().bottom > footerTop + 1)
      .map((section) => section.getAttribute("aria-label"));
  });

// The credit's line count (K10: one line) and the glyph's computed size (K15: the frame's 48 at 1440, scaled with the app).
const inspectShape = (page: Page, root: string) =>
  page.locator(root).evaluate((article) => {
    const credit = article.querySelector("footer footer") as HTMLElement;
    const glyphEl = article.querySelector("[data-type-exempt='kanji-inspect-glyph']") as HTMLElement;
    return {
      creditLines: Math.round(credit.getBoundingClientRect().height / parseFloat(getComputedStyle(credit).lineHeight)),
      credit: credit.textContent ?? "",
      glyphPx: parseFloat(getComputedStyle(glyphEl).fontSize),
    };
  });

test("9 · one viewport at 1280×529 and 1440×900: nothing scrolls, the page card fills the screen, no block runs under the footer, a one-line credit, the 48 glyph", async ({ browser }) => {
  for (const viewport of [{ width: 1280, height: 529 }, { width: 1440, height: 900 }]) {
    const { context, page } = await open(browser, viewport);
    const step = 16 * (viewport.width / 1440); // --space-md at this width (density unit = 100vw / 1440 up to 1440)
    for (const literal of ["日", "語", "学"]) { // a plain kanji, the longest Thiều Chửu lines, a three-element composition
      await page.goto(`/en/kanji?kanji=${encodeURIComponent(literal)}`);
      await expect(glyph(page, literal)).toBeVisible();
      const dialog = await modal(page).evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight, bottom: el.getBoundingClientRect().bottom }));
      expect(dialog.scroll).toBeLessThanOrEqual(dialog.client);
      expect(dialog.bottom).toBeLessThanOrEqual(viewport.height);
      expect(await blocksOverflow(page, "dialog article")).toEqual([]);
      const inModal = await inspectShape(page, "dialog article");
      expect(inModal.creditLines).toBe(1);
      expect(inModal.credit).toMatch(/\(CC BY-SA \d\.\d\)/);
      expect(inModal.glyphPx).toBeCloseTo(48 * (viewport.width / 1440), 1);

      await page.goto(`/en/kanji/${encodeURIComponent(literal)}`);
      await expect(page.getByRole("heading", { level: 1, name: literal })).toBeVisible();
      const fill = await page.evaluate(() => ({
        scroll: document.scrollingElement?.scrollHeight ?? 0,
        cardBottom: (document.querySelector("main article")?.parentElement as HTMLElement).getBoundingClientRect().bottom,
      }));
      expect(fill.scroll).toBeLessThanOrEqual(viewport.height);
      expect(fill.cardBottom).toBeGreaterThanOrEqual(viewport.height - step - 0.5);
      expect(await blocksOverflow(page, "main article")).toEqual([]);
      const onPage = await inspectShape(page, "main article");
      expect(onPage.creditLines).toBe(1);
      expect(onPage.glyphPx).toBeCloseTo(48 * (viewport.width / 1440), 1);
      // K14: the ways on fill the tall screen, and give way to the core blocks at 529.
      const saved = page.getByRole("region", { name: "Saved kanji" });
      if (viewport.height >= 800) await expect(saved).toBeVisible();
      else await expect(saved).toBeHidden();
    }
    await context.close();
  }
});

test("10 · keyboard: an inner scroller takes focus and scrolls with keys (K12); a focused chip shows its whole gloss (K13)", async ({ browser }) => {
  const { context, page } = await open(browser);
  await page.goto(`/en/kanji?kanji=${encodeURIComponent("語")}`);
  await expect(glyph(page, "語")).toBeVisible();
  const lines = modal(page).getByRole("list", { name: "Classical meaning (Thiều Chửu)" });
  expect(await lines.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true); // it does overflow at 529
  await lines.focus();
  await expect(lines).toBeFocused();
  await page.keyboard.press("PageDown");
  await expect.poll(() => lines.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

  await page.goto(`/en/kanji?kanji=${encodeURIComponent("学")}`);
  await expect(glyph(page, "学")).toBeVisible();
  const chip = modal(page).getByRole("list", { name: "Composition" }).getByRole("link").first();
  const gloss = chip.locator("span").last();
  const clipped = (el: HTMLElement) => el.scrollWidth > el.clientWidth;
  expect(await gloss.evaluate(clipped)).toBe(true); // truncated at rest
  await page.keyboard.press("Shift"); // a key press first, so the script focus below counts as keyboard focus
  await chip.focus();
  expect(await chip.evaluate((el) => el.matches(":focus-visible"))).toBe(true);
  expect(await gloss.evaluate(clipped)).toBe(false);
  await context.close();
});

// Task 9 (owner K1): the review screen is one viewport — no page scroll, the card holds its content, the footer
// sits under the card, the glyph is the frame's specimen capped to the card face.
const reviewFit = (page: Page) =>
  page.evaluate(() => {
    const card = document.querySelector("main article") as HTMLElement;
    const footer = document.querySelector("main footer") as HTMLElement;
    const glyphEl = document.querySelector("[data-type-exempt='kanji-review-glyph']") as HTMLElement | null;
    const answer = card.querySelector("section[aria-label='Answer']") as HTMLElement | null;
    return {
      scroll: document.scrollingElement?.scrollHeight ?? 0,
      inner: window.innerHeight,
      cardOverflow: card.scrollHeight - card.clientHeight,
      footerBelowCard: footer.getBoundingClientRect().top >= card.getBoundingClientRect().bottom - 0.5,
      footerBottom: footer.getBoundingClientRect().bottom,
      cardH: Math.round(card.getBoundingClientRect().height),
      glyphPx: glyphEl ? parseFloat(getComputedStyle(glyphEl).fontSize) : null,
      answer: answer ? `${answer.scrollHeight}/${answer.clientHeight}` : null,
    };
  });

async function expectOneViewport(page: Page, state: string, viewport: { width: number; height: number }) {
  const fit = await reviewFit(page);
  console.log(`K1 ${state} @${viewport.width}x${viewport.height}: ${JSON.stringify(fit)}`);
  expect(fit.scroll, state).toBeLessThanOrEqual(fit.inner);
  expect(fit.cardOverflow, state).toBeLessThanOrEqual(1);
  expect(fit.footerBelowCard, state).toBe(true);
  expect(fit.footerBottom, state).toBeLessThanOrEqual(viewport.height);
  await page.screenshot({ path: test.info().outputPath(`review-${state}-${viewport.width}x${viewport.height}.png`) });
}

const reviewGlyph = (page: Page) => page.locator("[data-type-exempt='kanji-review-glyph']");
const counter = (page: Page) => page.locator("main header").getByText(/^\d+ \/ \d+$/);

test("11 · /kanji/review?focus=𠮟 in (focus): 𠮟 first; Space reveals, 3 rates → the next card; the deck to its end; one viewport in every state at 1280×529 and 1440×900", async ({ browser }) => {
  test.setTimeout(240_000);
  for (const viewport of [{ width: 1280, height: 529 }, { width: 1440, height: 900 }]) {
    const { context, page } = await open(browser, viewport);
    await page.goto(`/en/kanji/review?focus=${encodeURIComponent("𠮟")}`);
    await expect(reviewGlyph(page)).toHaveText("𠮟");
    await expect(counter(page)).toHaveText(/^1 \/ \d+$/);
    // The (focus) chrome: the Main nav is the collapsed rail, and the (app) layout's main is not mounted.
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveAttribute("data-collapsed", "true");
    await expect(page.locator("main#main-content")).toHaveCount(0);
    for (const name of ["Again", "Hard", "Good", "Easy"]) await expect(page.getByRole("button", { name: new RegExp(`^${name}`) })).toBeDisabled();
    expect((await reviewFit(page)).glyphPx).toBeGreaterThan(48 * (viewport.width / 1440));
    await expectOneViewport(page, "pre-reveal", viewport);

    await page.keyboard.press("Space");
    const answer = page.getByRole("region", { name: "Answer" });
    await expect(answer).toBeVisible();
    // Owner 2026-11-07: the card takes focus (no ring on See details), so Space keeps working card after card.
    await expect(page.getByRole("article")).toBeFocused();
    await expect(answer.getByRole("link", { name: "See details" })).toHaveAttribute("href", /kanji=%F0%A0%AE%9F/);
    await expectOneViewport(page, "post-reveal", viewport);

    // A rating clicked with the mouse must not keep focus: the loop below reveals card 2 with Space.
    await page.getByRole("button", { name: /^Good/ }).click();
    await expect(counter(page)).toHaveText(/^2 \/ \d+$/);
    await expect(reviewGlyph(page)).not.toHaveText("𠮟");
    const total = Number(((await counter(page).textContent()) ?? "").split("/")[1]);
    for (let card = 2; card <= total; card++) {
      await expect(counter(page)).toHaveText(`${card} / ${total}`);
      await page.keyboard.press("Space");
      await expect(page.getByRole("region", { name: "Answer" })).toBeVisible();
      // 𠮟 is dictionary-only (no Hán Việt, no curated Vietnamese); a curated card carries every answer field.
      if (card === 2) await expectOneViewport(page, "post-reveal-curated", viewport);
      await page.keyboard.press(card % 4 === 0 ? "1" : "3");
    }
    const end = page.getByRole("region", { name: "Deck complete" });
    await expect(end).toBeVisible();
    await expect(page.getByRole("heading", { name: "Deck complete" })).toBeFocused();
    await expect(end.getByRole("link", { name: "Back to Kanji" })).toHaveAttribute("href", "/en/kanji");
    await expectOneViewport(page, "end-of-deck", viewport);

    // A session kanji opens the inspect over the finished deck; closing it leaves the summary as it was.
    await end.getByRole("link", { name: /𠮟/ }).click();
    await expect(glyph(page, "𠮟")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(modal(page)).toBeHidden();
    await expect(end).toBeVisible();
    await context.close();
  }
});

test("12 · an empty deck (N1 has no curated kanji) is the end state at once, one viewport; Esc leaves for /kanji; /kanji/日 is still the page", async ({ browser }) => {
  for (const viewport of [{ width: 1280, height: 529 }, { width: 1440, height: 900 }]) {
    const { context, page } = await open(browser, viewport);
    await page.goto("/en/kanji/review?level=N1");
    const end = page.getByRole("region", { name: "Nothing to review right now" });
    await expect(end).toBeVisible();
    await expect(counter(page)).toHaveText("0 / 0");
    await expect(end.getByRole("link", { name: "N3" })).toHaveAttribute("href", "/en/kanji?level=N3");
    await expectOneViewport(page, "empty-deck", viewport);
    await page.keyboard.press("Escape");
    await expect.poll(() => path(page)).toBe("/en/kanji?level=N1"); // Esc goes back to the deck's own list
    await context.close();
  }
  const { context, page } = await open(browser);
  await page.goto(`/en/kanji/${encodeURIComponent("日")}`);
  await expect(page.getByRole("heading", { level: 1, name: "日" })).toBeVisible();
  await expect(modal(page)).toBeHidden();
  await context.close();
});

// Task 9b (owner K4): motion. Samples every frame for a while: the kanji motions that ran, and the worst overflow of the
// page, the open dialog and the review card. K1 must hold mid-motion, not only at rest.
type Motion = { ran: string[]; pageOver: number; dialogOver: number; cardOver: number };
const startSampling = (page: Page, ms = 1500) =>
  page.evaluate((ms) => {
    (window as unknown as { __motion: Promise<Motion> }).__motion = new Promise((resolve) => {
      const ran = new Set<string>();
      const worst = { pageOver: 0, dialogOver: 0, cardOver: 0 };
      const begin = performance.now();
      const over = (el: Element | null) => (el ? el.scrollHeight - el.clientHeight : 0);
      const tick = () => {
        for (const a of document.getAnimations()) {
          if (a.playState !== "running") continue;
          ran.add(a instanceof CSSAnimation ? a.animationName : a instanceof CSSTransition ? `transition:${a.transitionProperty}` : "other");
        }
        const scroller = document.scrollingElement as HTMLElement;
        worst.pageOver = Math.max(worst.pageOver, scroller.scrollHeight - window.innerHeight, scroller.scrollWidth - window.innerWidth);
        worst.dialogOver = Math.max(worst.dialogOver, over(document.querySelector("dialog[open]")));
        worst.cardOver = Math.max(worst.cardOver, over(document.querySelector("main article")));
        if (performance.now() - begin < ms) requestAnimationFrame(tick);
        else resolve({ ran: [...ran].sort(), ...worst });
      };
      requestAnimationFrame(tick);
    });
  }, ms);
const sampled = (page: Page) => page.evaluate(() => (window as unknown as { __motion: Promise<Motion> }).__motion);
const kanjiMotions = (motion: Motion) => motion.ran.filter((name) => /^(kanji-|surface-|overlay-|transition:)/.test(name));

/** Waits frame by frame until a `name` animation runs, presses `key` right then: did it act while the motion ran? */
const pressDuring = (page: Page, name: string, key: string) =>
  page.evaluate(async ({ name, key }) => {
    const running = () => document.getAnimations().some((a) => a instanceof CSSAnimation && a.animationName === name && a.playState === "running");
    for (let i = 0; i < 300 && !running(); i++) await new Promise(requestAnimationFrame);
    const during = running();
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    await new Promise(requestAnimationFrame);
    return { during, answer: document.querySelector("section[aria-label='Answer']") !== null };
  }, { name, key });

test("13 · motion (K4): open, ›, ♡, close, reveal, rate → next card all move, and K1 holds mid-motion; keys act during it", async ({ browser }) => {
  const { context, page } = await open(browser);
  await page.goto("/en/kanji?level=N5");
  const first = await glyphOf(page, 0);
  const second = await glyphOf(page, 1);

  await startSampling(page);
  await glyphLinks(page).nth(0).click();
  await expect(glyph(page, first)).toBeVisible();
  let motion = await sampled(page);
  console.log(`motion open: ${JSON.stringify(motion)}`);
  expect(motion.ran).toEqual(expect.arrayContaining(["surface-in", "overlay-in", "kanji-step"]));
  expect(motion.dialogOver).toBeLessThanOrEqual(0); // the dialog is the one-viewport surface here (the level list below it scrolls)

  await startSampling(page);
  await modal(page).getByRole("button", { name: "Next kanji" }).click();
  await expect(glyph(page, second)).toBeVisible();
  await expect(modal(page)).toHaveAttribute("data-step", "next");
  motion = await sampled(page);
  console.log(`motion next: ${JSON.stringify(motion)}`);
  expect(motion.ran).toContain("kanji-step");
  expect(motion.dialogOver).toBeLessThanOrEqual(0);

  const favorite = modal(page).getByRole("button", { name: "Favorite" });
  await startSampling(page, 600);
  await favorite.click();
  await expect(favorite).toHaveAttribute("aria-pressed", "true");
  expect((await sampled(page)).ran).toContain("kanji-pop");
  await favorite.click(); // leave the learner's favorites as they were
  await expect(favorite).toHaveAttribute("aria-pressed", "false");
  await expect(modal(page).getByText("Removed from favorites.")).toBeAttached();

  await startSampling(page, 800);
  await page.keyboard.press("Escape");
  await expect(modal(page)).toBeHidden();
  motion = await sampled(page);
  console.log(`motion close: ${JSON.stringify(motion)}`);
  expect(motion.ran).toEqual(expect.arrayContaining(["surface-out", "overlay-out", "transition:overlay"])); // the close fades, held in the top layer
  await expect(glyphLinks(page).nth(0)).toBeFocused(); // focus still returns to the opener
  await expect(modal(page)).toBeEmpty(); // the held content goes once the fade ends

  const reviews: unknown[] = [];
  page.on("request", (request) => { if (request.url().endsWith("/api/srs/review") && request.method() === "POST") reviews.push(request.postDataJSON()); });
  await page.goto(`/en/kanji/review?focus=${encodeURIComponent("日")}`);
  await expect(reviewGlyph(page)).toHaveText("日");
  const total = Number(((await counter(page).textContent()) ?? "").split("/")[1]);
  expect(total).toBeGreaterThanOrEqual(2);

  await startSampling(page);
  await page.keyboard.press("Space");
  await expect(page.getByRole("article")).toBeFocused();
  motion = await sampled(page);
  console.log(`motion reveal: ${JSON.stringify(motion)}`);
  expect(motion.ran).toContain("kanji-answer-in");
  expect(motion.pageOver).toBeLessThanOrEqual(0);
  expect(motion.cardOver).toBeLessThanOrEqual(1);

  // A rating, then a second one at once (during the card's exit): one save, for the card that was rated.
  await startSampling(page);
  await page.keyboard.press("3");
  await page.keyboard.press("1");
  await expect(counter(page)).toHaveText(`2 / ${total}`);
  expect(await pressDuring(page, "kanji-card-in", " ")).toEqual({ during: true, answer: true }); // Space while the next card steps in
  motion = await sampled(page);
  console.log(`motion rate→next: ${JSON.stringify(motion)}`);
  expect(kanjiMotions(motion)).toEqual(expect.arrayContaining(["kanji-card-in", "kanji-answer-in"]));
  expect(motion.pageOver).toBeLessThanOrEqual(0);
  expect(motion.cardOver).toBeLessThanOrEqual(1);
  expect(reviews).toEqual([{ itemType: "kanji", itemId: "日", quality: 4 }]);
  await context.close();
});

test("14 · reduced motion (OS setting): the same steps change state at once, no kanji motion runs", async ({ browser }) => {
  const { context, page } = await open(browser);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/kanji?level=N5");
  await startSampling(page);
  await glyphLinks(page).nth(0).click();
  await expect(modal(page).getByRole("button", { name: "Next kanji" })).toBeVisible();
  await modal(page).getByRole("button", { name: "Next kanji" }).click();
  await expect(modal(page)).toHaveAttribute("data-step", "next");
  await page.keyboard.press("Escape");
  await expect(modal(page)).toBeHidden();
  let motion = await sampled(page);
  console.log(`reduced inspect: ${JSON.stringify(motion)}`);
  expect(kanjiMotions(motion)).toEqual([]); // test 13 proves this sampler sees each of them when motion is on

  await page.goto(`/en/kanji/review?focus=${encodeURIComponent("日")}`);
  await expect(reviewGlyph(page)).toHaveText("日");
  await startSampling(page);
  await page.keyboard.press("Space");
  await expect(page.getByRole("region", { name: "Answer" })).toBeVisible();
  await page.keyboard.press("3");
  await expect(counter(page)).toHaveText(/^2 \/ \d+$/);
  motion = await sampled(page);
  console.log(`reduced review: ${JSON.stringify(motion)}`);
  expect(kanjiMotions(motion)).toEqual([]);
  await context.close();
});

test("15 · a composition chip in the modal replaces the entry: no history added, one Esc closes", async ({ browser }) => {
  const { context, page } = await open(browser);
  await page.goto(`/en/kanji?kanji=${encodeURIComponent("語")}`);
  await expect(modal(page)).toBeVisible();
  const entries = await historyLength(page);
  await modal(page).getByRole("region", { name: "Composition" }).getByRole("link").first().click();
  await expect.poll(() => search(page).get("kanji")).not.toBe("語");
  expect(await historyLength(page)).toBe(entries);
  await page.keyboard.press("Escape");
  await expect(modal(page)).toBeHidden();
  await context.close();
});
