import { expect, test, type Page } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./fixtures/auth";
import { advance, FAKE_YT_STATE, fakeYt, installFakeYouTube } from "./fixtures/fake-youtube";
import { lineStart, lineTranslation, seedWorkspaceData, VIDEO_DURATION, type WorkspaceData } from "./fixtures/workspace-data";

/**
 * Deterministic browser acceptance for the Shadowing workspace (spec §8, plan Task 11). A fake `YT.Player`
 * is installed before the app loads and the spec drives its clock, so every timing assertion is exact. The
 * owner's viewport (1280×529) for every layout assertion. A fresh learner per test.
 */
test.use({ viewport: { width: 1280, height: 529 } });

let data: WorkspaceData;
test.beforeAll(async () => { data = await seedWorkspaceData(); });
test.afterAll(async () => { await data?.cleanup(); });

interface Learner { email: string; youtubeRequests: string[] }

async function registerLearner(page: Page): Promise<Learner> {
  const youtubeRequests: string[] = [];
  // Nothing may reach the real YouTube: the fake is the subject (plan Task 11 step 1).
  await page.route(/youtube\.com|youtube-nocookie\.com|googlevideo\.com/, (route) => { youtubeRequests.push(route.request().url()); void route.abort(); });
  await installFakeYouTube(page, { duration: VIDEO_DURATION });
  const email = uniqueEmail("e2e_ws");
  await page.goto("/en/register");
  await registerViaUi(page, { name: "E2E Workspace", email, password: "password123" });
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15_000 });
  return { email, youtubeRequests };
}

async function openLesson(page: Page, query = ""): Promise<void> {
  await page.goto(`/en/shadowing/${data.videoId}${query}`);
  await expect(page.getByTestId("fake-yt")).toHaveCount(1);
  // The player is ready once the controller has initialised it (one seek to the start position).
  await expect.poll(async () => (await fakeYt(page)).seeks.length).toBeGreaterThan(0);
}

/** Clicks the player's own control-bar button (a bare `name: "Play"` would also match every row's "Replay"). That bar hides while playing until the pointer moves over the video,
 *  so the pointer goes there first (a corner, clear of the centre play button). */
async function clickControl(page: Page, name: "Play" | "Pause"): Promise<void> {
  const box = await page.locator("[data-workspace-player-video]").boundingBox();
  if (!box) throw new Error("player video has no box");
  await page.mouse.move(box.x + 8, box.y + 8);
  await page.getByRole("region", { name: "Player" }).getByRole("button", { name, exact: true }).last().click();
}
const currentIndex = (page: Page) => page.locator("li[data-state='current']").getAttribute("data-index").then(Number);
const liveSentence = (page: Page) => page.getByRole("region", { name: "Live sentence" });
const row = (page: Page, index: number) => page.locator(`li[data-index='${index}']`);

async function play(page: Page): Promise<void> {
  await clickControl(page, "Play");
  await expect.poll(async () => (await fakeYt(page)).state).toBe(FAKE_YT_STATE.PLAYING);
}

async function setTime(page: Page, seconds: number): Promise<void> {
  await page.evaluate((s) => (window as unknown as { __fakeYt: { setTime(s: number): void } }).__fakeYt.setTime(s), seconds);
  await advance(page, 0.05);
}

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "Reading settings" }).click();
  return page.getByRole("dialog", { name: "Reading settings" });
}

async function setProgress(email: string, position: number): Promise<void> {
  const userId = await data.userIdByEmail(email);
  const { error } = await data.admin.from("user_video_progress").upsert({ user_id: userId, video_id: data.videoId, last_watched_position: position, last_watched_at: new Date().toISOString() });
  if (error) throw error;
}

async function setPreference(email: string, values: Record<string, unknown>): Promise<void> {
  const userId = await data.userIdByEmail(email);
  const { error } = await data.admin.from("user_preferences").upsert({ user_id: userId, ...values });
  if (error) throw error;
}

/** Client-side leave and return: the Back link (no reload), then the browser's Back into the lesson. */
async function leaveAndReturn(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Back to Shadowing Hub" }).click();
  await expect(page).toHaveURL(/\/en\/shadowing$/);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/en/shadowing/${data.videoId}`));
  await expect(page.getByTestId("fake-yt")).toHaveCount(1);
}

test("1 · lays out header, player, Live Sentence and transcript in 1280×529 with the fake as the only player", async ({ page }) => {
  const learner = await registerLearner(page);
  await openLesson(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(row(page, 0)).toBeVisible();
  const live = await liveSentence(page).boundingBox();
  expect(live && live.y + live.height).toBeLessThanOrEqual(529);
  await expect(liveSentence(page).getByText(lineTranslation(0), { exact: true })).toBeVisible();
  const scroll = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
  expect(scroll).toEqual([1280, 529]);
  expect((await fakeYt(page)).mounts).toBe(1);
  expect(learner.youtubeRequests).toEqual([]);
});

test("2 · follows the clock: the current row and Live Sentence switch at each boundary, softened in the gap", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  await play(page);
  await setTime(page, 7);
  await expect.poll(() => currentIndex(page)).toBe(2);
  await expect(row(page, 2).getByRole("button", { name: /Sentence 3/ })).toHaveAttribute("aria-current", "true");
  await expect(liveSentence(page).getByText(lineTranslation(2), { exact: true })).toBeVisible();
  for (const expected of [3, 4, 5]) {
    await advance(page, 3);
    await expect.poll(() => currentIndex(page)).toBe(expected);
    await expect(liveSentence(page).getByText(lineTranslation(expected), { exact: true })).toBeVisible();
  }
  // 16 → 17.8: past line 6's end (17.5), before line 7 (18) — the gap.
  await advance(page, 1.8);
  await expect(row(page, 5)).toHaveAttribute("data-spoken", "false");
  await expect(liveSentence(page)).toHaveAttribute("data-spoken", "false");
});

test("3 · Loop 3× + Auto Pause: exactly three plays of the sentence, then paused on it", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  const settings = await openSettings(page);
  await settings.getByRole("radiogroup", { name: "Plays per sentence" }).getByRole("radio", { name: "3×" }).click();
  await settings.getByRole("switch", { name: "Pause after each sentence" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Sentence loop" })).toHaveAttribute("aria-pressed", "true");

  const before = (await fakeYt(page)).seeks.length;
  // Part 1b T11: the seek button keeps only its sr-only number (0×0); a mouse click lands on the row's text —
  // at its start, clear of the hover toolbar at the row's right.
  await row(page, 4).locator("[data-line-id]").click({ position: { x: 8, y: 8 } });
  await expect.poll(async () => (await fakeYt(page)).state).toBe(FAKE_YT_STATE.PLAYING);
  for (let pass = 0; pass < 3; pass += 1) await advance(page, 2.6);
  const after = await fakeYt(page);
  // The row click, then two replays: three plays.
  expect(after.seeks.slice(before)).toEqual([lineStart(4), lineStart(4), lineStart(4)]);
  expect(after.state).toBe(FAKE_YT_STATE.PAUSED);
  expect(await currentIndex(page)).toBe(4);
  await advance(page, 2);
  expect((await fakeYt(page)).time).toBe(after.time);
});

test("4 · resumes after leaving the route: same sentence, paused, a fresh player", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  await row(page, 11).locator("[data-line-id]").click({ position: { x: 8, y: 8 } });
  await expect.poll(async () => (await fakeYt(page)).state).toBe(FAKE_YT_STATE.PLAYING);
  await advance(page, 1);
  await clickControl(page, "Pause");
  await expect.poll(async () => (await fakeYt(page)).state).toBe(FAKE_YT_STATE.PAUSED);
  await leaveAndReturn(page);
  await expect.poll(() => currentIndex(page)).toBe(11);
  const snapshot = await fakeYt(page);
  expect(snapshot.state).not.toBe(FAKE_YT_STATE.PLAYING);
  expect(snapshot.time).toBe(lineStart(11));
  expect(snapshot.mounts).toBe(2);
});

test("5 · a corrupt saved position opens the lesson at its start", async ({ page }) => {
  const learner = await registerLearner(page);
  await setProgress(learner.email, 99999);
  await openLesson(page);
  await expect.poll(() => currentIndex(page)).toBe(0);
  expect((await fakeYt(page)).time).toBe(0);
});

test("6 · ?line= from another video is ignored; the lesson's own line wins even under restart", async ({ page }) => {
  const learner = await registerLearner(page);
  await setProgress(learner.email, lineStart(10) + 1);
  await openLesson(page, `?line=${data.foreignLineId}`);
  await expect.poll(() => currentIndex(page)).toBe(10);

  await setPreference(learner.email, { resume_behavior: "restart" });
  await openLesson(page, `?line=${data.lineIds[19]}`);
  await expect.poll(() => currentIndex(page)).toBe(19);
  expect((await fakeYt(page)).time).toBe(lineStart(19));
});

test("7 · a mark, the lesson bookmark and a preference survive a client-side leave and return", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  const writes = (pattern: RegExp) => page.waitForResponse((response) => pattern.test(response.url()) && response.request().method() !== "GET" && response.ok());
  await row(page, 2).hover();
  const marked = writes(/\/api\/sentence-marks/);
  await row(page, 2).getByRole("button", { name: "Bookmark", exact: true }).click();
  await marked;
  const bookmarked = writes(/\/api\/videos\/[^/]+\/bookmark/);
  await page.getByRole("button", { name: "Bookmark lesson" }).click();
  await bookmarked;
  const preferred = writes(/\/api\/user\/preferences/);
  await page.getByRole("button", { name: "Study Environment" }).click();
  await page.getByRole("dialog", { name: "Study Environment" }).getByRole("radio", { name: "Rainy Day" }).click();
  await preferred;
  await page.keyboard.press("Escape");

  await leaveAndReturn(page);
  const assertSaved = async () => {
    await expect(row(page, 2).getByText("Bookmarked", { exact: true })).toBeAttached();
    await expect(page.getByRole("button", { name: "Bookmark lesson" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("shadowing-workspace")).toHaveAttribute("data-atmosphere", "rainy_day");
  };
  await assertSaved();
  // A reload drops the tab's own-write overlay: only what the server persisted can come back (review I-3).
  await page.reload();
  await expect(page.getByTestId("fake-yt")).toHaveCount(1);
  await assertSaved();
});

test("8 · Focus and Full Transcript never remount the player, nor do a divider drag or a settings change", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  await page.getByRole("button", { name: "Focus Mode" }).click();
  await expect(page.getByTestId("transcript-scroll")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("transcript-scroll")).toHaveCount(1);

  await page.getByRole("button", { name: "Full transcript" }).click();
  await expect(row(page, 0).locator("rt").first()).toBeAttached();
  expect(await page.getByTestId("workspace-player-slot").evaluate((slot) => getComputedStyle(slot).position)).toBe("fixed");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("separator", { name: "Resize workspace panes" })).toBeVisible();

  const divider = await page.getByRole("separator", { name: "Resize workspace panes" }).boundingBox();
  if (!divider) throw new Error("divider has no box");
  await page.mouse.move(divider.x + divider.width / 2, divider.y + divider.height / 2);
  await page.mouse.down();
  await page.mouse.move(divider.x - 120, divider.y + divider.height / 2, { steps: 5 });
  await page.mouse.up();
  const settings = await openSettings(page);
  await settings.getByRole("radiogroup", { name: "Font size" }).getByRole("radio", { name: "L", exact: true }).click();
  await page.keyboard.press("Escape");
  expect((await fakeYt(page)).mounts).toBe(1);
  await expect(page.getByTestId("fake-yt")).toHaveCount(1);
});

test("9 · the divider moves by keyboard and by drag, and neither pane passes its minimum", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  // Part 1b T10: the Utility Drawer adds a second separator.
  const separator = page.getByRole("separator", { name: "Resize workspace panes" });
  await separator.focus();
  await expect(separator).toHaveAttribute("aria-valuenow", "50");
  await page.keyboard.press("ArrowLeft");
  await expect(separator).toHaveAttribute("aria-valuenow", "45");

  const panes = () => page.evaluate(() => {
    const root = document.querySelector("[data-testid='shadowing-workspace']") as HTMLElement;
    const probe = (width: string) => { const el = document.createElement("div"); el.style.width = width; root.appendChild(el); const px = el.getBoundingClientRect().width; el.remove(); return px; };
    return {
      left: (document.querySelector("[data-testid='workspace-player-slot']") as HTMLElement).getBoundingClientRect().width,
      right: (document.querySelector("[data-testid='transcript-scroll']") as HTMLElement).closest(".min-w-0")!.getBoundingClientRect().width,
      leftMin: probe("var(--workspace-left-min)"),
      rightMin: probe("var(--workspace-right-min)"),
    };
  });
  const start = await panes();
  const box = await separator.boundingBox();
  if (!box) throw new Error("divider has no box");
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, y, { steps: 5 });
  await page.mouse.up();
  expect((await panes()).left).toBeGreaterThan(start.left + 50);

  for (const target of [0, 1280]) {
    const now = await separator.boundingBox();
    await page.mouse.move(now!.x + now!.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(target, y, { steps: 8 });
    await page.mouse.up();
    const sizes = await panes();
    expect(sizes.left).toBeGreaterThanOrEqual(sizes.leftMin - 1);
    expect(sizes.right).toBeGreaterThanOrEqual(sizes.rightMin - 1);
  }
});

test("10 · fullscreen (shimmed): one Escape leaves fullscreen only, the next leaves Focus, focus returns", async ({ page }) => {
  await registerLearner(page);
  await page.addInitScript(() => {
    let element: Element | null = null;
    Object.defineProperty(Document.prototype, "fullscreenElement", { configurable: true, get: () => element });
    Object.defineProperty(Document.prototype, "fullscreenEnabled", { configurable: true, get: () => true });
    Element.prototype.requestFullscreen = function requestFullscreen() { element = this; document.dispatchEvent(new Event("fullscreenchange")); return Promise.resolve(); };
    Document.prototype.exitFullscreen = function exitFullscreen() { element = null; document.dispatchEvent(new Event("fullscreenchange")); return Promise.resolve(); };
    // A browser in fullscreen consumes Escape itself; the page never sees that key press.
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && element) { event.stopImmediatePropagation(); event.preventDefault(); void document.exitFullscreen(); }
    }, true);
  });
  await openLesson(page);
  const focusMode = page.getByRole("button", { name: "Focus Mode" });
  const fullscreen = page.getByRole("button", { name: "Workspace fullscreen" });
  await focusMode.click();
  await fullscreen.click();
  await expect(fullscreen).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(fullscreen).toHaveAttribute("aria-pressed", "false");
  await expect(focusMode).toHaveAttribute("aria-pressed", "true");
  await expect(fullscreen).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(focusMode).toHaveAttribute("aria-pressed", "false");
});

test("11 · Space plays from the page but not from the focused progress slider", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Space");
  await expect.poll(async () => (await fakeYt(page)).state).toBe(FAKE_YT_STATE.PLAYING);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await fakeYt(page)).state).toBe(FAKE_YT_STATE.PAUSED);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.getByRole("slider", { name: "Seek" }).focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(300);
  expect((await fakeYt(page)).state).toBe(FAKE_YT_STATE.PAUSED);
});

test("12 · Rainy Day sets the atmosphere; under Reduce Motion no particle is rendered", async ({ page }) => {
  const learner = await registerLearner(page);
  await openLesson(page);
  await page.getByRole("button", { name: "Study Environment" }).click();
  const saved = page.waitForResponse((response) => /\/api\/user\/preferences/.test(response.url()) && response.request().method() === "PATCH");
  await page.getByRole("dialog", { name: "Study Environment" }).getByRole("radio", { name: "Rainy Day" }).click();
  await saved;
  await expect(page.getByTestId("shadowing-workspace")).toHaveAttribute("data-atmosphere", "rainy_day");
  await expect(page.locator(".atmosphere-particles > span")).toHaveCount(12);

  await setPreference(learner.email, { reduce_motion: true });
  await openLesson(page);
  await expect(page.getByTestId("atmosphere-layer")).toBeAttached();
  await expect(page.locator(".atmosphere-particles")).toHaveCount(0);
});

test("13 · a row's translation is selectable above its stretched button; Back to current hands keyboard focus to the row", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  // T7 carry-forward: the row body is a button stretched over the row; the translation must sit above it.
  const translation = row(page, 3).getByText(lineTranslation(3), { exact: true });
  const hit = await translation.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return document.elementFromPoint(box.x + 4, box.y + box.height / 2) === element;
  });
  expect(hit).toBe(true);
  await translation.selectText();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(lineTranslation(3));

  // A learner scroll suspends auto-follow; the pill, pressed from the keyboard, focuses the current row.
  const scroll = page.getByTestId("transcript-scroll");
  await scroll.hover();
  await page.mouse.wheel(0, 1200);
  const pill = page.getByRole("button", { name: "Back to current" });
  await expect(pill).toBeVisible();
  await pill.focus();
  await page.keyboard.press("Enter");
  await expect(pill).toHaveCount(0);
  await expect(row(page, 0).getByRole("button", { name: /Sentence 1\b/ })).toBeFocused();
});

test("14 · a lesson stored without a duration takes the player's: the seek bar works and the duration is saved", async ({ page }) => {
  const learner = await registerLearner(page);
  // Lesson creation stores no duration and the importer owns the lesson; videos UPDATE is owner-only (RLS),
  // exactly as the legacy view relied on: the first open by its owner fills it in.
  const owned = await data.admin.from("videos").update({ added_by_user_id: await data.userIdByEmail(learner.email), duration_seconds: null }).eq("id", data.noDurationVideoId);
  if (owned.error) throw owned.error;
  await page.goto(`/en/shadowing/${data.noDurationVideoId}`);
  await expect(page.getByTestId("fake-yt")).toHaveCount(1);
  const slider = page.getByRole("slider", { name: "Seek" });
  await expect(slider).toHaveAttribute("max", String(VIDEO_DURATION));
  await slider.fill("5");
  await expect.poll(async () => (await fakeYt(page)).time).toBe(5);
  await expect.poll(async () => {
    const { data: video } = await data.admin.from("videos").select("duration_seconds").eq("id", data.noDurationVideoId).single();
    return video?.duration_seconds;
  }).toBe(VIDEO_DURATION);
});

test("15 · watching to the end marks the lesson completed", async ({ page }) => {
  const learner = await registerLearner(page);
  await openLesson(page);
  await clickControl(page, "Play");
  await expect.poll(async () => (await fakeYt(page)).state).toBe(FAKE_YT_STATE.PLAYING);
  await setTime(page, VIDEO_DURATION - 2);
  await advance(page, 3);
  await expect.poll(async () => (await fakeYt(page)).state).toBe(FAKE_YT_STATE.ENDED);
  const userId = await data.userIdByEmail(learner.email);
  await expect.poll(async () => {
    const { data: progress } = await data.admin.from("user_video_progress").select("completed_at").eq("user_id", userId).eq("video_id", data.videoId).maybeSingle();
    return progress?.completed_at ?? null;
  }, { timeout: 10_000 }).not.toBeNull();
});
test("16 · the bar over the video hides while playing until the pointer or the keyboard needs it; the PiP drags as a whole", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  await play(page);
  const barHeight = async () => (await page.locator("[data-workspace-player-controls]").boundingBox())?.height ?? 0;

  // Playing with the pointer elsewhere: the bar has no height at all, so it can neither be seen nor hit.
  await page.mouse.move(640, 520);
  await expect.poll(barHeight).toBe(0);
  // The pointer over the video shows it; still for longer than the idle delay hides it again.
  const video = await page.locator("[data-workspace-player-video]").boundingBox();
  if (!video) throw new Error("player video has no box");
  await page.mouse.move(video.x + 20, video.y + 20);
  await expect.poll(barHeight).toBeGreaterThan(0);
  await expect.poll(barHeight, { timeout: 5_000 }).toBe(0);
  // Keyboard: Tab into the collapsed bar shows it (`:focus-visible` inside it).
  await page.mouse.move(640, 520);
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(() => Boolean(document.activeElement?.closest("[data-workspace-player-controls]")))) break;
  }
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest("[data-workspace-player-controls]")))).toBe(true);
  await expect.poll(barHeight).toBeGreaterThan(0);

  // Full Transcript: drag the PiP by its video, then a plain click on the video still toggles play.
  await page.getByRole("button", { name: "Full transcript" }).click();
  const pane = page.getByTestId("workspace-player-slot");
  const before = await pane.boundingBox();
  if (!before) throw new Error("PiP has no box");
  const from = { x: before.x + before.width / 2, y: before.y + 30 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x - 300, from.y - 150, { steps: 6 });
  await page.mouse.up();
  const after = await pane.boundingBox();
  if (!after) throw new Error("PiP has no box after the drag");
  expect(Math.round(after.x - before.x)).toBe(-300);
  expect(Math.round(after.y - before.y)).toBe(-150);
  expect((await fakeYt(page)).state).toBe(FAKE_YT_STATE.PLAYING); // the drag was not a click
  await page.mouse.click(after.x + after.width / 2, after.y + 30);
  await expect.poll(async () => (await fakeYt(page)).state).toBe(FAKE_YT_STATE.PAUSED);
  // Leaving Full Transcript puts the player back with no inline transform.
  await page.keyboard.press("Escape");
  expect(await pane.evaluate((el) => el.style.transform)).toBe("");
  expect((await fakeYt(page)).mounts).toBe(1);
});
