// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, eqValue } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { encodeWavPCM16 } from "@/lib/audio/pcm-encode";
import { WAV_MAX_BYTES } from "@/lib/audio/wav-header";
import { assessPronunciation, isSpeechConfigured, SpeechThrottledError, SpeechRequestError, SpeechAuthError, SpeechRecognitionError, SpeechNotConfiguredError } from "@/lib/speech-scoring";
import { captureShadowScoreMemories } from "@/lib/data/companion";
import { scoreSession } from "./pronunciation";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/speech-scoring", async (original) => ({
  ...await original<typeof import("@/lib/speech-scoring")>(), assessPronunciation: vi.fn(), isSpeechConfigured: vi.fn(),
}));
vi.mock("@/lib/data/companion", () => ({ captureShadowScoreMemories: vi.fn() }));
const SESSION = "c0000000-0000-4000-8000-000000000001";
const LINE = "c0000000-0000-4000-8000-000000000002";
const VIDEO = "c0000000-0000-4000-8000-000000000003";
const CLAIM = "c0000000-0000-4000-8000-000000000004";
const WAV = encodeWavPCM16(new Int16Array([1, 2]), 16000);
const RESULT = { recognizedText: "今日は", pronunciationScore: 88, fluencyScore: 76, accuracyScore: 91, completenessScore: 100, words: [] };
const ASSESSMENT = { v: 1, accuracy: 91, completeness: 100, recognizedText: "今日は", words: [] };
let userSeq = 0;
function setup(options: { user?: null; claimed?: boolean; recording?: string | null; line?: boolean; lineId?: string | null; videoId?: string | null; file?: Blob | null; finished?: boolean; claimError?: boolean; finishError?: boolean; lineError?: boolean; downloadError?: boolean } = {}) {
  const user = options.user === null ? null : { id: `u-score-${++userSeq}` };
  const download = vi.fn().mockResolvedValue({ data: options.file === undefined ? new Blob([WAV]) : options.file, error: options.downloadError ? new Error("download failed") : null });
  const client = createMockSupabase({ user, tables: {
    transcript_lines: (calls) => ({ data: options.line === false || eqValue(calls, "id") !== LINE || eqValue(calls, "transcripts.video_id") !== VIDEO ? null : { text_jp: "今日は" }, error: options.lineError || eqValue(calls, "id") === "" || eqValue(calls, "transcripts.video_id") === "" ? new Error("line failed") : null }),
  } });
  vi.mocked(createClient).mockReturnValue({ ...client, storage: { from: vi.fn((bucket) => {
    expect(bucket).toBe("recordings"); return { download };
  }) } } as unknown as ReturnType<typeof createClient>);
  const service = createMockSupabase({ tables: {}, rpcs: {
    claim_pronunciation_scoring: () => ({ data: options.claimed === false ? [] : [{ claim: CLAIM, video_id: options.videoId === undefined ? VIDEO : options.videoId, transcript_line_id: options.lineId === undefined ? LINE : options.lineId, recording_url: options.recording === undefined ? "u/shadowing/take.wav" : options.recording }], error: options.claimError ? new Error("claim failed") : null }),
    finish_pronunciation_scoring: () => ({ data: options.finished ?? true, error: options.finishError ? new Error("finish failed") : null }),
    release_pronunciation_scoring: () => ({ data: null, error: null }),
  } });
  vi.mocked(createServiceClient).mockReturnValue(service as unknown as ReturnType<typeof createServiceClient>);
  return { user, service, download };
}
function released(service: ReturnType<typeof setup>["service"]) {
  expect(service.rpcCalls?.filter((call) => call.name === "release_pronunciation_scoring")).toEqual([
    { name: "release_pronunciation_scoring", args: { p_session: SESSION, p_claim: CLAIM } },
  ]);
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(isSpeechConfigured).mockReturnValue(true);
  vi.mocked(assessPronunciation).mockResolvedValue(RESULT);
});
describe("scoreSession", () => {
  it("scores the claimed recording with server line text and commits assessment before Companion capture", async () => {
    const { user, service, download } = setup();
    vi.mocked(captureShadowScoreMemories).mockImplementation(async () => {
      expect(service.rpcCalls?.map((call) => call.name)).toEqual(["claim_pronunciation_scoring", "finish_pronunciation_scoring"]);
    });
    expect(await scoreSession(SESSION)).toEqual({ ok: true, data: { sessionId: SESSION, lineId: LINE, pronunciationScore: 88, rhythmScore: 76, assessment: ASSESSMENT } });
    expect(service.rpcCalls).toEqual([
      { name: "claim_pronunciation_scoring", args: { p_user: user?.id, p_session: SESSION } },
      { name: "finish_pronunciation_scoring", args: { p_session: SESSION, p_claim: CLAIM, p_pronunciation: 88, p_rhythm: 76, p_assessment: ASSESSMENT } },
    ]);
    expect(download).toHaveBeenCalledTimes(1); expect(download).toHaveBeenCalledWith("u/shadowing/take.wav");
    expect(assessPronunciation).toHaveBeenCalledTimes(1); expect(assessPronunciation).toHaveBeenCalledWith({ audio: WAV, referenceText: "今日は" });
    expect(captureShadowScoreMemories).toHaveBeenCalledTimes(1); expect(captureShadowScoreMemories).toHaveBeenCalledWith({ userId: user?.id, sessionId: SESSION, videoId: VIDEO, transcriptLineId: LINE, pronunciationScore: 88 });
  });
  it("requires authentication before claiming or calling Azure", async () => {
    setup({ user: null });
    expect(await scoreSession(SESSION)).toEqual({ ok: false, status: 401 });
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(assessPronunciation).not.toHaveBeenCalled();
  });
  it("keeps the real per-user limiter retry time and never claims the eleventh request", async () => {
    const { service } = setup({ claimed: false });
    for (let i = 0; i < 10; i++) await scoreSession(SESSION);
    const result = await scoreSession(SESSION);
    expect(result).toMatchObject({ ok: false, status: 429, retryAfter: expect.any(Number) });
    if (!result.ok && result.status === 429) { expect(result.retryAfter).toBeGreaterThan(0); expect(result.retryAfter).toBeLessThanOrEqual(60_000); }
    expect(service.rpcCalls).toHaveLength(10);
    expect(assessPronunciation).not.toHaveBeenCalled();
  });
  it("returns 503 before claiming when speech is off", async () => {
    setup(); vi.mocked(isSpeechConfigured).mockReturnValue(false);
    expect(await scoreSession(SESSION)).toEqual({ ok: false, status: 503 });
    expect(createServiceClient).not.toHaveBeenCalled();
  });
  it("refuses an unavailable claim without Azure or memories", async () => {
    const { service } = setup({ claimed: false });
    expect(await scoreSession(SESSION)).toEqual({ ok: false, status: 409, reason: "not_claimable" });
    expect(service.rpcCalls).toHaveLength(1);
    expect(assessPronunciation).not.toHaveBeenCalled(); expect(captureShadowScoreMemories).not.toHaveBeenCalled();
  });
  it.each(["u/old.webm", null])("releases legacy recording %s", async (recording) => {
    const { service, download } = setup({ recording });
    expect(await scoreSession(SESSION)).toEqual({ ok: false, status: 409, reason: "legacy_format" });
    released(service); expect(download).not.toHaveBeenCalled(); expect(assessPronunciation).not.toHaveBeenCalled();
  });
  it.each([{ line: false }, { file: null }, { downloadError: true }])("releases missing or unreadable stored input %j", async (options) => {
    const { service } = setup(options);
    expect(await scoreSession(SESSION)).toEqual({ ok: false, status: 422 });
    released(service); expect(assessPronunciation).not.toHaveBeenCalled();
  });
  it.each([{ lineId: null }, { videoId: null }])("releases incomplete session pointers %j without a malformed UUID query", async (options) => {
    const { service } = setup(options);
    expect(await scoreSession(SESSION)).toEqual({ ok: false, status: 422 });
    released(service); expect(assessPronunciation).not.toHaveBeenCalled();
  });
  it("rejects a spoofed stored WAV before Azure even though its MIME and path say WAV", async () => {
    const { service } = setup({ file: new Blob(["replaced malicious bytes"], { type: "audio/wav" }) });
    expect(await scoreSession(SESSION)).toEqual({ ok: false, status: 422 });
    released(service); expect(assessPronunciation).not.toHaveBeenCalled(); expect(captureShadowScoreMemories).not.toHaveBeenCalled();
  });
  it("caps the stored Blob before allocating its bytes", async () => {
    const file = new Blob([new Uint8Array(WAV_MAX_BYTES + 1)]);
    const read = vi.spyOn(file, "arrayBuffer"); const { service } = setup({ file });
    expect(await scoreSession(SESSION)).toEqual({ ok: false, status: 422 });
    released(service); expect(read).not.toHaveBeenCalled(); expect(assessPronunciation).not.toHaveBeenCalled();
  });
  it.each([
    [new SpeechThrottledError(undefined, 12_000), 429, 12_000],
    [new SpeechThrottledError(), 429, null],
    [new SpeechRequestError("timeout"), 502, undefined],
    [new SpeechAuthError(), 502, undefined],
    [new SpeechRecognitionError("no match"), 422, undefined],
    [new SpeechNotConfiguredError(), 503, undefined],
  ] as const)("releases the same claim on %s", async (error, status, retryAfter) => {
    const { service } = setup(); vi.mocked(assessPronunciation).mockRejectedValue(error);
    expect(await scoreSession(SESSION)).toEqual({ ok: false, status, ...(status === 429 ? { retryAfter } : {}) });
    released(service); expect(captureShadowScoreMemories).not.toHaveBeenCalled();
  });
  it("does not capture memories or release a superseded lease", async () => {
    const { service } = setup({ finished: false });
    const result = await scoreSession(SESSION);
    expect(captureShadowScoreMemories).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, status: 409, reason: "superseded" });
    expect(service.rpcCalls?.map((call) => call.name)).toEqual(["claim_pronunciation_scoring", "finish_pronunciation_scoring"]);
  });
  it.each([{ finishError: true }, { lineError: true }])("releases then propagates database errors %j", async (options) => {
    const { service } = setup(options);
    await expect(scoreSession(SESSION)).rejects.toThrow(/failed/); released(service);
    expect(captureShadowScoreMemories).not.toHaveBeenCalled();
  });
  it("propagates a claim error without doing work or releasing an unowned token", async () => {
    const { service } = setup({ claimError: true });
    await expect(scoreSession(SESSION)).rejects.toThrow("claim failed");
    expect(service.rpcCalls).toHaveLength(1); expect(assessPronunciation).not.toHaveBeenCalled();
  });
  it("releases unexpected transport errors before propagating", async () => {
    const { service } = setup(); vi.mocked(assessPronunciation).mockRejectedValue(new Error("unexpected"));
    await expect(scoreSession(SESSION)).rejects.toThrow("unexpected"); released(service);
  });
});

describe("scoreConversationPronunciation", () => {
  it("scores ephemeral audio without claiming or writing any session", async () => {
    setup();
    const { scoreConversationPronunciation } = await import("./pronunciation");
    expect(await scoreConversationPronunciation({ audio: new Blob([WAV]), referenceText: "conversation text" })).toEqual({ ok: true, data: RESULT });
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(captureShadowScoreMemories).not.toHaveBeenCalled();
    expect(assessPronunciation).toHaveBeenCalledWith({ audio: WAV, referenceText: "conversation text" });
  });
  it("preserves the conversation 2 MB allowance rather than imposing the practice take cap", async () => {
    setup(); const { scoreConversationPronunciation } = await import("./pronunciation");
    expect((await scoreConversationPronunciation({ audio: new Blob([new Uint8Array(WAV_MAX_BYTES + 1)]), referenceText: "text" })).ok).toBe(true);
    expect(createServiceClient).not.toHaveBeenCalled();
  });
  it("rejects oversized conversation audio before allocation", async () => {
    setup(); const { scoreConversationPronunciation } = await import("./pronunciation");
    const audio = new Blob([new Uint8Array(2 * 1024 * 1024 + 1)]); const read = vi.spyOn(audio, "arrayBuffer");
    expect(await scoreConversationPronunciation({ audio, referenceText: "text" })).toEqual({ ok: false, status: 422 });
    expect(read).not.toHaveBeenCalled(); expect(assessPronunciation).not.toHaveBeenCalled();
  });
  it("shares the existing scoring quota across both flows", async () => {
    setup({ claimed: false }); const { scoreConversationPronunciation } = await import("./pronunciation");
    for (let i = 0; i < 10; i++) await scoreSession(SESSION);
    expect(await scoreConversationPronunciation({ audio: new Blob([WAV]), referenceText: "text" })).toMatchObject({ ok: false, status: 429, retryAfter: expect.any(Number) });
    expect(assessPronunciation).not.toHaveBeenCalled();
  });
  it.each([null, 12_000])("preserves real upstream retry timing %s", async (retryAfter) => {
    setup(); const { scoreConversationPronunciation } = await import("./pronunciation");
    vi.mocked(assessPronunciation).mockRejectedValue(new SpeechThrottledError(undefined, retryAfter ?? undefined));
    expect(await scoreConversationPronunciation({ audio: new Blob([WAV]), referenceText: "text" })).toEqual({ ok: false, status: 429, retryAfter });
  });
  it("authenticates conversation scoring", async () => {
    setup({ user: null }); const { scoreConversationPronunciation } = await import("./pronunciation");
    expect(await scoreConversationPronunciation({ audio: new Blob([WAV]), referenceText: "text" })).toEqual({ ok: false, status: 401 });
    expect(assessPronunciation).not.toHaveBeenCalled();
  });
  it("returns 503 when speech is off", async () => {
    setup(); vi.mocked(isSpeechConfigured).mockReturnValue(false); const { scoreConversationPronunciation } = await import("./pronunciation");
    expect(await scoreConversationPronunciation({ audio: new Blob([WAV]), referenceText: "text" })).toEqual({ ok: false, status: 503 });
    expect(assessPronunciation).not.toHaveBeenCalled();
  });
});
