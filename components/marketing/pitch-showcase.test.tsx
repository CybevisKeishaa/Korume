import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { PitchShowcase } from "./pitch-showcase";
import en from "@/messages/en/marketing.json";

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
    // Fix round 1, F3: `stroke-primary-strong` vs `stroke-muted-foreground`
    // alone is a colour-only distinction. Mirrors
    // `pitch-contour-overlay.tsx`, which dashes the reference stroke and
    // keeps the user stroke solid — the native contour here plays that same
    // reference-analogue role, so it gets the dash.
    const { container } = render(await PitchShowcase());

    const native = container.querySelector('[data-contour="native"]');
    const you = container.querySelector('[data-contour="you"]');
    expect(native?.getAttribute("stroke-dasharray")).toBeTruthy();
    expect(you?.getAttribute("stroke-dasharray")).toBeFalsy();

    // The legend repeats the same distinction as a small line icon next to
    // each label, not just a colour swatch.
    const legendLines = container.querySelectorAll(
      "svg[aria-hidden='true'] line",
    );
    expect(legendLines).toHaveLength(2);
    const dashed = Array.from(legendLines).map((line) =>
      Boolean(line.getAttribute("stroke-dasharray")),
    );
    expect(dashed).toEqual([true, false]);
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

    const scores = ["86/100", "84/100", "82/100", "90/100"];
    for (const score of scores) {
      expect(screen.getByText(score)).toBeInTheDocument();
    }
    expect(screen.getByText("87")).toBeInTheDocument();
    expect(screen.getByText("Great!")).toBeInTheDocument();
  });

  it("renders the mascot from a manifested pose, not a Blender render", async () => {
    const { container } = render(await PitchShowcase());

    const mascot = container.querySelector("[data-mascot]");
    expect(mascot).not.toBeNull();
    // Only `scripts/mascot/extract.js` writes into poses/, and
    // `scripts/mascot/poses.test.ts` pins that directory to the manifest, so
    // asserting the path is asserting recorded provenance (spec §5.2).
    expect(mascot?.getAttribute("src")).toBe("/mascot/poses/noting.png");
    expect(mascot?.getAttribute("src")).not.toContain("/renders/");
    // The alpha channel is what retired the screen-blend workaround; if that
    // class comes back, the asset is being composited the old, placement-
    // constraining way.
    expect(mascot?.className ?? "").not.toContain("mix-blend");
    // Decorative: the section's meaning must not depend on it.
    expect(mascot?.getAttribute("alt")).toBe("");
    expect(mascot?.getAttribute("aria-hidden")).toBe("true");
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
    const EXCLUDED_LEAF_KEYS = new Set(["chartLabel"]);
    const coveredLeaves = allLeaves.filter((leaf) => {
      const leafKey = leaf.path.split(".").at(-1);
      return leafKey !== undefined && !EXCLUDED_LEAF_KEYS.has(leafKey);
    });

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
});
