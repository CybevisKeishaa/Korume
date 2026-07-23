import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { FuriganaModeControl, LoopControls, SpeedControl } from "./playback-controls";

/**
 * Characterization test for `playback-controls.tsx` (Task 11c) — the file had
 * no test file at all before this task (binding hazard 1). Written BEFORE the
 * strings are extracted to `shadowing.player.*` (Task 11c promoted them to
 * `common.player.*`; Task 19's by-surface audit demoted them back to
 * `shadowing.*`); it must pass while the strings are still hardcoded, then
 * again unchanged once `t()` replaces the literals
 * — a failure after extraction means the extraction changed user-visible
 * copy, not that the test needs updating (binding pattern 1).
 *
 * Every expected value below is a literal copied verbatim from the
 * pre-extraction source of `components/video-player/playback-controls.tsx`
 * on `layer-9a-string-extraction` before Task 11c (never derived from the
 * catalog itself — binding pattern 2).
 */
describe("SpeedControl", () => {
  it("renders the accessible group label and one radio per speed", () => {
    render(<SpeedControl value={1} onChange={vi.fn()} />);
    expect(screen.getByRole("radiogroup", { name: "Playback speed" })).toBeInTheDocument();
    for (const label of ["0.5x", "0.75x", "1x", "1.25x"]) {
      expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
    }
  });

  it("marks the active speed as checked", () => {
    render(<SpeedControl value={1.25} onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "1.25x" })).toHaveAttribute("aria-checked", "true");
  });
});

describe("LoopControls", () => {
  it("shows Set A / Set B with no time suffix and no Clear button when neither loop point is set", () => {
    const { container } = render(
      <LoopControls loopA={null} loopB={null} onSetA={vi.fn()} onSetB={vi.fn()} onClear={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Set A" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set B" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear loop" })).not.toBeInTheDocument();

    // hazard 4: the wrapping group's aria-label carries an EN DASH (U+2013),
    // not a hyphen (U+2D) — verified here at the codepoint level, by
    // rendering, not by reasoning.
    const group = container.querySelector("[aria-label]");
    expect(group?.getAttribute("aria-label")).toBe("A–B loop");
    expect(group?.getAttribute("aria-label")).not.toBe("A-B loop");
  });

  it("appends the formatted time to Set A / Set B once each loop point is set, and shows Clear", () => {
    render(
      <LoopControls loopA={65} loopB={130} onSetA={vi.fn()} onSetB={vi.fn()} onClear={vi.fn()} />,
    );
    // hazard 3: verify byte-identity of the composed label in BOTH branches
    // (with a suffix, and — above — without one) by rendering.
    expect(screen.getByRole("button", { name: "Set A (1:05)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set B (2:10)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear loop" })).toBeInTheDocument();
  });
});

describe("FuriganaModeControl", () => {
  it("renders the accessible group label and all three mode labels", () => {
    render(<FuriganaModeControl value="adaptive" onChange={vi.fn()} />);
    expect(screen.getByRole("radiogroup", { name: "Furigana" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Adaptive" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Off" })).toBeInTheDocument();
  });

  it("marks the selected mode as checked", () => {
    render(<FuriganaModeControl value="off" onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "Off" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Adaptive" })).toHaveAttribute("aria-checked", "false");
  });
});
