import { expect, test, type Locator, type Page } from "@playwright/test";
import { fakeYt } from "./fixtures/fake-youtube";
import { answerOf, composer, openLessonAt, openMascot, registerLearner, sheet, stubTurns } from "./fixtures/korume-page";
import { seedWorkspaceData, type WorkspaceData } from "./fixtures/workspace-data";

/**
 * The resizable, movable Ask Korume sheet (spec §5.1, §6): where it opens, how handles and the header move it, how it
 * toggles, and that none of it touches the thread or the player. Run at the owner viewport (1280×529) and a roomier 1280×672.
 */
let data: WorkspaceData;
test.beforeAll(async () => { data = await seedWorkspaceData(); });
test.afterAll(async () => { await data?.cleanup(); });

/** A CSS length token in px, resolved in the page (the density unit scales with the viewport width). */
const tokenPx = (page: Page, token: string) => page.evaluate((name) => {
  const probe = document.createElement("div");
  probe.style.cssText = `position:absolute;visibility:hidden;width:var(${name})`;
  document.body.append(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}, token);

const box = async (target: Locator) => (await target.boundingBox())!;
const handle = (page: Page, edge: string) => page.locator(`[data-korume-handle="${edge}"]`);
const centreOf = async (target: Locator) => { const b = await box(target); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const header = (page: Page) => sheet(page).locator("[data-korume-drag]");
const title = (page: Page) => sheet(page).getByRole("heading", { name: "Korume" });

/** Press at `from`, move by (dx, dy) in steps; `release` false leaves the button down for a mid-drag look. */
async function dragBy(page: Page, from: { x: number; y: number }, dx: number, dy: number, release = true) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 10 });
  if (release) await page.mouse.up();
}

/** Opens the lesson and the sheet; returns the mascot box as it was before the mascot was unmounted. */
async function openSheet(page: Page) {
  await registerLearner(data, page, "e2e_korume_sheet_geo");
  await openLessonAt(data, page, 3);
  const mascot = await box(page.getByTestId("korume-mascot"));
  await openMascot(page);
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page)).toHaveAttribute("data-layout", "small");
  return mascot;
}

/** Sends the open sheet to the left so there is room to grow to the right. */
async function moveLeft(page: Page, by = 450) {
  await dragBy(page, await centreOf(title(page)), -by, 0);
}

for (const viewport of [{ width: 1280, height: 672 }, { width: 1280, height: 529 }]) {
  test.describe(`sheet at ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test("1 · opens small beside the mascot, inside the viewport", async ({ page }) => {
      const mascot = await openSheet(page);
      const margin = await tokenPx(page, "--space-md");
      const b = await box(sheet(page));
      expect(b.x).toBeGreaterThanOrEqual(margin - 1);
      expect(b.y).toBeGreaterThanOrEqual(margin - 1);
      expect(b.x + b.width).toBeLessThanOrEqual(viewport.width - margin + 1);
      expect(b.y + b.height).toBeLessThanOrEqual(viewport.height - margin + 1);
      expect(Math.abs(b.x + b.width - (mascot.x + mascot.width))).toBeLessThanOrEqual(margin + 1);
      // Taller than the room above the mascot (the owner viewport): the sheet is clamped to the top margin instead.
      if (b.y > margin + 1) expect(Math.abs(b.y + b.height - (mascot.y + mascot.height))).toBeLessThanOrEqual(margin + 1);
      else expect(b.y + b.height).toBeGreaterThanOrEqual(mascot.y + mascot.height - 1);
      expect(b.width).toBeCloseTo(await tokenPx(page, "--korume-small-w"), 0);
      expect(b.height).toBeCloseTo(Math.min(await tokenPx(page, "--korume-small-h"), viewport.height - 2 * margin), 0);
    });

    test("2 · the se handle grows the box and the w handle keeps the right edge", async ({ page }) => {
      await openSheet(page);
      await moveLeft(page);
      const before = await box(sheet(page));
      await dragBy(page, await centreOf(handle(page, "se")), 120, 0);
      const grown = await box(sheet(page));
      expect(grown.width).toBeCloseTo(before.width + 120, 0);
      expect(grown.x).toBeCloseTo(before.x, 0);
      await dragBy(page, await centreOf(handle(page, "w")), -40, 0);
      const west = await box(sheet(page));
      expect(Math.abs(west.x + west.width - (grown.x + grown.width))).toBeLessThanOrEqual(1);
      expect(west.width).toBeCloseTo(grown.width + 40, 0);
    });

    test("3 · dragging e past the breakpoint holds still, then centres on release", async ({ page }) => {
      await openSheet(page);
      await moveLeft(page);
      const before = await box(sheet(page));
      const breakpoint = await tokenPx(page, "--korume-breakpoint");
      await dragBy(page, await centreOf(handle(page, "e")), breakpoint - before.width + 40, 0, false);
      const mid = await box(sheet(page));
      expect(mid.width).toBeGreaterThanOrEqual(breakpoint);
      expect(Math.abs(mid.x - before.x)).toBeLessThanOrEqual(1);
      await page.mouse.up();
      await expect(sheet(page)).toHaveAttribute("data-layout", "large");
      await expect.poll(async () => { const b = await box(sheet(page)); return Math.abs(b.x + b.width / 2 - viewport.width / 2); }).toBeLessThanOrEqual(2);
    });

    test("4 · the header moves the sheet, a header button does not", async ({ page }) => {
      await openSheet(page);
      const before = await box(sheet(page));
      await dragBy(page, await centreOf(title(page)), -150, -60);
      const moved = await box(sheet(page));
      expect(moved.x).toBeCloseTo(before.x - 150, 0);
      expect(moved.y).toBeLessThanOrEqual(before.y); // the owner viewport leaves no vertical room
      await dragBy(page, await centreOf(sheet(page).getByRole("button", { name: "Enlarge Korume" })), -100, 0);
      const after = await box(sheet(page));
      expect(after.x).toBeCloseTo(moved.x, 0);
      expect(after.y).toBeCloseTo(moved.y, 0);
      await expect(sheet(page)).toHaveAttribute("data-layout", "small");
    });

    test("5 · a header double-click toggles, and toggling back goes beside the mascot", async ({ page }) => {
      const mascot = await openSheet(page);
      const margin = await tokenPx(page, "--space-md");
      await title(page).dblclick();
      await expect(sheet(page)).toHaveAttribute("data-layout", "large");
      await expect.poll(async () => { const b = await box(sheet(page)); return Math.abs(b.x + b.width / 2 - viewport.width / 2); }).toBeLessThanOrEqual(2);
      await title(page).dblclick();
      await expect(sheet(page)).toHaveAttribute("data-layout", "small");
      await expect.poll(async () => { const b = await box(sheet(page)); return Math.abs(b.x + b.width - (mascot.x + mascot.width)); }).toBeLessThanOrEqual(margin + 1);
    });

    test("6 · a large sheet re-clamps at the narrowest supported width, keeping its draft", async ({ page }) => {
      await openSheet(page);
      await sheet(page).getByRole("button", { name: "Enlarge Korume" }).click();
      await expect(sheet(page)).toHaveAttribute("data-layout", "large");
      await composer(sheet(page)).fill("a draft that must survive");
      // Below 1024px wide the workspace hides Korume altogether, so 1024 is the narrowest reachable width.
      await page.setViewportSize({ width: 1024, height: viewport.height });
      const sheetBox = page.getByTestId("korume-sheet");
      await expect.poll(async () => { const b = await box(sheetBox); return b.x >= 0 && b.y >= 0 && b.x + b.width <= 1024 && b.y + b.height <= viewport.height; }).toBe(true);
      const b = await box(sheetBox);
      const breakpoint = await tokenPx(page, "--korume-breakpoint");
      await expect(sheetBox).toHaveAttribute("data-layout", b.width >= breakpoint ? "large" : "small");
      await expect(composer(sheet(page))).toHaveValue("a draft that must survive");
    });

    test("7 · reduced motion jumps: centred at once, nothing running", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await openSheet(page);
      await sheet(page).getByRole("button", { name: "Enlarge Korume" }).click();
      expect(await sheet(page).evaluate((el) => el.getAnimations().length)).toBe(0);
      const b = await box(sheet(page));
      expect(Math.abs(b.x + b.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(2);
    });

    test("8 · the thread and the player survive toggling", async ({ page }) => {
      await registerLearner(data, page, "e2e_korume_sheet_keep");
      await stubTurns(page, (body) => ({ status: 200, body: answerOf(body.turnId, `Answer to: ${body.text}`) }));
      await openLessonAt(data, page, 3);
      const player = await page.getByTestId("fake-yt").elementHandle();
      await openMascot(page);
      await composer(sheet(page)).fill("Why は?");
      await composer(sheet(page)).press("Enter");
      await expect(sheet(page).getByText("Answer to: Why は?")).toBeVisible();
      for (let i = 0; i < 2; i++) {
        await sheet(page).getByRole("button", { name: "Enlarge Korume" }).click();
        await expect(sheet(page)).toHaveAttribute("data-layout", "large");
        await expect(sheet(page).getByText("Answer to: Why は?")).toBeVisible();
        await sheet(page).getByRole("button", { name: "Shrink Korume" }).click();
        await expect(sheet(page)).toHaveAttribute("data-layout", "small");
        await expect(sheet(page).getByText("Answer to: Why は?")).toBeVisible();
      }
      expect(await player!.evaluate((el) => el.isConnected)).toBe(true);
      expect((await fakeYt(page)).mounts).toBe(1);
    });

    const splitter = (page: Page) => sheet(page).getByRole("separator", { name: "Resize chat and context" });
    const rail = (page: Page) => sheet(page).locator("[data-korume-rail]");
    async function openLarge(page: Page) {
      await sheet(page).getByRole("button", { name: "Enlarge Korume" }).click();
      await expect(sheet(page)).toHaveAttribute("data-layout", "large");
      await expect(sheet(page)).not.toHaveAttribute("data-gliding", ""); // the glide moves the splitter under the pointer
    }

    /** The scrollbar sits on the scroller's right border edge: the point 4px inside it must belong to the scroller, not to a resize handle. */
    const barOwner = (page: Page, selector: string) => page.evaluate((sel) => {
      const r = document.querySelector(sel)!.getBoundingClientRect();
      const hit = document.elementFromPoint(r.right - 4, r.top + r.height / 2);
      return { inside: !!hit?.closest(sel), handle: hit?.closest("[data-korume-handle]")?.getAttribute("data-korume-handle") ?? null };
    }, selector);

    test("8b · the scrollbars stay clear of the east resize handle (large rail, small chat)", async ({ page }) => {
      await openSheet(page);
      expect(await barOwner(page, "[data-korume-scroll]")).toEqual({ inside: true, handle: null });
      await openLarge(page);
      expect(await barOwner(page, "[data-korume-rail]")).toEqual({ inside: true, handle: null });
    });

    test("9 · the splitter drags the rail wider and never squeezes the chat below its minimum", async ({ page }) => {
      await openSheet(page);
      await openLarge(page);
      const before = (await box(rail(page))).width;
      await dragBy(page, await centreOf(splitter(page)), -80, 0);
      await expect.poll(async () => (await box(rail(page))).width).toBeCloseTo(before + 80, 0);
      // Narrow the sheet until sheetW - chatMin - handle < railMax, so the chat minimum (not railMax) is what binds.
      const chatMin = await tokenPx(page, "--korume-chat-min");
      const handleW = await tokenPx(page, "--korume-handle");
      await dragBy(page, await centreOf(handle(page, "e")), -150, 0);
      await expect(sheet(page)).toHaveAttribute("data-layout", "large");
      await expect(sheet(page)).not.toHaveAttribute("data-gliding", "");
      const sheetBox = await box(sheet(page));
      expect(sheetBox.width - chatMin - handleW).toBeLessThan(await tokenPx(page, "--korume-rail-max"));
      await dragBy(page, await centreOf(splitter(page)), -900, 0);
      expect(Number(await splitter(page).getAttribute("aria-valuemax"))).toBeCloseTo(sheetBox.width - chatMin - handleW, 0);
      const railBox = await box(rail(page));
      expect(railBox.x + railBox.width).toBeLessThanOrEqual(sheetBox.x + sheetBox.width + 1);
      const chat = sheet(page).locator("[data-korume-scroll]").locator("xpath=..");
      expect((await box(chat)).width).toBeGreaterThanOrEqual(chatMin - 1);
    });

    test("10 · the rail width survives a reload, and the mascot still opens small", async ({ page }) => {
      await openSheet(page);
      await openLarge(page);
      await dragBy(page, await centreOf(splitter(page)), -60, 0);
      const width = (await box(rail(page))).width;
      await page.reload();
      await expect(page.getByTestId("korume-mascot")).toBeVisible();
      await openMascot(page);
      await expect(sheet(page)).toHaveAttribute("data-layout", "small");
      await openLarge(page);
      expect((await box(rail(page))).width).toBeCloseTo(width, 0);
    });

    const mascotBox = (page: Page) => box(page.getByTestId("korume-mascot"));
    const mascotButton = (page: Page) => page.getByRole("button", { name: "Ask Korume" });

    test("11 · a press that barely moves opens the sheet", async ({ page }) => {
      await registerLearner(data, page, "e2e_korume_sheet_press");
      await openLessonAt(data, page, 3);
      const from = await centreOf(mascotButton(page));
      await dragBy(page, from, 2, 1);
      await expect(sheet(page)).toBeVisible();
    });

    test("12 · a 200px drag moves the mascot without opening, survives a reload, and the sheet opens beside it", async ({ page }) => {
      await registerLearner(data, page, "e2e_korume_sheet_drag");
      await openLessonAt(data, page, 3);
      const before = await mascotBox(page);
      await dragBy(page, await centreOf(mascotButton(page)), -200, 0);
      const moved = await mascotBox(page);
      expect(Math.abs(before.x - moved.x - 200)).toBeLessThanOrEqual(3);
      await expect(sheet(page)).toHaveCount(0);
      await page.reload();
      await expect(page.getByTestId("korume-mascot")).toBeVisible();
      expect(Math.abs((await mascotBox(page)).x - moved.x)).toBeLessThanOrEqual(3);
      // Top-left corner: the sheet grows down and to the right of the mascot.
      const here = await centreOf(mascotButton(page));
      await dragBy(page, here, 20 - here.x, 20 - here.y);
      const corner = await mascotBox(page);
      await openMascot(page);
      await expect(sheet(page)).toBeVisible();
      const margin = await tokenPx(page, "--space-md");
      const b = await box(sheet(page));
      expect(Math.abs(b.x - corner.x)).toBeLessThanOrEqual(margin + 1);
      expect(Math.abs(b.y - corner.y)).toBeLessThanOrEqual(margin + 1);
      expect(b.x + b.width).toBeGreaterThan(corner.x + corner.width);
    });

    test("13 · a stored position from a bigger window is clamped into the viewport", async ({ page }) => {
      await registerLearner(data, page, "e2e_korume_sheet_clamp");
      await openLessonAt(data, page, 3);
      await page.evaluate(() => localStorage.setItem("korume.launcher", JSON.stringify({ x: 5000, y: 3000 })));
      await page.reload();
      await expect(page.getByTestId("korume-mascot")).toBeVisible();
      const margin = await tokenPx(page, "--space-md");
      const b = await mascotBox(page);
      expect(b.x).toBeGreaterThanOrEqual(margin - 3);
      expect(b.y).toBeGreaterThanOrEqual(margin - 3);
      expect(b.x + b.width).toBeLessThanOrEqual(viewport.width - margin + 3);
      expect(b.y + b.height).toBeLessThanOrEqual(viewport.height - margin + 3);
    });
  });
}
