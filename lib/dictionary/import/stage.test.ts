import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { importDictionaries, StagingImportError, type ImportSources } from "./stage";
import type { JmdictEntryRow } from "./jmdict";
import type { KanjidicRow } from "./kanjidic";
import type { KanjivgRow } from "./kanjivg";

type Call = { op: string; table?: string; rows?: unknown[]; args?: unknown; values?: unknown };

/** Records every write; serves the active snapshot's import hashes from `active`. */
function fakeClient(active: Record<string, string> | null) {
  const calls: Call[] = [];
  let nextId = 0;
  const client = {
    from(table: string) {
      return {
        insert(rows: unknown[]) {
          calls.push({ op: "insert", table, rows });
          const ids = rows.map(() => `${table}-${++nextId}`);
          const result = { data: null, error: null };
          return Object.assign(Promise.resolve(result), {
            select: () => Promise.resolve({ data: ids.map((id) => ({ id })), error: null }),
          });
        },
        update(values: unknown) {
          return {
            eq: (_column: string, id: unknown) => {
              calls.push({ op: "update", table, values, args: id });
              return Promise.resolve({ error: null });
            },
          };
        },
        select() {
          if (table === "dict_snapshots") {
            return {
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: active ? { jmdict_import_id: "j", kanjidic_import_id: "k", kanjivg_import_id: "v" } : null,
                    error: null,
                  }),
              }),
            };
          }
          return {
            in: () =>
              Promise.resolve({
                data: active
                  ? [
                      { id: "j", file_sha256: active.jmdict },
                      { id: "k", file_sha256: active.kanjidic },
                      { id: "v", file_sha256: active.kanjivg },
                    ]
                  : [],
                error: null,
              }),
          };
        },
      };
    },
    rpc(name: string, args: unknown) {
      calls.push({ op: "rpc", args: { name, args } });
      return Promise.resolve({ data: name === "dict_stage_snapshot" ? "snap-1" : null, error: null });
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

async function* of<T>(rows: T[], failAfter = Number.POSITIVE_INFINITY) {
  let index = 0;
  for (const row of rows) {
    if (index++ >= failAfter) throw new Error("parse error in the middle");
    yield row;
  }
}

const meta = (sha256: string) => ({ version: "v", url: "https://example.invalid", license: "CC BY-SA", sha256 });

const ENTRIES: JmdictEntryRow[] = [
  { entSeq: 1, kanjiForms: ["緑"], kanaForms: ["みどり"], senses: [], common: true },
  { entSeq: 2, kanjiForms: ["苦手"], kanaForms: ["にがて"], senses: [], common: true },
  { entSeq: 3, kanjiForms: ["新緑"], kanaForms: ["しんりょく"], senses: [], common: false },
];
const KANJI: KanjidicRow[] = [
  { literal: "緑", on: ["リョク"], kun: ["みどり"], meaningsEn: ["green"], strokeCount: 14, grade: 3, freq: 1082, jlptOld: 2 },
];
const STROKES: KanjivgRow[] = [{ literal: "緑", paths: ["M1,1"], components: { element: "緑", position: null, children: [] } }];

function sources(failJmdictAfter?: number): ImportSources {
  return {
    jmdict: { meta: meta("J"), rows: () => of(ENTRIES, failJmdictAfter) },
    kanjidic: { meta: meta("K"), rows: () => of(KANJI) },
    kanjivg: { meta: meta("V"), rows: () => of(STROKES) },
  };
}

describe("importDictionaries", () => {
  it("is a no-op when all three files match the active snapshot", async () => {
    const { client, calls } = fakeClient({ jmdict: "J", kanjidic: "K", kanjivg: "V" });
    await expect(importDictionaries(client, sources())).resolves.toEqual({ status: "no-change" });
    expect(calls).toEqual([]);
  });

  it("stages in batches, ranks kanji words for KANJIDIC literals, records counts, then activates last", async () => {
    const { client, calls } = fakeClient({ jmdict: "OLD", kanjidic: "K", kanjivg: "V" });
    const result = await importDictionaries(client, sources(), { batchSize: 2 });
    expect(result).toEqual({
      status: "activated",
      snapshotId: "snap-1",
      counts: { jmdict: 3, kanjidic: 1, kanjivg: 1, kanjiWords: 2 },
    });
    const entryBatches = calls.filter((call) => call.table === "dict_entries").map((call) => call.rows?.length);
    expect(entryBatches).toEqual([2, 1]);
    const words = calls.find((call) => call.table === "dict_kanji_words")?.rows;
    expect(words).toEqual([
      { snapshot_id: "snap-1", literal: "緑", ent_seq: 1, rank: 1 },
      { snapshot_id: "snap-1", literal: "緑", ent_seq: 3, rank: 2 },
    ]);
    const counts = calls.filter((call) => call.op === "update").map((call) => call.values);
    expect(counts).toEqual([{ entry_count: 3 }, { entry_count: 1 }, { entry_count: 1 }]);
    expect(calls.at(-1)).toEqual({ op: "rpc", args: { name: "dict_activate_snapshot", args: { p_snapshot: "snap-1" } } });
  });

  it("leaves the staging snapshot and never activates when a source fails", async () => {
    const { client, calls } = fakeClient(null);
    const failure = await importDictionaries(client, sources(1)).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(StagingImportError);
    expect((failure as StagingImportError).snapshotId).toBe("snap-1");
    expect(calls.some((call) => (call.args as { name?: string })?.name === "dict_activate_snapshot")).toBe(false);
  });
});
