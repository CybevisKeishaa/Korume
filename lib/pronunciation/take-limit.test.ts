import { describe, expect, it } from "vitest";
import type { WorkspaceLine } from "@/lib/shadowing-workspace/types";
import { takeLimitSeconds } from "./take-limit";

const line = (endTime: number | null): WorkspaceLine => ({ id: "one", index: 0, startTime: 0, endTime, textJp: "文", textTranslation: null, furigana: null });
describe("takeLimitSeconds", () => {
  it.each([[2, 7], [20, 30], [null, 30], [NaN, 30], [-1, 30], [Infinity, 30]])("bounds duration %s", (end, expected) => {
    expect(takeLimitSeconds([line(end)], 0, null)).toBe(expected);
  });
  it("uses the next line or known video end for open lines", () => {
    expect(takeLimitSeconds([line(null), { ...line(10), startTime: 2 }], 0, null)).toBe(7);
    expect(takeLimitSeconds([line(null)], 0, 3)).toBe(9);
    expect(takeLimitSeconds([], 0, null)).toBe(30);
  });
});
