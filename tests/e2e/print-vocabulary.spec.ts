import { expect, test, type Page } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./fixtures/auth";
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

test("1 · the PDF has one page per DOM sheet, every sheet is A4, and no item crosses its footer", async ({ page }) => {
  await learner(page);
  await open(page);
  expect((await geometry(page)).sheets).toBeGreaterThan(1); // positive control: 24 words span several pages
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
    const footTop = sheet.querySelector(".vp-foot")!.getBoundingClientRect().top;
    return [...sheet.querySelectorAll(".vp-item")].filter((item) => item.getBoundingClientRect().bottom > footTop + 0.5).map((item) => item.textContent);
  }));
  expect(crossing).toEqual([]);
  const { sheets } = await geometry(page); // re-read right before the PDF, in print media
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const pdfPages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  expect(pdfPages).toBe(sheets);
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

test("7 · switching Saved to All remounts the workspace: the selection of 1 does not carry over to the 24-word set", async ({ page }) => {
  await learner(page);
  await saveFirstWord(page);
  await open(page, "saved");
  await expect(page.getByRole("status").filter({ hasText: /^1\/1 words/ })).toBeVisible();
  await page.getByRole("link", { name: "All", exact: true }).click();
  await expect(page).toHaveURL(/set=all/);
  await expect(page.getByRole("status").filter({ hasText: /^24\/24 words/ })).toBeVisible({ timeout: 30_000 });
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
  await expect(page.getByRole("status").filter({ hasText: new RegExp(`24/24 words · ${before} pages`) })).toBeVisible();
  await expect(page.getByRole("button", { name: "Print / Save PDF" })).not.toHaveAttribute("aria-disabled");
});

test("9 · the document title carries the lesson title, which becomes the PDF file name", async ({ page }) => {
  await learner(page);
  await open(page);
  await expect(page).toHaveTitle(new RegExp(`^Vocabulary – ${LONG_TITLE.slice(0, 20)}`));
});
