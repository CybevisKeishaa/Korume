import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { getTokenizer } from "@/lib/japanese/tokenizer";
import { lineTextHash } from "@/lib/dictation/chunk";
import { loadLineChunks } from "./line-chunks";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/japanese/tokenizer", async (orig) => {
  const m = await orig<typeof import("@/lib/japanese/tokenizer")>();
  return { ...m, getTokenizer: vi.fn(m.getTokenizer) };
});

const T = 60000;
const LINE = "33333333-3333-4333-8333-333333333333";
let lineQueries: QueryCall[][];

/** One learner: `text` is what their RLS read of the line returns (`null` = not readable). */
function asLearner(user: { id: string } | null, text: string | null) {
  vi.mocked(createClient).mockReturnValue(createMockSupabase({
    user,
    tables: {
      transcript_lines: (calls) => {
        lineQueries.push(calls);
        return { data: text === null ? null : { text_jp: text }, error: null };
      },
    },
  }) as unknown as ReturnType<typeof createClient>);
}

beforeEach(() => {
  vi.clearAllMocks();
  lineQueries = [];
});

describe("loadLineChunks", () => {
  it("returns the reference-order chunks, the text hash and the Typing hint unit", async () => {
    const text = "毎日日本語を勉強しました。";
    asLearner({ id: "a" }, text);
    await expect(loadLineChunks(LINE)).resolves.toEqual({ kind: "ok", data: {
      version: 1, textHash: lineTextHash(text), reliable: true, reason: null,
      chunks: ["毎日", "日本語を", "勉強しました。"], display: ["毎日", "日本語を", "勉強しました。"], typingHintUnit: "chunk",
    } });
    expect(lineQueries).toEqual([[
      { op: "select", columns: "text_jp" }, { op: "eq", column: "id", value: LINE }, { op: "maybeSingle" },
    ]]);
  }, T);

  it("display carries the raw characters while chunks stay normalised", async () => {
    asLearner({ id: "a" }, "お値段が…みたいな時が結構あるんですね？");
    await expect(loadLineChunks(LINE)).resolves.toMatchObject({ kind: "ok", data: {
      chunks: ["お値段が...みたいな時が", "結構", "あるんですね?"],
      display: ["お値段が…みたいな時が", "結構", "あるんですね？"],
    } });
  }, T);

  it("an unreliable line carries its reason and the grapheme4 unit", async () => {
    asLearner({ id: "a" }, "今日は21番目の文を読みます。");
    await expect(loadLineChunks(LINE)).resolves.toMatchObject({ kind: "ok", data: {
      reliable: false, reason: "latin_or_digit", chunks: [], display: [], typingHintUnit: "grapheme4",
    } });
  }, T);

  it("two requests for one line run the chunker once", async () => {
    asLearner({ id: "a" }, "昨日は友達と映画を見ました。");
    await loadLineChunks(LINE);
    await loadLineChunks(LINE);
    expect(lineQueries).toHaveLength(2);
    expect(getTokenizer).toHaveBeenCalledTimes(1);
  }, T);

  it("P12: a primed memo is never consulted before the learner's own read succeeds", async () => {
    const text = "週末は家でゆっくり休みます。";
    asLearner({ id: "learner-a" }, text);
    await expect(loadLineChunks(LINE)).resolves.toMatchObject({ kind: "ok" });
    expect(lineQueries).toHaveLength(1);

    // (a) no session: 401, the line is not even read.
    lineQueries = [];
    asLearner(null, text);
    const anonymous = await loadLineChunks(LINE);
    expect(anonymous).toEqual({ kind: "unauthorized" });
    expect(lineQueries).toHaveLength(0);

    // (b) learner B cannot read the line under RLS: 404 after exactly one read, no chunks.
    asLearner({ id: "learner-b" }, null);
    const stranger = await loadLineChunks(LINE);
    expect(stranger).toEqual({ kind: "not_found" });
    expect(lineQueries).toHaveLength(1);
  }, T);

  it("surfaces a read failure instead of reporting not_found", async () => {
    const error = { message: "database unavailable" };
    vi.mocked(createClient).mockReturnValue(createMockSupabase({
      user: { id: "a" }, tables: { transcript_lines: () => ({ data: null, error }) },
    }) as unknown as ReturnType<typeof createClient>);
    await expect(loadLineChunks(LINE)).rejects.toBe(error);
  });
});
