import { describe, expect, it } from "vitest";
import { parseTranscript } from "@/lib/transcript";
import {
  TRANSCRIPT_PLAIN_TEXT_FIXTURE,
  TRANSCRIPT_SRT_FIXTURE,
  TRANSCRIPT_VTT_FIXTURE,
  TRANSCRIPT_VTT_WITH_TRANSLATION_FIXTURE,
} from "./transcripts";

describe("transcript fixtures against the real lib/transcript parser", () => {
  it("plain/SRT/VTT fixtures parse to exactly their `expected` array", () => {
    expect(parseTranscript(TRANSCRIPT_PLAIN_TEXT_FIXTURE.source)).toEqual(
      TRANSCRIPT_PLAIN_TEXT_FIXTURE.expected,
    );
    expect(parseTranscript(TRANSCRIPT_SRT_FIXTURE.source)).toEqual(
      TRANSCRIPT_SRT_FIXTURE.expected,
    );
    expect(parseTranscript(TRANSCRIPT_VTT_FIXTURE.source)).toEqual(
      TRANSCRIPT_VTT_FIXTURE.expected,
    );
  });

  // lib/transcript/parse.ts currently joins every text line in a cue into a
  // single `textJp` (no translation-line splitting), so this fixture's
  // `expected` (separate textJp/textTranslation) documents a target shape,
  // not current parser output. Flagged as an open gap in the handoff.
  it("the translation fixture's source is well-formed for a future bilingual parser", () => {
    const currentBehavior = parseTranscript(
      TRANSCRIPT_VTT_WITH_TRANSLATION_FIXTURE.source,
    );
    expect(currentBehavior).toHaveLength(
      TRANSCRIPT_VTT_WITH_TRANSLATION_FIXTURE.expected.length,
    );
    expect(currentBehavior.every((l) => l.textTranslation === undefined)).toBe(
      true,
    );
  });
});

// Structural sanity checks on the fixtures themselves.
describe("transcript fixtures", () => {
  it("plain text fixture has null end times and increasing start times", () => {
    const { expected } = TRANSCRIPT_PLAIN_TEXT_FIXTURE;
    expect(expected.every((l) => l.endTime === null)).toBe(true);
    for (let i = 1; i < expected.length; i++) {
      expect(expected[i]!.startTime).toBeGreaterThan(expected[i - 1]!.startTime);
    }
  });

  it("SRT and VTT fixtures parse to the same line content (only source syntax differs)", () => {
    expect(TRANSCRIPT_VTT_FIXTURE.expected).toEqual(TRANSCRIPT_SRT_FIXTURE.expected);
  });

  it("every SRT/VTT cue has a non-null end time after its start time", () => {
    for (const fixture of [TRANSCRIPT_SRT_FIXTURE, TRANSCRIPT_VTT_FIXTURE]) {
      for (const line of fixture.expected) {
        expect(line.endTime).not.toBeNull();
        expect(line.endTime as number).toBeGreaterThan(line.startTime);
      }
    }
  });

  it("the translation fixture carries textTranslation on every line", () => {
    for (const line of TRANSCRIPT_VTT_WITH_TRANSLATION_FIXTURE.expected) {
      expect(line.textTranslation).toBeTruthy();
    }
  });

  it("source strings are non-empty and contain the header/marker for their format", () => {
    expect(TRANSCRIPT_SRT_FIXTURE.source).toMatch(/-->/);
    expect(TRANSCRIPT_VTT_FIXTURE.source).toMatch(/^WEBVTT/);
    expect(TRANSCRIPT_PLAIN_TEXT_FIXTURE.source).toMatch(/^\[\d{2}:\d{2}\]/);
  });
});
