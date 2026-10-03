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
- S5 (Claude): `KorumeChatPage` keys its own conversation (server page no longer keys it); a free chat's created
  thread shares the free key, so `router.refresh()` under `?thread` does not remount; `history.replaceState` puts the
  thread in the URL (Next 14.2.35 patches it); every remount after the first autofocuses the composer. Unit: 4 new,
  mutations RED (no replaceState / no alias / no focus). e2e korume + korume-threads 8/8 on a clean worktree build
  (AI_PROVIDER=none); e2e mutation build (no alias + no focus) → test 6 RED (question lost on remount) and test 2 RED
  (focus). New e2e 6 (URL by replace, Back → dashboard) and 7 (selection span posted as {start 0, end 2}).
  Note: the sheet chip always shows the whole line, not the span — unchanged design, not invented here.
- S6 (Claude, 2026-10-04):
  - Landing: `landing-page.spec.ts` 24/24, then 72/72 with `--repeat-each=3`, on this branch's worktree build — the 4
    ask-korume timeouts do not reproduce; no landing fix here.
  - Full gates after the last product edit before S6: vitest 514 files / 4591 tests; full default e2e 116 passed,
    1 failed = `shadowing-explore` at 1024px (Enter on the card before the dialog opens under parallel load), 12/12
    alone with `--repeat-each=3` — the known parallel-load flake family (2026-09-25), untouched by this branch.
  - LIVE GEMINI SMOKE (owner-approved, synthetic fixture data only): `tests/e2e/korume.live.spec.ts`. First run
    FAILED — a real defect: every Ask Korume answer through Gemini was `provider_error` (HTTP 400 INVALID_ARGUMENT).
    Root cause, bisected with probes: Gemini rejects a `maxItems` array nested in a `maxItems` array
    (answer `blocks[].runs[]`); removing any `maxItems` is accepted. Fix in the Gemini adapter (one place, every
    structured caller): `responseJsonSchema` is sent without `maxItems`; the zod parse still enforces it. Unit test RED
    first; then the live smoke passed twice: 2 turns each with exactly one plan + one answer success, one settled
    reservation, one charge; rail "Seen N" = SQL oracle; a double POST of one turnId → one answer, one reservation.
    Anthropic (production) is unaffected; Ask Korume had never answered on Gemini before this.
- Whole-branch review (code-reviewer, 2026-10-04): APPROVE WITH NITS, 0 Critical; locks, the 038 fold and GC safety
  checked with no cycle found. Fixed both Important: (1) the "one home" pin used a `/gi` regex reused with `.test()`
  (lastIndex leaked across files): a redefinition in 039 now turns it RED (mutation shown); (2) the live smoke is opt-in
  (`KORUME_LIVE=1`; it shares `*.live.spec.ts` with the Ep.729 gate) — skipped without it. Minors left OPEN: m1
  not-found page shares the free key with an aliased created thread (Back to `?thread=<bad>`); m2 New conversation from
  a thread mounts twice (same on master); m3 the Gemini strip also drops a property named maxItems (latent, none
  exists); m4 `readJsonBody` maps a rejected `reader.cancel()` to 400; m5 released late-spent system calls do not count
  toward the system cap; m6 e2e 6 waits on a fixed 1 s timer.

## Working tree and environment

- Owner: Claude
- Worktree `.worktrees/post-korume-stabilization`, from master `ea456b8`; `.env.local` copied from the main checkout.

## Blockers

- Codex usage limit until 2026-10-04 02:01 — Claude implements S4 onward (owner standing rule).

## Next actions

- Decide the review minors m1–m6 (m1 is the only one with a reachable wrong screen; fix it or accept).
- After the last edit: full vitest + `korume.spec.ts` e2e once more on a fresh worktree build, then `verify:protocol`.
- Lessons into `docs/lessons.md` (live smoke found a provider-schema defect every unit test missed; the stateful
  regex pin; the stale :3000 server that served a mutated build).
- Owner decides the merge (`git merge --no-ff`); owner pushes master by hand.
