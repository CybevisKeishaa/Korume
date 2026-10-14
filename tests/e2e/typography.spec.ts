import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import nav from "../../messages/vi/nav.json";
import errors from "../../messages/vi/errors.json";
import companion from "../../messages/vi/companion.json";
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
const unclipped = TYPE_EXEMPTIONS.filter((entry) => entry.clip === false).map((entry) => entry.id);
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
      // Without E2E_ROUTE_ERROR=1 the route is a 404 and would be measured as if it were the panel.
      if (route.label === "e2e-route-error") {
        await expect(page.getByRole("heading", { name: errors.routeError.heading }), "start the server with E2E_ROUTE_ERROR=1").toBeVisible();
      }
      if (route.label !== "e2e-route-error" && status >= 400) { report.push(`${route.label} · NOT MEASURED · HTTP ${status}`); continue; }
      for (const finding of await page.evaluate(inspectPage, { pairs, tolerance: TOLERANCE, exempt, unclipped })) report.push(show(route.label, finding));
    }
    await context.close();
    expect(report, report.join("\n")).toEqual([]);
  });

  test(`the Dashboard with the nav collapsed at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await open(browser, viewport.width, viewport.height);
    await page.goto("/vi/dashboard");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await page.getByRole("button", { name: nav.toggle.collapse }).click();
    await expect(page.getByRole("button", { name: nav.toggle.expand })).toBeVisible();
    const findings = await page.evaluate(inspectPage, { pairs, tolerance: TOLERANCE, exempt, unclipped });
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
  await page.goto("/vi/dashboard");
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  // A vacuous pass is the risk: prove the scale applied (21.875 = 17.5 x 1.25) before judging clipping.
  const [bodySize] = (await page.evaluate(readTokens, ["body"])).body;
  expect(Math.abs(bodySize - 21.875), `body renders ${bodySize}px, expected 21.875px`).toBeLessThanOrEqual(TOLERANCE);
  for (const route of ["dashboard", "settings"]) {
    await page.goto(`/vi/${route}`);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    // Type sizes are 1.25x the table here by design; only clipping and horizontal scroll are asserted.
    const findings = await page.evaluate(inspectPage, { pairs: [], tolerance: TOLERANCE, exempt, unclipped });
    report.push(...findings.filter((f) => f.kind !== "type").map((f) => show(route, f)));
  }
  await page.request.patch("/api/user/preferences", { data: { displayScale: "normal" } });
  await context.close();
  expect(report, report.join("\n")).toEqual([]);
});

test("a dialog's content sits on the type scale (overlays render in a portal)", async ({ browser }) => {
  const viewport = VIEWPORTS[1];
  const pairs = TOKENS.map((token) => SCALE[viewport.name][token]);
  const { context, page } = await open(browser, viewport.width, viewport.height);
  const video = routes.find((r) => r.label === "(focus) shadowing/[id]");
  if (!video || "unavailable" in video) throw new Error("shadowing route unavailable, cannot open the pin dialog");
  await page.goto(`/vi/${video.path}`);
  await page.getByRole("button", { name: companion.pin.trigger }).first().dispatchEvent("click"); // a real click is intercepted by the sentence text in the seeded row (probe), the handler is what matters here
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("p[lang=ja]")).toBeVisible();
  const findings = await page.evaluate(inspectPage, { pairs, tolerance: TOLERANCE, exempt, unclipped });
  await context.close();
  expect(findings.map((f) => show("shadowing pin dialog", f))).toEqual([]);
});
