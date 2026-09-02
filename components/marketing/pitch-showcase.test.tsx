import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { PitchShowcase } from "./pitch-showcase";
import en from "@/messages/en/marketing.json";

/**
 * Every ANCHOR `y` in an SVG path `d` — the point each command lands on.
 *
 * `M x y` and `L x y` end on their only pair; `C c1x c1y c2x c2y x y` ends on
 * its LAST pair, and the two control pairs before it are not points the curve
 * passes through. Reading them as anchors would report a vertical span the
 * contour never reaches.
 */
function pathYs(d: string): number[] {
  return Array.from(d.matchAll(/[MLC]((?:\s*-?[\d.]+){2,6})/g)).map((m) => {
    const nums = (m[1] ?? "").trim().split(/\s+/).map(Number);
    return nums[nums.length - 1] ?? Number.NaN;
  });
}

/** Every `<width>w` descriptor in a srcset, in source order. */
function srcsetWidths(srcset: string): number[] {
  return Array.from(srcset.matchAll(/\s(\d+)w/g)).map((m) => Number(m[1]));
}

/** Narrows a query result, failing the test loudly instead of skipping silently. */
function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`expected to find ${what}`);
  return value;
}

/**
 * The four sub-score keys, in the order the card renders them.
 *
 * ⚠️ These are pinned literally because they are the component's
 * `data-subscore` CONTRACT, not copy — `en.pitch.scores` also holds
 * `overallLabel` / `overall` / `verdict`, so `Object.keys` would be wrong here.
 * Every VALUE below is read from the catalog instead of retyped: the owner
 * re-voices `messages/en/marketing.json` directly, and the 2026-09-01 pass
 * (`"Great!"` -> `"Nice work!"`) turned this file red without the component
 * changing at all.
 */
const SUBSCORE_KEYS = ["pitch", "rhythm", "pronunciation", "timing"] as const;

/** The catalog's own `"86/100"`-shaped strings, in render order. */
const SUBSCORE_VALUES: string[] = SUBSCORE_KEYS.map((key) => en.pitch.scores[key].value);

/**
 * Splits a `"86/100"` pair the way the component does at render time — into a
 * green number and a grey suffix. Throws rather than returning a silent `""`,
 * so a catalog value that stops being a pair fails loudly here.
 */
function splitScore(value: string): { number: string; suffix: string } {
  const slash = value.indexOf("/");
  if (slash < 0) throw new Error(`sub-score "${value}" is not a "<n>/<max>" pair`);
  return { number: value.slice(0, slash), suffix: value.slice(slash) };
}

/**
 * Asserts that `selector` matches nothing under `root` — after first PROVING
 * the selector can match, by inserting a node that satisfies it and watching
 * the count go to 1.
 *
 * Fix round 1, F6 (CLAUDE.md §7): a bare `toHaveLength(0)` over a collection
 * gathered by a pattern is green when the invariant holds AND green when the
 * pattern is simply wrong — a typo'd selector reports safety. The positive
 * control is what makes the negative assertion mean something.
 */
function expectSelectorMatchesNothing(
  root: ParentNode,
  selector: string,
  probeParent: Element,
  probe: Element,
): void {
  expect(root.querySelectorAll(selector), `"${selector}" must match nothing`).toHaveLength(0);
  probeParent.appendChild(probe);
  expect(
    root.querySelectorAll(selector),
    `positive control: "${selector}" must find the probe it was given`,
  ).toHaveLength(1);
  probe.remove();
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

    expect(screen.getByText(en.pitch.legend.native)).toBeInTheDocument();
    expect(screen.getByText(en.pitch.legend.you)).toBeInTheDocument();
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

  it("keeps BOTH contours solid, and distinguishes them by weight (WCAG 1.4.1)", async () => {
    // ⚠️ REVERSED 2026-09-03 on the owner's ruling. Fix round 1 (F3) dashed
    // one line so the pair was not distinguished by colour alone. The owner's
    // rebuild brief requires both to be solid — a dashed trace does not read
    // as a voice — and accepted the trade explicitly.
    //
    // 1.4.1 still has to be answered, so this now pins the replacement cue:
    // stroke WEIGHT, repeated in the legend. It is weaker than a dash; the
    // stronger remedy, if this proves insufficient, is a direct label at each
    // line's end. `pitch-chart.tsx`'s docblock carries the reasoning.
    const { container } = render(await PitchShowcase());

    const native = container.querySelector('[data-contour="native"]');
    const you = container.querySelector('[data-contour="you"]');

    expect(native, "native contour").not.toBeNull();
    expect(you, "you contour").not.toBeNull();
    expect(native?.getAttribute("stroke-dasharray"), "native must be solid").toBeFalsy();
    expect(you?.getAttribute("stroke-dasharray"), "you must be solid too").toBeFalsy();

    const nativeWidth = Number(native?.getAttribute("stroke-width"));
    const youWidth = Number(you?.getAttribute("stroke-width"));
    expect(nativeWidth).toBeGreaterThan(0);
    expect(youWidth).toBeGreaterThan(0);
    expect(nativeWidth, "the weight difference IS the non-colour cue").toBeGreaterThan(youWidth);

    // Both lines also carry round caps and joins, per the brief.
    for (const [name, path] of [["native", native], ["you", you]] as const) {
      expect(path?.getAttribute("stroke-linecap"), name).toBe("round");
      expect(path?.getAttribute("stroke-linejoin"), name).toBe("round");
      expect(path?.getAttribute("fill"), `${name} carries no area fill`).toBe("none");
    }

    // The legend repeats the same distinction, and must show what its line
    // shows: solid, at the same weight.
    const legendLines = container.querySelectorAll("svg[aria-hidden='true'] line");
    expect(legendLines).toHaveLength(2);
    for (const line of Array.from(legendLines)) {
      expect(line.getAttribute("stroke-dasharray")).toBeFalsy();
    }
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

  it("draws each contour as ONE unbroken, curved stroke", async () => {
    // Two properties of the 2026-09-03 rebuild, exercised through the real
    // data rather than through a synthetic point list:
    //
    //  - ONE subpath. The fixture used to carry an unvoiced gap after は and
    //    this asserted TWO `M`s. The owner asked why the line kept breaking;
    //    the phrase boundary is now a pitch valley instead of a hole. `toPath`
    //    still renders gaps and `contour-path.test.ts` still proves it — the
    //    product's real overlay needs that — this fixture just has none.
    //  - CURVES, not line segments. A contour joined by `L` commands makes
    //    every one of its ~169 samples a corner, which is what made the trace
    //    read as a jagged generated chart.
    const { container } = render(await PitchShowcase());

    for (const key of ["native", "you"]) {
      const d = container.querySelector(`[data-contour="${key}"]`)?.getAttribute("d") ?? "";

      expect(d.length, `${key} contour is non-empty`).toBeGreaterThan(100);
      expect(d.match(/M/g), `${key} contour`).toHaveLength(1);
      expect(d.match(/\bL/g), `${key} contour has no straight segments`).toBeNull();
      expect((d.match(/C/g) ?? []).length, `${key} contour`).toBeGreaterThan(100);
    }
  });

  it("draws the gridlines as decoration only — unreachable, unnamed, unfocusable", async () => {
    const { container } = render(await PitchShowcase());

    const group = container.querySelector("[data-gridlines]");
    expect(group).not.toBeNull();
    expect(group?.getAttribute("aria-hidden")).toBe("true");

    const lines = container.querySelectorAll("[data-gridline]");
    expect(lines.length).toBeGreaterThan(0);
    for (const line of Array.from(lines)) {
      expect(line).not.toHaveAttribute("role");
      expect(line).not.toHaveAttribute("aria-label");
      expect(line).not.toHaveAttribute("tabindex");
    }

    // Nothing in the chart is in the tab order at all — with a positive
    // control, so a broken selector cannot report safety (F6).
    const chart = must(container.querySelector("svg[role='img']"), "the chart svg");
    const focusableProbe = document.createElementNS("http://www.w3.org/2000/svg", "g");
    focusableProbe.setAttribute("tabindex", "0");
    expectSelectorMatchesNothing(container, "svg [tabindex]", chart, focusableProbe);
  });

  it("frames the plot in a bordered panel whose own edges complete an even five-line grid", async () => {
    // ⚠️ THE COUNT BELOW IS READ OFF THE REFERENCE, NOT OFF THE COMPONENT.
    // Fix round 1, F1/F4: the first build drew FOUR interior rules and no
    // frame, and pinned `toHaveLength(4)` — which mutation-checks perfectly
    // against a constant the implementer chose, and could never go red for
    // being wrong about the reference.
    //
    // Re-measured on the reference crop `ref/s4-pitch.png` (1728x440, the §4
    // export), by differencing each pixel against the same column at y±8 to
    // defeat the card's vertical gradient:
    //
    //   horizontal rules  y = 44, 92, 140, 190, 238   (five, evenly 48 apart)
    //   vertical rules    x = 550 and x = 1280..1283, both spanning y 48..235
    //   the y=44 rule runs x 554..1271, the y=238 rule x 556..1275
    //
    // i.e. the outer two horizontals run exactly the verticals' span, so they
    // are the panel's own top and bottom border and only THREE rules are
    // interior. Confirmed by eye on a 2x gain-boosted crop of the same file:
    // a rounded bordered box with three faint rules behind the trace.
    const REFERENCE_INTERIOR_GRIDLINES = 3;

    const { container } = render(await PitchShowcase());

    const panelEl = container.querySelector("[data-plot-panel]");
    expect(panelEl, "the plot panel must exist").not.toBeNull();
    const panel = must(panelEl, "the plot panel");
    expect(
      panel.className,
      "the panel is the grid's outer two lines — it must be bordered",
    ).toContain("border-border");

    // The panel FRAMES the chart; the chart is not merely near it.
    const chartEl = panel.querySelector("svg[role='img']");
    expect(chartEl, "the chart must be inside the panel").not.toBeNull();
    const chart = must(chartEl, "the chart svg inside the panel");

    const height = Number((chart.getAttribute("viewBox") ?? "").split(/\s+/)[3]);
    expect(height).toBeGreaterThan(0);

    const ys = Array.from(container.querySelectorAll("[data-gridline]")).map((line) =>
      Number(line.getAttribute("y1")),
    );
    expect(ys).toHaveLength(REFERENCE_INTERIOR_GRIDLINES);
    for (const y of ys) {
      // Interior: strictly inside the panel, never coincident with its border.
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(height);
    }

    // The panel's own edges are lines 1 and 5 of the grid, and all four bands
    // are equal — the property that makes the frame read as part of the grid
    // rather than as a box drawn around it.
    const grid = [0, ...ys, height];
    const gaps = grid.slice(1).map((y, i) => y - Number(grid[i]));
    expect(gaps).toHaveLength(REFERENCE_INTERIOR_GRIDLINES + 1);
    for (const gap of gaps) {
      expect(gap).toBeCloseTo(height / (REFERENCE_INTERIOR_GRIDLINES + 1), 6);
    }
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
      ...SUBSCORE_KEYS,
    ]);

    // ⚠️ Task A3: `getByText("86/100")` no longer applies. The value is split
    // at render time into a green number and a grey `/100` (the reference's
    // styling), and testing-library matches on an element's own direct text
    // nodes — so the two halves are asserted where they live, and the pair is
    // asserted to still read as one string.
    expect(Array.from(subscores).map((el) => el.querySelector("dd")?.textContent)).toEqual(
      SUBSCORE_VALUES,
    );
    const first = splitScore(must(SUBSCORE_VALUES[0], "the first sub-score value"));
    expect(screen.getByText(first.number)).toBeInTheDocument();
    expect(screen.getAllByText(first.suffix)).toHaveLength(4);
    expect(screen.getByText(en.pitch.scores.overall)).toBeInTheDocument();
    expect(screen.getByText(en.pitch.scores.verdict)).toBeInTheDocument();
  });

  it("styles the sub-score value as a number plus a suffix, not one uniform string", async () => {
    const { container } = render(await PitchShowcase());

    const numbers = container.querySelectorAll("[data-score-number]");
    const suffixes = container.querySelectorAll("[data-score-suffix]");
    expect(numbers).toHaveLength(4);
    expect(suffixes).toHaveLength(4);
    expect(Array.from(numbers).map((n) => n.textContent)).toEqual(
      SUBSCORE_VALUES.map((value) => splitScore(value).number),
    );
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

    // No separator element, no aria role, no invented string — each asserted
    // with a positive control first, so a wrong selector cannot pass as an
    // absence (F6).
    const list = must(container.querySelector("dl"), "the sub-score list");

    const roleProbe = document.createElement("span");
    roleProbe.setAttribute("role", "separator");
    expectSelectorMatchesNothing(list, "[role]", list, roleProbe);

    expectSelectorMatchesNothing(list, "hr", list, document.createElement("hr"));
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

  it("tells the browser how wide the mascot actually renders, from the width it renders at", async () => {
    // Without `unoptimized` the browser is offered a srcset; without `sizes`
    // it would assume 100vw and pick a variant far larger than the slot.
    const { container } = render(await PitchShowcase());

    const mascot = must(container.querySelector("[data-mascot]"), "the mascot image");

    const sizes = mascot.getAttribute("sizes") ?? "";
    expect(sizes).toMatch(/^\d+px$/);
    const slot = Number(sizes.replace("px", ""));

    // Fix round 1, F3 (CLAUDE.md §6, "one fact, one home"): `sizes` is DERIVED
    // from the rendered width. Asserting the literal `"104px"` let the two
    // drift apart silently; asserting they are the same number does not.
    expect(slot).toBe(Number(mascot.getAttribute("width")));

    // Fix round 1, F5: positive control for the descriptor extractor before it
    // is trusted on the real srcset. The old assertion here
    // (`Math.min(widths) <= 256`) tested Next's `imageSizes` config, not this
    // component, and a typo in the pattern would have read as a pass.
    expect(srcsetWidths("/a.png?w=16 16w, /a.png?w=64 64w, /a.png?w=384 384w")).toEqual([
      16, 64, 384,
    ]);
    expect(srcsetWidths("/a.png")).toEqual([]);

    const widths = srcsetWidths(mascot.getAttribute("srcset") ?? "");
    expect(widths.length).toBeGreaterThan(0);
    // A variant that actually fits the slot at DPR 2 must be on offer,
    // otherwise the `sizes` hint above buys nothing.
    expect(Math.min(...widths)).toBeLessThanOrEqual(slot * 2);
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
