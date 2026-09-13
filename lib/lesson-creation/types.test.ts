import { describe, expect, it } from "vitest";
import {
  isTerminalJobState,
  LESSON_CREATION_JOB_STATES,
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
  it("exposes only the four durable job states and recognizes terminal states", () => {
    expect(LESSON_CREATION_JOB_STATES).toEqual(["queued", "running", "succeeded", "failed"]);
    expect(isTerminalJobState("succeeded")).toBe(true);
    expect(isTerminalJobState("failed")).toBe(true);
    expect(isTerminalJobState("queued")).toBe(false);
    expect(isTerminalJobState("running")).toBe(false);
  });

  it("accepts a safe public projection and rejects invalid states", () => {
    expect(lessonCreationJobProjectionSchema.safeParse(validProjection).success).toBe(true);
    expect(lessonCreationJobProjectionSchema.safeParse({ ...validProjection, state: "ready" }).success).toBe(false);
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
