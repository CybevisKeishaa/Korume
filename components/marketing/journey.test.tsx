import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Journey } from "./journey";
import en from "@/messages/en/marketing.json";

const STEPS = ["Watch", "Understand", "Shadow", "Mine", "Remember"] as const;

describe("Journey", () => {
  it("renders the five steps as ONE row — the frame breaks it into a column plus a row", async () => {
    const { container } = render(await Journey());

    const cards = container.querySelectorAll("[data-step]");
    expect(cards).toHaveLength(5);
    expect(STEPS).toHaveLength(5);
    expect(Array.from(cards).map((c) => c.getAttribute("data-step"))).toEqual([
      "watch",
      "understand",
      "shadow",
      "mine",
      "remember",
    ]);
    for (const name of STEPS) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it("puts an arrow between each adjacent pair — four, not one", async () => {
    const { container } = render(await Journey());

    const arrows = container.querySelectorAll("[data-step-arrow]");
    expect(arrows).toHaveLength(4);
    for (const arrow of Array.from(arrows)) {
      expect(arrow).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("numbers the steps 1 to 5", async () => {
    render(await Journey());

    for (const index of ["1", "2", "3", "4", "5"]) {
      expect(screen.getByText(index)).toBeInTheDocument();
    }
  });

  it("keeps arrows out of the tab order and the accessibility tree", async () => {
    const { container } = render(await Journey());

    const arrows = container.querySelectorAll("[data-step-arrow]");
    for (const arrow of Array.from(arrows)) {
      expect(arrow).not.toHaveAttribute("tabindex");
      expect(arrow.getAttribute("role")).not.toBe("img");
    }
  });

  it("fix round 1 F2: makes the scrolling row keyboard-focusable, labelled by the section heading", async () => {
    render(await Journey());

    // No descendant is a link or button, so a keyboard-only user has nothing
    // to Tab to that would scroll a narrow row into view — the row itself
    // must be a focus stop. `getByRole` resolving by accessible name also
    // proves the `aria-labelledby` wiring reaches the real heading text
    // (not a stale or mistyped id).
    const row = screen.getByRole("list", { name: en.journey.heading });
    expect(row).toHaveAttribute("tabindex", "0");
  });

  it("replaces the text arrow glyph with drawn linework", async () => {
    const { container } = render(await Journey());

    const arrows = container.querySelectorAll("[data-step-arrow]");
    expect(arrows).toHaveLength(4);
    for (const arrow of Array.from(arrows)) {
      expect(arrow.tagName.toLowerCase()).toBe("svg");
      expect(arrow).toHaveAttribute("focusable", "false");
      // The old implementation rendered the character itself, so its text
      // content was "→". Drawn linework contributes no text at all.
      expect(arrow.textContent).toBe("");
    }
    expect(container.textContent).not.toContain("→");
  });

  it("fills the Watch card's slot with the photograph, not a pending placeholder", async () => {
    const { container } = render(await Journey());

    const watch = container.querySelector('[data-step="watch"]');
    expect(watch).not.toBeNull();
    expect(watch?.querySelectorAll("[data-asset-pending]")).toHaveLength(0);

    const images = Array.from(watch?.querySelectorAll("img") ?? []);
    expect(images).toHaveLength(1);
    const [photo] = images;
    if (!photo) throw new Error("unreachable — asserted above");
    expect(photo).toHaveAttribute("alt", en.journey.thumbnailAlt);

    // next/image rewrites `src` through the optimizer, so the subject is which
    // FILE is served, not the URL shape (mirrors problem.test.tsx).
    expect(decodeURIComponent(photo.getAttribute("src") ?? "")).toContain(
      "/marketing/journey-thumb.png",
    );

    // The default `sizes` is an upper bound sized for §2's 45vw photograph; at
    // this slot's ~106 CSS px it selects the 1080px variant (74.7 KB WebP /
    // 980 KB PNG) instead of the 384px one (15.6 KB / 149 KB). Losing the
    // override is a silent 4.8x regression with no visible symptom.
    expect(photo.getAttribute("sizes")).toBe("(min-width: 1024px) 200px, 300px");
  });

  it("draws step 3's waveform as amplitude bars, not as a pitch contour", async () => {
    const { container } = render(await Journey());

    const shadow = container.querySelector('[data-step="shadow"]');
    expect(shadow).not.toBeNull();
    // The superseded build reused §4's pitch contour here (controller ruling,
    // 2026-08-29): a waveform is amplitude, which is a different quantity.
    expect(shadow?.querySelectorAll("[data-contour]")).toHaveLength(0);

    const waveform = shadow?.querySelectorAll("[data-shadow-waveform]") ?? [];
    expect(waveform).toHaveLength(1);
    expect(waveform[0]).toHaveAttribute("aria-hidden", "true");

    const bars = shadow?.querySelectorAll("[data-wave-bar]") ?? [];
    expect(bars).toHaveLength(56);
  });

  it("splits the waveform at a playhead — a recorded run and a rest", async () => {
    const { container } = render(await Journey());

    const shadow = container.querySelector('[data-step="shadow"]');
    const recorded = shadow?.querySelectorAll('[data-wave-state="recorded"]') ?? [];
    const rest = shadow?.querySelectorAll('[data-wave-state="rest"]') ?? [];

    // Explicit sizes, not just "non-empty" (CLAUDE.md §7): a single-tone
    // waveform would leave one of these at 0 and still satisfy a
    // greater-than-zero check on the other. 56 bars split at ~62%.
    expect(recorded).toHaveLength(35);
    expect(rest).toHaveLength(21);
  });

  it("gives the Mine card its third chip — the save affordance", async () => {
    const { container } = render(await Journey());

    const mine = container.querySelector('[data-step="mine"]');
    const chipRow = mine?.querySelector("[data-mine-chips]");
    expect(chipRow).not.toBeNull();
    expect(chipRow?.children).toHaveLength(3);

    const save = chipRow?.querySelector("[data-save-chip]");
    expect(save).not.toBeNull();
    // Drawn, not named: it must never grow a catalog string, and it carries
    // no meaning the card's own text does not already have.
    expect(save).toHaveAttribute("aria-hidden", "true");
    expect(save?.textContent).toBe("");
  });

  it("draws the Remember card's review grid as 15 dots with exactly 2 lit", async () => {
    const { container } = render(await Journey());

    const remember = container.querySelector('[data-step="remember"]');
    const grid = remember?.querySelectorAll("[data-review-grid]") ?? [];
    expect(grid).toHaveLength(1);
    expect(grid[0]).toHaveAttribute("aria-hidden", "true");

    // 5 columns x 3 rows. Both counts are explicit: a grid that rendered no
    // dots, or lit none of them, would pass a bare "greater than zero" check
    // on the other collection.
    expect(remember?.querySelectorAll("[data-review-dot]")).toHaveLength(15);
    expect(remember?.querySelectorAll("[data-review-dot-lit]")).toHaveLength(2);
  });

  it("keeps every added graphic decorative and unreachable by keyboard", async () => {
    const { container } = render(await Journey());

    const HOOKS = [
      "[data-step-arrow]",
      "[data-watch-play]",
      "[data-watch-progress]",
      "[data-step-progress]",
      "[data-shadow-waveform]",
      "[data-record-glyph]",
      "[data-save-chip]",
      "[data-review-grid]",
    ] as const;

    for (const hook of HOOKS) {
      const nodes = container.querySelectorAll(hook);
      // A selector that matches nothing makes every assertion below it
      // unconditionally green (CLAUDE.md §7).
      expect(nodes.length, `${hook} matched nothing`).toBeGreaterThan(0);

      for (const node of Array.from(nodes)) {
        expect(node, `${hook} is exposed to assistive technology`).toHaveAttribute(
          "aria-hidden",
          "true",
        );
        expect(node, `${hook} is in the tab order`).not.toHaveAttribute("tabindex");
        expect(
          node.querySelectorAll("a, button, input, select, textarea, [tabindex]"),
          `${hook} has a focusable descendant`,
        ).toHaveLength(0);
      }
    }
  });

  it("puts the body and the CTA in the section rail, beside the heading", async () => {
    const { container } = render(await Journey());

    // The stacked layout — a full-width display heading over the body over the
    // CTA over the card row — was the composition the user rejected (spec §13,
    // G5). `Section`'s `rail` is the shared mechanism for the split; jsdom
    // cannot see the two columns, but it can see that the rail exists and that
    // the body and CTA are inside it rather than above the cards.
    const rail = container.querySelector("[data-section-rail]");
    expect(rail).not.toBeNull();
    expect(rail?.textContent).toContain(en.journey.body);

    const cta = rail?.querySelector("a");
    expect(cta).not.toBeNull();
    expect(cta?.textContent).toContain(en.journey.cta);

    // The card row is the rail's sibling, not its descendant.
    expect(rail?.querySelector("[data-step]")).toBeNull();
  });

  it("renders every leaf of the journey catalog subtree (dropped-key guard)", async () => {
    // Walks messages/en/marketing.json's `journey` subtree and collects every
    // string leaf, e.g. {a: {b: "x"}} -> [["a.b", "x"]]. Mirrors
    // problem.test.tsx / hero.test.tsx's equivalent guard.
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

    const allLeaves = collectLeaves(en.journey);

    // Explicit count (CLAUDE.md §7 / docs/lessons.md L-004): 5 top-level
    // leaves (eyebrow/heading/body/cta/thumbnailAlt) + 18 step leaves
    // (watch 3, understand 4, shadow 3, mine 5, remember 3) = 23. A later
    // task that adds a journey key without rendering it drops this count.
    expect(allLeaves).toHaveLength(23);

    const { container } = render(await Journey());

    // Still NO exclusions, and still by path rather than by leaf name. What
    // changed in Task A2 is where one leaf lands: `thumbnailAlt` used to be
    // visible `<span>` text in `AssetSlot`'s pending branch, and is now the
    // filled branch's `alt`. It is just as present and just as required — so
    // the guard widens to "visible text OR an image's accessible name" rather
    // than excusing the leaf, exactly as problem.test.tsx did for `photoAlt`.
    const alts = Array.from(container.querySelectorAll("img"))
      .map((img) => img.getAttribute("alt") ?? "")
      .filter((alt) => alt.length > 0);
    // Non-empty subject before relying on it (docs/lessons.md L-004): if the
    // photograph ever stopped rendering, `alts` would be empty and
    // `thumbnailAlt` would silently have nowhere to be found.
    expect(alts).toHaveLength(1);

    const renderedText = [container.textContent ?? "", ...alts].join(" ");

    for (const { path, text } of allLeaves) {
      expect(renderedText, `journey.${path} = ${JSON.stringify(text)} did not render`).toContain(
        text,
      );
    }
  });
});
