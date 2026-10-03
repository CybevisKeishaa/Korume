import { describe, expect, it } from "vitest";
import { createThreadSchema, postTurnSchema } from "./korume";

const U = "a0000000-0000-4000-8000-000000000001";
const V = "a0000000-0000-4000-8000-000000000002";
const L = "a0000000-0000-4000-8000-000000000003";

describe("createThreadSchema", () => {
  it("accepts a free thread, a line anchor and a span anchor", () => {
    expect(createThreadSchema.safeParse({ threadId: U }).success).toBe(true);
    expect(createThreadSchema.safeParse({ threadId: U, videoId: V, lineId: L }).success).toBe(true);
    expect(createThreadSchema.safeParse({ threadId: U, videoId: V, lineId: L, span: { start: 0, end: 2 } }).success).toBe(true);
  });

  it("refuses what the client must never send and half anchors (spec §4.2, §7.2)", () => {
    for (const bad of [
      { threadId: U, originRoute: "/x" },
      { threadId: U, userId: V },
      { threadId: "nope" },
      { threadId: U, span: { start: 0, end: 2 } },
      { threadId: U, lineId: L },
      { threadId: U, videoId: V, lineId: L, span: { start: 2, end: 2 } },
      { threadId: U, videoId: V, lineId: L, span: { start: 0, end: 2, x: 1 } },
      { threadId: U, videoId: V, lineId: L, span: { start: 0.5, end: 2 } },
    ]) expect(createThreadSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
  });
});

describe("postTurnSchema", () => {
  it("takes a turn id and 1–2000 characters of question after trimming", () => {
    expect(postTurnSchema.safeParse({ turnId: U, text: " は? ", locale: "vi" }).success).toBe(true);
    expect(postTurnSchema.safeParse({ turnId: U, text: "   ", locale: "vi" }).success).toBe(false);
    expect(postTurnSchema.safeParse({ turnId: U, text: "x".repeat(2001), locale: "vi" }).success).toBe(false);
    expect(postTurnSchema.safeParse({ turnId: U, text: "x", locale: "vi", role: "assistant" }).success).toBe(false);
    expect(postTurnSchema.safeParse({ turnId: U, text: "x", locale: "ja" }).success).toBe(false);
  });
});
