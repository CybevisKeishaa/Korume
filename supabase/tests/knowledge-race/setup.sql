\set ON_ERROR_STOP on
drop table if exists public.knowledge_race_results, public.knowledge_race_state, public.knowledge_race_budget;
create table public.knowledge_race_results (case_name text not null, outcome text not null, reservation_id uuid);
create table public.knowledge_race_state (key text primary key, value numeric not null);
delete from ai_usage_charges where fingerprint like 'kgate-race-%';
delete from ai_reservations where fingerprint like 'kgate-race-%';
delete from knowledge_entries where fingerprint like 'kgate-race-%';
delete from auth.users where email like 'knowledgegate-race-%@example.invalid';
-- The expiry round touches today and yesterday; snapshot both rows, including whether they existed.
create table public.knowledge_race_budget (
  period_day date primary key,
  existed boolean not null,
  reserved_usd numeric(12, 6),
  spent_usd numeric(12, 6)
);
insert into public.knowledge_race_budget (period_day, existed, reserved_usd, spent_usd)
select days.period_day, budget.period_day is not null, budget.reserved_usd, budget.spent_usd
from (values ((now() at time zone 'utc')::date), ((now() at time zone 'utc')::date - 1)) as days(period_day)
left join ai_budget_days budget on budget.period_day = days.period_day;
insert into ai_budget_days (period_day)
select period_day from knowledge_race_budget on conflict do nothing;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'knowledgegate-race-' || name || '@example.invalid', crypt('password123', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
from unnest(array['plus-b', 'plus-c', 'free-a', 'free-b', 'system']
  || array(select 'budget-' || i from generate_series(1, 20) i)
  || array(select 'expiry-' || i from generate_series(1, 20) i)) as name;

insert into ai_reservations (requested_by_user_id, billing_scope, entitlement_kind, fingerprint, reserved_credits,
  reserved_usd, status, expires_at, period_day, period_month)
select (select id from users where email = 'knowledgegate-race-expiry-' || i || '@example.invalid'),
  'learner', 'plus_section', 'kgate-race-expseed-' || i || '-' || j, 0, 0.01, 'held', now() - interval '1 minute',
  days.period_day, date_trunc('month', days.period_day)::date
from generate_series(1, 20) i cross join generate_series(1, 2) j
cross join lateral (
  select case when j = 1 then (now() at time zone 'utc')::date else (now() at time zone 'utc')::date - 1 end as period_day
) days;
update ai_budget_days b set reserved_usd = reserved_usd + seeded.usd
from (
  select period_day, sum(reserved_usd) as usd from ai_reservations
  where fingerprint like 'kgate-race-expseed-%' group by period_day
) seeded where b.period_day = seeded.period_day;
