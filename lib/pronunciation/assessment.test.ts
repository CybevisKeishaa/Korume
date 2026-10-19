import { describe, expect, it } from "vitest";
import { readAssessment, toAssessment } from "./assessment";
import type { PronunciationAssessmentResult } from "@/lib/speech-types";

const result: PronunciationAssessmentResult = {
  recognizedText: "今日は", pronunciationScore: 80, fluencyScore: 70, accuracyScore: 81, completenessScore: 90,
  words: [{ word: "今日", accuracyScore: 85, errorType: "None" }],
};

describe("assessment", () => {
  it("maps an Azure result to v1", () => {
    expect(toAssessment(result)).toEqual({
      v: 1, accuracy: 81, completeness: 90, recognizedText: "今日は",
      words: [{ word: "今日", accuracy: 85, errorType: "None" }],
    });
  });

  it("reads null for unknown versions, junk and partial-invalid objects", () => {
    expect(readAssessment(null)).toBeNull();
    expect(readAssessment({ v: 2, accuracy: 1 })).toBeNull();
    expect(readAssessment({ v: 1, accuracy: "high" })).toBeNull();
    expect(readAssessment([])).toBeNull();
    const valid = toAssessment(result);
    expect(readAssessment({ ...valid, v: 2 })).toBeNull();
    expect(readAssessment({ ...valid, accuracy: -1 })).toBeNull();
    expect(readAssessment({ ...valid, completeness: 101 })).toBeNull();
    expect(readAssessment({ ...valid, accuracy: NaN })).toBeNull();
    expect(readAssessment({ ...valid, recognizedText: "a".repeat(1001) })).toBeNull();
    expect(readAssessment({ ...valid, words: [{ word: "今日", accuracy: 90, errorType: "Other" }] })).toBeNull();
    expect(readAssessment({ ...valid, words: [{ word: "a".repeat(101), accuracy: 90, errorType: "None" }] })).toBeNull();
    expect(readAssessment({ ...valid, words: Array.from({ length: 201 }, () => ({ word: "今日", accuracy: 85, errorType: "None" })) })).toBeNull();
  });

  it("keeps nullable fields null", () => {
    expect(readAssessment({ v: 1, accuracy: null, completeness: null, recognizedText: null, words: null }))
      .toEqual({ v: 1, accuracy: null, completeness: null, recognizedText: null, words: null });
  });

  it("preserves zero scores and empty word detail", () => {
    expect(toAssessment({ ...result, accuracyScore: 0, completenessScore: 0, recognizedText: "", words: [] }))
      .toEqual({ v: 1, accuracy: 0, completeness: 0, recognizedText: null, words: [] });
  });

  it("keeps missing Azure detail null", () => {
    // Provider payloads can omit detail even though the legacy result type requires it.
    const absent = { pronunciationScore: 80, fluencyScore: 70 } as PronunciationAssessmentResult;
    expect(toAssessment(absent)).toEqual({ v: 1, accuracy: null, completeness: null, recognizedText: null, words: null });
  });
});
