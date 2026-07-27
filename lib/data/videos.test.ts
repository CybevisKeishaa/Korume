import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { captureFirstVideoCompleted } from "@/lib/data/companion";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
// FULL mock, not the partial `importOriginal` idiom used elsewhere (e.g.
// `lib/data/pronunciation.test.ts`), and deliberately so: `lib/data/companion`
// imports `requireUser` from THIS module, so `importOriginal("@/lib/data/companion")`
// evaluates the real companion module, which pulls in a SECOND copy of
// `lib/data/videos` inside the un-mocked graph — and it is that copy the test
// would then call, bound to the real (unstubbed) capture. Verified: with the
// partial mock the spy records 0 calls while the real producer runs and
// console.errors. A full mock keeps one module identity. `videos.ts` uses
// exactly one companion export, and a future second one would fail loudly here
// rather than silently.
vi.mock("@/lib/data/companion", () => ({ captureFirstVideoCompleted: vi.fn() }));

import { updateProgress } from "./videos";

const VIDEO_ID = "c0000000-0000-0000-0000-000000000010";
const USER = { id: "u-video-1" };
const NOW = new Date("2026-07-27T10:00:00.000Z");

function mockClient(
  tables: Parameters<typeof createMockSupabase>[0]["tables"],
  user: { id: string } | null,
) {
  const supabase = createMockSupabase({ user, tables });
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
  return supabase;
}

/** `user_video_progress` resolver echoing back the upserted row. */
function progressTable(onCalls?: (calls: QueryCall[]) => void) {
  return (calls: QueryCall[]) => {
    onCalls?.(calls);
    const upsert = calls.find((c): c is Extract<QueryCall, { op: "upsert" }> => c.op === "upsert");
    return { data: (upsert?.values as Record<string, unknown> | undefined) ?? null, error: null };
  };
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(captureFirstVideoCompleted).mockReset();
});

describe("updateProgress", () => {
  it("returns 401 when signed out and never captures", async () => {
    // No tables registered: any `.from()` throws, proving the signed-out path
    // touches no row at all.
    mockClient({}, null);
    const result = await updateProgress(VIDEO_ID, { position: 10 }, NOW);
    expect(result).toEqual({ ok: false, status: 401 });
    expect(vi.mocked(captureFirstVideoCompleted)).not.toHaveBeenCalled();
  });

  it("stamps completed_at when the PATCH marks completion", async () => {
    let progressCalls: QueryCall[] = [];
    mockClient({ user_video_progress: progressTable((c) => (progressCalls = c)) }, USER);

    const result = await updateProgress(VIDEO_ID, { position: 10, completed: true }, NOW);

    expect(result.ok).toBe(true);
    const upsert = progressCalls.find((c): c is Extract<QueryCall, { op: "upsert" }> => c.op === "upsert");
    expect(upsert?.values).toEqual({
      user_id: USER.id,
      video_id: VIDEO_ID,
      last_watched_position: 10,
      completed_at: NOW.toISOString(),
    });
  });

  it("captures first_video_completed only when the PATCH marks completion", async () => {
    mockClient({ user_video_progress: progressTable() }, USER);

    await updateProgress(VIDEO_ID, { position: 10, completed: true }, NOW);
    expect(vi.mocked(captureFirstVideoCompleted)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(captureFirstVideoCompleted)).toHaveBeenCalledWith(USER.id, VIDEO_ID);

    // A plain position ping is not a completion — no memory.
    vi.mocked(captureFirstVideoCompleted).mockClear();
    await updateProgress(VIDEO_ID, { position: 10 }, NOW);
    expect(vi.mocked(captureFirstVideoCompleted)).not.toHaveBeenCalled();
  });

  it("does not capture when the progress write fails", async () => {
    // A bad videoId violates the FK → 400. No progress was recorded, so there
    // is no completion to remember.
    mockClient(
      { user_video_progress: () => ({ data: null, error: { message: "fk violation", code: "23503" } }) },
      USER,
    );

    const result = await updateProgress(VIDEO_ID, { position: 10, completed: true }, NOW);

    expect(result).toEqual({ ok: false, status: 400 });
    expect(vi.mocked(captureFirstVideoCompleted)).not.toHaveBeenCalled();
  });
});
