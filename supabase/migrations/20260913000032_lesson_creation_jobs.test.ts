import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LESSON_CREATION_ERROR_CODES, LESSON_CREATION_JOB_STATES, LESSON_CREATION_STEPS } from "../../lib/lesson-creation/types";

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
    expect(sql).toContain("join public.transcript_lines");
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
