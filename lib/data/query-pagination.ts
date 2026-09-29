/** PostgREST's configured row cap; readers page before it can truncate a result. */
export const DATA_PAGE_SIZE = 1_000;
/** Keeps UUID `in` filters well below request-line limits. */
export const ID_CHUNK_SIZE = 100;

interface QueryResult<T> {
  data: T[] | null;
  error: unknown | null;
}

/**
 * Reads every page of a query that has a TOTAL order (else a page boundary
 * repeats or skips rows).
 *
 * ponytail: stops at the first short page, so it assumes the server's
 * `max_rows` is at least DATA_PAGE_SIZE (supabase/config.toml: 1000). A
 * deployment with a lower cap cuts the read short; `user-export.ts` pages to
 * an empty page instead because an export must never be short.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<QueryResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += DATA_PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + DATA_PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < DATA_PAGE_SIZE) return rows;
  }
}

export async function fetchByIdChunks<T>(
  ids: readonly string[],
  fetchChunk: (ids: string[]) => Promise<T[]>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; start < ids.length; start += ID_CHUNK_SIZE) {
    rows.push(...await fetchChunk(ids.slice(start, start + ID_CHUNK_SIZE)));
  }
  return rows;
}

/**
 * An `ilike` pattern matching `query` literally anywhere in the column.
 * `\`, `%` and `_` are escaped (Postgres's default LIKE escape is `\`);
 * `*` is dropped because PostgREST rewrites every `*` in a like value to `%`,
 * and there is no way to escape it through the REST filter.
 */
export function containsPattern(query: string): string {
  const literal = query.replace(/\*/g, "").replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  return `%${literal}%`;
}
