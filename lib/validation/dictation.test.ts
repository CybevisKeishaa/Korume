import { describe, expect, it } from "vitest";
import { dictationAttemptSchema } from "./dictation";

const ids = { videoId: "11111111-1111-4111-8111-111111111111", lineId: "22222222-2222-4222-8222-222222222222" };
const head = { ...ids, version: 1, textHash: "a".repeat(64) };
const wordBank = { kind: "submit", format: "word_bank", ...head, chunkOrder: [1, 0], hintedUnits: [] };
const typing = { kind: "submit", format: "typing", ...head, input: "きょう", hintUnit: "chunk", hintedUnits: [0] };
const revealWordBank = { kind: "reveal", format: "word_bank", ...head, hintedUnits: [] };
const revealTyping = { kind: "reveal", format: "typing", ...head, hintUnit: "grapheme4", hintedUnits: [] };

describe("dictationAttemptSchema (spec §5.4)", () => {
  it.each([wordBank, typing, revealWordBank, revealTyping])("accepts the four shapes", (body) => {
    expect(dictationAttemptSchema.parse(body)).toEqual(body);
  });

  it("accepts a 20-piece Word Bank order", () => {
    const body = { ...wordBank, chunkOrder: Array.from({ length: 20 }, (_, i) => i) };
    expect(dictationAttemptSchema.parse(body)).toEqual(body);
  });

  it.each([
    ["a Word Bank body carrying hintUnit", { ...wordBank, hintUnit: "chunk" }],
    ["a Word Bank reveal carrying hintUnit", { ...revealWordBank, hintUnit: "chunk" }],
    ["a reveal carrying input", { ...revealTyping, input: "x" }],
    ["a reveal carrying chunkOrder", { ...revealWordBank, chunkOrder: [0] }],
    ["the legacy body", { ...ids, userInput: "x" }],
    ["an unknown kind", { ...wordBank, kind: "skip" }],
    ["an unknown format", { ...typing, format: "listening" }],
    ["version 0", { ...wordBank, version: 0 }],
    ["a fractional version", { ...wordBank, version: 1.5 }],
    ["a short textHash", { ...wordBank, textHash: "a".repeat(63) }],
    ["an upper-case textHash", { ...wordBank, textHash: "A".repeat(64) }],
    ["more than 64 pieces", { ...wordBank, chunkOrder: Array.from({ length: 65 }, (_, i) => i) }],
    ["a fractional chunk index", { ...wordBank, chunkOrder: [0.5, 1] }],
    ["more than 200 hints", { ...typing, hintedUnits: Array.from({ length: 201 }, (_, i) => i) }],
    ["a fractional hint", { ...typing, hintedUnits: [0.5] }],
    ["input over 2000 characters", { ...typing, input: "あ".repeat(2001) }],
    ["an unknown hint unit", { ...typing, hintUnit: "word" }],
    ["a Typing submit without hintUnit", { ...typing, hintUnit: undefined }],
    ["a bad lineId", { ...wordBank, lineId: "nope" }],
    ["the unscored status smuggled in", { ...wordBank, status: "unscored" }],
  ])("rejects %s", (_, body) => {
    expect(dictationAttemptSchema.safeParse(body).success).toBe(false);
  });
});
