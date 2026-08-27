import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { SiteFooter } from "./site-footer";
import { SUPPORT_EMAIL } from "@/lib/contact";
import en from "@/messages/en/marketing.json";

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

  it("renders every leaf of the footer catalog subtree (F1/F3 — a dropped key must fail loudly)", async () => {
    // Walks messages/en/marketing.json's `footer` subtree and collects every
    // string leaf, e.g. {a: {b: "x"}} -> [["a.b", "x"]]. Deliberately broader
    // than the individual LINKED/UNLINKED assertions above — this is the net
    // that catches a *future* key nobody wrote a dedicated assertion for
    // (exactly how footer.note.heading/body shipped uncaught the first time:
    // no test asserted footer catalog coverage, only specific labels).
    function collectLeaves(
      value: unknown,
      path: string[] = [],
    ): Array<{ path: string; text: string }> {
      if (typeof value === "string") {
        return [{ path: path.join("."), text: value }];
      }
      if (value !== null && typeof value === "object") {
        return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
          collectLeaves(child, [...path, key]),
        );
      }
      return [];
    }

    const allLeaves = collectLeaves(en.footer);
    // `ariaLabel` is an element attribute, not rendered text; `copyright` is
    // ICU-interpolated ("© {year} Korume · All rights reserved") so its raw
    // catalog string never appears verbatim in the DOM — both are asserted
    // elsewhere (the aria-label and the copyright/backToTop row) and are
    // excluded here on purpose, not by omission.
    const EXCLUDED_LEAF_KEYS = new Set(["ariaLabel", "copyright"]);
    const coveredLeaves = allLeaves.filter((leaf) => {
      const leafKey = leaf.path.split(".").at(-1);
      return leafKey !== undefined && !EXCLUDED_LEAF_KEYS.has(leafKey);
    });

    // Explicit counts (CLAUDE.md §7 / docs/lessons.md L-004): the walk must
    // find exactly the catalog's current shape, so an empty or mis-scoped
    // walk cannot pass vacuously, and a later task that adds a footer key
    // without rendering it drops this test's `coveredLeaves` count.
    expect(allLeaves).toHaveLength(34);
    expect(coveredLeaves).toHaveLength(32);

    const { container } = render(await SiteFooter());
    const renderedText = container.textContent ?? "";

    for (const { path, text } of coveredLeaves) {
      expect(renderedText, `footer.${path} = ${JSON.stringify(text)} did not render`).toContain(text);
    }
  });
});
