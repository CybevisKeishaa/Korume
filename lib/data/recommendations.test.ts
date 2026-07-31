import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
// getKnownVocabLemmas has its own query shape and is exercised by
// getVideoDifficulty's own path — mock it here so this file only exercises
// the candidate-video scan/scoring/ordering, not vocab-mastery derivation
// (same isolation precedent as mocking recordActivity in lib/data/jlpt.test.ts).
vi.mock("@/lib/data/difficulty", () => ({ getKnownVocabLemmas: vi.fn() }));
// kuromoji tokenization is real dictionary I/O — stub it with a simple
// whitespace-split "tokenizer" that tags every word as a noun so
// contentLemmas() (which is the real, unmocked implementation) keeps it.
vi.mock("@/lib/japanese/tokenizer", () => ({
  tokenize: vi.fn(async (text: string) =>
    text.split(" ").map((w) => ({ surface: w, reading: null, base: w, pos: "名詞" })),
  ),
}));

import { getRecommendations } from "./recommendations";
import { getKnownVocabLemmas } from "@/lib/data/difficulty";

const USER = { id: "u1" };

function mockClient(tables: Parameters<typeof createMockSupabase>[0]["tables"], user: { id: string } | null = USER) {
  const supabase = createMockSupabase({ user, tables });
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
  return supabase;
}

const VIDEO_A = { id: "va", youtube_video_id: "yta", title: "A", thumbnail_url: "a.jpg", jlpt_level_estimate: "N5" };
const VIDEO_B = { id: "vb", youtube_video_id: "ytb", title: "B", thumbnail_url: null, jlpt_level_estimate: "N4" };
const VIDEO_C = { id: "vc", youtube_video_id: "ytc", title: "C", thumbnail_url: null, jlpt_level_estimate: null };

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(getKnownVocabLemmas).mockReset();
});

describe("getRecommendations", () => {
  it("returns 401 when signed out", async () => {
    mockClient({}, null);
    const result = await getRecommendations({ limit: 12 });
    expect(result).toEqual({ ok: false, status: 401 });
  });

  it("scores a video, dropping words the user doesn't know from the known count", async () => {
    vi.mocked(getKnownVocabLemmas).mockResolvedValue(new Set(["known1", "known2", "known3", "known4"]));
    mockClient({
      user_video_progress: () => ({ data: [], error: null }),
      videos: (calls: QueryCall[]) => {
        const inCall = calls.find((c): c is Extract<QueryCall, { op: "in" }> => c.op === "in" && c.column === "library_access");
        expect(inCall?.values).toEqual(["FREE", "PLUS"]);
        return { data: [VIDEO_A], error: null };
      },
      transcripts: (calls: QueryCall[]) => {
        const inCall = calls.find((c): c is Extract<QueryCall, { op: "in" }> => c.op === "in");
        expect(inCall?.values).toEqual(["va"]);
        return { data: [{ id: "t1", video_id: "va", created_at: "2026-07-01T00:00:00Z" }], error: null };
      },
      transcript_lines: () => ({
        data: [{ transcript_id: "t1", text_jp: "known1 known2 known3 known4 unknown1" }],
        error: null,
      }),
    });

    const result = await getRecommendations({ limit: 12 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([
      {
        videoId: "va",
        youtubeVideoId: "yta",
        title: "A",
        thumbnailUrl: "a.jpg",
        jlptLevelEstimate: "N5",
        knownRatio: 0.8,
        band: "ideal",
        totalWords: 5,
        knownWords: 4,
      },
    ]);
  });

  it("excludes videos the user has already completed", async () => {
    vi.mocked(getKnownVocabLemmas).mockResolvedValue(new Set());
    mockClient({
      user_video_progress: () => ({ data: [{ video_id: "va", completed_at: "2026-07-01T00:00:00Z" }], error: null }),
      videos: () => ({ data: [VIDEO_A, VIDEO_B], error: null }),
      transcripts: () => ({ data: [{ id: "t2", video_id: "vb", created_at: "2026-07-01T00:00:00Z" }], error: null }),
      transcript_lines: () => ({ data: [{ transcript_id: "t2", text_jp: "unknown1" }], error: null }),
    });

    const result = await getRecommendations({ limit: 12 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.map((v) => v.videoId)).toEqual(["vb"]);
  });

  it("drops videos with no transcript or empty transcript text (insufficient-data)", async () => {
    vi.mocked(getKnownVocabLemmas).mockResolvedValue(new Set());
    mockClient({
      user_video_progress: () => ({ data: [], error: null }),
      // VIDEO_A has no transcript row at all; VIDEO_B has a transcript with no lines.
      videos: () => ({ data: [VIDEO_A, VIDEO_B], error: null }),
      transcripts: () => ({ data: [{ id: "t2", video_id: "vb", created_at: "2026-07-01T00:00:00Z" }], error: null }),
      transcript_lines: () => ({ data: [], error: null }),
    });

    const result = await getRecommendations({ limit: 12 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it("orders ideal (by knownRatio desc) before too-easy before too-hard, and applies the limit", async () => {
    vi.mocked(getKnownVocabLemmas).mockResolvedValue(new Set(["k"]));
    mockClient({
      user_video_progress: () => ({ data: [], error: null }),
      videos: () => ({ data: [VIDEO_A, VIDEO_B, VIDEO_C], error: null }),
      transcripts: () => ({
        data: [
          { id: "ta", video_id: "va", created_at: "2026-07-01T00:00:00Z" }, // too-hard
          { id: "tb", video_id: "vb", created_at: "2026-07-01T00:00:00Z" }, // too-easy
          { id: "tc", video_id: "vc", created_at: "2026-07-01T00:00:00Z" }, // ideal
        ],
        error: null,
      }),
      transcript_lines: () => ({
        data: [
          // too-hard: 0/1 known
          { transcript_id: "ta", text_jp: "unk" },
          // too-easy: 1/1 known
          { transcript_id: "tb", text_jp: "k" },
          // ideal: 9/10 known (0.9, inside [0.8, 0.95])
          { transcript_id: "tc", text_jp: "k k k k k k k k k unk" },
        ],
        error: null,
      }),
    });

    const result = await getRecommendations({ limit: 2 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.map((v) => v.videoId)).toEqual(["vc", "vb"]);
    expect(result.data.map((v) => v.band)).toEqual(["ideal", "too-easy"]);
  });

  it("scans videos at the documented cap and returns an empty list when there are no candidates", async () => {
    mockClient({
      user_video_progress: () => ({ data: [], error: null }),
      videos: (calls: QueryCall[]) => {
        const limitCall = calls.find((c): c is Extract<QueryCall, { op: "limit" }> => c.op === "limit");
        expect(limitCall?.count).toBe(100);
        return { data: [], error: null };
      },
    });

    const result = await getRecommendations({ limit: 12 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });
});
