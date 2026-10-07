import "server-only";
import { getActiveSnapshotId } from "@/lib/dictionary/snapshot";
import { createClient } from "@/lib/supabase/server";
import type { StrokeGuide } from "./types";

const NUMBER = String.raw`(-?(?:\d+\.?\d*|\.\d+))`;
const START = new RegExp(String.raw`^\s*[Mm]\s*${NUMBER}\s*,?\s*${NUMBER}`);

/** The first move of a sanitised KanjiVG path; the renderer never infers a stroke's start. */
export function strokeStart(d: string): [number, number] | null {
  const match = START.exec(d);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

/** Spec W §1.1: one batched read of the active snapshot; a character without a row is absent. */
export async function getStrokeGuides(characters: string[]): Promise<Record<string, StrokeGuide>> {
  const unique = [...new Set(characters)];
  if (unique.length === 0) return {};
  const snapshotId = await getActiveSnapshotId();
  if (!snapshotId) return {};
  const { data, error } = await createClient()
    .from("dict_kanji_strokes")
    .select("literal, paths")
    .eq("snapshot_id", snapshotId)
    .in("literal", unique);
  if (error) throw error;
  return Object.fromEntries(((data ?? []) as { literal: string; paths: string[] }[]).map((row) => [row.literal, {
    character: row.literal,
    viewBox: 109 as const,
    strokes: row.paths.map((d) => ({ d, start: strokeStart(d) })),
  }]));
}
