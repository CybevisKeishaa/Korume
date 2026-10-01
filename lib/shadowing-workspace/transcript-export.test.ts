import { describe, expect, it } from "vitest";
import { toPlainText, toSrt } from "./transcript-export";
import type { WorkspaceLine } from "./types";

const lines: WorkspaceLine[] = [
  { id: "a", index: 0, startTime: 0, endTime: 3.55, textJp: "JP", textTranslation: "VI", furigana: null },
  { id: "b", index: 1, startTime: 3.55, endTime: null, textJp: "NEXT", textTranslation: null, furigana: null },
];

describe("transcript export", () => {
  it("writes exact finite SRT timing using next start or duration", () => {
    expect(toSrt([...lines, { ...lines[1]!, id: "c", index: 2, startTime: 5.09, endTime: 6 }], 20)).toBe("1\n00:00:00,000 --> 00:00:03,550\nJP\n\n2\n00:00:03,550 --> 00:00:05,090\nNEXT\n\n3\n00:00:05,090 --> 00:00:06,000\nNEXT");
    expect(toSrt(lines, null)).toContain("00:00:03,550 --> 00:00:05,550");
    expect(toSrt(lines, null)).not.toContain("Infinity");
    // Hours, and a null-ended last line past a stale duration never ends before it starts.
    expect(toSrt([{ ...lines[1]!, startTime: 3725.5, endTime: null }], 100)).toBe("1\n01:02:05,500 --> 01:02:05,500\nNEXT");
  });

  it("writes Japanese and optional translation blocks", () => {
    expect(toPlainText(lines)).toBe("JP\nVI\n\nNEXT");
  });
});
