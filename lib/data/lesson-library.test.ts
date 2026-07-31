import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createServiceClient } from "@/lib/supabase/service";

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("./subscriptions", () => ({ getActivePlanTier: vi.fn() }));

import { getActivePlanTier } from "./subscriptions";
import {
  addToLibrary,
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
