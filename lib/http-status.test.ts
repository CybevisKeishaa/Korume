import { describe, expect, it } from "vitest";
import {
  aiErrorStatus,
  lessonCreationRefusalMessage,
  speechErrorStatus,
  SPEECH_THROTTLE_RETRY_AFTER_MS,
} from "./http-status";
import type { AiErrorKind } from "@/lib/ai";
import type { SpeechErrorKind } from "@/lib/speech-scoring";

describe("aiErrorStatus", () => {
  const cases: [AiErrorKind, number][] = [
    ["not_configured", 503],
    ["unavailable", 503],
    ["rate_limited", 429],
    ["auth", 500],
    ["invalid_output", 502],
    ["unknown", 502],
  ];

  it.each(cases)("maps %s to %i", (kind, status) => {
    expect(aiErrorStatus(kind)).toBe(status);
  });
});

describe("speechErrorStatus", () => {
  const cases: [SpeechErrorKind, number][] = [
    ["not_configured", 503],
    ["auth", 502],
    ["throttled", 429],
    ["request", 502],
    ["recognition", 422],
  ];

  it.each(cases)("maps %s to %i", (kind, status) => {
    expect(speechErrorStatus(kind)).toBe(status);
  });
});

describe("SPEECH_THROTTLE_RETRY_AFTER_MS", () => {
  it("is a positive fixed backoff", () => {
    expect(SPEECH_THROTTLE_RETRY_AFTER_MS).toBeGreaterThan(0);
  });
});

describe("lessonCreationRefusalMessage", () => {
  it("tells an exhausted learner about the quota, not about permissions", () => {
    expect(lessonCreationRefusalMessage("quota_exceeded")).toBe("Monthly lesson quota reached");
  });

  it("tells a non-admin nothing about why", () => {
    expect(lessonCreationRefusalMessage("not_admin")).toBe("Forbidden");
  });

  it("gives every reason its own message, so no new 403 inherits the quota copy", () => {
    const reasons = ["quota_exceeded", "not_admin"] as const;
    // Guard the guard: an empty list would satisfy the uniqueness check (L-004).
    expect(reasons).toHaveLength(2);
    const messages = reasons.map(lessonCreationRefusalMessage);
    expect(new Set(messages).size).toBe(reasons.length);
  });
});
