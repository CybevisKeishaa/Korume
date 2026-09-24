import { test, expect } from "@playwright/test";
import { APP_STORE_URL, PLAY_STORE_URL } from "../../lib/app-stores";

/**
 * The screen a phone actually gets, at the widths a phone actually has.
 *
 * `app/[locale]/layout.tsx` renders `MobileAppHandoff` above every route group
 * and `app/globals.css` hides `[data-desktop-web]` below 1024 (`0014ea2`,
 * 2026-09-09, the owner's ruling): a phone never sees the landing page or the
 * app, it sees the store handoff. So this is not a marketing-page variant —
 * below 1024 it is the ONLY thing this site renders, on every route.
 *
 * ⚠️ WHY THIS FILE EXISTS. `landing-page.spec.ts`'s horizontal-scroll sweep
 * used to run [320, 360, 390, 414, 480, 640, 768, 1024, 1280]. Seven of those
 * nine widths were below the gate, so as *landing-page* assertions they were
 * measuring a `display: none` subtree — which is why they moved up. But they
 * were not measuring NOTHING: `documentElement.scrollWidth` measures whatever
 * is painted, and below 1024 what is painted is this screen. Moving them up
 * without replacing them would have left `AGENTS.md` §2 rule 5 — WCAG 1.4.10,
 * no horizontal scrolling at 320 CSS px — unguarded across the whole repo, for
 * the one screen most of our visitors will see. Caught in this branch's own
 * whole-branch review; the guard is RESAMPLED here rather than left as a
 * sentence in a commit message — four of the seven old widths survive
 * (320/390/480/768), 360/414/640 are dropped as redundant neighbours, and
 * 1023 is new so the sweep reaches the last width before the gate flips.
 *
 * The landing page's own sweep is the sibling of this one and starts where
 * this one stops, at `LANDING_MIN_WIDTH`.
 */

/** 320 is the WCAG floor; 1023 is the last width before the gate flips. */
const PHONE_WIDTHS = [320, 390, 480, 768, 1023];

test.describe("mobile app handoff", () => {
  test.slow();

  test("never scrolls horizontally, at any phone width, in either locale", async ({
    page,
  }) => {
    const samples: Array<{ where: string; over: number }> = [];

    for (const locale of ["en", "vi"] as const) {
      for (const width of PHONE_WIDTHS) {
        await page.setViewportSize({ width, height: 844 });
        // `domcontentloaded`, not the default `load`. The cause is specific
        // and was measured, not guessed (`L-013`): at **1023** — the one width
        // this sweep adds above the phone range — `load` never fires, because
        // the landing page's hero still carries `priority`, so Next emits a
        // preload for `/_next/image?...hero-still.png&w=1080` and the browser
        // fetches it even though the whole desktop tree is `display: none`.
        // Cold, that optimisation outlives any sane timeout; warm it is ~0.5s.
        // At 320 and 1280 `load` fires in ~130ms. An earlier version of this
        // comment blamed parallel workers, which is the wrong diagnosis for a
        // deterministic, width-specific hang.
        //
        // ▶ Worth knowing on its own: every phone visitor pays for a ~400 KB
        // image belonging to a page they never see. Not this branch's to fix.
        await page.goto(`/${locale}`, { waitUntil: "domcontentloaded" });

        // The subject is on screen and the other one is not. Without this the
        // measurement is the false green that produced this file: a page that
        // renders nothing has `scrollWidth === clientWidth` too, and so does
        // one where the gate silently stopped working and the (hidden)
        // landing page is what the numbers describe.
        await expect(page.locator(".mobile-app-handoff")).toBeVisible();
        // `toHaveCount(1)` FIRST: `toBeHidden()` also passes when the element
        // does not exist, and a guard whose entire subject is "present versus
        // laid out" must not be unable to tell hidden from gone.
        await expect(page.locator("[data-desktop-web]")).toHaveCount(1);
        await expect(page.locator("[data-desktop-web]")).toBeHidden();

        // `domcontentloaded` above means the display font may not have landed;
        // `toBeVisible()` waits for a box, not for font swap, and all five
        // faces are `font-display: swap` with the display face unpreloaded. A
        // width measured mid-swap is a width no reader ever sees.
        await page.evaluate(() => document.fonts.ready);

        samples.push({
          where: `${locale} @${width}`,
          ...(await page.evaluate(() => ({
            over:
              document.documentElement.scrollWidth -
              document.documentElement.clientWidth,
          }))),
        });
      }
    }

    // ⚠️ A LITERAL, not `PHONE_WIDTHS.length * 2`. That was the first version
    // and it is L-006 verbatim: a threshold derived from the list it guards
    // shrinks along with it, so cutting the sweep to one width left the pin
    // green while it measured a fifth of what it claims. It could only ever
    // have failed if the loop threw, which fails the test anyway.
    expect(samples, "viewport/locale samples").toHaveLength(10);
    // And the WCAG floor specifically — 320 is the width `AGENTS.md` §2 rule 5
    // names, and a literal count alone does not say it is still in the list.
    expect(PHONE_WIDTHS).toContain(320);

    const scrolling = samples.filter((s) => s.over > 0);
    expect(
      scrolling,
      `the page scrolls horizontally at: ${scrolling
        .map((s) => `${s.where} by ${s.over}px`)
        .join(" — ")}`,
    ).toEqual([]);
  });

  test("puts both store links in the tab order at the WCAG floor", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto("/en");
    await expect(page.locator(".mobile-app-handoff")).toBeVisible();

    // The handoff's whole job is these two links, and they must be reachable
    // by Tab rather than by `focus()` — L-004 records twice that programmatic
    // focus claims strictly less than sequential navigation does.
    //
    // Scoped by the class rather than by role, deliberately: `.mobile-app-handoff`
    // is the CSS gate's own hook (`globals.css`), so scoping to it means this
    // test and the gate cannot disagree about which subtree is the subject.
    const links = page.locator(".mobile-app-handoff a");
    await expect(links).toHaveCount(2);

    // ⚠️ DE-DUPLICATED, and that is the whole assertion. The first version of
    // this test collected hrefs into a list and asserted `toHaveLength(2)`.
    // At 320 these two anchors are the page's ONLY focusable elements, so Tab
    // wraps through `<body>` and returns to the first one: with the second
    // link taken out of the tab order the list still filled to two — the same
    // href twice — and the test passed. It was vacuous for the exact mutation
    // it existed to catch, and it passed on its first run, which
    // `docs/lessons.md` L-004 says to treat as a defect until disproved.
    // Caught by the L-012 review of the wave that added it.
    //
    // Asserting the SET, in DOM order, also makes the test name the links it
    // means instead of counting anonymous stops.
    const reached: string[] = [];
    for (let i = 0; i < 6 && new Set(reached).size < 2; i += 1) {
      await page.keyboard.press("Tab");
      const href = await page.evaluate(() => {
        const el = document.activeElement;
        return el instanceof HTMLAnchorElement && el.closest(".mobile-app-handoff")
          ? el.href
          : null;
      });
      if (href) reached.push(href);
    }
    expect([...new Set(reached)]).toEqual([APP_STORE_URL, PLAY_STORE_URL]);
  });
});
