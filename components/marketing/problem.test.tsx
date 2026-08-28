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

  it("gives every chip its own decorative line icon, hidden from assistive tech", async () => {
    // Task A1 (spec §13.1.2): the chips shipped as label-only rectangles. The
    // icons are pure decoration — every chip's meaning stays in its own text —
    // so they must be out of the accessibility tree AND out of the tab order.
    const { container } = render(await Problem());

    const icons = Array.from(container.querySelectorAll("[data-chip-icon]"));
    expect(icons).toHaveLength(6);

    expect(new Set(icons.map((el) => el.getAttribute("data-chip-icon")))).toEqual(
      new Set(["vocabulary", "grammar", "kanji", "pronunciation", "listening", "srs"]),
    );

    for (const icon of icons) {
      const key = icon.getAttribute("data-chip-icon");
      expect(icon, `${key} icon`).toHaveAttribute("aria-hidden", "true");
      expect(icon, `${key} icon`).toHaveAttribute("focusable", "false");
      expect(icon.closest("[data-chip]"), `${key} icon is not inside a chip`).not.toBeNull();
    }
  });

  it("draws SIX DIFFERENT glyphs, not one repeated six times", async () => {
    // The cheap failure a presence check would pass: six chips, one icon. The
    // subject is the rendered drawing, not the key the caller passed in.
    const { container } = render(await Problem());

    const shapes = Array.from(container.querySelectorAll("[data-chip-icon]")).map(
      (el) => el.innerHTML,
    );
    expect(shapes).toHaveLength(6);
    for (const shape of shapes) {
      expect(shape.length).toBeGreaterThan(0);
    }
    expect(new Set(shapes).size).toBe(6);
  });

  it("draws the constellation as three per-column layers with no stretched viewBox", async () => {
    // The defect this replaces: one overlay with `preserveAspectRatio="none"`
    // over a square viewBox, which sheared the rays and made the stroke width
    // and dash rhythm differ ray to ray. jsdom does no layout and CANNOT see
    // that the dashes are now even — what it CAN prove is that the stretching
    // attribute is gone and each column carries its own layer.
    const { container } = render(await Problem());

    const layer = container.querySelector("[data-connector]");
    expect(layer).not.toBeNull();

    const columns = Array.from(container.querySelectorAll("[data-connector-column]"));
    expect(columns).toHaveLength(3);
    expect(columns.map((el) => el.getAttribute("data-connector-column"))).toEqual([
      "left",
      "centre",
      "right",
    ]);

    for (const column of columns) {
      const name = column.getAttribute("data-connector-column");
      expect(column, `${name} column`).toHaveAttribute("focusable", "false");
      expect(column.getAttribute("preserveAspectRatio"), `${name} column`).toBeNull();
    }
  });

  it("keeps the connector layer unreachable and non-interactive", async () => {
    const { container } = render(await Problem());

    const layer = container.querySelector("[data-connector]");
    expect(layer).not.toBeNull();
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer?.className).toContain("pointer-events-none");

    // Non-empty subject first (docs/lessons.md L-004): the layer really does
    // hold three drawings, so "no focusable descendant" is not vacuously true.
    expect(container.querySelectorAll("[data-connector] svg")).toHaveLength(3);
    expect(
      container.querySelectorAll(
        "[data-connector] a, [data-connector] button, [data-connector] input, [data-connector] [tabindex]",
      ),
    ).toHaveLength(0);
  });

  it("puts a single glowing node at the centre of the constellation", async () => {
    const { container } = render(await Problem());

    const nodes = Array.from(container.querySelectorAll("[data-connector-node]"));
    expect(nodes).toHaveLength(1);

    const [node] = nodes;
    if (!node) throw new Error("no [data-connector-node] was rendered");
    expect(node.closest('[data-connector-column="centre"]')).not.toBeNull();
  });
});
