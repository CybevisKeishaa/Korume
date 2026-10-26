import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordActivity } from "@/lib/data/gamification";
import { claimActiveMission, ensureDailyMission } from "@/lib/data/missions";
import { rateLimit } from "@/lib/rate-limit";
import { lineTextHash } from "@/lib/dictation/chunk";
import type { DictationAttemptInput } from "@/lib/validation/dictation";
import { submitListeningAttempt } from "./dictation";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/data/missions", () => ({ ensureDailyMission: vi.fn(async () => null), claimActiveMission: vi.fn(async () => undefined) }));
vi.mock("@/lib/data/gamification", () => ({ recordActivity: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => ({ ok: true, retryAfter: 0 })) }));

// kuromoji dictionary load is slow under suite contention (lib/dictation/chunk.test.ts).
const T = 60000;
const USER = { id: "11111111-1111-4111-8111-111111111111" };
const VIDEO = "22222222-2222-4222-8222-222222222222";
const LINE = "33333333-3333-4333-8333-333333333333";
/** Reliable: chunks 毎日 | 日本語を | 勉強しました。 → Typing hint unit `chunk`. */
const RELIABLE = "毎日日本語を勉強しました。";
/** Unreliable (digits): no Word Bank; 15 code points → four `grapheme4` units. */
const DIGITS = "今日は21番目の文を読みます。";

let lineText: string | null;
let lineQueries: QueryCall[][];
let userWrites: QueryCall[][];
let inserts: unknown[];

function install(user: typeof USER | null = USER) {
  const userClient = createMockSupabase({
    user,
    tables: {
      transcript_lines: (calls) => {
        lineQueries.push(calls);
        return { data: lineText === null ? null : { text_jp: lineText }, error: null };
      },
      dictation_attempts: (calls) => {
        userWrites.push(calls);
        return { data: null, error: null };
      },
    },
  });
  const service = createMockSupabase({
    tables: {
      dictation_attempts: (calls) => {
        for (const call of calls) if (call.op === "insert") inserts.push(call.values);
        return { data: null, error: null };
      },
    },
  });
  vi.mocked(createClient).mockReturnValue(userClient as unknown as ReturnType<typeof createClient>);
  vi.mocked(createServiceClient).mockReturnValue(service as unknown as ReturnType<typeof createServiceClient>);
}

type Shape<K, F> = Extract<DictationAttemptInput, { kind: K; format: F }>;
const head = (text: string) => ({ videoId: VIDEO, lineId: LINE, version: 1, textHash: lineTextHash(text) });
const wordBank = (over: Partial<{ chunkOrder: number[]; hintedUnits: number[] }> = {}): Shape<"submit", "word_bank"> => (
  { kind: "submit", format: "word_bank", ...head(RELIABLE), chunkOrder: [0, 1, 2], hintedUnits: [], ...over }
);
const typing = (text: string, over: Partial<{ input: string; hintUnit: "chunk" | "grapheme4"; hintedUnits: number[] }> = {}): Shape<"submit", "typing"> => (
  { kind: "submit", format: "typing", ...head(text), input: "", hintUnit: "chunk", hintedUnits: [], ...over }
);

function expectNothingWritten() {
  expect(inserts).toEqual([]);
  expect(userWrites).toEqual([]);
  expect(ensureDailyMission).not.toHaveBeenCalled();
  expect(recordActivity).not.toHaveBeenCalled();
  expect(claimActiveMission).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  lineText = RELIABLE;
  lineQueries = [];
  userWrites = [];
  inserts = [];
  install();
});

describe("submitListeningAttempt: refusals before any write", () => {
  it("401 without a session, before the rate limit and the line read", async () => {
    install(null);
    await expect(submitListeningAttempt(wordBank())).resolves.toEqual({ ok: false, status: 401 });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(lineQueries).toHaveLength(0);
    expectNothingWritten();
  });

  it("429 with retryAfter on the per-user dictation budget (60/min)", async () => {
    vi.mocked(rateLimit).mockReturnValueOnce({ ok: false, retryAfter: 1234 });
    await expect(submitListeningAttempt(wordBank())).resolves.toEqual({ ok: false, status: 429, retryAfter: 1234 });
    expect(rateLimit).toHaveBeenCalledWith(`dictation:attempt:${USER.id}`, { limit: 60, windowMs: 60_000 });
    expect(lineQueries).toHaveLength(0);
    expectNothingWritten();
  });

  it("400 for a line of another lesson: the RLS read is bound to the requested video (§7.1)", async () => {
    lineText = null;
    await expect(submitListeningAttempt(wordBank())).resolves.toEqual({ ok: false, status: 400 });
    expect(lineQueries).toHaveLength(1);
    expect(lineQueries[0]).toContainEqual({ op: "eq", column: "id", value: LINE });
    expect(lineQueries[0]).toContainEqual({ op: "eq", column: "transcripts.video_id", value: VIDEO });
    expectNothingWritten();
  });

  it("409 line_changed when textHash is not the hash of the line just read", async () => {
    const body = { ...wordBank(), textHash: lineTextHash("昨日は雨でした。") };
    await expect(submitListeningAttempt(body)).resolves.toEqual({ ok: false, status: 409, error: "line_changed" });
    expectNothingWritten();
  });

  it("409 chunker_version for a version the registry does not hold", async () => {
    await expect(submitListeningAttempt({ ...wordBank(), version: 99 })).resolves.toEqual({ ok: false, status: 409, error: "chunker_version" });
    expectNothingWritten();
  });

  it("400 for Word Bank on an unreliable line (submit and reveal)", async () => {
    lineText = DIGITS;
    await expect(submitListeningAttempt({ ...wordBank(), ...head(DIGITS), chunkOrder: [0, 1] })).resolves.toEqual({ ok: false, status: 400 });
    await expect(submitListeningAttempt({ kind: "reveal", format: "word_bank", ...head(DIGITS), hintedUnits: [] }))
      .resolves.toEqual({ ok: false, status: 400 });
    expectNothingWritten();
  }, T);

  it.each([
    ["a repeated index", [0, 0, 2]],
    ["a short order", [0, 1]],
    ["an index past n", [0, 1, 3]],
    ["a negative index", [-1, 1, 2]],
  ])("400 when chunkOrder is not a permutation: %s", async (_, chunkOrder) => {
    await expect(submitListeningAttempt(wordBank({ chunkOrder }))).resolves.toEqual({ ok: false, status: 400 });
    expectNothingWritten();
  }, T);

  it.each([
    ["a duplicate hint", [1, 1]],
    ["a hint past the chunk count", [3]],
    ["a negative hint", [-1]],
  ])("400 for Word Bank with %s", async (_, hintedUnits) => {
    await expect(submitListeningAttempt(wordBank({ hintedUnits }))).resolves.toEqual({ ok: false, status: 400 });
    expectNothingWritten();
  }, T);

  describe("v2 hinted prefix (毎日|日本語|を|勉強|し|まし|た。)", () => {
    const v2 = { ...head(RELIABLE), version: 2 };
    const ID = [0, 1, 2, 3, 4, 5, 6];
    it("400 when the hints are not the prefix 0..k-1 (submit and reveal)", async () => {
      await expect(submitListeningAttempt({ ...wordBank({ chunkOrder: ID, hintedUnits: [1] }), ...v2 })).resolves.toEqual({ ok: false, status: 400 });
      await expect(submitListeningAttempt({ kind: "reveal", format: "word_bank", ...v2, hintedUnits: [2] })).resolves.toEqual({ ok: false, status: 400 });
      expectNothingWritten();
    }, T);
    it("400 when chunkOrder does not start with the hinted prefix", async () => {
      await expect(submitListeningAttempt({ ...wordBank({ chunkOrder: [1, 0, 2, 3, 4, 5, 6], hintedUnits: [0, 1] }), ...v2 })).resolves.toEqual({ ok: false, status: 400 });
      expectNothingWritten();
    }, T);
    it("scores by LCS and accepts a valid prefix", async () => {
      const r = await submitListeningAttempt({ ...wordBank({ chunkOrder: ID, hintedUnits: [0, 1] }), ...v2 });
      expect(r).toMatchObject({ ok: true, data: { score: 71.4, metrics: { slots: { correct: 5, total: 7 } } } });
      const shifted = await submitListeningAttempt({ ...wordBank({ chunkOrder: [1, 2, 3, 4, 5, 6, 0] }), ...v2 });
      expect(shifted).toMatchObject({ ok: true, data: { score: 85.7 } });
    }, T);
    it("v1 attempts keep positional scoring", async () => {
      const r = await submitListeningAttempt(wordBank({ chunkOrder: [1, 2, 0] }));
      expect(r).toMatchObject({ ok: true, data: { score: 0 } });
    }, T);
  });

  it("400 when the Typing hintUnit disagrees with the line, both ways", async () => {
    await expect(submitListeningAttempt(typing(RELIABLE, { hintUnit: "grapheme4" }))).resolves.toEqual({ ok: false, status: 400 });
    lineText = DIGITS;
    await expect(submitListeningAttempt(typing(DIGITS, { hintUnit: "chunk" }))).resolves.toEqual({ ok: false, status: 400 });
    await expect(submitListeningAttempt({ kind: "reveal", format: "typing", ...head(DIGITS), hintUnit: "chunk", hintedUnits: [] }))
      .resolves.toEqual({ ok: false, status: 400 });
    expectNothingWritten();
  }, T);

  it("400 for a grapheme4 line's index past its unit count; the last unit is accepted", async () => {
    lineText = DIGITS;
    await expect(submitListeningAttempt(typing(DIGITS, { hintUnit: "grapheme4", hintedUnits: [4] }))).resolves.toEqual({ ok: false, status: 400 });
    expectNothingWritten();
    await expect(submitListeningAttempt(typing(DIGITS, { hintUnit: "grapheme4", hintedUnits: [3] }))).resolves.toMatchObject({ ok: true });
  }, T);

  it("throws a failed insert instead of reporting a score that was never stored", async () => {
    const error = { message: "check violation" };
    vi.mocked(createServiceClient).mockReturnValue(createMockSupabase({
      tables: { dictation_attempts: () => ({ data: null, error }) },
    }) as unknown as ReturnType<typeof createServiceClient>);
    await expect(submitListeningAttempt(wordBank())).rejects.toBe(error);
    expect(recordActivity).not.toHaveBeenCalled();
    expect(claimActiveMission).not.toHaveBeenCalled();
  }, T);
});

describe("submitListeningAttempt: submit", () => {
  it("Word Bank: scores against the server's chunks and inserts through the service client with the verified user", async () => {
    const result = await submitListeningAttempt(wordBank({ chunkOrder: [0, 2, 1], hintedUnits: [0] }));
    expect(result).toEqual({ ok: true, data: {
      kind: "submit",
      score: 0,
      slots: [
        { chunkIndex: 0, correct: true, hinted: true },
        { chunkIndex: 2, correct: false, hinted: false },
        { chunkIndex: 1, correct: false, hinted: false },
      ],
      metrics: { recall: 0, slots: { correct: 0, total: 3 } },
      answer: RELIABLE,
    } });
    expect(inserts).toEqual([{
      user_id: USER.id,
      video_id: VIDEO,
      transcript_line_id: LINE,
      user_input: "毎日勉強しました。日本語を",
      format: "word_bank",
      status: "submitted",
      accuracy_score: 0,
      hint_unit: "chunk",
      hinted_units: [0],
      chunk_order: [0, 2, 1],
      chunker_version: 1,
      chunk_snapshot: ["毎日", "日本語を", "勉強しました。"],
    }]);
    expect(userWrites).toEqual([]);
    expect(recordActivity).toHaveBeenCalledWith({ userId: USER.id, source: "dictation", parts: { lineId: LINE } });
    expect(claimActiveMission).toHaveBeenCalledWith(USER.id);
  }, T);

  it("Word Bank without hints stores hint_unit null; hinted slots never count (D10)", async () => {
    const result = await submitListeningAttempt(wordBank());
    expect(result).toMatchObject({ ok: true, data: { score: 100, metrics: { slots: { correct: 3, total: 3 } } } });
    expect(inserts).toMatchObject([{ hint_unit: null, hinted_units: [], accuracy_score: 100 }]);

    inserts = [];
    await expect(submitListeningAttempt(wordBank({ hintedUnits: [0, 1, 2] }))).resolves.toMatchObject({ ok: true, data: { score: 0 } });
    expect(inserts).toMatchObject([{ hint_unit: "chunk", hinted_units: [0, 1, 2], accuracy_score: 0 }]);
  }, T);

  it("Typing on a chunk line: the hinted chunk's characters are excluded, user_input is stored", async () => {
    const result = await submitListeningAttempt(typing(RELIABLE, { input: "毎日日本語を勉強しました", hintedUnits: [0] }));
    // 12 reference characters (punctuation stripped), 2 hinted → 10 / 12.
    expect(result).toMatchObject({ ok: true, data: { kind: "submit", score: 83.3, answer: RELIABLE, metrics: { recall: 83.3 } } });
    expect(result.ok && result.data.kind === "submit" && result.data.diff?.slice(0, 3)).toEqual([
      { type: "hinted", expected: "毎", display: "毎" }, { type: "hinted", expected: "日", display: "日" },
      { type: "match", expected: "日", actual: "日", display: "日" },
    ]);
    expect(result.ok && result.data.kind === "submit" && "slots" in result.data).toBe(false);
    expect(inserts).toEqual([{
      user_id: USER.id,
      video_id: VIDEO,
      transcript_line_id: LINE,
      user_input: "毎日日本語を勉強しました",
      format: "typing",
      status: "submitted",
      accuracy_score: 83.3,
      hint_unit: "chunk",
      hinted_units: [0],
      chunk_order: null,
      chunker_version: 1,
      chunk_snapshot: ["毎日", "日本語を", "勉強しました。"],
    }]);
    expect(recordActivity).toHaveBeenCalledTimes(1);
    expect(claimActiveMission).toHaveBeenCalledTimes(1);
  }, T);

  it("Typing on a grapheme4 line stores the server's unit, or null with no hints", async () => {
    lineText = DIGITS;
    await submitListeningAttempt(typing(DIGITS, { input: "今日は21番目", hintUnit: "grapheme4", hintedUnits: [3] }));
    await submitListeningAttempt(typing(DIGITS, { input: "今日は", hintUnit: "grapheme4" }));
    expect(inserts).toMatchObject([
      { format: "typing", status: "submitted", hint_unit: "grapheme4", hinted_units: [3], chunk_snapshot: [] },
      { format: "typing", status: "submitted", hint_unit: null, hinted_units: [] },
    ]);
  }, T);
});

describe("submitListeningAttempt: reveal (D11)", () => {
  it("display shows the raw characters; chunks, answer and the stored snapshot stay as before", async () => {
    const raw = "お値段が…みたいな時が結構あるんですね？";
    lineText = raw;
    const result = await submitListeningAttempt({ kind: "reveal", format: "word_bank", ...head(raw), hintedUnits: [] });
    expect(result).toEqual({ ok: true, data: {
      kind: "reveal", answer: raw,
      chunks: ["お値段が...みたいな時が", "結構", "あるんですね?"],
      display: ["お値段が…みたいな時が", "結構", "あるんですね？"],
    } });
    expect(inserts).toMatchObject([{ chunk_snapshot: ["お値段が...みたいな時が", "結構", "あるんですね?"] }]);
  }, T);

  it("a Typing diff op shows the raw reference character", async () => {
    lineText = "ｶﾀｶﾅ";
    const result = await submitListeningAttempt(typing("ｶﾀｶﾅ", { input: "カタ", hintUnit: "grapheme4" }));
    expect(result.ok && result.data.kind === "submit" && result.data.diff).toEqual([
      { type: "match", expected: "カ", actual: "カ", display: "ｶ" },
      { type: "match", expected: "タ", actual: "タ", display: "ﾀ" },
      { type: "missing", expected: "カ", display: "ｶ" },
      { type: "missing", expected: "ナ", display: "ﾅ" },
    ]);
  }, T);

  it("Word Bank: inserts revealed with no score, returns the answer, and never records activity or a mission", async () => {
    const result = await submitListeningAttempt({ kind: "reveal", format: "word_bank", ...head(RELIABLE), hintedUnits: [1] });
    expect(result).toEqual({ ok: true, data: { kind: "reveal", answer: RELIABLE, chunks: ["毎日", "日本語を", "勉強しました。"], display: ["毎日", "日本語を", "勉強しました。"] } });
    expect(inserts).toEqual([{
      user_id: USER.id,
      video_id: VIDEO,
      transcript_line_id: LINE,
      user_input: "",
      format: "word_bank",
      status: "revealed",
      accuracy_score: null,
      hint_unit: "chunk",
      hinted_units: [1],
      chunk_order: null,
      chunker_version: 1,
      chunk_snapshot: ["毎日", "日本語を", "勉強しました。"],
    }]);
    expect(userWrites).toEqual([]);
    expect(recordActivity).not.toHaveBeenCalled();
    expect(claimActiveMission).not.toHaveBeenCalled();
    expect(ensureDailyMission).not.toHaveBeenCalled();
  }, T);

  it("Typing: same, with the server's hint unit", async () => {
    lineText = DIGITS;
    const result = await submitListeningAttempt({ kind: "reveal", format: "typing", ...head(DIGITS), hintUnit: "grapheme4", hintedUnits: [] });
    expect(result).toEqual({ ok: true, data: { kind: "reveal", answer: DIGITS, chunks: [], display: [] } });
    expect(inserts).toMatchObject([{ format: "typing", status: "revealed", accuracy_score: null, hint_unit: null }]);
    expect(recordActivity).not.toHaveBeenCalled();
    expect(claimActiveMission).not.toHaveBeenCalled();
  }, T);
});
