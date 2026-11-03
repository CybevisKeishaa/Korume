// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { getKnownVocabAmong } from "@/lib/data/difficulty";
import { lineTextHash } from "@/lib/dictation/chunk";
import { LINE_ANSWER_LIMIT } from "@/lib/data/line-chunks";
import { DISTRACTOR_NEIGHBOURS } from "@/lib/data/line-cloze";
import { GET } from "./route";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/difficulty", () => ({ getKnownVocabAmong: vi.fn(async () => new Set<string>()) }));

// kuromoji dictionary load is slow under suite contention (lib/dictation/chunk.test.ts).
const T = 60000;
const LINE_ID = "a0000000-0000-0000-0000-000000000001";
let lineQueries: QueryCall[][];

/** The line sits at 10 s in transcript t1; `around` are the texts of the lines before / after it, nearest first. */
function asLearner(user: { id: string } | null, text: string | null, around: { before: string[]; after: string[] } = { before: [], after: [] }) {
  vi.mocked(createClient).mockReturnValue(createMockSupabase({
    user,
    tables: {
      transcript_lines: (calls) => {
        lineQueries.push(calls);
        const side = calls.some((c) => c.op === "lt") ? around.before : calls.some((c) => c.op === "gt") ? around.after : null;
        if (side) return { data: side.map((text_jp) => ({ text_jp })), error: null };
        return { data: text === null ? null : { text_jp: text, transcript_id: "t1", start_time: "10.000" }, error: null };
      },
    },
  }) as unknown as ReturnType<typeof createClient>);
}
const get = (lineId = LINE_ID) => GET(new Request(`http://localhost/api/lines/${lineId}/cloze`), { params: { lineId } });
async function expectPrivate(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  return response.json();
}

beforeEach(() => {
  vi.clearAllMocks();
  lineQueries = [];
});

describe("GET /api/lines/[lineId]/cloze", () => {
  it("rejects a malformed id without reading", async () => {
    await expect(expectPrivate(await get("nope"), 400)).resolves.toEqual({ error: "Invalid id" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("401 without a session, before the line read", async () => {
    asLearner(null, "泣いて勉強した");
    await expect(expectPrivate(await get(), 401)).resolves.toEqual({ error: "Unauthorized" });
    expect(lineQueries).toHaveLength(0);
  });

  it("404 when the learner cannot read the line", async () => {
    asLearner({ id: "u" }, null);
    await expect(expectPrivate(await get(), 404)).resolves.toEqual({ error: "Not found" });
    expect(getKnownVocabAmong).not.toHaveBeenCalled();
  });

  it("429 with Retry-After once the learner's budget is spent, before the line read", async () => {
    asLearner({ id: "spender" }, null);
    for (let i = 0; i < LINE_ANSWER_LIMIT.limit; i++) expect((await get()).status).toBe(404);
    lineQueries = [];
    const response = await get();
    await expect(expectPrivate(response, 429)).resolves.toEqual({ error: "Too many requests, slow down" });
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
    expect(lineQueries).toHaveLength(0);
  });

  it("500, generic, when the read fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(createClient).mockReturnValue(createMockSupabase({
      user: { id: "u" }, tables: { transcript_lines: () => ({ data: null, error: { message: "private database detail" } }) },
    }) as unknown as ReturnType<typeof createClient>);
    await expect(expectPrivate(await get(), 500)).resolves.toEqual({ error: "Something went wrong. Please try again." });
  });

  it("泣いて勉強した: one blank on 勉強 (泣いて never), segments cover the raw text, the blank's romaji is ___", async () => {
    const text = "泣いて勉強した";
    asLearner({ id: "u" }, text);
    const { data } = await expectPrivate(await get(), 200);
    expect(data).toEqual({
      version: 1,
      textHash: lineTextHash(text),
      blanks: [2],
      segments: [
        { text: "泣いて", blank: null, romaji: "nai te" },
        { text: "勉強", blank: 0, romaji: "___" },
        { text: "した", blank: null, romaji: "shi ta" },
      ],
      readings: ["べんきょう"],
      distractors: [],
    });
    expect(data.segments.map((s: { text: string }) => s.text).join("")).toBe(text);
    expect(lineQueries[0]).toContainEqual({ op: "eq", column: "id", value: LINE_ID });
  }, T);

  it("segments show the raw characters of a full-width line", async () => {
    const text = "毎日、日本語を勉強！";
    asLearner({ id: "u" }, text);
    const { data } = await expectPrivate(await get(), 200);
    expect(data.segments.map((s: { text: string }) => s.text).join("")).toBe(text);
  }, T);

  it("the learner's known words change which of two adjacent candidates is blanked", async () => {
    asLearner({ id: "u" }, "日本語勉強");
    expect((await expectPrivate(await get(), 200)).data.blanks).toEqual([0]);
    vi.mocked(getKnownVocabAmong).mockResolvedValueOnce(new Set(["日本語"]));
    const { data } = await expectPrivate(await get(), 200);
    expect(data.blanks).toEqual([1]);
    expect(data.readings).toEqual(["べんきょう"]);
    // Asked about this line's candidates only (lemma + hiragana reading), never the whole vocabulary (ultra review 3).
    expect(getKnownVocabAmong).toHaveBeenLastCalledWith(expect.anything(), "u", ["日本語", "にほんご", "勉強", "べんきょう"]);
  }, T);

  it("a line with no candidate has no blank and one plain segment, and reads no neighbour", async () => {
    asLearner({ id: "u" }, "それは", { before: ["料理を作る"], after: [] });
    const { data } = await expectPrivate(await get(), 200);
    expect(data).toMatchObject({ blanks: [], readings: [], distractors: [], segments: [{ text: "それは", blank: null }] });
    expect(lineQueries).toHaveLength(1);
    expect(getKnownVocabAmong).not.toHaveBeenCalled();
  }, T);

  it("distractors: the blank's kind from the nearby lines of the same transcript, nearest first, never a word of the line", async () => {
    asLearner({ id: "u" }, "泣いて勉強した", { before: ["駅で料理を勉強する", "毎日の練習"], after: ["英語の練習"] });
    const { data } = await expectPrivate(await get(), 200);
    expect(data.blanks).toEqual([2]);
    expect(data.distractors).toEqual(["料理", "練習"]);
    const [earlier, later] = [lineQueries[1], lineQueries[2]];
    for (const q of [earlier, later]) {
      expect(q).toContainEqual({ op: "eq", column: "transcript_id", value: "t1" });
      expect(q).toContainEqual(expect.objectContaining({ op: "limit", count: DISTRACTOR_NEIGHBOURS }));
    }
    expect(earlier).toContainEqual({ op: "lt", column: "start_time", value: 10 });
    expect(later).toContainEqual({ op: "gt", column: "start_time", value: 10 });
  }, T);

  it("a failed neighbour read still serves the blanks, without distractors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(createClient).mockReturnValue(createMockSupabase({
      user: { id: "u" },
      tables: {
        transcript_lines: (calls) => calls.some((c) => c.op === "lt" || c.op === "gt")
          ? { data: null, error: { message: "neighbour read failed" } }
          : { data: { text_jp: "泣いて勉強した", transcript_id: "t1", start_time: "10.000" }, error: null },
      },
    }) as unknown as ReturnType<typeof createClient>);
    const { data } = await expectPrivate(await get(), 200);
    expect(data).toMatchObject({ blanks: [2], readings: ["べんきょう"], distractors: [] });
    expect(console.error).toHaveBeenCalled();
  }, T);
});
