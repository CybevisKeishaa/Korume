import { expect, test, type Page } from "@playwright/test";
import { FAKE_YT_STATE, fakeYt } from "./fixtures/fake-youtube";
import { answerOf, composer, openLessonAt as openLessonAtWith, openMascot, registerLearner as registerLearnerWith, setTime, sheet, stubTurns } from "./fixtures/korume-page";
import { ENT, RETRY_QUESTION, SEEDED_ANSWER, SEEDED_QUESTION, TOK, seedKorumeData, setCompanionEnabled, type KorumeData } from "./fixtures/korume-data";
import { lineStart, lineText, seedWorkspaceData, type WorkspaceData } from "./fixtures/workspace-data";

/**
 * Ask Korume browser acceptance (spec §7.6, plan Task 11 step 2). Fake provider: `AI_PROVIDER=none`, so every
 * answered turn is either SEEDED (persisted grounding, the real read path) or STUBBED at `POST /turns` (the
 * client's handling of each status). Threads are created for real. The owner's viewport, 1280×529.
 */
test.use({ viewport: { width: 1280, height: 529 } });

let data: WorkspaceData;
test.beforeAll(async () => { data = await seedWorkspaceData(); });
test.afterAll(async () => { await data?.cleanup(); });

const registerLearner = (page: Page, prefix: string) => registerLearnerWith(data, page, prefix);
const openLessonAt = (page: Page, index: number) => openLessonAtWith(data, page, index);

async function threadPosts(page: Page) {
  const posts: { threadId: string; lineId?: string; span?: { start: number; end: number } }[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/korume/threads") posts.push(request.postDataJSON() as (typeof posts)[number]);
  });
  return posts;
}

test("1 · the sheet asks about the line it was opened on, never moves the video, and offers a new draft", async ({ page }) => {
  await registerLearner(page, "e2e_korume_sheet");
  const posts = await threadPosts(page);
  const turns = await stubTurns(page, (body) => ({ status: 200, body: answerOf(body.turnId, `Answer to: ${body.text}`) }));
  await openLessonAt(page, 3);
  await page.getByRole("region", { name: "Player" }).getByRole("button", { name: "Play", exact: true }).last().click({ force: true });
  await expect.poll(async () => (await fakeYt(page)).state).toBe(FAKE_YT_STATE.PLAYING);

  await openMascot(page);
  await expect(sheet(page)).toBeVisible();
  await expect(composer(sheet(page))).toBeFocused();
  // Geometry (spec §5.1): small = 400 × 560 in REFERENCE px (the density unit is 100vw/1440, so 0.889 at 1280), clamped to
  // the viewport minus the margins, floating beside the mascot's corner — never a full-height sheet. Sizes live in
  // korume-sheet.spec.ts; here only that it is a floating, in-viewport small sheet.
  const box = await sheet(page).boundingBox();
  await expect(sheet(page)).toHaveAttribute("data-layout", "small");
  expect(box!.x).toBeGreaterThan(0);
  expect(box!.y).toBeGreaterThan(0);
  expect(box!.x + box!.width).toBeLessThan(1280);
  expect(box!.y + box!.height).toBeLessThan(529);
  expect((await fakeYt(page)).mounts).toBe(1);
  expect((await fakeYt(page)).state).toBe(FAKE_YT_STATE.PLAYING);
  await expect(page.locator("body")).not.toContainText(/sensei/i);

  // `k` inside the composer is text, not the shortcut.
  await composer(sheet(page)).pressSequentially("k");
  await expect(composer(sheet(page))).toHaveValue("k");
  await composer(sheet(page)).fill("What does は do here?");
  await composer(sheet(page)).press("Enter");
  await expect(sheet(page).getByText("Answer to: What does は do here?")).toBeVisible();
  expect(posts).toHaveLength(1);
  expect(posts[0]!.lineId).toBe(data.lineIds[3]);
  expect(turns[0]!.url).toContain(`/api/korume/threads/${posts[0]!.threadId}/turns`);

  // Playback moves on: the chip keeps line 3 and the sheet offers a NEW draft for the current line.
  await setTime(page, lineStart(10) + 0.3);
  await expect(sheet(page).getByRole("button", { name: `Asking about this line: ${lineText(3)}` })).toBeVisible();
  await sheet(page).getByRole("button", { name: "Ask about the current line" }).click();
  await expect(sheet(page).getByRole("button", { name: `Asking about this line: ${lineText(10)}` })).toBeVisible();
  await composer(sheet(page)).fill("And this one?");
  await composer(sheet(page)).press("Enter");
  await expect(sheet(page).getByText("Answer to: And this one?")).toBeVisible();
  expect(posts).toHaveLength(2);
  expect(posts[1]!.threadId).not.toBe(posts[0]!.threadId);
  expect(posts[1]!.lineId).toBe(data.lineIds[10]);
  expect((await fakeYt(page)).mounts).toBe(1);

  // Escape closes the sheet first (before the drawer), and focus returns to the mascot.
  await page.getByRole("region", { name: "Study tools" }).getByRole("tab", { name: "Notes" }).click();
  const level = await page.locator("section[data-drawer-level]").getAttribute("data-drawer-level");
  expect(level).not.toBe("collapsed");
  await composer(sheet(page)).focus();
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Ask Korume" })).toBeFocused();
  await expect(page.locator("section[data-drawer-level]")).toHaveAttribute("data-drawer-level", level!);

  // Expand → the full chat for that thread; Back → the Shadowing line it was asked about.
  await openMascot(page);
  await sheet(page).getByRole("link", { name: "Open full chat" }).click();
  await expect(page).toHaveURL(new RegExp(`/en/korume/chat\\?thread=${posts[1]!.threadId}$`));
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(new RegExp(`/en/shadowing/${data.videoId}\\?line=${data.lineIds[10]}$`));
});

test("2 · /korume/chat renders a seeded thread from persisted grounding, with no Korume request on reload", async ({ page }) => {
  const learner = await registerLearner(page, "e2e_korume_chat");
  const seeded: KorumeData = await seedKorumeData(data.admin, { userId: learner.userId, videoId: data.videoId, lineIds: data.lineIds });
  try {
    await page.goto(`/en/korume/chat?thread=${seeded.threadId}`);
    await expect(page.getByText(SEEDED_QUESTION)).toBeVisible();
    await expect(page.getByText(SEEDED_ANSWER)).toBeVisible();
    const rail = page.getByRole("complementary", { name: "Learning context" });
    await expect(rail.getByText(lineText(3))).toBeVisible();
    await expect(rail.getByText(`Seen ${ENT.seenCount} times`, { exact: true })).toBeVisible();
    await expect(rail.getByText(`Seen ${TOK.seenCount} times`, { exact: true })).toBeVisible();
    await expect(page.getByText(`You've seen ${ENT.label} in ${ENT.seenCount} Shadowing lines.`)).toBeVisible();
    await expect(page.getByRole("link", { name: "Korume Memory" })).toHaveAttribute("href", "/en/companion");
    await expect(page.locator("body")).not.toContainText(/sensei/i);

    learner.korumeRequests.length = 0;
    await page.reload();
    await expect(page.getByText(SEEDED_ANSWER)).toBeVisible();
    await page.waitForTimeout(1_000);
    expect(learner.korumeRequests).toEqual([]);

    // Switching threads from ⋯ shows THAT thread (the retryable one: Try again at once, no 180 s wait) …
    await page.getByRole("button", { name: "Past conversations" }).click();
    await page.getByRole("link", { name: /A released turn/ }).click();
    await expect(page).toHaveURL(new RegExp(`thread=${seeded.retryThreadId}$`));
    await expect(page.getByText(RETRY_QUESTION)).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByText(SEEDED_ANSWER)).toHaveCount(0);
    // The switch remounts the conversation: focus lands in its composer, never on <body> (jsdom cannot see this).
    await expect(composer(page)).toBeFocused();
    // … and back again shows the first one, not a stale copy of either.
    await page.getByRole("button", { name: "Past conversations" }).click();
    await page.getByRole("link", { name: /Topic particle/ }).click();
    await expect(page.getByText(SEEDED_ANSWER)).toBeVisible();
    await expect(page.getByText(RETRY_QUESTION)).toHaveCount(0);
    await expect(composer(page)).toBeFocused();

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(new RegExp(`/en/shadowing/${data.videoId}\\?line=${data.lineIds[3]}$`));
  } finally {
    await seeded.cleanup();
  }
});

test("3 · each refusal is shown inline, and Try again resends the same turnId", async ({ page }) => {
  await registerLearner(page, "e2e_korume_errors");
  const replies = [
    { status: 402, body: { error: "quota_exhausted", reason: "free_daily_limit", limit: 10, resetsAt: "2026-10-04T09:00:00.000Z" } },
    { status: 402, body: { error: "quota_exhausted", reason: "plus_credits_exhausted", resetsAt: "2026-11-01T00:00:00.000Z" } },
    { status: 429, body: { error: "rate_limited" }, headers: { "Retry-After": "7" } },
    { status: 503, body: { error: "ai_unavailable", reason: "budget" } },
    { status: 409, body: { error: "turn_conflict" } },
    { status: 502, body: { error: "answer_failed", retryable: true } },
  ];
  const expected = [/You've asked 10 questions today/, /AI credits are used up/, /Slow down a little/, /Korume is resting/, /That question changed/];
  const bodies = await stubTurns(page, (body, call) => (call <= replies.length ? replies[call - 1]! : { status: 200, body: answerOf(body.turnId, "Recovered.") }));
  for (const [index, pattern] of expected.entries()) {
    await page.goto("/en/korume/chat");
    await composer(page).fill(`Question ${index}`);
    await composer(page).press("Enter");
    await expect(page.getByText(pattern)).toBeVisible();
  }
  await page.goto("/en/korume/chat");
  await composer(page).fill("Fails once");
  await composer(page).press("Enter");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Recovered.")).toBeVisible();
  expect(bodies.at(-1)!.turnId).toBe(bodies.at(-2)!.turnId);
});

test("4 · Korume off: no mascot, no Korume request at all, and the chat page is a disabled state", async ({ page }) => {
  const learner = await registerLearner(page, "e2e_korume_off");
  await setCompanionEnabled(data.admin, learner.userId, false);
  learner.korumeRequests.length = 0;
  await openLessonAt(page, 3);
  await expect(page.getByRole("button", { name: "Ask Korume" })).toHaveCount(0);
  await page.locator("body").press("k");
  await page.waitForTimeout(5_000);
  expect(learner.korumeRequests).toEqual([]);
  await expect(sheet(page)).toHaveCount(0);

  await page.goto("/en/korume/chat");
  await expect(page.getByText("Korume is turned off")).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
});

test("5 · one persona: no Sensei on Settings or Pronunciation, and /companion has no composer", async ({ page }) => {
  await registerLearner(page, "e2e_korume_persona");
  for (const path of ["/en/settings", "/en/pronunciation"]) {
    await page.goto(path);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/sensei/i);
    const names = await page.locator("[aria-label]").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
    expect(names.filter((name) => /sensei/i.test(name))).toEqual([]);
  }
  await expect(page).toHaveTitle(/^(?![\s\S]*sensei)/i);
  await page.goto("/en/companion");
  await expect(page.getByRole("textbox")).toHaveCount(0);
});

test("6 · a free chat's first send puts its new thread in the URL by replace; the page is not remounted", async ({ page }) => {
  await registerLearner(page, "e2e_korume_free_url");
  const posts = await threadPosts(page);
  await stubTurns(page, (body) => ({ status: 200, body: answerOf(body.turnId, `Answer to: ${body.text}`) }));
  await page.goto("/en/korume/chat");
  // router.refresh() after the answer: the RSC fetch of this page under ?thread (not a Link prefetch).
  const refreshed = page.waitForResponse((response) => {
    const headers = response.request().headers();
    return headers.rsc === "1" && !headers["next-router-prefetch"] && /\/en\/korume\/chat\?thread=/.test(response.url());
  });
  await composer(page).fill("A free question");
  await composer(page).press("Enter");
  await expect(page.getByText("Answer to: A free question")).toBeVisible();
  expect(posts).toHaveLength(1);
  await expect(page).toHaveURL(new RegExp(`/en/korume/chat\\?thread=${posts[0]!.threadId}$`));
  // That refresh re-renders the page under ?thread: same conversation, focus kept.
  await refreshed;
  await expect(page.getByText("A free question", { exact: true })).toBeVisible();
  await expect(composer(page)).toBeFocused();
  // Reload shows that thread (it exists for real; the stubbed turn was never persisted), not a not-found line.
  await page.reload();
  await expect(composer(page)).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "could not be found" })).toHaveCount(0);
  // Replace, not push: Back leaves the chat instead of landing on an empty free chat.
  await page.goBack();
  await expect(page).toHaveURL(/\/en\/dashboard$/);
});

test("7 · a selected span of a transcript line is the anchor the sheet asks about", async ({ page }) => {
  await registerLearner(page, "e2e_korume_span");
  const posts = await threadPosts(page);
  await stubTurns(page, (body) => ({ status: 200, body: answerOf(body.turnId, `Answer to: ${body.text}`) }));
  await openLessonAt(page, 3);
  // UTF-16 [0, 2) of line 4 (今日), selected with a real Range as a drag would leave it.
  await page.locator("li[data-index='4'] [data-line-id]").evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (node.parentElement?.closest("rt, rp") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const range = document.createRange();
    let node = walker.nextNode() as Text;
    range.setStart(node, 0);
    let remaining = 2;
    while (remaining > node.length) { remaining -= node.length; node = walker.nextNode() as Text; }
    range.setEnd(node, remaining);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  });
  // The mascot reads the selection on pointerdown — a click can collapse it before onClick.
  await openMascot(page);
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByRole("button", { name: `Asking about this line: ${lineText(4)}` })).toBeVisible();
  await composer(sheet(page)).fill("What is this word?");
  await composer(sheet(page)).press("Enter");
  await expect(sheet(page).getByText("Answer to: What is this word?")).toBeVisible();
  expect(posts).toHaveLength(1);
  expect(posts[0]).toMatchObject({ lineId: data.lineIds[4], span: { start: 0, end: 2 } });
});

test("8 · Back from a created thread to a not-found ?thread shows that page, not the created conversation", async ({ page }) => {
  await registerLearner(page, "e2e_korume_back");
  const posts = await threadPosts(page);
  await stubTurns(page, (body) => ({ status: 200, body: answerOf(body.turnId, `Answer to: ${body.text}`) }));
  const missing = "00000000-0000-4000-8000-00000000dead";
  const notFound = () => page.getByRole("status").filter({ hasText: "could not be found" });
  await page.goto(`/en/korume/chat?thread=${missing}`);
  await expect(notFound()).toBeVisible();
  // New conversation PUSHES the bare chat; its first send then REPLACES that entry with ?thread=<created>.
  await page.getByRole("button", { name: "Past conversations" }).click();
  await page.getByRole("link", { name: "New conversation" }).click();
  await expect(page).toHaveURL(/\/en\/korume\/chat$/);
  await composer(page).fill("Asked before Back");
  await composer(page).press("Enter");
  await expect(page.getByText("Answer to: Asked before Back")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`thread=${posts[0]!.threadId}$`));
  await page.goBack();
  await expect(notFound()).toBeVisible();
  await expect(page.getByText("Asked before Back", { exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`thread=${missing}$`));
});
