// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { getKnownVocabLemmas } from "@/lib/data/difficulty";
import { lineTextHash } from "@/lib/dictation/chunk";
import { GET } from "./route";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/difficulty", () => ({ getKnownVocabLemmas: vi.fn(async () => new Set<string>()) }));

// kuromoji dictionary load is slow under suite contention (lib/dictation/chunk.test.ts).
const T = 60000;
const LINE_ID = "a0000000-0000-0000-0000-000000000001";
let lineQueries: QueryCall[][];

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
    expect(getKnownVocabLemmas).not.toHaveBeenCalled();
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
    vi.mocked(getKnownVocabLemmas).mockResolvedValueOnce(new Set(["日本語"]));
    const { data } = await expectPrivate(await get(), 200);
    expect(data.blanks).toEqual([1]);
    expect(data.readings).toEqual(["べんきょう"]);
    expect(getKnownVocabLemmas).toHaveBeenLastCalledWith(expect.anything(), "u");
  }, T);

  it("a line with no candidate has no blank and one plain segment", async () => {
    asLearner({ id: "u" }, "それは");
    const { data } = await expectPrivate(await get(), 200);
    expect(data).toMatchObject({ blanks: [], readings: [], segments: [{ text: "それは", blank: null }] });
  }, T);
});
