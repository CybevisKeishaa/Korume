import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getKanjiList } from "@/lib/data/content";
import { getActiveSnapshotId } from "@/lib/dictionary/snapshot";
import { parseKanjiLiteral } from "@/lib/dictionary/literal";
import type { JlptLevel } from "@/lib/validation/content";

export interface KanjiReviewCard {
  literal: string;
  hanViet: string[];
  meaningsEn: string[];
  meaningVi: string | null;
  on: string[];
  kun: string[];
  level: string | null;
  /** No progress row yet: the learner meets this kanji for the first time. */
  isNew: boolean;
}

/** Literals per `in` lookup: 100 kanji keep the request line far inside its ~8 KB budget (see user-export.ts). */
const DICT_CHUNK_SIZE = 100;

interface DictKanjiRow {
  literal: string;
  vi_readings: string[];
  meanings_en: string[];
  on_readings: string[];
  kun_readings: string[];
}

/**
 * The kanji review deck (spec §4.3). No `level` ("Ôn tập hôm nay"): every due progress row of the user, any literal,
 * soonest first, then never-seen curated kanji in stroke order. With `level`: that level's curated kanji, due first,
 * then fresh. `focus` always comes first, once, whatever its schedule or level. Rows scheduled in the future are held
 * back. Cards come from the active snapshot's `dict_kanji` plus curated `meaning_vi`/`jlpt_level`; a literal the
 * snapshot lacks has no card (it could not be rated either: `submitReview` checks the same snapshot).
 */
export async function getKanjiReviewQueue({
  level,
  focus,
  limit = 20,
  now = new Date(),
}: { level?: JlptLevel; focus?: string; limit?: number; now?: Date } = {}): Promise<KanjiReviewCard[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [snapshotId, curated] = await Promise.all([getActiveSnapshotId(), getKanjiList()]);
  if (!snapshotId) return [];

  // literal -> scheduled time (ms); an unscheduled row is due now (0).
  const scheduledAt = new Map<string, number>();
  if (user) {
    const { data, error } = await supabase.from("user_kanji_progress").select("literal, next_review_at").eq("user_id", user.id);
    if (error) throw error;
    for (const row of (data ?? []) as { literal: string; next_review_at: string | null }[]) {
      scheduledAt.set(row.literal, row.next_review_at ? new Date(row.next_review_at).getTime() : 0);
    }
  }

  const curatedBy = new Map(curated.map((k) => [k.character, k]));
  const inDeck = (literal: string) => !level || curatedBy.get(literal)?.jlpt_level === level;
  const due = Array.from(scheduledAt)
    .filter(([literal, at]) => at <= now.getTime() && inDeck(literal))
    .sort((a, b) => a[1] - b[1])
    .map(([literal]) => literal);
  const fresh = curated.map((k) => k.character).filter((literal) => inDeck(literal) && !scheduledAt.has(literal));
  const focusLiteral = focus ? parseKanjiLiteral(focus) : null;
  const literals = Array.from(new Set([...(focusLiteral ? [focusLiteral] : []), ...due, ...fresh])).slice(0, limit);

  const chunks: string[][] = [];
  for (let start = 0; start < literals.length; start += DICT_CHUNK_SIZE) chunks.push(literals.slice(start, start + DICT_CHUNK_SIZE));
  const results = await Promise.all(
    chunks.map((chunk) =>
      supabase
        .from("dict_kanji")
        .select("literal, vi_readings, meanings_en, on_readings, kun_readings")
        .eq("snapshot_id", snapshotId)
        .in("literal", chunk),
    ),
  );
  const dictBy = new Map<string, DictKanjiRow>();
  for (const { data, error } of results) {
    if (error) throw error;
    for (const row of (data ?? []) as DictKanjiRow[]) dictBy.set(row.literal, row);
  }

  return literals.flatMap((literal) => {
    const row = dictBy.get(literal);
    if (!row) return [];
    const curatedRow = curatedBy.get(literal);
    return [{
      literal,
      hanViet: row.vi_readings,
      meaningsEn: row.meanings_en,
      meaningVi: curatedRow?.meaning_vi ?? null,
      on: row.on_readings,
      kun: row.kun_readings,
      level: curatedRow?.jlpt_level ?? null,
      isNew: !scheduledAt.has(literal),
    }];
  });
}
