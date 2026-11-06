-- port-kanji (spec 2026-11-06 §4.3): kanji SRS progress keyed by the kanji literal, so any dictionary kanji can be
-- reviewed, not only the curated `kanji` rows. kanji.character is unique, so kanji_id -> literal is one-to-one and
-- every existing row keeps its values under its new key.
alter table user_kanji_progress add column literal text;
update user_kanji_progress u set literal = k.character from kanji k where k.id = u.kanji_id;
alter table user_kanji_progress
  alter column literal set not null,
  add constraint user_kanji_progress_literal_check check (char_length(literal) = 1);
alter table user_kanji_progress drop constraint user_kanji_progress_pkey;
alter table user_kanji_progress add primary key (user_id, literal);
-- Also drops user_kanji_progress_kanji_id_fkey. The (user_id, next_review_at) index and kanji_progress_own stay.
alter table user_kanji_progress drop column kanji_id;
alter table user_kanji_progress
  add column reviews int not null default 0,
  add column lapses int not null default 0;

-- Stored mission keys ('<itemType>:<itemId>', lib/gamification/source-id.ts) follow the new item id.
update learning_outcomes o set item_key = 'kanji:' || k.character from kanji k where o.item_key = 'kanji:' || k.id;
update daily_mission_eligible e set item_key = 'kanji:' || k.character from kanji k where e.item_key = 'kanji:' || k.id;

-- Same definition as 20261008000045_port_dashboard.sql, keyed by literal.
create or replace function review_due_keys(p_user uuid, p_decks text[], p_at timestamptz)
  returns table (deck text, item_key text)
  language sql stable security invoker set search_path = public
as $$
  select 'kanji', 'kanji:' || k.literal from user_kanji_progress k
  where k.user_id = p_user and 'kanji' = any (p_decks) and (k.next_review_at is null or k.next_review_at <= p_at)
  union all
  select 'vocab', 'vocab:' || v.vocab_id from user_vocab_progress v
  where v.user_id = p_user and 'vocab' = any (p_decks) and (v.next_review_at is null or v.next_review_at <= p_at)
  union all
  select 'mining', m.id::text from sentence_mining_cards m
  where m.user_id = p_user and 'mining' = any (p_decks) and (m.next_review_at is null or m.next_review_at <= p_at);
$$;
revoke execute on function review_due_keys(uuid, text[], timestamptz) from public, anon;
grant execute on function review_due_keys(uuid, text[], timestamptz) to authenticated, service_role;
