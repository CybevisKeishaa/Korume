import { readFileSync } from "node:fs";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { PracticePanel } from "./practice-panel";

describe("PracticePanel", () => {
  it("renders the labelled navigator, practice and feedback slots in order", () => {
    render(<PracticePanel label="Pronunciation practice" navigator={<nav>Navigator</nav>} feedback={<aside>Feedback</aside>}><main>Practice</main></PracticePanel>);
    const panel = screen.getByRole("region", { name: "Pronunciation practice" });
    expect(panel.tagName).toBe("SECTION");
    const slots = Array.from(panel.children);
    expect(slots).toHaveLength(3);
    expect(slots.map((slot) => slot.textContent)).toEqual(["Navigator", "Practice", "Feedback"]);
  });

  it("owns the panel scrollbar within the available workspace height", () => {
    render(<PracticePanel label="Practice" navigator="Navigator" feedback="Feedback">Practice</PracticePanel>);
    const panel = screen.getByTestId("practice-panel");
    expect(panel).toHaveClass("h-full", "min-h-0", "overflow-y-auto");
    const scrollers = [panel, ...Array.from(panel.querySelectorAll("*"))].filter((element) => element.classList.contains("overflow-y-auto"));
    expect(scrollers).toHaveLength(1);
    expect(scrollers[0]).toBe(panel);
  });

  it("makes the action row a full-bleed footer flush with the panel's bottom edge (owner 2026-10-31)", () => {
    render(<PracticePanel label="Practice" navigator="Navigator" feedback="Feedback" actions={<button type="button">Check</button>}>Practice</PracticePanel>);
    const footer = screen.getByTestId("practice-actions");
    // bottom-0 left the panel's padding strip under it (content showed through); -mx-md: no inset box; mt-auto: never mid-panel.
    expect(footer).toHaveClass("sticky", "bottom-[calc(-1*var(--space-md))]", "-mx-md", "-mb-md", "mt-auto", "border-t");
    expect(footer).not.toHaveClass("bottom-0");
  });

  it("retains overflow-hidden on both existing workspace root layouts", () => {
    const shell = readFileSync("components/shadowing-workspace/workspace-shell.tsx", "utf8");
    const roots = shell.match(/relative isolate grid h-dvh[^\"]*/g) ?? [];
    expect(roots).toHaveLength(2);
    for (const root of roots) expect(root.split(" ")).toContain("overflow-hidden");
  });
});
