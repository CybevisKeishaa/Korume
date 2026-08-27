import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Problem } from "./problem";
import en from "@/messages/en/marketing.json";

const CHIP_NAMES = [
  "Vocabulary",
  "Grammar",
  "Kanji",
  "Pronunciation",
  "Listening",
  "SRS Review",
] as const;

describe("Problem", () => {
  it("renders all six capability chips", async () => {
    const { container } = render(await Problem());

    const chips = container.querySelectorAll("[data-chip]");
    expect(chips).toHaveLength(6);
    expect(CHIP_NAMES).toHaveLength(6);
    for (const name of CHIP_NAMES) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it("gives every chip a DISTINCT sub-label — the frame repeats one placeholder six times", async () => {
    const { container } = render(await Problem());

    const details = Array.from(container.querySelectorAll("[data-chip-detail]")).map(
      (el) => el.textContent,
    );
    expect(details).toHaveLength(6);
    expect(new Set(details).size).toBe(6);
  });

  it("never renders the frame's placeholder sub-label", async () => {
    const { container } = render(await Problem());

    expect(container.textContent).not.toContain("Learn in context");
  });

  it("centres the example sentence the six chips are about", async () => {
    render(await Problem());

    expect(screen.getByText("この店、思ったより安いね。")).toBeInTheDocument();
    expect(screen.getByText("This place is cheaper than I thought.")).toBeInTheDocument();
  });

  it("marks the constellation connectors decorative and hides them from assistive tech", async () => {
    const { container } = render(await Problem());

    const connectors = container.querySelectorAll("[data-connector]");
    expect(connectors).toHaveLength(1);
    expect(connectors[0]).toHaveAttribute("aria-hidden", "true");
  });

  it("holds the learner photograph as a pending asset slot", async () => {
    const { container } = render(await Problem());

    expect(container.querySelectorAll('[data-asset-pending="true"]')).toHaveLength(1);
  });

  it("renders every leaf of the problem catalog subtree (dropped-key guard)", async () => {
    // Walks messages/en/marketing.json's `problem` subtree and collects every
    // string leaf, e.g. {a: {b: "x"}} -> [["a.b", "x"]]. Mirrors
    // site-footer.test.tsx / hero.test.tsx's equivalent guard, added there
    // after footer.note.heading/body shipped once with no test asserting
    // catalog coverage, only specific labels.
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

    const allLeaves = collectLeaves(en.problem);

    // No exclusions: every problem leaf renders as plain visible text,
    // including `photoAlt`, which `AssetSlot`'s pending branch renders as
    // both an `aria-label` AND visible `<span>` text (as hero's
    // `video.stillAlt` does).
    //
    // Explicit count (CLAUDE.md §7 / docs/lessons.md L-004): the walk must
    // find exactly the catalog's current shape, so an empty or mis-scoped
    // walk cannot pass vacuously, and a later task that adds a problem key
    // without rendering it drops this count.
    expect(allLeaves).toHaveLength(18);

    const { container } = render(await Problem());
    const renderedText = container.textContent ?? "";

    for (const { path, text } of allLeaves) {
      expect(renderedText, `problem.${path} = ${JSON.stringify(text)} did not render`).toContain(
        text,
      );
    }
  });
});
