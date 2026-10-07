\set ON_ERROR_STOP on
drop table if exists public.xp_race_results;
delete from auth.users where email = 'xpgate-race@example.invalid';
create table public.xp_race_results (worker int not null, awarded int not null);
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'xpgate-race@example.invalid', crypt('password123', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);
