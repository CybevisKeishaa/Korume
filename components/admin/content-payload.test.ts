import { describe, expect, it } from "vitest";
import { buildContentPayload, ContentPayloadError } from "./content-payload";
import type { ContentFieldConfig } from "./content-fields";

const fields: ContentFieldConfig[] = [
  { name: "word", label: "Word", kind: "text", required: true },
  { name: "reading", label: "Reading", kind: "text", nullable: true },
  { name: "count", label: "Count", kind: "number", nullable: true },
  { name: "jlpt_level", label: "JLPT level", kind: "select", nullable: true, options: ["N5", "N4"] },
  { name: "readings", label: "Readings", kind: "json" },
];

describe("buildContentPayload", () => {
  it("includes every filled scalar field on create", () => {
    const payload = buildContentPayload(
      fields,
      { word: "犬", reading: "いぬ", count: "3", jlpt_level: "N5", readings: "" },
      "create",
      new Set(),
    );
    expect(payload).toEqual({ word: "犬", reading: "いぬ", count: 3, jlpt_level: "N5" });
  });

  it("maps an empty nullable field to null on create", () => {
    const payload = buildContentPayload(fields, { word: "犬", reading: "", count: "", jlpt_level: "", readings: "" }, "create", new Set());
    expect(payload).toEqual({ word: "犬", reading: null, count: null, jlpt_level: null });
  });

  it("throws for an empty required field", () => {
    expect(() =>
      buildContentPayload(fields, { word: "", reading: "", count: "", jlpt_level: "", readings: "" }, "create", new Set()),
    ).toThrow(ContentPayloadError);
  });

  it("parses a non-empty JSON field", () => {
    const payload = buildContentPayload(
      fields,
      { word: "犬", reading: "", count: "", jlpt_level: "", readings: '[{"reading":"いぬ","reading_type":"kun"}]' },
      "create",
      new Set(),
    );
    expect(payload.readings).toEqual([{ reading: "いぬ", reading_type: "kun" }]);
  });

  it("throws ContentPayloadError with the field name for invalid JSON", () => {
    try {
      buildContentPayload(fields, { word: "犬", reading: "", count: "", jlpt_level: "", readings: "{not json" }, "create", new Set());
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ContentPayloadError);
      expect((err as ContentPayloadError).field).toBe("readings");
    }
  });

  it("throws for a non-numeric value in a number field", () => {
    expect(() =>
      buildContentPayload(fields, { word: "犬", reading: "", count: "abc", jlpt_level: "", readings: "" }, "create", new Set()),
    ).toThrow(ContentPayloadError);
  });

  it("omits a blank JSON field entirely (leaves children untouched on edit, none created on create)", () => {
    const payload = buildContentPayload(fields, { word: "犬", reading: "", count: "", jlpt_level: "", readings: "" }, "create", new Set());
    expect(payload).not.toHaveProperty("readings");
  });

  it("on edit, omits a blank field that wasn't part of the known (list) columns rather than nulling it", () => {
    // `count` isn't in knownFields — the edit form never saw its real value,
    // so leaving it blank must NOT send `count: null` and silently wipe it.
    const payload = buildContentPayload(
      fields,
      { word: "犬", reading: "", count: "", jlpt_level: "", readings: "" },
      "edit",
      new Set(["word", "reading", "jlpt_level"]),
    );
    expect(payload).not.toHaveProperty("count");
  });

  it("on edit, still nulls a blank field that IS part of the known (list) columns", () => {
    const payload = buildContentPayload(
      fields,
      { word: "犬", reading: "", count: "", jlpt_level: "", readings: "" },
      "edit",
      new Set(["word", "reading", "jlpt_level"]),
    );
    expect(payload.reading).toBeNull();
  });

  it("on edit, always includes a non-empty JSON field regardless of known columns (explicit replace)", () => {
    const payload = buildContentPayload(
      fields,
      { word: "犬", reading: "", count: "", jlpt_level: "", readings: "[]" },
      "edit",
      new Set(["word"]),
    );
    expect(payload.readings).toEqual([]);
  });
});
