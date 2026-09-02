import { test, expect } from "@playwright/test";
import en from "../../messages/en/marketing.json";

/**
 * `/` — the landing page, end to end (spec §2, plan task 12).
 *
 * ## Why this file derives its copy
 *
 * It used to be `home.spec.ts` and it retyped five English strings. Every one
 * of them had since been re-voiced by the project owner in
 * `messages/en/marketing.json`, so all three of its tests were RED on this
 * branch and nobody had noticed — the e2e suite had not been run while the nine
 * sections were built. Task 9b settled the same question for the unit tests:
 * **routes, roles and DOM contracts are pinned literally because they are the
 * rulings; the WORDING is read from the catalog, because the owner re-voices it
 * whenever they like and a test that retypes it goes red on a copy pass that
 * broke nothing.**
 *
 * ⚠️ Do not "fix" a failure here by retyping a string from the page.
 */

/** Frame 347:6277's order (spec §11 ruling 1). This IS the ruling — pinned literally. */
const SECTION_IDS = [
  "hero",
  "problem",
  "journey",
  "pitch",
  "recommend",
  "chain",
  "trust",
  "cta",
  "signoff",
] as const;

const sectionIds = (page: import("@playwright/test").Page) =>
  page.locator("main section[id]").evaluateAll((nodes) => nodes.map((n) => n.id));

test.describe("landing page", () => {
  test("renders all nine sections in the frame's order", async ({ page }) => {
    await page.goto("/en");

    // A pattern-gathered collection must be constrained in SIZE as well as
    // content, or an empty match passes unconditionally (CLAUDE.md §7).
    expect(SECTION_IDS).toHaveLength(9);
    expect(await sectionIds(page)).toEqual([...SECTION_IDS]);
  });

  test("renders the same nine sections in Vietnamese", async ({ page }) => {
    // The Vietnamese copy is the owner's and is not asserted here; what must
    // hold in both locales is the STRUCTURE.
    await page.goto("/vi");

    expect(await sectionIds(page)).toEqual([...SECTION_IDS]);
  });

  test("has exactly one h1, and it is the hero's", async ({ page }) => {
    await page.goto("/en");

    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText(en.hero.heading);
  });

  test("renders the hero's copy and both of its calls to action", async ({
    page,
  }) => {
    await page.goto("/en");

    // Scoped to <main>: the header and footer carry their own "Start learning".
    const main = page.getByRole("main");
    await expect(main.getByText(en.hero.subtitle)).toBeVisible();
    await expect(
      main.getByRole("link", { name: en.hero.cta }).first(),
    ).toBeVisible();
    await expect(
      main.getByRole("link", { name: en.hero.ctaSecondary }).first(),
    ).toBeVisible();

    // "Start free trial" implied a time-limited trial the product does not have
    // (spec §9.1; docs/product/business-model.md — single tier, no trial,
    // conversion is Contextual Discovery). Pin the false claim's ABSENCE.
    await expect(
      main.getByRole("link", { name: /free trial/i }),
    ).toHaveCount(0);
  });

  test("renders the nav and the footer as chrome outside main", async ({
    page,
  }) => {
    await page.goto("/en");

    const header = page.getByRole("banner");
    await expect(
      header.getByRole("navigation", { name: en.nav.ariaLabel }),
    ).toBeVisible();
    await expect(
      header.getByRole("link", { name: en.nav.wordmark, exact: true }),
    ).toHaveAttribute("href", "/en");
    await expect(
      header.getByRole("link", { name: en.nav.signIn }),
    ).toHaveAttribute("href", "/en/login");
    await expect(
      header.getByRole("link", { name: en.nav.cta }),
    ).toHaveAttribute("href", "/en/register");
    // P14: email + Google + Apple. GitHub was ruled out.
    await expect(header.getByText(/github/i)).toHaveCount(0);

    const footer = page.getByRole("contentinfo");
    await expect(footer).toBeVisible();
    await expect(
      footer.getByText(
        en.footer.copyright.replace("{year}", String(new Date().getFullYear())),
      ),
    ).toBeVisible();
  });

  test("is reachable by keyboard from the top", async ({ page }) => {
    await page.goto("/en");
    await page.keyboard.press("Tab");

    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBe("A");
  });

  test("lands an anchored section's heading clear of the sticky header", async ({
    page,
  }) => {
    // Task 11 review M1, as an OUTCOME rather than the class-presence guard the
    // jsdom suite is limited to: this environment loads no CSS, so only a real
    // browser can assert the geometry. §8 is the case that exposed it — the
    // first section with no eyebrow to absorb the offset, so its <h2> (the
    // section's accessible name) is what lands under the bar.
    await page.goto("/en#cta");

    const headerBottom = await page
      .getByRole("banner")
      .evaluate((el) => el.getBoundingClientRect().bottom);
    const headingTop = await page
      .locator("#cta-heading")
      .evaluate((el) => el.getBoundingClientRect().top);

    expect(headerBottom).toBeGreaterThan(0);
    expect(headingTop).toBeGreaterThan(headerBottom);
  });
});
