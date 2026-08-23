# L9b Plan 1 (GDPR / data deletion) — run state

> Rewritten 2026-08-22. **This file is the authority for where L9b Plan 1 stands.**
> `mem:project_status` § NEXT ACTION points here and must not restate it.
> ⚠️ Everything before 2026-08-20 in this file's history said "documentation only, no code".
> **That is now false** — the branch is COMPLETE: 13/13 tasks, whole-branch review run, its one fix
> wave landed and re-reviewed clean at `a7b510c`.

# ▶▶ RESUME HERE

Branch **`l9b-plan1-gdpr`**, off master `4bec8ec`, working tree clean.
Execution is running under `superpowers:subagent-driven-development` (the user chose that mode).

**The live ledger is `.superpowers/sdd/2026-08-20-l9b-plan1-gdpr/progress.md`** — git-ignored, and it
is the recovery map: every ruling, every deferred minor, every commit range. Read it before doing
anything. It has its own `▶▶ RESUME HERE` block. This memory summarises; the ledger is complete.

**STATUS: MERGED.** Merged to `master` at **`4b1fef7`** (merge commit, 2026-08-22), branch
`l9b-plan1-gdpr` kept per repo convention. Merged master verified green: tsc 0, 257 files /
2327 tests. Nothing in this plan is pending. What survives it is § Owed below — two product
decisions and some cosmetic residue.

## What is built

**All 13 tasks are implemented and reviewed clean** (Task 11 needed 2 fix rounds, Task 13 one).
Then the whole-branch review (`L-011`) found 2 Critical + 8 Important that no task-scoped review
could see, and its one fix wave closed them — 9 commits, `ba28de2..a7b510c`, re-reviewed clean.

Shipped: the schema (`20260820000029`), the pure lifecycle module, the service-role eraser, the
user-facing data layer, `GET/POST/DELETE /api/user/deletion`, the database-backed scheduler wired
into `instrumentation.ts`, model-training consent, the `settings` namespace in both locales, and
`/settings/privacy` with the Danger Zone, the delete dialog and the pending banner, the voice
pronunciation-score column (PREPARED, deliberately not wired — see § Owed), and original badge icons.
The fix wave added migration `20260820000031` (deletion inserts are service-role only), a startup
reconciliation pass for stranded rows, `SCHEDULER_ENABLED` validation, and
`/settings/privacy/memory` as an honest not-built-yet surface.

**Execution order was changed at preflight and is not the plan's order** — Task 5 runs before
Task 3, and Tasks 9 and 10 were dispatched as one unit. Both are ruled and explained below.

## Rulings that changed the design — do not silently revert these

1. **Task 5 before Task 3.** Task 3 imports and `vi.mock`s `lib/account-deletion/erase.ts`, so it
   could not be written first. Free swap, no task text changed.
2. **Tasks 9 and 10 are one unit.** Genuinely circular: Task 10's registry row needs
   `variantOf: "data-privacy"` (Task 9's row), Task 9's row needs Task 9's page to exist for a
   registry test, and Task 9's screen composes Task 10's dialog. `privacy-screen.tsx` is a Task 9
   deliverable its Files list forgot to name.
3. **`executeDeletion` order is ban → storage erase → tombstone upsert → users delete.** The plan
   had the ban last. With the ban last, a failed ban meant the request row had already cascaded
   away (`on delete cascade`), so the revert matched zero rows and the log promised a retry that
   could never happen. The invariant that must survive any future reorder: **storage is erased
   before the `users` row that identifies it** — a crash between them strands recordings no query
   can find.
4. **A row that did no work must not rest as `executed`.** Failed and skipped rows revert to
   `status='pending', executed_at=null`. A `failed` enum value was considered and rejected: it needs
   a migration and hides the request from the user exactly as `executed` does.
5. **The revert also lifts the ban** (`liftBan`, `ban_duration: "none"`), because ban-first made a
   banned-but-undeleted user reachable — and they cannot cancel, since both the cancel path and the
   banner query need a session a banned user cannot obtain. Verified against real GoTrue.
6. **`close_account` was completed, not dead-ended.** The Danger Zone row originally routed to a
   non-existent page. The dialog already took a `tier` prop and the backend fully implemented the
   tier, so it now opens the dialog with a **complete parallel copy block** (not partial overrides,
   which fail by silently showing erase-all wording where a key is missing), key-parity tested.
7. **Consent is read server-side** in the page, not via a new `GET`. Task 7 shipped `PATCH` only, so
   the toggle always rendered unchecked — meaning an opted-in user saw "off" and the obvious next
   click would turn their consent off.

## Two defects worth remembering, because both classes recur

1. **The storage eraser deleted nothing while reporting success.** `bucket.list(uid)` is not
   recursive; recordings live at `{uid}/shadowing/{sessionId}.webm`, so `remove(["uid/shadowing"])`
   matched no key, returned no error, and the `users` row was then deleted — a `CLAUDE.md` §2 rule-2
   violation. It survived both test layers because **the mocked fixture returned a `list()` shape
   the real API can never return** (a `name` containing a slash), and the "real DB" probe never
   called `executeDeletion` at all. Now recursive, paginated, with a shortfall check, proven against
   real Storage.
2. **`users.model_training_consent` had no column-scoped UPDATE grant**, so a real client write
   failed with `permission denied` and RLS was never evaluated — the same class as the
   `certification_questions` gap closed in `20260819000028` (`mem:screen_registry_phase_2b_run_state`).
   Task 1's review missed it; the Task 7 implementer found it. Fixed inside `20260820000029` itself
   and proven with a real `authenticated` PostgREST write **plus** a reproduction of the pre-fix 403.

**The lesson both share is `L-005`**: mocked tests cannot see grants, RLS, cascade or storage. Where
a task's real proof is a database, the probe must exercise the actual code path, not a hand-written
`delete from` that only proves Postgres works.

## Owed — survives the merge, NOT closed by it

⭐⭐ **Both items below are now BUILT on branch `feat/email-notification-system`** (a small
follow-on branch off master, 2026-08-23), reviewed twice by `code-reviewer` (round 1: 3 Critical +
6 non-blocking; round 2, after fixes, mutation-verified and approved), full suite green (2366
tests), tsc/lint/build clean. **Not yet merged — awaiting the user's merge decision**, per this
repo's convention of asking before merging. If you are resuming and the branch is gone, it merged —
check `git log --oneline -- lib/email` on master first before treating this section as still open.

- ⭐ **`deleteDialog.support` named a support channel that did not exist.** RESOLVED: the user
  supplied the real address, `admin@almostgone.vn` — already the canonical one in
  `docs/product/screen-inventory.md` §19.5 (Figma footer `203:13813`), so this was not inventing an
  address, it was wiring up the one already on record. Lives in `lib/contact.ts`'s `SUPPORT_EMAIL`,
  interpolated into `deleteDialog.support` via an ICU `{email}` arg in both locale catalogs.
- **No deletion-requested notification email existed.** RESOLVED, but only the PORT + one adapter:
  the user explicitly asked for a shared, provider-agnostic email system (mirroring `lib/ai/*`'s
  port/registry/env split) rather than a one-off SMTP call bolted onto GDPR code — see
  `lib/email/{types.ts (the port), env.ts, registry.ts, service.ts, providers/console.ts,
  templates/account-deletion-requested.ts}`. **`EMAIL_PROVIDER` has exactly one real value today:
  `console`** (dev/test only, logs instead of sending, REJECTED at startup in production by
  `lib/email/env.ts`'s schema). No SMTP/Resend/etc. adapter exists yet — that remains genuinely
  owed, is a separate, larger task (needs a provider decision + real credentials), and is why
  `EMAIL_PROVIDER` is a NEW required boot-time env var: **almostgone.vn's `.env` needs
  `EMAIL_PROVIDER=none` added before this branch is deployed, or the instance fails to boot**
  (`instrumentation.ts` now registers `emailEnvSpec`). `mem:project_status` § Key gotchas should
  carry this deploy note once this branch is confirmed heading to master.
  Two review rounds caught and fixed three real bugs before merge, all mutation-verified:
  (a) `getLocale()` inside an API route (excluded from `middleware.ts`'s matcher) silently resolved
  `routing.defaultLocale` ("vi") for every caller regardless of actual locale — now the client
  forwards `locale` explicitly in the validated POST body, the same pattern `(auth)/actions.ts`
  already uses for `emailRedirectTo` (new lesson `docs/lessons.md` L-034); (b) the notify function's
  `try` didn't cover its own `headers()`/`getLocale()` calls, so a throw there could turn an
  already-committed deletion request into a false 500 — now the entire body is inside the `try`;
  (c) the template hardcoded erase-all "your data is being deleted" framing for BOTH tiers, so a
  `close_account` request (which keeps learning data) got a false email — now tier-aware, copy taken
  verbatim from the pinned `deleteDialog.close_account.subtitle`.
- Minor residue from the final re-review, none blocking: two doc comments still cite
  `messages/en/settings.pin.test.ts`, a path this wave renamed to `messages/settings.pin.test.ts`;
  the new GET rate limit is shared with the server-side page render, so six reloads inside 60s show
  the neutral "couldn't check" card; the both-locale pin sits inside a describe block named "EN", so
  a VI regression reports as an EN failure; the pin bans the bare verb `mở lại`, which would reject a
  future *truthful* "không mở lại được"; and two VI wordings would read better as
  `sẽ bị đóng` / `không thể đăng nhập`.

## Browser pass — DONE 2026-08-22, the debt is closed

`/settings/privacy` and `/settings/privacy/memory` have now been rendered and exercised in a real
browser, in `vi`, at `a7b510c`. Confirmed: the page renders; C1's rewritten copy is honest in the
Danger Zone row, the dialog, and the final confirmation gate; the `LƯU Ý` block still states the
7-day window, so the rewrite did not overshoot into denying it; the typed token stays the
untranslated literal `DELETE`, matching `z.literal("DELETE")`; `/settings/privacy/memory` renders
inside the app chrome as an honest not-built-yet surface; and **Escape restores focus to the trigger
with a visible focus ring** — the branch's most-litigated a11y claim, verified live.

Two visual notes, neither introduced by this branch: the `Xem lại` label wraps to two lines inside
its button, and the `(app)` shell does not stretch to the viewport on short pages, leaving a dead
band below the sidebar (visible on `/settings/privacy/memory` and on `/settings/privacy` once
scrolled).

## Related

`.superpowers/sdd/2026-08-20-l9b-plan1-gdpr/progress.md` (the ledger — authoritative) ·
`docs/superpowers/specs/2026-08-20-l9b-plan1-gdpr-design.md` ·
`docs/superpowers/plans/2026-08-20-l9b-plan1-gdpr.md` ·
`mem:project_status` § Deferred follow-ups (the PayOS-before-erasure dependency L8 inherits) ·
`docs/lessons.md` L-002, L-004, L-005, L-011, L-012, L-032, L-034.
