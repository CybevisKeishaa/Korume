import { describe, expect, it } from "vitest";
import en from "./shadowing.json";

/**
 * Characterization test for `shadowing.json` (Task 11c): the literal `toBe`
 * pin against the catalog, per the standing convention from the Task 10
 * review (`toHaveTextContent` given a string is a CONTAINMENT match, not
 * equality — `shadowing-view.test.tsx` / `video-summary-panel.test.tsx`
 * prove the RTL wiring; this file's job is to pin every leaf byte-exact).
 * Every expected value below is a literal copied verbatim from the
 * pre-extraction source of `components/video-player/shadowing-view.tsx` and
 * `components/video-player/video-summary-panel.tsx` on
 * `layer-9a-string-extraction` before Task 11c (never derived from the
 * catalog itself — binding pattern 2).
 */
describe("shadowing.json EN — shadowing-view.tsx literals", () => {
  it("pins the player-error alert (region-lock / private / embed-disabled)", () => {
    expect(en.playerError.title).toBe("This video can't be played here.");
    expect(en.playerError.body).toBe(
      "It may be region-locked, private, or unavailable for embedding.",
    );
  });

  it("pins the no-transcript hint", () => {
    expect(en.noTranscript.title).toBe("No transcript yet");
    expect(en.noTranscript.body).toBe(
      "This video doesn't have a transcript to shadow against yet. Transcript submission is coming soon.",
    );
  });

  it("pins the translation toggle's label", () => {
    expect(en.translationToggle).toBe("Translation");
  });
});

/**
 * `video-summary-panel.tsx` is an AI-labeling compliance surface (CLAUDE.md
 * AI content labeling). `aria-label` and the visible badge get their own
 * isolated `it()` each — not grouped — because Task 8's review found that
 * several assertions sharing one `it()` let the first failure short-circuit
 * past the rest, silently hiding the absence of a compliance pin.
 */
describe("shadowing.json EN — video-summary-panel.tsx AI-labeling compliance surface", () => {
  it("pins the panel's accessible region name", () => {
    expect(en.summary.a11y.region).toBe("AI video summary");
  });

  it("pins the visible AI-generated badge", () => {
    expect(en.summary.aiGenerated).toBe("AI-generated");
  });
});

describe("shadowing.json EN — video-summary-panel.tsx chrome", () => {
  it("pins the heading", () => {
    expect(en.summary.heading).toBe("Summary");
  });

  it("pins the empty state and Generate button", () => {
    expect(en.summary.empty).toBe("No summary yet for this video.");
    expect(en.summary.generate).toBe("Generate summary");
  });

  it("pins the generating-in-progress label", () => {
    expect(en.summary.generating).toBe("Generating summary…");
  });

  it("pins the input-truncated note", () => {
    expect(en.summary.inputTruncated).toBe(
      "Note: the transcript was truncated to summarize it.",
    );
  });

  it("pins the key vocab / key grammar section headings", () => {
    expect(en.summary.keyVocab).toBe("Key vocab");
    expect(en.summary.keyGrammar).toBe("Key grammar");
  });
});

/**
 * `friendlyError`'s status-mapped messages. `errors.generic` is the ONE
 * string that used to appear at two call sites (line 53's `body.error ??`
 * fallback and line 55's catch) — both collapse to this single key now that
 * the panel no longer renders the server's `body.error` text (the defect
 * fix, see the video-summary-panel.test.tsx comment).
 *
 * `errors.generic` ("Could not generate a summary right now.") and
 * `errors.generateFailed` ("Couldn't generate a summary right now.") are
 * NEAR-IDENTICAL but NOT the same string — they differ by contraction
 * ("Could not" vs "Couldn't") and come from different code paths (a non-2xx
 * response vs. a thrown fetch exception in `generate()`'s catch). English is
 * frozen (spec D3/D6); kept as two distinct catalog entries per the binding
 * instruction not to silently unify near-identical strings.
 */
describe("shadowing.json EN — friendlyError status mapping", () => {
  it("pins the 422 (no transcript to summarize) message", () => {
    expect(en.summary.errors.noTranscript).toBe(
      "This video has no transcript to summarize yet.",
    );
  });

  it("pins the 503 (not configured) message", () => {
    expect(en.summary.errors.unavailable).toBe(
      "AI summarization isn't set up yet for this deployment.",
    );
  });

  it("pins the 429 message with a numeric Retry-After", () => {
    expect(en.summary.errors.rateLimited).toBe(
      "Too many summary requests — try again in {seconds}s.",
    );
  });

  it("pins the 429 message without a usable Retry-After", () => {
    expect(en.summary.errors.rateLimitedGeneric).toBe(
      "Too many summary requests — please wait a moment and try again.",
    );
  });

  it("pins the generic non-2xx fallback (was `body.error ?? \"...\"` — no longer renders body.error, see the defect fix)", () => {
    expect(en.summary.errors.generic).toBe("Could not generate a summary right now.");
  });

  it("pins the generate() thrown-exception fallback (distinct from errors.generic above)", () => {
    expect(en.summary.errors.generateFailed).toBe("Couldn't generate a summary right now.");
  });

  it("pins the initial-load thrown-exception fallback", () => {
    expect(en.summary.errors.loadFailed).toBe("Couldn't load the summary.");
  });
});

/**
 * Task 11d: `useRecorder` (`components/video-player/recorder.tsx`). Every
 * expected value below is a literal copied verbatim from `recorder.tsx` on
 * `layer-9a-string-extraction` before Task 11d (never derived from the
 * catalog itself — binding pattern 2). Apostrophes are ASCII U+0027 in the
 * source (`isn't`, `Couldn't`) — verified against the pre-extraction file
 * with a codepoint dump, not eyeballed.
 */
describe("shadowing.json EN — recorder.tsx (useRecorder) error messages", () => {
  it("pins the mic-permission-denied message", () => {
    expect(en.recorder.errors.micDenied).toBe(
      "Microphone access was denied. Allow microphone access in your browser settings to record.",
    );
  });

  it("pins the no-microphone-found message", () => {
    expect(en.recorder.errors.micNotFound).toBe(
      "No microphone was found. Connect a microphone and try again.",
    );
  });

  it("pins the generic getUserMedia-rejection fallback", () => {
    expect(en.recorder.errors.micUnavailable).toBe(
      "Couldn't access your microphone. Check your device and try again.",
    );
  });

  it("pins the unsupported-browser message", () => {
    expect(en.recorder.errors.notSupported).toBe(
      "Recording isn't supported in this browser.",
    );
  });

  it("pins the MediaRecorder onerror message", () => {
    expect(en.recorder.errors.recordingFailed).toBe("Recording failed. Try again.");
  });
});

/**
 * Task 11d: `PitchContour` (`components/video-player/pitch-contour.tsx`).
 * `a11y.label` is the component's default `label` prop value — binding
 * pattern 5 requires this pin PLUS an RTL test proving the prop threads a
 * non-English override (see `pitch-contour.test.tsx`), because an EN-only
 * assertion can't distinguish correctly-threaded i18n from the component's
 * own hardcoded English fallback.
 */
describe("shadowing.json EN — pitch-contour.tsx (PitchContour) literals", () => {
  it("pins the default accessible label for the canvas image", () => {
    expect(en.pitch.contour.a11y.label).toBe("Your pitch contour for this take");
  });

  it("pins the decoding-in-progress status text", () => {
    expect(en.pitch.contour.analyzing).toBe("Analyzing pitch…");
  });

  it("pins the unavailable-fallback status text", () => {
    expect(en.pitch.contour.unavailable).toBe("Pitch contour unavailable");
  });
});

/**
 * Task 11d: `PitchContourOverlay`
 * (`components/video-player/pitch-contour-overlay.tsx`). `a11y.label` is
 * this component's own default `label` prop — same binding-pattern-5
 * requirement as `PitchContour` above, verified in
 * `pitch-contour-overlay.test.tsx`.
 *
 * `reference` (お手本), `user` (あなた) and `intonation` (イントネーション) are
 * Japanese-language UI labels by original design, not English strings
 * needing translation — this is a Japanese-learning app, and showing the
 * target-language terms directly (rather than "Reference"/"You"/
 * "Intonation") is the same intentional design choice as leaving
 * "shadowing" itself untranslated in the glossary. The Vietnamese catalog
 * (see `messages/vi/shadowing.json`) therefore carries these three leaves
 * byte-identically rather than translating them, for consistency with the
 * decision on `overlay.a11y.label`'s embedded お手本 below.
 */
describe("shadowing.json EN — pitch-contour-overlay.tsx (PitchContourOverlay) literals", () => {
  it("pins the default accessible label, including the embedded お手本", () => {
    expect(en.pitch.overlay.a11y.label).toBe(
      "Pitch comparison: reference (お手本) vs your take",
    );
  });

  it("pins the reference/user legend labels", () => {
    expect(en.pitch.overlay.reference).toBe("お手本");
    expect(en.pitch.overlay.user).toBe("あなた");
  });

  it("pins the low-confidence explanation (em dash U+2014)", () => {
    expect(en.pitch.overlay.lowConfidence).toBe(
      "Not enough voiced audio to compare reliably — try a longer take.",
    );
  });

  it("pins the intonation-score label and its aria-hidden ' / 100' suffix", () => {
    expect(en.pitch.overlay.intonation).toBe("イントネーション");
    expect(en.pitch.overlay.scoreSuffix).toBe(" / 100");
  });
});
