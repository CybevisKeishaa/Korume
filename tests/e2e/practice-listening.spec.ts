import { expect, test, type Locator, type Page } from "@playwright/test";
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

// The pieces each line is cut into are read from the page's own GET …/chunks response (`cut`), never hard-coded.
const LINES = [
  { text: "毎日日本語を勉強しました。" },
  { text: "私は「はい」と言った。" },
  { text: "今日はいい天気ですね？" },
  { text: "注文をお願いします。" },
] as const;
const UNRELIABLE = 4;
/** The owner's longest line of lesson b78ce634 (line 272, 14 pieces): the listen-only fit is measured on it (Ruling T1). */
const LONG = { index: 5, text: "「この前行ったここ本当に美味しかった」とかあるじゃないですか" } as const;

let data: WorkspaceData;
test.beforeAll(async () => {
  data = await seedWorkspaceData();
  for (const [index, line] of [...LINES.entries(), [LONG.index, LONG] as const]) {
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

/** Each line's pieces in reference order (`display`), as the page's own GET /api/lines/{id}/chunks returned them. */
const cuts = new WeakMap<Page, Map<string, string[]>>();
function trackCuts(page: Page): void {
  const seen = new Map<string, string[]>();
  cuts.set(page, seen);
  page.on("response", async (response) => {
    const id = new URL(response.url()).pathname.match(/^\/api\/lines\/([^/]+)\/chunks$/)?.[1];
    if (!id || !response.ok()) return;
    try { seen.set(id, ((await response.json()) as { data: { display: string[] } }).data.display); } catch { /* page closed */ }
  });
}
async function cut(page: Page, index: number): Promise<string[]> {
  const id = data.lineIds[index] ?? "";
  await expect.poll(() => cuts.get(page)?.has(id)).toBe(true);
  return cuts.get(page)?.get(id) ?? [];
}

async function registerLearner(page: Page): Promise<void> {
  trackCuts(page);
  await page.route(/youtube\.com|youtube-nocookie\.com|googlevideo\.com/, (route) => route.abort());
  await installFakeYouTube(page, { duration: VIDEO_DURATION });
  await installSurfaceObserver(page);
  const email = uniqueEmail("e2e_pl");
  await page.goto("/en/register");
  await registerViaUi(page, { name: "E2E Listening", email, password: "password123" });
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15_000 });
}

/** Opens the lesson; Listening cases enter Chép chính tả by its deep link (spec §3.0). */
async function openLesson(page: Page, path = "/listening?format=dictation"): Promise<void> {
  await page.goto(`/en/shadowing/${data.videoId}${path}`);
  await expect(page.getByTestId("fake-yt")).toHaveCount(1);
  await expect.poll(async () => (await fakeYt(page)).seeks.length).toBeGreaterThan(0);
}
/** Chép chính tả with Chế độ dễ on: the word pieces. */
async function openWordBank(page: Page, query = ""): Promise<void> {
  await openLesson(page, `/listening?format=dictation${query}`);
  await easyMode(page).click();
  await expect(easyMode(page)).toHaveAttribute("aria-pressed", "true");
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
const easyMode = (page: Page) => practice(page).getByRole("button", { name: "Easy mode", exact: true });
const hideVideo = (page: Page) => practice(page).getByRole("button", { name: "Hide video", exact: true });
const dock = (page: Page) => page.locator("[data-listen-dock]");
const dockRow = (page: Page) => page.locator("[data-listen-dock-controls]");
const pickerHeading = (page: Page) => page.getByRole("heading", { name: "How would you like to practise listening?" });
const button = (page: Page, name: string) => practice(page).getByRole("button", { name, exact: true });

/** Taps each piece in the bank, in order; two pieces with the same text are interchangeable (LCS by text). */
async function place(page: Page, pieces: readonly string[]): Promise<void> {
  for (const piece of pieces) await bank(page).getByRole("button", { name: piece, exact: true }).first().click();
}
const placedTexts = (page: Page) => slots(page).locator("[data-piece] [lang='ja']").allTextContents();

async function expectConcealed(page: Page): Promise<void> {
  await expect(page.getByTestId("workspace-subtitle")).toHaveCount(0);
  await expect(page.getByTestId("listening-answer")).toHaveCount(0);
  await expect(page.locator(SURFACES.slotResult)).toHaveCount(0);
  await expect(page.getByTestId("typing-diff")).toHaveCount(0);
  await expect(page.getByTestId("listening-score")).toHaveCount(0);
  await expect(korume(page)).toHaveCount(0);
}

/** A fresh attempt on line `index`: nothing placed, every piece of its cut in the bank. */
async function expectEmptyBank(page: Page, index: number): Promise<void> {
  const pieces = await cut(page, index);
  await expect(slots(page)).toHaveCount(0);
  await expect(bank(page).getByRole("button")).toHaveCount(pieces.length);
  expect((await bank(page).getByRole("button").allTextContents()).sort()).toEqual([...pieces].sort());
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
  await expect(pickerHeading(page)).toBeVisible();
  await expect(kept).toHaveCount(1);
  await page.getByRole("button", { name: /^Dictation/ }).click();
  await expect(page).toHaveURL(/\/listening\?format=dictation$/);
  await expect(typingInput(page)).toBeVisible();
  await expectConcealed(page);
  await expect(kept).toHaveCount(1);
  await easyMode(page).click();
  await expect(bank(page)).toBeVisible();
  await expectConcealed(page);
  await expect(kept).toHaveCount(1);
  await modeBar(page).getByRole("link", { name: "Shadowing" }).click();
  await expect(page).toHaveURL(new RegExp(`/shadowing/${data.videoId}$`));
  await expect(kept).toHaveCount(1);
  // The fake fires onReady once per construction: one mount is one onReady.
  expect((await fakeYt(page)).mounts).toBe(1);
});

test("2 · entering Listening conceals from the first frame, with the video shown; every player control works", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  await expect(typingInput(page)).toBeVisible();
  await expectConcealed(page);
  await expect(dock(page)).toHaveCount(0);
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
  await expectNoSurface(page);
});

test("3 · Word Bank, correct: score 100, joy, the subtitle for this line only; Next conceals again", async ({ page }) => {
  await registerLearner(page);
  await openWordBank(page);
  await expect(korume(page)).toHaveCount(0);
  const pieces = await cut(page, 0);
  await place(page, pieces);
  await heldSubmit(page, () => button(page, "Check").click());
  await expect(page.getByTestId("listening-score")).toHaveText("100%");
  for (const index of pieces.keys()) await expect(slot(page, index)).toHaveAttribute("data-result", "correct");
  await expect(feedback(page)).toContainText("You arranged the whole sentence yourself!");
  await expect(korume(page)).toHaveAttribute("data-mascot-pose", "listening-joy");
  await expect(page.getByTestId("workspace-subtitle")).toHaveText(LINES[0].text);
  // Positive control: the observer every "never" below relies on does see each surface once it is attached.
  expect(new Set((await surfaces(page, [...ANSWER_KINDS, "korume"])).map((surface) => surface.kind))).toEqual(new Set(["subtitle", "answer", "slotResult", "korume"]));

  await resetSurfaces(page);
  await button(page, "Next sentence").click();
  await expect(stat(page, "sentence")).toHaveText(/^2\//);
  await expectEmptyBank(page, 1);
  await expectConcealed(page);
  await expectNoSurface(page, [...ANSWER_KINDS, "korume"]);
});

test("3b · a delayed Check whose attempt was discarded never shows the figure or a score", async ({ page }) => {
  await registerLearner(page);
  await openWordBank(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const response = page.waitForResponse((r) => r.url().endsWith("/api/dictation/attempt"));
  await page.route("**/api/dictation/attempt", async (route) => { await gate; await route.continue(); }, { times: 1 });
  await place(page, await cut(page, 0));
  await button(page, "Check").click();
  await expect(feedback(page)).toContainText("Checking…");
  // Try again is not offered while a Check is pending; leaving the line and coming back discards the attempt
  // the same way (a new attempt on the same line and format, P11).
  await button(page, "Next sentence").click();
  await expect(stat(page, "sentence")).toHaveText(/^2\//);
  await navigator(page).getByRole("button", { name: /^Sentence 1,/ }).click();
  await expect(stat(page, "sentence")).toHaveText(/^1\//);
  await expectEmptyBank(page, 0);
  await resetSurfaces(page);
  release();
  expect((await response).status()).toBe(200);
  await expectNoSurface(page, [...ANSWER_KINDS, "korume"]);
  await expectConcealed(page);
  await expectEmptyBank(page, 0);
});

test("4 · Word Bank, wrong then Try again: counts match the colours; the fix is counted", async ({ page }) => {
  await registerLearner(page);
  await openWordBank(page);
  await expect(bank(page)).toBeVisible();
  const order = await bank(page).getByRole("button").allTextContents();
  const pieces = await cut(page, 0);
  const [a, b, ...rest] = pieces as [string, string, ...string[]];
  // b a …: one of the two is outside the longest in-order run; the earliest reference match keeps a (WP §3.4).
  await place(page, [b, a, ...rest]);
  await heldSubmit(page, () => button(page, "Check").click());
  const score = parseInt((await page.getByTestId("listening-score").textContent()) ?? "", 10);
  expect(score).toBeLessThan(100);
  await expect(slot(page, 0)).toHaveAttribute("data-result", "wrong");
  for (const index of pieces.keys()) if (index > 0) await expect(slot(page, index)).toHaveAttribute("data-result", "correct");
  await expect(feedback(page)).toContainText(`You got ${pieces.length - 1}/${pieces.length} chunks right. Listen again and watch the order of the 1 chunk still wrong. Wrong pieces: ${b}`);
  await expect(korume(page)).toHaveAttribute("data-mascot-pose", "listening-encourage");

  await button(page, "Try again").click();
  await expect(korume(page)).toHaveCount(0);
  await expectEmptyBank(page, 0);
  expect(await bank(page).getByRole("button").allTextContents()).toEqual(order);
  await expectConcealed(page);
  await expect(feedback(page)).toContainText(`New attempt. Your last score on this sentence was ${score}.`);
  await place(page, pieces);
  await heldSubmit(page, () => button(page, "Check").click());
  await expect(page.getByTestId("listening-score")).toHaveText("100%");
  await expect(feedback(page)).toContainText("You fixed 1 chunk since your last try.");
  await expect(korume(page)).toHaveAttribute("data-mascot-pose", "listening-joy");
});

test("5 · Hint moves the next piece to the front, keeping the placed one; the hinted piece counts as hinted, never as correct", async ({ page }) => {
  await registerLearner(page);
  await openWordBank(page);
  const pieces = await cut(page, 0);
  const [a, b, ...rest] = pieces as [string, string, ...string[]];
  await place(page, [b]);
  await button(page, "Hint").click();
  await expect(slot(page, 0).getByRole("button")).toHaveAccessibleName(`Slot 1 of ${pieces.length}, ${a}, hint`);
  await expect(slot(page, 0).getByRole("button")).toBeDisabled();
  await expect(slot(page, 0)).toContainText("Hint");
  await expect(slot(page, 1).getByRole("button")).toHaveAccessibleName(`Slot 2 of ${pieces.length}, ${b}`);
  await expect(bank(page).getByRole("button", { name: b, exact: true })).toHaveCount(0);
  await expect(bank(page).getByRole("button", { name: a, exact: true })).toHaveCount(0);
  await expect(korume(page)).toHaveCount(0);
  await place(page, rest);
  await heldSubmit(page, () => button(page, "Check").click());
  await expect(slot(page, 0)).toHaveAttribute("data-result", "hinted");
  for (const index of pieces.keys()) if (index > 0) await expect(slot(page, index)).toHaveAttribute("data-result", "correct");
  await expect(feedback(page)).toContainText(`You got ${pieces.length - 1}/${pieces.length} chunks right.`);
  await expect(feedback(page)).toContainText("1 hinted chunk doesn't count as your own.");
  await expect(feedback(page)).not.toContainText("whole sentence yourself");
  await expect(korume(page)).toHaveAttribute("data-mascot-pose", "listening-encourage");
});

test("6 · Show answer: revealed, no score; navigator, strip and Summary agree", async ({ page }) => {
  await registerLearner(page);
  await openWordBank(page);
  await expect(bank(page)).toBeVisible();
  await expect(stat(page, "scored")).toHaveText(/^0\//);
  const average = await stat(page, "average").textContent();
  await resetSurfaces(page);
  await button(page, "Hint").click();
  await expect(feedback(page)).toContainText("1 chunk hinted so far. Hinted parts don't count toward recall.");
  await page.waitForTimeout(300);
  const said = (await surfaces(page, ["feedback"])).map((surface) => surface.text);
  expect(said.length).toBeGreaterThan(0);
  for (const unhinted of (await cut(page, 0)).slice(1)) for (const text of said) expect(text).not.toContain(unhinted);
  await expect(korume(page)).toHaveCount(0);

  await heldSubmit(page, () => button(page, "Show answer").click());
  await expect(page.getByTestId("listening-answer")).toHaveText(LINES[0].text);
  await expect(feedback(page)).toContainText("This sentence is marked for review. This attempt has no score and doesn't count toward today's mission.");
  await expect(page.getByTestId("listening-score")).toHaveCount(0);
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
  await openLesson(page);
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
  await expect(practice(page).getByTestId("typing-hint")).toContainText((await cut(page, 0)).at(0) ?? "");
  await expect(typingInput(page)).toHaveValue("毎日日");

  await typingInput(page).fill("毎日日本語お勉強しました。");
  await typingInput(page).press("Enter");
  await expect(page.getByTestId("typing-diff")).toBeVisible();
  expect((await surfaces(page, ["diff"])).length).toBeGreaterThan(0); // the observer's positive control for the diff
  await expect(page.getByTestId("typing-diff").locator("[data-op='wrong'], [data-op='missing']")).not.toHaveCount(0);
  expect(parseInt((await page.getByTestId("listening-score").textContent()) ?? "", 10)).toBeLessThan(100);
  await expect(practice(page).locator("dt", { hasText: "Kanji" })).toHaveCount(1);
  await expect(practice(page).locator("dt", { hasText: "Grammar" })).toHaveCount(1);
  expect(posts).toEqual(["POST"]);
});

test("8 · changing sentence mid-attempt discards it; returning shows a fresh, concealed attempt", async ({ page }) => {
  await registerLearner(page);
  await openWordBank(page);
  const pieces = await cut(page, 0);
  await place(page, pieces.slice(0, 2));
  await resetSurfaces(page);
  await button(page, "Next sentence").click();
  await expect(stat(page, "sentence")).toHaveText(/^2\//);
  await expectEmptyBank(page, 1);
  await expectConcealed(page);
  await navigator(page).getByRole("button", { name: /^Sentence 1,/ }).click();
  await expectEmptyBank(page, 0);
  await expectConcealed(page);
  await expectNoSurface(page);

  // A checked line, left and returned to, shows no old answer.
  await place(page, pieces);
  await button(page, "Check").click();
  await expect(page.getByTestId("listening-score")).toHaveText("100%");
  await navigator(page).getByRole("button", { name: /^Sentence 2,/ }).click();
  await expect(stat(page, "sentence")).toHaveText(/^2\//);
  await resetSurfaces(page);
  await navigator(page).getByRole("button", { name: /^Sentence 1,/ }).click();
  await expect(stat(page, "sentence")).toHaveText(/^1\//);
  await expectEmptyBank(page, 0);
  await expectConcealed(page);
  await expectNoSurface(page, [...ANSWER_KINDS, "korume"]);

  // Typing: the typed text does not follow to another line, nor come back.
  await easyMode(page).click();
  await typingInput(page).fill("毎日");
  await navigator(page).getByRole("button", { name: /^Sentence 2,/ }).click();
  await expect(stat(page, "sentence")).toHaveText(/^2\//);
  await expect(typingInput(page)).toHaveValue("");
  await navigator(page).getByRole("button", { name: /^Sentence 1,/ }).click();
  await expect(stat(page, "sentence")).toHaveText(/^1\//);
  await expect(typingInput(page)).toHaveValue("");
  await expectConcealed(page);
});

test("9 · Chế độ dễ: the URL stays; a checked Word Bank answer never shows on the Typing side", async ({ page }) => {
  await registerLearner(page);
  await openWordBank(page);
  await expectEmptyBank(page, 0);
  await expectConcealed(page);

  await place(page, await cut(page, 0));
  // The saved Check is what refreshes the exercise's stats.
  const stats = page.waitForRequest((request) => request.url().includes("/practice-stats?mode=dictation"));
  await button(page, "Check").click();
  await expect(page.getByTestId("listening-score")).toHaveText("100%");
  await expect(page.getByTestId("workspace-subtitle")).toBeVisible();
  await stats;
  await resetSurfaces(page);
  await easyMode(page).click();
  await expect(easyMode(page)).toHaveAttribute("aria-pressed", "false");
  await expect(page).toHaveURL(/\?format=dictation$/);
  await expect(typingInput(page)).toHaveValue("");
  await expect(strip(page)).toHaveAttribute("data-mode", "dictation");
  await expect(strip(page).locator("[data-stat='scored'] dt")).toHaveText("Dictation · Submitted");
  await expectConcealed(page);
  await expectNoSurface(page, [...ANSWER_KINDS, "korume"]);
  await easyMode(page).click();
  await expect(page).toHaveURL(/\?format=dictation$/);
  await expectEmptyBank(page, 0);
  await expectConcealed(page);
});

test("10 · D9: with Chế độ dễ on, an unreliable line is typed with its notice; Easy mode says why it is unavailable", async ({ page }) => {
  await registerLearner(page);
  await openWordBank(page, `&line=${data.lineIds[UNRELIABLE - 1]}`);
  await expect(bank(page)).toBeVisible();
  await button(page, "Next sentence").click();
  await expect(page).toHaveURL(/format=dictation/);
  await expect(stat(page, "sentence")).toHaveText(new RegExp(`^${UNRELIABLE + 1}/`));
  await expect(practice(page).getByTestId("listening-unreliable")).toHaveText("This sentence can't be split reliably, so it's Typing only");
  await expect(typingInput(page)).toBeVisible();
  await expect(bank(page)).toHaveCount(0);
  await expect(easyMode(page)).toHaveAttribute("aria-disabled", "true");
  await easyMode(page).hover();
  await expect(page.getByRole("tooltip")).toHaveText("This sentence can't be split reliably, so it's Typing only");
  await expect(strip(page)).toHaveAttribute("data-mode", "dictation");
  // The setting is kept: the next, reliable line has its pieces again.
  await button(page, "Next sentence").click();
  await expect(bank(page)).toBeVisible();
  await expect(easyMode(page)).not.toHaveAttribute("aria-disabled");
});

test("11 · API failures keep the arrangement and reveal nothing; 409 restarts; a chunks failure offers Retry", async ({ page }) => {
  await registerLearner(page);
  await openWordBank(page);
  const pieces = await cut(page, 0);
  await place(page, pieces);
  await resetSurfaces(page);
  for (const fail of ["abort", "500"] as const) {
    await page.route("**/api/dictation/attempt", (route) => fail === "abort" ? route.abort() : route.fulfill({ status: 500, json: { error: "server" } }), { times: 1 });
    await button(page, "Check").click();
    await expect(practice(page).getByRole("alert")).toHaveText("Your answer could not be checked. It is kept here, so try again.");
    expect(await placedTexts(page)).toEqual(pieces);
    await expect(button(page, "Check")).toBeEnabled();
    await expectConcealed(page);
  }
  await expectNoSurface(page, [...ANSWER_KINDS, "korume"]);
  await button(page, "Check").click();
  await expect(page.getByTestId("listening-score")).toHaveText("100%");
  await expect(practice(page).getByRole("alert")).toHaveCount(0);

  await button(page, "Next sentence").click();
  await expect(stat(page, "sentence")).toHaveText(/^2\//);
  await place(page, await cut(page, 1));
  await page.route("**/api/dictation/attempt", (route) => route.fulfill({ status: 409, json: { error: "line_changed" } }), { times: 1 });
  await button(page, "Check").click();
  await expect(practice(page).getByRole("alert")).toHaveText("This sentence changed, start again");
  await expectEmptyBank(page, 1);
  await expectConcealed(page);

  await page.route("**/api/lines/*/chunks", (route) => route.fulfill({ status: 500, json: { error: "server" } }));
  await button(page, "Next sentence").click();
  await expect(stat(page, "sentence")).toHaveText(/^3\//);
  await expect(practice(page).getByText("This sentence could not be loaded.")).toBeVisible();
  await expect(bank(page)).toHaveCount(0);
  await expectConcealed(page);
  await page.unroute("**/api/lines/*/chunks");
  await practice(page).getByRole("button", { name: "Retry" }).click();
  await expectEmptyBank(page, 2);
  await expectConcealed(page);
});

test("12 · legacy dictation deep links land on Listening's Chép chính tả (typing), in both locales (P2, spec §3.0)", async ({ page, request }) => {
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
    // The server's `format=typing` is a legacy value: the client replaces it with the exercise.
    await expect(page).toHaveURL(/format=dictation/);
    await expect(page).toHaveURL(new RegExp(`line=${line}`));
    await expect(page.getByTestId("practice-panel").locator("input")).toBeVisible();
    await expect(stat(page, "sentence")).toHaveText(/^3\//);
    await expect(strip(page)).toHaveAttribute("data-mode", "dictation");
    await expectConcealed(page);
    await expectNoSurface(page, [...ANSWER_KINDS, "korume"]);
  }
});

test("13 · the mission counts one line for Word Bank + Typing on it, and nothing for Show answer (P9)", async ({ page }) => {
  await registerLearner(page);
  await openWordBank(page);
  await place(page, await cut(page, 0));
  await button(page, "Check").click();
  await expect(page.getByTestId("listening-score")).toHaveText("100%");
  await easyMode(page).click();
  await typingInput(page).fill(LINES[0].text);
  await button(page, "Check").click();
  await expect(page.getByTestId("listening-score")).toHaveText("100%");
  await button(page, "Next sentence").click();
  await expect(stat(page, "sentence")).toHaveText(/^2\//);
  await button(page, "Show answer").click();
  await expect(page.getByTestId("listening-answer")).toHaveText(LINES[1].text);

  await page.goto("/en/dashboard");
  const listening = page.locator("[data-area='mission']").getByRole("listitem").filter({ hasText: "Practise listening to" });
  await expect(listening).toHaveCount(1);
  await expect(listening).toContainText("1/5");
});

/** Drags `source` onto `target`'s left edge, so the drop marker sits before `target` (WP §3.3). */
async function dragBefore(page: Page, source: Locator, target: Locator): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error("drop target has no box");
  await source.dragTo(target, { targetPosition: { x: 2, y: box.height / 2 } });
}

test("14 · drag a bank piece between two placed pieces; drag a placed piece to the front, or out to the bank", async ({ page }) => {
  await registerLearner(page);
  await openWordBank(page);
  const [a, b, c] = (await cut(page, 0)) as [string, string, string];
  await place(page, [a, c]);
  await dragBefore(page, bank(page).getByRole("button", { name: b, exact: true }), slots(page).nth(1).getByRole("button"));
  await expect.poll(() => placedTexts(page)).toEqual([a, b, c]);
  await dragBefore(page, slots(page).nth(2).getByRole("button"), slots(page).nth(0).getByRole("button"));
  await expect.poll(() => placedTexts(page)).toEqual([c, a, b]);
  // Dropped anywhere but the answer, a placed piece goes back to the bank.
  await slots(page).nth(0).getByRole("button").dragTo(bank(page));
  await expect.poll(() => placedTexts(page)).toEqual([a, b]);
  await expect(bank(page).getByRole("button", { name: c, exact: true })).toBeVisible();
  await expect(practice(page).locator("[data-drop-marker]")).toHaveCount(0);
});

test("15 · tap a placed piece returns it; Alt+Arrow moves a placed piece and the focus stays on it", async ({ page }) => {
  await registerLearner(page);
  await openWordBank(page);
  const pieces = await cut(page, 0);
  const [a, b, c] = pieces as [string, string, string];
  await place(page, [a, b, c]);
  await slots(page).nth(1).getByRole("button").click();
  await expect.poll(() => placedTexts(page)).toEqual([a, c]);
  await expect(bank(page).getByRole("button", { name: b, exact: true })).toBeVisible();
  await expect(practice(page)).toContainText(`${pieces.length - 2} words remaining`);
  await expect(slots(page).locator("[aria-pressed]")).toHaveCount(0);
  await expect(button(page, "Remove Selected Word")).toHaveCount(0);

  await slots(page).nth(1).getByRole("button").focus();
  await page.keyboard.press("Alt+ArrowLeft");
  await expect.poll(() => placedTexts(page)).toEqual([c, a]);
  // In Chrome a keyed reorder can drop focus to the body; jsdom cannot show that (lessons: jsdom focus loss).
  await expect(slots(page).nth(0).getByRole("button")).toBeFocused();
  await expect(practice(page).getByRole("status").filter({ hasText: "position" })).toHaveText(`${c}, position 1 of ${pieces.length}`);
  await expect(page).toHaveURL(/\/listening/); // Alt+ArrowLeft is not the browser's Back here
});

test("16 · a drag across a line change (simulated via the workspace shortcut) drops nothing: the new line starts empty", async ({ page }) => {
  await registerLearner(page);
  await openWordBank(page);
  const [first, second] = (await cut(page, 0)) as [string, string];
  const tray = practice(page).getByRole("list", { name: "Your sentence" });
  const dragFromBank = async (text: string) => {
    const box = await bank(page).getByRole("button", { name: text, exact: true }).first().boundingBox();
    if (!box) throw new Error("bank chip has no box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 30, box.y - 20, { steps: 5 });
  };
  const dropOnTray = async () => {
    const box = await tray.boundingBox();
    if (!box) throw new Error("answer tray has no box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
  };
  // Positive control: the same gesture without a line change does place the piece.
  await dragFromBank(first);
  await dropOnTray();
  await expect.poll(() => placedTexts(page)).toEqual([first]);

  await dragFromBank(second);
  // The line change is simulated: the workspace shortcut's keydown (ArrowRight outside a control) is dispatched as a
  // DOM event, because Chromium holds native key input while Playwright's drag is in flight. This case proves the
  // drop is ignored after a line change; it is not a keyboard-reachability test.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.locator("body").dispatchEvent("keydown", { key: "ArrowRight", bubbles: true });
  await expect(stat(page, "sentence")).toHaveText(/^2\//);
  await dropOnTray();
  await expectEmptyBank(page, 1);
});

test("17 · picker on entry; choosing Dictation opens it by a URL replace; Change exercise returns to the picker", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page, "/listening");
  await expect(pickerHeading(page)).toBeVisible();
  await expect(page.getByRole("button", { name: /^(Dictation|Fill in the blanks)/ })).toHaveCount(2);
  await expect(strip(page)).toHaveCount(0);
  await expect(navigator(page)).toHaveCount(0);
  await page.getByTestId("fake-yt").evaluate((element) => element.setAttribute("data-instance-marker", "kept"));
  await page.getByRole("button", { name: /^Dictation/ }).click();
  await expect(page).toHaveURL(/\/listening\?format=dictation$/);
  await expect(typingInput(page)).toBeVisible();
  await expect(practice(page).getByRole("heading", { name: "Dictation" })).toBeVisible();
  await button(page, "Change exercise").click();
  await expect(page).toHaveURL(/\/listening$/);
  await expect(pickerHeading(page)).toBeVisible();
  await expect(page.locator("[data-testid='fake-yt'][data-instance-marker='kept']")).toHaveCount(1);
  expect((await fakeYt(page)).mounts).toBe(1);
});

test("18 · a deep link opens the exercise directly, never the picker", async ({ page }) => {
  await registerLearner(page);
  await page.addInitScript(() => {
    const flag = window as unknown as { __pickerSeen: boolean };
    flag.__pickerSeen = false;
    new MutationObserver(() => {
      if ([...document.querySelectorAll("h2")].some((h) => h.textContent === "How would you like to practise listening?")) flag.__pickerSeen = true;
    }).observe(document, { childList: true, subtree: true });
  });
  const pickerSeen = () => page.evaluate(() => (window as unknown as { __pickerSeen: boolean }).__pickerSeen);
  await openLesson(page, "/listening?format=cloze");
  await expect(practice(page).getByRole("heading", { name: "Fill in the blanks" })).toBeVisible();
  await expect(practice(page).getByTestId("listening-cloze-pending")).toBeVisible();
  await expect(strip(page)).toHaveAttribute("data-mode", "cloze");
  expect(await pickerSeen()).toBe(false);
  await openLesson(page);
  await expect(typingInput(page)).toBeVisible();
  expect(await pickerSeen()).toBe(false);
  // Positive control: the observer does see the picker once it renders.
  await button(page, "Change exercise").click();
  await expect(pickerHeading(page)).toBeVisible();
  expect(await pickerSeen()).toBe(true);
});

test("19 · one player across picker, exercises and Ẩn video: onReady once, the iframe never display:none", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page, "/listening");
  await page.getByTestId("fake-yt").evaluate((element) => element.setAttribute("data-instance-marker", "kept"));
  const kept = page.locator("[data-testid='fake-yt'][data-instance-marker='kept']");
  /** Every box from the fake iframe up to the workspace: none is display:none. */
  const displays = () => page.getByTestId("fake-yt").evaluate((element) => {
    const out: string[] = [];
    for (let node: Element | null = element; node && node.getAttribute("data-testid") !== "shadowing-workspace"; node = node.parentElement) out.push(getComputedStyle(node).display);
    return out;
  });
  await page.getByRole("button", { name: /^Dictation/ }).click();
  await expect(typingInput(page)).toBeVisible();
  await button(page, "Change exercise").click();
  await page.getByRole("button", { name: /^Fill in the blanks/ }).click();
  await expect(practice(page).getByTestId("listening-cloze-pending")).toBeVisible();
  await hideVideo(page).click();
  await expect(dock(page)).toBeVisible();
  const docked = await displays();
  expect(docked.length).toBeGreaterThan(2);
  expect(docked).not.toContain("none");
  // The video box is collapsed and hidden, not removed.
  expect(await page.locator("[data-workspace-player-video]").evaluate((element) => getComputedStyle(element.parentElement as Element).visibility)).toBe("hidden");
  await button(page, "Change exercise").click();
  await expect(pickerHeading(page)).toBeVisible();
  await page.getByRole("button", { name: /^Dictation/ }).click();
  await easyMode(page).click();
  await expect(bank(page)).toBeVisible();
  await dock(page).getByRole("button", { name: "Show video" }).click();
  await expect(dock(page)).toHaveCount(0);
  await expect(kept).toHaveCount(1);
  expect((await fakeYt(page)).mounts).toBe(1);
});

test("20 · Ẩn video survives Next and Try again; turning it off stays off", async ({ page }) => {
  await registerLearner(page);
  await openWordBank(page);
  await hideVideo(page).click();
  await expect(hideVideo(page)).toHaveAttribute("aria-pressed", "true");
  await expect(dock(page)).toBeVisible();
  await expect(strip(page)).toHaveCount(0);
  await button(page, "Next sentence").click();
  await expect(page.getByText(/^Sentence 2 \/ \d+$/)).toHaveCount(1); // the workspace header's, the only counter (spec §3.1)
  await expect(dock(page)).toBeVisible();
  await place(page, await cut(page, 1));
  await button(page, "Check").click();
  await expect(page.getByTestId("listening-score")).toHaveText("100%");
  await button(page, "Try again").click();
  await expect(dock(page)).toBeVisible();
  await expectConcealed(page);
  // The dock's own controls drive the same player.
  await dock(page).getByRole("button", { name: "Replay audio" }).click();
  await expect.poll(async () => (await fakeYt(page)).state).toBe(FAKE_YT_STATE.PLAYING);
  await dock(page).getByRole("button", { name: "Pause" }).click();
  await expect.poll(async () => (await fakeYt(page)).state).toBe(FAKE_YT_STATE.PAUSED);
  await dock(page).getByRole("button", { name: "Show video" }).click();
  await expect(dock(page)).toHaveCount(0);
  await expect(hideVideo(page)).toHaveAttribute("aria-pressed", "false");
  await expect(player(page).locator("[data-workspace-player-controls]").getByRole("button", { name: "Play", exact: true })).toBeFocused();
  await button(page, "Next sentence").click();
  await expect(stat(page, "sentence")).toHaveText(/^3\//);
  await expect(dock(page)).toHaveCount(0);
  await place(page, await cut(page, 2));
  await button(page, "Check").click();
  await button(page, "Try again").click();
  await expect(dock(page)).toHaveCount(0);
});

test("21 · the dock row stays at one height on hover", async ({ page }) => {
  await registerLearner(page);
  await openLesson(page);
  await hideVideo(page).click();
  await expect(dockRow(page)).toBeVisible();
  // The docked card's height and its control row's: a clipping parent shrinks the first, a changing row the second.
  const height = async () => [(await dock(page).boundingBox())?.height ?? -1, (await dockRow(page).boundingBox())?.height ?? -1];
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400); // longer than any transition
  const paused = await height();
  expect(paused[1]).toBeGreaterThan(20);
  expect(paused[0]).toBeGreaterThanOrEqual(paused[1]);
  // Playing is when the normal bar idles out: the dock must not.
  await dock(page).getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(async () => (await fakeYt(page)).state).toBe(FAKE_YT_STATE.PLAYING);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);
  expect(await height()).toEqual(paused);
  // The progress bar is where the owner saw the glitch; the collapsed video box sits at the dock's top edge.
  const seek = await dock(page).getByRole("slider", { name: "Seek" }).boundingBox();
  const video = await page.locator("[data-workspace-player-video]").evaluate((element) => { const r = element.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y }; });
  const row = await dockRow(page).boundingBox();
  if (!seek || !row) throw new Error("dock has no box");
  const points = [[seek.x + seek.width / 2, seek.y + seek.height / 2], [video.x, video.y], [row.x + 4, row.y + row.height / 2], [row.x + row.width - 4, row.y + row.height / 2]];
  for (const [x, y] of points) {
    await page.mouse.move(x ?? 0, y ?? 0);
    await page.waitForTimeout(400);
    expect(await height()).toEqual(paused);
  }
  console.log(`T9-MEASURE dock card/row height ${paused.join("/")}px, dock box ${JSON.stringify(await dock(page).boundingBox())}`);
});

test("22 · in listen-only at 1280×529 Show answer is above the dock, on the longest line, pieces and typing", async ({ page }) => {
  await registerLearner(page);
  // Video shown first; the workspace header carries the one sentence counter in both layouts (spec §3.1).
  await openWordBank(page, `&line=${data.lineIds[LONG.index]}`);
  const pieces = await cut(page, LONG.index);
  await expect(bank(page).getByRole("button")).toHaveCount(pieces.length);
  const stripBox = await strip(page).boundingBox();
  if (!stripBox) throw new Error("strip has no box");
  expect(stripBox.y + stripBox.height).toBeLessThanOrEqual(529);
  const header = await practice(page).getByRole("heading", { name: "Dictation" }).boundingBox();
  const shownReveal = await button(page, "Show answer").boundingBox();
  console.log(`T9-MEASURE video shown: strip top ${stripBox.y} bottom ${stripBox.y + stripBox.height}, exercise header top ${header?.y}, reveal bottom ${(shownReveal?.y ?? 0) + (shownReveal?.height ?? 0)}`);

  await hideVideo(page).click();
  await expect(dock(page)).toBeVisible();
  for (const mode of ["pieces", "typing"] as const) {
    if (mode === "typing") {
      await easyMode(page).click();
      await expect(typingInput(page)).toBeVisible();
    }
    const dockBox = await dock(page).boundingBox();
    const reveal = await button(page, "Show answer").boundingBox();
    const panel = await page.getByTestId("practice-panel").boundingBox();
    if (!dockBox || !reveal || !panel) throw new Error("missing box");
    const scroll = await page.getByTestId("practice-panel").evaluate((element) => ({ scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }));
    console.log(`T9-MEASURE listen-only ${mode} (${pieces.length} pieces): reveal bottom ${reveal.y + reveal.height}, panel bottom ${panel.y + panel.height}, dock top ${dockBox.y}, dock height ${dockBox.height}, panel scroll ${scroll.scrollHeight}/${scroll.clientHeight}`);
    expect(reveal.y + reveal.height).toBeLessThanOrEqual(dockBox.y);
    // In flow: the practice panel ends where the dock begins; nothing of it runs under the dock.
    expect(panel.y + panel.height).toBeLessThanOrEqual(dockBox.y);
    expect(dockBox.y + dockBox.height).toBeLessThanOrEqual(529);
    if (mode === "pieces") {
      const rows = await bank(page).evaluate((element) => new Set([...element.querySelectorAll("button")].map((chip) => Math.round(chip.getBoundingClientRect().top))).size);
      expect(rows).toBe(1);
    }
  }
});
