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

  test("leaves §7's photograph a readable strip beside the cards", async ({
    page,
  }) => {
    // Task 12. The page measure widened from `max-w-6xl` to
    // `--layout-marketing-max`, which pushed §7's cards from 92.5% of the page
    // to 97.1% and left the photograph a ~37px sliver. The reference draws its
    // three cards at 207..372, 379..543 and 550..714 of an 864-wide page
    // (recorded in trust.tsx's docblock from task 10's reading), so they end at
    // 714/864 = 82.6% — and an independent luminance-edge scan of `346:6275`
    // puts the photograph's READABLE content (the lit window) starting at 88.9%,
    // which 82.6% clears with room. So the invariant is not "the cards are 78%
    // wide" — it is that the photograph is still an image someone can see.
    //
    // Asserted as an OUTCOME in a real browser because the unit suite loads no
    // CSS and cannot measure any of this.
    await page.goto("/en");

    const photo = await page.locator("#trust img").boundingBox();
    const cards = await page.locator("#trust [data-trust-cards]").boundingBox();
    if (!photo || !cards) throw new Error("§7 has no photograph or no card row");

    const clearStrip = photo.x + photo.width - (cards.x + cards.width);
    expect(clearStrip).toBeGreaterThan(150);
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
  test("gives §3's five step cards one width", async ({ page }) => {
    // Geometry, so it belongs here and not in the jsdom suite, which loads no
    // CSS. The defect: every `li` carried the flex basis and shared it with a
    // StepArrow — except the fifth, which renders no arrow and kept the
    // arrow's 16px for its card. Measured 146.51 x4 against 162.51.
    await page.goto("/en");

    const cards = page.locator("#journey [data-step]");
    await expect(cards).toHaveCount(5);

    const widths = await cards.evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().width)),
    );
    // "All equal", not a literal: the width itself legitimately moves with the
    // page width, the thing that must not vary is card-to-card.
    expect(new Set(widths).size, `widths were ${widths.join(", ")}`).toBe(1);
  });

  test("keeps §6's companion standing on the rail", async ({ page }) => {
    // `xl:items-end` is load-bearing and documented: the node grid's bottom
    // edge IS the rail, so bottom-aligning the companion is what puts its orb
    // on the line, exactly as the reference draws it. A refactor to
    // `items-center` looks harmless and lifts the orb off the rail, so the
    // promise is pinned here where a browser can see it.
    await page.goto("/en");

    const mascot = await page.locator("#chain [data-chain-mascot]").boundingBox();
    const node = await page.locator("#chain [data-chain-node]").last().boundingBox();
    if (!mascot || !node) throw new Error("§6's companion or its node grid did not render");

    // 1px, not 0: sub-pixel layout rounding is legitimate, 13px of centring is
    // not. NOTE this measures the IMAGE BOX. Whether the creature reaches the
    // box's bottom edge is a property of the FILE, guarded in
    // `scripts/mascot/poses.test.ts` — an untrimmed pose left a 16px
    // transparent margin and floated the orb 5.1 CSS px above the rail while
    // this assertion stayed green.
    expect(Math.abs(mascot.y + mascot.height - (node.y + node.height))).toBeLessThan(1);
  });

  /**
   * §3's thumbnail `sizes` must cover the WORST case inside each of its
   * branches, not the value at one convenient width.
   *
   * ⚠️ This has now been wrong twice for two different reasons. Fix round m2
   * corrected it from the slot's WIDTH to its HEIGHT — right, because the slot
   * renders taller than it is wide and `object-cover` scales the 16/9 source
   * until its height covers, so the source width needed is `height * 16/9`.
   * But the replacement was still derived at 1280 ALONE, on a docblock premise
   * that the slot is constant "from 1152px up". The container's cap moved
   * (`max-w-6xl` → `max-w-marketing`) and, more to the point, the slot's HEIGHT
   * is not constant across the branch at all: the cards reflow as the row
   * narrows, and a shorter card makes a TALLER image.
   *
   * A number derived at one width, for a media query spanning every width
   * above it, is a guess everywhere else in the branch. This measures the
   * branch.
   */
  test("declares a §3 thumbnail `sizes` that covers its whole branch", async ({ page }) => {
    // Both ends of the `(min-width: 1024px)` branch plus the container cap,
    // and two widths below it so the fallback branch is measured too — in both
    // locales, because the Vietnamese copy wraps differently and so reflows the
    // row at different widths.
    const widths = [768, 896, 1024, 1080, 1120, 1256, 1440];
    const locales = ["en", "vi"] as const;
    const samples: Array<{ where: string; needed: number; declared: number }> = [];

    for (const locale of locales) {
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(`/${locale}`);
        const image = page.locator("#journey img").first();
        await expect(image).toBeVisible();

        const measured = await image.evaluate((node) => {
          const img = node as HTMLImageElement;
          const box = img.getBoundingClientRect();
          // The declared width for THIS viewport: the first matching branch of
          // the `sizes` attribute, read off the element rather than imported,
          // so the test measures what the browser was actually told.
          const declared = (img.getAttribute("sizes") ?? "")
            .split(",")
            .map((clause) => clause.trim())
            .reduce<number | null>((chosen, clause) => {
              if (chosen !== null) return chosen;
              const query = clause.match(/^\((.+)\)\s+(\d+)px$/);
              if (query) return window.matchMedia(`(${query[1]})`).matches ? Number(query[2]) : null;
              const fallback = clause.match(/^(\d+)px$/);
              return fallback ? Number(fallback[1]) : null;
            }, null);
          // `object-cover` on a 16/9 source in a box taller than it is wide:
          // the source is scaled until its HEIGHT covers, then cropped.
          return { height: box.height, width: box.width, declared };
        });

        expect(measured.declared, `a sizes branch matching ${width}px`).not.toBeNull();
        samples.push({
          where: `${locale} @${width}`,
          needed: (measured.height * 16) / 9,
          declared: measured.declared as number,
        });
      }
    }

    // L-004: the collection is gathered by a loop, so pin its size — an empty
    // or short sweep would pass this test without measuring anything.
    expect(samples, "viewport/locale samples").toHaveLength(widths.length * locales.length);

    const short = samples.filter((s) => s.declared < s.needed - 0.5);
    expect(
      short,
      `sizes under-declares at: ${short
        .map((s) => `${s.where} needs ${s.needed.toFixed(1)} declared ${s.declared}`)
        .join(" · ")}`,
    ).toEqual([]);
  });
});
