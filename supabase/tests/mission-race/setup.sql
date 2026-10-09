\set ON_ERROR_STOP on
delete from auth.users where email = 'missionrace@example.invalid';
delete from kanji where character = '㑂';
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'missionrace@example.invalid', crypt('password123', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

insert into kanji (character) values ('㑂');
insert into user_kanji_progress (user_id, kanji_id, next_review_at)
select u.id, k.id, now() - interval '1 hour'
from users u cross join kanji k
where u.email = 'missionrace@example.invalid' and k.character = '㑂';
