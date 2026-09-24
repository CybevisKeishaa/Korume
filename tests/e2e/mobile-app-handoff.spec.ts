import { test, expect } from "@playwright/test";

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
 * whole-branch review; the guard is restored here rather than left as a
 * sentence in a commit message.
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
        // `domcontentloaded`, not the default `load`: under parallel workers a
        // sweep this long waits on subresources it does not measure and dies
        // on the timeout instead of reporting a width. The two assertions
        // below are what make the page ready, and they wait on their own.
        await page.goto(`/${locale}`, { waitUntil: "domcontentloaded" });

        // The subject is on screen and the other one is not. Without this the
        // measurement is the false green that produced this file: a page that
        // renders nothing has `scrollWidth === clientWidth` too, and so does
        // one where the gate silently stopped working and the (hidden)
        // landing page is what the numbers describe.
        await expect(page.locator(".mobile-app-handoff")).toBeVisible();
        await expect(page.locator("[data-desktop-web]")).toBeHidden();

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

    // L-004: the sweep is gathered by a loop, so pin its size — a short sweep
    // passes this test without measuring anything.
    expect(samples, "viewport/locale samples").toHaveLength(
      PHONE_WIDTHS.length * 2,
    );

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

    // The handoff's whole job is these two links. `getByRole` rather than a
    // class, and reachable by Tab rather than by `focus()` — L-004 records
    // that programmatic focus claims less than sequential navigation does.
    const links = page.locator(".mobile-app-handoff a");
    await expect(links).toHaveCount(2);

    const reached: string[] = [];
    for (let i = 0; i < 6 && reached.length < 2; i += 1) {
      await page.keyboard.press("Tab");
      const href = await page.evaluate(() =>
        document.activeElement?.closest(".mobile-app-handoff")
          ? (document.activeElement as HTMLAnchorElement).href
          : null,
      );
      if (href) reached.push(href);
    }
    expect(reached).toHaveLength(2);
  });
});
