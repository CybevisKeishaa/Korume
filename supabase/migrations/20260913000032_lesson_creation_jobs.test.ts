import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { LESSON_CREATION_ERROR_CODES, LESSON_CREATION_JOB_STATES, LESSON_CREATION_STEPS, MAX_LESSON_CREATION_ATTEMPTS } from "../../lib/lesson-creation/types";
import { FREE_MONTHLY_LESSON_QUOTA } from "../../lib/data/lesson-library";

const directory = join(process.cwd(), "supabase/migrations");
const filename = "20260913000032_lesson_creation_jobs.sql";

/**
 * One migration file, deliberately. Owner ruling 2026-09-19 on review finding
 * I1: this subsystem is edited IN PLACE rather than by additive
 * `CREATE OR REPLACE` migrations (AGENTS.md §6a). A second file defining the
 * same function would leave every assertion below reading a copy the database
 * never runs — which is exactly what the previous shape did.
 */
function migration(): string {
  const files = readdirSync(directory).filter((file) => file === filename);
  expect(files.length).toBeGreaterThan(0);
  expect(files).toHaveLength(1);
  const file = files[0];
  if (!file) throw new Error("C4 migration is missing");
  return readFileSync(join(directory, file), "utf8").replace(/--[^\n]*/g, "").toLowerCase();
}

/**
 * Every migration that defines any part of this subsystem; see `migration()`.
 *
 * Scoped by CONTENT, not by filename ordering. A `file >= filename` string
 * comparison collects the next migration added for ANY subsystem, turning this
 * red with a message naming the C4 one-file rule that is not the cause — which
 * invites the next author to weaken the guard AGENTS.md §6 depends on. The
 * subsystem's own name is the thing worth matching on.
 */
function subsystemMigrations(): string[] {
  return readdirSync(directory).filter(
    (file) =>
      file.endsWith(".sql") &&
      readFileSync(join(directory, file), "utf8").includes("lesson_creation_job"),
  );
}

describe("durable lesson creation SQL contract", () => {
  /**
   * `finalize_lesson_creation_job` is the authoritative quota decision and it
   * holds the free-tier cap as a SQL literal, while `FREE_MONTHLY_LESSON_QUOTA`
   * drives the advisory refusal and the Hub's "used / limit" chip. Two homes for
   * one number is a defect (AGENTS.md §6), and nothing else connects them: raise
   * the constant alone and the chip promises a slot that finalize refuses AFTER
   * the caption work is done. This pin is that connection.
   */
  it("holds the same free-tier cap as FREE_MONTHLY_LESSON_QUOTA", () => {
    const sql = migration();
    // `matchAll` with an asserted count, not `exec`: a first-match-only pin
    // would keep passing if a second, divergent copy of the cap appeared
    // (AGENTS.md §7 — a pattern-gathered collection must assert its size).
    const matches = [...sql.matchAll(/if monthly_count >= (\d+) then/g)];
    expect(matches).toHaveLength(1);
    expect(Number(matches[0]?.[1])).toBe(FREE_MONTHLY_LESSON_QUOTA);
  });
  /**
   * The same defect as the quota pin above, for the three-attempt cap — which
   * that pin's own comment describes and nothing enforced until this test.
   *
   * `MAX_LESSON_CREATION_ATTEMPTS` drives the worker's requeue-vs-terminal
   * decision and its claimed-attempt sanity guard; the SQL spends the same number
   * nine times. Drift is silent in BOTH directions: raise the constant alone and
   * `transition_lesson_creation_job` still computes `else 'failed'` at three
   * attempts, so what the worker records as a requeue becomes a terminal failure
   * and `claim` never picks the row up again; lower the SQL alone and the worker's
   * guard still passes while jobs die an attempt early. `worker.test.ts` is green
   * against the constant and structurally cannot see the SQL.
   */
  it("spends the attempt cap as MAX_LESSON_CREATION_ATTEMPTS at every SQL site", () => {
    const sql = migration();

    // One pattern over EVERY comparison of `attempt_count` against a literal,
    // counted. The three shapes below are readable but not exhaustive: a new
    // shape (`> 2`, `= 3`) would slip past them and be caught only here
    // (AGENTS.md §7 — a pattern-gathered collection must assert its size).
    const everySite = [...sql.matchAll(/attempt_count\s*(?:<=|>=|<|>|=|between 0 and)\s*(\d+)/g)];
    expect(everySite.length).toBeGreaterThan(0);
    expect(everySite).toHaveLength(10);

    const capShapes = [
      // the two check constraints, on jobs and on the event history
      [/attempt_count between 0 and (\d+)/g, 2],
      // `claim`'s eligibility filter, `transition`'s two CASE arms, `recover`'s two
      [/attempt_count < (\d+)/g, 5],
      // `transition`'s `completed_at`, and `recover`'s exhausted arm
      [/attempt_count >= (\d+)/g, 2],
    ] as const;
    let capSites = 0;
    for (const [pattern, expected] of capShapes) {
      const matches = [...sql.matchAll(pattern)];
      expect(matches).toHaveLength(expected);
      for (const match of matches) expect(Number(match[1])).toBe(MAX_LESSON_CREATION_ATTEMPTS);
      capSites += matches.length;
    }
    expect(capSites).toBe(9);

    // The tenth site is a different fact, so it is named rather than pinned to
    // the cap: a retry resets the counter to start a fresh attempt sequence on
    // the same job (design §5).
    expect([...sql.matchAll(/attempt_count = (\d+)/g)]).toHaveLength(1);
    expect(sql).toContain("set state = 'queued', step = 'deduplicating', attempt_count = 0");
  });

  it("ships exactly one migration and both private, cascading tables", () => {
    const sql = migration();
    for (const table of ["lesson_creation_jobs", "lesson_creation_job_events"]) {
      expect(sql).toContain(`create table public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
    expect(sql).toContain("references public.users(id) on delete cascade");
    expect(sql).toContain("references public.lesson_creation_jobs(id) on delete cascade");
  });
  it("uses canonical domain values and constrains terminal state/step pairs", () => {
    const sql = migration();
    for (const [name, values] of [["lesson_creation_job_state", LESSON_CREATION_JOB_STATES], ["lesson_creation_step", LESSON_CREATION_STEPS], ["lesson_creation_error_code", LESSON_CREATION_ERROR_CODES]] as const) {
      const definition = sql.match(new RegExp(`create type public\\.${name} as enum \\(([^;]+)\\);`));
      expect(definition).not.toBeNull();
      const members = definition?.[1];
      if (!members) throw new Error(`Missing enum ${name}`);
      expect([...members.matchAll(/'([^']+)'/g)].map((match) => match[1])).toEqual(values);
    }
    expect(sql).toContain("(state = 'succeeded') = (step = 'ready')");
    expect(sql).toContain("(state = 'failed') = (step = 'failed')");
  });
  it("limits requester reads on jobs and events without client writes", () => {
    const sql = migration();
    expect(sql).toMatch(/create policy lesson_creation_jobs_read[\s\S]*?using \(requester_user_id = auth.uid\(\)\)/);
    expect(sql).toMatch(/create policy lesson_creation_job_events_read[\s\S]*?j.requester_user_id = auth.uid\(\)/);
    expect(sql).toContain("revoke all on public.lesson_creation_jobs, public.lesson_creation_job_events from anon, authenticated");
    expect(sql).toContain("revoke update, delete, truncate on public.lesson_creation_job_events from service_role");
  });
  it("deduplicates only active jobs and atomically claims eligible jobs", () => {
    const sql = migration();
    expect(sql).toMatch(/create unique index lesson_creation_jobs_active[\s\S]*?\(requester_user_id, youtube_video_id\)\s+where state in \('queued', 'running'\)/);
    expect(sql).toContain("for update skip locked");
    expect(sql).toContain("attempt_count = attempt_count + 1");
    expect(sql).toContain("available_at <= p_now");
    expect(sql).toContain("lease_token = gen_random_uuid()");
  });
  it("locks the requester before final quota and preserves the historical ledger", () => {
    const sql = migration();
    expect(sql).toContain("from public.users where id = p_requester for update");
    expect(sql).toContain("counted_video.added_by_user_id = p_requester");
    expect(sql).toContain("counted_video.library_access = 'private'");
    expect(sql).toContain("date_trunc('month', timezone('utc', now())) at time zone 'utc'");
    expect(sql).toContain("s.plan <> 'free' and s.status = 'active'");
    expect(sql).toContain("insert into public.user_lesson_library");
    expect(sql).toContain("jsonb_to_recordset");
    expect(sql).toContain("from public.transcript_lines");
  });
  it("refuses quota before writing newly creator-visible video or transcript content", () => {
    const body = migration().match(/create function public\.finalize_lesson_creation_job\([\s\S]*?\$\$;/)?.[0];
    expect(body).toBeDefined();
    if (!body) throw new Error("Missing finalize");
    // Derived, not hardcoded: a third literal copy of the cap in the very file
    // that exists to keep it to one home would turn this test red for an
    // unrelated reason the next time the cap changes.
    const refusal = body.indexOf(`if monthly_count >= ${FREE_MONTHLY_LESSON_QUOTA} then`);
    expect(refusal).toBeGreaterThan(0);
    for (const table of ["videos", "transcripts", "transcript_lines"]) {
      const write = body.indexOf(`insert into public.${table}`);
      expect(write).toBeGreaterThan(refusal);
    }
    expect(body).toContain("(v.id is null or v.library_access = 'private')");
    expect(body.slice(refusal, body.indexOf("insert into public.videos"))).toContain("return j;");
  });
  /**
   * The authoritative half of the owner's A+C ruling (2026-09-19). An admin job
   * asks for FREE/PLUS; finalize never publishes a lesson it deduped onto, so
   * landing on a PRIVATE one must not report `succeeded`. The refusal has to sit
   * inside the advisory-locked section: the enqueue and pipeline checks both run
   * before the lock, so the row can still appear after they have passed.
   */
  it("refuses an admin job deduping onto a private lesson, under the lock and before any write", () => {
    const body = migration().match(/create function public\.finalize_lesson_creation_job\([\s\S]*?\$\$;/)?.[0];
    expect(body).toBeDefined();
    if (!body) throw new Error("Missing finalize");

    const lock = body.indexOf("pg_advisory_xact_lock");
    const refusal = body.indexOf("public_error_code = 'existing_private_lesson'");
    expect(lock).toBeGreaterThan(0);
    expect(refusal).toBeGreaterThan(lock);
    expect(body).toContain("j.origin = 'admin' and v.library_access = 'private'");

    const firstWrite = body.indexOf("insert into public.videos");
    for (const table of ["videos", "transcripts", "transcript_lines"]) {
      expect(body.indexOf(`insert into public.${table}`)).toBeGreaterThan(refusal);
    }
    expect(body.slice(refusal, firstWrite)).toContain("return j;");

    // Scoped to the refusal's own branch: the learner quota block between it and
    // the first write legitimately reads `lesson_id = v.id`. The admin must not
    // be handed another learner's private lesson id, so this branch never
    // mentions the column at all.
    const branch = body.slice(body.lastIndexOf("if j.origin = 'admin'", refusal), body.indexOf("return j;", refusal));
    expect(branch).toContain("state = 'failed'");
    // The precise thing forbidden, not the substring: an implementation that
    // wrote `lesson_id = null` explicitly is equally safe and must not go red.
    expect(branch).not.toContain("lesson_id = v.id");
  });

  it("selects the newest empty header over an older complete header and repairs that same header", () => {
    const sql = migration();
    const selections = [...sql.matchAll(/select t\.id into chosen_transcript_id from public\.transcripts t\s+where t\.video_id = v\.id\s+order by t\.created_at desc limit 1 for update/g)];
    expect(selections.length).toBeGreaterThan(0);
    expect(selections).toHaveLength(2);
    // Execute the exact relational SELECT against a small SQLite fixture; this
    // verifies header selection only, not PostgreSQL RPC/transaction/RLS behavior.
    const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
      DatabaseSync: new (path: string) => {
        exec(sql: string): void;
        prepare(sql: string): { get(...args: string[]): Record<string, unknown> | undefined };
        close(): void;
      };
    };
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(`attach database ':memory:' as public;
        create table public.transcripts(id text, video_id text, created_at text, language text);
        create table public.transcript_lines(transcript_id text, text_jp text);
        insert into public.transcripts values ('older', 'lesson', '2026-09-12', 'ja'), ('newer', 'lesson', '2026-09-13', 'en');
        insert into public.transcript_lines values ('older', 'original fixture line');`);
      expect(db.prepare("select count(*) as count from public.transcripts").get()?.count).toBe(2);
      expect(db.prepare("select count(*) as count from public.transcript_lines where transcript_id = 'older'").get()?.count).toBe(1);
      for (const [selection] of selections) {
        const query = selection.replace(" into chosen_transcript_id", "").replace("v.id", "?").replace(" for update", "");
        expect(db.prepare(query).get("lesson")?.id).toBe("newer");
      }
      expect(db.prepare("select count(*) as count from public.transcript_lines where transcript_id = 'newer'").get()?.count).toBe(0);
    } finally { db.close(); }
    expect(sql).toContain("where l.transcript_id = chosen_transcript_id");
    expect(sql).toContain("if chosen_transcript_id is null then");
    expect(sql).toContain("where id = chosen_transcript_id");
    expect(sql).toContain("select chosen_transcript_id, l.start_time");
    expect(sql).not.toContain("join public.transcript_lines l on l.transcript_id = t.id");
  });
  it("exposes the approved atomic finalize payload and lease fence", () => {
    const sql = migration();
    expect(sql).toMatch(/finalize_lesson_creation_job\(p_job_id uuid, p_lesson_id uuid, p_requester uuid,\s+p_lease_token uuid, p_content jsonb default null\)/);
    const body = sql.match(/create function public\.finalize_lesson_creation_job\([\s\S]*?\$\$;/)?.[0];
    expect(body).toBeDefined();
    for (const table of ["videos", "transcripts", "transcript_lines", "user_lesson_library"]) {
      expect(body).toContain(`insert into public.${table}`);
    }
    expect(body).toContain("jsonb_array_length(p_content->'lines') = 0");
    expect(body).toContain("raise exception 'invalid_content'");
    expect(body).toContain("pg_advisory_xact_lock");
    expect(body).toContain("state = 'succeeded', step = 'ready', lesson_id = v.id");
  });
  /**
   * Guards the ruling itself (AGENTS.md §6a): if a later commit ever adds a
   * second subsystem migration, these scans and the definer check below would
   * silently stop covering the live definitions. Fail here instead.
   */
  /**
   * Review finding I2. The sweeper that ends a `queued` job no live worker can
   * reach. Two of its rules are easy to "simplify" into bugs, so both are pinned:
   * the live-lease guard is what keeps a merely busy queue from being declared
   * dead, and the age is measured on the column a requeue touches.
   */
  it("ends a stale queued job, and only while nothing holds a live lease", () => {
    const sql = migration();
    const body = sql.match(/create function public\.fail_stale_queued_lesson_creation_jobs\([\s\S]*?\$\$;/)?.[0];
    expect(body).toBeDefined();
    if (!body) throw new Error("the stale-queued sweeper is missing");

    // A single-concurrency worker makes a healthy job wait behind others; without
    // this guard the window alone would call that queue dead. The claim-history
    // half is the load-bearing one: a pass sweeps between its recovery and its
    // claim, holding no lease, so an instantaneous lease test alone failed the
    // head of a healthy backlog (reviewed 2026-09-20, reproduced live).
    expect(body).toContain("state = 'running' and lease_expires_at > p_now");
    expect(body).toContain("or exists (select 1 from public.lesson_creation_job_events");
    expect(body).toContain("and created_at > p_now - make_interval(secs => p_max_age_seconds)) then");
    expect(body).toContain("return 0;");
    // `updated_at`, never `created_at`: a transient requeue touches the former,
    // so a job being retried on schedule is not stale.
    expect(body).toContain("updated_at <= p_now - make_interval(secs => p_max_age_seconds)");
    // The job's own age is never read from `created_at` — only the events clause
    // above reads that column, and it reads it forwards, on the history table.
    expect(body).not.toMatch(/created_at\s*<=?[^=]/);
    // Terminal and retryable, and it consumes no attempt — the row never ran.
    expect(body).toContain("state = 'failed', step = 'failed', public_error_code = 'temporary_failure'");
    expect(body).not.toContain("attempt_count");
    // One row (a learner's own poll) or the whole queue (a worker pass), one
    // definition of stale.
    expect(body).toContain("(p_job_id is null or id = p_job_id)");
    expect(body).toContain("for update skip locked");
    // The window stays the caller's, so it never gains a second home in SQL.
    expect(body).toContain("p_max_age_seconds not between 60 and 86400");
    expect(body).not.toMatch(/interval '\d/);
  });

  it("keeps this subsystem to one migration file, so every scan below is complete", () => {
    const files = subsystemMigrations();
    // Non-empty first: a content filter that matched nothing would make this
    // pass by finding no second file AND no first one (AGENTS.md §7).
    expect(files.length).toBeGreaterThan(0);
    expect(files).toEqual([filename]);
  });

  it("fences worker writes and restricts all definer functions to service role", () => {
    const sql = migration();
    const functions = [...sql.matchAll(/create function public\.(\w+)\([\s\S]*?\$\$;/g)];
    expect(functions.length).toBeGreaterThan(0);
    expect(functions).toHaveLength(8);
    for (const [body] of functions) expect(body).toContain("security definer set search_path = ''");
    // Every definer function must appear in BOTH privilege lists by name. The
    // stale sweeper's safety rests entirely on this revoke: its `p_job_id` is not
    // requester-scoped in SQL, so ownership is proven only in TypeScript.
    // Each statement taken whole, from its verb to its own terminator: slicing to
    // the next "to service_role;" would stop at the TABLE grant far above.
    const revoked = sql.match(/revoke all on function[\s\S]*?;/)?.[0] ?? "";
    const granted = sql.match(/grant execute on function[\s\S]*?;/)?.[0] ?? "";
    expect(revoked).toContain("from public, anon, authenticated;");
    expect(granted).toContain("to service_role;");
    for (const [, name] of functions) {
      // The revoke covers every function without exception — PostgreSQL grants
      // EXECUTE to PUBLIC by default, so the trigger function, which is granted to
      // nobody, is the one whose ONLY protection is this listing.
      expect(revoked).toContain(`public.${name}(`);
      if (name === "record_lesson_creation_job_event") continue; // trigger-owned; no grant
      expect(granted).toContain(`public.${name}(`);
    }
    expect(sql).toContain("lease_token is distinct from p_lease_token");
    expect(sql).toContain("lease_expires_at <= clock_timestamp()");
    expect(sql).toContain("revoke all on function");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).not.toMatch(/youtube-dl|ytdl|video_bytes|media_bytes|http_get|net\.http|pg_sleep/);
  });
});
