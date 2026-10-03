import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const directory = join(process.cwd(), "supabase/migrations");

function normalized(file: string): string {
  return readFileSync(join(directory, file), "utf8")
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const DATA_TABLES = ["dict_entries", "dict_kanji", "dict_kanji_strokes", "dict_kanji_words"];
const ALL_TABLES = ["dict_imports", "dict_snapshots", ...DATA_TABLES];
const ADMIN_FUNCTIONS = ["dict_stage_snapshot", "dict_activate_snapshot", "dict_rollback_snapshot", "dict_gc_snapshots"];

describe("dictionary SQL contract", () => {
  const sql = normalized("20261002000037_dictionary.sql");

  it("versions every row by snapshot", () => {
    for (const table of DATA_TABLES) {
      expect(sql).toContain(
        `create table ${table} ( snapshot_id uuid not null references dict_snapshots (id) on delete cascade`,
      );
    }
    expect(sql).toContain("primary key (snapshot_id, ent_seq)");
    expect(sql).toContain("primary key (snapshot_id, literal)");
    expect(sql).toContain("primary key (snapshot_id, literal, ent_seq)");
    expect(sql).toContain("using gin (kanji_forms)");
    expect(sql).toContain("using gin (kana_forms)");
  });

  it("allows at most one active snapshot", () => {
    expect(sql).toContain(
      "create unique index dict_snapshots_one_active on dict_snapshots ((true)) where status = 'active'",
    );
    expect(sql).toContain("check (status in ('staging', 'active', 'retired'))");
  });

  it("records per-source provenance", () => {
    expect(sql).toMatch(
      /create table dict_imports \(.*source text not null check \(source in \('jmdict', 'kanjidic2', 'kanjivg'\)\).*source_version text not null.*source_url text not null.*license text not null.*file_sha256 text not null.*entry_count int not null/,
    );
  });

  it("is read-only for learners and invisible to anon", () => {
    for (const table of ALL_TABLES) {
      expect(sql).toContain(`alter table ${table} enable row level security`);
      expect(sql).toContain(`create policy ${table}_read on ${table} for select to authenticated using (true)`);
      expect(sql).toContain(`revoke all on ${table} from anon`);
      expect(sql).toContain(`revoke insert, update, delete, truncate on ${table} from authenticated`);
      expect(sql).toContain(`grant all on ${table} to service_role`);
    }
  });

  it("keeps snapshot administration service-role only", () => {
    for (const fn of ADMIN_FUNCTIONS) {
      expect(sql).toMatch(new RegExp(`create function ${fn}\\([^)]*\\).*?security definer set search_path = public`));
      expect(sql).toMatch(new RegExp(`revoke all on function ${fn}\\([^)]*\\) from public, anon, authenticated`));
      expect(sql).toMatch(new RegExp(`grant execute on function ${fn}\\([^)]*\\) to service_role`));
    }
    expect(sql).toMatch(/grant execute on function dict_active_snapshot_id\(\) to authenticated, service_role/);
  });

  it("purges only abandoned staging imports: never activated and older than the grace", () => {
    const gc = sql.slice(sql.indexOf("create function dict_gc_snapshots"), sql.indexOf("create function dict_active_snapshot_id"));
    expect(gc).toContain("status = 'staging' and activated_at is null and created_at < now() - p_staging_grace");
    expect(gc).toContain("imported_at < now() - p_staging_grace");
    expect(gc).toContain("p_staging_grace interval default interval '1 day'");
  });

  it("validates a snapshot before flipping the active pointer", () => {
    const activate = sql.slice(sql.indexOf("create function dict_activate_snapshot"));
    const incomplete = activate.indexOf("is incomplete");
    const dangling = activate.indexOf("dangling kanji words");
    const flip = activate.indexOf("set status = 'retired' where status = 'active'");
    expect(incomplete).toBeGreaterThan(0);
    expect(dangling).toBeGreaterThan(0);
    expect(flip).toBeGreaterThan(Math.max(incomplete, dangling));
  });
});
