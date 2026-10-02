import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, eqValue } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { isLessonBookmarked, setLessonBookmark } from "./lesson-bookmarks";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => ({ ok: true })) }));

const USER = { id: "u-bookmarks" };
const VIDEO_ID = "a0000000-0000-0000-0000-000000000001";

function useTables(tables: Parameters<typeof createMockSupabase>[0]["tables"], user: { id: string } | null = USER) {
  vi.mocked(createClient).mockReturnValue(createMockSupabase({ user, tables }) as ReturnType<typeof createClient>);
}

beforeEach(() => { vi.clearAllMocks(); vi.mocked(rateLimit).mockReturnValue({ ok: true, retryAfter: 0 }); });

describe("lesson bookmarks", () => {
  it("reads false when signed out or missing and true for an existing row", async () => {
    useTables({}, null);
    await expect(isLessonBookmarked(VIDEO_ID)).resolves.toBe(false);
    useTables({ user_lesson_bookmarks: () => ({ data: null, error: null }) });
    await expect(isLessonBookmarked(VIDEO_ID)).resolves.toBe(false);
    useTables({ user_lesson_bookmarks: (calls) => {
      expect(eqValue(calls, "user_id")).toBe(USER.id);
      expect(eqValue(calls, "video_id")).toBe(VIDEO_ID);
      return { data: { video_id: VIDEO_ID }, error: null };
    } });
    await expect(isLessonBookmarked(VIDEO_ID)).resolves.toBe(true);
  });

  it.each([
    [null, { ok: true }],
    [{ code: "23505", message: "duplicate" }, { ok: true }],
    [{ code: "42501", message: "refused" }, { ok: false, status: 404 }],
    [{ code: "23503", message: "missing" }, { ok: false, status: 404 }],
  ])("maps a bookmark insert %#", async (error, expected) => {
    useTables({ user_lesson_bookmarks: (calls) => {
      expect(calls).toContainEqual({ op: "insert", values: { user_id: USER.id, video_id: VIDEO_ID } });
      return { data: null, error };
    } });
    await expect(setLessonBookmark(VIDEO_ID, true)).resolves.toEqual(expected);
  });

  it("throws any other insert or delete error instead of reporting success", async () => {
    useTables({ user_lesson_bookmarks: () => ({ data: null, error: { code: "XX000", message: "boom" } }) });
    await expect(setLessonBookmark(VIDEO_ID, true)).rejects.toMatchObject({ code: "XX000" });
    await expect(setLessonBookmark(VIDEO_ID, false)).rejects.toMatchObject({ code: "XX000" });
  });

  it("limits bookmark writes and deletes only the caller's row", async () => {
    vi.mocked(rateLimit).mockReturnValueOnce({ ok: false, retryAfter: 5_000 });
    useTables({ user_lesson_bookmarks: () => { throw new Error("must not write"); } });
    await expect(setLessonBookmark(VIDEO_ID, true)).resolves.toEqual({ ok: false, status: 429, retryAfter: 5_000 });
    expect(rateLimit).toHaveBeenCalledWith("lesson-bookmark:u-bookmarks", { limit: 30, windowMs: 60_000 });

    useTables({ user_lesson_bookmarks: (calls) => {
      expect(calls).toContainEqual({ op: "delete" });
      expect(eqValue(calls, "user_id")).toBe(USER.id);
      expect(eqValue(calls, "video_id")).toBe(VIDEO_ID);
      return { data: null, error: null };
    } });
    await expect(setLessonBookmark(VIDEO_ID, false)).resolves.toEqual({ ok: true });
  });
});
