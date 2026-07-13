import { describe, expect, it } from "vitest";
import { makeSilenceBuffer, makeToneBuffer } from "@/test/audio-fixtures";
import { medianVoicedHz } from "./contour";
import { contourFromSamples } from "./pipeline";

describe("contourFromSamples", () => {
  it("extracts a contour whose voiced pitch matches a pure tone", () => {
    const contour = contourFromSamples(makeToneBuffer(150, 16000, 0.5), 16000);

    expect(contour).not.toBeNull();
    const median = medianVoicedHz(contour!.frames);
    expect(median).not.toBeNull();
    expect(median!).toBeGreaterThan(140);
    expect(median!).toBeLessThan(160);
  });

  it("returns null for silence (no voiced frames)", () => {
    expect(contourFromSamples(makeSilenceBuffer(16000, 0.5), 16000)).toBeNull();
  });

  it("returns null for an empty buffer", () => {
    expect(contourFromSamples(new Float32Array(0), 16000)).toBeNull();
  });
});
