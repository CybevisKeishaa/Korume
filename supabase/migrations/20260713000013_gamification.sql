-- Layer 6: Gamification + Notifications (spec §4 gamification tables +
-- CLAUDE.md §5 product priorities). user_stats/badges/user_badges already
-- exist from 20260712000001_schema.sql; this migration adds the XP ledger
-- that feeds them, an in-app notification inbox, and expands the badge
-- catalog. No spec §4 line item covers xp_events/notifications by name —
-- they are the mechanism behind "XP, streak, badges, SRS-due reminders"
-- (workflow.md Layer 6) and follow the same conventions as the existing
-- gamification tables.

-- ---------------------------------------------------------------------------
-- 1. xp_events — append-only XP ledger, written ONLY by the service role.
-- ---------------------------------------------------------------------------
-- Per product principle G1, XP is awarded for completed learning outcomes,
-- not repeated app activity (e.g. re-opening a lesson does not re-award XP).
-- source_id is a natural key for the learning unit that earned the award
-- (e.g. '<lineId>:<yyyy-mm-dd>' in VN local date for a shadowing/dictation
-- rep, or a submission id for jlpt/reading), so the same outcome can never
-- be awarded twice — the unique constraint below is the idempotency
-- guarantee, enforced by the DB rather than trusted to application logic.
create table xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  source_type text not null check (source_type in (
    'srs_review', 'dictation', 'shadowing', 'mining_review',
    'jlpt_submit', 'reading_submit', 'conversation'
  )),
  source_id text not null,
  xp int not null check (xp > 0),
  created_at timestamptz not null default now(),
  unique (user_id, source_type, source_id)
);

alter table xp_events enable row level security;

create policy xp_events_select_own on xp_events for select to authenticated
  using (user_id = auth.uid());
-- No insert/update/delete policy for `authenticated` — this is a ledger of
-- record. A client that could insert its own rows could mint arbitrary XP;
-- awarding always happens server-side (service role) after validating the
-- underlying learning outcome (SRS review recorded, shadowing session
-- scored, JLPT test submitted, etc.), the same trust boundary already
-- documented for user_stats in 20260712000002_rls.sql.

-- xp_events is a table created AFTER 20260712000006_grants.sql, so
-- `alter default privileges ... grant select, insert, update, delete on
-- tables to authenticated` fires automatically at CREATE TABLE time and
-- hands `authenticated` a table-wide INSERT/UPDATE/DELETE grant that RLS's
-- missing write policies do also block — but per the reading_jlpt.sql
-- precedent we close both layers explicitly rather than relying on RLS
-- alone: revoke the write grants so the table-level lock matches the
-- row-level one.
grant select on xp_events to authenticated;
revoke insert, update, delete on xp_events from authenticated;
grant all on xp_events to service_role;

create index idx_xp_events_user_created on xp_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. notifications — in-app notification inbox (badge_earned, level_up,
--    srs_due). Written by the service role; the client may only mark its
--    own notifications read.
-- ---------------------------------------------------------------------------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  type text not null check (type in ('badge_earned', 'level_up', 'srs_due')),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

create policy notifications_select_own on notifications for select to authenticated
  using (user_id = auth.uid());

-- Owner may mark their own notifications read, and nothing else: the policy
-- allows UPDATE on owned rows, but the column-scoped grant below (applied
-- after revoking the table-wide UPDATE the default-privileges rule handed
-- out at CREATE TABLE time) restricts that UPDATE to the read_at column
-- only, so a client cannot rewrite type/payload/user_id on its own rows.
create policy notifications_update_own on notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on notifications to authenticated;
revoke update on notifications from authenticated;
grant update (read_at) on notifications to authenticated;
-- No insert/delete grant for `authenticated` — notifications are created
-- server-side only (service role), when XP/badge/SRS-due events occur.
revoke insert, delete on notifications from authenticated;
grant all on notifications to service_role;

create index idx_notifications_user_created on notifications (user_id, created_at desc);
-- Unread-count / inbox-badge queries only ever filter on read_at is null,
-- so a partial index keeps it small regardless of inbox history size.
create index idx_notifications_user_unread on notifications (user_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- 3. Badge catalog expansion. criteria shapes are a fixed contract with
--    lib/gamification (backend-engineer) — do not alter the shapes of the
--    three existing badges (first_steps/week_streak/hundred_kanji) or these.
-- ---------------------------------------------------------------------------
insert into badges (name, description, criteria) values
  ('month_streak', 'Studied 30 days in a row.', '{"type":"streak","days":30}'::jsonb),
  ('xp_1000', 'Earned 1,000 XP.', '{"type":"xp","total":1000}'::jsonb),
  ('xp_10000', 'Earned 10,000 XP.', '{"type":"xp","total":10000}'::jsonb),
  ('dictation_50', 'Completed 50 dictation exercises.', '{"type":"outcome_count","source":"dictation","count":50}'::jsonb),
  ('shadowing_50', 'Completed 50 shadowing sessions.', '{"type":"outcome_count","source":"shadowing","count":50}'::jsonb),
  ('reading_10', 'Finished 10 reading passages.', '{"type":"outcome_count","source":"reading_submit","count":10}'::jsonb),
  ('n5_mock', 'Completed a full N5 mock test.', '{"type":"jlpt_mock","level":"N5"}'::jsonb),
  ('n4_mock', 'Completed a full N4 mock test.', '{"type":"jlpt_mock","level":"N4"}'::jsonb)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- 4. user_badges hardening — writes are service-role only.
-- ---------------------------------------------------------------------------
-- user_badges was created in 20260712000001_schema.sql, BEFORE
-- 20260712000006_grants.sql ran its one-time
-- `grant select, insert, update, delete on all tables in schema public to
-- authenticated`. That statement applies to every table that already
-- existed at the time it ran (unlike `alter default privileges`, which only
-- covers tables created afterwards) — so `authenticated` currently holds a
-- table-wide INSERT/UPDATE/DELETE grant on user_badges. RLS already
-- default-denies those operations today because 20260712000002_rls.sql only
-- ever added a SELECT policy (user_badges_read_own), but per the
-- belt-and-suspenders precedent set for reading_passages in
-- 20260713000011_reading_jlpt.sql, close the table-level lock explicitly too
-- rather than relying on the RLS gate alone — badge awarding happens only
-- via the service role after criteria are verified server-side.
revoke insert, update, delete on user_badges from authenticated;

-- Same reasoning, same one-time-grant exposure, for user_stats — the XP /
-- streak store and the highest-value fabrication target in this layer. Only
-- stats_select_own (SELECT) exists in RLS, so writes are already denied, but
-- close the table-level grant explicitly too: all XP/streak mutation goes
-- through the service-role award pipeline (lib/data/gamification.ts).
revoke insert, update, delete on user_stats from authenticated;
