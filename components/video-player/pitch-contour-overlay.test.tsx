import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { render } from "@/test/render";
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

  it("pairs each legend label with its own swatch — catches a reference/user key swap the plain getByText checks above cannot", () => {
    // Both swatches are aria-hidden, so nothing but the label-to-swatch
    // pairing itself ties お手本 to the dashed line and あなた to the solid
    // one; a `getByText` for each string anywhere in the document would still
    // pass if the two keys were swapped. Scoping the query to each legend
    // item's own container is what actually catches that swap (review
    // finding, Important 1).
    render(<PitchContourOverlay score={makeScore()} />);

    expect(
      within(screen.getByTestId("reference-legend")).getByText("お手本"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("user-legend")).getByText("あなた"),
    ).toBeInTheDocument();
  });

  it("uses the translated default accessible label when no override is passed — proves shadowing.pitch.overlay.a11y.label is wired", () => {
    render(<PitchContourOverlay score={makeScore()} />);

    expect(
      screen.getByRole("img", {
        name: "Pitch comparison: reference (お手本) vs your take",
      }),
    ).toBeInTheDocument();
  });

  it("uses a caller-supplied label instead of the default — proves the prop is threaded through, not silently dropped for the component's own default", () => {
    // Deliberately non-English literal (binding pattern 5, per waveform.test.tsx
    // and pitch-contour.test.tsx): the default label and the EN catalog value
    // are byte-identical, so an EN-only assertion can't tell "translation
    // wired through correctly" from "the prop never arrived and the default
    // rendered". A literal that could not possibly come from the default
    // proves the `label` prop actually reaches the rendered aria-label.
    render(
      <PitchContourOverlay
        score={makeScore()}
        label="So sánh cao độ của lượt thử nghiệm"
      />,
    );

    expect(
      screen.getByRole("img", { name: "So sánh cao độ của lượt thử nghiệm" }),
    ).toBeInTheDocument();
  });

  it("shows the rounded intonation score and its ' / 100' suffix", () => {
    render(<PitchContourOverlay score={makeScore({ score: 82.4 })} />);

    expect(screen.getByText(/イントネーション/)).toBeInTheDocument();
    const scoreEl = screen.getByText("82");
    expect(scoreEl).toBeInTheDocument();
    // pitch.overlay.scoreSuffix ("/ 100") had a correct pin but no render
    // assertion (review finding, Important 3) — assert it on the aria-hidden
    // sibling span immediately after the score itself.
    expect(scoreEl.nextElementSibling).toHaveTextContent("/ 100");
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
