import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Hero } from "./hero";
import en from "@/messages/en/marketing.json";

describe("Hero", () => {
  it("renders the page's only h1", async () => {
    render(await Hero());

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
  });

  it("offers both hero CTAs, pointing at register and the explore surface", async () => {
    render(await Hero());

    expect(screen.getByRole("link", { name: "Start Learning" })).toHaveAttribute("href", "/en/register");
    expect(screen.getByRole("link", { name: "Explore Korume" })).toHaveAttribute(
      "href",
      "/en/shadowing/explore",
    );
  });

  it("holds the hero still as a pending asset slot, not as invented art", async () => {
    const { container } = render(await Hero());

    const pending = container.querySelectorAll('[data-asset-pending="true"]');
    expect(pending).toHaveLength(1);
  });

  it("links Save Sentence to the Collection screen (user ruling, 2026-08-28)", async () => {
    render(await Hero());

    const save = screen.getByRole("link", { name: en.hero.saveSentence });
    // `/mining` is the registry's `screenId: mining`, labelled "Collection".
    expect(save).toHaveAttribute("href", "/en/mining");
  });

  it("puts the companion itself in the Companion card, not an initial", async () => {
    const { container } = render(await Hero());

    const mascot = container.querySelector("[data-mascot]");
    expect(mascot).not.toBeNull();
    // Only `scripts/mascot/extract.js` writes into poses/, and
    // `scripts/mascot/poses.test.ts` pins that directory to the manifest, so
    // asserting the path is asserting recorded provenance (spec §5.2).
    expect(mascot?.getAttribute("src")).toBe("/mascot/poses/greeting.png");
    expect(mascot?.getAttribute("src")).not.toContain("/renders/");
    expect(mascot?.getAttribute("alt")).toBe("");
    expect(mascot?.getAttribute("aria-hidden")).toBe("true");
    // The card previously stood in the mascot's place with the companion
    // name's first letter. That placeholder must not survive alongside it.
    const name = en.hero.companion.name;
    expect(container.textContent).not.toContain(
      `${name.slice(0, 1)}${name}`,
    );
  });

  it("shows the video card's metadata", async () => {
    render(await Hero());

    expect(screen.getByText("Travel to Japan: Kyoto in Autumn")).toBeInTheDocument();
    expect(screen.getByText("N3")).toBeInTheDocument();
    expect(screen.getByText("13 min")).toBeInTheDocument();
    expect(screen.getByText("1 / 29")).toBeInTheDocument();
  });

  it("renders exactly the four depicted tabs, Transcript / Japanese / English / Notes", async () => {
    const { container } = render(await Hero());

    const tabs = container.querySelectorAll("[data-hero-tabs] li");
    expect(tabs).toHaveLength(4);
    expect(Array.from(tabs).map((tab) => tab.textContent)).toEqual([
      "Transcript",
      "Japanese",
      "English",
      "Notes",
    ]);
  });

  it("ruling 4: builds exactly two transcript lines, matching the catalog (not the reference's three)", async () => {
    const { container } = render(await Hero());

    const lines = container.querySelectorAll("[data-hero-transcript] > p");
    expect(lines).toHaveLength(2);
  });

  it("ruling 3: transcript line 1 and sentence 1/29 stay faithfully inconsistent, as the frame has them", async () => {
    const { container } = render(await Hero());
    const text = container.textContent ?? "";

    // Pinned literally (not re-derived from the catalog) so that unifying
    // these two strings in a later "cleanup" fails this test loudly instead
    // of silently erasing the frame-faithful inconsistency ruling 3 keeps.
    expect(text).toContain("この通りは、いつ来ても落ち着きます。");
    expect(text).toContain("この通りは、いつ来ても静かで落ち着きます。");
  });

  it("ruling 2: highlights 静か inside the sentence, derived from the key-words catalog, not a hardcoded space", async () => {
    const { container } = render(await Hero());

    const highlight = container.querySelector('[data-sentence-highlight="true"]');
    expect(highlight).not.toBeNull();
    expect(highlight?.textContent).toBe("静か");
    expect(highlight?.className).toContain("text-primary-strong");
  });

  it("renders every leaf of the hero catalog subtree (F2 — a dropped key must fail loudly)", async () => {
    // Walks messages/en/marketing.json's `hero` subtree and collects every
    // string leaf, e.g. {a: {b: "x"}} -> [["a.b", "x"]]. Mirrors
    // site-footer.test.tsx's equivalent guard (added there for the same
    // reason: footer.note.heading/body shipped once with no test asserting
    // catalog coverage, only specific labels).
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

    const allLeaves = collectLeaves(en.hero);

    // No exclusions: unlike footer's `ariaLabel`/`copyright`, every hero leaf
    // renders as plain visible text — including `video.stillAlt`, which
    // `AssetSlot`'s pending branch renders as both an `aria-label` AND
    // visible `<span>` text.
    //
    // Explicit counts (CLAUDE.md §7 / docs/lessons.md L-004): the walk must
    // find exactly the catalog's current shape, so an empty or mis-scoped
    // walk cannot pass vacuously, and a later task that adds a hero key
    // without rendering it drops this count.
    expect(allLeaves).toHaveLength(29);

    const { container } = render(await Hero());
    const renderedText = container.textContent ?? "";

    for (const { path, text } of allLeaves) {
      expect(renderedText, `hero.${path} = ${JSON.stringify(text)} did not render`).toContain(text);
    }
  });
});
