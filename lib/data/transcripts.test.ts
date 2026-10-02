import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { getTranscript } from "./transcripts";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const VIDEO_ID = "a0000000-0000-0000-0000-000000000001";
const TRANSCRIPT_ID = "b0000000-0000-0000-0000-000000000001";

beforeEach(() => vi.clearAllMocks());

describe("getTranscript", () => {
  it("pages lines under a start-time/id order and normalizes numeric times", async () => {
    const lines = Array.from({ length: 1_500 }, (_, index) => ({
      id: `line-${String(index).padStart(4, "0")}`,
      start_time: String(index === 1 ? 0 : index),
      end_time: index === 1 ? null : String(index + 0.5),
      text_jp: `line ${index}`,
      text_translation: null,
      furigana_json: null,
    }));
    const lineCalls: QueryCall[][] = [];
    const supabase = createMockSupabase({
      user: { id: "u1" },
      enforcePostgrestCap: true,
      tables: {
        videos: () => ({ data: { id: VIDEO_ID }, error: null }),
        transcripts: () => ({
          data: { id: TRANSCRIPT_ID, video_id: VIDEO_ID, source: "youtube_caption", language: "ja", created_at: "2026-10-01" },
          error: null,
        }),
        transcript_lines: (calls) => {
          lineCalls.push(calls);
          return { data: lines, error: null };
        },
      },
    });
    vi.mocked(createClient).mockReturnValue(supabase as ReturnType<typeof createClient>);

    const result = await getTranscript(VIDEO_ID);

    expect(result).toMatchObject({ ok: true, data: { lines: expect.any(Array) } });
    if (!result.ok || !result.data) throw new Error("expected transcript");
    expect(result.data.lines).toHaveLength(1_500);
    expect(result.data.lines.slice(0, 2)).toMatchObject([
      { id: "line-0000", start_time: 0, end_time: 0.5 },
      { id: "line-0001", start_time: 0, end_time: null },
    ]);
    expect(lineCalls).toHaveLength(2);
    expect(lineCalls[0]).toContainEqual({ op: "order", column: "start_time", ascending: true });
    expect(lineCalls[0]).toContainEqual({ op: "order", column: "id", ascending: true });
    expect(lineCalls.map((calls) => calls.find((call) => call.op === "range"))).toEqual([
      { op: "range", from: 0, to: 999 }, { op: "range", from: 1000, to: 1999 },
    ]);
  });
});
