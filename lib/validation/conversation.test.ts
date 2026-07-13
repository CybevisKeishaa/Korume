import { describe, expect, it } from "vitest";
import {
  capHistory,
  createConversationSessionSchema,
  postConversationMessageSchema,
} from "./conversation";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("createConversationSessionSchema", () => {
  it("accepts a minimal valid payload", () => {
    expect(createConversationSessionSchema.safeParse({ scenario: "restaurant" }).success).toBe(true);
  });

  it("accepts an optional level", () => {
    const result = createConversationSessionSchema.safeParse({ scenario: "interview", level: "N3" });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown scenario", () => {
    expect(createConversationSessionSchema.safeParse({ scenario: "picnic" }).success).toBe(false);
  });

  it("rejects an unknown level", () => {
    expect(
      createConversationSessionSchema.safeParse({ scenario: "restaurant", level: "N6" }).success,
    ).toBe(false);
  });

  it("rejects a missing scenario", () => {
    expect(createConversationSessionSchema.safeParse({}).success).toBe(false);
  });
});

describe("postConversationMessageSchema", () => {
  it("accepts a minimal valid payload", () => {
    const result = postConversationMessageSchema.safeParse({ sessionId: UUID, message: "こんにちは" });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid sessionId", () => {
    expect(
      postConversationMessageSchema.safeParse({ sessionId: "nope", message: "こんにちは" }).success,
    ).toBe(false);
  });

  it("rejects an empty message", () => {
    expect(postConversationMessageSchema.safeParse({ sessionId: UUID, message: "" }).success).toBe(
      false,
    );
  });

  it("rejects a message over 1000 characters", () => {
    expect(
      postConversationMessageSchema.safeParse({ sessionId: UUID, message: "あ".repeat(1001) })
        .success,
    ).toBe(false);
  });

  it("trims surrounding whitespace", () => {
    const result = postConversationMessageSchema.parse({ sessionId: UUID, message: "  はい  " });
    expect(result.message).toBe("はい");
  });
});

describe("capHistory", () => {
  it("returns all turns unchanged when under the cap", () => {
    const turns = [1, 2, 3];
    expect(capHistory(turns, 20)).toEqual([1, 2, 3]);
  });

  it("returns all turns unchanged when exactly at the cap", () => {
    const turns = Array.from({ length: 20 }, (_, i) => i);
    expect(capHistory(turns, 20)).toEqual(turns);
  });

  it("keeps only the most recent `cap` turns, preserving order", () => {
    const turns = Array.from({ length: 25 }, (_, i) => i);
    const result = capHistory(turns, 20);
    expect(result).toHaveLength(20);
    expect(result[0]).toBe(5);
    expect(result[result.length - 1]).toBe(24);
  });

  it("defaults to MAX_CONVERSATION_HISTORY_TURNS (20) when no cap is given", () => {
    const turns = Array.from({ length: 30 }, (_, i) => i);
    expect(capHistory(turns)).toHaveLength(20);
  });

  it("does not mutate the input array", () => {
    const turns = [1, 2, 3];
    const copy = [...turns];
    capHistory(turns, 2);
    expect(turns).toEqual(copy);
  });

  it("returns a fresh array (not the same reference) even when under the cap", () => {
    const turns = [1, 2, 3];
    expect(capHistory(turns, 20)).not.toBe(turns);
  });
});
