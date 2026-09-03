import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { SiteHeader } from "./site-header";
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
  it("hands the narrow viewport a menu, and no longer a pair of store links", async () => {
    // ⚠️ THIS REVERSES A RULING, deliberately. On 2026-08-28 the user ruled
    // that below `md` there would be no hamburger and a phone visitor would be
    // sent to the app stores instead; that is what this test used to pin. On
    // 2026-09-03 they designed the mobile header themselves (Figma `433:1442`,
    // menu `434:1453`) as a wordmark plus a hamburger. The stores keep their
    // two blocks in the FOOTER, so nothing was lost — only moved.
    const { container } = render(await SiteHeader());

    expect(container.querySelectorAll("[data-store-link]")).toHaveLength(0);

    const toggle = container.querySelector("[data-menu-toggle]");
    if (!toggle) throw new Error("the header rendered no menu toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // It stands in for the nav at exactly the widths the nav is hidden at —
    // one breakpoint decides both, or the two disagree at some width.
    expect(toggle.parentElement?.className ?? "").toContain("md:hidden");
  });

  it("renders one set of destinations, in the bar and in the sheet", async () => {
    // CLAUDE.md §6. `NAV_ITEMS` is the one home for the marketing IA; the
    // desktop row and the mobile sheet both read it. A second list would drift
    // silently, because no viewport renders both at once.
    const { container } = render(await SiteHeader());

    const href = (nodes: Iterable<Element>) =>
      Array.from(nodes, (a) => a.getAttribute("href"));
    const bar = href(container.querySelectorAll("a[data-nav-item]"));
    const sheet = href(container.querySelectorAll("a[data-menu-item]"));

    expect(bar).toHaveLength(EXPECTED_LINKS.length);
    expect(sheet).toEqual(bar);
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

  it("aligns its bar on the same measure the marketing sections use", async () => {
    // Task 12. If the header kept `Container`'s app-wide max width while the
    // sections moved to the marketing one, the wordmark would no longer sit
    // over the content it labels — a 52px misalignment at 1280.
    const { container } = render(await SiteHeader());

    // The BAR's own row, not a count of every box on the measure: the mobile
    // sheet is on it too, which is the point — its rows have to line up under
    // the wordmark the bar puts there.
    const bar = container.querySelector("header")?.firstElementChild;
    expect(bar?.className.split(/\s+/)).toContain("max-w-marketing");
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
