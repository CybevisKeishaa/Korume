import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("./subscriptions", () => ({ getActivePlanTier: vi.fn() }));

import { getActivePlanTier } from "./subscriptions";
import {
  addToLibrary,
  addVisibleLessonToLibrary,
  countMonthlyCreations,
  findExistingLesson,
  hasTranscript,
  isInLibrary,
  isUnderQuota,
} from "./lesson-library";

const USER_ID = "u-lib-1";
const LESSON_ID = "l-0000-0000-0000-000000000001";
const NOW = new Date("2026-07-31T12:00:00.000Z");

function mockService(tables: Parameters<typeof createMockSupabase>[0]["tables"]) {
  const supabase = createMockSupabase({ tables });
  vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>);
  return supabase;
}

beforeEach(() => {
  vi.mocked(createServiceClient).mockReset();
  vi.mocked(createClient).mockReset();
  vi.mocked(getActivePlanTier).mockReset();
});

describe("findExistingLesson", () => {
  it("looks up by youtube_video_id via the service-role client and returns the row", async () => {
    mockService({
      videos: (calls: QueryCall[]) => {
        const eq = calls.find((c): c is Extract<QueryCall, { op: "eq" }> => c.op === "eq");
        expect(eq).toEqual({ op: "eq", column: "youtube_video_id", value: "abc123" });
        return { data: { id: LESSON_ID, youtube_video_id: "abc123" }, error: null };
      },
    });
    await expect(findExistingLesson("abc123")).resolves.toMatchObject({ id: LESSON_ID });
  });

  it("returns null when no lesson exists yet", async () => {
    mockService({ videos: () => ({ data: null, error: null }) });
    await expect(findExistingLesson("no-such-id")).resolves.toBeNull();
  });
});

describe("hasTranscript", () => {
  it("returns true when at least one transcript row exists for the lesson", async () => {
    mockService({ transcripts: () => ({ data: [{ id: "t1" }], error: null }) });
    await expect(hasTranscript(LESSON_ID)).resolves.toBe(true);
  });

  it("returns false when no transcript row exists", async () => {
    mockService({ transcripts: () => ({ data: [], error: null }) });
    await expect(hasTranscript(LESSON_ID)).resolves.toBe(false);
  });
});

describe("countMonthlyCreations / isUnderQuota", () => {
  it("counts user_lesson_library rows added this calendar month", async () => {
    mockService({
      user_lesson_library: (calls: QueryCall[]) => {
        const gte = calls.find((c): c is Extract<QueryCall, { op: "gte" }> => c.op === "gte");
        expect(gte).toEqual({ op: "gte", column: "added_at", value: "2026-07-01T00:00:00.000Z" });
        return { data: [{ lesson_id: "a" }, { lesson_id: "b" }], error: null };
      },
    });
    await expect(countMonthlyCreations(USER_ID, NOW)).resolves.toBe(2);
  });

  it("counts only the learner's private imports, never saved public catalogue lessons", async () => {
    mockService({
      user_lesson_library: (calls: QueryCall[]) => {
        expect(calls).toEqual(expect.arrayContaining([
          { op: "select", columns: "lesson_id, videos!inner(added_by_user_id, library_access)" },
          { op: "eq", column: "videos.added_by_user_id", value: USER_ID },
          { op: "eq", column: "videos.library_access", value: "PRIVATE" },
        ]));
        return { data: [{ lesson_id: "private-import" }], error: null };
      },
    });

    await expect(countMonthlyCreations(USER_ID, NOW)).resolves.toBe(1);
  });

  it("is always under quota for a plus user regardless of count", async () => {
    vi.mocked(getActivePlanTier).mockResolvedValue("plus");
    mockService({
      user_lesson_library: () => ({ data: [{ a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }, { a: 5 }], error: null }),
    });
    await expect(isUnderQuota(USER_ID, NOW)).resolves.toBe(true);
  });

  it("blocks a free user at 3 creations this month", async () => {
    vi.mocked(getActivePlanTier).mockResolvedValue("free");
    mockService({
      user_lesson_library: () => ({ data: [{ a: 1 }, { a: 2 }, { a: 3 }], error: null }),
    });
    await expect(isUnderQuota(USER_ID, NOW)).resolves.toBe(false);
  });

  it("allows a free user under 3 creations this month", async () => {
    vi.mocked(getActivePlanTier).mockResolvedValue("free");
    mockService({
      user_lesson_library: () => ({ data: [{ a: 1 }], error: null }),
    });
    await expect(isUnderQuota(USER_ID, NOW)).resolves.toBe(true);
  });
});

describe("isInLibrary / addToLibrary", () => {
  it("isInLibrary returns true when a row already exists", async () => {
    mockService({ user_lesson_library: () => ({ data: { user_id: USER_ID, lesson_id: LESSON_ID }, error: null }) });
    await expect(isInLibrary(USER_ID, LESSON_ID)).resolves.toBe(true);
  });

  it("addToLibrary upserts on (user_id, lesson_id) so a re-add is a no-op, not a duplicate", async () => {
    let upsertCalls: QueryCall[] = [];
    mockService({
      user_lesson_library: (calls: QueryCall[]) => {
        upsertCalls = calls;
        return { data: { user_id: USER_ID, lesson_id: LESSON_ID }, error: null };
      },
    });
    await addToLibrary(USER_ID, LESSON_ID);
    const upsert = upsertCalls.find((c): c is Extract<QueryCall, { op: "upsert" }> => c.op === "upsert");
    expect(upsert?.values).toEqual({ user_id: USER_ID, lesson_id: LESSON_ID });
    expect(upsert?.options).toEqual({ onConflict: "user_id,lesson_id", ignoreDuplicates: true });
  });
});

describe("addVisibleLessonToLibrary", () => {
  it("stops before the service-role writer when there is no authenticated learner", async () => {
    const requestClient = createMockSupabase({ user: null, tables: {} });
    vi.mocked(createClient).mockReturnValue(requestClient as unknown as ReturnType<typeof createClient>);

    await expect(addVisibleLessonToLibrary(LESSON_ID)).resolves.toEqual({ ok: false, status: 401 });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("does not allow the service-role writer to turn an RLS-hidden lesson into a library item", async () => {
    const requestClient = createMockSupabase({
      user: { id: USER_ID },
      tables: { videos: () => ({ data: null, error: null }) },
    });
    vi.mocked(createClient).mockReturnValue(requestClient as unknown as ReturnType<typeof createClient>);

    await expect(addVisibleLessonToLibrary(LESSON_ID)).resolves.toEqual({ ok: false, status: 404 });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("adds only a lesson visible through the learner request client", async () => {
    const requestClient = createMockSupabase({
      user: { id: USER_ID },
      tables: {
        videos: (calls) => {
          expect(calls).toEqual(expect.arrayContaining([
            { op: "eq", column: "id", value: LESSON_ID },
            { op: "maybeSingle" },
          ]));
          return {
            data: {
              id: LESSON_ID,
              youtube_video_id: "public-lesson",
              title: "Visible catalogue lesson",
              duration_seconds: null,
              thumbnail_url: null,
              jlpt_level_estimate: "N4",
              added_by_user_id: null,
              library_access: "FREE",
              promotion_starred: false,
              created_at: "2026-09-09T00:00:00.000Z",
            },
            error: null,
          };
        },
      },
    });
    const libraryQueries: QueryCall[][] = [];
    const serviceClient = createMockSupabase({
      tables: {
        user_lesson_library: (calls) => {
          libraryQueries.push([...calls]);
          return { data: null, error: null };
        },
      },
    });
    vi.mocked(createClient).mockReturnValue(requestClient as unknown as ReturnType<typeof createClient>);
    vi.mocked(createServiceClient).mockReturnValue(serviceClient as unknown as ReturnType<typeof createServiceClient>);

    await expect(addVisibleLessonToLibrary(LESSON_ID)).resolves.toEqual({ ok: true, alreadyAdded: false });
    expect(libraryQueries).toContainEqual(expect.arrayContaining([
      {
        op: "upsert",
        values: { user_id: USER_ID, lesson_id: LESSON_ID },
        options: { onConflict: "user_id,lesson_id", ignoreDuplicates: true },
      },
    ]));
  });

  it("reports an existing visible membership as an idempotent success without another upsert", async () => {
    const requestClient = createMockSupabase({
      user: { id: USER_ID },
      tables: {
        videos: () => ({
          data: { id: LESSON_ID, youtube_video_id: "public-lesson", title: "Visible catalogue lesson", duration_seconds: null, thumbnail_url: null, jlpt_level_estimate: "N4", added_by_user_id: null, library_access: "FREE", promotion_starred: false, created_at: "2026-09-09T00:00:00.000Z" },
          error: null,
        }),
      },
    });
    const libraryQueries: QueryCall[][] = [];
    const serviceClient = createMockSupabase({
      tables: {
        user_lesson_library: (calls) => {
          libraryQueries.push([...calls]);
          return { data: { user_id: USER_ID, lesson_id: LESSON_ID }, error: null };
        },
      },
    });
    vi.mocked(createClient).mockReturnValue(requestClient as unknown as ReturnType<typeof createClient>);
    vi.mocked(createServiceClient).mockReturnValue(serviceClient as unknown as ReturnType<typeof createServiceClient>);

    await expect(addVisibleLessonToLibrary(LESSON_ID)).resolves.toEqual({ ok: true, alreadyAdded: true });
    expect(libraryQueries).toHaveLength(1);
    expect(libraryQueries[0]).toEqual(expect.arrayContaining([
      { op: "select", columns: "user_id, lesson_id" },
      { op: "eq", column: "user_id", value: USER_ID },
      { op: "eq", column: "lesson_id", value: LESSON_ID },
      { op: "maybeSingle" },
    ]));
    expect(libraryQueries[0]).not.toEqual(expect.arrayContaining([{ op: "upsert", values: expect.anything() }]));
  });
});
