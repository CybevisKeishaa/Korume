import { expect, test, type Page } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./fixtures/auth";
import { FAKE_YT_STATE, fakeYt, installFakeYouTube } from "./fixtures/fake-youtube";
import { analysisFixture, seedSummaryEvidence } from "./fixtures/summary-data";
import { lineStart, lineText, seedWorkspaceData, type WorkspaceData } from "./fixtures/workspace-data";

test.use({ viewport: { width: 1280, height: 529 } });
let data: WorkspaceData;
test.beforeAll(async () => { data = await seedWorkspaceData(); });
test.afterAll(async () => { await data?.cleanup(); });

async function learner(page: Page, evidence = true): Promise<string> {
  await installFakeYouTube(page);
  const email = uniqueEmail("e2e_summary");
  await page.goto("/en/register");
  await registerViaUi(page, { name: "E2E Summary", email, password: "password123" });
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15_000 });
  const userId = await data.userIdByEmail(email);
  if (evidence) await seedSummaryEvidence(data.admin, { userId, videoId: data.videoId, lineIds: data.lineIds });
  return userId;
}

const summary = (page: Page) => page.goto(`/en/shadowing/${data.videoId}/summary`);
const area = (page: Page, name: string) => page.locator(`[data-summary-area="${name}"]`);
async function readyAnalysis(page: Page): Promise<void> {
  await page.route("**/lesson-analysis**", (route) => void route.fulfill({ json: analysisFixture(data.lineIds) }));
}

test("1 · deterministic status, review reasons and AI-off fallback", async ({ page }) => {
  await learner(page);
  await summary(page);
  const status = area(page, "status");
  await expect(status.locator("dd")).toHaveText(["7%", "70", "70", "Not enough data"]);
  await expect(area(page, "saved").locator("dd")).toHaveText(["0", "0", "0", "Not enough data"]);
  const rows = area(page, "review").locator("li");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText(lineText(0));
  await expect(rows.nth(0)).toContainText("Pronunciation");
  await expect(rows.nth(0)).toContainText("Pitch accent");
  await expect(rows.nth(1)).toContainText(lineText(2));
  await expect(rows.nth(1)).toContainText("Listening");
  await expect(rows.nth(2)).toContainText(lineText(3));
  await expect(rows.nth(2)).toContainText("Marked difficult");
  for (const name of ["words", "expressions", "grammar", "culture"]) {
    await expect(area(page, name)).toContainText("Not available right now");
    await expect(area(page, name).getByRole("button", { name: "Retry" })).toHaveCount(0);
  }
  await expect(area(page, "reflection")).toContainText("Korume");
  await expect(area(page, "reflection")).toContainText(lineText(1));
});

test("2 · a learner with no evidence sees not-started status and an invitation", async ({ page }) => {
  await learner(page, false);
  await summary(page);
  await expect(area(page, "status").locator("dd")).toHaveText(["Not started", "Not started", "Not started", "Not enough data"]);
  await expect(area(page, "saved")).toContainText("Not enough data");
  await expect(area(page, "reflection")).toContainText("Start shadowing this lesson");
});

test("3 · analysis polling follows one GET–POST chain and cancels after navigation", async ({ page }) => {
  await learner(page);
  const methods: string[] = [];
  await page.route("**/lesson-analysis**", async (route) => {
    methods.push(route.request().method());
    const index = methods.length;
    await route.fulfill(index === 1
      ? { status: 404, json: { status: "not_ready" } }
      : index < 4 ? { status: 202, json: { status: "pending", retryAfterMs: 300 } }
        : { json: analysisFixture(data.lineIds) });
  });
  await summary(page);
  await expect(area(page, "words").locator('[aria-busy="true"]')).toBeVisible();
  await expect(page.getByRole("status", { name: "" }).filter({ hasText: "Lesson analysis ready" })).toHaveCount(1);
  expect(methods).toEqual(["GET", "POST", "GET", "GET"]);

  methods.length = 0;
  await page.route("**/lesson-analysis**", (route) => {
    methods.push(route.request().method());
    return route.fulfill({ status: 202, json: { status: "pending", retryAfterMs: 3000 } });
  });
  await page.reload();
  await expect(area(page, "words").locator('[aria-busy="true"]')).toBeVisible();
  await page.goto(`/en/shadowing/${data.videoId}`);
  const before = methods.length;
  await page.waitForTimeout(2000);
  expect(methods).toHaveLength(before);
});

test("4 · ready cards render dictionary fields and AI reflection highlight", async ({ page }) => {
  await learner(page);
  await readyAnalysis(page);
  await page.route("**/lesson-reflection**", (route) => void route.fulfill({ json: { state: "ready", reflection: { text: "You practiced steadily.", highlight: { lineId: data.lineIds[0], span: "今日" }, generatedAt: new Date().toISOString() } } }));
  await summary(page);
  await expect(area(page, "words")).toContainText("きょう");
  await expect(area(page, "words")).toContainText("today");
  await expect(area(page, "words")).toContainText("Noun");
  await expect(area(page, "reflection")).toContainText("AI Korume");
  await expect(area(page, "reflection").locator('[lang="ja"]')).toHaveText("「今日」");
});

test("5 · a fast double save writes one vocabulary card and delete survives reload", async ({ page }) => {
  const userId = await learner(page);
  await readyAnalysis(page);
  let posts = 0;
  page.on("request", (request) => { if (request.method() === "POST" && new URL(request.url()).pathname === "/api/mining") posts += 1; });
  await summary(page);
  const save = area(page, "words").getByRole("button", { name: "Save 今日" });
  await save.dblclick({ delay: 10 });
  await expect(area(page, "words").getByRole("button", { name: /Remove 今日/ })).toHaveAttribute("aria-pressed", "true");
  expect(posts).toBe(1);
  const cards = await data.admin.from("sentence_mining_cards").select("id, source_kind, source_ref")
    .eq("user_id", userId).eq("transcript_line_id", data.lineIds[0]).eq("source_kind", "vocabulary");
  if (cards.error) throw cards.error;
  expect(cards.data).toHaveLength(1);
  expect(cards.data[0]?.source_ref).toBe("今日");
  await page.reload();
  const remove = area(page, "words").getByRole("button", { name: /Remove 今日/ });
  await expect(remove).toHaveAttribute("aria-pressed", "true");
  await remove.click();
  await expect(area(page, "words").getByRole("button", { name: "Save 今日" })).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(area(page, "words").getByRole("button", { name: "Save 今日" })).toHaveAttribute("aria-pressed", "false");
});

test("6 · Review Tomorrow writes all targets once and keeps button focus", async ({ page }) => {
  const userId = await learner(page);
  let posts = 0;
  page.on("request", (request) => { if (request.method() === "POST" && request.url().endsWith("/review-tomorrow")) posts += 1; });
  await summary(page);
  const button = area(page, "reflection").getByRole("button", { name: "Review Tomorrow" });
  await button.click();
  const scheduled = area(page, "reflection").getByRole("button", { name: /Scheduled for tomorrow/ });
  await expect(scheduled).toHaveAttribute("aria-disabled", "true");
  await expect(scheduled).toBeFocused();
  await scheduled.dispatchEvent("click");
  await page.waitForTimeout(300);
  expect(posts).toBe(1);
  await page.reload();
  const cards = await data.admin.from("sentence_mining_cards").select("transcript_line_id, created_at, next_review_at")
    .eq("user_id", userId).eq("video_id", data.videoId).eq("source_kind", "sentence");
  if (cards.error) throw cards.error;
  expect(cards.data.map((row) => row.transcript_line_id).sort()).toEqual([data.lineIds[0], data.lineIds[2], data.lineIds[3]].sort());
  // "In the future" against the server's own insert time: no clock read in an e2e source (test/e2e-registration-emails).
  expect(cards.data.every((row) => Date.parse(row.next_review_at) > Date.parse(row.created_at))).toBe(true);
});

test("7 · mode bar and review deep link seek to the chosen line", async ({ page }) => {
  await learner(page);
  await summary(page);
  const nav = page.getByRole("navigation", { name: /learning modes/i });
  await expect(nav.getByRole("link", { name: "Shadowing" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Summary" })).toHaveAttribute("aria-current", "page");
  await area(page, "review").locator("li").filter({ hasText: lineText(2) }).getByRole("link", { name: "Review Again" }).click();
  await expect(page).toHaveURL(new RegExp(`/en/shadowing/${data.videoId}\\?line=${data.lineIds[2]}`));
  await expect(page.locator("li[data-state='current']")).toHaveAttribute("data-index", "2");
  await expect.poll(async () => (await fakeYt(page)).seeks).toContain(lineStart(2));
});

test("8 · Shadowing shortcuts and Mining drawer still work", async ({ page }) => {
  await learner(page);
  await page.goto(`/en/shadowing/${data.videoId}`);
  await expect(page.getByTestId("fake-yt")).toHaveCount(1);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Space");
  await expect.poll(async () => (await fakeYt(page)).state).toBe(FAKE_YT_STATE.PLAYING);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await fakeYt(page)).state).toBe(FAKE_YT_STATE.PAUSED);
  await page.getByRole("tab", { name: "Mining" }).click();
  await expect(page.getByRole("region", { name: "Study tools" })).toHaveAttribute("data-drawer-level", /^(peek|expanded)$/);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("f");
  await expect(page.getByRole("button", { name: "Focus Mode" })).toHaveAttribute("aria-pressed", "true");
});

test("9 · the clip seeks, restores focus, and destroys its player", async ({ page }) => {
  await learner(page);
  await readyAnalysis(page);
  await summary(page);
  const hear = area(page, "words").getByRole("button", { name: "Hear in lesson" }).first();
  await hear.click();
  await expect(page.getByRole("region", { name: "Lesson clip" })).toBeVisible();
  await expect.poll(async () => (await fakeYt(page)).mounts).toBe(1);
  await expect.poll(async () => (await fakeYt(page)).seeks).toContain(lineStart(0));
  await page.getByRole("button", { name: "Close clip player" }).click();
  await expect(hear).toBeFocused();
  await hear.click();
  await area(page, "reflection").getByRole("link", { name: "Open Memory" }).click();
  await expect(page).toHaveURL(/\/en\/companion$/);
  await expect(page.getByTestId("fake-yt")).toHaveCount(0);
  await expect.poll(() => fakeYt(page)).toMatchObject({ mounts: 2, state: FAKE_YT_STATE.UNSTARTED, seeks: [] });
});

test("10 · summary grid has desktop rail geometry and semantic document order", async ({ page }) => {
  await learner(page);
  await readyAnalysis(page);
  await summary(page);
  const box = async (name: string) => {
    const value = await area(page, name).boundingBox();
    if (!value) throw new Error(`${name} has no box`);
    return value;
  };
  const words = await box("words");
  const status = await box("status");
  const saved = await box("saved");
  const next = await box("next");
  expect(status.x).toBeGreaterThan(words.x + words.width);
  expect(saved.y - (status.y + status.height)).toBeLessThanOrEqual(32);
  expect(next.y - (saved.y + saved.height)).toBeLessThanOrEqual(32);
  // The main column never waits for the rail: Expressions follows Words and the rail follows Reflection.
  const expressions = await box("expressions");
  const reflection = await box("reflection");
  const hero = await box("hero");
  expect(expressions.y - (words.y + words.height)).toBeLessThanOrEqual(32);
  expect(status.y - (reflection.y + reflection.height)).toBeLessThanOrEqual(32);
  expect(words.y - (hero.y + hero.height)).toBeLessThanOrEqual(32);
  const names = ["hero", "reflection", "words", "expressions", "grammar", "culture", "review", "status", "saved", "next"];
  const domOrder = await page.locator("main [data-summary-area]").evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-summary-area")),
  );
  expect(domOrder).toEqual(names);
});

test("11 · a double-click selects a word in a clamped card without toggling it; a click opens it (m6)", async ({ page }) => {
  await learner(page);
  await readyAnalysis(page);
  const text = Array.from({ length: 12 }, () => "Persistence beats intensity when you shadow a little every day.").join(" ");
  await page.route("**/lesson-reflection**", (route) => void route.fulfill({ json: { state: "ready", reflection: { text, highlight: null, generatedAt: new Date().toISOString() } } }));
  await summary(page);
  const card = area(page, "reflection");
  const clamp = card.locator("[data-clamp]");
  await expect(clamp).toContainText("Persistence");
  await expect(card).toHaveClass(/cursor-pointer/); // positive control: the text really is cut
  await expect(clamp).toHaveClass(/line-clamp-4/);

  await clamp.dblclick({ position: { x: 8, y: 8 } });
  // An absence: wait past the card's double-click window (500ms) before asserting nothing toggled.
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? "")).toContain("Persistence");
  await expect(clamp).toHaveClass(/line-clamp-4/);

  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  await clamp.click({ position: { x: 8, y: 8 } });
  await expect(clamp).not.toHaveClass(/line-clamp-4/);
});

test("12 · View as list reads the real lesson vocabulary endpoint and lists the AI words first", async ({ page }) => {
  await learner(page);
  await readyAnalysis(page);
  await summary(page);
  const words = area(page, "words");
  // Positive control, awaited: the analysis fixture rendered its word cards before anything is counted.
  await expect(words.getByRole("button", { name: "Hear in lesson" }).first()).toBeVisible();
  const cards = await words.getByRole("button", { name: "Hear in lesson" }).count();
  const vocabulary = page.waitForResponse((response) => response.url().includes(`/api/videos/${data.videoId}/vocabulary`));
  await words.getByRole("button", { name: "View as list" }).click();
  expect((await vocabulary).status()).toBe(200);
  const list = words.getByRole("list", { name: "Words from this lesson" });
  await expect(list.getByRole("listitem")).not.toHaveCount(0);
  expect(await list.getByRole("listitem").count()).toBeLessThanOrEqual(8);
  await expect(words).not.toContainText("Could not load more words from the lesson.");
  await words.getByRole("button", { name: "View as cards" }).click();
  await expect(words.getByRole("button", { name: "Hear in lesson" })).toHaveCount(cards);
});
