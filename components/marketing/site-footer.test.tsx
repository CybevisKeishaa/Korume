import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { SiteFooter } from "./site-footer";
import { SUPPORT_EMAIL } from "@/lib/contact";

/** Spec §2.3 — the only three footer labels that have a real destination today. */
const LINKED: ReadonlyArray<readonly [string, string]> = [
  ["Home", "/en"],
  ["Roadmap", "/en/roadmap"],
  ["Contact", `mailto:${SUPPORT_EMAIL}`],
];

/** Spec §2.3 — present as text, deliberately not links, until a page exists. */
const UNLINKED = [
  "Pricing",
  "FAQ",
  "Blog",
  "About",
  "Careers",
  "Privacy Policy",
  "Terms of Service",
  "Discord",
  "Facebook",
  "TikTok",
] as const;

describe("SiteFooter", () => {
  it("links exactly the labels whose destination exists", async () => {
    render(await SiteFooter());

    expect(LINKED).toHaveLength(3);
    for (const [label, href] of LINKED) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
  });

  it("keeps every other label as text, so nothing is dropped and nothing 404s", async () => {
    render(await SiteFooter());

    expect(UNLINKED).toHaveLength(10);
    for (const label of UNLINKED) {
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: label })).toBeNull();
    }
  });

  it("derives the support address from lib/contact rather than re-typing it", async () => {
    render(await SiteFooter());

    expect(screen.getByText(SUPPORT_EMAIL)).toBeInTheDocument();
  });

  it("keeps the frame's own column set, not the reference's", async () => {
    render(await SiteFooter());

    for (const heading of ["Explore", "Community", "Support", "Legal"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    // The reference's columns, which ruling 3 rejects.
    expect(screen.queryByRole("heading", { name: "Product" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Learn" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Company" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Resources" })).toBeNull();
  });
});
