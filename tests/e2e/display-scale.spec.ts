import { test, expect, type Page } from "@playwright/test";
import { registerViaUi } from "./fixtures/auth";

/**
 * Display Scale, measured rather than read (settings spec §4.5, §8).
 *
 * A `var()` inside a custom property is substituted on the element that
 * DECLARES it, so no amount of reading `globals.css` proves that a number set
 * on `<html>` reaches `--space-md` inside a `[data-density="reference"]`
 * subtree or inside a portal. Only computed values answer that, which is why
 * this file exists and why the CSS comment points here.
 *
 * Every case asserts the page actually rendered before measuring: a 500 page
 * has computed styles too, and a ratio taken from one would be meaningless.
 */

const FACTORS = { normal: 1, large: 1.125, extra_large: 1.25 } as const;
type Scale = keyof typeof FACTORS;

async function setScale(page: Page, displayScale: Scale) {
  const response = await page.request.patch("/api/user/preferences", { data: { displayScale } });
  expect(response.status(), `PATCH displayScale=${displayScale}`).toBe(200);
}

/**
 * The resolved length of `--space-md` on `selector`, in px.
 *
 * `:visible` is load-bearing, not tidiness: `MobileAppHandoff` renders its own
 * `<main data-density="reference">` into every protected page and is hidden
 * above 1024, so a bare `main` or `[data-density]` selector can measure the
 * replacement app instead of the shell under test.
 */
async function spaceMd(page: Page, selector: string): Promise<number> {
  await expect(page.locator(selector), `exactly one visible ${selector}`).toHaveCount(1);
  const value = await page.locator(selector).evaluate((element) => {
    const resolved = getComputedStyle(element).getPropertyValue("--space-md").trim();
    // A rem value resolves against the root font size; return px either way.
    const probe = document.createElement("div");
    probe.style.width = resolved;
    document.body.appendChild(probe);
    const px = probe.getBoundingClientRect().width;
    probe.remove();
    return px;
  });
  expect(value, `--space-md on ${selector} must resolve to a positive length`).toBeGreaterThan(0);
  return value;
}

test.describe("display scale", () => {
  // A fresh account per test: the preference is per-user server state, so two
  // cases sharing one account would leak the scale one set into the other.
  test.beforeEach(async ({ page }, testInfo) => {
    const email = `e2e_scale_${Date.now()}_${testInfo.workerIndex}_${testInfo.testId}@example.com`;
    await page.goto("/en/register");
    await registerViaUi(page, { name: "E2E Scale Tester", email, password: "password123" });
    await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15000 });
  });

  test("scales the (app) shell, the reference subtree and a portal by the same factor", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const measurements: Record<Scale, { app: number; reference: number; dialog: number }> = {} as never;

    for (const scale of Object.keys(FACTORS) as Scale[]) {
      await setScale(page, scale);

      // (a) the (app) shell.
      await page.goto("/en/dashboard");
      await expect(page.locator("main:visible")).toBeVisible();
      const app = await spaceMd(page, ":root");

      // (b) an (immersive) route, whose layout sets data-density="reference".
      await page.goto("/en/journal");
      const referenceValue = await spaceMd(page, '[data-density="reference"]:visible');

      // (c) a portal: the dialog renders outside the page subtree but inside
      // <html>, which is the reason the scale lives on <html> at all.
      await page.goto("/en/settings/privacy");
      await page.getByRole("button", { name: "Review deletion" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const dialogValue = await spaceMd(page, '[role="dialog"]:visible');

      measurements[scale] = { app, reference: referenceValue, dialog: dialogValue };
    }

    // The reference subtree holds density at 1.0 but must still obey the
    // scale, so all three surfaces move by the same ratio.
    for (const scale of ["large", "extra_large"] as const) {
      for (const surface of ["app", "reference", "dialog"] as const) {
        const ratio = measurements[scale][surface] / measurements.normal[surface];
        expect(ratio, `${surface} at ${scale}`).toBeCloseTo(FACTORS[scale], 2);
      }
    }

    // A control: at `normal` the reference subtree is held at 1.0 while the
    // fluid shell is not, so these two must NOT be equal at 1280 — otherwise
    // every ratio above could be comparing a surface with itself.
    expect(measurements.normal.reference).not.toBeCloseTo(measurements.normal.app, 2);
  });

  test("extra_large does not introduce horizontal scrolling on the owner's viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 529 });
    await setScale(page, "extra_large");

    await page.goto("/en/dashboard");
    await expect(page.locator("main:visible")).toBeVisible();

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    await setScale(page, "normal");
  });
});
