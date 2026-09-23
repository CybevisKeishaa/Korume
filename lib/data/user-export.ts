import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv/write";
import { USER_EXPORT_TABLES } from "@/lib/user-export/tables";

const EXPORT_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 };

export type ExportResult =
  | { ok: true; data: { exportedAt: string; userId: string; tables: Record<string, unknown[]> } }
  | { ok: false; status: 401 }
  | { ok: false; status: 429; retryAfter: number };

export type HistoryResult =
  | { ok: true; csv: string }
  | { ok: false; status: 401 }
  | { ok: false; status: 429; retryAfter: number };

/**
 * Every row the reader owns, one key per table (settings spec §4.6).
 *
 * Read through the RLS client, so the policies are a second floor under the
 * explicit filters — but the filters are what this function relies on, since
 * a unit test cannot see a policy (`L-005`).
 */
export async function exportMyData(now: Date = new Date()): Promise<ExportResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`export:${user.id}`, EXPORT_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const tables: Record<string, unknown[]> = {};

  for (const entry of USER_EXPORT_TABLES) {
    if (entry.userColumn) {
      const { data, error } = await supabase.from(entry.table).select("*").eq(entry.userColumn, user.id);
      if (error) throw error;
      tables[entry.table] = data ?? [];
      continue;
    }

    // A table with no owner column is scoped through its exported parent,
    // whose rows were already fetched above — the list is ordered so a parent
    // always precedes its children.
    const via = entry.via;
    if (!via) throw new Error(`${entry.table} has neither userColumn nor via`);
    const parentRows = (tables[via.parent] ?? []) as Record<string, unknown>[];
    const parentIds = parentRows.map((row) => row[via.parentKey]).filter((id) => id !== undefined);
    if (parentIds.length === 0) {
      tables[entry.table] = [];
      continue;
    }
    const { data, error } = await supabase.from(entry.table).select("*").in(via.column, parentIds);
    if (error) throw error;
    tables[entry.table] = data ?? [];
  }

  return { ok: true, data: { exportedAt: now.toISOString(), userId: user.id, tables } };
}

/**
 * One source of history rows: which table, what it means, and where its date,
 * label and detail come from.
 *
 * ⚠️ Every column here was read out of `supabase/migrations/` rather than
 * assumed. The plan called for "the four `user_*_progress` SRS tables, detail
 * = interval days"; there are **three**, none of them carries `interval_days`
 * (only `sentence_mining_cards` does, and it is out of this task's scope), and
 * `user_grammar_progress` records a mastery score against `last_practiced_at`
 * rather than an SRS review. The detail column reflects what each table has.
 */
const HISTORY_SOURCES = [
  {
    table: "user_video_progress",
    kind: "lesson",
    dateColumn: "completed_at",
    detailColumn: null,
    join: { select: "completed_at, videos ( title )", label: "videos", labelColumn: "title" },
  },
  {
    table: "user_kanji_progress",
    kind: "review",
    dateColumn: "last_reviewed_at",
    detailColumn: "srs_stage",
    join: { select: "last_reviewed_at, srs_stage, kanji ( character )", label: "kanji", labelColumn: "character" },
  },
  {
    table: "user_vocab_progress",
    kind: "review",
    dateColumn: "last_reviewed_at",
    detailColumn: "srs_stage",
    join: { select: "last_reviewed_at, srs_stage, vocab ( word )", label: "vocab", labelColumn: "word" },
  },
  {
    table: "user_grammar_progress",
    kind: "practice",
    dateColumn: "last_practiced_at",
    detailColumn: "mastery_score",
    join: {
      select: "last_practiced_at, mastery_score, grammar_points ( title )",
      label: "grammar_points",
      labelColumn: "title",
    },
  },
  {
    table: "user_badges",
    kind: "badge",
    dateColumn: "earned_at",
    detailColumn: null,
    join: { select: "earned_at, badges ( name )", label: "badges", labelColumn: "name" },
  },
] as const;

/** Lessons studied, reviews, practice and badges as one CSV, newest first. */
export async function myLearningHistoryCsv(now: Date = new Date()): Promise<HistoryResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`history:${user.id}`, EXPORT_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const rows: { date: string; kind: string; item: string; detail: string | number | null }[] = [];

  for (const source of HISTORY_SOURCES) {
    const { data, error } = await supabase
      .from(source.table)
      .select(source.join.select)
      .eq("user_id", user.id);
    if (error) throw error;

    for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
      const date = row[source.dateColumn];
      // A row the reader has not reached yet has no date, and a history line
      // with an empty date cannot be sorted or read. Skipped, not invented.
      if (typeof date !== "string") continue;
      const joined = row[source.join.label] as Record<string, unknown> | null;
      rows.push({
        date,
        kind: source.kind,
        item: String(joined?.[source.join.labelColumn] ?? ""),
        detail: source.detailColumn ? ((row[source.detailColumn] as number | null) ?? null) : null,
      });
    }
  }

  rows.sort((a, b) => b.date.localeCompare(a.date));

  return {
    ok: true,
    csv: toCsv(
      ["date", "kind", "item", "detail"],
      rows.map((row) => [row.date, row.kind, row.item, row.detail]),
    ),
  };
}
