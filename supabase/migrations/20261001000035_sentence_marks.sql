-- Explicit, learner-set lightweight marks on one transcript line (spec 2026-10-01 part 1a §5.1, Q5).
-- Pin (companion_memories) and Mining (sentence_mining_cards) are separate systems; derived
-- difficulty is computed from learning evidence and is never written here.
create table sentence_marks (
  user_id uuid not null references users (id) on delete cascade,
  transcript_line_id uuid not null references transcript_lines (id) on delete cascade,
  kind text not null check (kind in ('bookmark', 'difficult')),
  created_at timestamptz not null default now(),
  primary key (user_id, transcript_line_id, kind)
);

alter table sentence_marks enable row level security;

create policy sentence_marks_select_own on sentence_marks
  for select to authenticated using (user_id = auth.uid());
-- The exists runs under the learner's own transcript_lines RLS: a line they cannot read cannot be marked.
create policy sentence_marks_insert_own on sentence_marks
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from transcript_lines tl where tl.id = transcript_line_id)
  );
create policy sentence_marks_delete_own on sentence_marks
  for delete to authenticated using (user_id = auth.uid());

-- No update: a mark is a fact with a time, toggled by insert and delete.
grant select, insert, delete on sentence_marks to authenticated;
revoke update on sentence_marks from authenticated;
grant all on sentence_marks to service_role;
