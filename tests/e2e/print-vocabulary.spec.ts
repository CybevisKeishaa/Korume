import { expect, test, type Page } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./fixtures/auth";
import { seedPrintLesson } from "./fixtures/print-data";
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
  // Let late font loads (and the workspace's 150 ms re-measure debounce) finish: under print media the measurement tree is display:none, so a re-measure then reads zeros.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
};
const geometry = (page: Page) => page.evaluate(() => {
  const logical = [...document.querySelectorAll<HTMLElement>('[data-measure="item"]')].map((el) => el.offsetHeight);
  const sheets = document.querySelectorAll("[data-print-root] .vp-sheet").length;
  return { logical, sheets };
});

test("1 · the PDF has one page per DOM sheet, and no item crosses its sheet", async ({ page }) => {
  await learner(page);
  await open(page);
  const { sheets } = await geometry(page);
  expect(sheets).toBeGreaterThan(1); // positive control: 24 words span several pages
  await page.emulateMedia({ media: "print" });
  const crossing = await page.evaluate(() => [...document.querySelectorAll("[data-print-root] .vp-sheet")].flatMap((sheet) => {
    const bottom = sheet.getBoundingClientRect().bottom;
    return [...sheet.querySelectorAll(".vp-item")].filter((item) => item.getBoundingClientRect().bottom > bottom + 0.5).map((item) => item.textContent);
  }));
  expect(crossing).toEqual([]);
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

test("4 · at the narrowest desktop width (1024px) the logical heights and page count are unchanged; only the preview scale differs", async ({ page }) => {
  await learner(page);
  await open(page);
  const wide = await geometry(page);
  // Below 1024px the app shell is replaced by the mobile handoff (`[data-desktop-web]` is display:none), so 1024 is the narrowest real viewport.
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.waitForTimeout(300);
  const narrow = await geometry(page);
  expect(narrow).toEqual(wide);
  const ratio = await page.evaluate(() => {
    const sheet = document.querySelector<HTMLElement>("[data-preview] .vp-sheet")!;
    return sheet.getBoundingClientRect().width / sheet.offsetWidth;
  });
  expect(ratio).toBeLessThan(1);
  expect(ratio).toBeGreaterThan(0.3);
});

test("5 · a long unbroken title wraps in the header and nothing overflows the first sheet", async ({ page }) => {
  await learner(page);
  await open(page);
  await page.emulateMedia({ media: "print" }); // the print root is display:none on screen, so it has no layout until print media
  const overflow = await page.evaluate(() => {
    const sheet = document.querySelector<HTMLElement>("[data-print-root] .vp-sheet")!;
    const head = sheet.querySelector<HTMLElement>(".vp-head-first")!;
    return { headTaller: head.offsetHeight > 80, scroll: sheet.scrollWidth - sheet.clientWidth };
  });
  expect(overflow.headTaller).toBe(true); // positive control: the title really wraps
  expect(overflow.scroll).toBe(0);
});

test("6 · saved set: a word saved from Summary prints; nothing saved shows the back link", async ({ page }) => {
  await learner(page);
  // Nothing saved yet: the empty state, not a status line, so no open() here.
  await page.goto(`/en/vocab/print?source=lesson&lesson=${lesson.videoId}&set=saved`);
  await expect(page.getByRole("link", { name: "Back to the lesson summary" })).toBeVisible();
  await expect(page.locator("[data-print-root] .vp-sheet")).toHaveCount(0);
  const saved = await page.request.post("/api/mining", { data: { lineId: lesson.lineIds[0], targetWord: "学校", sourceKind: "vocabulary" } });
  expect(saved.ok()).toBe(true);
  await open(page, "saved");
  await expect(page.locator("[data-print-root] .vp-word")).toHaveText(["学校"]);
});

test("7 · switching All to Saved remounts the workspace: the saved (empty) set replaces the 24-word selection", async ({ page }) => {
  await learner(page);
  await open(page, "all");
  await page.getByRole("link", { name: "Saved", exact: true }).click();
  await expect(page).toHaveURL(/set=saved/);
  await expect(page.getByRole("link", { name: "Back to the lesson summary" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /words ·/ })).toHaveCount(0);
  await expect(page.locator("[data-print-root] .vp-sheet")).toHaveCount(0);
});
