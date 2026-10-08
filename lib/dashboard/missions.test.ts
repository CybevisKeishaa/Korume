import { describe, expect, it } from "vitest";
import { rankMissionHints, type PracticeActivity } from "./missions";

const shadow = (count: number, lastAt: string | null = null, lastVideoId: string | null = "vs"): PracticeActivity =>
  ({ type: "shadow_lines", count, lastAt, lastVideoId });
const dictation = (count: number, lastAt: string | null = null, lastVideoId: string | null = "vd"): PracticeActivity =>
  ({ type: "dictation_lines", count, lastAt, lastVideoId });

describe("rankMissionHints (spec M2)", () => {
  it("continue lesson with lines and no practice: finish, then shadow, then dictation on that lesson", () => {
    expect(rankMissionHints({ continueLesson: { videoId: "v1", hasLines: true }, practice: [] })).toEqual([
      { type: "finish_lesson", videoId: "v1" },
      { type: "shadow_lines", videoId: "v1" },
      { type: "dictation_lines", videoId: "v1" },
    ]);
  });

  it("ranks the modality practised more in the window first", () => {
    const hints = rankMissionHints({ continueLesson: { videoId: "v1", hasLines: true }, practice: [shadow(2), dictation(9)] });
    expect(hints.map((hint) => hint.type)).toEqual(["finish_lesson", "dictation_lines", "shadow_lines"]);
  });

  it("equal counts: the more recent modality first; equal recency: shadowing first", () => {
    const recent = rankMissionHints({ continueLesson: null, practice: [shadow(3, "2026-10-01T00:00:00Z"), dictation(3, "2026-10-05T00:00:00Z")] });
    expect(recent.map((hint) => hint.type)).toEqual(["dictation_lines", "shadow_lines"]);
    const tied = rankMissionHints({ continueLesson: null, practice: [dictation(3, "2026-10-05T00:00:00Z"), shadow(3, "2026-10-05T00:00:00Z")] });
    expect(tied.map((hint) => hint.type)).toEqual(["shadow_lines", "dictation_lines"]);
  });

  it("continue lesson without lines: practice uses each modality's last lesson; none means no hint", () => {
    expect(rankMissionHints({ continueLesson: { videoId: "v1", hasLines: false }, practice: [shadow(4, null, "vs"), dictation(1, null, null)] }))
      .toEqual([{ type: "finish_lesson", videoId: "v1" }, { type: "shadow_lines", videoId: "vs" }]);
  });

  it("invents no lesson when there is nothing to continue and nothing practised", () => {
    expect(rankMissionHints({ continueLesson: null, practice: [] })).toEqual([]);
  });
});
