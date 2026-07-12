/**
 * Transcript fixtures for `lib/transcript`'s `parseTranscript`.
 *
 * `ParsedTranscriptLine` re-exports the real `lib/transcript` `ParsedLine`
 * type under the name given in the A0 task spec, so this file type-checks
 * against the actual parser output shape instead of drifting from it. The
 * `*_FIXTURE` constants pair raw source text with the exact parsed array the
 * parser returns; `transcripts.test.ts` asserts `parseTranscript(source)`
 * deep-equals `expected` for the plain/SRT/VTT fixtures.
 *
 * Plain-text transcripts carry no explicit end time, so `endTime` is always
 * `null` for that format; SRT/VTT cues always have both.
 *
 * NOTE: `TRANSCRIPT_VTT_WITH_TRANSLATION_FIXTURE` documents a target shape
 * (separate `textJp`/`textTranslation`) that `lib/transcript/parse.ts` does
 * NOT yet implement — it currently merges every text line in a cue into one
 * `textJp`. See the handoff notes for this open gap.
 */
import type { ParsedLine } from "@/lib/transcript";

export type ParsedTranscriptLine = ParsedLine;

export interface TranscriptFixture {
  /** Raw source text, as it would be pasted/uploaded. */
  source: string;
  /** The parsed line array a correct parser must produce for `source`. */
  expected: ParsedTranscriptLine[];
}

/** Plain text: one `[MM:SS] line` per row, no end times. */
export const TRANSCRIPT_PLAIN_TEXT_FIXTURE: TranscriptFixture = {
  source: [
    "[00:00] こんにちは、皆さん。",
    "[00:03] 今日は日本語を勉強しましょう。",
    "[00:07] 頑張ってください!",
    "",
  ].join("\n"),
  expected: [
    { startTime: 0, endTime: null, textJp: "こんにちは、皆さん。" },
    { startTime: 3, endTime: null, textJp: "今日は日本語を勉強しましょう。" },
    { startTime: 7, endTime: null, textJp: "頑張ってください!" },
  ],
};

/** SRT: numbered cues with `HH:MM:SS,mmm --> HH:MM:SS,mmm` timing. */
export const TRANSCRIPT_SRT_FIXTURE: TranscriptFixture = {
  source: [
    "1",
    "00:00:00,000 --> 00:00:03,500",
    "こんにちは、皆さん。",
    "",
    "2",
    "00:00:03,500 --> 00:00:07,200",
    "今日は日本語を勉強しましょう。",
    "",
    "3",
    "00:00:07,200 --> 00:00:10,000",
    "頑張ってください!",
    "",
  ].join("\n"),
  expected: [
    { startTime: 0, endTime: 3.5, textJp: "こんにちは、皆さん。" },
    { startTime: 3.5, endTime: 7.2, textJp: "今日は日本語を勉強しましょう。" },
    { startTime: 7.2, endTime: 10, textJp: "頑張ってください!" },
  ],
};

/** WebVTT: `WEBVTT` header + `HH:MM:SS.mmm --> HH:MM:SS.mmm` cues (dot, not comma). */
export const TRANSCRIPT_VTT_FIXTURE: TranscriptFixture = {
  source: [
    "WEBVTT",
    "",
    "00:00:00.000 --> 00:00:03.500",
    "こんにちは、皆さん。",
    "",
    "00:00:03.500 --> 00:00:07.200",
    "今日は日本語を勉強しましょう。",
    "",
    "00:00:07.200 --> 00:00:10.000",
    "頑張ってください!",
    "",
  ].join("\n"),
  expected: TRANSCRIPT_SRT_FIXTURE.expected,
};

/** WebVTT variant where each cue has a second line: JP text then translation. */
export const TRANSCRIPT_VTT_WITH_TRANSLATION_FIXTURE: TranscriptFixture = {
  source: [
    "WEBVTT",
    "",
    "00:00:00.000 --> 00:00:03.500",
    "こんにちは、皆さん。",
    "Hello, everyone.",
    "",
    "00:00:03.500 --> 00:00:07.200",
    "今日は日本語を勉強しましょう。",
    "Let's study Japanese today.",
    "",
  ].join("\n"),
  expected: [
    {
      startTime: 0,
      endTime: 3.5,
      textJp: "こんにちは、皆さん。",
      textTranslation: "Hello, everyone.",
    },
    {
      startTime: 3.5,
      endTime: 7.2,
      textJp: "今日は日本語を勉強しましょう。",
      textTranslation: "Let's study Japanese today.",
    },
  ],
};
