import { describe, expect, it } from "vitest";
import en from "./shadowing.json";

/**
 * Characterization test for `shadowing.json` (Task 11c): the literal `toBe`
 * pin against the catalog, per the standing convention from the Task 10
 * review (`toHaveTextContent` given a string is a CONTAINMENT match, not
 * equality — component tests prove the RTL wiring; this file's job is to pin
 * every leaf byte-exact).
 */
describe("shadowing.json EN — player-error and no-transcript literals", () => {
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

/**
 * Task 11e: `ShadowingRecorderPanel`
 * (`components/video-player/shadowing-recorder-panel.tsx`). Every expected
 * value below is a literal copied verbatim from that file's pre-extraction
 * source on `layer-9a-string-extraction` before Task 11e (never derived from
 * the catalog itself — binding pattern 2). `recorder.errors.*` is Task 11d's
 * (`useRecorder`) and is pinned above — not touched here.
 */
describe("shadowing.json EN — shadowing-recorder-panel.tsx toggle/status/a11y literals", () => {
  it("pins the record/stop toggle button labels", () => {
    expect(en.recorder.toggle.record).toBe("Record");
    expect(en.recorder.toggle.stop).toBe("Stop recording");
  });

  it("pins the transient recorder status messages", () => {
    expect(en.recorder.status.requestingPermission).toBe("Requesting microphone access…");
    expect(en.recorder.status.recording).toBe("Recording…");
    expect(en.recorder.status.saving).toBe("Saving recording…");
    expect(en.recorder.status.saved).toBe("Saved.");
    expect(en.recorder.status.captured).toBe("Recording captured.");
  });

  it("pins the sr-only panel heading ICU message, including the embedded quotes", () => {
    expect(en.recorder.a11y.panel).toBe('Shadowing recorder for "{lineText}"');
  });

  it("pins the waveform label — carry-forward #1 from the 11a player shell", () => {
    expect(en.recorder.a11y.waveformLabel).toBe("Your recording waveform");
  });

  it("pins the saved-recording playback aria-label", () => {
    expect(en.recorder.a11y.playback).toBe("Play your saved recording");
  });

  it("pins the word-level pronunciation list's aria-label", () => {
    expect(en.recorder.a11y.wordScores).toBe("Word-level pronunciation");
  });
});

/**
 * `friendlyScoreError`'s status-mapped messages (lines 63–80 pre-extraction).
 * 503 stays a bare `{status:"unavailable"}` with no message — pinned via
 * `recorder.score.notConfigured` (the module-level constant) instead, below.
 */
describe("shadowing.json EN — shadowing-recorder-panel.tsx friendlyScoreError mapping", () => {
  it("pins the score action button and its busy label", () => {
    expect(en.recorder.score.action).toBe("Score my pronunciation");
    expect(en.recorder.score.actionBusy).toBe("Scoring…");
  });

  it("pins the score-not-configured (503) message, used as both the tooltip title and the inline text", () => {
    expect(en.recorder.score.notConfigured).toBe("Pronunciation scoring isn't set up yet.");
  });

  it("pins the WAV-conversion-failure message", () => {
    expect(en.recorder.score.conversionFailed).toBe(
      "We couldn't process that recording. Please try again.",
    );
  });

  it("pins the 発音/リズム score labels — byte-identical in vi (target-language UI labels, 11d ruling)", () => {
    expect(en.recorder.score.pronunciationLabel).toBe("発音");
    expect(en.recorder.score.fluencyLabel).toBe("リズム");
  });

  it("pins the 429 message with a numeric Retry-After", () => {
    expect(en.recorder.score.errors.rateLimited).toBe(
      "Too many scoring requests — try again in {seconds}s.",
    );
  });

  it("pins the 429 message without a usable Retry-After", () => {
    expect(en.recorder.score.errors.rateLimitedGeneric).toBe(
      "Too many scoring requests — please wait a moment and try again.",
    );
  });

  it("pins the 404 (recording no longer found) message", () => {
    expect(en.recorder.score.errors.notFound).toBe(
      "That recording could no longer be found to score.",
    );
  });

  it("pins the 422 (couldn't be scored) message", () => {
    expect(en.recorder.score.errors.invalid).toBe(
      "That recording couldn't be scored — try recording again.",
    );
  });

  it("pins the default fallback message", () => {
    expect(en.recorder.score.errors.generic).toBe(
      "Something went wrong scoring your pronunciation.",
    );
  });
});

/** `friendlyUploadError`'s status-mapped messages (lines 83–94 pre-extraction). */
describe("shadowing.json EN — shadowing-recorder-panel.tsx friendlyUploadError mapping", () => {
  it("pins the 401 (sign in) message", () => {
    expect(en.recorder.upload.errors.unauthorized).toBe("Sign in to save your recordings.");
  });

  it("pins the 429 message with a numeric Retry-After", () => {
    expect(en.recorder.upload.errors.rateLimited).toBe(
      "Too many recordings — try again in {seconds}s.",
    );
  });

  it("pins the 429 message without a usable Retry-After", () => {
    expect(en.recorder.upload.errors.rateLimitedGeneric).toBe(
      "Too many recordings — please wait a moment and try again.",
    );
  });

  it("pins the 400/422 (couldn't be saved) message", () => {
    expect(en.recorder.upload.errors.invalid).toBe(
      "That recording couldn't be saved. Please try recording again.",
    );
  });

  it("pins the default fallback message", () => {
    expect(en.recorder.upload.errors.generic).toBe(
      "Something went wrong saving your recording.",
    );
  });
});

/**
 * `friendlyShareError`'s status-mapped messages (lines 103–110
 * pre-extraction), plus the surrounding share/revoke chrome.
 */
describe("shadowing.json EN — shadowing-recorder-panel.tsx friendlyShareError mapping + share chrome", () => {
  it("pins the share action button and its busy label", () => {
    expect(en.recorder.share.action).toBe("Share for peer feedback");
    expect(en.recorder.share.actionBusy).toBe("Sharing…");
  });

  it("pins the consent-explanation copy shown before sharing", () => {
    expect(en.recorder.share.explain).toBe(
      "Shares this one recording publicly for feedback. You can revoke anytime.",
    );
  });

  it("pins the shared-confirmation message", () => {
    expect(en.recorder.share.shared).toBe("Shared for peer feedback.");
  });

  it("pins the ConfirmButton's label and confirmLabel for revoking a share", () => {
    expect(en.recorder.share.revoke).toBe("Revoke");
    expect(en.recorder.share.revokeConfirm).toBe(
      "Revoke this share? Others will no longer be able to hear or review it.",
    );
  });

  it("pins the 429 message with a numeric Retry-After", () => {
    expect(en.recorder.share.errors.rateLimited).toBe(
      "Too many requests — try again in {seconds}s.",
    );
  });

  it("pins the 429 message without a usable Retry-After", () => {
    expect(en.recorder.share.errors.rateLimitedGeneric).toBe(
      "Too many requests — please wait a moment and try again.",
    );
  });

  it("pins the default fallback (share) message", () => {
    expect(en.recorder.share.errors.generic).toBe(
      "Couldn't share this recording — please try again.",
    );
  });

  it("pins the revoke-failure message", () => {
    expect(en.recorder.share.errors.revokeFailed).toBe(
      "Couldn't revoke this share — please try again.",
    );
  });
});

/**
 * `errorType` tooltip labels (line 389 pre-extraction) — `errorType` is the
 * closed union `"None" | "Omission" | "Insertion" | "Mispronunciation"`
 * (`lib/speech-types.ts`), mapped via an exhaustive
 * `Record<..., string> as const satisfies` (same pattern as Task 10's
 * `BAND_LABEL_KEY`). `"None"` renders as "Correct" (the pre-extraction
 * ternary's `w.errorType === "None" ? "Correct" : w.errorType`); the other
 * three reuse Azure's own English words verbatim.
 */
describe("shadowing.json EN — shadowing-recorder-panel.tsx word errorType labels", () => {
  it("pins all four errorType labels", () => {
    expect(en.recorder.wordError.none).toBe("Correct");
    expect(en.recorder.wordError.omission).toBe("Omission");
    expect(en.recorder.wordError.insertion).toBe("Insertion");
    expect(en.recorder.wordError.mispronunciation).toBe("Mispronunciation");
  });
});

/**
 * The waveform strings remain under `shadowing.player.*` because that surface
 * is their only consumer. These pins assert the byte-exact catalog values.
 */
describe("shadowing.json EN — waveform literals", () => {
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

describe("shadowing.json EN workspace transcript recovery", () => {
  it("pins the unavailable-transcript recovery copy", () => {
    expect(en.workspace.emptyTranscript.title).toBe("This lesson is temporarily missing its transcript.");
    expect(en.workspace.emptyTranscript.retry).toBe("Try again");
    expect(en.workspace.emptyTranscript.backToHub).toBe("Back to Shadowing Hub");
    expect(en.workspace.regionLabel).toBe("Shadowing practice");
    expect(en.workspace.divider).toBe("Resize workspace panes");
  });
});

describe("shadowing.json EN workspace player", () => {
  it("pins the player control names", () => {
    expect(en.workspace.player).toEqual({
      label: "Player",
      play: "Play",
      pause: "Pause",
      previous: "Previous sentence",
      next: "Next sentence",
      rewind5: "Back 5 seconds",
      seek: "Seek",
      seekValue: "{current} of {total}",
      loop: "Sentence",
      loopToggle: "Sentence loop",
      loopCount: "Plays per sentence",
      speed: "Playback speed",
      speedValue: "Playback speed {rate}",
      mute: "Mute",
      unmute: "Unmute",
      subtitlesShow: "Show subtitles",
      subtitlesHide: "Hide subtitles",
      fullscreen: "Player fullscreen",
    });
  });
});

describe("shadowing.json EN workspace Live Sentence", () => {
  it("pins the Live Sentence copy", () => {
    expect(en.workspace.liveSentence).toEqual({
      explain: "Explain with AI",
      label: "Live sentence",
      hideJapanese: "Hide Japanese",
      showJapanese: "Show Japanese",
      showTranslation: "Show translation",
    });
  });
});

describe("shadowing.json EN workspace Utility Drawer", () => {
  it("pins the drawer copy", () => {
    expect(en.workspace.drawer).toEqual({
      region: "Study tools",
      tabList: "Study tools",
      tabs: { vocabulary: "Vocabulary", grammar: "Grammar", mining: "Mining", notes: "Notes", ai: "AI" },
      separator: "Resize study tools",
      levels: { collapsed: "Collapsed", peek: "Peek", expanded: "Expanded", maximized: "Fullscreen" },
      open: "Open study tools",
      collapse: "Collapse study tools",
      fullscreen: "Study tools fullscreen",
      following: "Current sentence · {number} / {total}",
      pinnedTarget: "Sentence {number} / {total}",
      pinned: "Pinned",
      follow: "Follow current sentence",
      noTarget: "No sentence yet",
      selection: "Selection: {text}",
    });
  });
});

describe("shadowing.json EN workspace selection popover", () => {
  it("pins the selection popover copy", () => {
    expect(en.workspace.selection).toEqual({"loading": "Looking up the words…", "failed": "Couldn't load the words of this sentence.", "noEntry": "No dictionary entry for this word.", "kanji": "Kanji {literal}", "glossLoading": "Looking up the Vietnamese meaning…", "glossPending": "Writing the Vietnamese meaning…", "glossUnavailable": "No Vietnamese meaning yet.", "aiGenerated": "AI-generated", "analyze": "Analyze", "play": "Play sentence", "bookmark": "Bookmark sentence", "mine": "Add to Mining", "mineTooLong": "Select {max} characters or fewer to add to Mining."});
  });
});

describe("shadowing.json EN workspace Vocabulary tab", () => {
  it("pins the Vocabulary tab copy", () => {
    expect(en.workspace.vocabulary).toEqual({"scope": "Show words from", "thisSentence": "This sentence", "wholeLesson": "Whole lesson", "loading": "Loading words…", "failed": "Couldn't load the words.", "retry": "Try again", "noWords": "No dictionary words here.", "back": "Back", "showMore": "Show more", "total": "{count, plural, one {{count} word} other {{count} words}} in this lesson", "occurrences": "{count}×", "mastery": "SRS {stage}", "sentences": "Sentences with {word}"});
  });
});

describe("shadowing.json EN workspace notes tab", () => {
  it("pins the notes tab copy", () => {
    expect(en.workspace.notes).toEqual({"sentence": "Note for sentence {number}", "lesson": "Lesson note", "placeholder": "Write a note…", "all": "All notes in this lesson", "none": "No notes yet.", "retry": "Retry", "status": {"saved": "Saved", "saving": "Saving…", "failed": "Couldn't save.", "idle": ""}});
  });
});

describe("shadowing.json EN workspace grammar tab", () => {
  it("pins the grammar tab copy", () => {
    expect(en.workspace.grammar).toEqual({"aiBreakdown": "AI Grammar Breakdown →", "loading": "Matching grammar…", "failed": "Couldn't load the grammar of this sentence.", "none": "No grammar patterns from the library match this sentence.", "open": "Open in Grammar"});
  });
});

describe("shadowing.json EN workspace mining tab", () => {
  it("pins the mining tab copy", () => {
    expect(en.workspace.mining).toEqual({"loading": "Loading your cards…", "failed": "Couldn't load your cards.", "none": "You haven't mined a sentence from this lesson yet."});
  });
});

describe("shadowing.json EN workspace transcript panel", () => {
  it("pins the transcript panel copy", () => {
    expect(en.workspace.transcript).toEqual({
      hasNote: "Has a note",
      openVocabulary: "Vocabulary",
      openGrammar: "Grammar",
      openAi: "AI explanation",
      openNote: "Note",
      label: "Transcript",
      meta: "{count, plural, one {{count} sentence} other {{count} sentences}} · {minutes} min",
      translations: "Translations",
      fullTranscript: "Full transcript",
      search: "Search transcript",
      matches: "{count, plural, =0 {No matching sentences} one {{count} matching sentence} other {{count} matching sentences}}",
      noMatches: "No sentences match",
      backToCurrent: "Back to current",
      lineNumber: "Sentence {number}",
      bookmarked: "Bookmarked",
      markedDifficult: "Marked difficult",
      actions: "Sentence actions",
      replay: "Replay",
      bookmark: "Bookmark",
      difficult: "Difficult",
      lineFurigana: "Readings for this line",
      showTranslation: "Show translation",
    });
  });
});

describe("shadowing.json EN workspace header", () => {
  it("pins the header copy", () => {
    expect(en.workspace.header).toEqual({
      back: "Back to Shadowing Hub",
      sourceFallback: "YouTube",
      jlpt: "JLPT {level}",
      minutes: "{minutes} min",
      sentenceCounter: "Sentence {current} / {total}",
      focusMode: "Focus Mode",
      fullscreen: "Workspace fullscreen",
      bookmarkLesson: "Bookmark lesson",
      more: "More actions",
      downloadTranscript: "Download transcript",
      downloadSrt: "Subtitles (.srt)",
      downloadTxt: "Plain text (.txt)",
      modeNav: "Learning modes",
      modes: { shadowing: "Shadowing", pronunciation: "Pronunciation", listening: "Listening", summary: "Summary" },
    });
  });
});

describe("shadowing.json EN workspace Reading Settings, Study Environment and shortcut hints", () => {
  it("pins the Reading Settings copy", () => {
    expect(en.workspace.settings).toEqual({
      open: "Reading settings",
      furigana: "Furigana",
      furiganaOptions: { always: "Always", adaptive: "Adaptive", hidden: "Hidden" },
      translation: "Translation",
      translationOptions: { hidden: "Hidden", reveal: "Tap to show", always: "Always" },
      jpFont: "Japanese font",
      jpFontOptions: { gothic: "Gothic", mincho: "Mincho" },
      textSize: "Font size",
      textSizeOptions: { s: "S", m: "M", l: "L", xl: "XL" },
      lineHeight: "Line height",
      lineHeightOptions: { compact: "Compact", comfortable: "Comfortable", airy: "Airy" },
      width: "Reading width",
      widthOptions: { narrow: "Narrow", normal: "Normal", wide: "Wide" },
      emphasis: "Sentence emphasis",
      emphasisOptions: { minimal: "Minimal", soft: "Soft", strong: "Strong" },
      colorPreset: "Text colour",
      colorPresetOptions: { warm_cream: "Warm Cream", night: "Night", sepia: "Sepia", high_contrast: "High Contrast" },
      speed: "Default speed",
      loopCount: "Plays per sentence",
      autoPause: "Pause after each sentence",
      shortcutHints: "Show keyboard shortcuts",
      resume: "Reopening a lesson",
      resumeOptions: { resume: "Resume", restart: "Start over" },
    });
  });

  it("pins the Study Environment copy", () => {
    expect(en.workspace.environment).toEqual({
      open: "Study Environment",
      options: {
        none: "None", evening_study: "Evening Study", coffee_shop: "Coffee Shop", rainy_day: "Rainy Day",
        quiet_library: "Quiet Library", spring_morning: "Spring Morning", summer_night: "Summer Night",
      },
    });
  });

  it("pins the shortcut hint copy", () => {
    expect(en.workspace.shortcuts).toEqual({
      open: "Keyboard shortcuts", togglePlay: "Play / pause", previous: "Previous sentence", next: "Next sentence",
      rewind: "Back 5 seconds", loop: "Sentence loop", focus: "Focus Mode",
    });
  });
});

describe("shadowing.json EN workspace AI tab", () => {
  it("pins the AI tab copy", () => {
    expect(en.workspace.ai).toEqual({"generate": "Generate", "generating": "Writing this section…", "ready": "{section} is ready.", "quota": "You've used today's free AI sentences. Resets in {hours} h.", "resting": "AI is resting right now. Sections already loaded stay here.", "failed": "Couldn't load this section.", "retry": "Try again", "locked": "Preview. The full section comes with Plus.", "playTurn": "Play line {number}", "ttsUnavailable": "Audio isn't available right now.", "quiz": {"correct": "Correct.", "incorrect": "Not quite."}, "fields": {"literal": "Literally", "register": "Register", "whenToUse": "When to use", "whenNotTo": "When not to"}, "usage": {"free": "{used}/{limit} sentences today · resets in {hours} h", "plus": "{percent}% of this month's AI left", "plusLabel": "AI left this month"}, "sections": {"lite": "Explanation", "grammar_breakdown": "Grammar breakdown", "culture_notes": "Culture notes", "common_mistakes": "Common mistakes", "alternative_expressions": "Other ways to say it", "native_nuance": "Native nuance", "more_examples": "More examples", "quiz": "Quiz", "conversation": "Conversation", "phrase_analysis": "Phrase analysis"}});
  });
});
