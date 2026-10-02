import type { SupabaseClient } from "@supabase/supabase-js";
import type { JmdictEntryRow } from "./jmdict";
import type { KanjidicRow } from "./kanjidic";
import type { KanjivgRow } from "./kanjivg";
import { rankKanjiWords, type KanjiWordCandidate } from "./kanji-words";

export interface SourceMeta {
  version: string;
  url: string;
  license: string;
  sha256: string;
}

interface Source<Row> {
  meta: SourceMeta;
  rows: () => AsyncIterable<Row>;
}

export interface ImportSources {
  jmdict: Source<JmdictEntryRow>;
  kanjidic: Source<KanjidicRow>;
  kanjivg: Source<KanjivgRow>;
}

export type ImportResult =
  | { status: "no-change" }
  | {
      status: "activated";
      snapshotId: string;
      counts: { jmdict: number; kanjidic: number; kanjivg: number; kanjiWords: number };
    };

/** The staging snapshot is kept for diagnosis; the active snapshot was never touched. */
export class StagingImportError extends Error {
  constructor(
    readonly snapshotId: string | null,
    cause: unknown,
  ) {
    super(`dictionary import failed (staging snapshot ${snapshotId ?? "none"}): ${(cause as Error)?.message ?? cause}`);
    this.name = "StagingImportError";
  }
}

const KANJI_WORDS_PER_LITERAL = 30;

function fail(what: string, error: { message: string } | null): void {
  if (error) throw new Error(`${what}: ${error.message}`);
}

async function activeHashes(client: SupabaseClient): Promise<string[] | null> {
  const { data: snapshot, error } = await client
    .from("dict_snapshots")
    .select("jmdict_import_id, kanjidic_import_id, kanjivg_import_id")
    .eq("status", "active")
    .maybeSingle();
  fail("read active snapshot", error);
  if (!snapshot) return null;
  const ids = [snapshot.jmdict_import_id, snapshot.kanjidic_import_id, snapshot.kanjivg_import_id] as string[];
  const { data: imports, error: importsError } = await client.from("dict_imports").select("id, file_sha256").in("id", ids);
  fail("read active imports", importsError);
  const byId = new Map((imports ?? []).map((row) => [row.id as string, row.file_sha256 as string]));
  return ids.map((id) => byId.get(id) ?? "");
}

async function insertBatched<Row>(
  client: SupabaseClient,
  table: string,
  rows: AsyncIterable<Row>,
  toRecord: (row: Row) => Record<string, unknown>,
  batchSize: number,
  onRow?: (row: Row) => void,
): Promise<number> {
  let batch: Record<string, unknown>[] = [];
  let count = 0;
  const flush = async () => {
    if (batch.length === 0) return;
    const { error } = await client.from(table).insert(batch);
    fail(`insert ${table}`, error);
    batch = [];
  };
  for await (const row of rows) {
    onRow?.(row);
    batch.push(toRecord(row));
    count += 1;
    if (batch.length >= batchSize) await flush();
  }
  await flush();
  return count;
}

/**
 * Imports the three sources into a new staging snapshot and activates it. Identical file hashes to the
 * active snapshot → no-op. Every source is streamed; the only per-import state is a bounded top-N list of
 * kanji words per KANJIDIC literal.
 */
export async function importDictionaries(
  client: SupabaseClient,
  sources: ImportSources,
  options: { batchSize?: number; log?: (line: string) => void } = {},
): Promise<ImportResult> {
  const batchSize = options.batchSize ?? 1000;
  const log = options.log ?? (() => undefined);
  const wanted = [sources.jmdict.meta.sha256, sources.kanjidic.meta.sha256, sources.kanjivg.meta.sha256];
  const current = await activeHashes(client);
  if (current && current.every((hash, index) => hash === wanted[index])) return { status: "no-change" };

  // entry_count is provisional until each source has been streamed; it is set before activation.
  const { data: imports, error: importError } = await client
    .from("dict_imports")
    .insert(
      (
        [
          ["jmdict", sources.jmdict.meta],
          ["kanjidic2", sources.kanjidic.meta],
          ["kanjivg", sources.kanjivg.meta],
        ] as const
      ).map(([source, meta]) => ({
        source,
        source_version: meta.version,
        source_url: meta.url,
        license: meta.license,
        file_sha256: meta.sha256,
        entry_count: 1,
      })),
    )
    .select("id");
  fail("insert dict_imports", importError);
  const [jmdictImport, kanjidicImport, kanjivgImport] = (imports ?? []).map((row) => row.id as string);

  const { data: staged, error: stageError } = await client.rpc("dict_stage_snapshot", {
    p_jmdict: jmdictImport,
    p_kanjidic: kanjidicImport,
    p_kanjivg: kanjivgImport,
  });
  fail("dict_stage_snapshot", stageError);
  const snapshotId = staged as string;
  log(`staging snapshot ${snapshotId}`);

  try {
    const literals = new Set<string>();
    const kanjidic = await insertBatched(
      client,
      "dict_kanji",
      sources.kanjidic.rows(),
      (row) => ({
        snapshot_id: snapshotId,
        literal: row.literal,
        on_readings: row.on,
        kun_readings: row.kun,
        meanings_en: row.meaningsEn,
        stroke_count: row.strokeCount,
        grade: row.grade,
        freq: row.freq,
        jlpt_old: row.jlptOld,
      }),
      batchSize,
      (row) => literals.add(row.literal),
    );
    log(`kanjidic2 ${kanjidic}`);

    const kanjivg = await insertBatched(
      client,
      "dict_kanji_strokes",
      sources.kanjivg.rows(),
      (row) => ({ snapshot_id: snapshotId, literal: row.literal, paths: row.paths, components: row.components }),
      batchSize,
    );
    log(`kanjivg ${kanjivg}`);

    const candidates = new Map<string, KanjiWordCandidate[]>();
    const jmdict = await insertBatched(
      client,
      "dict_entries",
      sources.jmdict.rows(),
      (row) => ({
        snapshot_id: snapshotId,
        ent_seq: row.entSeq,
        kanji_forms: row.kanjiForms,
        kana_forms: row.kanaForms,
        senses: row.senses,
        common: row.common,
      }),
      batchSize,
      (row) => {
        const seen = new Set<string>();
        for (const form of row.kanjiForms) {
          for (const literal of form) {
            if (!literals.has(literal) || seen.has(literal)) continue;
            seen.add(literal);
            const list = candidates.get(literal) ?? [];
            list.push({ entSeq: row.entSeq, kanjiForms: row.kanjiForms, common: row.common });
            // Keep the list bounded: prune to the top N whenever it grows past 4N.
            if (list.length > KANJI_WORDS_PER_LITERAL * 4) {
              const keep = new Set(rankKanjiWords(literal, list, KANJI_WORDS_PER_LITERAL));
              candidates.set(literal, list.filter((candidate) => keep.has(candidate.entSeq)));
            } else {
              candidates.set(literal, list);
            }
          }
        }
      },
    );
    log(`jmdict ${jmdict}`);

    async function* kanjiWordRows() {
      for (const [literal, list] of candidates) {
        const ranked = rankKanjiWords(literal, list, KANJI_WORDS_PER_LITERAL);
        for (const [index, entSeq] of ranked.entries()) yield { literal, entSeq, rank: index + 1 };
      }
    }
    const kanjiWords = await insertBatched(
      client,
      "dict_kanji_words",
      kanjiWordRows(),
      (row) => ({ snapshot_id: snapshotId, literal: row.literal, ent_seq: row.entSeq, rank: row.rank }),
      batchSize,
    );
    log(`kanji words ${kanjiWords}`);

    for (const [id, count] of [
      [jmdictImport, jmdict],
      [kanjidicImport, kanjidic],
      [kanjivgImport, kanjivg],
    ] as const) {
      const { error } = await client.from("dict_imports").update({ entry_count: count }).eq("id", id);
      fail("update entry_count", error);
    }

    const { error: activateError } = await client.rpc("dict_activate_snapshot", { p_snapshot: snapshotId });
    fail("dict_activate_snapshot", activateError);
    return { status: "activated", snapshotId, counts: { jmdict, kanjidic, kanjivg, kanjiWords } };
  } catch (error) {
    throw new StagingImportError(snapshotId, error);
  }
}
