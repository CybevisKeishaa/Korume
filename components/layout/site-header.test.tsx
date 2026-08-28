import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { SiteHeader } from "./site-header";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/app-stores";

/** The six marketing nav destinations, ruled by the user 2026-08-27 (spec §2.2). */
const EXPECTED_LINKS: ReadonlyArray<readonly [string, string]> = [
  ["Explore", "/en/shadowing/explore"],
  ["Shadowing", "/en/shadowing"],
  ["Kanji", "/en/kanji"],
  ["Grammar", "/en/grammar"],
  ["Practice", "/en/review"],
  ["Companion", "/en/companion"],
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

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const links = Array.from(nav.querySelectorAll("a[data-nav-item]"));

    expect(links).toHaveLength(EXPECTED_LINKS.length);
    expect(EXPECTED_LINKS).toHaveLength(6);
    expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual(
      EXPECTED_LINKS.map(([label, href]) => [label, href]),
    );
  });

  it("offers sign-in and get-started, and never GitHub (P14)", async () => {
    render(await SiteHeader());

    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/en/login");
    expect(screen.getByRole("link", { name: "Get Started" })).toHaveAttribute("href", "/en/register");
    expect(screen.queryByText(/github/i)).toBeNull();
  });
});
