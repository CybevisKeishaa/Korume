import { expect, test, type Page } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./fixtures/auth";
import { advance, FAKE_YT_STATE, fakeYt, installFakeYouTube } from "./fixtures/fake-youtube";
import { FULL_ONLY_SENTINEL, SEEDED, seedKnowledgeData, type KnowledgeData } from "./fixtures/knowledge-data";
import { lineText, seedWorkspaceData, VIDEO_DURATION, type WorkspaceData } from "./fixtures/workspace-data";

/**
 * Deterministic acceptance for Part 1b after the reframe (reframe plan Task R5): Shadowing keeps Mining, Notes
 * and the kanji Inspector, and sends nothing to the Knowledge core, which stays dormant but proven at the API.
 * The server runs with AI_PROVIDER=none: every AI answer is a seeded cache entry or a 503. The fake
 * `YT.Player` from 1a drives the clock. The owner's viewport, a fresh learner per test.
 */
test.use({ viewport: { width: 1280, height: 529 } });

/** The seeded line: row index 4, "今日は5番目の文を読みます。" plus the seed's suffix. */
const AI_ROW = 4;
let data: WorkspaceData;
let knowledge: KnowledgeData;
test.beforeAll(async () => {
  data = await seedWorkspaceData();
  knowledge = await seedKnowledgeData(data.admin, { id: data.lineIds[AI_ROW]!, text: lineText(AI_ROW), videoId: data.videoId });
});
test.afterAll(async () => { await knowledge?.cleanup(); await data?.cleanup(); });

async function registerLearner(page: Page): Promise<string> {
  await page.route(/youtube\.com|youtube-nocookie\.com|googlevideo\.com/, (route) => route.abort());
  await installFakeYouTube(page, { duration: VIDEO_DURATION });
  const email = uniqueEmail("e2e_ai");
  await page.goto("/en/register");
  await registerViaUi(page, { name: "E2E Intelligence", email, password: "password123" });
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15_000 });
  return email;
}

async function openLesson(page: Page): Promise<void> {
  await page.goto(`/en/shadowing/${data.videoId}`);
  await expect(page.getByTestId("fake-yt")).toHaveCount(1);
  await expect.poll(async () => (await fakeYt(page)).seeks.length).toBeGreaterThan(0);
}

const row = (page: Page, index: number) => page.locator(`li[data-index='${index}']`);
const drawer = (page: Page) => page.getByRole("region", { name: "Study tools" });
const panel = (page: Page) => drawer(page).getByRole("tabpanel");
const separator = (page: Page) => page.getByRole("separator", { name: "Resize study tools" });
const inspectorTitle = (page: Page) => drawer(page).getByRole("heading", { level: 3 });
/** Every request the page makes, as path plus query. */
const requests = (page: Page) => {
  const urls: string[] = [];
  page.on("request", (request) => { const url = new URL(request.url()); urls.push(url.pathname + url.search); });
  return urls;
};
const postSection = (page: Page, section: string) => page.request.post("/api/knowledge/sections", {
  data: { transcriptLineId: data.lineIds[AI_ROW], section, locale: "en" },
});

/** A row's actions appear while the row is hovered (or holds focus), like 1a's. */
async function rowAction(page: Page, index: number, name: string): Promise<void> {
  const button = row(page, index).getByRole("button", { name, exact: true });
  await button.scrollIntoViewIfNeeded();
  // The pointer goes to the button's own spot first: hovering that spot is what lets the toolbar take the click.
  await button.hover({ force: true });
  await button.click();
}

/** Selects UTF-16 [0, length) of a row's text with a real Range, then releases the mouse as a drag would. */
async function selectInRow(page: Page, index: number, length: number): Promise<void> {
  await row(page, index).locator("[data-line-id]").evaluate((element, chars) => {
    const range = document.createRange();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (node.parentElement?.closest("rt, rp") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const first = walker.nextNode() as Text;
    range.setStart(first, 0);
    let remaining = chars;
    let node: Text | null = first;
    while (node && remaining > node.length) { remaining -= node.length; node = walker.nextNode() as Text | null; }
    if (!node) throw new Error("text too short");
    range.setEnd(node, remaining);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  }, length);
}

async function play(page: Page): Promise<void> {
  const box = await page.locator("[data-workspace-player-video]").boundingBox();
  if (!box) throw new Error("player video has no box");
  await page.mouse.move(box.x + 8, box.y + 8);
  await page.getByRole("region", { name: "Player" }).getByRole("button", { name: "Play", exact: true }).last().click();
  await expect.poll(async () => (await fakeYt(page)).state).toBe(FAKE_YT_STATE.PLAYING);
}

test("1 · select → word card → kanji → Inspector → a common word → Back → Close, around a playing video", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  await rowAction(page, 2, "Note");
  await expect(separator(page)).toHaveAttribute("aria-valuenow", "1");
  await play(page);
  await selectInRow(page, AI_ROW, 2); // 今日
  const popover = page.getByRole("dialog");
  await expect(popover).toBeVisible();
  await popover.getByRole("button", { name: "Kanji 今" }).click();
  await expect(popover).toHaveCount(0);
  await expect(inspectorTitle(page)).toHaveText("今");
  const quickInspect = drawer(page).getByRole("article", { name: "Kanji 今" });
  await expect(quickInspect).toBeVisible();
  await expect(drawer(page).getByRole("tab")).toHaveText(["Mining", "Notes"]);
  await expect(drawer(page).getByRole("button", { name: "Back" })).toBeVisible();
  await expect(drawer(page).getByRole("button", { name: "Close" })).toBeVisible();

  // A common word: its button holds the headword, reading and gloss (a reading's listen button holds none).
  const word = quickInspect.getByRole("listitem").getByRole("button").filter({ has: page.locator("span:nth-child(3)") }).first();
  const headword = (await word.locator("span").first().textContent()) ?? "";
  expect(headword).not.toBe("");
  await word.click();
  await expect(inspectorTitle(page)).toHaveText(headword);
  await drawer(page).getByRole("button", { name: "Back" }).click();
  await expect(inspectorTitle(page)).toHaveText("今");
  await drawer(page).getByRole("button", { name: "Close" }).click();
  await expect(inspectorTitle(page)).toHaveCount(0);
  await expect(drawer(page).getByRole("tab", { name: "Notes" })).toHaveAttribute("aria-selected", "true");
  await expect(separator(page)).toHaveAttribute("aria-valuenow", "1");
  await expect(panel(page).getByRole("textbox", { name: "Note for sentence 3" })).toBeVisible();
  const yt = await fakeYt(page);
  expect(yt.mounts).toBe(1);
  expect(yt.state).toBe(FAKE_YT_STATE.PLAYING);
});

test("2 · the transport boundary at the API: Free gets only the preview, Plus the full section", async ({ page }) => {
  const email = await registerLearner(page);
  await openLesson(page);
  const free = await postSection(page, "native_nuance");
  expect(free.status()).toBe(200);
  const freeBody = await free.text();
  // The full entry exists (Plus reads it below), yet the bytes a Free learner receives never carry it.
  expect(JSON.parse(freeBody).data.access).toBe("preview");
  expect(freeBody).not.toContain(FULL_ONLY_SENTINEL);
  const culture = await postSection(page, "culture_notes");
  expect(culture.status()).toBe(200);
  expect((await culture.json()).data.access).toBe("preview");

  await knowledge.makePlus(await data.userIdByEmail(email));
  const plus = await postSection(page, "native_nuance");
  expect(plus.status()).toBe(200);
  expect(await plus.text()).toContain(FULL_ONLY_SENTINEL);
});

test("4 · the client cannot ask for a tier or a variant", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  const response = await page.request.post("/api/knowledge/sections", {
    data: { transcriptLineId: data.lineIds[AI_ROW], section: "native_nuance", locale: "en", tier: "plus", variant: "full" },
  });
  expect(response.status()).toBe(400);
  expect(await response.text()).not.toContain(FULL_ONLY_SENTINEL);
});

test("5 · an uncached section is 503 ai_unavailable with AI disabled, while a seeded one still returns", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  const quiz = await postSection(page, "quiz");
  expect(quiz.status()).toBe(503);
  expect((await quiz.json()).error).toBe("ai_unavailable");
  const lite = await postSection(page, "lite");
  expect(lite.status()).toBe(200);
  expect(JSON.stringify((await lite.json()).data.content)).toContain(SEEDED.lite.summary);
});

test("6 · Shadowing offers no AI, Vocabulary or Grammar surface", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  await expect(drawer(page).getByRole("tab")).toHaveText(["Mining", "Notes"]);
  await expect(page.getByRole("region", { name: "Live sentence" }).getByRole("button", { name: /AI|Explain/ })).toHaveCount(0);
  await row(page, 2).hover();
  await expect(row(page, 2).getByRole("button", { name: "Cards from this sentence", exact: true })).toBeAttached();
  await expect(row(page, 2).getByRole("button", { name: "Note", exact: true })).toBeAttached();
  await expect(row(page, 2).getByRole("button", { name: /Vocabulary|Grammar|AI explanation/ })).toHaveCount(0);
  await selectInRow(page, AI_ROW, 6);
  const popover = page.getByRole("dialog");
  await expect(popover.getByRole("button", { name: "Add to Mining" })).toBeVisible();
  await expect(popover.getByRole("button", { name: "Analyze" })).toHaveCount(0);
});

test("7 · ten sentences with Notes open: no knowledge or vocabulary request, lexical analysis only, no AI rows", async ({ page }) => {
  const email = await registerLearner(page);
  const urls = requests(page);
  await openLesson(page);
  await rowAction(page, 0, "Note");
  await drawer(page).getByRole("button", { name: "Follow current sentence" }).click();
  // The keyboard lookup is the one analysis request this test makes on purpose.
  await page.getByRole("group", { name: "Look up words in this sentence" }).focus();
  await page.keyboard.press("Enter");
  const words = page.getByRole("dialog").getByRole("list", { name: "Words in this sentence" });
  await expect(words).toBeVisible();
  // Keyboard only: the first word holds focus, Enter opens its card with focus on Back, Back returns to the list.
  await expect(words.getByRole("button").first()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog").getByRole("button", { name: "Back" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(words.getByRole("button").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await play(page);
  await advance(page, 30);
  await expect.poll(() => page.locator("li[data-state='current']").getAttribute("data-index").then(Number)).toBeGreaterThanOrEqual(10);
  await page.waitForTimeout(500);
  expect(urls.filter((url) => url.startsWith("/api/knowledge/") || url.includes("/vocabulary"))).toEqual([]);
  const analysis = urls.filter((url) => url.includes("/analysis"));
  expect(analysis.length).toBeGreaterThan(0);
  expect(analysis.every((url) => url.endsWith("?scope=lexical"))).toBe(true);
  const userId = await data.userIdByEmail(email);
  for (const table of ["ai_reservations", "ai_generations"]) {
    const { count, error } = await data.admin.from(table).select("*", { count: "exact", head: true }).eq("requested_by_user_id", userId);
    expect(error).toBeNull();
    expect(count).toBe(0);
  }
});

test("8 · a note typed survives a reload", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  await rowAction(page, 2, "Note");
  const editor = panel(page).getByRole("textbox", { name: "Note for sentence 3" });
  await editor.fill("Remember the ordinal.");
  await expect(panel(page).getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("fake-yt")).toHaveCount(1);
  await rowAction(page, 2, "Note");
  await expect(panel(page).getByRole("textbox", { name: "Note for sentence 3" })).toHaveValue("Remember the ordinal.");
});

test("9 · the separator steps by key and snaps by drag; the player never remounts at any level", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  const player = await page.getByTestId("fake-yt").elementHandle();
  const samePlayer = () => page.evaluate((node) => node === document.querySelector("[data-testid='fake-yt']"), player);
  await separator(page).focus();
  for (const [key, level] of [["ArrowUp", "1"], ["ArrowUp", "2"], ["End", "3"], ["ArrowDown", "2"], ["Home", "0"]] as const) {
    await page.keyboard.press(key);
    await expect(separator(page)).toHaveAttribute("aria-valuenow", level);
    expect(await samePlayer()).toBe(true);
  }
  const handle = await separator(page).boundingBox();
  if (!handle) throw new Error("separator has no box");
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2, 529 * 0.6, { steps: 6 });
  await page.mouse.up();
  await expect(separator(page)).toHaveAttribute("aria-valuenow", "1");
  expect(await samePlayer()).toBe(true);
  expect((await fakeYt(page)).mounts).toBe(1);
});

test("10 · Escape: popover, then Inspector, then drawer; Focus hides the drawer and gives it back unchanged", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  await rowAction(page, AI_ROW, "Note");
  await separator(page).focus();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowDown");
  await expect(separator(page)).toHaveAttribute("aria-valuenow", "2");

  // Focus hides the drawer; leaving Focus restores the same tab, height and pinned target.
  await page.getByRole("button", { name: "Focus Mode" }).click();
  await expect(drawer(page)).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(drawer(page)).toBeVisible();
  await expect(drawer(page).getByRole("tab", { name: "Notes" })).toHaveAttribute("aria-selected", "true");
  await expect(separator(page)).toHaveAttribute("aria-valuenow", "2");
  await expect(drawer(page).getByText("Pinned")).toBeVisible();

  const popover = page.getByRole("dialog");
  await selectInRow(page, AI_ROW, 2);
  await popover.getByRole("button", { name: "Kanji 今" }).click();
  await expect(inspectorTitle(page)).toHaveText("今");
  await selectInRow(page, AI_ROW, 2);
  await expect(popover).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popover).toHaveCount(0);
  await expect(inspectorTitle(page)).toHaveText("今");
  await page.keyboard.press("Escape");
  await expect(inspectorTitle(page)).toHaveCount(0);
  await expect(separator(page)).toHaveAttribute("aria-valuenow", "2");
  await page.keyboard.press("Escape");
  await expect(separator(page)).toHaveAttribute("aria-valuenow", "0");
  expect((await fakeYt(page)).mounts).toBe(1);
});

test("11 · the drawer fits its row at every level: the bar is whole, long content scrolls inside, the header stays", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  const geometry = () => page.evaluate(() => {
    const section = document.querySelector("section[data-drawer-level]") as HTMLElement;
    const panel = section.querySelector("[role='tabpanel']") as HTMLElement | null;
    const box = section.getBoundingClientRect();
    return {
      top: box.top, bottom: box.bottom,
      overflowing: section.scrollHeight - section.clientHeight,
      header: (document.querySelector("[data-testid='workspace-header-slot']") as HTMLElement).getBoundingClientRect().top,
      panelScrollable: panel ? panel.scrollHeight > panel.clientHeight : null,
    };
  });
  // Collapsed: the whole bar inside the viewport, nothing cut.
  let g = await geometry();
  expect(g.bottom).toBeLessThanOrEqual(529);
  expect(g.overflowing).toBeLessThanOrEqual(0);

  // Peek with long content (a kanji in the Inspector): the drawer keeps its row, the panel scrolls, the
  // workspace never shifts.
  await selectInRow(page, AI_ROW, 2);
  await page.getByRole("dialog").getByRole("button", { name: "Kanji 今" }).click();
  await expect(drawer(page).getByRole("article", { name: "Kanji 今" })).toBeVisible();
  await expect(separator(page)).toHaveAttribute("aria-valuenow", "1");
  g = await geometry();
  expect(g.header).toBe(0);
  expect(g.bottom).toBeLessThanOrEqual(529);
  expect(g.panelScrollable).toBe(true);
});
