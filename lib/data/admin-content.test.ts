import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, eqValue, type QueryCall } from "@/test/supabase-mock";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin/guard";

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/admin/guard", () => ({ requireAdmin: vi.fn() }));

// Imported after the mocks above are registered.
import { createContent, deleteContent, importContentCsv, listContent, updateContent } from "./admin-content";

const ADMIN = { id: "admin-1", email: "admin@example.com" };
const KANJI_ID = "a0000000-0000-0000-0000-000000000001";

function mockService(tables: Parameters<typeof createMockSupabase>[0]["tables"]) {
  const supabase = createMockSupabase({ tables });
  vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>);
  return supabase;
}

beforeEach(() => {
  vi.mocked(createServiceClient).mockReset();
  vi.mocked(requireAdmin).mockReset();
  vi.mocked(requireAdmin).mockResolvedValue({ ok: true, user: ADMIN });
});

describe("listContent", () => {
  it("passes through a guard failure", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 403 });
    const result = await listContent("kanji", {});
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it("lists rows, defaulting to page 1 / pageSize 20, with hasMore false when under a page", async () => {
    mockService({
      kanji: (calls: QueryCall[]) => {
        const rangeCall = calls.find((c): c is Extract<QueryCall, { op: "range" }> => c.op === "range");
        expect(rangeCall).toEqual({ op: "range", from: 0, to: 20 });
        return { data: [{ id: KANJI_ID, character: "水" }], error: null };
      },
    });
    const result = await listContent("kanji", {});
    expect(result).toEqual({ ok: true, data: { items: [{ id: KANJI_ID, character: "水" }], page: 1, pageSize: 20, hasMore: false } });
  });

  it("sets hasMore true and trims to pageSize when more rows come back than requested", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({ id: `k${i}` }));
    mockService({ kanji: () => ({ data: rows, error: null }) });
    const result = await listContent("kanji", { pageSize: 2 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toHaveLength(2);
    expect(result.data.hasMore).toBe(true);
  });

  it("applies search via ilike on the type's search column", async () => {
    mockService({
      kanji: (calls: QueryCall[]) => {
        const ilikeCall = calls.find((c): c is Extract<QueryCall, { op: "ilike" }> => c.op === "ilike");
        expect(ilikeCall).toEqual({ op: "ilike", column: "character", pattern: "%水%" });
        return { data: [], error: null };
      },
    });
    await listContent("kanji", { search: "水" });
  });

  it("does not call ilike when search is absent", async () => {
    mockService({
      kanji: (calls: QueryCall[]) => {
        expect(calls.some((c) => c.op === "ilike")).toBe(false);
        return { data: [], error: null };
      },
    });
    await listContent("kanji", {});
  });
});

describe("createContent", () => {
  it("passes through a guard failure", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 401 });
    const result = await createContent("kanji", { character: "水" });
    expect(result).toEqual({ ok: false, status: 401 });
  });

  it("returns 400 with field errors for invalid input", async () => {
    const result = await createContent("kanji", { jlpt_level: "N5" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
  });

  it("creates a kanji row, sanitizes free text, inserts child readings, and returns the detail row", async () => {
    let insertedMain: unknown;
    let insertedReadings: unknown;
    mockService({
      kanji: (calls: QueryCall[]) => {
        const insertCall = calls.find((c): c is Extract<QueryCall, { op: "insert" }> => c.op === "insert");
        if (insertCall) {
          insertedMain = insertCall.values;
          return { data: { id: KANJI_ID }, error: null };
        }
        // Final re-fetch for the detail response.
        return { data: { id: KANJI_ID, character: "水", meaning_en: "water" }, error: null };
      },
      kanji_readings: (calls: QueryCall[]) => {
        const insertCall = calls.find((c): c is Extract<QueryCall, { op: "insert" }> => c.op === "insert");
        insertedReadings = insertCall?.values;
        return { data: null, error: null };
      },
    });

    const result = await createContent("kanji", {
      character: "水",
      meaning_en: "  water  <b>bold</b>",
      readings: [{ reading: "みず", reading_type: "kun" }],
    });

    expect(result).toEqual({ ok: true, data: { id: KANJI_ID, character: "水", meaning_en: "water" } });
    expect(insertedMain).toEqual({ character: "水", meaning_en: "water bold" });
    expect(insertedReadings).toEqual([{ reading: "みず", reading_type: "kun", kanji_id: KANJI_ID }]);
  });

  it("sanitizes grammar example_sentences (nested jp/en text)", async () => {
    let insertedMain: unknown;
    mockService({
      grammar_points: (calls: QueryCall[]) => {
        const insertCall = calls.find((c): c is Extract<QueryCall, { op: "insert" }> => c.op === "insert");
        if (insertCall) {
          insertedMain = insertCall.values;
          return { data: { id: "g1" }, error: null };
        }
        return { data: { id: "g1" }, error: null };
      },
    });

    await createContent("grammar", {
      title: "<script>x</script>Test",
      example_sentences: [{ jp: "食べて<b>しまった</b>。", en: "I ate <i>it</i>." }],
    });

    // Tag-stripping removes markup delimiters, not their inner text content
    // (matches the established sanitizeTranscriptText contract — the app
    // never renders via dangerouslySetInnerHTML, so leftover inert text is
    // harmless) — "<script>x</script>Test" -> "xTest".
    expect(insertedMain).toEqual({
      title: "xTest",
      example_sentences: [{ jp: "食べてしまった。", en: "I ate it." }],
    });
  });
});

describe("updateContent", () => {
  it("passes through a guard failure", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 403 });
    const result = await updateContent("kanji", KANJI_ID, { meaning_en: "water" });
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it("returns 404 when the row does not exist", async () => {
    mockService({ kanji: () => ({ data: null, error: null }) });
    const result = await updateContent("kanji", KANJI_ID, { meaning_en: "water" });
    expect(result).toEqual({ ok: false, status: 404 });
  });

  it("updates only the given scalar fields and leaves child rows untouched when omitted", async () => {
    let updatedValues: unknown;
    mockService({
      kanji: (calls: QueryCall[]) => {
        const updateCall = calls.find((c): c is Extract<QueryCall, { op: "update" }> => c.op === "update");
        if (updateCall) {
          updatedValues = updateCall.values;
          expect(eqValue(calls, "id")).toBe(KANJI_ID);
          return { data: { id: KANJI_ID }, error: null };
        }
        return { data: { id: KANJI_ID, meaning_en: "water" }, error: null };
      },
      kanji_readings: () => {
        throw new Error("must not touch kanji_readings when readings is omitted");
      },
    });

    const result = await updateContent("kanji", KANJI_ID, { meaning_en: "water" });
    expect(result.ok).toBe(true);
    expect(updatedValues).toEqual({ meaning_en: "water" });
  });

  it("replaces child rows (delete then insert) when the child key is explicitly provided", async () => {
    let deletedParent: unknown;
    let insertedReadings: unknown;
    mockService({
      kanji: () => ({ data: { id: KANJI_ID }, error: null }),
      kanji_readings: (calls: QueryCall[]) => {
        const deleteCall = calls.find((c) => c.op === "delete");
        const insertCall = calls.find((c): c is Extract<QueryCall, { op: "insert" }> => c.op === "insert");
        if (deleteCall) {
          deletedParent = eqValue(calls, "kanji_id");
          return { data: null, error: null };
        }
        if (insertCall) {
          insertedReadings = insertCall.values;
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });

    const result = await updateContent("kanji", KANJI_ID, { readings: [{ reading: "すい", reading_type: "on" }] });
    expect(result.ok).toBe(true);
    expect(deletedParent).toBe(KANJI_ID);
    expect(insertedReadings).toEqual([{ reading: "すい", reading_type: "on", kanji_id: KANJI_ID }]);
  });

  it("clears child rows when given an empty array", async () => {
    let insertCalled = false;
    mockService({
      kanji: () => ({ data: { id: KANJI_ID }, error: null }),
      kanji_readings: (calls: QueryCall[]) => {
        if (calls.some((c) => c.op === "insert")) insertCalled = true;
        return { data: null, error: null };
      },
    });

    const result = await updateContent("kanji", KANJI_ID, { readings: [] });
    expect(result.ok).toBe(true);
    expect(insertCalled).toBe(false);
  });

  it("returns 400 for invalid input", async () => {
    const result = await updateContent("kanji", KANJI_ID, { jlpt_level: "N9" });
    expect(result).toEqual(expect.objectContaining({ ok: false, status: 400 }));
  });
});

describe("deleteContent", () => {
  it("passes through a guard failure", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 401 });
    const result = await deleteContent("kanji", KANJI_ID);
    expect(result).toEqual({ ok: false, status: 401 });
  });

  it("returns 404 when the row does not exist", async () => {
    mockService({ kanji: () => ({ data: null, error: null }) });
    const result = await deleteContent("kanji", KANJI_ID);
    expect(result).toEqual({ ok: false, status: 404 });
  });

  it("deletes the row (child rows cascade via FK, no explicit child delete needed)", async () => {
    mockService({
      kanji: (calls: QueryCall[]) => {
        expect(calls.some((c) => c.op === "delete")).toBe(true);
        expect(eqValue(calls, "id")).toBe(KANJI_ID);
        return { data: { id: KANJI_ID }, error: null };
      },
    });
    const result = await deleteContent("kanji", KANJI_ID);
    expect(result).toEqual({ ok: true });
  });
});

describe("importContentCsv", () => {
  it("passes through a guard failure", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 403 });
    const result = await importContentCsv("vocab", "word,reading\n猫,ねこ");
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it("returns 400 for an empty CSV body", async () => {
    const result = await importContentCsv("vocab", "");
    expect(result).toEqual(expect.objectContaining({ ok: false, status: 400 }));
  });

  it("inserts valid rows and reports validation failures per row, allowing partial success", async () => {
    const inserted: unknown[] = [];
    mockService({
      vocab: (calls: QueryCall[]) => {
        const insertCall = calls.find((c): c is Extract<QueryCall, { op: "insert" }> => c.op === "insert");
        if (insertCall) inserted.push(insertCall.values);
        return { data: { id: "v1" }, error: null };
      },
    });

    // Row 1 valid, row 2 missing required `word`.
    const csv = "word,reading\n猫,ねこ\n,いぬ";
    const result = await importContentCsv("vocab", csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.inserted).toBe(1);
    expect(result.data.failed).toHaveLength(1);
    expect(result.data.failed[0]?.row).toBe(2);
    expect(inserted).toHaveLength(1);
  });

  it("reports a per-row DB error without failing the whole batch", async () => {
    let call = 0;
    mockService({
      vocab: (calls: QueryCall[]) => {
        const insertCall = calls.find((c): c is Extract<QueryCall, { op: "insert" }> => c.op === "insert");
        if (insertCall) {
          call += 1;
          if (call === 2) return { data: null, error: { message: "duplicate key" } };
          return { data: { id: `v${call}` }, error: null };
        }
        return { data: null, error: null };
      },
    });

    const csv = "word,reading\n猫,ねこ\n犬,いぬ\n鳥,とり";
    const result = await importContentCsv("vocab", csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.inserted).toBe(2);
    expect(result.data.failed).toEqual([{ row: 2, errors: ["duplicate key"] }]);
  });
});
