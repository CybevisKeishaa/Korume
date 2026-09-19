import { describe, expect, it } from "vitest";
import {
  isTerminalJobState,
  LESSON_CREATION_ERROR_CODES,
  LESSON_CREATION_JOB_STATES,
  LESSON_CREATION_STEPS,
  lessonCreationJobProjectionSchema,
} from "./types";

const validProjection = {
  id: "dc2ceca1-1647-489b-985e-97aa4ac00abc",
  state: "queued",
  step: "deduplicating",
  attemptCount: 0,
  lessonId: null,
  publicErrorCode: null,
  updatedAt: "2026-09-13T08:00:00.000Z",
};

describe("lesson creation job domain contract", () => {
  it("exposes the canonical durable tuples and recognizes terminal states", () => {
    expect(LESSON_CREATION_JOB_STATES).toEqual(["queued", "running", "succeeded", "failed"]);
    expect(LESSON_CREATION_STEPS).toEqual([
      "deduplicating",
      "fetching_metadata",
      "fetching_transcript",
      "enriching_furigana",
      "persisting",
      "ready",
      "failed",
    ]);
    expect(LESSON_CREATION_ERROR_CODES).toEqual([
      "metadata_unavailable",
      "transcript_unavailable",
      "quota_exceeded",
      "temporary_failure",
      "existing_private_lesson",
    ]);
    expect(isTerminalJobState("succeeded")).toBe(true);
    expect(isTerminalJobState("failed")).toBe(true);
    expect(isTerminalJobState("queued")).toBe(false);
    expect(isTerminalJobState("running")).toBe(false);
  });

  it("accepts a safe public projection and rejects invalid enum values", () => {
    expect(lessonCreationJobProjectionSchema.safeParse(validProjection).success).toBe(true);
    expect(lessonCreationJobProjectionSchema.safeParse({ ...validProjection, state: "ready" }).success).toBe(false);
    expect(lessonCreationJobProjectionSchema.safeParse({ ...validProjection, step: "completed" }).success).toBe(false);
    expect(
      lessonCreationJobProjectionSchema.safeParse({
        ...validProjection,
        publicErrorCode: "provider_stack_trace",
      }).success,
    ).toBe(false);
  });

  it("requires UUID identifiers and an ISO datetime at the public boundary", () => {
    expect(lessonCreationJobProjectionSchema.safeParse({ ...validProjection, id: "job-1" }).success).toBe(false);
    expect(
      lessonCreationJobProjectionSchema.safeParse({ ...validProjection, lessonId: "lesson-1" }).success,
    ).toBe(false);
    expect(
      lessonCreationJobProjectionSchema.safeParse({
        ...validProjection,
        lessonId: "6636547d-b082-4bb1-bc74-852418d4c9f1",
      }).success,
    ).toBe(true);
    expect(
      lessonCreationJobProjectionSchema.safeParse({ ...validProjection, updatedAt: "2026-09-13" }).success,
    ).toBe(false);
  });

  it("requires terminal states to use their matching terminal steps", () => {
    expect(
      lessonCreationJobProjectionSchema.safeParse({ ...validProjection, state: "succeeded", step: "ready" }).success,
    ).toBe(true);
    expect(
      lessonCreationJobProjectionSchema.safeParse({ ...validProjection, state: "failed", step: "failed" }).success,
    ).toBe(true);
    expect(
      lessonCreationJobProjectionSchema.safeParse({ ...validProjection, state: "succeeded", step: "persisting" }).success,
    ).toBe(false);
    expect(
      lessonCreationJobProjectionSchema.safeParse({ ...validProjection, state: "failed", step: "ready" }).success,
    ).toBe(false);
    expect(
      lessonCreationJobProjectionSchema.safeParse({ ...validProjection, state: "running", step: "ready" }).success,
    ).toBe(false);
    expect(
      lessonCreationJobProjectionSchema.safeParse({ ...validProjection, state: "queued", step: "failed" }).success,
    ).toBe(false);
  });

  it("rejects database-only requester and lease fields from the public projection", () => {
    expect(
      lessonCreationJobProjectionSchema.safeParse({
        ...validProjection,
        requesterUserId: "dce6afaa-43d0-47cc-b983-1e504579f574",
      }).success,
    ).toBe(false);
    expect(
      lessonCreationJobProjectionSchema.safeParse({
        ...validProjection,
        leaseExpiresAt: "2026-09-13T08:05:00.000Z",
      }).success,
    ).toBe(false);
  });
});
