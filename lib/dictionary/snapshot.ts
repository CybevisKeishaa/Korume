import "server-only";
import * as React from "react";
import { createClient } from "@/lib/supabase/server";
import type { DictionaryAttribution } from "@/lib/dictionary/types";

// React's server build exports cache(); the client build vitest loads does not, so tests run uncached.
const cache: <T extends (...args: never[]) => unknown>(fn: T) => T =
  (React as { cache?: <T>(fn: T) => T }).cache ?? ((fn) => fn);

/** The active dictionary snapshot, read once per request. `null` before the first import. */
export const getActiveSnapshotId = cache(async (): Promise<string | null> => {
  const { data, error } = await createClient().rpc("dict_active_snapshot_id");
  if (error) throw error;
  return (data as string | null) ?? null;
});

const SOURCE_ORDER: DictionaryAttribution["source"][] = ["jmdict", "kanjidic2", "kanjivg"];
/** A snapshot never changes once staged, so its attribution is cached for the process lifetime. */
const attributionBySnapshot = new Map<string, DictionaryAttribution[]>();

export async function getDictionaryAttribution(snapshotId: string): Promise<DictionaryAttribution[]> {
  const cached = attributionBySnapshot.get(snapshotId);
  if (cached) return cached;
  const supabase = createClient();
  const { data: snapshot, error } = await supabase
    .from("dict_snapshots")
    .select("jmdict_import_id, kanjidic_import_id, kanjivg_import_id")
    .eq("id", snapshotId)
    .maybeSingle();
  if (error) throw error;
  if (!snapshot) return [];
  const ids = [snapshot.jmdict_import_id, snapshot.kanjidic_import_id, snapshot.kanjivg_import_id] as string[];
  const { data: imports, error: importsError } = await supabase
    .from("dict_imports")
    .select("id, source, source_version, source_url, license")
    .in("id", ids);
  if (importsError) throw importsError;
  const attribution = ((imports ?? []) as { source: DictionaryAttribution["source"]; source_version: string; source_url: string; license: string }[])
    .map((row) => ({ source: row.source, version: row.source_version, url: row.source_url, license: row.license }))
    .sort((a, b) => SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source));
  attributionBySnapshot.set(snapshotId, attribution);
  return attribution;
}
