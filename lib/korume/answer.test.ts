import { describe, expect, it } from "vitest";
import { answerToPlainText, answerV1Schema, dropUngroundedCards, groundingSchema, type AnswerV1, type Block } from "./answer";
import type { GroundedEntity } from "./types";

const para: Block = { type: "paragraph", runs: [{ text: "は marks the " }, { text: "topic", strong: true }, { text: ": " }, { jp: "今日は" }] };

describe("answerV1Schema", () => {
  it("accepts the four block types", () => {
    expect(answerV1Schema.safeParse({ blocks: [
      para,
      { type: "example", jp: "私は学生です", ruby: [{ base: "私", reading: "わたし" }], translation: "I am a student" },
      { type: "context_card", entityRef: "tok:は:助詞", note: "topic marker" },
      { type: "followups", chips: ["What about が?"] },
    ] }).success).toBe(true);
  });

  it("rejects markup blocks, unknown fields and every overflow", () => {
    for (const bad of [
      { blocks: [{ type: "html", html: "<b>x</b>" }] },
      { blocks: [] },
      { blocks: Array.from({ length: 13 }, () => para) },
      { blocks: [{ type: "followups", chips: ["a", "b", "c", "d", "e"] }] },
      { blocks: [{ type: "followups", chips: ["x".repeat(41)] }] },
      { blocks: [{ ...para, extra: 1 }] },
      { blocks: [{ type: "paragraph", runs: [{ text: "x", html: "<i>" }] }] },
    ]) expect(answerV1Schema.safeParse(bad).success, JSON.stringify(bad).slice(0, 60)).toBe(false);
  });
});

const grounding: GroundedEntity[] = [{ id: "tok:は:助詞", label: "は", kind: "particle", seenCount: 3 }];

describe("dropUngroundedCards", () => {
  it("keeps only cards that name a grounded entity", () => {
    const answer: AnswerV1 = { blocks: [para, { type: "context_card", entityRef: "tok:は:助詞" }, { type: "context_card", entityRef: "ent:999" }] };
    expect(dropUngroundedCards(answer, grounding).blocks.map((b) => b.type === "context_card" ? b.entityRef : b.type))
      .toEqual(["paragraph", "tok:は:助詞"]);
  });
});

describe("answerToPlainText", () => {
  it("joins paragraphs, examples and cards with blank lines and never emits markup", () => {
    const text = answerToPlainText({ blocks: [
      para,
      { type: "example", jp: "私は学生です", ruby: [], translation: "I am a student" },
      { type: "context_card", entityRef: "tok:は:助詞", note: "topic marker" },
      { type: "context_card", entityRef: "ent:404" },
      { type: "followups", chips: ["More?"] },
    ] }, grounding);
    expect(text).toBe("は marks the topic: 今日は\n\n私は学生です — I am a student\n\nは: topic marker");
    expect(text).not.toMatch(/[<>*_]/);
  });
});

describe("groundingSchema", () => {
  it("accepts server-built entities and refuses a foreign id scheme or extra fields", () => {
    expect(groundingSchema.safeParse(grounding).success).toBe(true);
    expect(groundingSchema.safeParse([{ id: "javascript:x", label: "x", kind: "particle" }]).success).toBe(false);
    expect(groundingSchema.safeParse([{ ...grounding[0], html: "<b>" }]).success).toBe(false);
  });
});
