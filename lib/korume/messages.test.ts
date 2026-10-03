import { describe, expect, it } from "vitest";
import { toMessageView } from "./messages";
import type { MessageRow } from "./store";

const answer = { blocks: [{ type: "paragraph", runs: [{ text: "Hi" }] }] };
const grounding = [{ id: "ent:1", label: "今日", kind: "vocabulary" }];
const row = (over: Partial<MessageRow>): MessageRow => ({
  id: "m", turnId: "t", role: "ai", content: "Hi", contentJson: answer, contentSchemaVersion: 1,
  groundingJson: grounding, groundingSchemaVersion: 1, createdAt: "2026-10-03T00:00:00Z", ...over,
});

describe("toMessageView", () => {
  it("exposes a validated answer and grounding of the known version", () => {
    expect(toMessageView(row({}))).toEqual({
      id: "m", turnId: "t", role: "assistant", text: "Hi", answer, grounding, createdAt: "2026-10-03T00:00:00Z",
    });
  });

  it("degrades an unknown version or a shape that no longer parses to plain text", () => {
    expect(toMessageView(row({ contentSchemaVersion: 2 })).answer).toBeNull();
    expect(toMessageView(row({ contentJson: { blocks: [{ type: "html", html: "<b>" }] } })).answer).toBeNull();
    expect(toMessageView(row({ groundingJson: [{ id: "javascript:x", label: "x", kind: "particle" }] })).grounding).toBeNull();
  });

  it("never reads structure off a learner row", () => {
    expect(toMessageView(row({ role: "user" }))).toMatchObject({ role: "user", answer: null, grounding: null });
  });
});
