import { describe, expect, it } from "vitest";
import { LESSON_NOTE_MAX, LESSON_NOTE_MAX_BYTES, SENTENCE_NOTE_MAX, SENTENCE_NOTE_MAX_BYTES, lessonNoteBodySchema, sentenceNoteBodySchema, sentenceNoteKeySchema } from "./notes";

const LINE_ID = "a0000000-0000-0000-0000-000000000001";

describe("note body schemas", () => {
  it("byte caps fit a full note sent in the worst JSON encoding (escaped surrogate pairs)", () => {
    const escaped = (max: number, key: string) => `{${key}"body":"${"\\uD842\\uDFB7".repeat(max)}"}`;
    const sentence = escaped(SENTENCE_NOTE_MAX, `"transcriptLineId":"${LINE_ID}",`);
    const lesson = escaped(LESSON_NOTE_MAX, "");
    expect(Buffer.byteLength(sentence)).toBeLessThanOrEqual(SENTENCE_NOTE_MAX_BYTES);
    expect(Buffer.byteLength(lesson)).toBeLessThanOrEqual(LESSON_NOTE_MAX_BYTES);
    expect(sentenceNoteBodySchema.safeParse(JSON.parse(sentence)).success).toBe(true);
    expect(lessonNoteBodySchema.safeParse(JSON.parse(lesson)).success).toBe(true);
  });

  it("accepts a body up to the cap and an empty body (the delete form)", () => {
    expect(sentenceNoteBodySchema.safeParse({ transcriptLineId: LINE_ID, body: "x".repeat(SENTENCE_NOTE_MAX) }).success).toBe(true);
    expect(sentenceNoteBodySchema.safeParse({ transcriptLineId: LINE_ID, body: "" }).success).toBe(true);
    expect(lessonNoteBodySchema.safeParse({ body: "x".repeat(LESSON_NOTE_MAX) }).success).toBe(true);
  });

  it("rejects one character over the cap, an unknown key and a bad line id", () => {
    expect(sentenceNoteBodySchema.safeParse({ transcriptLineId: LINE_ID, body: "x".repeat(SENTENCE_NOTE_MAX + 1) }).success).toBe(false);
    expect(lessonNoteBodySchema.safeParse({ body: "x".repeat(LESSON_NOTE_MAX + 1) }).success).toBe(false);
    expect(sentenceNoteBodySchema.safeParse({ transcriptLineId: LINE_ID, body: "a", userId: "u" }).success).toBe(false);
    expect(sentenceNoteBodySchema.safeParse({ transcriptLineId: "nope", body: "a" }).success).toBe(false);
    expect(sentenceNoteKeySchema.safeParse({ transcriptLineId: LINE_ID, body: "a" }).success).toBe(false);
  });

  it("counts code points like char_length, so a non-BMP kanji is one character", () => {
    // 𠮷 is two UTF-16 units; zod's .max() would refuse a note PostgreSQL accepts.
    expect(sentenceNoteBodySchema.safeParse({ transcriptLineId: LINE_ID, body: "𠮷".repeat(SENTENCE_NOTE_MAX) }).success).toBe(true);
    expect(sentenceNoteBodySchema.safeParse({ transcriptLineId: LINE_ID, body: "𠮷".repeat(SENTENCE_NOTE_MAX + 1) }).success).toBe(false);
  });
});
