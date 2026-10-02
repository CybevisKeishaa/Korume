\set ON_ERROR_STOP on
drop table if exists public.knowledge_race_results, public.knowledge_race_state, public.knowledge_race_budget;
create table public.knowledge_race_results (case_name text not null, outcome text not null, reservation_id uuid);
create table public.knowledge_race_state (key text primary key, value numeric not null);
delete from ai_usage_charges where fingerprint like 'kgate-race-%';
delete from ai_reservations where fingerprint like 'kgate-race-%';
delete from knowledge_entries where fingerprint like 'kgate-race-%';
delete from auth.users where email like 'knowledgegate-race-%@example.invalid';
-- Today's budget row is shared with real local usage: snapshot it, restore it in assert.sql.
insert into ai_budget_days (period_day) values ((now() at time zone 'utc')::date) on conflict do nothing;
create table public.knowledge_race_budget as
  select * from ai_budget_days where period_day = (now() at time zone 'utc')::date;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'knowledgegate-race-' || name || '@example.invalid', crypt('password123', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
from unnest(array['plus-b', 'plus-c', 'free-a', 'free-b']
  || array(select 'budget-' || i from generate_series(1, 20) i)) as name;
