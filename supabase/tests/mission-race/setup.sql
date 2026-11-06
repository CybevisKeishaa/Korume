\set ON_ERROR_STOP on
delete from auth.users where email = 'missionrace@example.invalid';
-- Before 055 the harness inserted a curated kanji row and never removed it; drop that leftover.
delete from kanji where character = '㑂';
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'missionrace@example.invalid', crypt('password123', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

insert into user_kanji_progress (user_id, literal, next_review_at)
select u.id, '㑂', now() - interval '1 hour'
from users u
where u.email = 'missionrace@example.invalid';
