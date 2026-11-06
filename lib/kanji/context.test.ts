import { describe, expect, it } from "vitest";
import { formatKanjiContext, parseKanjiContext } from "./context";

describe("parseKanjiContext", () => {
  it("parses a level and the favorites list", () => {
    expect(parseKanjiContext("level:N5")).toEqual({ kind: "level", level: "N5" });
    expect(parseKanjiContext("favorites")).toEqual({ kind: "favorites" });
  });

  it.each(["level:N9", "x", "level:", "", null])("rejects %s", (raw) => {
    expect(parseKanjiContext(raw)).toBeNull();
  });

  it("round-trips through formatKanjiContext", () => {
    expect(formatKanjiContext({ kind: "level", level: "N1" })).toBe("level:N1");
    expect(formatKanjiContext({ kind: "favorites" })).toBe("favorites");
  });
});
