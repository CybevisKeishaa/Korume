import { test, expect } from "@playwright/test";
import en from "../../messages/en/marketing.json";
import { REVEAL_FAILSAFE_MS } from "../../components/motion/reveal-failsafe";

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
  /**
   * WCAG 1.4.10 Reflow: no horizontal scrolling at 320 CSS px (CLAUDE.md §2
   * rule 5). Task 13's central guard, and the reason it needed re-aiming
   * twice.
   *
   * ⚠️ HOW TO READ A FAILURE, because two audits and this file's own run-state
   * got it wrong. `getBoundingClientRect().right > clientWidth` CANNOT see the
   * offender that actually caused this: a text run overflowing its own box does
   * not move that box's rect, so right-edge filtering returns a wall of
   * irrelevant `LI`s inside `#journey`'s scroll container while the hero `h1`
   * stays invisible to it. The failure message below is built from a `Range`
   * over TEXT NODES plus an ancestor `overflow-x` walk, so it names the run,
   * not a box that happens to sit near the edge.
   *
   * ⚠️ It also asserts the page RENDERED. A blank page, a 500, or a dev server
   * whose workers have died all have `scrollWidth === clientWidth` at every
   * width — "no overflow" is exactly what broken looks like, and this guard was
   * unconditionally green against a dead server before that check existed.
   */
  test("never scrolls horizontally, at any width, in either locale", async ({
    page,
  }) => {
    // Eighteen navigations in one test. Alone it finishes in ~8s; against the
    // one `next dev` this suite shares between five parallel workers it went
    // past the 30s default. The sweep's breadth is the whole point — a number
    // derived at one width is a guess at every other — so the budget moves,
    // not the sample.
    test.slow();

    // 320 is the WCAG floor; 414 is the control that proved the hero `h1` was
    // the offender (the run is 390.5px wide and clears the viewport there
    // without changing size); 768 is where the footer's email token bites.
    const widths = [320, 360, 390, 414, 480, 640, 768, 1024, 1280];
    const locales = ["en", "vi"] as const;
    const samples: Array<{ where: string; over: number; offenders: string[] }> = [];

    for (const locale of locales) {
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/${locale}`);
        // Non-negotiable: "no overflow" on an unrendered page is a false green.
        await expect(page.locator("main section[id]")).toHaveCount(9);

        samples.push({
          where: `${locale} @${width}`,
          ...(await page.evaluate(() => {
            const docWidth = document.documentElement.clientWidth;

            /** The nearest ancestor that CONTAINS overflow, if any. */
            const clipped = (node: Node) => {
              let el: Element | null =
                node instanceof Element ? node : node.parentElement;
              while (el && el !== document.documentElement) {
                if (getComputedStyle(el).overflowX !== "visible") return true;
                el = el.parentElement;
              }
              return false;
            };

            const name = (el: Element | null) => {
              if (!el) return "?";
              const id = el.id ? `#${el.id}` : "";
              const cls = (el.getAttribute("class") ?? "")
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .join(".");
              return `${el.tagName.toLowerCase()}${id}${cls ? `.${cls}` : ""}`;
            };

            const offenders = new Set<string>();
            const walker = document.createTreeWalker(
              document.body,
              NodeFilter.SHOW_TEXT,
            );
            for (let n = walker.nextNode(); n; n = walker.nextNode()) {
              if (!n.textContent?.trim() || clipped(n)) continue;
              const range = document.createRange();
              range.selectNodeContents(n);
              for (const rect of range.getClientRects()) {
                if (rect.width === 0 || rect.right <= docWidth + 0.5) continue;
                offenders.add(
                  `${name(n.parentElement)} "${n.textContent.trim().slice(0, 24)}" +${(rect.right - docWidth).toFixed(1)}`,
                );
              }
            }
            for (const el of document.querySelectorAll("body *")) {
              const rect = el.getBoundingClientRect();
              if (rect.width === 0 || rect.right <= docWidth + 0.5) continue;
              if (clipped(el.parentElement ?? el)) continue;
              offenders.add(
                `${name(el)} (box) +${(rect.right - docWidth).toFixed(1)}`,
              );
            }

            return {
              over: document.documentElement.scrollWidth - docWidth,
              offenders: [...offenders],
            };
          })),
        });
      }
    }

    // L-004: the sweep is gathered by a loop, so pin its size — a short sweep
    // would pass this test without measuring anything.
    expect(samples, "viewport/locale samples").toHaveLength(
      widths.length * locales.length,
    );

    const scrolling = samples.filter((s) => s.over > 0);
    expect(
      scrolling,
      `the page scrolls horizontally at: ${scrolling
        .map((s) => `${s.where} by ${s.over}px [${s.offenders.join(" · ")}]`)
        .join(" — ")}`,
    ).toEqual([]);
  });

  /**
   * §3's card row is the one place on the page that is WIDER than the viewport
   * on purpose, and the ledger owed this assertion from task A2.
   *
   * ⚠️ Two facts, and the second is the one that is easy to lose. The row
   * CONTAINS its overflow (`overflow-x: auto`), which is why it never reached
   * the page — and for a long time this row was blamed for the page overflow
   * that the hero `h1` was actually causing. But a region you can only reach
   * by scrolling sideways must also be reachable WITHOUT a mouse (WCAG 2.1.1);
   * browsers make a scrollable box focusable for exactly that reason, and a
   * refactor to `overflow-x: clip` or a wrapper that hides the overflow would
   * keep this row looking right while silently making two of its five cards
   * unreachable by keyboard.
   */
  test("keeps §3's card row self-contained and still reachable by keyboard", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/en");
    await expect(page.locator("main section[id]")).toHaveCount(9);

    const row = page.locator("#journey ol");
    const measured = await row.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      overflowX: getComputedStyle(el).overflowX,
    }));

    // It really is overflowing — otherwise "contains its overflow" is a claim
    // about nothing, and this test would pass on an empty row.
    expect(measured.scrollWidth).toBeGreaterThan(measured.clientWidth);
    expect(measured.overflowX).toBe("auto");

    // And the overflow stops there rather than reaching the page.
    const section = await page
      .locator("#journey")
      .evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
    expect(section.scrollWidth).toBe(section.clientWidth);

    // WCAG 2.1.1: the cards past the fold must be reachable without a mouse.
    const reachable = await row.evaluate((el) => {
      el.focus();
      if (document.activeElement !== el) return { focusable: false, scrolled: 0 };
      const before = el.scrollLeft;
      el.scrollLeft = el.scrollWidth;
      return { focusable: true, scrolled: el.scrollLeft - before };
    });
    expect(reachable.focusable).toBe(true);
    expect(reachable.scrolled).toBeGreaterThan(0);
  });

  /**
   * §3's two Japanese sentence lines must keep a long token INSIDE their panel.
   *
   * The ledger carried this from task A2 as "no `break-words`, so a single
   * unbreakable token overflows the panel (276px inside 105px)". With today's
   * copy it does not reproduce at any width in either locale — the panels are
   * ~86px and the widest rendered line is 67px — but the latent rule is still
   * wrong: `overflow-wrap` is `normal`, so the FIRST long token anyone writes
   * escapes. Card 4's own comment already promises the opposite ("forcing
   * nowrap would make a longer fragment overflow the card, which is the class
   * of bug this fix round exists to remove"), and a promise the CSS does not
   * keep is worse than no promise.
   *
   * So the token is injected rather than waited for. This asserts the RULE,
   * which is what the comment claims, not today's copy, which happens to be
   * short enough.
   */
  test("keeps a long unbreakable token inside §3's sentence panels", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/en");
    await expect(page.locator("main section[id]")).toHaveCount(9);

    const lines = page.locator("#journey [data-step] p.font-jp");
    // The pair the ledger names: card 2's line and card 4's. Pinned, so a
    // refactor that drops one cannot quietly halve what this covers.
    await expect(lines).toHaveCount(2);

    const spills = await lines.evaluateAll((nodes) =>
      nodes.map((node, i) => {
        const original = node.textContent;
        // ⚠️ LATIN, deliberately. The first version of this used a long kana
        // run and passed on the spot — Japanese breaks BETWEEN characters, so
        // a kana run is not an unbreakable token at all and proved nothing.
        // The tokens that actually escape are the ones with no break
        // opportunity: romaji, a URL, an address.
        node.textContent = "omottayorimotottemoyasuikaimonodesune";
        const range = document.createRange();
        range.selectNodeContents(node);
        const widest = [...range.getClientRects()].reduce(
          (a, b) => Math.max(a, b.width),
          0,
        );
        const box = node.getBoundingClientRect().width;
        node.textContent = original;
        return { i, box: +box.toFixed(1), widest: +widest.toFixed(1) };
      }),
    );

    const escaped = spills.filter((s) => s.widest > s.box + 0.5);
    expect(
      escaped,
      `a long token left its panel at: ${escaped
        .map((s) => `line ${s.i} — ${s.widest} in ${s.box}`)
        .join(" · ")}`,
    ).toEqual([]);
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

/**
 * The motion layer (Task A-MOTION), and the one claim the whole architecture
 * rests on: no reader can end up looking at content held at `opacity: 0`.
 *
 * The hidden state is gated on `:root[data-reduce-motion="false"]`, which
 * themeInitScript sets before paint and only when JS ran. That one selector is
 * supposed to cover all three cases below — so all three are measured, not
 * reasoned about.
 *
 * ⚠️ Every case asserts nine sections FIRST. A dead dev server serves a 500
 * page, which has no hidden content either, so a sweep that skips this check
 * goes green while measuring nothing.
 */
test.describe("motion never hides content", () => {
  test.slow();

  const PARTS = "[data-eyebrow], [data-section-heading], [data-section-body], [data-section-showcase]";

  for (const width of [320, 390, 768, 1280]) {
    test(`renders every section opaque under reduce-motion at ${width}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/en");

      await expect(page.locator("main section[id]")).toHaveCount(9);

      const opacities = await page.locator(`main section[id] :is(${PARTS})`).evaluateAll((nodes) =>
        nodes.map((n) => Number(getComputedStyle(n).opacity)),
      );
      expect(opacities.length).toBeGreaterThanOrEqual(9);
      expect(opacities.filter((o) => o !== 1)).toEqual([]);

      // Review fix round 1 (I3b): task 4's two new mechanisms — §5's donut
      // sweep and the thread's first segment — hide via `stroke-dashoffset`,
      // not opacity, and nothing above samples that dimension. A dropped
      // colour declaration (the `hsl()` defect this branch shipped once) is
      // invisible to an opacity check too: the element is fully "revealed"
      // and simply has no visible stroke.
      //
      // ⚠️ Review fix round 2: the first version of this sampled BOTH
      // selectors into one collection and asserted only
      // `strokes.length >= 2` — which is exactly satisfied by the two donut
      // arcs alone. If the thread segment vanished from the DOM entirely
      // (attribute renamed, component unmounted), that lower bound would
      // still hold and the assertions below would silently stop checking the
      // thread segment at all — the L-004 failure the original comment here
      // claimed to prevent but did not enforce. Split into two locators, each
      // pinned to its OWN exact/minimum count, so losing either kind fails on
      // its own line and names itself rather than hiding inside a combined
      // total.
      const sampleStrokes = (nodes: Element[]) =>
        nodes.map((n) => {
          const cs = getComputedStyle(n);
          return { dashoffset: cs.strokeDashoffset, stroke: cs.stroke };
        });

      const arcs = await page.locator("[data-familiar-arc]").evaluateAll(sampleStrokes);
      expect(arcs).toHaveLength(2);
      expect(arcs.filter((s) => s.dashoffset !== "0px")).toEqual([]);
      expect(arcs.filter((s) => s.stroke === "none")).toEqual([]);

      const threadPaths = await page
        .locator("[data-thread-segment] path")
        .evaluateAll(sampleStrokes);
      expect(threadPaths.length).toBeGreaterThanOrEqual(1);
      expect(threadPaths.filter((s) => s.dashoffset !== "0px")).toEqual([]);
      expect(threadPaths.filter((s) => s.stroke === "none")).toEqual([]);
    });
  }

  test("renders every section opaque with JavaScript disabled", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/en");

    await expect(page.locator("main section[id]")).toHaveCount(9);

    const opacities = await page
      .locator("main section[id] [data-section-heading]")
      .evaluateAll((nodes) => nodes.map((n) => Number(getComputedStyle(n).opacity)));
    expect(opacities).toHaveLength(9);
    expect(opacities.filter((o) => o !== 1)).toEqual([]);

    await context.close();
  });

  test("leaves nothing hidden after a reader scrolls the whole page", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/en");

    await expect(page.locator("main section[id]")).toHaveCount(9);

    for (const id of ["problem", "journey", "pitch", "recommend", "chain", "trust", "cta", "signoff"]) {
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
    }
    // Long enough for the slowest chain: §4's overall score waits 1.5x the
    // cinematic duration.
    await page.waitForTimeout(2500);

    const hidden = await page
      .locator(
        `main :is(${PARTS}, [data-chip], [data-step], [data-trust-card], [data-chain-node] > *, [data-subscore], [data-score-overall])`,
      )
      .evaluateAll((nodes) =>
        nodes.filter((n) => Number(getComputedStyle(n).opacity) !== 1).length,
      );
    expect(hidden).toBe(0);
  });

  test("renders every section opaque when the client bundle never arrives", async ({
    page,
  }) => {
    // The case the three above cannot reach. JS is ENABLED, so themeInitScript
    // runs — it is inline in <head>, outside the bundle — and arms the hidden
    // state. But `RevealScope` ships in the bundle, so if the bundle does not
    // execute, nothing flips `pending` to `in`. Without the inline failsafe the
    // whole page stays at opacity 0 for good.
    await page.route("**/_next/static/chunks/**", (route) => route.abort());

    await page.setViewportSize({ width: 1280, height: 900 });
    // `commit`, so the observation below starts as early as the document does.
    await page.goto("/en", { waitUntil: "commit" });

    // ⚠️ BOTH halves are measured INSIDE THE PAGE, in one evaluate, and this is
    // load-bearing rather than tidiness. The armed state is TRANSIENT — it ends
    // when the failsafe fires — so measuring it with a Playwright round-trip
    // races that window, and under parallel workers the round-trip loses:
    // measured, the control read `hidden: 0` not because the page was never
    // armed but because it had already been released before the assertion
    // arrived. An in-page observer starts at the first frame the headings
    // exist and cannot be outrun by scheduling.
    //
    // What each field is for:
    //   total            — nine headings exist, so this is not the 500 page
    //                      that would give every test in this describe a free
    //                      pass (a dead server has no hidden content either);
    //   hiddenAtFirstSight — the POSITIVE CONTROL. All nine were actually at
    //                      opacity 0, so the release below is a real release.
    //                      Without it, a build that stopped ARMING the hidden
    //                      state would sail through having measured nothing
    //                      (L-004);
    //   releasedAfterMs  — the failsafe fired and the page came back.
    const observed = await page.evaluate(
      ({ budgetMs }) =>
        new Promise<{ total: number; hiddenAtFirstSight: number; releasedAfterMs: number | null }>(
          (resolve) => {
            const SELECTOR = "main section[id] [data-section-heading]";
            const t0 = performance.now();
            let hiddenAtFirstSight: number | null = null;
            let total = 0;
            const opacityOf = (n: Element) => Number(getComputedStyle(n).opacity);

            const tick = () => {
              const nodes = [...document.querySelectorAll(SELECTOR)];
              // ⚠️ Only sample once all nine have PARSED. `waitUntil: "commit"`
              // starts this observer while the document is still streaming, so
              // the first frame that has any headings has only some of them —
              // measured, 5 of 9 — and reading the control there compares a
              // partial page against a whole one.
              if (nodes.length >= 9) {
                total = nodes.length;
                const hidden = nodes.filter((n) => opacityOf(n) === 0).length;
                if (hiddenAtFirstSight === null) hiddenAtFirstSight = hidden;
                if (nodes.every((n) => opacityOf(n) === 1)) {
                  resolve({
                    total,
                    hiddenAtFirstSight: hiddenAtFirstSight ?? -1,
                    releasedAfterMs: Math.round(performance.now() - t0),
                  });
                  return;
                }
              }
              if (performance.now() - t0 > budgetMs) {
                resolve({ total, hiddenAtFirstSight: hiddenAtFirstSight ?? -1, releasedAfterMs: null });
                return;
              }
              requestAnimationFrame(tick);
            };
            tick();
          },
        ),
      { budgetMs: REVEAL_FAILSAFE_MS + 5000 },
    );

    expect(observed.total, "nine headings rendered").toBe(9);
    expect(observed.hiddenAtFirstSight, "all nine were armed hidden before the release").toBe(9);
    expect(observed.releasedAfterMs, "the failsafe released the page").not.toBeNull();
  });
});
