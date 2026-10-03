# Branch Run State

Branch `post-korume-stabilization`.

## Goal and scope

Close the known follow-ups of Shadowing 1b (review M5–M9) and Ask Korume (M5 URL, m3 focus, selection-span e2e,
live Gemini smoke), and compare the landing e2e timeouts with master — before Summary/Analysis starts. Bug fixes only.

## Authorities

- Plan: `docs/superpowers/plans/2026-10-03-post-korume-stabilization.md` (tasks S1–S6, diagnosis section).
- `AGENTS.md`, `docs/lessons.md`, `.codex/docs/workflow.md` §8.
- Owner 2026-10-03: this branch before Summary; live Gemini smoke pre-approved ("API free") — seeded demo data only.

## Accepted commits

- (none yet)

## Contracts and decisions

- Packets: `.superpowers/sdd/post-korume-stabilization/task-S<n>-brief.md` (gitignored). Codex never commits, never
  runs Docker / supabase / Playwright / next; Claude runs db reset, `verify:db:*`, e2e, and commits.
- `npx supabase db reset` is owner-approved on this branch (needed after the in-place migration edits). A reset wipes
  the local dictionary and the Ep.729 demo lesson: re-import with the 1b worktree's `.tmp/import.sh` and
  `scripts/seed-real-lesson.ts` before any Chrome or live check.

## Verification

- S1 (Codex, 2026-10-03): folded late-spend lifecycle SQL into 038; added the single expiry-sweeper lock, migration pins (mutation-checked), and the 40-hold/two-day expiry race round. Focused migration tests, `tsc`, lint, and `verify:protocol` passed; Claude owns the required fresh-reset/live DB gates.
  Claude: fresh `db reset`, `verify:db:knowledge` 0 (expiry race PASS) and `verify:db:korume` 0; review fixed two
  race-round defects (all seeds on one day; worker fingerprints matched the seed pattern). DB mutation (sweep
  without the lock, 3 runs) stayed GREEN: the race round is a no-deadlock regression check, not a RED proof; the
  migration pin is the RED guard. vitest supabase/migrations 73/73, tsc 0.
- S2 (Codex, 2026-10-03): added the per-user system-generation daily cap in `038` under the shared user lock, config and dictionary 429 mapping, SQL gate/race coverage, and mutation proofs. Focused Vitest, `tsc`, lint, and `verify:protocol` evidence is recorded in the S2 report; Claude owns the required fresh-reset/live DB gates.
  Claude S2: fresh reset; `verify:db:knowledge` 0 (9b + race f PASS), `verify:db:korume` 0; vitest knowledge/dictionary/
  korume/migrations 348/348; tsc 0.
- S3 (Codex, quota out mid-mutation 2026-10-03 ~21:40, reset 2026-10-04 02:01 → finished by Claude): `readJsonBody`
  streams with a byte cap (413) on both note routes; caps = 12 x code-point max + 1 KiB (worst JSON escape is a
  12-byte surrogate pair; Codex's 6x refused valid escaped notes — review fix); memo key includes the line text.
  Mutations RED: no stream count, text dropped from key, route back on `request.json()`, 6x cap. tsc/lint/protocol 0.
- S4 (Claude): `dict_gc_snapshots(p_keep, p_staging_grace '1 day')` also purges never-activated staging snapshots
  past the grace and orphan imports; gate case 6b RED on the old function (abandoned import survived), GREEN after a
  fresh reset; mutation (drop `activated_at is null`) → gate FAIL 6b (purged the parked shape) + pin RED. Migration
  test 7/7, tsc/lint 0.

## Working tree and environment

- Owner: Claude
- Worktree `.worktrees/post-korume-stabilization`, from master `ea456b8`; `.env.local` copied from the main checkout.

## Blockers

- Codex usage limit until 2026-10-04 02:01 — Claude implements S4 onward (owner standing rule).

## Next actions

- S1 (Codex) → S2 → S3 → S4 → S5 → S6 (Claude).
