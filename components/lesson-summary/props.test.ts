import { describe, expect, it } from "vitest";
import type { LoadedSummary } from "@/lib/summary/load-snapshot";
import type { SummaryNavigation } from "@/lib/summary/navigation";
import { toSummaryProps } from "./props";

const target = (i: number) => ({ lineId: `line-${i}`, lineText: `文${i}`, reasons: ["pronunciation" as const], focusSpan: null });
const DATA: LoadedSummary = {
  userId: "u-1",
  video: { id: "v-1", youtubeVideoId: "yt", title: "At the café", thumbnailUrl: null, jlptLevel: "N4", durationSeconds: 359 },
  lines: [0, 1, 2].map((i) => ({ id: `line-${i}`, index: i, textJp: `文${i}`, translation: null, startTime: i, endTime: i + 1 })),
  hasTranscript: true,
  completed: true,
  snapshot: {
    status: {
      shadowing: { kind: "complete" }, pronunciation: { kind: "scored", score: 82 },
      listening: { kind: "not_started" }, retention: { kind: "not_enough_data" },
    },
    savedKnowledge: { vocabulary: 2, expressions: 1, grammar: 0, retention: { kind: "not_enough_data" } },
    reviewTargets: Array.from({ length: 7 }, (_, i) => target(i)),
    bestLine: { lineId: "line-0", lineText: "文0" },
  },
  saved: [{ cardId: "c-1", kind: "vocabulary", ref: "注文", lineId: "line-1" }],
};
const NAV: SummaryNavigation = { nextLesson: null, replayHref: "/shadowing/v-1?line=line-0", resumeHref: "/shadowing/v-1?line=line-2" };

describe("toSummaryProps", () => {
  it("is plain JSON (survives structuredClone and a JSON round trip unchanged)", () => {
    const props = toSummaryProps(DATA, NAV);
    expect(structuredClone(props)).toEqual(props);
    expect(JSON.parse(JSON.stringify(props))).toEqual(props);
  });

  it("cuts the shown review targets to five and keeps the full count", () => {
    const props = toSummaryProps(DATA, NAV);
    expect(props.reviewTargets).toHaveLength(5);
    expect(props.reviewTargets[0]?.lineId).toBe("line-0");
    expect(props.reviewTargetTotal).toBe(7);
  });

  it("derives sentence count, duration minutes and passes JLPT and navigation through", () => {
    const props = toSummaryProps(DATA, NAV);
    expect(props).toMatchObject({
      sentenceCount: 3, durationMinutes: 6, jlptLevel: "N4", completed: true, hasTranscript: true,
      replayHref: NAV.replayHref, resumeHref: NAV.resumeHref, nextLesson: null,
      fallback: { kind: "best_line", line: "文0" }, savedCards: DATA.saved,
    });
    expect(toSummaryProps({ ...DATA, video: { ...DATA.video, durationSeconds: 10 } }, NAV).durationMinutes).toBe(1);
    expect(toSummaryProps({ ...DATA, video: { ...DATA.video, durationSeconds: null } }, NAV).durationMinutes).toBeNull();
  });
});
