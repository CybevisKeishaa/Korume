import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { LESSON_CREATION_ERROR_CODES, LESSON_CREATION_JOB_STATES, LESSON_CREATION_STEPS } from "../../lib/lesson-creation/types";
import { FREE_MONTHLY_LESSON_QUOTA } from "../../lib/data/lesson-library";

const directory = join(process.cwd(), "supabase/migrations");
const filename = "20260913000032_lesson_creation_jobs.sql";
function migration(): string {
  const files = readdirSync(directory).filter((file) => file === filename);
  expect(files.length).toBeGreaterThan(0);
  expect(files).toHaveLength(1);
  const file = files[0];
  if (!file) throw new Error("C4 migration is missing");
  return readFileSync(join(directory, file), "utf8").replace(/--[^\n]*/g, "").toLowerCase();
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
    const match = /if monthly_count >= (\d+) then/.exec(sql);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBe(FREE_MONTHLY_LESSON_QUOTA);
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
    const refusal = body.indexOf("if monthly_count >= 3 then");
    expect(refusal).toBeGreaterThan(0);
    for (const table of ["videos", "transcripts", "transcript_lines"]) {
      const write = body.indexOf(`insert into public.${table}`);
      expect(write).toBeGreaterThan(refusal);
    }
    expect(body).toContain("(v.id is null or v.library_access = 'private')");
    expect(body.slice(refusal, body.indexOf("insert into public.videos"))).toContain("return j;");
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
  it("fences worker writes and restricts all definer functions to service role", () => {
    const sql = migration();
    const functions = [...sql.matchAll(/create function public\.(\w+)\([\s\S]*?\$\$;/g)];
    expect(functions.length).toBeGreaterThan(0);
    expect(functions).toHaveLength(7);
    for (const [body] of functions) expect(body).toContain("security definer set search_path = ''");
    expect(sql).toContain("lease_token is distinct from p_lease_token");
    expect(sql).toContain("lease_expires_at <= clock_timestamp()");
    expect(sql).toContain("revoke all on function");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).not.toMatch(/youtube-dl|ytdl|video_bytes|media_bytes|http_get|net\.http|pg_sleep/);
  });
});
