import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv/write";
import { USER_EXPORT_TABLES } from "@/lib/user-export/tables";

const EXPORT_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 };
/** Matches `supabase/config.toml`'s `max_rows`, so every query can detect its cap. */
export const EXPORT_PAGE_SIZE = 1_000;
/** 100 UUIDs x ~37 bytes leaves over 4 KB of the ~8 KB request-line budget for query overhead. */
const PARENT_ID_CHUNK_SIZE = 100;

export const PRIMARY_KEY_COLUMNS: Record<string, readonly string[]> = {
  users: ["id"],
  user_preferences: ["user_id"],
  user_stats: ["user_id"],
  user_badges: ["user_id", "badge_id"],
  xp_events: ["id"],
  user_kanji_progress: ["user_id", "kanji_id"],
  user_vocab_progress: ["user_id", "vocab_id"],
  user_grammar_progress: ["user_id", "grammar_id"],
  user_reading_attempts: ["id"],
  user_test_attempts: ["id"],
  user_video_progress: ["user_id", "video_id"],
  user_lesson_library: ["user_id", "lesson_id"],
  user_playlists: ["id"],
  user_playlist_items: ["playlist_id", "video_id"],
  sentence_mining_cards: ["id"],
  shadowing_sessions: ["id"],
  dictation_attempts: ["id"],
  companion_memories: ["id"],
  conversation_sessions: ["id"],
  conversation_messages: ["id"],
  notifications: ["id"],
  forum_posts: ["id"],
  forum_comments: ["id"],
  peer_reviews: ["id"],
  peer_review_shares: ["id"],
  subscriptions: ["id"],
  account_deletion_requests: ["id"],
  lesson_creation_jobs: ["id"],
  lesson_creation_job_events: ["id"],
};

type PagedResult<T> = { data: T[] | null; error: unknown };

/**
 * Every row the query matches, read in pages.
 *
 * ⚠️ Stops only on an EMPTY page, never on a short one. A short page looks
 * like the end but is also exactly what a server whose row cap is BELOW
 * `EXPORT_PAGE_SIZE` returns for a full one — and stopping there would ship a
 * silently truncated GDPR export with a 200, which is the whole defect this
 * function exists to remove. Costs one extra round trip per query and makes
 * the loop independent of what the deployment's cap actually is.
 */
async function fetchAllPages<T>(fetchPage: (from: number, to: number) => Promise<PagedResult<T>>): Promise<T[]> {
  let rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await fetchPage(from, from + EXPORT_PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    if (page.length === 0) return rows;
    // `concat`, not `push(...page)`: spreading goes through `Function.apply`,
    // which throws `RangeError: Maximum call stack size exceeded` past ~100k
    // elements — reachable for one account's `conversation_messages`.
    rows = rows.concat(page);
    from += page.length;
  }
}

function primaryKeyColumns(table: string): readonly string[] {
  const columns = PRIMARY_KEY_COLUMNS[table];
  if (!columns) throw new Error(`No primary key order registered for ${table}`);
  return columns;
}

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
    const userColumn = entry.userColumn;
    if (userColumn) {
      tables[entry.table] = await fetchAllPages(async (from, to) => {
        let query = supabase.from(entry.table).select("*").eq(userColumn, user.id);
        for (const column of primaryKeyColumns(entry.table)) query = query.order(column);
        return query.range(from, to);
      });
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
    let childRows: unknown[] = [];
    for (let start = 0; start < parentIds.length; start += PARENT_ID_CHUNK_SIZE) {
      const parentIdChunk = parentIds.slice(start, start + PARENT_ID_CHUNK_SIZE);
      // `concat`, not `push(...)` — see `fetchAllPages` for why spreading an
      // unbounded array is a crash waiting for the heaviest account.
      childRows = childRows.concat(
        await fetchAllPages(async (from, to) => {
          let query = supabase.from(entry.table).select("*").in(via.column, parentIdChunk);
          for (const column of primaryKeyColumns(entry.table)) query = query.order(column);
          return query.range(from, to);
        }),
      );
    }
    tables[entry.table] = childRows;
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
export const HISTORY_SOURCES = [
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
    const data = await fetchAllPages(async (from, to) => {
      let query = supabase.from(source.table).select(source.join.select).eq("user_id", user.id);
      for (const column of primaryKeyColumns(source.table)) query = query.order(column);
      return query.range(from, to);
    });

    for (const row of data as unknown as Record<string, unknown>[]) {
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
