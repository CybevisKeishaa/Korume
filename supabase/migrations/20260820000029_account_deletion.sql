-- Account closure and GDPR erasure (CLAUDE.md §2 rule 2, owed since Layer 1).
-- Design: docs/superpowers/specs/2026-08-20-l9b-plan1-gdpr-design.md §5.

create type deletion_tier   as enum ('close_account', 'erase_all');
create type deletion_status as enum ('pending', 'cancelled', 'executed', 'purged');

create table account_deletion_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users (id) on delete cascade,
  tier          deletion_tier not null,
  status        deletion_status not null default 'pending',
  requested_at  timestamptz not null default now(),
  execute_after timestamptz not null,
  purge_after   timestamptz,
  cancelled_at  timestamptz,
  executed_at   timestamptz
);

-- Partial, not plain: a user who cancels must be able to request again.
create unique index account_deletion_requests_one_live
  on account_deletion_requests (user_id) where status = 'pending';

create index account_deletion_requests_due
  on account_deletion_requests (status, execute_after);

-- Tombstone survives the users row, so it carries NO foreign key by design.
create table account_deletion_tombstones (
  user_id     uuid primary key,
  tier        deletion_tier not null,
  executed_at timestamptz not null,
  purge_after timestamptz not null
);

alter table account_deletion_requests   enable row level security;
alter table account_deletion_tombstones enable row level security;

-- A user may see and create their own request. Every TRANSITION is the
-- service role's: status is not client-writable, or "cancelled" could be
-- forged into "executed" and back.
create policy account_deletion_requests_select_own on account_deletion_requests
  for select to authenticated using (user_id = auth.uid());

create policy account_deletion_requests_insert_own on account_deletion_requests
  for insert to authenticated with check (user_id = auth.uid() and status = 'pending');

-- Defence in depth, per 20260819000028: RLS alone holding a table shut is a
-- boundary that refuses SILENTLY. Revoking makes the refusal observable.
revoke update, delete on account_deletion_requests from authenticated;
revoke insert, update, delete, select on account_deletion_tombstones from authenticated, anon;

alter table users add column model_training_consent boolean not null default false;

comment on column users.model_training_consent is
  'CLAUDE.md §2 rule 2 consent: using this user''s data (including voice '
  'recordings) to TRAIN models. Personalising the Companion from memory is '
  'not covered here and needs no consent — it is not model training. '
  'No training pipeline exists yet; this is a stored preference and a '
  'documented gate, not a live switch.';

-- Same asymmetry 20260714000014_community_admin.sql closed for leaderboard_opt_in:
-- `users` carries a COLUMN-scoped update grant to `authenticated` (not the
-- table-wide one), so a new column is invisible to the client until it is
-- named here explicitly — RLS's `users_update_own` row check (id = auth.uid())
-- never even gets evaluated without it, because column privileges are
-- enforced before RLS. model_training_consent is an ordinary self-editable
-- preference (same trust level as leaderboard_opt_in), so it belongs in the
-- grant, not left as a column only the service role can write.
grant update (model_training_consent) on users to authenticated;
