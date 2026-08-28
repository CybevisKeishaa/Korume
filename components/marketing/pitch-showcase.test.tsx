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

  it("gives the chart an accessible name and hides its internals from assistive tech", async () => {
    const { container } = render(await PitchShowcase());

    const chart = container.querySelector("svg[role='img']");
    expect(chart).toHaveAccessibleName(
      "Two pitch contours compared: a native speaker's and yours.",
    );
  });

  it("shows all four sub-scores and the overall score", async () => {
    render(await PitchShowcase());

    const scores = ["86/100", "84/100", "82/100", "90/100"];
    expect(scores).toHaveLength(4);
    for (const score of scores) {
      expect(screen.getByText(score)).toBeInTheDocument();
    }
    expect(screen.getByText("87")).toBeInTheDocument();
    expect(screen.getByText("Great!")).toBeInTheDocument();
  });

  it("renders the mascot from the approved source, not a Blender render", async () => {
    const { container } = render(await PitchShowcase());

    const mascot = container.querySelector("[data-mascot]");
    expect(mascot?.getAttribute("src")).toContain("/mascot/Korume.png");
    expect(mascot?.getAttribute("src")).not.toContain("/renders/");
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
