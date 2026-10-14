import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import nav from "../../messages/vi/nav.json";
import { TYPE_EXEMPTIONS } from "../../lib/typography-allowlist";
import { SCALE, TOKENS, TOLERANCE, VIEWPORTS } from "./typography/scale";
import { inspectPage, readTokens, type TypeFinding } from "./typography/measure";
import { resolveRoutes, type RouteTarget } from "./typography/routes";
import { seedLearner, type Learner } from "./typography/learner";

/**
 * Spec G4: every P1 route at 1280/1440/1920 in `vi` — the pinned scale (literal table), every visible text on
 * an approved pair, no clipped control/label/Japanese line, no horizontal scroll. A route that cannot be
 * reached or measured FAILS with its reason. The Dashboard is measured a second time with the nav collapsed.
 */
test.describe.configure({ mode: "serial" });
const exempt = Object.fromEntries(TYPE_EXEMPTIONS.map((entry) => [entry.id, entry.scope]));
let learner: Learner;
let routes: RouteTarget[];
let session: Awaited<ReturnType<BrowserContext["storageState"]>>;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ locale: "vi" });
  learner = await seedLearner(await context.newPage());
  routes = await resolveRoutes(learner);
  session = await context.storageState();
  await context.close();
});
test.afterAll(async () => { await learner?.cleanup(); });

async function open(browser: Browser, width: number, height: number) {
  const context = await browser.newContext({ storageState: session, viewport: { width, height }, locale: "vi", reducedMotion: "reduce" });
  await context.route(/youtube\.com|ytimg\.com|googlevideo\.com/, (route) => route.abort());
  return { context, page: await context.newPage() };
}

const show = (route: string, f: TypeFinding) => `${route} · ${f.kind} · ${f.where} · ${f.detail}`;

for (const viewport of VIEWPORTS) {
  const pairs = TOKENS.map((token) => SCALE[viewport.name][token]);

  test(`every learner page reads on the type scale at ${viewport.name}`, async ({ browser }) => {
    test.setTimeout(20 * 60_000);
    const { context, page } = await open(browser, viewport.width, viewport.height);
    const report: string[] = [];
    await page.goto("/vi/dashboard");
    const measured = await page.evaluate(readTokens, TOKENS);
    for (const token of TOKENS) {
      const [size, leading] = SCALE[viewport.name][token];
      const [s, l] = measured[token];
      if (Math.abs(s - size) > TOLERANCE || Math.abs(l - leading) > TOLERANCE) report.push(`scale · ${token} renders ${s}/${l}, spec S2 says ${size}/${leading}`);
    }
    for (const route of routes) {
      if ("unavailable" in route) { report.push(`${route.label} · NOT MEASURED · ${route.unavailable}`); continue; }
      const response = await page.goto(`/vi/${route.path}`);
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined); // bounded: some pages poll
      await page.evaluate(() => document.fonts.ready);
      if (page.url().includes("/login")) { report.push(`${route.label} · NOT MEASURED · redirected to login`); continue; }
      const status = response?.status() ?? 0;
      if (route.label !== "e2e-route-error" && status >= 400) { report.push(`${route.label} · NOT MEASURED · HTTP ${status}`); continue; }
      for (const finding of await page.evaluate(inspectPage, { pairs, tolerance: TOLERANCE, exempt })) report.push(show(route.label, finding));
    }
    await context.close();
    expect(report, report.join("\n")).toEqual([]);
  });

  test(`the Dashboard with the nav collapsed at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await open(browser, viewport.width, viewport.height);
    await page.goto("/vi/dashboard");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await page.getByRole("button", { name: nav.toggle.hide }).click();
    await expect(page.getByRole("button", { name: nav.toggle.show })).toBeVisible();
    const findings = await page.evaluate(inspectPage, { pairs, tolerance: TOLERANCE, exempt });
    await context.close();
    expect(findings.map((f) => show("dashboard (nav collapsed)", f))).toEqual([]);
  });
}

test("extra-large display scale at 1920 keeps Dashboard and Settings whole (Review Focus 1)", async ({ browser }) => {
  const { context, page } = await open(browser, 1920, 1080);
  await page.goto("/vi/dashboard");
  const set = await page.request.patch("/api/user/preferences", { data: { displayScale: "extra_large" } });
  expect(set.status()).toBe(200);
  const report: string[] = [];
  for (const route of ["dashboard", "settings"]) {
    await page.goto(`/vi/${route}`);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    // Type sizes are 1.25x the table here by design; only clipping and horizontal scroll are asserted.
    const findings = await page.evaluate(inspectPage, { pairs: [], tolerance: TOLERANCE, exempt });
    report.push(...findings.filter((f) => f.kind !== "type").map((f) => show(route, f)));
  }
  await page.request.patch("/api/user/preferences", { data: { displayScale: "normal" } });
  await context.close();
  expect(report, report.join("\n")).toEqual([]);
});
