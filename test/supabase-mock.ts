/**
 * Minimal chainable mock of the subset of the `@supabase/supabase-js` query
 * builder actually used under `lib/data/*` (select/insert/upsert/update/
 * delete + eq/in/gte/is/order/limit + single/maybeSingle, and the builder
 * itself being `await`-able without a terminal call — see e.g.
 * `lib/data/content.ts::getKanjiList`).
 *
 * There is no existing route/data-layer test precedent in this repo to
 * mirror (see Layer 5 Task 4 handoff notes) — this harness establishes one,
 * reusable by any future `lib/data/*` test.
 *
 * Usage:
 *   const supabase = createMockSupabase({
 *     user: { id: "u1" },
 *     tables: {
 *       jlpt_tests: (calls) => ({ data: [...], error: null }),
 *     },
 *   });
 *   vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
 *
 * Each table's resolver receives the full list of calls made on that
 * `.from(table)` chain (in order) and returns the terminal `{ data, error }`.
 * Resolvers can inspect `calls` to branch on which query variant ran (e.g.
 * an `eq` filter's column/value, or whether `.single()` was called).
 *
 * `lt`/`neq` and an optional `storage` stub were added in Layer 7
 * (community backend: forum/playlist cursor pagination needs `lt` on
 * `created_at`; the peer-review queue needs `neq` to exclude the caller's
 * own shares; the peer-review audio endpoint needs `storage.from(bucket)
 * .createSignedUrl(...)`) — additive only, no existing behavior changed.
 *
 * `gt`/`ilike`/`range` were added alongside those, same Layer 7 pass (admin
 * backend: the pending-videos queue pages forward with `gt` on `created_at`,
 * content-CRUD search uses `ilike`, and content-CRUD list pagination uses
 * `range`) — additive only, no existing behavior changed.
 *
 * `not` was added in Layer 9b (the Companion `line_mastered` producer reads a
 * line's earlier *scored* attempts via `.not("pronunciation_score", "is",
 * null)`) — additive only, no existing behavior changed.
 */

export type QueryCall =
  | { op: "select"; columns: string }
  | { op: "insert"; values: unknown }
  | { op: "upsert"; values: unknown; options?: { onConflict?: string; ignoreDuplicates?: boolean } }
  | { op: "update"; values: unknown }
  | { op: "delete" }
  | { op: "eq"; column: string; value: unknown }
  | { op: "neq"; column: string; value: unknown }
  | { op: "in"; column: string; values: unknown[] }
  | { op: "gte"; column: string; value: unknown }
  | { op: "gt"; column: string; value: unknown }
  | { op: "lt"; column: string; value: unknown }
  | { op: "is"; column: string; value: unknown }
  | { op: "not"; column: string; operator: string; value: unknown }
  | { op: "ilike"; column: string; pattern: string }
  | { op: "order"; column: string; ascending: boolean }
  | { op: "limit"; count: number }
  | { op: "range"; from: number; to: number }
  | { op: "single" }
  | { op: "maybeSingle" };

export interface MockResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

export type TableResolver = (calls: QueryCall[]) => MockResult | Promise<MockResult>;

export interface MockSupabaseOptions {
  /** The signed-in user `auth.getUser()` should resolve to; `null`/omitted = signed out. */
  user?: { id: string } | null;
  /** One resolver per table name touched by the code under test. */
  tables: Record<string, TableResolver>;
  /**
   * Optional per-bucket `createSignedUrl` stub for code that calls
   * `supabase.storage.from(bucket).createSignedUrl(path, ttl)` (e.g.
   * `lib/data/shadowing.ts`, `lib/data/peer-review.ts`). Keyed by bucket name;
   * a bucket with no resolver throws, same fail-fast intent as `tables`.
   */
  storage?: Record<
    string,
    (path: string, expiresInSeconds: number) => MockResult | Promise<MockResult>
  >;
}

/** Helper: find the value of the first `eq` filter on `column`, if any. */
export function eqValue(calls: QueryCall[], column: string): unknown {
  const call = calls.find((c): c is Extract<QueryCall, { op: "eq" }> => c.op === "eq" && c.column === column);
  return call?.value;
}

export function hasCall(calls: QueryCall[], op: QueryCall["op"]): boolean {
  return calls.some((c) => c.op === op);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Builder = any;

export function createMockSupabase(opts: MockSupabaseOptions) {
  const auth = {
    getUser: async () => ({ data: { user: opts.user ?? null } }),
  };

  function from(table: string): Builder {
    const calls: QueryCall[] = [];
    const resolver = opts.tables[table];
    if (!resolver) {
      throw new Error(`createMockSupabase: no resolver registered for table "${table}"`);
    }

    const builder: Builder = {
      select(columns: string) {
        calls.push({ op: "select", columns });
        return builder;
      },
      insert(values: unknown) {
        calls.push({ op: "insert", values });
        return builder;
      },
      upsert(values: unknown, options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
        calls.push({ op: "upsert", values, options });
        return builder;
      },
      update(values: unknown) {
        calls.push({ op: "update", values });
        return builder;
      },
      delete() {
        calls.push({ op: "delete" });
        return builder;
      },
      eq(column: string, value: unknown) {
        calls.push({ op: "eq", column, value });
        return builder;
      },
      neq(column: string, value: unknown) {
        calls.push({ op: "neq", column, value });
        return builder;
      },
      in(column: string, values: unknown[]) {
        calls.push({ op: "in", column, values });
        return builder;
      },
      gte(column: string, value: unknown) {
        calls.push({ op: "gte", column, value });
        return builder;
      },
      lt(column: string, value: unknown) {
        calls.push({ op: "lt", column, value });
        return builder;
      },
      gt(column: string, value: unknown) {
        calls.push({ op: "gt", column, value });
        return builder;
      },
      is(column: string, value: unknown) {
        calls.push({ op: "is", column, value });
        return builder;
      },
      not(column: string, operator: string, value: unknown) {
        calls.push({ op: "not", column, operator, value });
        return builder;
      },
      ilike(column: string, pattern: string) {
        calls.push({ op: "ilike", column, pattern });
        return builder;
      },
      order(column: string, options?: { ascending?: boolean }) {
        calls.push({ op: "order", column, ascending: options?.ascending ?? true });
        return builder;
      },
      limit(count: number) {
        calls.push({ op: "limit", count });
        return builder;
      },
      range(from: number, to: number) {
        calls.push({ op: "range", from, to });
        return builder;
      },
      single() {
        calls.push({ op: "single" });
        return builder;
      },
      maybeSingle() {
        calls.push({ op: "maybeSingle" });
        return builder;
      },
      // Makes the builder itself awaitable (`await supabase.from(t).select(...)`),
      // matching real supabase-js behaviour where every query is a thenable.
      then(onFulfilled: (r: MockResult) => unknown, onRejected?: (e: unknown) => unknown) {
        return Promise.resolve(resolver(calls)).then(onFulfilled, onRejected);
      },
    };
    return builder;
  }

  function storageFrom(bucket: string) {
    const resolver = opts.storage?.[bucket];
    return {
      async createSignedUrl(path: string, expiresIn: number) {
        if (!resolver) {
          throw new Error(`createMockSupabase: no storage resolver registered for bucket "${bucket}"`);
        }
        return resolver(path, expiresIn);
      },
    };
  }

  return { auth, from, storage: { from: storageFrom } };
}
