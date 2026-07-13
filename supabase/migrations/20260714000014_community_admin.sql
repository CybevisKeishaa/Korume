-- Layer 7: Community + Admin CMS + Leaderboard (spec §4 community/admin tables
-- + CLAUDE.md §5 differentiators). forum_posts/forum_comments/user_playlists/
-- user_playlist_items already exist with owner-scoped RLS from
-- 20260712000001_schema.sql / 20260712000002_rls.sql — this migration adds:
-- an admin role flag on users, a leaderboard opt-in, forum topics, public
-- playlists, and an explicit-consent shadowing peer-review queue.

-- ---------------------------------------------------------------------------
-- 1. users — admin role + leaderboard opt-in.
-- ---------------------------------------------------------------------------
-- is_admin gates the admin CMS (video approval queue, content moderation).
-- It must NEVER be settable by the client — a user granting themselves
-- is_admin would be a full privilege escalation. ADMIN_EMAILS bootstrap sync
-- (backend-engineer, server-side only) and any future admin promotion both
-- write through the service role, which bypasses RLS/grants entirely.
--
-- leaderboard_opt_in is the opposite case: an ordinary profile preference the
-- owner should be able to flip themselves, same trust level as name/level/
-- target_goal below.
alter table users
  add column is_admin boolean not null default false,
  add column leaderboard_opt_in boolean not null default false;

-- Tiny partial index for the admin CMS's "who are the admins" lookup — the
-- predicate keeps it near-empty since is_admin is false for almost every row.
create index idx_users_admin on users (id) where is_admin;

-- users existed BEFORE 20260712000006_grants.sql, so `authenticated` already
-- holds a table-wide UPDATE grant on it (that one-time grant covers every
-- pre-existing table, unlike `alter default privileges`, which only covers
-- tables created afterwards). Combined with users_update_own's row check
-- (id = auth.uid()) but NO column restriction, that means today any signed-in
-- user can update EVERY column of their own row via the client. RLS gates
-- rows, not columns (repeated pattern across this repo) — is_admin must not
-- inherit that same blanket permission, so close the table-level grant and
-- reopen it column-scoped.
--
-- Column set below = the pre-existing full column list (preserved, not
-- narrowed) plus leaderboard_opt_in (new, explicitly self-editable per this
-- layer's spec), minus is_admin (new, service-role only) — with one
-- deliberate exception: `id` is excluded. Granting UPDATE on a primary key
-- that is also a foreign key into auth.users has no legitimate client use
-- case, and while users_update_own's `with check (id = auth.uid())` already
-- makes an actual id change impossible today (the new row would fail the
-- check), there is no reason to also hand out the column privilege for it.
-- This is a narrower judgment call than a byte-for-byte preservation of the
-- old grant, called out here for the record: `email` and `created_at` ARE
-- preserved as client-writable even though that is arguably too permissive
-- (email should probably sync from auth.users; created_at should probably be
-- immutable) — tightening those is left as a follow-up, out of scope for
-- this migration, rather than silently changing behavior no one asked about.
revoke update on users from authenticated;
grant update (
  email, name, avatar_url, level, target_goal, daily_minutes,
  created_at, updated_at, leaderboard_opt_in
) on users to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Leaderboard support — xp_events index for weekly aggregation.
-- ---------------------------------------------------------------------------
-- idx_xp_events_user_created (user_id, created_at desc) from
-- 20260713000013_gamification.sql serves "my XP history" lookups. The weekly
-- leaderboard instead scans/aggregates ACROSS users for a date range
-- (`where created_at >= <week start> group by user_id`), which wants
-- created_at as the leading column.
create index idx_xp_events_created_at on xp_events (created_at);

-- No RLS change: xp_events_select_own (20260713000013_gamification.sql)
-- already restricts `authenticated` to `user_id = auth.uid()`, so a client
-- cannot read anyone else's XP ledger regardless of this index. The
-- leaderboard query aggregates xp_events for leaderboard_opt_in = true users
-- and runs via the service role (bypasses RLS by design, same trust
-- boundary as every other cross-user aggregate in this codebase, e.g. badge
-- award checks) — never as a direct client query. backend-engineer: do not
-- add a permissive cross-user SELECT policy on xp_events to make this
-- "simpler" client-side; that would leak every user's raw XP event stream.

-- ---------------------------------------------------------------------------
-- 3. forum_posts — topics + updated_at.
-- ---------------------------------------------------------------------------
alter table forum_posts
  add column topic text not null default 'general'
    check (topic in ('general', 'grammar', 'vocab', 'listening', 'speaking', 'jlpt', 'study-tips')),
  add column updated_at timestamptz not null default now();

-- Keep updated_at honest on edits, same mechanism as users_set_updated_at
-- (set_updated_at() defined in 20260712000001_schema.sql).
create trigger forum_posts_set_updated_at
  before update on forum_posts
  for each row execute function set_updated_at();

create index idx_forum_posts_topic_created on forum_posts (topic, created_at desc);
create index idx_forum_comments_post_created on forum_comments (post_id, created_at);
-- idx_forum_comments_post (post_id) from 20260712000003_indexes.sql becomes
-- a redundant prefix of the composite above; left in place — dropping an
-- unrelated pre-existing index is out of scope for this migration.

-- forum_comments policy check (per task): 20260712000002_rls.sql already
-- defines the full set — forum_comments_read (select, true),
-- forum_comments_insert (user_id = auth.uid()), forum_comments_modify
-- (update, owner), forum_comments_delete (owner). Nothing missing; no
-- policy changes needed here.

-- ---------------------------------------------------------------------------
-- 4. user_playlists — public playlists (opt-in browsing).
-- ---------------------------------------------------------------------------
alter table user_playlists
  add column is_public boolean not null default false,
  add column description text;

-- Additive SELECT policies. Postgres OR's multiple permissive policies for
-- the same command together, so these sit alongside (not instead of) the
-- existing owner-scoped `for all` policies (playlists_own / playlist_items_own,
-- 20260712000002_rls.sql) — an owner keeps full CRUD on their own rows
-- regardless of is_public, and any signed-in user additionally gains SELECT
-- on rows/items whose parent playlist has opted into public browsing.
create policy playlists_public_read on user_playlists for select to authenticated
  using (is_public);

create policy playlist_items_public_read on user_playlist_items for select to authenticated
  using (exists (
    select 1 from user_playlists p
    where p.id = user_playlist_items.playlist_id and p.is_public
  ));

create index idx_user_playlists_public_created
  on user_playlists (is_public, created_at desc)
  where is_public;

-- ---------------------------------------------------------------------------
-- 5. Shadowing peer review — explicit, revocable, per-recording consent to
--    share (CLAUDE.md §2: voice recordings belong to the user; not public by
--    default). A row in peer_review_shares IS the consent record for exactly
--    one recording; deleting it revokes consent (cascade removes any reviews
--    written against it too, since a review of a share that no longer exists
--    is meaningless).
-- ---------------------------------------------------------------------------
create table peer_review_shares (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references shadowing_sessions (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  line_text text not null, -- denormalized transcript line so reviewers see what was read, without needing read access to transcript_lines' owning video
  note text,
  created_at timestamptz not null default now()
);

alter table peer_review_shares enable row level security;

-- Public queue: any signed-in user may see what has been explicitly shared.
create policy peer_review_shares_read on peer_review_shares for select to authenticated
  using (true);

-- Sharing is opt-in per recording, and only the session's owner may opt it
-- in. The exists() join (not just `user_id = auth.uid()`) additionally
-- guards against a client setting user_id = auth.uid() while pointing
-- session_id at someone else's session — both must line up.
create policy peer_review_shares_insert on peer_review_shares for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from shadowing_sessions s
      where s.id = peer_review_shares.session_id and s.user_id = auth.uid()
    )
  );

-- Revoking consent = deleting the share row. Owner-only.
create policy peer_review_shares_delete on peer_review_shares for delete to authenticated
  using (user_id = auth.uid());

-- No UPDATE policy — a share is either present (shared) or absent (not
-- shared); there is no "edit a share" concept, so RLS default-denies UPDATE.
-- peer_review_shares is a table created AFTER 20260712000006_grants.sql, so
-- `alter default privileges` auto-granted `authenticated` a table-wide UPDATE
-- at CREATE TABLE time. Close that table-level lock explicitly too (same
-- belt-and-suspenders precedent as xp_events / reading_passages), even
-- though RLS already blocks it with no matching policy.
revoke update on peer_review_shares from authenticated;

grant select, insert, delete on peer_review_shares to authenticated;
grant all on peer_review_shares to service_role;

create index idx_peer_review_shares_user_created
  on peer_review_shares (user_id, created_at desc);

-- IMPORTANT: the actual recording audio stays in the private `recordings`
-- Storage bucket (20260712000007_recordings_bucket.sql), whose owner-path
-- RLS policies are untouched by this migration. Sharing a session does NOT
-- change storage access. The reviewer-facing API mints a short-lived signed
-- URL via the service role only for sessions that have an active
-- peer_review_shares row — a reviewer never gets a durable/public link, and
-- deleting the share row (revoking consent) stops any new signed URL from
-- being issued for that recording.

create table peer_reviews (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references peer_review_shares (id) on delete cascade,
  reviewer_id uuid not null references users (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text not null,
  created_at timestamptz not null default now(),
  unique (share_id, reviewer_id) -- one review per reviewer per share
);

alter table peer_reviews enable row level security;

create policy peer_reviews_read on peer_reviews for select to authenticated
  using (true); -- the review queue is public, same as the shares themselves

-- Reviewers must not review their own share. A same-table CHECK constraint
-- can't express this (it needs to compare against a DIFFERENT table's row —
-- Postgres CHECK constraints only see the row being written), and a trigger
-- to enforce it is overkill for what the API already validates before
-- insert. The primary guard is therefore in the API layer (backend-engineer).
--
-- That said, RLS policies (unlike CHECK constraints) CAN reference other
-- tables in their USING/WITH CHECK clause — this repo already does that for
-- ownership derivation (e.g. playlist_items_own, conversation_messages_own).
-- Adding the same `not exists` guard here costs nothing extra (no new
-- trigger/object, just one more join clause on a policy this table needs
-- regardless) and closes the self-review hole at the DB layer too, so it is
-- included as defense-in-depth alongside the API check, not instead of it.
create policy peer_reviews_insert on peer_reviews for insert to authenticated
  with check (
    reviewer_id = auth.uid()
    and not exists (
      select 1 from peer_review_shares s
      where s.id = peer_reviews.share_id and s.user_id = auth.uid()
    )
  );

create policy peer_reviews_update on peer_reviews for update to authenticated
  using (reviewer_id = auth.uid()) with check (reviewer_id = auth.uid());

create policy peer_reviews_delete on peer_reviews for delete to authenticated
  using (reviewer_id = auth.uid());

grant select, insert, update, delete on peer_reviews to authenticated;
grant all on peer_reviews to service_role;

create index idx_peer_reviews_reviewer_created
  on peer_reviews (reviewer_id, created_at desc);
-- unique(share_id, reviewer_id) above already creates an index with share_id
-- as its leading column, covering the "reviews for this share" lookup.
