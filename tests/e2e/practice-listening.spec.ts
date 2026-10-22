import { expect, test, type Page } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./fixtures/auth";
import { FAKE_YT_STATE, fakeYt, installFakeYouTube } from "./fixtures/fake-youtube";
import { lineStart, seedWorkspaceData, VIDEO_DURATION, type WorkspaceData } from "./fixtures/workspace-data";
import { toFurigana } from "@/lib/japanese/furigana";

/**
 * Browser acceptance for Listening Practice (practice modes B2, plan Task 9). The shared workspace lesson's lines
 * all carry digits, which the chunker sends to Typing (D9); lines 0–3 are rewritten here to sentences it cuts
 * reliably, line 4 keeps its digits for the fallback case. "Never visible" is read from a MutationObserver
 * installed before the app loads (`installSurfaceObserver`), which records every attachment of an answer
 * surface, not from one snapshot. The owner's viewport, a fresh learner per test.
 */
test.use({ viewport: { width: 1280, height: 529 } });

const LINES = [
  { text: "毎日日本語を勉強しました。", chunks: ["毎日", "日本語を", "勉強しました。"] },
  { text: "私は「はい」と言った。", chunks: ["私は", "「はい」と", "言った。"] },
  { text: "今日はいい天気ですね？", chunks: ["今日は", "いい", "天気ですね？"] },
  { text: "注文をお願いします。", chunks: ["注文を", "お願いします。"] },
] as const;
const UNRELIABLE = 4;

let data: WorkspaceData;
test.beforeAll(async () => {
  data = await seedWorkspaceData();
  for (const [index, line] of LINES.entries()) {
    const { error } = await data.admin.from("transcript_lines")
      .update({ text_jp: line.text, furigana_json: await toFurigana(line.text) }).eq("id", data.lineIds[index]!);
    if (error) throw error;
  }
});
test.afterAll(async () => { await data?.cleanup(); });

/** Every element that would show the answer (Task 9 brief), plus Korume (P15) and the feedback text (P14). */
const SURFACES = {
  subtitle: "[data-testid='workspace-subtitle']",
  answer: "[data-testid='listening-answer']",
  slotResult: "li[data-result]",
  diff: "[data-testid='typing-diff']",
  korume: "[data-mascot-pose^='listening-']",
  feedback: "[data-testid='listening-feedback']",
} as const;
type Surface = { kind: keyof typeof SURFACES; text: string };

/**
 * Walks up from each mutation's target only, so a reveal by toggling hidden/class/style on an ANCESTOR of a
 * surface that stays mounted is not recorded. Safe here: every concealed state also asserts toHaveCount(0).
 */
async function installSurfaceObserver(page: Page): Promise<void> {
  await page.addInitScript((selectors: Record<string, string>) => {
    const seen: { kind: string; text: string }[] = [];
    (window as unknown as { __surfaces: typeof seen }).__surfaces = seen;
    const record = (node: Node | null, added: boolean) => {
      const element = node instanceof Element ? node : node?.parentElement ?? null;
      if (!element) return;
      for (const [kind, selector] of Object.entries(selectors)) {
        const hits = new Set<Element>();
        const own = element.closest(selector);
        if (own) hits.add(own);
        if (added && node instanceof Element) node.querySelectorAll(selector).forEach((hit) => hits.add(hit));
        hits.forEach((hit) => seen.push({ kind, text: hit.textContent ?? "" }));
      }
    };
    new MutationObserver((records) => {
      for (const r of records) {
        record(r.target, false);
        r.addedNodes.forEach((node) => record(node, true));
      }
    }).observe(document, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["data-result", "data-testid", "data-mascot-pose", "hidden", "style", "class"] });
  }, SURFACES);
}

const ANSWER_KINDS: Surface["kind"][] = ["subtitle", "answer", "slotResult", "diff"];
async function surfaces(page: Page, kinds: Surface["kind"][] = ANSWER_KINDS): Promise<Surface[]> {
  const all = await page.evaluate(() => (window as unknown as { __surfaces: Surface[] }).__surfaces.slice());
  return all.filter((surface) => kinds.includes(surface.kind));
}
const resetSurfaces = (page: Page) => page.evaluate(() => { (window as unknown as { __surfaces: unknown[] }).__surfaces.length = 0; });
/** Lets any late commit land before "never" is read. */
async function expectNoSurface(page: Page, kinds: Surface["kind"][] = ANSWER_KINDS): Promise<void> {
  await page.waitForTimeout(400);
  expect(await surfaces(page, kinds)).toEqual([]);
}

async function registerLearner(page: Page): Promise<void> {
  await page.route(/youtube\.com|youtube-nocookie\.com|googlevideo\.com/, (route) => route.abort());
  await installFakeYouTube(page, { duration: VIDEO_DURATION });
  await installSurfaceObserver(page);
  const email = uniqueEmail("e2e_pl");
  await page.goto("/en/register");
  await registerViaUi(page, { name: "E2E Listening", email, password: "password123" });
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15_000 });
}

async function openLesson(page: Page, path = "/listening"): Promise<void> {
  await page.goto(`/en/shadowing/${data.videoId}${path}`);
  await expect(page.getByTestId("fake-yt")).toHaveCount(1);
  await expect.poll(async () => (await fakeYt(page)).seeks.length).toBeGreaterThan(0);
}

const modeBar = (page: Page) => page.getByRole("navigation", { name: "Learning modes" });
const practice = (page: Page) => page.getByRole("region", { name: "Listening practice" });
const player = (page: Page) => page.getByRole("region", { name: "Player" });
const navigator = (page: Page) => page.getByRole("navigation", { name: "Sentence navigator" });
const strip = (page: Page) => page.getByTestId("lesson-stat-strip");
const stat = (page: Page, name: "sentence" | "scored" | "average") => strip(page).locator(`[data-stat="${name}"] dd`);
const bank = (page: Page) => practice(page).getByRole("list", { name: "Word bank" });
const slots = (page: Page) => practice(page).getByRole("list", { name: "Your sentence" }).locator("li[data-slot]");
const slot = (page: Page, index: number) => practice(page).locator(`li[data-slot='${index}']`);
const feedback = (page: Page) => practice(page).getByTestId("listening-feedback");
const korume = (page: Page) => page.locator(SURFACES.korume);
const typingInput = (page: Page) => practice(page).getByRole("textbox", { name: "Type what you hear" });
const formatRadio = (page: Page, name: "Word Bank" | "Typing") => practice(page).getByRole("radiogroup", { name: "Listening format" }).getByRole("radio", { name });
const button = (page: Page, name: string) => practice(page).getByRole("button", { name, exact: true });

async function place(page: Page, chunks: readonly string[]): Promise<void> {
  for (const chunk of chunks) await bank(page).getByRole("button", { name: chunk, exact: true }).click();
}

async function expectConcealed(page: Page): Promise<void> {
  await expect(page.getByTestId("listen-cover")).toBeVisible();
  await expect(page.getByTestId("workspace-subtitle")).toHaveCount(0);
  await expect(page.getByTestId("listening-answer")).toHaveCount(0);
  await expect(page.locator(SURFACES.slotResult)).toHaveCount(0);
  await expect(page.getByTestId("typing-diff")).toHaveCount(0);
  await expect(page.getByTestId("listening-score")).toHaveCount(0);
  await expect(korume(page)).toHaveCount(0);
}

async function expectEmptyBank(page: Page, n: number): Promise<void> {
  await expect(slots(page)).toHaveCount(n);
  await expect(slots(page).getByRole("button")).toHaveCount(0);
  await expect(bank(page).getByRole("button")).toHaveCount(n);
}

/** Holds the next attempt POST: the figure must be absent while it is pending (P15), then the response lands. */
async function heldSubmit(page: Page, action: () => Promise<void>): Promise<void> {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/dictation/attempt", async (route) => { await gate; await route.continue(); }, { times: 1 });
  await action();
  await expect(feedback(page)).toContainText("Checking…");
  await expect(korume(page)).toHaveCount(0);
  release();
  await expect(feedback(page)).not.toContainText("Checking…");
}

test("1 · one player instance across three modes (spec §3.1 B2 gate)", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page, "");
  // Positive controls for case 2: Shadowing shows the drawer and the floating Korume.
  await expect(page.getByRole("region", { name: "Study tools" })).toHaveCount(1);
  await expect(page.getByTestId("korume-mascot")).toHaveCount(1);
  await page.getByTestId("fake-yt").evaluate((element) => element.setAttribute("data-instance-marker", "kept"));
  const kept = page.locator("[data-testid='fake-yt'][data-instance-marker='kept']");
  await modeBar(page).getByRole("link", { name: "Pronunciation" }).click();
  await expect(page.getByRole("region", { name: "Pronunciation practice" })).toBeVisible();
  await modeBar(page).getByRole("link", { name: "Listening" }).click();
  await expect(page).toHaveURL(/\/listening$/);
  await expect(bank(page)).toBeVisible();
  await expectConcealed(page);
  await expect(kept).toHaveCount(1);
  await formatRadio(page, "Typing").click();
  await expect(page).toHaveURL(/\/listening\?format=typing$/);
  await expect(typingInput(page)).toBeVisible();
  await expectConcealed(page);
  await expect(kept).toHaveCount(1);
  await modeBar(page).getByRole("link", { name: "Shadowing" }).click();
  await expect(page).toHaveURL(new RegExp(`/shadowing/${data.videoId}$`));
  await expect(kept).toHaveCount(1);
  // The fake fires onReady once per construction: one mount is one onReady.
  expect((await fakeYt(page)).mounts).toBe(1);
});

test("2 · entering Listening conceals from the first frame; every player control works under the cover", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  await expect(bank(page)).toBeVisible();
  await expectConcealed(page);
  await expect(page.getByRole("region", { name: "Study tools" })).toHaveCount(0);
  await expect(page.getByTestId("korume-mascot")).toHaveCount(0);
  await expect(player(page).getByRole("button", { name: "Hide subtitles" })).toHaveAttribute("aria-pressed", "true");
  await expectNoSurface(page);

  const box = await page.locator("[data-workspace-player-video]").boundingBox();
  if (!box) throw new Error("player video has no box");
  const control = async (name: string) => {
    await page.mouse.move(box.x + 8, box.y + 8);
    await player(page).getByRole("button", { name, exact: true }).last().click();
  };
  await control("Play");
  await expect.poll(async () => (await fakeYt(page)).state).toBe(FAKE_YT_STATE.PLAYING);
  await control("Pause");
  await expect.poll(async () => (await fakeYt(page)).state).toBe(FAKE_YT_STATE.PAUSED);
  await control("Next sentence");
  await expect(stat(page, "sentence")).toHaveText(/^2\//);
  await control("Next sentence");
  await expect(stat(page, "sentence")).toHaveText(/^3\//);
  await control("Previous sentence");
  await expect(stat(page, "sentence")).toHaveText(/^2\//);
  const before = (await fakeYt(page)).seeks.length;
  await control("Back 5 seconds");
  await expect.poll(async () => (await fakeYt(page)).seeks.length).toBeGreaterThan(before);
  expect((await fakeYt(page)).seeks.at(-1)).toBeLessThan(lineStart(1));
  await page.mouse.move(box.x + 8, box.y + 8);
  await player(page).getByRole("button", { name: /^Playback speed / }).click();
  await page.getByRole("radiogroup", { name: "Playback speed" }).getByRole("radio", { name: "0.75×" }).click();
  await expect.poll(async () => (await fakeYt(page)).rate).toBe(0.75);
  const loop = player(page).getByRole("button", { name: "Sentence loop" });
  for (const [count, pressed] of [["3×", "true"], ["1×", "false"]] as const) {
    await page.mouse.move(box.x + 8, box.y + 8);
    await loop.click();
    await page.getByRole("radiogroup", { name: "Plays per sentence" }).getByRole("radio", { name: count }).click();
    await expect(loop).toHaveAttribute("aria-pressed", pressed);
  }
  await expect(page.getByTestId("listen-cover")).toBeVisible();

  // Show video lifts the cover for this line only.
  await page.getByTestId("listen-cover").getByRole("button", { name: "Show video" }).click();
  await expect(page.getByTestId("listen-cover")).toHaveCount(0);
  await control("Next sentence");
  await expect(page.getByTestId("listen-cover")).toBeVisible();
  await expectNoSurface(page);
});

test("3 · Word Bank, correct: score 100, joy, the subtitle for this line only; Next conceals again", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  await expect(korume(page)).toHaveCount(0);
  await place(page, LINES[0].chunks);
  await heldSubmit(page, () => button(page, "Check").click());
  await expect(page.getByTestId("listening-score")).toHaveText("100");
  for (const index of [0, 1, 2]) await expect(slot(page, index)).toHaveAttribute("data-result", "correct");
  await expect(feedback(page)).toContainText("You arranged the whole sentence yourself!");
  await expect(korume(page)).toHaveAttribute("data-mascot-pose", "listening-joy");
  await expect(page.getByTestId("workspace-subtitle")).toHaveText(LINES[0].text);
  // Positive control: the observer every "never" below relies on does see each surface once it is attached.
  expect(new Set((await surfaces(page, [...ANSWER_KINDS, "korume"])).map((surface) => surface.kind))).toEqual(new Set(["subtitle", "answer", "slotResult", "korume"]));
  await page.getByTestId("listen-cover").getByRole("button", { name: "Show video" }).click();
  await expect(page.getByTestId("listen-cover")).toHaveCount(0);

  await resetSurfaces(page);
  await button(page, "Next sentence").click();
  await expect(stat(page, "sentence")).toHaveText(/^2\//);
  await expectEmptyBank(page, LINES[1].chunks.length);
  await expectConcealed(page);
  await expectNoSurface(page, [...ANSWER_KINDS, "korume"]);
});

test("3b · a delayed Check whose attempt was discarded never shows the figure or a score", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const response = page.waitForResponse((r) => r.url().endsWith("/api/dictation/attempt"));
  await page.route("**/api/dictation/attempt", async (route) => { await gate; await route.continue(); }, { times: 1 });
  await place(page, LINES[0].chunks);
  await button(page, "Check").click();
  await expect(feedback(page)).toContainText("Checking…");
  // Try again is not offered while a Check is pending; leaving the line and coming back discards the attempt
  // the same way (a new attempt on the same line and format, P11).
  await button(page, "Next sentence").click();
  await expect(stat(page, "sentence")).toHaveText(/^2\//);
  await navigator(page).getByRole("button", { name: /^Sentence 1,/ }).click();
  await expect(stat(page, "sentence")).toHaveText(/^1\//);
  await expectEmptyBank(page, 3);
  await resetSurfaces(page);
  release();
  expect((await response).status()).toBe(200);
  await expectNoSurface(page, [...ANSWER_KINDS, "korume"]);
  await expectConcealed(page);
  await expectEmptyBank(page, 3);
});

test("4 · Word Bank, wrong then Try again: counts match the colours; the fix is counted", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  await expect(bank(page)).toBeVisible();
  const order = await bank(page).getByRole("button").allTextContents();
  const [a, b, c] = LINES[0].chunks;
  await place(page, [b, a, c]);
  await heldSubmit(page, () => button(page, "Check").click());
  const score = Number(await page.getByTestId("listening-score").textContent());
  expect(score).toBeLessThan(100);
  await expect(slot(page, 0)).toHaveAttribute("data-result", "wrong");
  await expect(slot(page, 1)).toHaveAttribute("data-result", "wrong");
  await expect(slot(page, 2)).toHaveAttribute("data-result", "correct");
  await expect(feedback(page)).toContainText("You got 1/3 chunks right. Listen again and watch the order of the 2 chunks still wrong.");
  await expect(korume(page)).toHaveAttribute("data-mascot-pose", "listening-encourage");

  await button(page, "Try again").click();
  await expect(korume(page)).toHaveCount(0);
  await expectEmptyBank(page, 3);
  expect(await bank(page).getByRole("button").allTextContents()).toEqual(order);
  await expectConcealed(page);
  await expect(feedback(page)).toContainText(`New attempt. Your last score on this sentence was ${score}.`);
  await place(page, LINES[0].chunks);
  await heldSubmit(page, () => button(page, "Check").click());
  await expect(page.getByTestId("listening-score")).toHaveText("100");
  await expect(feedback(page)).toContainText("You fixed 2 chunks since your last try.");
  await expect(korume(page)).toHaveAttribute("data-mascot-pose", "listening-joy");
});

test("5 · Hint replaces a wrong chunk in its slot; the hinted slot counts as hinted, never as correct", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  const [a, b, c] = LINES[0].chunks;
  await place(page, [b]);
  await button(page, "Hint").click();
  await expect(slot(page, 0).getByRole("button")).toHaveAccessibleName(`Slot 1 of 3, ${a}, hint`);
  await expect(slot(page, 0).getByRole("button")).toBeDisabled();
  await expect(slot(page, 0)).toContainText("Hint");
  await expect(bank(page).getByRole("button", { name: b, exact: true })).toBeVisible();
  await expect(bank(page).getByRole("button", { name: a, exact: true })).toHaveCount(0);
  await expect(korume(page)).toHaveCount(0);
  await place(page, [b, c]);
  await heldSubmit(page, () => button(page, "Check").click());
  await expect(slot(page, 0)).toHaveAttribute("data-result", "hinted");
  await expect(slot(page, 1)).toHaveAttribute("data-result", "correct");
  await expect(slot(page, 2)).toHaveAttribute("data-result", "correct");
  await expect(feedback(page)).toContainText("You got 2/3 chunks right.");
  await expect(feedback(page)).toContainText("1 hinted chunk doesn't count as your own.");
  await expect(feedback(page)).not.toContainText("whole sentence yourself");
  await expect(korume(page)).toHaveAttribute("data-mascot-pose", "listening-encourage");
});

test("6 · Show answer: revealed, no score, video still covered; navigator, strip and Summary agree", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  await expect(bank(page)).toBeVisible();
  await expect(stat(page, "scored")).toHaveText(/^0\//);
  const average = await stat(page, "average").textContent();
  await resetSurfaces(page);
  await button(page, "Hint").click();
  await expect(feedback(page)).toContainText("1 chunk hinted so far. Hinted parts don't count toward recall.");
  await page.waitForTimeout(300);
  const said = (await surfaces(page, ["feedback"])).map((surface) => surface.text);
  expect(said.length).toBeGreaterThan(0);
  for (const unhinted of LINES[0].chunks.slice(1)) for (const text of said) expect(text).not.toContain(unhinted);
  await expect(korume(page)).toHaveCount(0);

  await heldSubmit(page, () => button(page, "Show answer").click());
  await expect(page.getByTestId("listening-answer")).toHaveText(LINES[0].text);
  await expect(feedback(page)).toContainText("This sentence is marked for review. This attempt has no score and doesn't count toward today's mission.");
  await expect(page.getByTestId("listening-score")).toHaveCount(0);
  await expect(page.getByTestId("listen-cover")).toBeVisible();
  await expect(korume(page)).toHaveAttribute("data-mascot-pose", "listening-review");
  // R32: the review figure goes with the line.
  await button(page, "Next sentence").click();
  await expectConcealed(page);

  await page.reload();
  await expect(practice(page)).toBeVisible();
  await expect(navigator(page).getByRole("button", { name: "Sentence 1, answer shown" })).toBeVisible();
  await expect(stat(page, "average")).toHaveText(average ?? "");
  await page.goto(`/en/shadowing/${data.videoId}/summary`);
  const row = page.locator("[data-summary-area='review'] li").filter({ hasText: LINES[0].text });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Answer shown");
});

test("7 · Typing: coloured diff and metrics; hints never edit the input; keys and IME stay in the input", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page, "/listening?format=typing");
  const posts: string[] = [];
  page.on("request", (request) => { if (request.url().endsWith("/api/dictation/attempt")) posts.push(request.method()); });
  await expect(typingInput(page)).toBeVisible();
  const seeks = (await fakeYt(page)).seeks.length;
  await typingInput(page).click();
  for (const key of ["ArrowRight", "ArrowLeft", "Space"]) await typingInput(page).press(key);
  await page.waitForTimeout(300);
  await expect(stat(page, "sentence")).toHaveText(/^1\//);
  expect((await fakeYt(page)).state).not.toBe(FAKE_YT_STATE.PLAYING);
  expect((await fakeYt(page)).seeks.length).toBe(seeks);

  await typingInput(page).fill("毎日日");
  await typingInput(page).evaluate((input) => {
    input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", isComposing: true, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(300);
  expect(posts).toEqual([]);
  await typingInput(page).evaluate((input) => input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })));

  await button(page, "Hint").click();
  await expect(practice(page).getByTestId("typing-hint")).toContainText(LINES[0].chunks[0]);
  await expect(typingInput(page)).toHaveValue("毎日日");

  await typingInput(page).fill("毎日日本語お勉強しました。");
  await typingInput(page).press("Enter");
  await expect(page.getByTestId("typing-diff")).toBeVisible();
  expect((await surfaces(page, ["diff"])).length).toBeGreaterThan(0); // the observer's positive control for the diff
  await expect(page.getByTestId("typing-diff").locator("[data-op='wrong'], [data-op='missing']")).not.toHaveCount(0);
  expect(Number(await page.getByTestId("listening-score").textContent())).toBeLessThan(100);
  await expect(practice(page).locator("dt", { hasText: "Kanji" })).toHaveCount(1);
  await expect(practice(page).locator("dt", { hasText: "Grammar" })).toHaveCount(1);
  expect(posts).toEqual(["POST"]);
});

test("8 · changing sentence mid-attempt discards it; returning shows a fresh, concealed attempt", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  await place(page, LINES[0].chunks.slice(0, 2));
  await resetSurfaces(page);
  await button(page, "Next sentence").click();
  await expect(stat(page, "sentence")).toHaveText(/^2\//);
  await expectEmptyBank(page, LINES[1].chunks.length);
  await expectConcealed(page);
  await navigator(page).getByRole("button", { name: /^Sentence 1,/ }).click();
  await expectEmptyBank(page, 3);
  await expectConcealed(page);
  await expectNoSurface(page);

  // A checked line, left and returned to, shows no old answer.
  await place(page, LINES[0].chunks);
  await button(page, "Check").click();
  await expect(page.getByTestId("listening-score")).toHaveText("100");
  await navigator(page).getByRole("button", { name: /^Sentence 2,/ }).click();
  await expect(stat(page, "sentence")).toHaveText(/^2\//);
  await resetSurfaces(page);
  await navigator(page).getByRole("button", { name: /^Sentence 1,/ }).click();
  await expect(stat(page, "sentence")).toHaveText(/^1\//);
  await expectEmptyBank(page, 3);
  await expectConcealed(page);
  await expectNoSurface(page, [...ANSWER_KINDS, "korume"]);

  // Typing: the typed text does not follow to another line, nor come back.
  await formatRadio(page, "Typing").click();
  await typingInput(page).fill("毎日");
  await navigator(page).getByRole("button", { name: /^Sentence 2,/ }).click();
  await expect(stat(page, "sentence")).toHaveText(/^2\//);
  await expect(typingInput(page)).toHaveValue("");
  await navigator(page).getByRole("button", { name: /^Sentence 1,/ }).click();
  await expect(stat(page, "sentence")).toHaveText(/^1\//);
  await expect(typingInput(page)).toHaveValue("");
  await expectConcealed(page);
});

test("9 · changing format: confirm before discarding; a checked Word Bank answer never shows on the Typing side", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page, "/listening?format=typing");
  await typingInput(page).fill("毎日");
  await formatRadio(page, "Word Bank").click();
  const dialog = page.getByRole("dialog", { name: "Discard this attempt?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Keep going" }).last().click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/format=typing/);
  await expect(typingInput(page)).toHaveValue("毎日");
  await formatRadio(page, "Word Bank").click();
  await dialog.getByRole("button", { name: "Discard and switch" }).click();
  await expect(page).toHaveURL(/format=word_bank/);
  await expectEmptyBank(page, 3);
  await expectConcealed(page);

  await place(page, LINES[0].chunks);
  await button(page, "Check").click();
  await expect(page.getByTestId("listening-score")).toHaveText("100");
  await expect(page.getByTestId("workspace-subtitle")).toBeVisible();
  await resetSurfaces(page);
  const stats = page.waitForRequest((request) => request.url().includes("/practice-stats?mode=typing"));
  await formatRadio(page, "Typing").click();
  await expect(page).toHaveURL(/format=typing/);
  await stats;
  await expect(typingInput(page)).toHaveValue("");
  await expect(strip(page)).toHaveAttribute("data-mode", "typing");
  await expect(strip(page).locator("[data-stat='scored'] dt")).toHaveText("Typing · Submitted");
  await expectConcealed(page);
  await expectNoSurface(page, [...ANSWER_KINDS, "korume"]);
  await formatRadio(page, "Word Bank").click();
  await expect(page).toHaveURL(/format=word_bank/);
  await expectEmptyBank(page, 3);
  await expectConcealed(page);
});

test("10 · D9: an unreliable line opened as Word Bank moves to Typing in the URL, with its notice", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page, `/listening?line=${data.lineIds[UNRELIABLE]}`);
  await expect(page).toHaveURL(/format=typing/);
  await expect(page).toHaveURL(new RegExp(`line=${data.lineIds[UNRELIABLE]}`));
  await expect(stat(page, "sentence")).toHaveText(new RegExp(`^${UNRELIABLE + 1}/`));
  await expect(practice(page).getByTestId("listening-unreliable")).toHaveText("This sentence can't be split reliably, so it's Typing only");
  await expect(formatRadio(page, "Word Bank")).toBeDisabled();
  await expect(formatRadio(page, "Word Bank")).toHaveAttribute("title", "This sentence can't be split reliably, so it's Typing only");
  await expect(formatRadio(page, "Typing")).toHaveAttribute("aria-checked", "true");
  await expect(strip(page)).toHaveAttribute("data-mode", "typing");
  await expect(typingInput(page)).toBeVisible();
  await expect(bank(page)).toHaveCount(0);
});

test("11 · API failures keep the arrangement and reveal nothing; 409 restarts; a chunks failure offers Retry", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  await place(page, LINES[0].chunks);
  await resetSurfaces(page);
  for (const fail of ["abort", "500"] as const) {
    await page.route("**/api/dictation/attempt", (route) => fail === "abort" ? route.abort() : route.fulfill({ status: 500, json: { error: "server" } }), { times: 1 });
    await button(page, "Check").click();
    await expect(practice(page).getByRole("alert")).toHaveText("Your answer could not be checked. It is kept here, so try again.");
    await expect(slots(page).getByRole("button")).toHaveCount(3);
    await expect(button(page, "Check")).toBeEnabled();
    await expectConcealed(page);
  }
  await expectNoSurface(page, [...ANSWER_KINDS, "korume"]);
  await button(page, "Check").click();
  await expect(page.getByTestId("listening-score")).toHaveText("100");
  await expect(practice(page).getByRole("alert")).toHaveCount(0);

  await button(page, "Next sentence").click();
  await expect(stat(page, "sentence")).toHaveText(/^2\//);
  await place(page, LINES[1].chunks);
  await page.route("**/api/dictation/attempt", (route) => route.fulfill({ status: 409, json: { error: "line_changed" } }), { times: 1 });
  await button(page, "Check").click();
  await expect(practice(page).getByRole("alert")).toHaveText("This sentence changed, start again");
  await expectEmptyBank(page, 3);
  await expectConcealed(page);

  await page.route("**/api/lines/*/chunks", (route) => route.fulfill({ status: 500, json: { error: "server" } }));
  await button(page, "Next sentence").click();
  await expect(stat(page, "sentence")).toHaveText(/^3\//);
  await expect(practice(page).getByText("This sentence could not be loaded.")).toBeVisible();
  await expect(bank(page)).toHaveCount(0);
  await expectConcealed(page);
  await page.unroute("**/api/lines/*/chunks");
  await practice(page).getByRole("button", { name: "Retry" }).click();
  await expectEmptyBank(page, 3);
  await expectConcealed(page);
});

test("12 · legacy dictation deep links land on Listening's Typing format, in both locales (P2)", async ({ page, request }) => {
  const at = (location: string | undefined) => new URL(location ?? "", "http://localhost");
  const line = data.lineIds[2]!;
  for (const locale of ["vi", "en"]) {
    const target = `/${locale}/shadowing/${data.videoId}/listening`;
    const legacy = await request.get(`/${locale}/shadowing/${data.videoId}/dictation`, { maxRedirects: 0 });
    expect(legacy.status()).toBe(308);
    expect(at(legacy.headers()["location"]).pathname + at(legacy.headers()["location"]).search).toBe(`${target}?format=typing`);
    const old = await request.get(`/${locale}/videos/${data.videoId}/dictation`, { maxRedirects: 0 });
    expect(old.status()).toBe(307);
    expect(at(old.headers()["location"]).pathname + at(old.headers()["location"]).search).toBe(`${target}?format=typing`);
    const deep = await request.get(`/${locale}/shadowing/${data.videoId}/dictation?line=${line}`, { maxRedirects: 0 });
    const location = at(deep.headers()["location"]);
    expect(location.pathname).toBe(target);
    expect(location.searchParams.get("format")).toBe("typing");
    expect(location.searchParams.get("line")).toBe(line);
  }

  await registerLearner(page);
  for (const locale of ["vi", "en"]) {
    await page.goto(`/${locale}/shadowing/${data.videoId}/dictation?line=${line}`);
    await expect(page).toHaveURL(new RegExp(`/${locale}/shadowing/${data.videoId}/listening\\?`));
    await expect(page).toHaveURL(/format=typing/);
    await expect(page).toHaveURL(new RegExp(`line=${line}`));
    await expect(page.getByTestId("practice-panel").locator("input")).toBeVisible();
    await expect(stat(page, "sentence")).toHaveText(/^3\//);
    await expect(strip(page)).toHaveAttribute("data-mode", "typing");
    await expectConcealed(page);
    await expectNoSurface(page, [...ANSWER_KINDS, "korume"]);
  }
});

test("13 · the mission counts one line for Word Bank + Typing on it, and nothing for Show answer (P9)", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  await place(page, LINES[0].chunks);
  await button(page, "Check").click();
  await expect(page.getByTestId("listening-score")).toHaveText("100");
  await formatRadio(page, "Typing").click();
  await typingInput(page).fill(LINES[0].text);
  await button(page, "Check").click();
  await expect(page.getByTestId("listening-score")).toHaveText("100");
  await button(page, "Next sentence").click();
  await expect(stat(page, "sentence")).toHaveText(/^2\//);
  await button(page, "Show answer").click();
  await expect(page.getByTestId("listening-answer")).toHaveText(LINES[1].text);

  await page.goto("/en/dashboard");
  const listening = page.locator("[data-area='mission']").getByRole("listitem").filter({ hasText: "Practise listening to" });
  await expect(listening).toHaveCount(1);
  await expect(listening).toContainText("1/5");
});
