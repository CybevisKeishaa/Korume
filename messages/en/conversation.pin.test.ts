import { describe, expect, it } from "vitest";
import en from "./conversation.json";

/**
 * Characterization test for `conversation.json` (Task 15): a literal `toBe`
 * pin for every `conversation.*` leaf, copied verbatim from the
 * pre-extraction source of `app/[locale]/(app)/conversation/page.tsx` and
 * `components/conversation/{scenario-picker,conversation-app,
 * session-history-list,voice-recorder-button,message-bubble,
 * corrections-panel}.tsx` on `layer-9a-string-extraction` before Task 15
 * (never derived from the catalog itself — binding pattern 2).
 *
 * Chat message text (`message.content`) and AI-authored corrections
 * (`result.encouragement`, `c.original`/`c.corrected`/`c.explanation`) are
 * CONTENT (spec D8) and are never in this catalog — only the surrounding
 * chrome is pinned here. `scenarios.*.label` deliberately keeps its Japanese
 * parenthetical (the learning target) verbatim; `messageBubble.pronunciationLabel`
 * ("発音") is the same target-language UI label ruling as
 * `shadowing.recorder.score.pronunciationLabel` (Task 11d) — byte-identical
 * in both locales, not translated.
 */
describe("conversation.json EN — conversation/page.tsx", () => {
  it("pins the page heading and subtitle", () => {
    expect(en.page.heading).toBe("Conversation practice");
    expect(en.page.subtitle).toBe(
      "Practice real scenarios with an AI conversation partner — by text or voice.",
    );
  });
});

describe("conversation.json EN — scenario-picker.tsx", () => {
  it("pins the level label and the use-my-profile-level option", () => {
    expect(en.picker.levelLabel).toBe("Level (optional — defaults to your profile)");
    expect(en.picker.useProfileLevel).toBe("Use my profile level");
  });

  it("pins each of the five scenario labels and descriptions, paired correctly", () => {
    expect(en.scenarios.restaurant.label).toBe("Restaurant (レストラン)");
    expect(en.scenarios.restaurant.description).toBe(
      "Order food, ask about the menu, and pay the bill.",
    );
    expect(en.scenarios.interview.label).toBe("Job interview (面接)");
    expect(en.scenarios.interview.description).toBe(
      "Answer common interview questions in polite Japanese.",
    );
    expect(en.scenarios.shopping.label).toBe("Shopping (買い物)");
    expect(en.scenarios.shopping.description).toBe(
      "Ask about sizes, prices, and try things on at a store.",
    );
    expect(en.scenarios.directions.label).toBe("Asking directions (道案内)");
    expect(en.scenarios.directions.description).toBe(
      "Ask how to get somewhere and understand the reply.",
    );
    expect(en.scenarios["free-talk"].label).toBe("Free talk (フリートーク)");
    expect(en.scenarios["free-talk"].description).toBe(
      "An open-ended chat about anything you like.",
    );
  });

  it("pins the unknown/missing scenario-id display fallback (shared by conversation-app.tsx and session-history-list.tsx)", () => {
    expect(en.scenarios.fallback).toBe("Conversation");
  });
});

describe("conversation.json EN — conversation-app.tsx", () => {
  it("pins the picker view section headings", () => {
    expect(en.app.startHeading).toBe("Start a conversation");
    expect(en.app.pastSessionsHeading).toBe("Past sessions");
  });

  it("pins the chat header back button and the empty-transcript states", () => {
    expect(en.app.back).toBe("← Back");
    expect(en.app.noMessagesReadOnly).toBe("This session has no messages.");
    expect(en.app.noMessagesStart).toBe("Say hello to get started.");
  });

  it("pins the truncated-reply notice, composer label/placeholder, and the voice-pending notice", () => {
    expect(en.app.truncatedNotice).toBe(
      "The AI reply was shortened to fit — it may be cut off.",
    );
    expect(en.app.messageLabel).toBe("Message");
    expect(en.app.messagePlaceholder).toBe("Type your reply in Japanese…");
    expect(en.app.voicePendingNotice).toBe("AI transcription — check before sending.");
  });

  it("pins the send/end-session button states", () => {
    expect(en.app.send).toBe("Send");
    expect(en.app.endSession).toBe("End session");
    expect(en.app.ending).toBe("Ending…");
  });

  it("pins the honest AI-not-configured (503) degrade message for message-send/end-session", () => {
    expect(en.app.notConfigured).toBe(
      "AI conversation isn't set up yet. Please try again later.",
    );
  });

  it("pins the three distinct 429 rate-limit message families (messages, sessions, requests)", () => {
    expect(en.app.tooManyMessagesWithSeconds).toBe("Too many messages — try again in {seconds}s.");
    expect(en.app.tooManySessionsWithSeconds).toBe("Too many sessions — try again in {seconds}s.");
    expect(en.app.tooManySessionsGeneric).toBe(
      "Too many sessions — please wait a moment and try again.",
    );
    expect(en.app.tooManyRequestsWithSeconds).toBe("Too many requests — try again in {seconds}s.");
    expect(en.app.tooManyRequestsGeneric).toBe(
      "Too many requests — please wait a moment and try again.",
    );
  });

  it("pins the three friendlyErrorFrom() fallbacks (start/send/end), never the leaked server diagnostic", () => {
    expect(en.app.errorStartSession).toBe("Could not start a session.");
    expect(en.app.errorSendMessage).toBe("Could not send message.");
    expect(en.app.errorEndSession).toBe("Could not end the session.");
  });
});

describe("conversation.json EN — session-history-list.tsx", () => {
  it("pins the empty-history state and the ended/in-progress status labels", () => {
    expect(en.history.empty).toBe("No past sessions yet — start one above.");
    expect(en.history.ended).toBe("Ended");
    expect(en.history.inProgress).toBe("In progress");
  });
});

describe("conversation.json EN — voice-recorder-button.tsx (STT)", () => {
  it("pins the STT-specific 503 degrade message — distinct from message-bubble's TTS one", () => {
    expect(en.voiceRecorder.notConfigured).toBe(
      "Voice input isn't set up yet. You can still type your message.",
    );
  });

  it("pins the rate-limit, transcribe-failure, generic-error, and conversion-failure messages", () => {
    expect(en.voiceRecorder.tooManyWithSeconds).toBe("Too many voice requests — try again in {seconds}s.");
    expect(en.voiceRecorder.tooManyGeneric).toBe(
      "Too many voice requests — please wait a moment and try again.",
    );
    expect(en.voiceRecorder.transcribeFailed).toBe("That recording couldn't be transcribed. Try again.");
    expect(en.voiceRecorder.genericError).toBe(
      "Something went wrong transcribing your voice. Please try again.",
    );
    expect(en.voiceRecorder.conversionFailed).toBe(
      "We couldn't process that recording. Please try again.",
    );
  });

  it("pins the mic status strings and the record/stop toggle labels", () => {
    expect(en.voiceRecorder.requestingPermission).toBe("Requesting microphone access…");
    expect(en.voiceRecorder.recording).toBe("Recording…");
    expect(en.voiceRecorder.transcribing).toBe("Transcribing…");
    expect(en.voiceRecorder.stopRecording).toBe("Stop recording");
    expect(en.voiceRecorder.recordVoiceMessage).toBe("Record voice message");
  });
});

describe("conversation.json EN — message-bubble.tsx (TTS)", () => {
  it("pins the TTS-specific 503 degrade message — distinct from voice-recorder-button's STT one", () => {
    expect(en.messageBubble.notConfigured).toBe("Voice playback isn't set up yet.");
  });

  it("pins the TTS rate-limit/generic/network-specific messages (network text differs from common.errors.network)", () => {
    expect(en.messageBubble.tooManyVoice).toBe("Too many voice requests — try again shortly.");
    expect(en.messageBubble.playFailed).toBe("Couldn't play that message aloud.");
    expect(en.messageBubble.networkError).toBe("Network error — couldn't play that message.");
  });

  it("pins the Play button label, the pronunciation-score title, and the 発音 target-language label", () => {
    expect(en.messageBubble.play).toBe("▶ Play");
    expect(en.messageBubble.pronunciationScoreTitle).toBe("Pronunciation score for this message");
    expect(en.messageBubble.pronunciationLabel).toBe("発音");
  });
});

describe("conversation.json EN — corrections-panel.tsx", () => {
  it("pins the AI-generated label, the corrections heading, the no-corrections state, and the results aria-label", () => {
    expect(en.corrections.aiGenerated).toBe("AI-generated");
    expect(en.corrections.heading).toBe("Corrections");
    expect(en.corrections.empty).toBe("No corrections this time — nice and clean!");
    expect(en.corrections.resultsAriaLabel).toBe("Session results");
  });
});
