-- Learner notes on one transcript line and on one lesson (spec 2026-10-02 part 1b §4.4, §5.5).
-- An empty note is a deleted row, so a stored body is never empty. Both cascade with the user,
-- so account deletion needs nothing extra.
create table sentence_notes (
  user_id uuid not null references users (id) on delete cascade,
  transcript_line_id uuid not null references transcript_lines (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  updated_at timestamptz not null default now(),
  primary key (user_id, transcript_line_id)
);

create table lesson_notes (
  user_id uuid not null references users (id) on delete cascade,
  video_id uuid not null references videos (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 20000),
  updated_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

-- An upsert's DO UPDATE fires the update trigger, so the clock is the database's, never the client's.
create trigger sentence_notes_set_updated_at before update on sentence_notes
  for each row execute function set_updated_at();
create trigger lesson_notes_set_updated_at before update on lesson_notes
  for each row execute function set_updated_at();

alter table sentence_notes enable row level security;
alter table lesson_notes enable row level security;

-- Each exists runs under the learner's own RLS: a line or lesson they cannot read cannot carry a note,
-- even when its UUID is known.
create policy sentence_notes_select_own on sentence_notes
  for select to authenticated using (user_id = auth.uid());
create policy sentence_notes_insert_own on sentence_notes
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from transcript_lines tl where tl.id = transcript_line_id)
  );
create policy sentence_notes_update_own on sentence_notes
  for update to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (select 1 from transcript_lines tl where tl.id = transcript_line_id)
  );
create policy sentence_notes_delete_own on sentence_notes
  for delete to authenticated using (user_id = auth.uid());

create policy lesson_notes_select_own on lesson_notes
  for select to authenticated using (user_id = auth.uid());
create policy lesson_notes_insert_own on lesson_notes
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from videos v where v.id = video_id)
  );
create policy lesson_notes_update_own on lesson_notes
  for update to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (select 1 from videos v where v.id = video_id)
  );
create policy lesson_notes_delete_own on lesson_notes
  for delete to authenticated using (user_id = auth.uid());

revoke all on sentence_notes from anon;
revoke all on lesson_notes from anon;
grant select, insert, update, delete on sentence_notes to authenticated;
grant select, insert, update, delete on lesson_notes to authenticated;
grant all on sentence_notes to service_role;
grant all on lesson_notes to service_role;
