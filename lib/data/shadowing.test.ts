// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockResult, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { encodeWavPCM16 } from "@/lib/audio/pcm-encode";
import { WAV_MAX_BYTES } from "@/lib/audio/wav-header";
import { createSession, listSessions } from "./shadowing";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/data/gamification", () => ({ recordActivity: vi.fn() }));
vi.mock("@/lib/data/missions", () => ({ ensureDailyMission: vi.fn(), claimActiveMission: vi.fn() }));

const USER = { id: "11111111-1111-4111-8111-111111111111" };
const VIDEO = "22222222-2222-4222-8222-222222222222";
const LINE = "33333333-3333-4333-8333-333333333333";
const CREATED = "2026-10-17T00:00:00Z";
const wav = (seconds = 1, type = "audio/wav") =>
  new Blob([encodeWavPCM16(new Int16Array(16000 * seconds), 16000)], { type });
const input = (audio = wav()) => ({ videoId: VIDEO, lineId: LINE, audio });

function install(options: { user?: typeof USER | null; foreignLine?: boolean; insertError?: boolean; rows?: unknown[] } = {}) {
  const upload = vi.fn<(path: string, bytes: Uint8Array, options: { contentType: string; upsert: boolean }) => Promise<{ error: null }>>(
    async () => ({ error: null }),
  );
  const remove = vi.fn(async (): Promise<{ error: { message: string } | null }> => ({ error: null }));
  const sign = vi.fn(async (): Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }> =>
    ({ data: { signedUrl: "https://signed" }, error: null }));
  const userWrites = vi.fn(() => ({ data: { id: "session", created_at: CREATED }, error: null }));
  const history = vi.fn<(calls: QueryCall[]) => MockResult>(() => ({ data: options.rows ?? [], error: null }));
  const line = vi.fn((calls: QueryCall[]) => ({
    data: options.foreignLine && calls.some((call) => call.op === "eq" && call.column === "transcripts.video_id")
      ? null : { id: LINE }, error: null,
  }));
  const client = createMockSupabase({
    user: options.user === undefined ? USER : options.user,
    tables: {
      transcript_lines: line,
      shadowing_sessions: (calls) => calls.some((call) => call.op === "insert") ? userWrites() : history(calls),
    },
  });
  const storageFrom = vi.fn(() => ({ upload, remove, createSignedUrl: sign }));
  vi.mocked(createClient).mockReturnValue({ ...client, storage: { from: storageFrom } } as unknown as ReturnType<typeof createClient>);
  const insert = vi.fn<(calls: QueryCall[]) => MockResult>(() => ({
    data: options.insertError ? null : { id: "session", created_at: CREATED },
    error: options.insertError ? { message: "insert failed" } : null,
  }));
  const service = createMockSupabase({ tables: { shadowing_sessions: insert } });
  vi.mocked(createServiceClient).mockReturnValue(service as unknown as ReturnType<typeof createServiceClient>);
  return { upload, remove, sign, userWrites, insert, line, storageFrom, history };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rateLimit).mockReturnValue({ ok: true, retryAfter: 0 });
});
afterEach(() => vi.restoreAllMocks());

describe("createSession", () => {
  it("uploads encoded WAV bytes to the user's path and inserts only through the service client", async () => {
    const mock = install();
    const audio = wav(1, "application/octet-stream");
    const result = await createSession({ ...input(audio), pitchScore: 82 });
    expect(result).toEqual({ ok: true, data: {
      id: "session", recordingPath: expect.stringMatching(new RegExp(`^${USER.id}/shadowing/[\\da-f-]{36}\\.wav$`)),
      signedUrl: "https://signed", createdAt: CREATED,
    } });
    if (!result.ok) throw new Error("expected saved take");
    expect(mock.upload).toHaveBeenCalledTimes(1);
    expect(mock.upload).toHaveBeenCalledWith(result.data.recordingPath,
      new Uint8Array(await audio.arrayBuffer()), { contentType: "audio/wav", upsert: false });
    expect(mock.storageFrom).toHaveBeenCalledWith("recordings");
    expect(mock.insert).toHaveBeenCalledTimes(1);
    const inserts = mock.insert.mock.calls[0]?.[0].filter((call) => call.op === "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts?.[0]).toEqual({ op: "insert", values: {
      id: result.data.recordingPath.split("/").at(-1)?.slice(0, -4), user_id: USER.id,
      video_id: VIDEO, transcript_line_id: LINE, recording_url: result.data.recordingPath, pitch_score: 82,
    } });
    expect(mock.userWrites).not.toHaveBeenCalled();
    expect(mock.line).toHaveBeenCalledTimes(1);
    expect(mock.line.mock.calls[0]?.[0]).toContainEqual({ op: "eq", column: "id", value: LINE });
    expect(mock.line.mock.calls[0]?.[0]).toContainEqual({ op: "eq", column: "transcripts.video_id", value: VIDEO });
  });

  it.each([
    ["webm", () => new Blob(["x"], { type: "audio/webm" })],
    ["spoofed WAV", () => new Blob(["not RIFF"], { type: "audio/wav" })],
    ["40 second WAV", () => wav(40)],
    ["32 second WAV within the byte cap", () => wav(32)],
  ] as const)("rejects %s before upload or insert", async (_label, audio) => {
    const mock = install();
    expect(await createSession(input(audio()))).toEqual({ ok: false, status: 422 });
    expect(mock.upload).not.toHaveBeenCalled();
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(mock.userWrites).not.toHaveBeenCalled();
  });

  it("rejects oversized input before reading the bytes", async () => {
    const mock = install();
    const audio = new Blob([new Uint8Array(WAV_MAX_BYTES + 1)], { type: "audio/wav" });
    const read = vi.spyOn(audio, "arrayBuffer");
    expect(await createSession(input(audio))).toEqual({ ok: false, status: 422 });
    expect(read).not.toHaveBeenCalled();
    expect(mock.upload).not.toHaveBeenCalled();
    expect(mock.insert).not.toHaveBeenCalled();
  });

  it("rejects a foreign lesson line before any privileged insert", async () => {
    const mock = install({ foreignLine: true });
    expect(await createSession(input())).toEqual({ ok: false, status: 400 });
    expect(mock.line).toHaveBeenCalledTimes(1);
    expect(mock.upload).not.toHaveBeenCalled();
    expect(mock.userWrites).not.toHaveBeenCalled();
    expect(mock.insert).not.toHaveBeenCalled();
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("does not upload when service client initialization throws", async () => {
    const mock = install();
    const error = new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
    vi.mocked(createServiceClient).mockImplementationOnce(() => { throw error; });
    await expect(createSession(input())).rejects.toThrow(error);
    expect(mock.line).toHaveBeenCalledTimes(1);
    expect(mock.upload).not.toHaveBeenCalled();
    expect(mock.insert).not.toHaveBeenCalled();
  });

  it.each([false, true])("removes a failed insert's upload; logs a failed cleanup (%s)", async (cleanupFails) => {
    const mock = install({ insertError: true });
    const error = { message: "remove failed" };
    if (cleanupFails) mock.remove.mockResolvedValue({ error });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await createSession(input())).toEqual({ ok: false, status: 400 });
    expect(mock.upload).toHaveBeenCalledTimes(1);
    const path = mock.upload.mock.calls[0]?.[0];
    expect(mock.remove).toHaveBeenCalledTimes(1);
    expect(mock.remove).toHaveBeenCalledWith([path]);
    if (cleanupFails) expect(log).toHaveBeenCalledWith(
      "[shadowing] orphaned recording after a failed insert:", path, error,
    );
    else expect(log).not.toHaveBeenCalled();
  });

  it("rejects signed-out users before upload or privileged insert", async () => {
    const mock = install({ user: null });
    expect(await createSession(input())).toEqual({ ok: false, status: 401 });
    expect(mock.upload).not.toHaveBeenCalled();
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("preserves the session rate limit before reading audio", async () => {
    const mock = install();
    vi.mocked(rateLimit).mockReturnValue({ ok: false, retryAfter: 1000 });
    const audio = wav();
    const read = vi.spyOn(audio, "arrayBuffer");
    expect(await createSession(input(audio))).toEqual({ ok: false, status: 429, retryAfter: 1000 });
    expect(rateLimit).toHaveBeenCalledWith(`shadowing:session:${USER.id}`, { limit: 30, windowMs: 60000 });
    expect(read).not.toHaveBeenCalled();
    expect(mock.upload).not.toHaveBeenCalled();
  });
});

describe("listSessions", () => {
  it("lists scoring states, scores, validated assessment and legacy formats without dropping unsigned rows", async () => {
    const now = Date.parse("2026-10-17T12:00:00Z");
    vi.spyOn(Date, "now").mockReturnValue(now);
    const assessment = { v: 1, accuracy: 85, completeness: null, recognizedText: null, words: null };
    const base = { created_at: CREATED, recording_url: "u/take.wav", pronunciation_score: null,
      rhythm_score: null, pitch_score: null, assessment: null, scoring_claim: null, scoring_started_at: null };
    const rows = [
      { ...base, id: "scored", pronunciation_score: 80, rhythm_score: 70, pitch_score: 60, assessment },
      { ...base, id: "scoring", scoring_claim: "claim", scoring_started_at: new Date(now - 10000).toISOString() },
      { ...base, id: "expired", scoring_claim: "claim", scoring_started_at: new Date(now - 120000).toISOString() },
      { ...base, id: "boundary", scoring_claim: "claim", scoring_started_at: new Date(now - 90000).toISOString() },
      { ...base, id: "legacy", recording_url: "u/take.webm" },
      { ...base, id: "unknown", assessment: { v: 9 } },
      { ...base, id: "missing", recording_url: null },
      { ...base, id: "scored-legacy", recording_url: "u/scored.webm", pronunciation_score: 90 },
    ];
    const mock = install({ rows });
    mock.sign.mockResolvedValueOnce({ data: null, error: { message: "sign failed" } });
    const result = await listSessions(LINE);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected history");
    expect(result.data).toHaveLength(8);
    expect(result.data.map((row) => [row.id, row.state, row.format])).toEqual([
      ["scored", "scored", "wav"], ["scoring", "scoring", "wav"], ["expired", "unscored", "wav"],
      ["boundary", "unscored", "wav"], ["legacy", "legacy", "webm"],
      ["unknown", "unscored", "wav"], ["missing", "unscored", "wav"],
      ["scored-legacy", "scored", "webm"],
    ]);
    expect(result.data[0]).toEqual({ id: "scored", createdAt: CREATED, signedUrl: null,
      pronunciationScore: 80, rhythmScore: 70, pitchScore: 60, assessment, state: "scored", format: "wav" });
    expect(result.data[5]?.assessment).toBeNull();
    expect(result.data[6]?.signedUrl).toBeNull();
    expect(mock.sign).toHaveBeenCalledTimes(7);
    expect(mock.sign).toHaveBeenCalledWith("u/take.webm", 3600);
    expect(mock.history).toHaveBeenCalledTimes(1);
    expect(mock.history.mock.calls[0]?.[0]).toEqual([
      { op: "select", columns: "id, recording_url, created_at, pronunciation_score, rhythm_score, pitch_score, assessment, scoring_claim, scoring_started_at" },
      { op: "eq", column: "user_id", value: USER.id },
      { op: "eq", column: "transcript_line_id", value: LINE },
      { op: "order", column: "created_at", ascending: false },
      { op: "limit", count: 10 },
    ]);
  });
});
