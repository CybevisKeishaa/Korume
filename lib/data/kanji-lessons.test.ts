import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { getKanjiExamples, getKanjiLessons } from "./kanji-lessons";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const rpc = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createClient).mockReturnValue(
    createMockSupabase({ user: { id: "u1" }, tables: {}, rpcs: { kanji_lesson_lines: rpc, kanji_lesson_counts: rpc } }) as unknown as ReturnType<typeof createClient>,
  );
});

describe("getKanjiExamples", () => {
  it("maps rows, pages by 3 from the offset, and nulls a missing translation", async () => {
    rpc.mockReturnValue({
      data: [
        { line_id: "l1", video_id: "v1", lesson_title: "Lesson", text_jp: "緑の森", translation: "green forest", start_time: 1 },
        { line_id: "l2", video_id: "v1", lesson_title: "Lesson", text_jp: "緑茶", translation: null, start_time: 2 },
      ],
      error: null,
    });
    const examples = await getKanjiExamples("緑", 6);
    expect(rpc).toHaveBeenCalledWith({ p_literal: "緑", p_limit: 3, p_offset: 6 });
    expect(examples).toEqual([
      { lineId: "l1", videoId: "v1", lessonTitle: "Lesson", textJp: "緑の森", translation: "green forest" },
      { lineId: "l2", videoId: "v1", lessonTitle: "Lesson", textJp: "緑茶", translation: null },
    ]);
  });

  it("throws on a database error", async () => {
    rpc.mockReturnValue({ data: null, error: new Error("boom") });
    await expect(getKanjiExamples("緑", 0)).rejects.toThrow("boom");
  });
});

describe("getKanjiLessons", () => {
  it("asks for the top 4 and maps title and count", async () => {
    rpc.mockReturnValue({ data: [{ video_id: "v1", lesson_title: "Lesson", occurrences: 5 }], error: null });
    await expect(getKanjiLessons("緑")).resolves.toEqual([{ videoId: "v1", title: "Lesson", count: 5 }]);
    expect(rpc).toHaveBeenCalledWith({ p_literal: "緑", p_limit: 4 });
  });
});
