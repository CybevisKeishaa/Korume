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

  it("draws step 3's waveform as a contour, not as bars", async () => {
    const { container } = render(await Journey());

    const shadow = container.querySelector('[data-step="shadow"]');
    expect(shadow?.querySelectorAll("[data-contour]")).toHaveLength(1);
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
    const renderedText = container.textContent ?? "";

    for (const { path, text } of allLeaves) {
      expect(renderedText, `journey.${path} = ${JSON.stringify(text)} did not render`).toContain(
        text,
      );
    }
  });
});
