import { describe, expect, it } from "vitest";
import { parseCsv } from "./parse";
import { toCsv } from "./write";

describe("toCsv — RFC 4180", () => {
  it("writes a header and one CRLF-terminated line per row", () => {
    expect(toCsv(["a", "b"], [["1", "2"], ["3", "4"]])).toBe("a,b\r\n1,2\r\n3,4");
  });

  it("quotes only the fields that need it, doubling inner quotes", () => {
    expect(toCsv(["x"], [["plain"]])).toBe("x\r\nplain");
    expect(toCsv(["x"], [["a,b"]])).toBe('x\r\n"a,b"');
    expect(toCsv(["x"], [['say "hi"']])).toBe('x\r\n"say ""hi"""');
    expect(toCsv(["x"], [["line\nbreak"]])).toBe('x\r\n"line\nbreak"');
    expect(toCsv(["x"], [["carriage\rreturn"]])).toBe('x\r\n"carriage\rreturn"');
  });

  it("writes null as an empty field and keeps numbers unquoted", () => {
    expect(toCsv(["a", "b"], [[null, 42]])).toBe("a,b\r\n,42");
  });

  // A cell a spreadsheet would execute rather than display.
  it.each(["=1+1", "+1", "-1", "@SUM(A1)"])("defuses the formula %s with a leading quote", (value) => {
    expect(toCsv(["x"], [[value]])).toBe(`x\r\n"'${value}"`);
  });

  it("does not defuse a negative number, which is data and not a formula", () => {
    expect(toCsv(["x"], [[-5]])).toBe("x\r\n-5");
  });

  it("round trips through parseCsv, including the awkward fields", () => {
    const header = ["date", "kind", "item", "detail"];
    const rows = [
      ["2026-09-23", "review", 'kanji "日"', "interval 10"],
      ["2026-09-22", "lesson", "a, comma", null],
      ["2026-09-21", "badge", "line\nbreak", 3],
    ];
    const parsed = parseCsv(toCsv(header, rows));

    expect(parsed.headers).toEqual(header);
    expect(parsed.records).toHaveLength(3);
    expect(parsed.records[0]?.fields.item).toBe('kanji "日"');
    expect(parsed.records[1]?.fields.item).toBe("a, comma");
    expect(parsed.records[1]?.fields.detail).toBe("");
    expect(parsed.records[2]?.fields.item).toBe("line\nbreak");
  });

  it("writes a header-only file when there are no rows", () => {
    expect(toCsv(["a", "b"], [])).toBe("a,b");
  });
});
