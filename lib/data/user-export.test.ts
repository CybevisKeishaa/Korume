import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type TableResolver } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { parseCsv } from "@/lib/csv/parse";
import { USER_EXPORT_TABLES } from "@/lib/user-export/tables";
import { EXPORT_PAGE_SIZE, exportMyData, myLearningHistoryCsv } from "./user-export";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

function page(rows: unknown[], calls: { op: string; from?: number; to?: number }[]): unknown[] {
  const range = calls.find((call) => call.op === "range");
  return rows.slice(range?.from ?? 0, (range?.to ?? EXPORT_PAGE_SIZE - 1) + 1);
}

/** Answers every export table with a PostgREST-sized page, so no query is left unregistered. */
function mockAllTables(rows: Record<string, unknown[]> = {}) {
  const tables: Record<string, TableResolver> = {};
  for (const entry of USER_EXPORT_TABLES) {
    tables[entry.table] = (calls) => ({ data: page(rows[entry.table] ?? [], calls), error: null });
  }
  return tables;
}

describe("exportMyData", () => {
  it("refuses an anonymous caller", async () => {
    vi.mocked(createClient).mockReturnValue(
      createMockSupabase({ user: null, tables: {} }) as ReturnType<typeof createClient>,
    );
    expect(await exportMyData()).toEqual({ ok: false, status: 401 });
  });

  it("returns one key per exported table, including the preferences this branch added", async () => {
    vi.mocked(createClient).mockReturnValue(
      createMockSupabase({
        user: { id: "u1" },
        tables: mockAllTables({ user_preferences: [{ user_id: "u1", display_scale: "large" }] }),
      }) as ReturnType<typeof createClient>,
    );

    const result = await exportMyData(new Date("2026-09-23T10:00:00Z"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.exportedAt).toBe("2026-09-23T10:00:00.000Z");
    expect(result.data.userId).toBe("u1");
    // Every listed table is present — an export missing a table is the whole
    // failure mode this function exists to avoid.
    expect(Object.keys(result.data.tables).sort()).toEqual(
      USER_EXPORT_TABLES.map((entry) => entry.table).sort(),
    );
    expect(result.data.tables.user_preferences).toHaveLength(1);
  });

  it("rate limits after three exports in the hour", async () => {
    vi.mocked(createClient).mockReturnValue(
      createMockSupabase({ user: { id: "rl-user" }, tables: mockAllTables() }) as ReturnType<
        typeof createClient
      >,
    );
    const now = new Date("2026-09-23T10:00:00Z");

    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await exportMyData(now)).ok).toBe(true);
    }
    const fourth = await exportMyData(now);

    expect(fourth).toMatchObject({ ok: false, status: 429 });
  });

  it("propagates a query failure instead of shipping a silently partial export", async () => {
    vi.mocked(createClient).mockReturnValue(
      createMockSupabase({
        user: { id: "u-err" },
        tables: { ...mockAllTables(), user_stats: () => ({ data: null, error: { message: "boom" } }) },
      }) as ReturnType<typeof createClient>,
    );

    await expect(exportMyData()).rejects.toBeTruthy();
  });

  it("exports every row when a table exceeds one PostgREST page", async () => {
    const events = Array.from({ length: EXPORT_PAGE_SIZE + 1 }, (_, index) => ({ id: `event-${index}` }));
    vi.mocked(createClient).mockReturnValue(
      createMockSupabase({
        user: { id: "u-pages" },
        tables: mockAllTables({ xp_events: events }),
      }) as ReturnType<typeof createClient>,
    );

    const result = await exportMyData();

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.data.tables.xp_events).toHaveLength(EXPORT_PAGE_SIZE + 1);
  });

  it("chunks parent ids before exporting dependent rows", async () => {
    const playlistIds = Array.from({ length: 101 }, (_, index) => `playlist-${index}`);
    const inCalls: unknown[][] = [];
    vi.mocked(createClient).mockReturnValue(
      createMockSupabase({
        user: { id: "u-chunks" },
        tables: {
          ...mockAllTables({ user_playlists: playlistIds.map((id) => ({ id })) }),
          user_playlist_items: (calls) => {
            const parentIds = calls.find((call) => call.op === "in")?.values ?? [];
            inCalls.push(parentIds);
            return {
              data: page(
                parentIds.map((playlist_id) => ({ playlist_id, video_id: `video-${playlist_id}` })),
                calls,
              ),
              error: null,
            };
          },
        },
      }) as ReturnType<typeof createClient>,
    );

    const result = await exportMyData();

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(inCalls).not.toHaveLength(0);
    // ⚠️ Deduplicated by chunk, because each chunk is now queried TWICE: the
    // page carrying its rows, then the empty page that ends the loop. The
    // reader stops on an EMPTY page rather than a short one so that a server
    // whose row cap is below `EXPORT_PAGE_SIZE` cannot make a full page look
    // like the last one. Asserting the raw call list would pin that round-trip
    // count, which is an implementation detail; what matters is that every
    // parent id was asked for, once per chunk, in order.
    const distinctChunks = inCalls.filter(
      (ids, index) => index === 0 || JSON.stringify(ids) !== JSON.stringify(inCalls[index - 1]),
    );
    expect(distinctChunks.flat()).toEqual(playlistIds);
    expect(distinctChunks).toHaveLength(2); // 101 ids at 100 per chunk
    expect(inCalls.every((ids) => ids.length <= 100)).toBe(true);
    expect(result.data.tables.user_playlist_items).toHaveLength(playlistIds.length);
  });
});

describe("myLearningHistoryCsv", () => {
  /**
   * ⚠️ Every resolver here pages through `page()`. A resolver that returned
   * its fixture whatever `range` asked for used to be harmless — the reader
   * stopped on a SHORT page, and one row is short. It now stops only on an
   * EMPTY one, so a range-blind resolver loops for ever and kills the worker
   * with an out-of-memory crash rather than a readable failure.
   */
  const historyRows: Record<string, unknown[]> = {
    user_video_progress: [{ completed_at: "2026-09-20T08:00:00Z", videos: { title: "Lesson A" } }],
    user_kanji_progress: [
      { last_reviewed_at: "2026-09-22T08:00:00Z", srs_stage: 4, kanji: { character: "日" } },
      // No review yet: no date, so no history line.
      { last_reviewed_at: null, srs_stage: 0, kanji: { character: "月" } },
    ],
    user_vocab_progress: [],
    user_grammar_progress: [
      { last_practiced_at: "2026-09-21T08:00:00Z", mastery_score: 60, grammar_points: { title: "〜てから" } },
    ],
    user_badges: [{ earned_at: "2026-09-23T08:00:00Z", badges: { name: "First week" } }],
  };

  const historyTables: Record<string, TableResolver> = Object.fromEntries(
    Object.entries(historyRows).map(([table, rows]) => [
      table,
      ((calls) => ({ data: page(rows, calls), error: null })) as TableResolver,
    ]),
  );

  it("refuses an anonymous caller", async () => {
    vi.mocked(createClient).mockReturnValue(
      createMockSupabase({ user: null, tables: {} }) as ReturnType<typeof createClient>,
    );
    expect(await myLearningHistoryCsv()).toEqual({ ok: false, status: 401 });
  });

  it("writes one newest-first line per dated row, skipping rows never reached", async () => {
    vi.mocked(createClient).mockReturnValue(
      createMockSupabase({ user: { id: "u1" }, tables: historyTables }) as ReturnType<typeof createClient>,
    );

    const result = await myLearningHistoryCsv();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parsed = parseCsv(result.csv);
    expect(parsed.headers).toEqual(["date", "kind", "item", "detail"]);
    expect(parsed.records.map((r) => [r.fields.kind, r.fields.item, r.fields.detail])).toEqual([
      ["badge", "First week", ""],
      ["review", "日", "4"],
      ["practice", "〜てから", "60"],
      ["lesson", "Lesson A", ""],
    ]);
  });

  it("includes every history row when a source exceeds one PostgREST page", async () => {
    const videos = Array.from({ length: EXPORT_PAGE_SIZE + 1 }, (_, index) => ({
      completed_at: `2026-09-20T08:${String(index % 60).padStart(2, "0")}Z`,
      videos: { title: `Lesson ${index}` },
    }));
    vi.mocked(createClient).mockReturnValue(
      createMockSupabase({
        user: { id: "u-history-pages" },
        tables: {
          ...historyTables,
          user_video_progress: (calls) => ({ data: page(videos, calls), error: null }),
        },
      }) as ReturnType<typeof createClient>,
    );

    const result = await myLearningHistoryCsv();

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(parseCsv(result.csv).records).toHaveLength(EXPORT_PAGE_SIZE + 4);
  });
});
