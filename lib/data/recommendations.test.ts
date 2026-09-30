import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
// getKnownVocabLemmas has its own query shape and is exercised by
// getVideoDifficulty's own path — mock it here so this file only exercises
// the candidate-video scan/scoring/ordering, not vocab-mastery derivation
// (same isolation precedent as mocking recordActivity in lib/data/jlpt.test.ts).
vi.mock("@/lib/data/difficulty", () => ({ getKnownVocabLemmas: vi.fn() }));
vi.mock("@/lib/data/preferences", () => ({ readPreferences: vi.fn() }));
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
import { readPreferences } from "@/lib/data/preferences";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";

const USER = { id: "u1" };

function mockClient(tables: Parameters<typeof createMockSupabase>[0]["tables"], user: { id: string } | null = USER) {
  const supabase = createMockSupabase({
    user,
    tables,
    rpcs: {
      latest_transcript_ids: async ({ p_video_ids }) => {
        const result = tables.transcripts ? await tables.transcripts([{ op: "in", column: "video_id", values: p_video_ids as string[] }]) : { data: [], error: null };
        const rows = (result.data as { id: string; video_id: string; created_at: string }[] | null) ?? [];
        return {
          data: (p_video_ids as string[]).flatMap((video_id) => {
            const latest = rows.filter((row) => row.video_id === video_id).sort((left, right) => right.created_at.localeCompare(left.created_at) || right.id.localeCompare(left.id))[0];
            return latest ? [{ video_id, transcript_id: latest.id }] : [];
          }),
          error: result.error,
        };
      },
    },
  });
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
  return supabase;
}

const VIDEO_A = { id: "va", youtube_video_id: "yta", title: "A", thumbnail_url: "a.jpg", jlpt_level_estimate: "N5", created_at: "2026-07-03T00:00:00Z" };
const VIDEO_B = { id: "vb", youtube_video_id: "ytb", title: "B", thumbnail_url: null, jlpt_level_estimate: "N4", created_at: "2026-07-02T00:00:00Z" };
const VIDEO_C = { id: "vc", youtube_video_id: "ytc", title: "C", thumbnail_url: null, jlpt_level_estimate: null, created_at: "2026-07-01T00:00:00Z" };

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(getKnownVocabLemmas).mockReset();
  vi.mocked(readPreferences).mockResolvedValue({ ...DEFAULT_PREFERENCES });
});

describe("getRecommendations", () => {
  it("uses the easy comprehension band", async () => {
    vi.mocked(readPreferences).mockResolvedValue({ ...DEFAULT_PREFERENCES, difficulty: "easy" as const });
    vi.mocked(getKnownVocabLemmas).mockResolvedValue(new Set(["known"]));
    mockClient({
      user_video_progress: () => ({ data: [], error: null }),
      videos: () => ({ data: [VIDEO_A], error: null }),
      transcripts: () => ({ data: [{ id: "t1", video_id: "va", created_at: "2026-07-01T00:00:00Z" }], error: null }),
      transcript_lines: () => ({ data: [{ transcript_id: "t1", text_jp: `${Array(96).fill("known").join(" ")} unknown unknown unknown unknown` }], error: null }),
    });

    const result = await getRecommendations({ limit: 12 });

    expect(result).toMatchObject({ ok: true, data: [{ videoId: "va", band: "ideal", knownRatio: 0.96 }] });
  });

  it("scans only the supplied candidates; without them, the newest SCAN_LIMIT of the catalogue", async () => {
    vi.mocked(getKnownVocabLemmas).mockResolvedValue(new Set());
    const videoQueries: QueryCall[][] = [];
    mockClient({
      user_video_progress: () => ({ data: [], error: null }),
      videos: (calls) => { videoQueries.push([...calls]); return { data: [], error: null }; },
    });

    await getRecommendations({ limit: 2, candidateIds: ["va", "vb"] });
    await getRecommendations({ limit: 12 });

    // The mock ignores filters, so the recorded calls are the proof.
    expect(videoQueries[0]).toContainEqual({ op: "in", column: "id", values: ["va", "vb"] });
    expect(videoQueries[1]).not.toContainEqual(expect.objectContaining({ op: "in", column: "id" }));
    expect(videoQueries[1]).toContainEqual({ op: "limit", count: 100 });
  });

  it("sends a long candidate list in URL-safe chunks and scans the newest 100 of it, whatever its order", async () => {
    vi.mocked(getKnownVocabLemmas).mockResolvedValue(new Set());
    const ids = Array.from({ length: 1_001 }, (_, index) => `lesson-${String(index).padStart(4, "0")}`);
    const idChunks: string[][] = [];
    const scanned: string[][] = [];
    const client = mockClient({
      user_video_progress: () => ({ data: [], error: null }),
      videos: (calls) => {
        const chunk = (calls.find((call) => call.op === "in" && call.column === "id") as { values: string[] }).values;
        idChunks.push(chunk);
        // lesson-1000 is the newest; the caller's order is oldest first.
        return { data: chunk.map((id) => ({ ...VIDEO_A, id, created_at: `2026-01-01T00:00:00.${id.slice(-4)}Z` })), error: null };
      },
    });
    vi.spyOn(client, "rpc").mockImplementation(((name: string, args: Record<string, unknown>) => {
      if (name === "latest_transcript_ids") scanned.push(args.p_video_ids as string[]);
      return Promise.resolve({ data: [], error: null });
    }) as never);

    await getRecommendations({ limit: 4, candidateIds: ids });

    expect(idChunks.every((chunk) => chunk.length <= 100)).toBe(true);
    expect(idChunks.flat()).toEqual(ids);
    expect(scanned.flat()).toHaveLength(100);
    expect(new Set(scanned.flat())).toEqual(new Set(ids.slice(-100)));
  });

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
        reason: {
          kind: "known-word-fit",
          knownRatio: 0.8,
          totalWords: 5,
          knownWords: 4,
        },
      },
    ]);
  });

  it("uses only a measured known-word fit as a reason, and leaves it absent without supporting learner data", async () => {
    vi.mocked(getKnownVocabLemmas).mockResolvedValue(new Set());
    mockClient({
      user_video_progress: () => ({ data: [], error: null }),
      videos: () => ({ data: [VIDEO_A], error: null }),
      transcripts: () => ({ data: [{ id: "t1", video_id: "va", created_at: "2026-07-01T00:00:00Z" }], error: null }),
      transcript_lines: () => ({ data: [{ transcript_id: "t1", text_jp: "unknown" }], error: null }),
    });

    const result = await getRecommendations({ limit: 12 });

    expect(result).toMatchObject({
      ok: true,
      data: [
        {
          videoId: "va",
          reason: null,
        },
      ],
    });
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

  it("pages all transcript lines and progress rows before scoring", async () => {
    vi.mocked(getKnownVocabLemmas).mockResolvedValue(new Set(["known"]));
    const progressRanges: unknown[] = [];
    const lineRanges: unknown[] = [];
    mockClient({
      user_video_progress: (calls) => {
        progressRanges.push(calls.find((call) => call.op === "range"));
        return { data: progressRanges.length === 1
          ? Array.from({ length: 1_000 }, (_, index) => ({ video_id: `done-${index}`, completed_at: null }))
          : Array.from({ length: 200 }, (_, index) => ({ video_id: `done-${index + 1_000}`, completed_at: null })), error: null };
      },
      videos: () => ({ data: [VIDEO_A], error: null }),
      transcripts: () => ({ data: [{ id: "t1", video_id: "va", created_at: "2026-07-01T00:00:00Z" }], error: null }),
      transcript_lines: (calls) => {
        lineRanges.push(calls.find((call) => call.op === "range"));
        return { data: lineRanges.length === 1
          ? Array.from({ length: 1_000 }, () => ({ transcript_id: "t1", text_jp: "known" }))
          : Array.from({ length: 200 }, () => ({ transcript_id: "t1", text_jp: "unknown" })), error: null };
      },
    });

    await expect(getRecommendations({ limit: 1 })).resolves.toMatchObject({
      ok: true,
      data: [{ totalWords: 1_200, knownWords: 1_000, knownRatio: 1_000 / 1_200 }],
    });
    expect(progressRanges).toEqual([
      { op: "range", from: 0, to: 999 },
      { op: "range", from: 1_000, to: 1_999 },
    ]);
    expect(lineRanges).toEqual([
      { op: "range", from: 0, to: 999 },
      { op: "range", from: 1_000, to: 1_999 },
    ]);
  });
});
