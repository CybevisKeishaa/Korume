import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { answerToPlainText, answerV1Schema, answerV2Schema, capBlocks, dropUngroundedCards, groundingSchema, type AnswerV1, type Block } from "./answer";
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

  it("drops a block of an invented type instead of failing the whole answer (Gemini, live 2026-10-31)", () => {
    const parsed = answerV1Schema.safeParse({ blocks: [para, { type: "heading", text: "Cấu trúc" }, { type: "list", items: ["a"] }, para] });
    expect(parsed.success && parsed.data.blocks).toEqual([para, para]);
  });

  it("drops an over-bound block (a 41-char chip, Gemini live 2026-10-31) and keeps the rest", () => {
    const parsed = answerV1Schema.safeParse({ blocks: [para, { type: "followups", chips: ["ok", "x".repeat(41)] }] });
    expect(parsed.success && parsed.data.blocks).toEqual([para]);
  });

  it("fails when no block survives", () => {
    expect(answerV1Schema.safeParse({ blocks: [{ type: "heading" }, { ...para, extra: 1 }] }).success).toBe(false);
  });

  it("still sends Gemini the full block schema", () => {
    const json = JSON.stringify(z.toJSONSchema(answerV1Schema));
    for (const type of ["paragraph", "example", "context_card", "followups"]) expect(json).toContain(`"${type}"`);
  });
});

const t = (x: string) => [{ text: x }];
const heading = { type: "heading", level: 1, runs: t("1. Liệt kê thành phần câu") };
const table = { type: "table", header: [t("Thành phần"), t("Tiếng Nhật"), t("Vai trò")], rows: Array.from({ length: 10 }, () => [t("x"), [{ jp: "のまま" }], t("y")]) };
const check = { type: "list", style: "check", items: [{ mark: "bad", runs: [{ jp: "間違ったのまま" }]}, { mark: "good", runs: [{ jp: "間違ったまま" }] }] };
const numbered = { type: "list", style: "number", items: [{ runs: t("a") }, { runs: t("b") }] };
const chips = { type: "followups", chips: ["More?"] };

describe("answerV2Schema", () => {
  const kinds = (b: unknown[]) => { const r = answerV2Schema.safeParse({ blocks: b }); return r.success ? r.data.blocks.map((x) => x.type) : r.success; };

  it("accepts the section 7 shape", () => {
    expect(kinds([heading, table, check, numbered, chips])).toEqual(["heading", "table", "list", "list", "followups"]);
  });

  it("drops an out-of-bounds block, keeps the rest", () => {
    const cols = (n: number) => Array.from({ length: n }, () => t("h"));
    const bad = [
      { ...table, header: cols(5) }, { ...table, header: cols(1) },
      { type: "list", style: "bullet", items: Array.from({ length: 13 }, () => ({ runs: t("a") })) },
      { ...heading, level: 3 }, { ...heading, runs: Array.from({ length: 9 }, () => ({ text: "a" })) },
      { ...table, rows: [Array.from({ length: 5 }, () => t("c"))] },
      { ...table, rows: [[Array.from({ length: 9 }, () => ({ text: "a" }))]] },
      { ...heading, html: "<b>" }, { ...table, html: "<b>" }, { ...check, html: "<b>" },
    ];
    for (const b of bad) expect(kinds([b, para]), JSON.stringify(b).slice(0, 50)).toEqual(["paragraph"]);
  });

  it("keeps a ragged table", () => {
    expect(kinds([{ ...table, rows: [[t("a"), t("b")]] }])).toEqual(["table"]);
  });

  it("accepts 32 blocks, cuts 33 to 32 keeping trailing followups", () => {
    const followups: Block = { type: "followups", chips: ["ok"] };
    expect(answerV2Schema.safeParse({ blocks: Array.from({ length: 32 }, () => para) }).success).toBe(true);
    const cut = answerV2Schema.safeParse({ blocks: [...Array.from({ length: 32 }, () => para), followups] });
    expect(cut.success && cut.data.blocks).toHaveLength(32);
    expect(cut.success && cut.data.blocks[31]).toEqual(followups);
  });

  it("v1 still drops a valid v2 heading", () => {
    const parsed = answerV1Schema.safeParse({ blocks: [para, heading, table, check] });
    expect(parsed.success && parsed.data.blocks).toEqual([para]);
  });

  it("sends Gemini all 7 block types", () => {
    const json = JSON.stringify(z.toJSONSchema(answerV2Schema));
    for (const type of ["paragraph", "example", "context_card", "followups", "heading", "list", "table"]) expect(json).toContain(`"${type}"`);
  });
});

describe("capBlocks", () => {
  const p = (n: number) => Array.from({ length: n }, () => para);
  it("keeps a trailing followups when cutting", () => {
    expect(capBlocks({ blocks: [...p(4), chips as Block] }, 3).blocks).toEqual([para, para, chips]);
  });
  it("cuts plain blocks", () => {
    expect(capBlocks({ blocks: p(4) }, 3).blocks).toEqual(p(3));
  });
  it("leaves an answer within the cap", () => {
    expect(capBlocks({ blocks: p(3) }, 3)).toEqual({ blocks: p(3) });
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

describe("answerToPlainText rich blocks", () => {
  it("renders heading, lists and table as plain text", () => {
    const text = answerToPlainText({ blocks: [
      heading, numbered, { type: "list", style: "bullet", items: [{ runs: t("a") }] },
      { type: "list", style: "check", items: [{ mark: "good", runs: t("a") }, { mark: "bad", runs: t("b") }, { runs: t("c") }] },
      { type: "table", header: [t("H1"), t("H2")], rows: [[t("a"), [{ text: "b" }, { jp: "c" }]]] },
    ] } as never, grounding);
    expect(text).toBe("1. Liệt kê thành phần câu\n\n1. a\n2. b\n\n- a\n\n✓ a\n✗ b\n- c\n\nH1 | H2\na | bc");
    expect(text).not.toMatch(/[{<*#]/);
  });
});

describe("groundingSchema", () => {
  it("accepts server-built entities and refuses a foreign id scheme or extra fields", () => {
    expect(groundingSchema.safeParse(grounding).success).toBe(true);
    expect(groundingSchema.safeParse([{ id: "javascript:x", label: "x", kind: "particle" }]).success).toBe(false);
    expect(groundingSchema.safeParse([{ ...grounding[0], html: "<b>" }]).success).toBe(false);
  });
});
