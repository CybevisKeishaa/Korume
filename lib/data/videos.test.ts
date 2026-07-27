import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";

/**
 * Hoisted so the `vi.mock` factory below (which vitest lifts above the imports)
 * can reach it. `capture` is created ONCE and handed back on every factory
 * evaluation, so the spy survives the `vi.resetModules()` the module-load test
 * needs — no test can leave a stale spy behind for the next one.
 */
const companion = vi.hoisted(() => ({ capture: vi.fn() }));

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
vi.mock("@/lib/data/companion", () => ({ captureFirstVideoCompleted: companion.capture }));

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
  companion.capture.mockReset();
});

describe("updateProgress", () => {
  it("returns 401 when signed out and never captures", async () => {
    // No tables registered: any `.from()` throws, proving the signed-out path
    // touches no row at all.
    mockClient({}, null);
    const result = await updateProgress(VIDEO_ID, { position: 10 }, NOW);
    expect(result).toEqual({ ok: false, status: 401 });
    expect(companion.capture).not.toHaveBeenCalled();
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
    expect(companion.capture).toHaveBeenCalledTimes(1);
    expect(companion.capture).toHaveBeenCalledWith(USER.id, VIDEO_ID);

    // A plain position ping is not a completion — no memory.
    companion.capture.mockClear();
    await updateProgress(VIDEO_ID, { position: 10 }, NOW);
    expect(companion.capture).not.toHaveBeenCalled();
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
    expect(companion.capture).not.toHaveBeenCalled();
  });

  it("swallows a failure to LOAD the companion module, not just a failure inside it", async () => {
    // The producer guards its own body, but the dynamic `import()` is itself an
    // awaited operation on the learning hot path. A bad chunk — or a future
    // top-level side effect in `companion.ts` (an env assertion, say) — would
    // reject straight into the learner's progress PATCH and 500 it. A static
    // import would have failed at boot instead; the lazy one fails per-request,
    // so the load has to sit inside the guard too. Never-throw is absolute.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    // `vi.resetModules()` alone is not enough — the hoisted `vi.mock` registration
    // survives it and the cached, non-throwing module is served straight back
    // (verified: 0 console.error calls). `vi.doMock` re-registers the module for
    // subsequent imports, which is what actually makes the `import()` reject.
    vi.resetModules();
    vi.doMock("@/lib/data/companion", () => {
      throw new Error("companion chunk failed to load");
    });
    try {
      const { createClient: freshCreateClient } = await import("@/lib/supabase/server");
      const { updateProgress: freshUpdateProgress } = await import("./videos");
      const supabase = createMockSupabase({ user: USER, tables: { user_video_progress: progressTable() } });
      vi.mocked(freshCreateClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);

      // The progress write itself still succeeded, so the learner's request must
      // still succeed — the lost memory is the only casualty.
      await expect(
        freshUpdateProgress(VIDEO_ID, { position: 10, completed: true }, NOW),
      ).resolves.toMatchObject({
        ok: true,
        data: { user_id: USER.id, video_id: VIDEO_ID, completed_at: NOW.toISOString() },
      });
      // The producer was never reached: the failure happened at LOAD time, which
      // is exactly the gap a try/catch around only the call would leave open.
      expect(companion.capture).not.toHaveBeenCalled();

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const call = errorSpy.mock.calls[0];
      expect(call?.[0]).toBe("[companion] first_video_completed hook failed:");
      // Vitest wraps a throwing mock factory in its own Error and hangs the
      // original off `cause`, so assert on the cause rather than the message.
      const cause = (call?.[1] as { cause?: unknown } | undefined)?.cause;
      expect(cause).toMatchObject({ message: "companion chunk failed to load" });
    } finally {
      vi.doUnmock("@/lib/data/companion");
      vi.resetModules();
      errorSpy.mockRestore();
    }
  });
});
