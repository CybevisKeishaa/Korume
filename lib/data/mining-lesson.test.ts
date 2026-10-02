import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { assertPlainSerializableDto } from "@/test/dto";
import { createClient } from "@/lib/supabase/server";
import { listMyMiningCardsForVideo } from "./mining";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const VIDEO_ID = "c0000000-0000-0000-0000-000000000001";

beforeEach(() => vi.clearAllMocks());

describe("listMyMiningCardsForVideo", () => {
  it("refuses an anonymous reader", async () => {
    vi.mocked(createClient).mockReturnValue(createMockSupabase({ user: null, tables: {} }) as ReturnType<typeof createClient>);
    await expect(listMyMiningCardsForVideo(VIDEO_ID)).resolves.toEqual({ ok: false, status: 401 });
  });

  it("pages every card of the lesson in lesson order, as plain DTOs", async () => {
    const rows = Array.from({ length: 1_100 }, (_, i) => ({
      id: `card-${String(i).padStart(4, "0")}`, target_word: "雨", reading: "あめ", sentence_jp: "雨です", transcript_line_id: i % 2 ? `line-${i}` : null, start_time: String(i),
    }));
    const queries: QueryCall[][] = [];
    vi.mocked(createClient).mockReturnValue(createMockSupabase({
      user: { id: "u-1" },
      enforcePostgrestCap: true,
      tables: { sentence_mining_cards: (calls) => { queries.push(calls); return { data: rows, error: null }; } },
    }) as ReturnType<typeof createClient>);
    const result = await listMyMiningCardsForVideo(VIDEO_ID);
    if (!result.ok) throw new Error("expected cards");
    expect(result.data).toHaveLength(1_100);
    expect(result.data[1]).toEqual({ id: "card-0001", targetWord: "雨", reading: "あめ", sentenceJp: "雨です", lineId: "line-1", startTime: 1 });
    assertPlainSerializableDto(result.data);
    expect(queries).toHaveLength(2);
    expect(queries[0]).toContainEqual({ op: "eq", column: "user_id", value: "u-1" });
    expect(queries[0]).toContainEqual({ op: "eq", column: "video_id", value: VIDEO_ID });
    expect((queries[0] ?? []).filter((call) => call.op === "order")).toEqual([
      { op: "order", column: "start_time", ascending: true, nullsFirst: false },
      { op: "order", column: "id", ascending: true },
    ]);
  });
});
