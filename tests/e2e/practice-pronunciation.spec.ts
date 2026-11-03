import { expect, test, type Page } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./fixtures/auth";
import { advance, FAKE_YT_STATE, fakeYt, installFakeYouTube } from "./fixtures/fake-youtube";
import { lineStart, seedWorkspaceData, VIDEO_DURATION, type WorkspaceData } from "./fixtures/workspace-data";

/**
 * Browser acceptance for the Pronunciation mode (practice modes B1, plan Task 14). Chromium's fake microphone
 * records the takes; `fixtures/speech-stub.mjs` stands in for Azure (playwright.config.ts starts it and points
 * AZURE_SPEECH_RECOGNITION_URL at it), and its `/__mode` picks success, 503 or 429 per test. The pitch TTS
 * request is aborted: intonation is optional and never blocks a save. The owner's viewport, a fresh learner
 * per test.
 */
test.use({
  viewport: { width: 1280, height: 529 },
  permissions: ["microphone"],
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
});
// The speech stub keeps one mode for the whole server, so these tests must not interleave.
test.describe.configure({ mode: "serial" });

const STUB = "http://127.0.0.1:3999";
let data: WorkspaceData;
test.beforeAll(async () => { data = await seedWorkspaceData(); });
test.afterAll(async () => { await data?.cleanup(); });
test.beforeEach(async ({ request }) => { await stubMode(request, "success"); });

async function stubMode(request: { post(url: string, options: { data: unknown }): Promise<unknown> }, mode: "success" | "429" | "429-no-header" | "503") {
  await request.post(`${STUB}/__mode`, { data: { mode } });
}

async function stubCalls(request: { get(url: string): Promise<{ json(): Promise<unknown> }> }): Promise<number> {
  return ((await (await request.get(`${STUB}/__calls`)).json()) as { calls: number }).calls;
}

async function registerLearner(page: Page): Promise<void> {
  await page.route(/youtube\.com|youtube-nocookie\.com|googlevideo\.com/, (route) => route.abort());
  await page.route(/\/api\/speech\/tts/, (route) => route.abort());
  await installFakeYouTube(page, { duration: VIDEO_DURATION });
  await page.goto("/en/register");
  await registerViaUi(page, { name: "E2E Practice", email: uniqueEmail("e2e_pp"), password: "password123" });
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15_000 });
}

async function openLesson(page: Page, mode: "" | "/pronunciation" = ""): Promise<void> {
  await page.goto(`/en/shadowing/${data.videoId}${mode}`);
  await expect(page.getByTestId("fake-yt")).toHaveCount(1);
  await expect.poll(async () => (await fakeYt(page)).seeks.length).toBeGreaterThan(0);
}

const modeBar = (page: Page) => page.getByRole("navigation", { name: "Learning modes" });
const practice = (page: Page) => page.getByRole("region", { name: "Pronunciation practice" });
const strip = (page: Page) => page.getByTestId("lesson-stat-strip");
const stat = (page: Page, name: "sentence" | "completed" | "accuracy" | "videoLeft") => strip(page).locator(`[data-stat="${name}"] dd`);

async function recordTake(page: Page): Promise<void> {
  await practice(page).getByRole("button", { name: "Record", exact: true }).click();
  await expect(practice(page).getByRole("button", { name: "Stop", exact: true })).toBeVisible();
  await page.waitForTimeout(1_500);
  await practice(page).getByRole("button", { name: "Stop", exact: true }).click();
}

test("1 · one player instance across the mode switch (B1 gate)", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  expect((await fakeYt(page)).mounts).toBe(1);
  await page.getByTestId("fake-yt").evaluate((element) => element.setAttribute("data-instance-marker", "kept"));
  await modeBar(page).getByRole("link", { name: "Pronunciation" }).click();
  await expect(page).toHaveURL(/\/pronunciation$/);
  await expect(practice(page)).toBeVisible();
  await expect(page.locator("[data-testid='fake-yt'][data-instance-marker='kept']")).toHaveCount(1);
  expect((await fakeYt(page)).mounts).toBe(1);
  await modeBar(page).getByRole("link", { name: "Shadowing" }).click();
  await expect(page).toHaveURL(new RegExp(`/shadowing/${data.videoId}$`));
  await expect(page.locator("[data-testid='fake-yt'][data-instance-marker='kept']")).toHaveCount(1);
  expect((await fakeYt(page)).mounts).toBe(1);
});

test("2 + 3 · record, save, score; the scored take survives a reload", async ({ page, request }) => {
  await registerLearner(page);
  await openLesson(page, "/pronunciation");
  await expect(stat(page, "sentence")).toHaveText(/^1\//);
  const callsBefore = await stubCalls(request);
  await recordTake(page);
  await expect(practice(page).getByTestId("take-status").getByText("86", { exact: true })).toBeVisible({ timeout: 20_000 });
  // The score came from the stub: a reused server without AZURE_SPEECH_RECOGNITION_URL would reach real Azure.
  expect(await stubCalls(request)).toBe(callsBefore + 1);
  await expect(practice(page).getByTestId("take-status")).toContainText("Excellent");
  await expect(practice(page).locator("mark[data-error-type='Mispronunciation']")).toHaveText("文");
  await expect(page.getByRole("navigation", { name: "Sentence navigator" }).getByRole("button", { name: "Sentence 1, scored 86" })).toBeVisible();
  await expect(stat(page, "completed")).toHaveText(/^1\//);
  await expect(stat(page, "accuracy")).toHaveText("86");

  await page.reload();
  await expect(practice(page)).toBeVisible();
  // Details closes when the sentence changes; after a reload the sentence resolves from none to 1 first.
  await expect(stat(page, "sentence")).toHaveText(/^1\//);
  // The analysis card reads the stored take: Accuracy 88, Completeness 100, and 文 graded as needing work.
  const accuracy = practice(page).locator("dt", { hasText: "Accuracy" }).locator("xpath=..");
  await expect(accuracy.locator("dd")).toHaveText("88");
  await expect(practice(page).locator("dt", { hasText: "Completeness" }).locator("xpath=..").locator("dd")).toHaveText("100");
  await expect(practice(page).getByRole("list", { name: "Word by word" }).locator("li[data-grade='needsWork']")).toContainText("文");
  await page.getByRole("button", { name: "Details" }).click();
  await expect(page.getByRole("button", { name: "Details" })).toHaveAttribute("aria-expanded", "true");
  const details = page.getByRole("button", { name: "Details" }).locator("xpath=..");
  await expect(details.getByRole("listitem")).toHaveCount(1);
  await expect(details.getByRole("listitem")).toContainText("86");
});

// Azure's own 503 is an upstream failure: the score route answers 502 (Task 5), keeping its 503 for "speech not
// configured", which the panel unit test covers. Either way the take is kept and nothing fake is scored (D16).
test("4 · an Azure outage keeps the take playable, then Score again scores it", async ({ page, request }) => {
  await registerLearner(page);
  await openLesson(page, "/pronunciation");
  await stubMode(request, "503");
  await recordTake(page);
  await expect(practice(page).getByText("Could not score your take. Your recording is saved.")).toBeVisible({ timeout: 20_000 });
  await expect(practice(page).getByTestId("take-status").getByText("86", { exact: true })).toHaveCount(0);
  await expect(practice(page).locator("audio")).toHaveAttribute("src", /.+/);
  await stubMode(request, "success");
  await practice(page).getByRole("button", { name: "Score again" }).click();
  await expect(practice(page).getByTestId("take-status").getByText("86", { exact: true })).toBeVisible({ timeout: 20_000 });
});

test("5 · throttled scoring says when to retry, with and without Retry-After", async ({ page, request }) => {
  await registerLearner(page);
  await openLesson(page, "/pronunciation");
  await stubMode(request, "429");
  await recordTake(page);
  await expect(practice(page).getByText(/Try again in \d+ s/)).toBeVisible({ timeout: 20_000 });

  await stubMode(request, "429-no-header");
  await page.reload();
  await expect(practice(page)).toBeVisible();
  await practice(page).getByRole("button", { name: "Score again" }).click();
  await expect(practice(page).getByText("Busy, try again shortly")).toBeVisible({ timeout: 20_000 });
});

test("6 · an unsaved take is guarded on in-workspace links and survives Back/Forward (Review Focus 1)", async ({ page }) => {
  await registerLearner(page);
  // Entered through the mode bar, so browser Back lands on Shadowing inside the same shell.
  await openLesson(page);
  await modeBar(page).getByRole("link", { name: "Pronunciation" }).click();
  await expect(practice(page)).toBeVisible();
  await page.route("**/api/shadowing/session", (route) => route.request().method() === "POST" ? route.fulfill({ status: 500, body: "{}" }) : route.fallback());
  await recordTake(page);
  await expect(practice(page).getByRole("button", { name: "Save again" })).toBeVisible({ timeout: 20_000 });

  await modeBar(page).getByRole("link", { name: "Shadowing" }).click();
  const dialog = page.getByRole("dialog", { name: "Leave this take unsaved?" });
  await expect(dialog).toBeVisible();
  await dialog.getByText("Stay", { exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/pronunciation$/);
  // The app nav rail sits outside the workspace root; it is guarded too (review I-1).
  await page.getByRole("link", { name: "Help", exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByText("Stay", { exact: true }).click();
  await expect(page).toHaveURL(/\/pronunciation$/);

  // Client navigation the guard cannot intercept: the take lives in the shell, so it is still there on return.
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/shadowing/${data.videoId}$`));
  await page.goForward();
  await expect(page).toHaveURL(/\/pronunciation$/);
  await page.unroute("**/api/shadowing/session");
  await practice(page).getByRole("button", { name: "Save again" }).click();
  await expect(practice(page).getByTestId("take-status").getByText("86", { exact: true })).toBeVisible({ timeout: 20_000 });

  // A second failed take: Leave and discard navigates.
  await page.route("**/api/shadowing/session", (route) => route.request().method() === "POST" ? route.fulfill({ status: 500, body: "{}" }) : route.fallback());
  await page.getByRole("navigation", { name: "Sentence navigator" }).getByRole("button", { name: /^Sentence 2,/ }).click();
  await expect(stat(page, "sentence")).toHaveText(/^2\//);
  await recordTake(page);
  await expect(practice(page).getByRole("button", { name: "Save again" })).toBeVisible({ timeout: 20_000 });
  await modeBar(page).getByRole("link", { name: "Shadowing" }).click();
  await page.getByRole("button", { name: "Leave and discard" }).click();
  await expect(page).toHaveURL(new RegExp(`/shadowing/${data.videoId}$`));
});

test("7 · Practice this sentence opens Pronunciation on that line", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  const third = page.locator("li[data-index='2']");
  await third.hover();
  await third.getByRole("button", { name: "Practice this sentence" }).click();
  await expect(page).toHaveURL(/\/pronunciation$/);
  await expect(stat(page, "sentence")).toHaveText(/^3\//);
});

test("8 · Replay native plays the one sentence and stops at its end; the Shadowing loop is untouched", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  const loop = page.getByRole("button", { name: "Sentence loop" });
  const loopBefore = await loop.getAttribute("aria-pressed");
  await modeBar(page).getByRole("link", { name: "Pronunciation" }).click();
  await expect(practice(page)).toBeVisible();
  const before = (await fakeYt(page)).seeks.length;
  await practice(page).getByRole("button", { name: "Replay native" }).first().click();
  await expect.poll(async () => (await fakeYt(page)).state).toBe(FAKE_YT_STATE.PLAYING);
  expect((await fakeYt(page)).seeks.slice(before)).toEqual([lineStart(0)]);
  await advance(page, 3);
  await expect.poll(async () => (await fakeYt(page)).state).toBe(FAKE_YT_STATE.PAUSED);
  await expect(stat(page, "sentence")).toHaveText(/^1\//);
  await modeBar(page).getByRole("link", { name: "Shadowing" }).click();
  await expect(loop).toHaveAttribute("aria-pressed", loopBefore ?? "false");
});

test("9 · sentence navigation is locked while a take is unsaved", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page, "/pronunciation");
  await page.route("**/api/shadowing/session", (route) => route.request().method() === "POST" ? route.fulfill({ status: 500, body: "{}" }) : route.fallback());
  await recordTake(page);
  await expect(practice(page).getByRole("button", { name: "Save again" })).toBeVisible({ timeout: 20_000 });

  await page.locator("body").press("ArrowRight");
  await page.getByRole("navigation", { name: "Sentence navigator" }).getByRole("button", { name: /^Sentence 3,/ }).click({ force: true });
  const next = practice(page).getByRole("button", { name: "Next sentence" });
  await expect(next).toHaveAttribute("aria-disabled", "true");
  await next.click({ force: true }); // aria-disabled stays focusable and clickable; the click must not move
  await expect(stat(page, "sentence")).toHaveText(/^1\//);

  await page.unroute("**/api/shadowing/session");
  await practice(page).getByRole("button", { name: "Save again" }).click();
  await expect(practice(page).getByTestId("take-status").getByText("86", { exact: true })).toBeVisible({ timeout: 20_000 });
  await practice(page).getByRole("button", { name: "Next sentence" }).click();
  await expect(stat(page, "sentence")).toHaveText(/^2\//);
});
