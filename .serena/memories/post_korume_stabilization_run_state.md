# post-korume-stabilization — ⭐ MERGED → master `09d2684` 2026-10-04 (--no-ff); owner pushes. History, not a resume point.

Branch `post-korume-stabilization`, worktree `.worktrees/post-korume-stabilization`, from master `ea456b8`, tip `03ef7e0`,
NOT merged. Authoritative: `docs/superpowers/run-state/post-korume-stabilization.md` ON THE BRANCH (Owner: Claude) and
the plan `docs/superpowers/plans/2026-10-03-post-korume-stabilization.md` (Diagnosis section = contract).

Why: owner 2026-10-03 — close 1b review M5–M9 + Ask Korume follow-ups before Summary/Analysis (Summary reuses the
Knowledge core). Live Gemini smoke pre-approved ("API free"); synthetic fixture data only.

Commits: cfdfda7 plan · 6ea9324 M8 one expiry sweeper (advisory lock) + migration 040 folded into 038 (040 deleted)
· b3dc0f7 M6 per-user daily cap on system-funded generations (AI_SYSTEM_GENERATIONS_PER_USER_PER_DAY=100, in ai_reserve
under the user lock; gloss → 429) · d73649d M9 `lib/http/read-json-body.ts` byte cap (12 x code-point max + 1 KiB) on
both note routes + M5 analysis memo key includes line text · 5630a59 M7 dict_gc_snapshots purges never-activated
staging snapshots > 1 day + orphan imports (`activated_at is null` protects the gate's parked real dictionary) ·
19b01bf Korume M5/m3: client-side conversation key with created-thread alias, history.replaceState ?thread=, composer
autofocus after a switch; e2e 6/7 · af2a73b Gemini adapter strips maxItems (REAL BUG found by the live smoke: Gemini
400 on nested maxItems → every Ask Korume answer was provider_error) + tests/e2e/korume.live.spec.ts · 6d3fe46 review
Important fixes (stateless regex pin; live smoke opt-in KORUME_LIVE=1) · 3c7a7ba minors m1 (popstate → new
conversation; e2e 8), m3 (strip keeps property names), m4 (cancel reject keeps 413), m5 (late-spent system holds
count; 038 in place, gate 9b), m6 (e2e 6 waits for the refresh RSC response); m2 ACCEPTED (same on master) ·
03ef7e0 lessons L-042 new + L-004/L-017 evidence, final gates.

Verified (final, after 3c7a7ba): vitest 514/4595; tsc/lint/verify:protocol 0; fresh reset → verify:db knowledge +
korume 0; korume + korume-threads e2e 9/9 on a clean build; each minor RED without its fix (unit, gate 9b, e2e 8).
Earlier: full e2e 116 + 1 known flake; landing 72/72; live smoke 2/2 (before m3). Review: APPROVE WITH NITS.

Live smoke NOT re-run after m3, by proof instead: no source schema has a property or $defs entry named maxItems, so
the new strip sends byte-identical JSON to the one that passed live 2/2. Merged 2026-10-04 at the owner's
"if all OK, merge". NEXT for the project: Summary/Analysis (unblocked). Local DB needs re-import before Chrome.

Environment: Codex quota out until 2026-10-04 02:01 (Claude did S3-end..S6). Local DB was RESET AGAIN 2026-10-04 01:3x (m5):
dictionary GONE again (re-import with the 1b worktree's .tmp/import.sh); the Ep.729 demo lesson and demo.korume account are GONE (re-run
scripts/seed-real-lesson.ts before a Chrome look). No server on :3000. Run live smoke: build in the worktree, start
with AI_PROVIDER from .env.local (gemini), `KORUME_LIVE=1 npx playwright test --config=playwright.live.config.ts korume.live`.
Gotcha: `Stop-Process` on one :3000 listener can leave another — kill ALL listeners and check PID start time vs
.next/BUILD_ID before trusting an e2e run (a stale mutated server once served a run).
