import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";

// Spec M1: ensureDailyMission runs after auth + validation and BEFORE the first write of every mutation that can
// advance a mission; claimActiveMission runs after the outcome is recorded. One shared timeline per test.
const order = vi.hoisted(() => [] as string[]);
const mission = vi.hoisted(() => ({
  ensureDailyMission: vi.fn(async () => { order.push("ensure"); return null; }),
  claimActiveMission: vi.fn(async () => { order.push("claim"); }),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/missions", () => mission);
vi.mock("@/lib/data/gamification", () => ({ recordActivity: vi.fn(async () => { order.push("record"); return { ok: true }; }) }));
vi.mock("@/lib/data/preferences", () => ({ readPreferences: vi.fn(async () => ({ ...DEFAULT_PREFERENCES })) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => ({ ok: true })) }));
vi.mock("@/lib/data/companion", () => ({ captureFirstVideoCompleted: vi.fn(() => Promise.resolve()) }));

import { submitReview } from "./srs";
import { reviewMiningCard } from "./mining";
import { createSession } from "./shadowing";
import { submitAttempt } from "./dictation";
import { updateProgress } from "./videos";

const USER = { id: "11111111-1111-4111-8111-111111111111" };
const VIDEO = "22222222-2222-4222-8222-222222222222";
const LINE = "33333333-3333-4333-8333-333333333333";
const WRITES = new Set(["insert", "update", "upsert", "delete"]);

/** A table resolver that logs `write:<table>` when the chain writes, and answers with `data`. */
function table(name: string, data: unknown = null) {
  return (calls: QueryCall[]) => {
    if (calls.some((call) => WRITES.has(call.op))) order.push(`write:${name}`);
    return { data, error: null };
  };
}

function install(user: typeof USER | null, tables: Record<string, (calls: QueryCall[]) => { data: unknown; error: null }>) {
  const client = createMockSupabase({ user, tables }) as unknown as Record<string, unknown>;
  client.storage = {
    from: () => ({
      upload: async () => { order.push("write:storage"); return { error: null }; },
      remove: async () => ({ error: null }),
      createSignedUrl: async () => ({ data: { signedUrl: "https://signed" }, error: null }),
    }),
  };
  vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>);
}

const audio = () => new Blob(["x"], { type: "audio/webm" });

beforeEach(() => {
  order.length = 0;
  vi.clearAllMocks();
});

afterEach(() => vi.restoreAllMocks());

describe("pre-write mission ensure (spec M1)", () => {
  it("srs review: ensure before the progress upsert, claim after the outcome", async () => {
    install(USER, {
      kanji: table("kanji", { id: VIDEO }),
      user_kanji_progress: table("user_kanji_progress", { srs_stage: 0, interval_days: 0, ease_factor: 2.5 }),
    });
    await expect(submitReview({ itemType: "kanji", itemId: VIDEO, quality: 4 })).resolves.toMatchObject({ ok: true });
    expect(order).toEqual(["ensure", "write:user_kanji_progress", "record", "claim"]);
  });

  it("srs review still writes when mission setup unexpectedly rejects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mission.ensureDailyMission.mockRejectedValueOnce(new Error("mission unavailable"));
    install(USER, {
      kanji: table("kanji", { id: VIDEO }),
      user_kanji_progress: table("user_kanji_progress", { srs_stage: 0, interval_days: 0, ease_factor: 2.5 }),
    });

    await expect(submitReview({ itemType: "kanji", itemId: VIDEO, quality: 4 })).resolves.toMatchObject({ ok: true });

    expect(order).toEqual(["write:user_kanji_progress", "record", "claim"]);
  });

  it("mining review: ensure after the card check, before the update", async () => {
    install(USER, { sentence_mining_cards: table("sentence_mining_cards", { srs_stage: 0, interval_days: 0, ease_factor: 2.5, mastered_at: null }) });
    await expect(reviewMiningCard({ cardId: VIDEO, quality: 4 })).resolves.toMatchObject({ ok: true });
    expect(order).toEqual(["ensure", "write:sentence_mining_cards", "record", "claim"]);
  });

  it("shadowing: ensure after audio validation, before the upload", async () => {
    install(USER, {
      transcript_lines: table("transcript_lines", { id: LINE }),
      shadowing_sessions: table("shadowing_sessions", { id: "s1", created_at: "2026-10-08T00:00:00Z" }),
    });
    await expect(createSession({ videoId: VIDEO, lineId: LINE, audio: audio() })).resolves.toMatchObject({ ok: true });
    expect(order).toEqual(["ensure", "write:storage", "write:shadowing_sessions", "record", "claim"]);
  });

  it("dictation: ensure after the line lookup, before the insert", async () => {
    install(USER, {
      transcript_lines: table("transcript_lines", { text_jp: "こんにちは" }),
      dictation_attempts: table("dictation_attempts"),
    });
    await expect(submitAttempt({ videoId: VIDEO, lineId: LINE, userInput: "こんにちは" })).resolves.toMatchObject({ ok: true });
    expect(order).toEqual(["ensure", "write:dictation_attempts", "record", "claim"]);
  });

  it("lesson completion: ensure before the upsert, claim after it; a position ping touches neither", async () => {
    const row = { user_id: USER.id, video_id: VIDEO, last_watched_position: 10, completed_at: null, last_watched_at: null };
    install(USER, { videos: table("videos", { id: VIDEO }), user_video_progress: table("user_video_progress", row) });
    await expect(updateProgress(VIDEO, { position: 10, completed: true })).resolves.toMatchObject({ ok: true });
    expect(order).toEqual(["ensure", "write:user_video_progress", "claim"]);

    order.length = 0;
    await expect(updateProgress(VIDEO, { position: 20 })).resolves.toMatchObject({ ok: true });
    expect(order).toEqual(["write:user_video_progress"]);
  });

  it("invalid requests never ensure: signed out, unknown card, bad audio, missing line", async () => {
    install(null, {});
    await submitReview({ itemType: "kanji", itemId: VIDEO, quality: 4 });
    await reviewMiningCard({ cardId: VIDEO, quality: 4 });
    await createSession({ videoId: VIDEO, lineId: LINE, audio: audio() });
    await submitAttempt({ videoId: VIDEO, lineId: LINE, userInput: "x" });
    await updateProgress(VIDEO, { position: 1, completed: true });

    install(USER, { sentence_mining_cards: table("sentence_mining_cards", null), transcript_lines: table("transcript_lines", null) });
    await expect(reviewMiningCard({ cardId: VIDEO, quality: 4 })).resolves.toMatchObject({ ok: false, status: 400 });
    await expect(createSession({ videoId: VIDEO, lineId: LINE, audio: new Blob(["x"], { type: "text/plain" }) }))
      .resolves.toMatchObject({ ok: false, status: 422 });
    await expect(submitAttempt({ videoId: VIDEO, lineId: LINE, userInput: "x" })).resolves.toMatchObject({ ok: false, status: 400 });
    expect(order).toEqual([]);
  });

  it("unknown references never create a mission or write", async () => {
    install(USER, {
      kanji: table("kanji"),
      videos: table("videos"),
      transcript_lines: table("transcript_lines"),
      user_kanji_progress: table("user_kanji_progress"),
      shadowing_sessions: table("shadowing_sessions", { id: "s1", created_at: "2026-10-08T00:00:00Z" }),
      dictation_attempts: table("dictation_attempts"),
      user_video_progress: table("user_video_progress", { user_id: USER.id, video_id: VIDEO, last_watched_position: 1 }),
    });

    await expect(submitReview({ itemType: "kanji", itemId: VIDEO, quality: 4 })).resolves.toMatchObject({ ok: false, status: 400 });
    await expect(createSession({ videoId: VIDEO, lineId: LINE, audio: audio() })).resolves.toMatchObject({ ok: false, status: 400 });
    await expect(submitAttempt({ videoId: VIDEO, lineId: LINE, userInput: "x" })).resolves.toMatchObject({ ok: false, status: 400 });
    await expect(updateProgress(VIDEO, { position: 1, completed: true })).resolves.toMatchObject({ ok: false, status: 400 });

    expect(order).toEqual([]);
  });

  it("binds each transcript preflight lookup to the requested video", async () => {
    const lineQueries: QueryCall[][] = [];
    install(USER, {
      transcript_lines: (calls) => {
        lineQueries.push(calls);
        return { data: null, error: null };
      },
    });

    await expect(createSession({ videoId: VIDEO, lineId: LINE, audio: audio() })).resolves.toMatchObject({ ok: false, status: 400 });
    await expect(submitAttempt({ videoId: VIDEO, lineId: LINE, userInput: "x" })).resolves.toMatchObject({ ok: false, status: 400 });

    expect(lineQueries).toHaveLength(2);
    for (const calls of lineQueries) {
      expect(calls).toContainEqual({ op: "eq", column: "transcripts.video_id", value: VIDEO });
    }
    expect(order).toEqual([]);
  });
});
