# Post-Korume stabilization — plan

Branch `post-korume-stabilization` from master `ea456b8`. Owner ruling 2026-10-03: close the known follow-ups of
Shadowing 1b (review M5–M9) and Ask Korume before Summary/Analysis starts, because Summary reuses the Knowledge core
these bugs live in. Bug fixes only: no new product surface.

Sources of the findings: 1b ledger `.worktrees/shadowing-workspace-1b/.superpowers/sdd/2026-10-02-shadowing-workspace-part-1b/progress.md`
(T16b, line "Ruling: M5-M9"), `docs/superpowers/run-state/ask-korume.md` (Task 10a "Deferred", Task 11).

## Diagnosis (re-derived from the code at `ea456b8`, not from the summaries)

- **M8 expiry deadlock.** `ai_release_expired()` (live copy: `20261003000040_ai_late_spend.sql`; dead earlier
  copy in `…038_knowledge.sql`) is called by EVERY `ai_reserve`. It updates every expired `held` reservation and
  then one `ai_budget_days` row per day, with no lock of its own. Two concurrent reserves of DIFFERENT learners (the
  per-user advisory lock does not serialise them) sweep the same expired set and can lock its rows in different
  orders → `40P01`. Every other path locks one reservation then one budget row, so a single sweeper at a time
  removes the cycle.
- **M8b one fact, two homes.** `040` `create or replace`s `ai_release_expired`, `ai_settle`, `ai_release` that `038`
  defines — the exact defect AGENTS.md §6 forbids. Fixing M8 in `040` would leave `038` holding a stale copy.
- **M6 system-funded generations have no per-user cap.** `POST /api/dictionary/gloss` → `requestGloss` →
  `getOrGenerateSection({ billing: { scope: "system", userId } })` → `ai_reserve(billing_scope 'system')`, which
  checks only the global day budget. The only per-user brake is the in-process 20/min `rateLimit`: one account can
  spend the whole daily budget (20/min × 60 × 24). The cap must live in `ai_reserve`, under the user lock (L-040).
- **M9 raw body size.** Note bodies ARE capped (zod in `lib/validation/notes.ts` counting code points, DB `CHECK`
  4000 / 20000 in `…039_learner_notes.sql`). What is missing: both note routes call `request.json()` before any
  check, so an unbounded body (also from an unauthenticated caller — auth runs after parsing) is buffered whole.
- **M5 analysis memo key.** `lib/analysis/line-analysis.ts` `keyOf` = `scope|lineId|snapshotId|grammarRevision` —
  keyed by line id, NOT by text. Today no code updates `transcript_lines.text_jp` (insert-only; re-imports mint new
  ids), so it is latent: any future edit path would serve the old text's analysis. Fix: the key includes the text.
- **M7 staging snapshots never purged.** `dict_gc_snapshots(p_keep)` (`…037_dictionary.sql`) deletes only `retired`
  snapshots; a failed import leaves a `staging` snapshot (with up to ~219k `dict_entries` rows) forever.
  ⚠️ Trap: `supabase/tests/dictionary.sql` PARKS the real snapshots as `staging` and runs `dict_gc_snapshots(0)` —
  a staging purge reachable from that call would delete the owner's real dictionary (the exact R5 bug).
- **Korume M5.** On `/korume/chat` without `?thread`, the first send creates a thread but the URL stays bare;
  reload/back shows an empty free chat.
- **Korume m3.** After a ⋯ thread switch the page remounts (keyed by thread id) and focus lands on `<body>`.
- **Selection-span anchor e2e.** `useKorumeOverlay` reads the selection span on pointerdown, else the active line;
  only the active-line path is pinned in `tests/e2e/korume.spec.ts`.
- **Landing e2e.** 4 `landing-page` tests timed out loading `/en` on the ask-korume worktree; never compared with
  master.
- **Live Gemini smoke** (ask-korume plan Task 11 Step 4) was never written or run. Owner pre-approved 2026-10-03.

## Tasks

| Task | Owner | What |
| --- | --- | --- |
| S1 | Codex (database) | M8 + M8b: fold `040` into `038`; single sweeper; race round |
| S2 | Codex (database + backend) | M6: per-user daily cap on system-funded generations |
| S3 | Codex (backend) | M9 raw body cap on note routes + M5 memo key |
| S4 | Codex (database) | M7 staging purge with the gate trap handled |
| S5 | Codex (frontend), Claude runs e2e | Korume M5 + m3 + selection-span e2e spec |
| S6 | Claude | Landing e2e vs clean master; live Gemini smoke spec + run; full gates; whole-branch review |

### S1 — expiry sweep, one home
- Move `expired_at`, `late_spent_at`, `ai_record_late_spend` and the late-spend versions of `ai_release_expired`,
  `ai_settle`, `ai_release` into `038` (replace the old bodies in place); delete `040` and move its test's pins into
  `038`'s test. `grep -rn 000040` must be empty afterwards outside dated records.
- `ai_release_expired` starts with `perform pg_advisory_xact_lock(hashtext('ai-release-expired'));`. Lock order
  everywhere stays: user lock → sweep lock → reservation rows → budget rows.
- Tests: migration pin (the sweep takes the lock; `040` gone; columns/functions in `038`); race round in
  `supabase/tests/knowledge-race/`: seed ≥40 expired `held` reservations across 2 days, 20 learners reserve at once →
  no connection fails, every expired row released exactly once, `reserved_usd` = sum of the live holds. Mutation:
  drop the lock line → the pin fails (report whether the race round also goes red; it may not — say so).
- Gates: fresh `npx supabase db reset` (owner-approved on this branch), `verify:db:knowledge` + `verify:db:korume` 0.

### S2 — per-user cap for system-funded generations
- Config `AI_SYSTEM_GENERATIONS_PER_USER_PER_DAY` (default 100, all envs) → `KnowledgeConfig` →
  `p_limits.systemGenerationsPerUserPerDay`.
- `ai_reserve` (in `038`): when `p_billing_scope = 'system'` and `p_requested_by` is not null, take the same
  `ai-user:` advisory lock and count that user's `system` reservations of the day in `held`/`settled`; at the cap →
  `quota_exhausted` with `v_next_day`. A system call with a null user is unchanged.
- `requestGloss`: `quota_exhausted` → the existing `rate_limited` refusal with `retryAfter` = ms until `resetsAt`
  (route already maps it to 429 + `Retry-After`). The learner is never shown an upsell for a system-funded gloss.
- Tests: SQL gate case (cap N, N+1 refused, other user unaffected, null-user system call unaffected); a race round
  (20 concurrent system reserves for one user at cap 5 → exactly 5); unit tests for config + lookup mapping.

### S3 — raw body cap + memo key
- One helper (e.g. `lib/http/read-json-body.ts`): rejects a `Content-Length` over the cap before reading, else
  streams and aborts once the cap is crossed → `{ ok: false, status: 413 }`; invalid JSON → 400 as today. Cap derived
  from the existing constants (one fact, one home): `6 * MAX + 1024` bytes (a JSON `\uXXXX` escape is 6 bytes per
  UTF-16 unit). Used by `app/api/videos/[id]/notes/route.ts` and `app/api/sentence-notes/route.ts`.
- `keyOf` includes `line.textJp`. Test: same id, changed text → re-analysed (mutation: drop text from the key → red).

### S4 — purge abandoned staging snapshots
- `dict_gc_snapshots(p_keep int default 1, p_staging_grace interval default interval '1 day')`: also deletes
  ABANDONED imports — `status = 'staging' and activated_at is null and created_at < now() - p_staging_grace`.
  `activated_at is null` is what makes it safe: a snapshot that was ever active (the gate's parked real dictionary,
  or a parked retired one) is never purged, even when a crashed gate run leaves it parked as `staging`. Orphan
  `dict_imports` rows (no snapshot references them) older than the grace go too.
- `supabase/tests/dictionary.sql`: a case proves an old never-activated staging snapshot goes, a fresh one stays, and
  an old staging snapshot WITH `activated_at` stays. `scripts/dictionary-gc.ts` reports both counts.
- Gate run protocol: count `dict_kanji` of the active snapshot before and after `verify:db:dictionary` — equal.

### S5 — Korume chat URL, focus, span e2e
- M5: after the first turn creates a thread on a bare `/korume/chat`, `router.replace` to `?thread=<id>` — without a
  remount that drops the in-flight answer (check how the page is keyed: `page.tsx` keys by thread id).
- m3: after a ⋯ switch, focus goes to the composer textbox (or the conversation heading) — never `<body>`.
- e2e (written by Codex, run by Claude): select a span of line N in the workspace, open the mascot → the chip and the
  POSTed anchor carry the span; and the M5 / m3 behaviour above.

### S6 — Claude
- Landing: run the 4 tests on a clean master worktree build (`.worktrees` build, never the main checkout). Red there
  too → record as known unrelated, no fix here.
- Live smoke `tests/e2e/korume.live-ai.spec.ts` per ask-korume plan Task 11 Step 4, `KORUME_LIVE=1`,
  `AI_PROVIDER=gemini`, seeded demo data only (AGENTS.md §3: never real user data to Gemini).
- Full gates after the last edit; whole-branch review from `git diff master...post-korume-stabilization`; lessons;
  merge on the owner's word.
