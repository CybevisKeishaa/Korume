-- Versioned dictionary reference data (spec 2026-10-02 part 1b §4.1). One snapshot spans all three
-- sources, so the app never reads JMdict of one import beside KanjiVG of another. Only the service role
-- writes; learners read; anon sees nothing.
create table dict_imports (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('jmdict', 'kanjidic2', 'kanjivg')),
  source_version text not null,
  source_url text not null,
  license text not null,
  file_sha256 text not null,
  entry_count int not null check (entry_count > 0),
  imported_at timestamptz not null default now()
);

create table dict_snapshots (
  id uuid primary key default gen_random_uuid(),
  jmdict_import_id uuid not null references dict_imports (id),
  kanjidic_import_id uuid not null references dict_imports (id),
  kanjivg_import_id uuid not null references dict_imports (id),
  status text not null default 'staging' check (status in ('staging', 'active', 'retired')),
  created_at timestamptz not null default now(),
  activated_at timestamptz
);
-- At most one active snapshot; the activation and rollback transactions keep it exactly one.
create unique index dict_snapshots_one_active on dict_snapshots ((true)) where status = 'active';

create table dict_entries (
  snapshot_id uuid not null references dict_snapshots (id) on delete cascade,
  ent_seq int not null,
  kanji_forms text[] not null default '{}',
  kana_forms text[] not null,
  senses jsonb not null, -- [{ pos: string[], gloss: string[], misc: string[] }]
  common boolean not null default false,
  jlpt smallint check (jlpt between 1 and 5),
  primary key (snapshot_id, ent_seq)
);
create index dict_entries_kanji_forms on dict_entries using gin (kanji_forms);
create index dict_entries_kana_forms on dict_entries using gin (kana_forms);

create table dict_kanji (
  snapshot_id uuid not null references dict_snapshots (id) on delete cascade,
  literal text not null check (char_length(literal) = 1),
  on_readings text[] not null default '{}',
  kun_readings text[] not null default '{}',
  meanings_en text[] not null default '{}',
  stroke_count smallint not null check (stroke_count > 0),
  grade smallint,
  freq int,
  jlpt_old smallint,
  primary key (snapshot_id, literal)
);

create table dict_kanji_strokes (
  snapshot_id uuid not null references dict_snapshots (id) on delete cascade,
  literal text not null,
  paths jsonb not null, -- ordered string[] of sanitised SVG path data
  components jsonb not null, -- KanjiVG element tree, raw primitives
  primary key (snapshot_id, literal)
);

create table dict_kanji_words (
  snapshot_id uuid not null references dict_snapshots (id) on delete cascade,
  literal text not null,
  ent_seq int not null,
  rank int not null,
  primary key (snapshot_id, literal, ent_seq)
);
create index dict_kanji_words_rank on dict_kanji_words (snapshot_id, literal, rank);

alter table dict_imports enable row level security;
alter table dict_snapshots enable row level security;
alter table dict_entries enable row level security;
alter table dict_kanji enable row level security;
alter table dict_kanji_strokes enable row level security;
alter table dict_kanji_words enable row level security;

create policy dict_imports_read on dict_imports for select to authenticated using (true);
create policy dict_snapshots_read on dict_snapshots for select to authenticated using (true);
create policy dict_entries_read on dict_entries for select to authenticated using (true);
create policy dict_kanji_read on dict_kanji for select to authenticated using (true);
create policy dict_kanji_strokes_read on dict_kanji_strokes for select to authenticated using (true);
create policy dict_kanji_words_read on dict_kanji_words for select to authenticated using (true);

revoke all on dict_imports from anon;
revoke all on dict_snapshots from anon;
revoke all on dict_entries from anon;
revoke all on dict_kanji from anon;
revoke all on dict_kanji_strokes from anon;
revoke all on dict_kanji_words from anon;

revoke insert, update, delete, truncate on dict_imports from authenticated;
revoke insert, update, delete, truncate on dict_snapshots from authenticated;
revoke insert, update, delete, truncate on dict_entries from authenticated;
revoke insert, update, delete, truncate on dict_kanji from authenticated;
revoke insert, update, delete, truncate on dict_kanji_strokes from authenticated;
revoke insert, update, delete, truncate on dict_kanji_words from authenticated;

grant select on dict_imports, dict_snapshots, dict_entries, dict_kanji, dict_kanji_strokes, dict_kanji_words
  to authenticated;

grant all on dict_imports to service_role;
grant all on dict_snapshots to service_role;
grant all on dict_entries to service_role;
grant all on dict_kanji to service_role;
grant all on dict_kanji_strokes to service_role;
grant all on dict_kanji_words to service_role;

create function dict_stage_snapshot(p_jmdict uuid, p_kanjidic uuid, p_kanjivg uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if (select source from dict_imports where id = p_jmdict) is distinct from 'jmdict'
     or (select source from dict_imports where id = p_kanjidic) is distinct from 'kanjidic2'
     or (select source from dict_imports where id = p_kanjivg) is distinct from 'kanjivg' then
    raise exception 'dict_stage_snapshot: imports do not match their sources';
  end if;
  insert into dict_snapshots (jmdict_import_id, kanjidic_import_id, kanjivg_import_id)
    values (p_jmdict, p_kanjidic, p_kanjivg) returning id into v_id;
  return v_id;
end $$;

-- Validation runs BEFORE the flip: a refused snapshot leaves the current active one untouched.
create function dict_activate_snapshot(p_snapshot uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select status into v_status from dict_snapshots where id = p_snapshot for update;
  if v_status is distinct from 'staging' then
    raise exception 'snapshot % is not staging', p_snapshot;
  end if;
  if not exists (select 1 from dict_entries where snapshot_id = p_snapshot)
     or not exists (select 1 from dict_kanji where snapshot_id = p_snapshot)
     or not exists (select 1 from dict_kanji_strokes where snapshot_id = p_snapshot) then
    raise exception 'snapshot % is incomplete', p_snapshot;
  end if;
  if exists (
    select 1 from dict_kanji_words w
    where w.snapshot_id = p_snapshot
      and not exists (select 1 from dict_entries e where e.snapshot_id = p_snapshot and e.ent_seq = w.ent_seq)
  ) then
    raise exception 'snapshot % has dangling kanji words', p_snapshot;
  end if;
  update dict_snapshots set status = 'retired' where status = 'active';
  update dict_snapshots set status = 'active', activated_at = now() where id = p_snapshot;
end $$;

create function dict_rollback_snapshot(p_snapshot uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select status into v_status from dict_snapshots where id = p_snapshot for update;
  if v_status is distinct from 'retired' then
    raise exception 'snapshot % is not retired', p_snapshot;
  end if;
  update dict_snapshots set status = 'retired' where status = 'active';
  update dict_snapshots set status = 'active', activated_at = now() where id = p_snapshot;
end $$;

-- Deletes retired snapshots beyond the newest p_keep retired ones, and abandoned imports: staging snapshots never
-- activated and older than p_staging_grace (a failed import keeps its staging snapshot that long for diagnosis).
-- Their rows go by cascade; import rows no snapshot references, older than the grace, go too. activated_at is
-- what keeps a snapshot that was ever active out of the staging purge — the dictionary gate parks real ones as
-- 'staging'. Returns the number of snapshots deleted.
create function dict_gc_snapshots(p_keep int default 1, p_staging_grace interval default interval '1 day') returns int
language plpgsql security definer set search_path = public as $$
declare v_retired int; v_staging int;
begin
  if p_keep is null or p_keep < 0 then raise exception 'p_keep must be >= 0'; end if;
  if p_staging_grace is null or p_staging_grace < interval '0' then raise exception 'p_staging_grace must be >= 0'; end if;
  with doomed as (
    select id from dict_snapshots
    where status = 'retired'
    order by activated_at desc nulls last, created_at desc
    offset p_keep
  )
  delete from dict_snapshots s using doomed where s.id = doomed.id;
  get diagnostics v_retired = row_count;
  delete from dict_snapshots
    where status = 'staging' and activated_at is null and created_at < now() - p_staging_grace;
  get diagnostics v_staging = row_count;
  delete from dict_imports i
    where imported_at < now() - p_staging_grace
      and not exists (select 1 from dict_snapshots s
                      where i.id in (s.jmdict_import_id, s.kanjidic_import_id, s.kanjivg_import_id));
  return v_retired + v_staging;
end $$;

create function dict_active_snapshot_id() returns uuid
language sql stable security invoker set search_path = public as $$
  select id from dict_snapshots where status = 'active'
$$;

revoke all on function dict_stage_snapshot(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function dict_activate_snapshot(uuid) from public, anon, authenticated;
revoke all on function dict_rollback_snapshot(uuid) from public, anon, authenticated;
revoke all on function dict_gc_snapshots(int, interval) from public, anon, authenticated;
revoke all on function dict_active_snapshot_id() from public, anon;

grant execute on function dict_stage_snapshot(uuid, uuid, uuid) to service_role;
grant execute on function dict_activate_snapshot(uuid) to service_role;
grant execute on function dict_rollback_snapshot(uuid) to service_role;
grant execute on function dict_gc_snapshots(int, interval) to service_role;
grant execute on function dict_active_snapshot_id() to authenticated, service_role;
