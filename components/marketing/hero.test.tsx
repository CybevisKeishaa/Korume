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

  it("holds the hero still as a real image with a recorded source", async () => {
    // Was a pending-slot guard until task A1 fix F7 supplied the still. The
    // point it protected is unchanged: no invented art. Asserting the exact
    // path is asserting recorded provenance (spec §5.2), the same way the
    // mascot-pose assertion below does.
    const { container } = render(await Hero());

    expect(container.querySelectorAll('[data-asset-pending="true"]')).toHaveLength(0);

    const slots = Array.from(container.querySelectorAll("[data-asset-slot]"));
    expect(slots).toHaveLength(1);

    const stills = Array.from(container.querySelectorAll("[data-asset-slot] img"));
    expect(stills).toHaveLength(1);

    const [still] = stills;
    if (!still) throw new Error("the hero still slot rendered no <img>");
    // Decoded: `next/image` serves it through `/_next/image?url=<encoded>`.
    const stillSrc = decodeURIComponent(still.getAttribute("src") ?? "");
    expect(stillSrc).toContain("/marketing/hero-still.png");
    expect(still.getAttribute("alt")).toBe(en.hero.video.stillAlt);
  });

  it("gives the decorative player chrome its own ground, so it survives an arbitrary still (fix F9)", async () => {
    // The chrome was drawn against a dark dashed placeholder: a `bg-border`
    // hairline (a near-black colour meant for `--card`) and a bare glyph. Fix
    // F7 put a bright lantern-lit photograph behind it and both became a
    // smudge. The treatment must not depend on which photograph is in the
    // slot, so the chrome carries its own scrim and the track is drawn from
    // the foreground ramp.
    //
    // jsdom applies no Tailwind stylesheet, so there is no computed
    // background or contrast to read here — legibility was judged in a
    // browser. The subject this can pin is which treatment is DECLARED, and
    // that the chrome stayed decoration while gaining it.
    const { container } = render(await Hero());

    const chromes = Array.from(container.querySelectorAll("[data-player-chrome]"));
    expect(chromes).toHaveLength(1);

    const [chrome] = chromes;
    if (!chrome) throw new Error("the player chrome did not render");

    expect(chrome).toHaveAttribute("aria-hidden", "true");
    expect(chrome.className).toContain("pointer-events-none");
    expect(
      chrome.querySelectorAll("a, button, input, [tabindex]"),
      "the chrome depicts controls, it must never become one",
    ).toHaveLength(0);

    expect(
      chrome.className,
      "the chrome needs a ground of its own, not the still's own tones",
    ).toContain("from-scrim/");

    const tracks = Array.from(chrome.querySelectorAll("[data-player-track]"));
    expect(tracks).toHaveLength(1);

    const [track] = tracks;
    if (!track) throw new Error("the progress track did not render");
    expect(
      track.className,
      "the track must be a light hairline over any photograph, not `--border`",
    ).toContain("bg-foreground/");
    expect(track.className).not.toContain("bg-border");
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

    // Still NO exclusions, and still by path rather than by leaf name. What
    // changed with task A1 fix F7 is where one leaf lands: `video.stillAlt`
    // used to be visible `<span>` text in `AssetSlot`'s pending branch, and is
    // now the filled branch's `alt`. Just as present, just as required — so the
    // guard widens to "visible text OR an image's accessible name" rather than
    // excusing the leaf.
    //
    // Explicit counts (CLAUDE.md §7 / docs/lessons.md L-004): the walk must
    // find exactly the catalog's current shape, so an empty or mis-scoped
    // walk cannot pass vacuously, and a later task that adds a hero key
    // without rendering it drops this count.
    expect(allLeaves).toHaveLength(29);

    const { container } = render(await Hero());
    const alts = Array.from(container.querySelectorAll("img"))
      .map((img) => img.getAttribute("alt") ?? "")
      .filter((alt) => alt.length > 0);
    // Non-empty subject before relying on it (docs/lessons.md L-004). Exactly
    // one: the still. The mascot is decorative and carries `alt=""`, which the
    // filter above drops — as it must, or a decorative image could satisfy a
    // catalog leaf.
    expect(alts).toHaveLength(1);

    const renderedText = [container.textContent ?? "", ...alts].join(" ");

    for (const { path, text } of allLeaves) {
      expect(renderedText, `hero.${path} = ${JSON.stringify(text)} did not render`).toContain(text);
    }
  });
});
