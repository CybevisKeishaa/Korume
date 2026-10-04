import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import type { SummaryLine } from "./snapshot";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireUser: vi.fn(),
  selectVideoById: vi.fn(),
  getRecommendations: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/data/videos", () => ({
  requireUser: mocks.requireUser,
  selectVideoById: mocks.selectVideoById,
}));
vi.mock("@/lib/data/recommendations", () => ({ getRecommendations: mocks.getRecommendations }));

import { getSummaryNavigation, lineHrefs } from "./navigation";

const VIDEO_ID = "11111111-1111-4111-8111-111111111111";
const USER = { id: "22222222-2222-4222-8222-222222222222" };
const lines: SummaryLine[] = [
  { id: "line-1", index: 0, textJp: "one", translation: null, startTime: 0, endTime: 5 },
  { id: "line-2", index: 1, textJp: "two", translation: null, startTime: 10, endTime: 15 },
  { id: "line-3", index: 2, textJp: "three", translation: null, startTime: 20, endTime: 25 },
];

describe("lineHrefs", () => {
  it("uses the bare shadowing route when the lesson has no lines", () => {
    expect(lineHrefs(VIDEO_ID, [], null)).toEqual({
      replayHref: `/shadowing/${VIDEO_ID}`,
      resumeHref: `/shadowing/${VIDEO_ID}`,
    });
  });

  it("replays the first line and uses it when no resume position exists", () => {
    expect(lineHrefs(VIDEO_ID, lines, null)).toEqual({
      replayHref: `/shadowing/${VIDEO_ID}?line=line-1`,
      resumeHref: `/shadowing/${VIDEO_ID}?line=line-1`,
    });
  });

  it.each([
    [12, "line-2"],
    [-1, "line-1"],
    [99, "line-3"],
  ])("uses the last line that starts at or before resume position %i", (position, lineId) => {
    expect(lineHrefs(VIDEO_ID, lines, position).resumeHref).toBe(`/shadowing/${VIDEO_ID}?line=${lineId}`);
  });
});

function hasCall(calls: QueryCall[], expected: QueryCall): boolean {
  return calls.some((call) => JSON.stringify(call) === JSON.stringify(expected));
}

describe("getSummaryNavigation", () => {
  const collectionCalls: QueryCall[][] = [];
  const progressCalls: QueryCall[][] = [];

  function mockClient(options: {
    memberships?: unknown[];
    next?: unknown;
    progress?: unknown;
  } = {}) {
    const supabase = createMockSupabase({
      tables: {
        lesson_collections: (calls) => {
          collectionCalls.push([...calls]);
          if (hasCall(calls, { op: "eq", column: "lesson_id", value: VIDEO_ID })) {
            if (
              options.memberships?.some((membership) => (
                (membership as { position?: number }).position === 0
              ))
              && hasCall(calls, { op: "gt", column: "position", value: 0 })
            ) {
              return { data: [], error: null };
            }
            return { data: options.memberships ?? [], error: null };
          }
          return { data: options.next ?? null, error: null };
        },
        user_video_progress: (calls) => {
          progressCalls.push([...calls]);
          return { data: options.progress ?? null, error: null };
        },
      },
    });
    mocks.createClient.mockReturnValue(supabase);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    collectionCalls.length = 0;
    progressCalls.length = 0;
    mocks.requireUser.mockResolvedValue(USER);
    mocks.getRecommendations.mockResolvedValue({ ok: true, data: [] });
  });

  it("uses the next ordered lesson in a path and records both path queries' filters", async () => {
    mockClient({
      memberships: [{ collection_id: "path-1", position: 2 }],
      next: { lesson_id: "next-video" },
      progress: { last_watched_position: "12.000" },
    });
    mocks.selectVideoById.mockResolvedValue({
      id: "next-video", title: "Next lesson", thumbnail_url: "thumb", jlpt_level_estimate: "N4",
    });

    await expect(getSummaryNavigation(VIDEO_ID, lines)).resolves.toEqual({
      replayHref: `/shadowing/${VIDEO_ID}?line=line-1`,
      resumeHref: `/shadowing/${VIDEO_ID}?line=line-2`,
      nextLesson: {
        videoId: "next-video", title: "Next lesson", thumbnailUrl: "thumb", jlptLevel: "N4",
        href: "/shadowing/next-video", reason: "path",
      },
    });
    expect(collectionCalls).toEqual(expect.arrayContaining([
      expect.arrayContaining([
        { op: "select", columns: "collection_id, position, collections!inner(kind)" },
        { op: "eq", column: "lesson_id", value: VIDEO_ID },
        { op: "eq", column: "collections.kind", value: "path" },
        { op: "gt", column: "position", value: 0 },
        { op: "order", column: "collection_id", ascending: true },
      ]),
      expect.arrayContaining([
        { op: "select", columns: "lesson_id" },
        { op: "eq", column: "collection_id", value: "path-1" },
        { op: "gt", column: "position", value: 2 },
        { op: "order", column: "position", ascending: true },
        { op: "limit", count: 1 },
        { op: "maybeSingle" },
      ]),
    ]));
    expect(progressCalls).toEqual([[
      { op: "select", columns: "last_watched_position" },
      { op: "eq", column: "user_id", value: USER.id },
      { op: "eq", column: "video_id", value: VIDEO_ID },
      { op: "maybeSingle" },
    ]]);
  });

  it("excludes unordered path memberships before finding a next lesson", async () => {
    mockClient({ memberships: [{ collection_id: "path-1", position: 0 }] });
    mocks.getRecommendations.mockResolvedValue({ ok: true, data: [] });

    await expect(getSummaryNavigation(VIDEO_ID, lines)).resolves.toMatchObject({ nextLesson: null });
    expect(collectionCalls).toHaveLength(1);
    expect(collectionCalls[0]).toContainEqual({ op: "gt", column: "position", value: 0 });
  });

  it("falls through to the first different recommendation when no path has a later lesson", async () => {
    mockClient({ memberships: [{ collection_id: "path-1", position: 2 }], next: null });
    mocks.getRecommendations.mockResolvedValue({ ok: true, data: [
      { videoId: VIDEO_ID, title: "Current", thumbnailUrl: null, jlptLevelEstimate: "N5" },
      { videoId: "recommended", title: "Recommended", thumbnailUrl: "thumb", jlptLevelEstimate: "N3" },
    ] });

    await expect(getSummaryNavigation(VIDEO_ID, lines)).resolves.toMatchObject({
      nextLesson: {
        videoId: "recommended", title: "Recommended", thumbnailUrl: "thumb", jlptLevel: "N3",
        href: "/shadowing/recommended", reason: "recommended",
      },
    });
    expect(mocks.getRecommendations).toHaveBeenCalledWith({ limit: 12 });
  });

  it.each([
    { ok: false, status: 401 },
    { ok: true, data: [] },
  ])("has no next lesson when recommendations are unavailable: %j", async (recommendations) => {
    mockClient();
    mocks.getRecommendations.mockResolvedValue(recommendations);

    await expect(getSummaryNavigation(VIDEO_ID, lines)).resolves.toMatchObject({ nextLesson: null });
  });
});
