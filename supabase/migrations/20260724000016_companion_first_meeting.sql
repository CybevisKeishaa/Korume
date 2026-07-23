-- L9b Companion Presence: allow the `first_meeting` memory type.
--
-- WHY: `docs/superpowers/specs/2026-07-16-companion-system-design.md` §4.3
-- (capture gate) + P9 (§4.1 "Anchor memories") name *first meeting* as one of
-- the relationship's anchor milestones — the `is_anchor` row recorded once,
-- when the learner first opens their Journal. `lib/companion/types.ts` already
-- carries `'first_meeting'` in `MemoryType`, but 20260716000015 shipped the
-- CHECK with only the original seven values, so the write would be rejected
-- with 23514.
--
-- Why this matters more than a normal constraint drift: every Companion write
-- path is deliberately best-effort and swallows its errors (failure isolation
-- — a Companion problem must never break the learner's study session). A
-- rejected insert would therefore be SILENT, and the anchor memory would
-- simply never exist. Nothing would ever surface the bug.
--
-- Postgres has no `alter constraint ... add value`, so a CHECK is widened by
-- drop + re-add. The constraint name is the server-generated default that
-- 20260716000015's inline `check (...)` produced (verified against the running
-- database via `pg_get_constraintdef` on `public.companion_memories`, not
-- guessed). Widening only ever ACCEPTS more rows, so no existing row can fail
-- revalidation and this is non-destructive.
--
-- `dedupe_key` for this type is the bare constant 'first_meeting' (see
-- `dedupeKeyFor` in lib/companion/dedupe.ts) — once-per-lifetime is enforced
-- race-free by the existing `unique (user_id, dedupe_key)`. 20260716000015's
-- dedupe_key example comment lists representative keys, not an exhaustive
-- catalogue, so it stays accurate and is deliberately left untouched (that
-- migration has already been applied everywhere).
--
-- Scope: this constraint and nothing else. No column, grant, policy, index or
-- other constraint is altered — RLS and the no-UPDATE immutability posture
-- (§4.3) of 20260716000015 remain exactly as they were.

alter table companion_memories
  drop constraint companion_memories_memory_type_check;

alter table companion_memories
  add constraint companion_memories_memory_type_check check (memory_type in (
    'first_shadow', 'line_mastered', 'mining_saved', 'first_video_completed',
    'jlpt_passed', 'companion_grew', 'pinned_line', 'first_meeting'
  ));
