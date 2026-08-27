import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { SiteHeader } from "./site-header";

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
