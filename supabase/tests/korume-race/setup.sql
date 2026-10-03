\set ON_ERROR_STOP on
drop table if exists public.korume_race_results, public.korume_race_state, public.korume_race_budget;
delete from ai_usage_charges where fingerprint = 'korumegate-race-turn';
delete from ai_reservations where fingerprint = 'korumegate-race-turn';
delete from auth.users where email = 'korumegate-race-turn@example.invalid';
insert into ai_budget_days (period_day) values ((now() at time zone 'utc')::date) on conflict do nothing;
create table public.korume_race_budget as select * from ai_budget_days where period_day = (now() at time zone 'utc')::date;
create table public.korume_race_state (turn_id uuid not null);
insert into public.korume_race_state values (gen_random_uuid());
create table public.korume_race_results (worker int not null, outcome text not null, reservation_id uuid);
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'korumegate-race-turn@example.invalid', crypt('password123', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);
