-- Companion memories / Journal (docs/superpowers/specs/2026-07-16-companion-system-design.md §4).
-- Compliant by design: NO media (CLAUDE.md §2.1) — only pointers into the
-- existing transcript_line + the line's own text. Same no-media posture as
-- sentence_mining_cards (20260712000008). Immutability (§4.3) is enforced by
-- granting no UPDATE; privacy (§12.4) by owner-only RLS. Discovered memories
-- are written by the service role (the capture gate); gifted memories are
-- written by the authenticated learner (an explicit pin).

create table companion_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  kind text not null check (kind in ('discovered', 'gifted')),
  memory_type text not null check (memory_type in (
    'first_shadow', 'line_mastered', 'mining_saved', 'first_video_completed',
    'jlpt_passed', 'companion_grew', 'pinned_line'
  )),
  title text,
  -- Pointer to the moment (NO media): replay = seek the YouTube IFrame to
  -- timestamp_seconds; line_text_jp is study text, not a scene image.
  video_id uuid references videos (id) on delete set null,
  transcript_line_id uuid references transcript_lines (id) on delete set null,
  timestamp_seconds numeric(10, 3),
  line_text_jp text,
  note text,                       -- learner's own words (gifted only)
  is_anchor boolean not null default false,
  -- Natural idempotency key (§4.3): a qualifying event records at most once.
  -- e.g. 'first_shadow', 'companion_grew:2', 'line_mastered:<lineId>',
  -- 'mining_saved:<cardId>', 'jlpt_passed:N4', 'pinned_line:<lineId>'.
  dedupe_key text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

-- Journal timeline query (§4.2: always ordered by occurred_at).
create index companion_memories_timeline_idx
  on companion_memories (user_id, occurred_at desc);
-- Anchor lookup for bounded reflection (§6.4) — partial index, anchors are few.
create index companion_memories_anchor_idx
  on companion_memories (user_id) where is_anchor;

alter table companion_memories enable row level security;

-- Owner reads own Journal (§12.4 private by design).
create policy companion_memories_select_own on companion_memories
  for select to authenticated using (user_id = auth.uid());

-- Learner may insert ONLY their own GIFTED memories (a pin). Discovered
-- memories are the capture gate's job and come through the service role, so a
-- learner can never forge one.
create policy companion_memories_insert_gifted on companion_memories
  for insert to authenticated with check (user_id = auth.uid() and kind = 'gifted');

-- Owner may remove their own memory (un-pin / retract). No UPDATE policy or
-- grant exists anywhere: recorded memories are immutable at runtime (§4.3).
create policy companion_memories_delete_own on companion_memories
  for delete to authenticated using (user_id = auth.uid());

-- Explicit grants (see 20260712000006_grants.sql header for the 42501 gotcha
-- this guards against). Deliberately NO `update` grant → immutability.
grant select, insert, delete on companion_memories to authenticated;
grant all on companion_memories to service_role;

-- 20260712000006_grants.sql's `alter default privileges` already grants
-- select/insert/update/delete on every new table to `authenticated` at
-- CREATE TABLE time, before the line above ever runs (GRANT is additive, not
-- exclusive, so re-granting select/insert/delete does not drop update). This
-- table's whole immutability guarantee (§4.3) depends on UPDATE being absent,
-- so it must be revoked explicitly — same idiom as
-- 20260712000009_video_write_policies.sql ("revoke update on videos ..."),
-- 20260712000010_ai_features.sql, 20260713000011_reading_jlpt.sql, and
-- 20260713000013_gamification.sql.
revoke update on companion_memories from authenticated;
