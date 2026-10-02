import { expect, test, type Page } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./fixtures/auth";
import { advance, FAKE_YT_STATE, fakeYt, installFakeYouTube } from "./fixtures/fake-youtube";
import { FULL_ONLY_SENTINEL, SEEDED, seedKnowledgeData, type KnowledgeData } from "./fixtures/knowledge-data";
import { lineText, seedWorkspaceData, VIDEO_DURATION, type WorkspaceData } from "./fixtures/workspace-data";

/**
 * Deterministic acceptance for the Part 1b intelligence layer (plan Task 15 step 1). The server runs with
 * AI_PROVIDER=none: every AI answer is a seeded cache entry, a stubbed route, or "AI is resting". The fake
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
const sectionPosts = (page: Page) => {
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/knowledge/sections") posts.push(request.postData() ?? "");
  });
  return posts;
};
/** A row's actions appear while the row is hovered (or holds focus), like 1a's. */
async function rowAction(page: Page, index: number, name: string): Promise<void> {
  const button = row(page, index).getByRole("button", { name, exact: true });
  await button.scrollIntoViewIfNeeded();
  // The pointer goes to the button's own spot first: hovering that spot is what lets the toolbar take the click.
  await button.hover({ force: true });
  await button.click();
}
async function openAi(page: Page, index = AI_ROW): Promise<void> {
  await rowAction(page, index, "AI explanation");
  await expect(drawer(page).getByRole("tab", { name: "AI" })).toHaveAttribute("aria-selected", "true");
}
const accordion = (page: Page, name: string) => panel(page).getByRole("button", { name: new RegExp(name) });

test("1 · select → word card → kanji → QuickInspect", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  const text = row(page, AI_ROW).locator("[data-line-id]");
  // Select 今日 (UTF-16 0..2) with a real Range, then release the mouse as a drag would.
  await text.evaluate((element) => {
    const range = document.createRange();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (node.parentElement?.closest("rt, rp") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const first = walker.nextNode() as Text;
    range.setStart(first, 0);
    let remaining = 2;
    let node: Text | null = first;
    while (node && remaining > node.length) { remaining -= node.length; node = walker.nextNode() as Text | null; }
    if (!node) throw new Error("text too short");
    range.setEnd(node, remaining);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  const popover = page.getByRole("dialog");
  await expect(popover).toBeVisible();
  await popover.getByRole("button", { name: "Kanji 今" }).click();
  await expect(drawer(page).getByRole("article", { name: "Kanji 今" })).toBeVisible();
  await expect(drawer(page).getByRole("tab", { name: "Vocabulary" })).toHaveAttribute("aria-selected", "true");
});

test("2 · ✨ pins the sentence and shows the seeded lite; Free gets only the preview of a locked section", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  await openAi(page);
  await expect(panel(page).getByText(SEEDED.lite.summary)).toBeVisible();
  await expect(drawer(page).getByText("Pinned")).toBeVisible();

  const response = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/knowledge/sections" && (r.request().postData() ?? "").includes("native_nuance"));
  await accordion(page, "Native nuance").click();
  const body = await (await response).text();
  // The transport boundary: the full entry exists (test 3 reads it as Plus), yet Free's bytes never carry it.
  expect(JSON.parse(body).data.access).toBe("preview");
  expect(body).not.toContain(FULL_ONLY_SENTINEL);
  await expect(panel(page).getByText(SEEDED.native_nuance.nuance)).toBeVisible();
  await expect(panel(page).getByText("Preview. The full section comes with Plus.")).toBeVisible();
  await expect(panel(page).getByText(FULL_ONLY_SENTINEL)).toHaveCount(0);

  // A seeded preview variant reads as a preview too.
  await accordion(page, "Culture notes").click();
  await expect(panel(page).getByText("Seeded culture note")).toBeVisible();
});

test("3 · a Plus learner reads the full section, sentinel included", async ({ page }) => {
  const email = await registerLearner(page);
  await knowledge.makePlus(await data.userIdByEmail(email));
  await openLesson(page);
  await openAi(page);
  await accordion(page, "Native nuance").click();
  await expect(panel(page).getByText(FULL_ONLY_SENTINEL)).toBeVisible();
  await expect(panel(page).getByText("Preview. The full section comes with Plus.")).toHaveCount(0);
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

test("5 · an uncached section rests (AI disabled) while seeded sections stay", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  await openAi(page);
  await expect(panel(page).getByText(SEEDED.lite.summary)).toBeVisible();
  await accordion(page, "Quiz").click();
  await expect(panel(page).getByText("AI is resting right now. Sections already loaded stay here.")).toBeVisible();
  await expect(panel(page).getByText(SEEDED.lite.summary)).toBeVisible();
});

test("6 · 202 then 200: generating, then the section with an announcement; 402 shows the reset time", async ({ page }) => {
  await registerLearner(page);
  let calls = 0;
  await page.route("**/api/knowledge/sections", async (route) => {
    const section = JSON.parse(route.request().postData() ?? "{}").section as string;
    if (section === "more_examples") {
      calls += 1;
      return calls === 1
        ? route.fulfill({ status: 202, json: { data: { status: "pending", section, retryAfterMs: 400 } } })
        : route.fulfill({ json: { data: { status: "ready", section, access: "full", content: { examples: [{ jp: "例文です。", reading: "れいぶんです。", translation: "Stubbed example." }] } } } });
    }
    if (section === "common_mistakes") {
      return route.fulfill({ status: 402, json: { error: "quota_exhausted", resetsAt: "2099-01-01T00:00:00Z" } });
    }
    return route.continue();
  });
  await openLesson(page);
  await openAi(page);
  await accordion(page, "More examples").click();
  await expect(panel(page).getByText("Writing this section…")).toBeVisible();
  await expect(panel(page).getByText("Stubbed example.")).toBeVisible();
  await expect(panel(page).getByRole("status").filter({ hasText: "More examples is ready." })).toBeAttached();
  expect(calls).toBe(2);
  await accordion(page, "Common mistakes").click();
  // The hour count itself is unit-tested (hoursUntil); e2e sources never read the clock.
  await expect(panel(page).getByText(/^You've used today's free AI sentences\. Resets in \d+ h\.$/)).toBeVisible();
});

test("7 · playing 10 sentences with the AI tab open requests nothing", async ({ page }) => {
  await registerLearner(page);
  const posts = sectionPosts(page);
  await openLesson(page);
  await openAi(page, 0);
  await expect.poll(() => posts.length).toBe(1);
  await drawer(page).getByRole("button", { name: "Follow current sentence" }).click();
  const box = await page.locator("[data-workspace-player-video]").boundingBox();
  if (!box) throw new Error("player video has no box");
  await page.mouse.move(box.x + 8, box.y + 8);
  await page.getByRole("region", { name: "Player" }).getByRole("button", { name: "Play", exact: true }).last().click();
  await expect.poll(async () => (await fakeYt(page)).state).toBe(FAKE_YT_STATE.PLAYING);
  await advance(page, 30);
  await expect.poll(() => page.locator("li[data-state='current']").getAttribute("data-index").then(Number)).toBeGreaterThanOrEqual(10);
  await page.waitForTimeout(500);
  expect(posts).toHaveLength(1);
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

test("10 · Escape closes the popover, then the drawer; Focus hides the drawer and gives it back unchanged", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  await openAi(page);
  await separator(page).focus();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowDown");
  await expect(separator(page)).toHaveAttribute("aria-valuenow", "2");

  // Focus hides the drawer; leaving Focus restores the same tab, height and pinned target.
  await page.getByRole("button", { name: "Focus Mode" }).click();
  await expect(drawer(page)).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(drawer(page)).toBeVisible();
  await expect(drawer(page).getByRole("tab", { name: "AI" })).toHaveAttribute("aria-selected", "true");
  await expect(separator(page)).toHaveAttribute("aria-valuenow", "2");
  await expect(panel(page).getByText(SEEDED.lite.summary)).toBeVisible();

  await row(page, AI_ROW).locator("[data-line-id]").evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
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

  // Expanded with long content: the drawer keeps its row, the panel scrolls, the workspace never shifts.
  await openAi(page);
  await separator(page).focus();
  await page.keyboard.press("ArrowUp");
  await expect(separator(page)).toHaveAttribute("aria-valuenow", "2");
  for (const name of ["Native nuance", "Culture notes", "Grammar breakdown", "Quiz"]) await accordion(page, name).click();
  await expect(panel(page).getByText("AI is resting right now. Sections already loaded stay here.").first()).toBeVisible();
  g = await geometry();
  expect(g.header).toBe(0);
  expect(g.bottom).toBeLessThanOrEqual(529);
  expect(g.panelScrollable).toBe(true);
});
