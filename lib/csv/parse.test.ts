import { describe, expect, it } from "vitest";
import { parseCsv } from "./parse";

describe("parseCsv", () => {
  it("parses a simple header + rows CSV", () => {
    const result = parseCsv("word,reading\n猫,ねこ\n犬,いぬ");
    expect(result.headers).toEqual(["word", "reading"]);
    expect(result.records).toEqual([
      { rowNumber: 1, fields: { word: "猫", reading: "ねこ" } },
      { rowNumber: 2, fields: { word: "犬", reading: "いぬ" } },
    ]);
  });

  it("handles CRLF line endings", () => {
    const result = parseCsv("word,reading\r\n猫,ねこ\r\n犬,いぬ\r\n");
    expect(result.records).toHaveLength(2);
    expect(result.records[0]?.fields).toEqual({ word: "猫", reading: "ねこ" });
  });

  it("handles a quoted field containing a comma", () => {
    const result = parseCsv('title,note\n"hello, world",plain');
    expect(result.records[0]?.fields).toEqual({ title: "hello, world", note: "plain" });
  });

  it("handles a quoted field containing an escaped double quote", () => {
    const result = parseCsv('title,note\n"she said ""hi""",plain');
    expect(result.records[0]?.fields).toEqual({ title: 'she said "hi"', note: "plain" });
  });

  it("handles a quoted field containing an embedded newline", () => {
    const result = parseCsv('title,body\n"line one\nline two",x');
    expect(result.records[0]?.fields).toEqual({ title: "line one\nline two", body: "x" });
  });

  it("tolerates a trailing blank line at end of input", () => {
    const result = parseCsv("word,reading\n猫,ねこ\n");
    expect(result.records).toHaveLength(1);
  });

  it("tolerates no trailing newline at all", () => {
    const result = parseCsv("word,reading\n猫,ねこ");
    expect(result.records).toHaveLength(1);
  });

  it("fills missing trailing columns with an empty string", () => {
    const result = parseCsv("word,reading,meaning\n猫,ねこ");
    expect(result.records[0]?.fields).toEqual({ word: "猫", reading: "ねこ", meaning: "" });
  });

  it("trims header whitespace", () => {
    const result = parseCsv(" word , reading \n猫,ねこ");
    expect(result.headers).toEqual(["word", "reading"]);
  });

  it("returns an empty result for an empty string", () => {
    const result = parseCsv("");
    expect(result.headers).toEqual([]);
    expect(result.records).toEqual([]);
  });

  it("returns headers with no records for a header-only input", () => {
    const result = parseCsv("word,reading\n");
    expect(result.headers).toEqual(["word", "reading"]);
    expect(result.records).toEqual([]);
  });

  it("numbers records 1-based, excluding the header row", () => {
    const result = parseCsv("a\nfirst\nsecond\nthird");
    expect(result.records.map((r) => r.rowNumber)).toEqual([1, 2, 3]);
  });
});
