import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PitchAccentScore, PitchOverlayPoint } from "@/lib/pitch";
import { PitchContourOverlay } from "./pitch-contour-overlay";

function makeScore(overrides: Partial<PitchAccentScore> = {}): PitchAccentScore {
  const overlay: PitchOverlayPoint[] = [
    { t: 0, userSemitones: 0, refSemitones: 0.5 },
    { t: 0.25, userSemitones: 1, refSemitones: 1.2 },
    { t: 0.5, userSemitones: 2, refSemitones: 1.8 },
    { t: 0.75, userSemitones: 0.5, refSemitones: 0.4 },
    { t: 1, userSemitones: -1, refSemitones: -0.8 },
  ];
  return {
    score: 82.4,
    voicedOverlap: 0.9,
    confidence: 1,
    lowConfidence: false,
    overlay,
    ...overrides,
  };
}

describe("PitchContourOverlay", () => {
  it("renders an accessible image with both contours and a legend", () => {
    render(<PitchContourOverlay score={makeScore()} />);

    expect(
      screen.getByRole("img", { name: /pitch comparison/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("reference-contour")).toBeInTheDocument();
    expect(screen.getByTestId("user-contour")).toBeInTheDocument();
    expect(screen.getByText(/お手本/)).toBeInTheDocument();
    expect(screen.getByText(/あなた/)).toBeInTheDocument();
  });

  it("shows the rounded intonation score", () => {
    render(<PitchContourOverlay score={makeScore({ score: 82.4 })} />);

    expect(screen.getByText(/イントネーション/)).toBeInTheDocument();
    expect(screen.getByText("82")).toBeInTheDocument();
  });

  it("reveals the user contour with the shared stroke-draw animation", () => {
    render(<PitchContourOverlay score={makeScore()} />);

    const userPath = screen.getByTestId("user-contour");
    expect(userPath).toHaveClass("stroke-draw");
    expect(userPath).toHaveAttribute("pathLength", "1");
  });

  it("breaks the user line at unvoiced gaps instead of bridging them", () => {
    const score = makeScore();
    score.overlay[2] = { t: 0.5, userSemitones: null, refSemitones: 1.8 };

    render(<PitchContourOverlay score={score} />);

    const d = screen.getByTestId("user-contour").getAttribute("d") ?? "";
    expect(d.match(/M/g)?.length).toBe(2);
  });

  it("replaces the score with a low-confidence explanation when overlap is too small", () => {
    render(
      <PitchContourOverlay
        score={makeScore({ score: 0, lowConfidence: true, confidence: 0.2 })}
      />,
    );

    expect(screen.queryByText(/イントネーション/)).not.toBeInTheDocument();
    expect(screen.getByText(/not enough voiced audio/i)).toBeInTheDocument();
  });
});
