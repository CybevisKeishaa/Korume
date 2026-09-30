import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";

// Owner ruling 15: load the recommendation context once per request, score
// each candidate once, share it across consumers. Next's RSC build gives
// React a per-request `cache`; this file stands one in (a single-request
// memo), since the plain React build vitest runs has none.
const requestMemo = vi.hoisted(() => ({ reset: () => undefined as void }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T): T => {
      let memo: ReturnType<T> | undefined;
      requestMemo.reset = () => { memo = undefined; };
      return ((...args: Parameters<T>) => (memo ??= fn(...args) as ReturnType<T>)) as T;
    },
  };
});
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/difficulty", () => ({ getKnownVocabLemmas: vi.fn() }));
vi.mock("@/lib/data/preferences", () => ({ readPreferences: vi.fn() }));
vi.mock("@/lib/japanese/tokenizer", () => ({
  tokenize: vi.fn(async (text: string) => text.split(" ").map((w) => ({ surface: w, reading: null, base: w, pos: "名詞" }))),
}));

import { getRecommendations, knowsAnyVocabulary } from "./recommendations";
import { getKnownVocabLemmas } from "@/lib/data/difficulty";
import { readPreferences } from "@/lib/data/preferences";
import { tokenize } from "@/lib/japanese/tokenizer";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";

const video = (id: string) => ({ id, youtube_video_id: `yt-${id}`, title: id, thumbnail_url: null, jlpt_level_estimate: null });

function mockCatalogue(transcriptReads: QueryCall[][]) {
  const supabase = createMockSupabase({
    user: { id: "u1" },
    tables: {
      user_video_progress: () => ({ data: [], error: null }),
      videos: (calls) => {
        const ids = (calls.find((call) => call.op === "in" && call.column === "id") as { values: string[] } | undefined)?.values;
        return { data: (ids ?? ["a", "b", "c"]).map(video), error: null };
      },
      transcripts: (calls) => {
        transcriptReads.push([...calls]);
        const ids = (calls.find((call) => call.op === "in") as { values: string[] }).values;
        return { data: ids.map((id) => ({ id: `t-${id}`, video_id: id, created_at: "2026-07-01T00:00:00Z" })), error: null };
      },
      transcript_lines: (calls) => {
        const ids = (calls.find((call) => call.op === "in") as { values: string[] }).values;
        return { data: ids.map((id) => ({ id: `l-${id}`, transcript_id: id, text_jp: "known known known known known known known known known unknown" })), error: null };
      },
    },
  });
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
}

beforeEach(() => {
  requestMemo.reset();
  vi.mocked(createClient).mockReset();
  vi.mocked(getKnownVocabLemmas).mockReset().mockResolvedValue(new Set(["known"]));
  vi.mocked(readPreferences).mockReset().mockResolvedValue({ ...DEFAULT_PREFERENCES });
  vi.mocked(tokenize).mockClear();
});

describe("one recommendation context per request", () => {
  it("reads the learner once and scores a lesson two consumers rank only once, even when they run together", async () => {
    const transcriptReads: QueryCall[][] = [];
    mockCatalogue(transcriptReads);

    // A goal pass and the discovery sort at once, then the catalogue pass.
    await Promise.all([
      getRecommendations({ limit: 24, candidateIds: ["a", "b"] }),
      getRecommendations({ limit: 24, candidateIds: ["b"] }),
    ]);
    const catalogue = await getRecommendations({ limit: 24 });

    expect(getKnownVocabLemmas).toHaveBeenCalledTimes(1);
    expect(readPreferences).toHaveBeenCalledTimes(1);
    // "a" and "b" once, then only the catalogue's unseen "c".
    expect(transcriptReads.map((calls) => (calls.find((call) => call.op === "in") as { values: string[] }).values)).toEqual([["a", "b"], ["c"]]);
    expect(tokenize).toHaveBeenCalledTimes(3);
    expect(catalogue).toMatchObject({ ok: true, data: [{ videoId: "a" }, { videoId: "b" }, { videoId: "c" }] });
  });

  it("forgets a failed scoring batch, so the next consumer retries it instead of inheriting the error", async () => {
    const transcriptReads: QueryCall[][] = [];
    mockCatalogue(transcriptReads);
    const supabase = createClient() as unknown as { from: (table: string) => unknown };
    const from = supabase.from.bind(supabase);
    let failed = false;
    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "transcripts" && !failed) { failed = true; throw new Error("transient"); }
      return from(table);
    });

    const first = await getRecommendations({ limit: 24, candidateIds: ["a"] }).catch((error: unknown) => error);
    expect(first).not.toMatchObject({ ok: true });
    await expect(getRecommendations({ limit: 24, candidateIds: ["a"] })).resolves.toMatchObject({ ok: true, data: [{ videoId: "a" }] });
  });

  it("knows up front when no pick can carry a reason: the learner knows no word", async () => {
    mockCatalogue([]);
    vi.mocked(getKnownVocabLemmas).mockResolvedValue(new Set());
    await expect(knowsAnyVocabulary()).resolves.toBe(false);

    requestMemo.reset();
    vi.mocked(getKnownVocabLemmas).mockResolvedValue(new Set(["known"]));
    await expect(knowsAnyVocabulary()).resolves.toBe(true);
  });
});
