import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { PitchShowcase } from "./pitch-showcase";
import en from "@/messages/en/marketing.json";

/** Every `y` coordinate in an SVG path `d` of the `M`/`L x y` shape this chart emits. */
function pathYs(d: string): number[] {
  return Array.from(d.matchAll(/[ML]\s*-?[\d.]+\s+(-?[\d.]+)/g)).map((m) => Number(m[1]));
}

describe("PitchShowcase", () => {
  it("draws TWO contours — the frame draws bars, which misrepresents a continuous quantity", async () => {
    const { container } = render(await PitchShowcase());

    const paths = container.querySelectorAll("[data-contour]");
    expect(paths).toHaveLength(2);
    expect(Array.from(paths).map((p) => p.getAttribute("data-contour"))).toEqual([
      "native",
      "you",
    ]);
  });

  it("labels which curve is which", async () => {
    render(await PitchShowcase());

    expect(screen.getByText("Native")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("gives the chart an accessible name, carried by the chart alone", async () => {
    const { container } = render(await PitchShowcase());

    const chart = container.querySelector("svg[role='img']");
    expect(chart).toHaveAccessibleName(
      "Two pitch contours compared: a native speaker's and yours.",
    );

    // Fix round 1: the old test name claimed this hid the paths' internals
    // from assistive tech but never asserted it — neither `<path>` carries
    // its own `role`/`aria-label`, so the chart's single name is the only
    // thing a screen reader announces, not two unlabeled child images.
    const paths = container.querySelectorAll("[data-contour]");
    for (const path of Array.from(paths)) {
      expect(path).not.toHaveAttribute("role");
      expect(path).not.toHaveAttribute("aria-label");
    }
  });

  it("distinguishes the two contours by more than colour (WCAG 1.4.1)", async () => {
    // `stroke-primary-strong` vs `stroke-muted-foreground` alone is a
    // colour-only distinction, so the pair also differs by dash AND by stroke
    // weight.
    //
    // ⚠️ Task A3 INVERTED which one is dashed. Fix round 1 (F3) dashed the
    // native line, mirroring `pitch-contour-overlay.tsx`, where the reference
    // take is the dashed one. F3's requirement was 1.4.1, not a particular
    // assignment, and reference `346:6275` makes the native contour the
    // dominant solid line — so native is now solid and heavier and "you" is
    // the thin dashed comparison. See `pitch-chart.tsx`'s docblock.
    const { container } = render(await PitchShowcase());

    const native = container.querySelector('[data-contour="native"]');
    const you = container.querySelector('[data-contour="you"]');
    expect(native?.getAttribute("stroke-dasharray")).toBeFalsy();
    expect(you?.getAttribute("stroke-dasharray")).toBeTruthy();

    const nativeWidth = Number(native?.getAttribute("stroke-width"));
    const youWidth = Number(you?.getAttribute("stroke-width"));
    expect(nativeWidth).toBeGreaterThan(0);
    expect(nativeWidth).toBeGreaterThan(youWidth);

    // The legend repeats the same distinction as a small line icon next to
    // each label, not just a colour swatch — and it must show what its line
    // shows, in both dash state and weight.
    const legendLines = container.querySelectorAll("svg[aria-hidden='true'] line");
    expect(legendLines).toHaveLength(2);
    const dashed = Array.from(legendLines).map((line) =>
      Boolean(line.getAttribute("stroke-dasharray")),
    );
    expect(dashed).toEqual([false, true]);
    expect(Number(legendLines[0]?.getAttribute("stroke-width"))).toBe(nativeWidth);
    expect(Number(legendLines[1]?.getAttribute("stroke-width"))).toBe(youWidth);
  });

  it("plots both contours on ONE vertical scale, so the flatter take reads as flatter", async () => {
    // The pedagogical point of the overlay: the "You" track flattens the
    // native's peak. `toPlotPoints` normalizes a contour to its OWN range
    // unless it is given one, so calling it once per contour — which this
    // section used to do — stretched the flatter track to the same full
    // height and erased exactly that difference. Both are now plotted against
    // a `semitoneRange` computed over both.
    const { container } = render(await PitchShowcase());

    const nativeYs = pathYs(container.querySelector('[data-contour="native"]')?.getAttribute("d") ?? "");
    const youYs = pathYs(container.querySelector('[data-contour="you"]')?.getAttribute("d") ?? "");
    expect(nativeYs.length).toBeGreaterThan(100);
    expect(youYs).toHaveLength(nativeYs.length);

    const span = (ys: number[]) => Math.max(...ys) - Math.min(...ys);
    // Under per-contour normalization both spans are the full viewBox height
    // and this ratio is 1.
    expect(span(youYs) / span(nativeYs)).toBeLessThan(0.9);
    // And the native's highest point really is higher than the user's.
    expect(Math.min(...nativeYs)).toBeLessThan(Math.min(...youYs));
  });

  it("keeps the unvoiced gap at the phrase break rather than bridging it", async () => {
    // `toPath`'s pen-up/pen-down behaviour, exercised through the real data:
    // a second `M` is a second subpath, which is the gap. `contour-path.ts`
    // owns the unit-level proof; this is the integration one.
    const { container } = render(await PitchShowcase());

    for (const key of ["native", "you"]) {
      const d = container.querySelector(`[data-contour="${key}"]`)?.getAttribute("d") ?? "";
      expect(d.match(/M/g), `${key} contour`).toHaveLength(2);
    }
  });

  it("draws the gridlines as decoration only — unreachable, unnamed, unfocusable", async () => {
    const { container } = render(await PitchShowcase());

    const group = container.querySelector("[data-gridlines]");
    expect(group).not.toBeNull();
    expect(group?.getAttribute("aria-hidden")).toBe("true");

    const lines = container.querySelectorAll("[data-gridline]");
    expect(lines).toHaveLength(4);
    for (const line of Array.from(lines)) {
      expect(line).not.toHaveAttribute("role");
      expect(line).not.toHaveAttribute("aria-label");
      expect(line).not.toHaveAttribute("tabindex");
    }
    // Nothing in the chart is in the tab order at all.
    expect(container.querySelectorAll("svg [tabindex]")).toHaveLength(0);
  });

  it("shows all four sub-scores and the overall score", async () => {
    const { container } = render(await PitchShowcase());

    // Fix round 1, F2: gathered from the render, not a literal the test just
    // wrote — `["86/100", ...]).toHaveLength(4)` could never be anything but
    // 4 and never touched the DOM. `[data-subscore]` proves the component
    // actually rendered four (not three, not a duplicated one).
    const subscores = container.querySelectorAll("[data-subscore]");
    expect(subscores).toHaveLength(4);
    expect(Array.from(subscores).map((el) => el.getAttribute("data-subscore"))).toEqual([
      "pitch",
      "rhythm",
      "pronunciation",
      "timing",
    ]);

    // ⚠️ Task A3: `getByText("86/100")` no longer applies. The value is split
    // at render time into a green number and a grey `/100` (the reference's
    // styling), and testing-library matches on an element's own direct text
    // nodes — so the two halves are asserted where they live, and the pair is
    // asserted to still read as one string.
    const scores = ["86/100", "84/100", "82/100", "90/100"];
    expect(Array.from(subscores).map((el) => el.querySelector("dd")?.textContent)).toEqual(scores);
    expect(screen.getByText("86")).toBeInTheDocument();
    expect(screen.getAllByText("/100")).toHaveLength(4);
    expect(screen.getByText("87")).toBeInTheDocument();
    expect(screen.getByText("Great!")).toBeInTheDocument();
  });

  it("styles the sub-score value as a number plus a suffix, not one uniform string", async () => {
    const { container } = render(await PitchShowcase());

    const numbers = container.querySelectorAll("[data-score-number]");
    const suffixes = container.querySelectorAll("[data-score-suffix]");
    expect(numbers).toHaveLength(4);
    expect(suffixes).toHaveLength(4);
    expect(Array.from(numbers).map((n) => n.textContent)).toEqual(["86", "84", "82", "90"]);
    for (const number of Array.from(numbers)) {
      expect(number.className).toContain("text-success-strong");
    }
  });

  it("draws the sub-score dividers as borders, adding nothing to the accessibility tree", async () => {
    const { container } = render(await PitchShowcase());

    const cells = Array.from(container.querySelectorAll("[data-subscore]"));
    expect(cells).toHaveLength(4);
    // Every cell carries the divider rule; the first cancels it, so three
    // rules are drawn between four cells.
    const withRule = cells.filter((c) => c.className.includes("sm:border-l"));
    expect(withRule).toHaveLength(4);
    expect(cells.filter((c) => c.className.includes("sm:first:border-l-0"))).toHaveLength(4);

    // No separator element, no aria role, no invented string.
    const list = container.querySelector("dl");
    expect(list).not.toBeNull();
    expect(list?.querySelectorAll("[role]")).toHaveLength(0);
    expect(list?.querySelectorAll("hr")).toHaveLength(0);
  });

  it("renders the mascot from a manifested pose, not a Blender render", async () => {
    const { container } = render(await PitchShowcase());

    const mascot = container.querySelector("[data-mascot]");
    expect(mascot).not.toBeNull();
    // Only `scripts/mascot/extract.js` writes into poses/, and
    // `scripts/mascot/poses.test.ts` pins that directory to the manifest, so
    // asserting the path is asserting recorded provenance (spec §5.2).
    //
    // ⚠️ Task A3 dropped `unoptimized` (166 KB shipped to paint 124 px), so
    // `src` is now the optimizer URL that encodes the same path rather than
    // the path itself.
    expect(mascot?.getAttribute("src")).toContain(encodeURIComponent("/mascot/poses/noting.png"));
    expect(mascot?.getAttribute("src")).not.toContain("/renders/");
    // The alpha channel is what retired the screen-blend workaround; if that
    // class comes back, the asset is being composited the old, placement-
    // constraining way.
    expect(mascot?.className ?? "").not.toContain("mix-blend");
    // Decorative: the section's meaning must not depend on it.
    expect(mascot?.getAttribute("alt")).toBe("");
    expect(mascot?.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps the overflowing mascot from ever intercepting a pointer, and from painting over copy", async () => {
    // The three load-bearing properties of an image that breaks out of its
    // card — the same set §2's photograph and §3's player chrome carry.
    // `pitch-showcase.tsx`'s `CompanionCard` docblock is the reasoning.
    const { container } = render(await PitchShowcase());

    const mascot = container.querySelector("[data-mascot]");
    const companion = container.querySelector("[data-companion]");
    expect(mascot).not.toBeNull();
    expect(companion).not.toBeNull();

    const mascotClass = mascot?.className ?? "";
    expect(mascotClass).toContain("pointer-events-none");
    // The overhang is bounded by the showcase card's own padding token, which
    // is what keeps it off the page edge (WCAG 1.4.10).
    expect(mascotClass).toContain("xl:-right-lg");

    // The copy is lifted above the mascot rather than relying on paint order.
    const copy = companion?.firstElementChild;
    expect(copy?.className).toContain("relative");
    expect(copy?.className).toContain("z-10");
  });

  it("tells the browser how wide the mascot actually renders", async () => {
    // Without `unoptimized` the browser is offered a srcset; without `sizes`
    // it would assume 100vw and pick a variant far larger than 124 px.
    const { container } = render(await PitchShowcase());

    const mascot = container.querySelector("[data-mascot]");
    expect(mascot?.getAttribute("sizes")).toBe("104px");
    const srcset = mascot?.getAttribute("srcset") ?? "";
    const widths = Array.from(srcset.matchAll(/\s(\d+)w/g)).map((m) => Number(m[1]));
    expect(widths.length).toBeGreaterThan(0);
    expect(Math.min(...widths)).toBeLessThanOrEqual(256);
  });

  it("renders every leaf of the pitch catalog subtree (dropped-key guard)", async () => {
    // Walks messages/en/marketing.json's `pitch` subtree and collects every
    // string leaf, e.g. {a: {b: "x"}} -> [["a.b", "x"]]. Mirrors
    // problem.test.tsx / journey.test.tsx's equivalent guard.
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

    const allLeaves = collectLeaves(en.pitch);
    // `chartLabel` is an `aria-label` attribute on the SVG, not rendered
    // text — it is asserted elsewhere (the accessible-name test above) and
    // excluded here on purpose, not by omission, mirroring
    // site-footer.test.tsx's `ariaLabel`/`copyright` exclusion.
    //
    // Excluded by FULL PATH, not by leaf name: a `chartLabel` added anywhere
    // else under `pitch` would otherwise be silently excluded too, and the
    // guard exists to catch exactly that kind of quiet drop.
    const EXCLUDED_LEAF_PATHS = new Set(["chartLabel"]);
    const coveredLeaves = allLeaves.filter((leaf) => !EXCLUDED_LEAF_PATHS.has(leaf.path));

    // Explicit counts (CLAUDE.md §7 / docs/lessons.md L-004): eyebrow, heading,
    // body, cta, legend.native, legend.you, example.jp, scores.overallLabel,
    // scores.overall, scores.verdict, scores.pitch.{name,value},
    // scores.rhythm.{name,value}, scores.pronunciation.{name,value},
    // scores.timing.{name,value}, companion.name, companion.body, chartLabel
    // = 21 total, 20 covered by textContent.
    expect(allLeaves).toHaveLength(21);
    expect(coveredLeaves).toHaveLength(20);

    const { container } = render(await PitchShowcase());
    const renderedText = container.textContent ?? "";

    for (const { path, text } of coveredLeaves) {
      expect(renderedText, `pitch.${path} = ${JSON.stringify(text)} did not render`).toContain(
        text,
      );
    }
  });

  it("uses the shared split layout rather than inventing a second mechanism", async () => {
    // Task A1's `rail` prop. Its guard is `rail != null`, so the rail's
    // presence is what selects the split — asserting the rail wrapper exists
    // asserts the section took that branch.
    const { container } = render(await PitchShowcase());

    const rail = container.querySelector("[data-section-rail]");
    const showcase = container.querySelector("[data-section-showcase]");
    expect(rail).not.toBeNull();
    expect(showcase).not.toBeNull();
    expect(rail?.textContent).toContain(en.pitch.body);
    expect(rail?.textContent).toContain(en.pitch.cta);
    expect(showcase?.textContent).toContain(en.pitch.scores.overall);
  });
});
