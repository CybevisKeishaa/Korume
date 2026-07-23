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

/**
 * Task 11c extended `common.player.*` with `playback-controls.tsx`'s strings
 * (user decision 2026-07-21: keep the whole player-shell cluster in one
 * place so Task 19's demotion-to-`shadowing.*` gate, if it fires, is a
 * single decision — see the plan's Task 11 section). Literal `toBe` pins per
 * the standing Task 10 convention; `playback-controls.test.tsx` proves the
 * RTL wiring.
 *
 * `a11y.abLoop` gets its own isolated `it()`, not folded into the others:
 * hazard 4 is that this string carries an EN DASH (U+2013), not a hyphen,
 * and a single shared `it()` would let an earlier assertion's failure
 * short-circuit past this one, hiding a silent hyphen substitution.
 */
describe("common.json EN — playback-controls literals (Task 11c)", () => {
  it("pins the speed control's accessible group name", () => {
    expect(en.player.a11y.playbackSpeed).toBe("Playback speed");
  });

  it("pins the A–B loop group's accessible name (EN DASH U+2013, not a hyphen)", () => {
    expect(en.player.a11y.abLoop).toBe("A–B loop");
    expect(en.player.a11y.abLoop).not.toBe("A-B loop");
  });

  it("pins the furigana control's accessible group name", () => {
    expect(en.player.a11y.furigana).toBe("Furigana");
  });

  it("pins the three furigana mode labels", () => {
    expect(en.player.furigana.adaptive).toBe("Adaptive");
    expect(en.player.furigana.all).toBe("All");
    expect(en.player.furigana.off).toBe("Off");
  });

  it("pins the loop control labels", () => {
    expect(en.player.loop.setA).toBe("Set A");
    expect(en.player.loop.setB).toBe("Set B");
    expect(en.player.loop.clear).toBe("Clear loop");
  });
});

/**
 * `states.loading` was added in Task 2 but had no consumer (and no literal
 * pin) until Task 11c's `video-summary-panel.tsx`, whose own "Loading…" text
 * is byte-identical to it — reused rather than duplicated into
 * `shadowing.json` (P4). First real consumer, so this is the first pin.
 */
describe("common.json EN — states.loading (first consumed by Task 11c)", () => {
  it("pins the generic loading message", () => {
    expect(en.states.loading).toBe("Loading…");
  });
});

/**
 * Task 16 adds two new `actions.*` promotions:
 * - `loadMore` ("Load more"): byte-identical across `forum-board.tsx`,
 *   `peer-review-queue.tsx` (community) and `public-playlist-list.tsx`
 *   (playlists) — a 3-surface, 2-namespace duplication, textbook P4.
 * - `confirmYes` ("Yes, {label}"): `confirm-button.tsx`'s own confirm-step
 *   copy. That component is `components/community/confirm-button.tsx` by
 *   path but is consumed across three namespaces (community, playlists via
 *   `playlist-list.tsx`, and shadowing via
 *   `components/video-player/shadowing-recorder-panel.tsx`, Task 11e) — its
 *   own chrome can't live in any single feature namespace without an
 *   arbitrary owner, so it promotes straight to `common` rather than
 *   picking one.
 */
describe("common.json EN — actions.loadMore / actions.confirmYes (Task 16 promotion)", () => {
  it("pins the shared 'Load more' button label", () => {
    expect(en.actions.loadMore).toBe("Load more");
  });

  it("pins ConfirmButton's own 'Yes, {label}' confirm-step copy", () => {
    expect(en.actions.confirmYes).toBe("Yes, {label}");
  });
});
