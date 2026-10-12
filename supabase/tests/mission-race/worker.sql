select pg_advisory_lock_shared(7302);
select id as user_id from users where email = 'missionrace@example.invalid' \gset
select ensure_daily_mission(
  :'user_id'::uuid,
  array['mining', 'kanji'],
  '{"review":20,"shadow_lines":3,"dictation_lines":5}'::jsonb,
  '[]'::jsonb
) as mission_id \gset
insert into learning_outcomes (user_id, source_type, item_key)
select :'user_id'::uuid, 'srs_review', 'kanji:' || kanji_id::text
from user_kanji_progress where user_id = :'user_id'::uuid;
select pg_advisory_lock_shared(7303);
select * from claim_daily_mission(:'user_id'::uuid, :'mission_id'::uuid, 50);
