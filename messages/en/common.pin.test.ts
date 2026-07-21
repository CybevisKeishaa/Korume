import { describe, expect, it } from "vitest";
import en from "./common.json";

/**
 * Characterization test for the `common.json` leaves Task 10 added when it
 * promoted the recommendation rail's strings out of per-module namespaces
 * (`dashboard`/`videos`) into `common` — a string needed by two or more
 * modules is promoted to `common`, not duplicated (CLAUDE.md P4).
 *
 * These leaves already have RTL coverage in
 * `components/learning/recommendation-rail.test.tsx` via EXACT
 * `getByText(...)` matches, which — unlike `toHaveTextContent` — perform
 * equality, not containment, so that RTL test does genuinely prove the
 * copy, not just the wiring. This file adds the belt-and-suspenders literal
 * `toBe` pin directly against the catalog anyway, per the standing
 * convention from the Task 10 review: the pin is a `toBe` assertion here,
 * RTL proves wiring. `recommendations.heading`/`.loading` (also promoted
 * from `dashboard.json` in the same task) are pinned in
 * `messages/en/dashboard.pin.test.ts`, not duplicated here.
 *
 * Every expected value below is a literal copied verbatim from
 * `messages/en/common.json` as authored in Task 10 (never derived from the
 * catalog itself — binding pattern 2).
 */
describe("common.json EN — recommendation-rail literals (Task 10)", () => {
  it("pins the shared 'no thumbnail' fallback (video-card.tsx + recommendation-rail.tsx)", () => {
    expect(en.noThumbnail).toBe("No thumbnail");
  });

  it("pins the empty-recommendations rich-text message", () => {
    expect(en.recommendations.empty).toBe(
      "No recommendations yet — <link>import a video</link> to get started.",
    );
  });

  it("pins the known-words percentage line", () => {
    expect(en.recommendations.knownWords).toBe("{percent}% words you know");
  });

  it("pins the ideal-band label", () => {
    expect(en.recommendations.band.ideal).toBe("Just right");
  });

  it("pins the too-easy-band label", () => {
    expect(en.recommendations.band.tooEasy).toBe("Easy review");
  });

  it("pins the too-hard-band label", () => {
    expect(en.recommendations.band.tooHard).toBe("Challenge");
  });
});

/**
 * Task 11a promoted the video-player shell's strings (`transcript-pane.tsx`,
 * `waveform.tsx` — shared by both the shadowing and dictation surfaces, P4)
 * to `common.player.*` instead of duplicating them per feature namespace.
 * Literal `toBe` pins here, per the standing Task 10 review convention;
 * `transcript-pane.test.tsx` / `waveform.test.tsx` prove the RTL wiring.
 */
describe("common.json EN — player shell literals (Task 11a)", () => {
  it("pins the empty-transcript message", () => {
    expect(en.player.transcriptEmpty).toBe("This transcript has no lines yet.");
  });

  it("pins the transcript list's accessible name", () => {
    expect(en.player.a11y.transcript).toBe("Transcript");
  });

  it("pins the waveform canvas's default accessible name", () => {
    expect(en.player.a11y.waveform).toBe("Recording waveform");
  });

  it("pins the processing-recording message", () => {
    expect(en.player.processingRecording).toBe("Processing recording…");
  });

  it("pins the waveform-unavailable fallback message", () => {
    expect(en.player.waveformUnavailable).toBe("Waveform preview unavailable.");
  });
});

/**
 * Task 11b promoted `errors.network` out of `messages/en/vocab.json` into
 * `common.errors.network`. The identical string ("Network error — check
 * your connection and try again.") appears across 8 modules (community,
 * conversation, jlpt, reading, video-player, dictation); Task 8 had put it
 * in `vocab.json` where it never belonged (P4 — a string needed by 2+
 * modules is promoted to `common`, never duplicated). Only
 * `vocab-examples-panel.tsx` and `dictation-view.tsx` consume it as of this
 * task; the other ~26 call sites still hardcode their own copy and will
 * consume this key when Tasks 12–16 extract their namespaces. This pin was
 * moved from (not duplicated out of) `messages/en/vocab.pin.test.ts` — see
 * the note left there.
 */
describe("common.json EN — network error (Task 11b promotion)", () => {
  it("pins errors.network", () => {
    expect(en.errors.network).toBe(
      "Network error — check your connection and try again.",
    );
  });
});
