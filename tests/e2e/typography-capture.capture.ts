import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import nav from "../../messages/vi/nav.json";
import { VIEWPORTS } from "./typography/scale";
import { resolveRoutes } from "./typography/routes";
import { seedLearner } from "./typography/learner";
import { readRatios } from "./typography/measure";

/**
 * Spec V1–V4. Writes `<CAPTURE_OUT>/<route>__<viewport>[__nav-collapsed].png`, `ratios.json` and `log.txt`
 * (every route that could not be captured, with its reason — never skipped silently).
 * CAPTURE_TIME (ISO) pins the browser clock so two runs compare; server-rendered dates follow real time,
 * which is why Task 11 captures baseline and branch back to back with the same CAPTURE_TIME.
 */
const OUT = process.env.CAPTURE_OUT;
if (!OUT) throw new Error("set CAPTURE_OUT to the output directory");
const TIME = new Date(process.env.CAPTURE_TIME ?? Date.now());
const slug = (label: string) => label.replace(/[()[\]]/g, "").replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "");

async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined); // bounded: live pages poll
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
}

async function contextFor(context: BrowserContext, width: number, height: number) {
  const browser = context.browser()!;
  const fresh = await browser.newContext({ storageState: await context.storageState(), viewport: { width, height }, locale: "vi", reducedMotion: "reduce" });
  await fresh.clock.setFixedTime(TIME);
  await fresh.route(/youtube\.com|ytimg\.com|googlevideo\.com/, (route) => route.abort());
  return fresh;
}

test("capture every in-scope page (spec V1-V4)", async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  const log: string[] = [];
  const ratios: Record<string, unknown> = {};
  const seedContext = await browser.newContext({ locale: "vi" });
  const learner = await seedLearner(await seedContext.newPage());
  try {
    const routes = await resolveRoutes(learner);
    for (const viewport of VIEWPORTS) {
      const context = await contextFor(seedContext, viewport.width, viewport.height);
      const page = await context.newPage();
      for (const route of routes) {
        if ("unavailable" in route) { log.push(`${route.label} @${viewport.name}: NOT CAPTURED — ${route.unavailable}`); continue; }
        const response = await page.goto(`/vi/${route.path}`);
        await settle(page);
        if (page.url().includes("/login")) { log.push(`${route.label} @${viewport.name}: NOT CAPTURED — redirected to login`); continue; }
        if (route.label !== "e2e-route-error" && (response?.status() ?? 0) >= 400) log.push(`${route.label} @${viewport.name}: HTTP ${response?.status()} (captured anyway)`);
        await page.screenshot({ path: path.join(OUT, `${slug(route.label)}__${viewport.name}.png`), fullPage: true });
      }
      await page.goto("/vi/dashboard");
      await settle(page);
      if (viewport.name !== "1280") {
        ratios[`dashboard@${viewport.name}`] = await page.evaluate(readRatios, '[data-area="continue"]');
        await page.goto("/vi/settings");
        await settle(page);
        ratios[`settings@${viewport.name}`] = await page.evaluate(readRatios, "main section");
        await page.goto("/vi/dashboard");
        await settle(page);
      }
      await page.getByRole("button", { name: nav.toggle.hide }).click();
      await expect(page.getByRole("button", { name: nav.toggle.show })).toBeVisible();
      await page.screenshot({ path: path.join(OUT, `dashboard__${viewport.name}__nav-collapsed.png`), fullPage: true });
      await context.close();
    }
    // Spec M4: out-of-scope surfaces that share components/ui.
    for (const viewport of VIEWPORTS) {
      const anon = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, locale: "vi", reducedMotion: "reduce" });
      await anon.clock.setFixedTime(TIME);
      const page = await anon.newPage();
      for (const [label, url] of [["out-landing", "/vi"], ["out-login", "/vi/login"]] as const) {
        await page.goto(url);
        await settle(page);
        await page.screenshot({ path: path.join(OUT, `${label}__${viewport.name}.png`), fullPage: true });
      }
      await anon.close();
    }
    const promoted = await learner.lesson.admin.from("users").update({ is_admin: true }).eq("id", learner.userId);
    if (promoted.error) throw promoted.error;
    for (const viewport of VIEWPORTS) {
      const context = await contextFor(seedContext, viewport.width, viewport.height);
      const page = await context.newPage();
      await page.goto("/vi/admin");
      await settle(page);
      if (page.url().includes("/admin")) await page.screenshot({ path: path.join(OUT, `out-admin__${viewport.name}.png`), fullPage: true });
      else log.push(`out-admin @${viewport.name}: NOT CAPTURED — redirected to ${page.url()}`);
      await context.close();
    }
  } finally {
    writeFileSync(path.join(OUT, "ratios.json"), JSON.stringify(ratios, null, 2));
    writeFileSync(path.join(OUT, "log.txt"), log.join("\n") || "every route captured");
    await learner.cleanup();
    await seedContext.close();
  }
});
