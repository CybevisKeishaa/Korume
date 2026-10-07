import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./fixtures/auth";
import { cmapHex, pdfPageCount, pdfStreams } from "./fixtures/pdf-text";
import { LONG_TITLE, seedPrintLesson } from "./fixtures/print-data";
import { seedWorkspaceData, type WorkspaceData } from "./fixtures/workspace-data";

test.use({ viewport: { width: 1280, height: 529 } });
let data: WorkspaceData;
let lesson: { videoId: string; lineIds: string[] };
test.beforeAll(async () => {
  data = await seedWorkspaceData();
  lesson = await seedPrintLesson(data.admin, data.prefix);
});
test.afterAll(async () => { await data?.cleanup(); });

async function learner(page: Page): Promise<void> {
  await page.goto("/en/register");
  await registerViaUi(page, { name: "E2E Print", email: uniqueEmail("e2e_print"), password: "password123" });
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15_000 });
}
const open = async (page: Page, set = "all") => {
  await page.goto(`/en/vocab/print?source=lesson&lesson=${lesson.videoId}&set=${set}`);
  await expect(page.getByRole("status").filter({ hasText: /words ·/ })).toBeVisible({ timeout: 30_000 });
};
/** set=all is Summary's 24-row cap: 話, これ and 22 nouns. これ is kana-only, which the default settings leave out (W4). */
const ALL_WORDS = 23;
/** A4 at 96 dpi: 210 x 297 mm. */
const A4 = { width: 793.7, height: 1122.5 };
const geometry = (page: Page) => page.evaluate(() => {
  const logical = [...document.querySelectorAll<HTMLElement>('[data-measure="item"]')].map((el) => el.offsetHeight);
  const sheets = document.querySelectorAll("[data-print-root] .vp-sheet").length;
  return { logical, sheets };
});
const saveFirstWord = async (page: Page) => {
  const saved = await page.request.post("/api/mining", { data: { lineId: lesson.lineIds[0], targetWord: "学校", sourceKind: "vocabulary" } });
  expect(saved.ok()).toBe(true);
};

test("1 · the PDF has one page per DOM sheet, every sheet is A4, and no item crosses its quote band", async ({ page }) => {
  await learner(page);
  await open(page);
  expect((await geometry(page)).sheets).toBeGreaterThan(1); // positive control: 23 words span several pages
  await page.emulateMedia({ media: "print" });
  const sheetRects = await page.evaluate(() => [...document.querySelectorAll("[data-print-root] .vp-sheet")].map((sheet) => {
    const rect = sheet.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }));
  for (const rect of sheetRects) {
    expect(Math.abs(rect.width - A4.width)).toBeLessThan(1);
    expect(Math.abs(rect.height - A4.height)).toBeLessThan(1);
  }
  const crossing = await page.evaluate(() => [...document.querySelectorAll("[data-print-root] .vp-sheet")].flatMap((sheet) => {
    const quoteTop = sheet.querySelector(".vp-quote")!.getBoundingClientRect().top;
    return [...sheet.querySelectorAll(".vp-item")].filter((item) => item.getBoundingClientRect().bottom > quoteTop + 0.5).map((item) => item.textContent);
  }));
  expect(crossing).toEqual([]);
  const { sheets } = await geometry(page); // re-read right before the PDF, in print media
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  expect(pdfPageCount(pdf)).toBe(sheets);
  // Positive control for the PDF text helper test 15 relies on: a client PDF of this page carries 学 in a ToUnicode CMap.
  expect(pdfStreams(pdf).toUpperCase()).toContain(cmapHex("学"));
});

test("2 · print media shows only the print root; the measurement tree and app shell are gone", async ({ page }) => {
  await learner(page);
  await open(page);
  await page.emulateMedia({ media: "print" });
  expect(await page.evaluate(() => {
    const shown = [...document.body.children].filter((el) => getComputedStyle(el).display !== "none");
    return shown.map((el) => el.hasAttribute("data-print-root"));
  })).toEqual([true]);
  await expect(page.locator(".vp-measure")).toBeHidden();
});

test("3 · dark theme: print-root Japanese uses Noto Sans JP, paper stays #111 on white, page count holds", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await learner(page);
  await open(page);
  // Positive control: the app really is dark (the theme init script sets data-theme on <html>).
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const before = (await geometry(page)).sheets;
  await page.emulateMedia({ media: "print", colorScheme: "dark" });
  const style = await page.evaluate(() => {
    const word = document.querySelector<HTMLElement>("[data-print-root] .vp-word")!;
    const sheet = document.querySelector<HTMLElement>("[data-print-root] .vp-sheet")!;
    return { font: getComputedStyle(word).fontFamily, color: getComputedStyle(word).color, paper: getComputedStyle(sheet).backgroundColor };
  });
  expect(style.font).toMatch(/Noto[_ ]Sans[_ ]JP/i); // next/font names the face __Noto_Sans_JP_<hash>
  expect(style.color).toBe("rgb(17, 17, 17)");
  expect(style.paper).toBe("rgb(255, 255, 255)");
  expect((await geometry(page)).sheets).toBe(before);
});

test("4 · narrowing to 1024px keeps the logical heights, page count and A4 sheet size; only the preview scale shrinks", async ({ page }) => {
  await learner(page);
  await open(page);
  const preview = () => page.evaluate(() => {
    const sheet = document.querySelector<HTMLElement>("[data-preview] .vp-sheet")!;
    return { ratio: sheet.getBoundingClientRect().width / sheet.offsetWidth, width: sheet.offsetWidth, height: sheet.offsetHeight };
  });
  const wide = await geometry(page);
  const wideSheet = await preview();
  // Below 1024px the app shell is replaced by the mobile handoff (`[data-desktop-web]` is display:none), so 1024 is the narrowest real viewport.
  await page.setViewportSize({ width: 1024, height: 800 });
  await expect.poll(async () => (await preview()).ratio).toBeLessThan(wideSheet.ratio);
  const narrowSheet = await preview();
  expect(narrowSheet.ratio).toBeGreaterThan(0.3);
  for (const sheet of [wideSheet, narrowSheet]) {
    expect(Math.abs(sheet.width - A4.width)).toBeLessThan(1);
    expect(Math.abs(sheet.height - A4.height)).toBeLessThan(1);
  }
  expect(await geometry(page)).toEqual(wide);
});

test("5 · a 130-letter unbroken title wraps in the print header and nothing overflows the first sheet", async ({ page }) => {
  await learner(page);
  await open(page);
  await page.emulateMedia({ media: "print" }); // the print root is display:none on screen, so it has no layout until print media
  const title = await page.evaluate(() => {
    const sheet = document.querySelector<HTMLElement>("[data-print-root] .vp-sheet")!;
    const el = sheet.querySelector<HTMLElement>(".vp-title")!;
    return { height: el.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(el).lineHeight), scroll: sheet.scrollWidth - sheet.clientWidth };
  });
  expect(title.lineHeight).toBeGreaterThan(0);
  expect(title.height).toBeGreaterThan(2 * title.lineHeight); // positive control: the run really wraps onto several lines
  expect(title.scroll).toBe(0);
});

test("6 · saved set: a word saved from Summary prints; nothing saved shows the back link", async ({ page }) => {
  await learner(page);
  // Nothing saved yet: the empty state, not a status line, so no open() here.
  await page.goto(`/en/vocab/print?source=lesson&lesson=${lesson.videoId}&set=saved`);
  await expect(page.getByRole("link", { name: "Back to the lesson summary" })).toBeVisible();
  await expect(page.locator("[data-print-root] .vp-sheet")).toHaveCount(0);
  await saveFirstWord(page);
  await open(page, "saved");
  await expect(page.locator("[data-print-root] .vp-word")).toHaveText(["学校"]);
});

test("7 · switching Saved to All remounts the workspace: the selection of 1 does not carry over to the full set", async ({ page }) => {
  await learner(page);
  await saveFirstWord(page);
  await open(page, "saved");
  await expect(page.getByRole("status").filter({ hasText: /^1\/1 words/ })).toBeVisible();
  await page.getByRole("link", { name: "All", exact: true }).click();
  await expect(page).toHaveURL(/set=all/);
  await expect(page.getByRole("status").filter({ hasText: new RegExp(`^${ALL_WORDS}/${ALL_WORDS} words`) })).toBeVisible({ timeout: 30_000 });
});

test("8 · a font-load re-measure while print media hides the measurement tree never collapses the page set", async ({ page }) => {
  await learner(page);
  await open(page);
  const before = (await geometry(page)).sheets;
  expect(before).toBeGreaterThan(1);
  await page.emulateMedia({ media: "print" });
  await page.evaluate(() => document.fonts.dispatchEvent(new Event("loadingdone")));
  await page.waitForTimeout(500); // longer than the 150 ms font debounce, so the re-measure has run
  expect((await geometry(page)).sheets).toBe(before); // in print, never 1 clipped sheet
  await page.emulateMedia({ media: "screen" });
  await expect.poll(async () => (await geometry(page)).sheets).toBe(before);
  await expect(page.getByRole("status").filter({ hasText: new RegExp(`${ALL_WORDS}/${ALL_WORDS} words · ${before} pages`) })).toBeVisible();
  await expect(page.getByRole("button", { name: "Print", exact: true })).not.toHaveAttribute("aria-disabled");
});

test("9 · the document title carries the lesson title, which becomes the PDF file name", async ({ page }) => {
  await learner(page);
  await open(page);
  await expect(page).toHaveTitle(new RegExp(`^Vocabulary – ${LONG_TITLE.slice(0, 20)}`));
});

test("10 · the hidden measurement tree is as tall as the paper it predicts: items, first header, quote and footer", async ({ page }) => {
  await learner(page);
  await open(page);
  // The measurement tree has layout only on screen, the print root only in print media.
  const measured = await page.evaluate(() => {
    const height = (role: string) => document.querySelector<HTMLElement>(`[data-measure="${role}"]`)?.offsetHeight ?? -1;
    return {
      items: [...document.querySelectorAll<HTMLElement>('[data-measure="item"]')].map((el) => [el.dataset.itemId ?? "", el.offsetHeight] as const),
      header: height("first-header"), quote: height("quote"), footer: height("footer"),
    };
  });
  await page.emulateMedia({ media: "print" });
  const printed = await page.evaluate(() => {
    const root = document.querySelector("[data-print-root]")!;
    const height = (selector: string) => root.querySelector<HTMLElement>(selector)?.offsetHeight ?? -1;
    return {
      items: Object.fromEntries([...root.querySelectorAll<HTMLElement>(".vp-item")].map((el) => [el.dataset.itemId ?? "", el.offsetHeight])),
      header: height(".vp-head-first"), quote: height(".vp-quote"), footer: height(".vp-foot-block"),
    };
  });
  expect(measured.items.length).toBeGreaterThan(0);
  expect(Object.keys(printed.items).sort()).toEqual(measured.items.map(([id]) => id).sort());
  const pairs = [
    ...measured.items.map(([id, height]) => [height, printed.items[id] ?? -1]),
    [measured.header, printed.header], [measured.quote, printed.quote], [measured.footer, printed.footer],
  ];
  for (const [predicted, actual] of pairs) {
    expect(actual).toBeGreaterThan(0);
    expect(Math.abs(predicted! - actual!)).toBeLessThanOrEqual(0.5);
  }
});

test("11 · practice: each item shows its stroke guide, then the black model, the grey trace, then blank groups", async ({ page }) => {
  await learner(page);
  await open(page);
  const items = await page.evaluate(() => [...document.querySelectorAll("[data-print-root] .vp-item")].map((item) => ({
    target: item.querySelector(".vp-word")?.textContent ?? "",
    guides: item.querySelectorAll("svg.vp-guide").length,
    numbers: item.querySelectorAll(".vp-guide-number").length,
    model: [...(item.querySelector(".vp-group")?.querySelectorAll(".vp-model") ?? [])].map((cell) => cell.textContent).join(""),
    trace: item.querySelectorAll(".vp-group:nth-child(2) .vp-trace").length,
    blanks: [...item.querySelectorAll(".vp-group")].slice(2).every((group) => group.textContent === ""),
  })));
  expect(items.length).toBeGreaterThan(0);
  for (const item of items) {
    expect(item.guides).toBe([...item.target].length); // seeded nouns are all kanji, every one in KanjiVG
    expect(item.numbers).toBeGreaterThan(0);
    expect(item.model).toBe(item.target);
    expect(item.trace).toBe([...item.target].length);
    expect(item.blanks).toBe(true);
  }
});

test("12 · self-test: no printed answer appears anywhere on item pages; the answer key is last", async ({ page }) => {
  await learner(page);
  await open(page);
  await page.getByRole("radio", { name: "Self-test" }).click();
  await expect(page.locator("[data-print-root] .vp-answer").first()).toBeAttached({ timeout: 30_000 });
  const result = await page.evaluate(() => {
    const sheets = [...document.querySelectorAll("[data-print-root] .vp-sheet")];
    const answerSheets = sheets.filter((sheet) => sheet.querySelector(".vp-answers-title"));
    const itemSheets = sheets.filter((sheet) => !sheet.querySelector(".vp-answers-title"));
    const answers = answerSheets.flatMap((sheet) => [...sheet.querySelectorAll(".vp-answer-target")].map((el) => el.textContent ?? ""));
    const bodies = itemSheets.map((sheet) => sheet.querySelector(".vp-body")?.textContent ?? "");
    const ids = (list: Element[], selector: string) => list.flatMap((sheet) => [...sheet.querySelectorAll<HTMLElement>(selector)].map((el) => el.dataset.itemId ?? ""));
    return {
      answers, itemIds: ids(itemSheets, ".vp-item[data-item-id]"), answerIds: ids(answerSheets, ".vp-answer[data-item-id]"), lastIsAnswers: sheets.at(-1) === answerSheets.at(-1),
      leaks: answers.filter((answer) => bodies.some((body) => body.includes(answer))),
      revealing: itemSheets.some((sheet) => sheet.querySelector(".vp-guide, .vp-trace, .vp-model, .vp-word")),
      crossMasked: bodies.some((body) => body.includes("＿＿の＿＿")),
    };
  });
  expect(result.answers.length).toBeGreaterThan(1);
  // Spec: every self-test item appears on the answer pages, exactly once, in item order.
  expect(result.answerIds.length).toBeGreaterThan(0);
  expect(result.answerIds).toEqual(result.itemIds);
  expect(result.lastIsAnswers).toBe(true);
  expect(result.leaks).toEqual([]);
  expect(result.revealing).toBe(false);
  expect(result.crossMasked).toBe(true); // line 0: 学校 and 先生 both printed answers (fixture)
});

test("13 · a repetition is atomic: every group sits on one row line", async ({ page }) => {
  await learner(page);
  await open(page);
  await page.emulateMedia({ media: "print" });
  const { groups, split } = await page.evaluate(() => {
    const all = [...document.querySelectorAll("[data-print-root] .vp-group")];
    return { groups: all.length, split: all.filter((group) => {
      const tops = [...group.querySelectorAll(".vp-cell")].map((cell) => Math.round(cell.getBoundingClientRect().top));
      return new Set(tops).size > 1;
    }).length };
  });
  expect(groups).toBeGreaterThan(0); // positive control: an empty set would pass vacuously
  expect(split).toBe(0);
});

test("14 · identity: watermark centred on every sheet, quote band and footer at one height, data credit on the last footer only", async ({ page }) => {
  await learner(page);
  await open(page);
  await page.emulateMedia({ media: "print" });
  const sheets = await page.evaluate(() => [...document.querySelectorAll("[data-print-root] .vp-sheet")].map((sheet) => {
    const box = sheet.getBoundingClientRect();
    const mark = sheet.querySelector(".vp-watermark img")!.getBoundingClientRect();
    return {
      dx: Math.abs(mark.left + mark.width / 2 - (box.left + box.width / 2)),
      quoteTop: sheet.querySelector(".vp-quote")!.getBoundingClientRect().top - box.top,
      footTop: sheet.querySelector(".vp-foot-block")!.getBoundingClientRect().top - box.top,
      credit: sheet.querySelector(".vp-credit")?.textContent ?? "",
      opacity: Number(getComputedStyle(sheet.querySelector(".vp-watermark")!).opacity),
      // A missing file still has its fixed mm box; only the decoded size proves the art loaded.
      loaded: (sheet.querySelector(".vp-watermark img") as HTMLImageElement).naturalWidth > 0,
    };
  }));
  expect(sheets.length).toBeGreaterThan(1);
  for (const [index, sheet] of sheets.entries()) {
    expect(sheet.dx).toBeLessThan(1);
    expect(sheet.quoteTop).toBeCloseTo(sheets[0]!.quoteTop, 0);
    expect(sheet.footTop).toBeCloseTo(sheets[0]!.footTop, 0);
    if (index === sheets.length - 1) expect(sheet.credit).toContain("JMdict");
    else expect(sheet.credit).toBe("");
    expect(sheet.opacity).toBeLessThanOrEqual(0.06);
    expect(sheet.loaded).toBe(true);
  }
});

test("15 · Download PDF: a real PDF file, one page per sheet, with the lesson's kanji as text", async ({ page }) => {
  await learner(page);
  await open(page);
  const { sheets } = await geometry(page);
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), page.getByRole("button", { name: "Download PDF" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^Korume - Vocabulary Writing Practice - .+\.pdf$/);
  const pdf = await readFile((await download.path())!);
  expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(pdfPageCount(pdf)).toBe(sheets);
  expect(pdfStreams(pdf).toUpperCase()).toContain(cmapHex("学"));
});

test("16 · the PDF route rejects a forged id and a missing session", async ({ page, playwright }) => {
  await learner(page);
  const body = { lessonId: lesson.videoId, set: "all", locale: "en",
    settings: { mode: "practice", density: "airy", includeKanaOnly: false, showReading: true, showMeaning: true, showExample: true },
    pages: [{ kind: "items", ids: ["lex-1:forged"] }] };
  expect((await page.request.post("/api/vocab/print/pdf", { data: body })).status()).toBe(400);
  const anonymous = await playwright.request.newContext({ baseURL: page.url().replace(/\/en\/.*$/, "") });
  expect((await anonymous.post("/api/vocab/print/pdf", { data: body })).status()).toBe(401);
  await anonymous.dispose();
});

test("17 · an overflowing sheet keeps its quote band in place, so the PDF overflow guard sees the crossing", async ({ page }) => {
  await learner(page);
  await open(page);
  await page.emulateMedia({ media: "print" });
  // The geometry overflowing() (pdf-render.tsx) reads: an item bottom below its own sheet's quote band top.
  const { before, after, crossing } = await page.evaluate(() => {
    const sheet = document.querySelector("[data-print-root] .vp-sheet")!;
    const quoteTop = () => sheet.querySelector(".vp-quote")!.getBoundingClientRect().top;
    const before = quoteTop();
    const tall = Object.assign(document.createElement("div"), { className: "vp-item" });
    tall.style.height = "400mm";
    sheet.querySelector(".vp-body")!.append(tall);
    const after = quoteTop();
    return { before, after, crossing: [...sheet.querySelectorAll(".vp-item")].some((item) => item.getBoundingClientRect().bottom > after + 0.5) };
  });
  expect({ bandMoved: Math.round(Math.abs(after - before)), crossing }).toEqual({ bandMoved: 0, crossing: true });
});

test("18 · every item sheet but the last spreads its items down to the quote band; the last stays packed", async ({ page }) => {
  await learner(page);
  await open(page);
  await page.emulateMedia({ media: "print" });
  // Distance from each item sheet's last item bottom to its quote band top, and from its first item top to its body top.
  const sheets = await page.evaluate(() => [...document.querySelectorAll("[data-print-root] .vp-sheet")]
    .filter((sheet) => sheet.querySelector(".vp-item"))
    .map((sheet) => {
      const items = [...sheet.querySelectorAll(".vp-item")];
      const body = sheet.querySelector(".vp-body")!.getBoundingClientRect();
      return {
        toBand: sheet.querySelector(".vp-quote")!.getBoundingClientRect().top - items.at(-1)!.getBoundingClientRect().bottom,
        fromTop: items[0]!.getBoundingClientRect().top - body.top,
        maxGap: Math.max(0, ...items.slice(1).map((item, i) => item.getBoundingClientRect().top - items[i]!.getBoundingClientRect().bottom)),
      };
    }));
  expect(sheets.length).toBeGreaterThan(1); // positive control: one sheet has nothing to spread
  for (const sheet of sheets.slice(0, -1)) {
    expect(sheet).toEqual({ toBand: expect.closeTo(0, 0), fromTop: expect.closeTo(0, 0), maxGap: expect.any(Number) });
    expect(sheet.maxGap).toBeGreaterThan(5); // the leftover really went between the items
  }
  expect(sheets.at(-1)!.maxGap).toBeCloseTo(0, 0);
});

test("19 · default practice settings fit four items, example included, on every continuation sheet but the last (owner 2026-10-07)", async ({ page }) => {
  await learner(page);
  await open(page);
  const counts = await page.evaluate(() => [...document.querySelectorAll("[data-print-root] .vp-sheet")]
    .map((sheet) => ({
      items: sheet.querySelectorAll(".vp-item").length,
      examples: sheet.querySelectorAll(".vp-example").length,
      // The example shares the stroke-guide row: its box lies inside the guide boxes' vertical span.
      offRow: [...sheet.querySelectorAll(".vp-item")].filter((item) => {
        const example = item.querySelector(".vp-example")?.getBoundingClientRect();
        const guide = item.querySelector(".vp-guide")?.getBoundingClientRect();
        return example && guide && (example.top < guide.top - 0.5 || example.bottom > guide.bottom + 0.5);
      }).length,
    })));
  // The fixture title wraps to three lines on purpose, so sheet 1 keeps 3 items; a title of up to two lines keeps 4.
  const middle = counts.slice(1, -1);
  expect(middle.length).toBeGreaterThan(0); // positive control: there is a continuation sheet that is not the last
  expect(counts.reduce((sum, sheet) => sum + sheet.examples, 0)).toBeGreaterThan(0); // examples are on by default
  expect(counts.map((sheet) => sheet.offRow)).toEqual(counts.map(() => 0));
  expect(middle.map((sheet) => sheet.items)).toEqual(middle.map(() => 4));
});
