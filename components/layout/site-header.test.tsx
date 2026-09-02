import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { SiteHeader } from "./site-header";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/app-stores";
import en from "@/messages/en/marketing.json";

/**
 * The six marketing nav destinations, ruled by the user 2026-08-27 (spec §2.2).
 *
 * ⚠️ The KEY and the HREF are pinned literally — they are the ruling, and a
 * route silently changing is exactly what this test exists to catch. The LABEL
 * is read from the catalog instead of retyped: the project owner re-voices the
 * English copy directly in `messages/en/marketing.json`, and a test that
 * retypes a label goes red on a copy pass that broke nothing. That is not a
 * hypothetical — the 2026-09-01 pass renamed `nav.ariaLabel` and `nav.cta`
 * and turned this file red while the component was still correct.
 */
const EXPECTED_LINKS: ReadonlyArray<readonly [keyof typeof en.nav, string]> = [
  ["explore", "/en/shadowing/explore"],
  ["shadowing", "/en/shadowing"],
  ["kanji", "/en/kanji"],
  ["grammar", "/en/grammar"],
  ["practice", "/en/review"],
  ["companion", "/en/companion"],
];

describe("SiteHeader", () => {
  it("sends narrow viewports to the app stores, standing in for the hidden nav", async () => {
    // User ruling, 2026-08-28: below `md` there is no hamburger; the stores
    // are where a phone visitor goes instead.
    const { container } = render(await SiteHeader());

    const storeLinks = Array.from(container.querySelectorAll("[data-store-link]"));
    expect(storeLinks).toHaveLength(2);
    expect(storeLinks.map((a) => a.getAttribute("href"))).toEqual([
      APP_STORE_URL,
      PLAY_STORE_URL,
    ]);
    for (const link of storeLinks) {
      expect(link.getAttribute("target")).toBe("_blank");
      // `noopener` is what stops the opened page reaching back through
      // `window.opener`.
      expect(link.getAttribute("rel") ?? "").toContain("noopener");
    }
    // They exist for the viewport the six-link nav is hidden at, and must not
    // double up with it above that breakpoint.
    const group = storeLinks[0]?.parentElement;
    expect(group?.className ?? "").toContain("md:hidden");
  });

  it("renders exactly the six ruled marketing nav destinations", async () => {
    render(await SiteHeader());

    const nav = screen.getByRole("navigation", { name: en.nav.ariaLabel });
    const links = Array.from(nav.querySelectorAll("a[data-nav-item]"));

    expect(links).toHaveLength(EXPECTED_LINKS.length);
    expect(EXPECTED_LINKS).toHaveLength(6);
    expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual(
      EXPECTED_LINKS.map(([key, href]) => [en.nav[key], href]),
    );
  });

  it("offers sign-in and get-started, and never GitHub (P14)", async () => {
    render(await SiteHeader());

    expect(screen.getByRole("link", { name: en.nav.signIn })).toHaveAttribute(
      "href",
      "/en/login",
    );
    expect(screen.getByRole("link", { name: en.nav.cta })).toHaveAttribute(
      "href",
      "/en/register",
    );
    expect(screen.queryByText(/github/i)).toBeNull();
  });

  it("takes its height from the shared layout token that anchored sections clear", async () => {
    // The other half of task 11 review M1. `Section` reserves `scroll-mt-header`
    // so an anchored <h2> does not land under this bar; that reservation is only
    // correct while the bar's height is THE SAME FACT, not a second statement of
    // the same number. `h-16` here plus a 4rem token there is exactly the
    // "both, kept in sync by hand" that CLAUDE.md §6 calls a defect — and it
    // would go wrong silently, because nothing renders both together.
    const { container } = render(await SiteHeader());

    const bar = container.querySelector("header");
    if (!bar) throw new Error("SiteHeader rendered no <header>");
    // The bar is sticky, which is what makes clearance necessary at all.
    expect(bar.className.split(/\s+/)).toContain("sticky");

    const row = bar.firstElementChild;
    if (!row) throw new Error("<header> has no child row to measure");
    const classes = row.className.split(/\s+/);
    expect(classes).toContain("h-header");
    expect(classes).not.toContain("h-16");
  });
});
