-- Kanji a learner starred (port-kanji spec §4.4). Keyed by the literal like user_kanji_progress: any dictionary
-- kanji, curated or not. The data layer checks the literal against the active snapshot; the table only pins its shape.
create table user_kanji_favorites (
  user_id uuid not null references users (id) on delete cascade,
  literal text not null check (char_length(literal) = 1),
  created_at timestamptz not null default now(),
  primary key (user_id, literal)
);

alter table user_kanji_favorites enable row level security;

create policy user_kanji_favorites_select_own on user_kanji_favorites
  for select to authenticated using (user_id = auth.uid());
create policy user_kanji_favorites_insert_own on user_kanji_favorites
  for insert to authenticated with check (user_id = auth.uid());
create policy user_kanji_favorites_delete_own on user_kanji_favorites
  for delete to authenticated using (user_id = auth.uid());

-- No update: a favorite is a fact with a time, toggled by insert and delete.
grant select, insert, delete on user_kanji_favorites to authenticated;
revoke update on user_kanji_favorites from authenticated;
grant all on user_kanji_favorites to service_role;
