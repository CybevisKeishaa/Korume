import { describe, expect, it } from "vitest";
import en from "./dictation.json";

/**
 * Characterization test for `dictation.json` (Task 11b): the literal `toBe`
 * pin against the catalog, per the standing convention from the Task 10
 * review (`toHaveTextContent` given a string is a CONTAINMENT match, not
 * equality — it is `components/video-player/dictation-view.test.tsx`'s job
 * to prove the RTL wiring; this file's job is to pin every leaf byte-exact).
 * Every expected value below is a literal copied verbatim from the
 * pre-extraction source of `components/video-player/dictation-view.tsx` and
 * `app/[locale]/(app)/videos/[id]/dictation/page.tsx` on
 * `layer-9a-string-extraction` before Task 11b (never derived from the
 * catalog itself — binding pattern 2).
 */
describe("dictation.json EN — dictation-view.tsx + dictation/page.tsx literals", () => {
  it("pins the page's subtitle", () => {
    expect(en.title).toBe("Dictation practice");
  });

  it("pins the no-transcript hint", () => {
    expect(en.noTranscript.title).toBe("No transcript yet");
    expect(en.noTranscript.body).toBe(
      "This video doesn't have a transcript to dictate yet. Transcript submission is coming soon.",
    );
  });

  it("pins the line-position counter", () => {
    expect(en.lineCount).toBe("Line {current} of {total}");
  });

  it("pins the line-navigation controls", () => {
    expect(en.controls.previous).toBe("Previous line");
    expect(en.controls.replay).toBe("Replay line");
    expect(en.controls.next).toBe("Next line");
  });

  it("pins the dictation input's accessible label", () => {
    expect(en.inputLabel).toBe("Type what you hear (Japanese)");
  });

  it("pins the submit button's idle and pending labels", () => {
    expect(en.submit).toBe("Submit");
    // "Scoring..." is the only EN pending-state string in the whole catalog
    // set using ASCII "..." — every sibling (common.states.loading,
    // videos.importing, vocab.generating, ...) uses the U+2026 ellipsis
    // character. That is deliberate byte-identity with the pre-extraction
    // source (spec D3/D6), not an oversight: do not "fix" it to match the
    // others, or this pin and dictation-view.test.tsx both break.
    expect(en.submitting).toBe("Scoring...");
  });

  it("pins the reveal/hide answer toggle", () => {
    expect(en.reveal).toBe("Reveal answer");
    expect(en.hide).toBe("Hide answer");
  });

  it("pins the attempt-submission error messages", () => {
    expect(en.errors.signIn).toBe("Sign in to submit a dictation attempt.");
    expect(en.errors.scoreFailed).toBe(
      "That attempt couldn't be scored. Please try again.",
    );
  });

  it("pins the accuracy line — {accuracy}, never ICU # (# runs through Intl.NumberFormat)", () => {
    expect(en.accuracy).toBe("Accuracy: {accuracy}%");
  });

  it("pins the per-character sr-only diff descriptions", () => {
    expect(en.diff.wrongSr).toBe(" wrong, expected {expected}");
    expect(en.diff.missingSr).toBe(" missing");
    expect(en.diff.extraSr).toBe(" extra, not scored");
  });

  it("pins the sr-only scored summary, byte-identical to the old string-concatenation output", () => {
    expect(en.diff.summary).toBe(
      "{match} correct, {wrong} wrong, {missing} missing, {extra} extra characters (extra characters are shown but not scored).",
    );
  });

  it("pins the visible legend's words (the aria-hidden glyphs are untranslated JSX decoration)", () => {
    expect(en.legend.wrong).toBe("wrong");
    expect(en.legend.missing).toBe("missing (counted)");
  });

  it("pins the rich-text 'extra' legend item — the tag wraps only the word 'extra'", () => {
    expect(en.legend.extra).toBe("<strike>extra</strike> — shown, not scored");
  });
});
