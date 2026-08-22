# L9b Plan 1 — Data deletion, consent, and two small debts — Design

> **Status:** design written 2026-08-20 on the strength of four user rulings made the same day.
> **Branch:** `l9b-plan1-gdpr`, off master `4bec8ec`.
> **Brainstorm of record:** 2026-07-30 (decisions 1–3) + 2026-08-20 (decisions 4–7) — both live in
> `mem:l9b-plan1-launch-blocker-debt-status` in the assistant's memory, which stays their single home.
> This spec does not restate the reasoning behind a decision; it states what gets built.
> **Adjudication method:** `docs/product/screen-inventory.md` § Amendment C (M13 / M14) — the rule
> that Figma decides presentation, the spec decides meaning, and a real contradiction is a question
> for the user.

---

## 1. What Plan 1 is, and what it is not

The launch-blocker debt CLAUDE.md §2 rule 2 has carried since Layer 1: **there is no way for a user
to delete their data.** Measured on 2026-08-20: nothing in `app/`, `lib/` or `supabase/` matches
`delete.account|deletion_requested|gdpr`. Plan 1 closes that, plus the AI-training consent the same
rule requires and two small debts that have been waiting for a screen to live on.

### In scope

| # | Item | Why it is here |
|---|---|---|
| 1 | **Account closure and full data erasure**, three-stage lifecycle, on `/settings/privacy` | §2 rule 2, owed since L1 |
| 2 | **Model-training consent** (decision 6) | §2 rule 2's second half — *"never used to train models without explicit consent"* |
| 3 | **Persist the voice-mode pronunciation score** | `conversation_messages.pronunciation_score` exists and has never been written |
| 4 | **Badge icons** | `badges.icon_url` is null for every row; the UI has been carrying an SVG fallback since L6 |

### Out of scope, each for a stated reason

| Not doing | Reason |
|---|---|
| **Export Data / Download Learning History** | User ruling 2026-08-20: nobody can yet say what belongs inside the export, so its semantics cannot be settled. The two Figma rows stay unbuilt rather than guessed at. |
| **`Delete Korume Memory`** — the *behaviour* | Not in the user's enumerated scope. **Its row is still built** and points at a placeholder, per the §13 ruling. |
| **Theme / Accent Color / Camera Permission** | Three settings that contradict shipped decisions (`screen-inventory.md` §18.4). Each needs its own ruling; none blocks deletion. |
| **The rest of `/settings`** | `/settings` stays the `UpcomingScreen` placeholder it is today. Plan 1 adds one sub-route beneath it, nothing more. |
| **Re-capturing the Figma frame map** | 69 frames exist against the map's 57 (`figma-frame-map.md`, warned 2026-08-20). Folding a registry-wide `figmaCheckedAt` re-reconciliation into this plan would replace it. |
| **A DB-backed regression guard for RLS/grants** | Already a scoped, deliberately-deferred task (`mem:project_status` § Deferred follow-ups). §11 explains what this plan owes it. |

---

## 2. The design source, and what it does and does not give us

Two Figma frames design this feature. **Neither existed when Phase 0 inventoried the file**, which is
why the 2026-07-30 brainstorm was decided without them:

| Node | Name | What it is |
|---|---|---|
| `337:3323` | Data privacy (for delete) | The page. Breadcrumb `Settings › Privacy`, title *"Your data & privacy"*, a `Learning` card, and a **`DANGER ZONE` card with three rows** |
| `339:3612` | Delete data | The confirmation modal for *Delete all my data* |

**What the modal gives us, and is adopted verbatim as structure:** a `What will be deleted?` list of
six categories, each with icon + label + one line of explanation; a `PLEASE NOTE` block; a
`FINAL CONFIRMATION` section requiring the user to **type `DELETE`** and tick *"I understand"*; and a
two-button footer, `Keep my data` / `Delete all my data`. That is a better confirmation design than
the brainstorm produced and it is kept in full.

**What it gets wrong, and is corrected (Amendment C case 2 — content, not layout).** The modal says
*"It cannot be undone"* and *"Permanently remove"*. The lifecycle is **cancelable for 7 days**
(decision 4). The words change; the template does not.

**What is missing entirely, and is built as an extension in the frame's own design language**
(Amendment C case 4): there is **no designed state for "deletion pending"** — no banner, no
`Cancel deletion` affordance, no post-confirmation screen. §9 specifies it.

---

## 3. Three tiers, and the line between them

`337:3323`'s Danger Zone has three rows. They are three different operations, which is why the design
gives them three different buttons — this is the single fact most likely to be collapsed by a later
reader.

| Row | Button | Meaning (decision 5) | This plan |
|---|---|---|---|
| Delete Korume Memory | `Manage` | Erase what the Companion remembers. **Learning progress remains.** | ◐ **row ships, behaviour deferred** (§13) |
| Delete Account | `Review` | **Close the account.** Learning data survives; the closure is **permanent** — see the note below. | ✅ built |
| Delete all my data | `Review deletion` | **Full GDPR erasure.** Unrecoverable. | ✅ built |

Both in-scope tiers run through **one state machine and one scheduler** (§5, §7), differing only in
what executes at the end. Building them as two mechanisms would be two chances to get the grace
window wrong.

> ⚠️ **Corrected 2026-08-22 (whole-branch review, C1 — a spec defect, not just an implementation
> gap).** This table originally said *"the account is reopenable."* **It is not, and nothing in this
> plan ever made it so.** `close_account` executes `ban_duration: "876000h"` (~100 years) and then
> stops. `liftBan` has exactly one caller — the scheduler's failure handler — so there is no reopen
> endpoint, no admin un-ban surface and no email flow; a banned GoTrue user cannot obtain a session,
> so they cannot even reach `/settings/privacy` to ask. The plan inherited the claim from here and
> shipped user-facing copy stating it in both locales, which is exactly why this line is corrected
> rather than left as a harmless aspiration.
>
> What `close_account` actually means, and what the copy now says: **the account closes and stays
> closed; the learning data is kept, not deleted.** That is still a materially different operation
> from `erase_all`, which is the whole reason the two tiers exist.
>
> A reopen path would be a **new feature** and is deliberately not in this branch. If it is ever
> built, it belongs in §14 as its own scoped item — with the copy in both locales changed back in the
> same change, never before it.

---

## 4. The lifecycle

Decision 2 (2026-07-30) and decision 4 (2026-08-20), stated once as a state machine:

```
  [none] --request--> [pending] --7 days--> [executed] --83 more days--> [purged]
                          |
                          +--cancel (user, any time in the window)--> [cancelled]
```

| Stage | When | `close_account` does | `erase_all` does |
|---|---|---|---|
| **pending** | on request | nothing yet; a banner offers `Cancel deletion` | same |
| **executed** | request + 7d | ban the auth user; **all data retained** | purge everything (§6); ban the auth user; write a tombstone |
| **purged** | request + 90d | — | delete the `auth.users` row, freeing the email for reuse |

**Assumptions, stated rather than asked** (flag them at review if either is wrong):
1. **The account stays fully usable during the 7-day window.** Deletion is a scheduled event, not a
   lockout.
2. **Ordinary activity does not auto-cancel a pending request.** Only the explicit `Cancel deletion`
   action does. An implicit cancel is unprovable to the user and would silently defeat the request.

---

## 5. Schema

One migration, `2026082900002x_account_deletion.sql` (number assigned at implementation — the chain
is currently at `20260819000028`).

```sql
create type deletion_tier   as enum ('close_account', 'erase_all');
create type deletion_status as enum ('pending', 'cancelled', 'executed', 'purged');

create table account_deletion_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users (id) on delete cascade,
  tier          deletion_tier not null,
  status        deletion_status not null default 'pending',
  requested_at  timestamptz not null default now(),
  execute_after timestamptz not null,     -- requested_at + 7 days
  purge_after   timestamptz,              -- set at execution, erase_all only
  cancelled_at  timestamptz,
  executed_at   timestamptz
);

-- At most ONE live request per user. A partial unique index, not a plain one:
-- a user who cancels must be able to request again.
create unique index account_deletion_requests_one_live
  on account_deletion_requests (user_id) where status = 'pending';
```

**The tombstone is a second table, deliberately not a column.** `erase_all` deletes the
`public.users` row, and every FK to it cascades (§6) — so anything remembered about a deleted account
cannot live on `users` or on a table referencing it:

```sql
create table account_deletion_tombstones (
  user_id     uuid primary key,   -- NO foreign key: the users row is gone by design
  tier        deletion_tier not null,
  executed_at timestamptz not null,
  purge_after timestamptz not null
);
```

**Consent lives on `users`**, following the `leaderboard_opt_in` precedent
(the `leaderboard_opt_in` column added in `20260714000014_community_admin.sql` — an ordinary self-editable profile preference):

```sql
alter table users add column model_training_consent boolean not null default false;
```

**RLS and grants** — every new table needs both (`mem:project_status` § Key gotchas: a migration-made
table without RLS is an open hole, and default privileges auto-grant DML to `authenticated`):

- `account_deletion_requests`: RLS on; SELECT + INSERT own row; **UPDATE only via the API**, never a
  direct client write of `status` — revoke UPDATE/DELETE from `authenticated` and let the service
  role own every transition.
- `account_deletion_tombstones`: RLS on; **no `authenticated` policy at all**. Service-role only.
- Both: revoke the table-wide INSERT/UPDATE/DELETE that Supabase's default privileges hand out where
  no policy admits the write — the defence-in-depth pattern `20260819000028` established, and the
  reason it is worth doing is recorded there (a silent RLS filter and a 403 are indistinguishable
  from a broken boundary).

---

## 6. What "erase" actually reaches — and the part that cascade does not

**Do not hardcode a table list.** Deleting `public.users` cascades through every FK declared
`on delete cascade`, and that set changes whenever a migration adds a user-owned table. Enumerate it
instead of quoting a count (`L-002`):

```sql
select c.confrelid::regclass as parent, c.conrelid::regclass as child, c.confdeltype
  from pg_constraint c
 where c.contype = 'f' and c.confrelid = 'public.users'::regclass
 order by 2;
```

**Three residues cascade does not handle. Each is a real hole if forgotten:**

1. **Storage objects.** The `recordings` bucket (`20260712000007_recordings_bucket.sql`) holds voice
   recordings keyed `{auth.uid()}/…`. **Postgres cascade never touches storage.** The eraser must
   list and delete that prefix with the service-role client. This is the §2 rule-2 asset — leaving it
   behind is the worst possible miss in this feature.
2. **`on delete set null` columns.** Measured, not assumed: `forum_posts.user_id`,
   `forum_comments.user_id` and `videos.added_by_user_id`. Community content **survives, anonymised**
   — that is the correct GDPR outcome for other people's threads, and it must be deliberate and
   recorded, not discovered later.
3. **The `auth.users` row itself**, which is banned at execution and deleted only at +90 days.

**⚠️ Dependency to honour at L8:** an account with a live PayOS subscription must have it cancelled
before erasure. `subscriptions` exists today with no billing integration, so Plan 1 deletes the row
like any other; **when L8 lands, deletion must call PayOS first.** Record it in L8's spec — do not
leave it only here.

---

## 7. The scheduler — built as infrastructure, used once

**Measured: no scheduler exists.** `setInterval|node-cron|scheduler|cron` matches nothing in `lib/`
or `app/api/`. This is the infrastructure `srs_due` notifications and push delivery have been waiting
on (`mem:project_status` § Deferred follow-ups), so it is built to be reused — a job registry in
`lib/scheduler/`, not a timer bolted to the deletion feature.

**The deploy target makes an in-process worker legitimate.** almostgone.vn is a single long-running
Node instance, not serverless — the same fact that makes `lib/rate-limit.ts` a real limiter here.

Non-negotiable properties, because a scheduler that gets these wrong deletes the wrong data:

- **State lives in the database, never in a timer.** A restart must lose nothing; a job is due
  because a row says so.
- **Claims are atomic.** `update … set status = 'executed' where status = 'pending' and execute_after
  <= now() returning *` — the returned rows are the work. Two processes cannot claim the same request.
- **Started once per process**, from a module-level guard, never per request.
- **Off by default in tests and during `next build`** — an env flag, explicitly set, never inferred
  from `NODE_ENV`.
- **Every run logs what it did**, including "nothing due". A silent scheduler cannot be distinguished
  from a dead one — the same argument that made the `20260819000028` revoke worth doing.

---

## 8. API surface

All under `app/api/user/`, following `leaderboard-opt-in/route.ts` exactly: parse JSON → zod
`safeParse` → a `lib/data` function that owns auth and rate-limiting → typed error mapping with
`Retry-After` on 429.

| Route | Method | Body | Notes |
|---|---|---|---|
| `/api/user/deletion` | `POST` | `{ tier, confirmation: "DELETE", acknowledged: true }` | Creates the pending request. Rejects if one is live. |
| `/api/user/deletion` | `DELETE` | — | Cancels the caller's pending request. |
| `/api/user/deletion` | `GET` | — | Status for the banner. |
| `/api/user/model-training-consent` | `PATCH` | `{ consent: boolean }` | Mirrors `leaderboard-opt-in`. |

**Validation is server-side and not decorative.** `confirmation` must equal the literal `DELETE` and
`acknowledged` must be `true` **at the API**, not only in the modal — the typed confirmation is a
security control, and a control that exists only in the client is not a control. Rate-limit every
route (`lib/rate-limit.ts`); deletion is destructive and enumerable.

---

## 9. UI

**Route `/settings/privacy`** (decision 7), under `app/[locale]/(protected)/(app)/settings/privacy/`.
`/settings` stays the placeholder. This is `settings-patterns.md`'s *Dangerous Settings Separation*
(*"Never mix learning preferences with account destruction or data deletion"*) satisfied by structure
rather than by a heading.

**Built from `337:3323`:** the page shell, the `Learning` card, and the `DANGER ZONE` card with its
three rows and right-aligned text buttons. **All three render as drawn**; the third points at a
placeholder destination rather than being greyed out or removed (§13).

**Built from `339:3612`:** the modal, structurally verbatim — six categories, `PLEASE NOTE`,
type-`DELETE` + checkbox, `Keep my data` / `Delete all my data`. Copy corrected to state the 7-day
window (§2). The confirm button stays disabled until both confirmations pass, which is what the frame
draws.

**The extension the design lacks:** a **pending-deletion banner** on `/settings/privacy`, in the same
card + ember-outline-button language as the Danger Zone, stating the execution date and offering
`Cancel deletion`. No new visual vocabulary is invented for it.

**Accessibility is not optional here** (§2 rule 5, and this is a destructive flow): the modal is a
real focus trap (`components/ui/dialog.tsx`, the Radix wrapper from L9a-Plan2), `Escape` closes as
`Keep my data`, the typed-confirmation field is labelled and its error announced, and the whole flow
is keyboard-completable. Contrast on the danger tier must be **measured**, not assumed —
`--paper-50` on a warm fill fails, so text on a warm/destructive fill follows the `--ink-950` rule
(`mem:project_status` § Key gotchas).

**Registry and i18n:**

- Two new `screen-registry.ts` entries: `data-privacy` (`337:3323`, route `/settings/privacy`, chrome
  `app`, `navGroup: null`) and `delete-data` (`339:3612`, `kind: "state-variant"`, `variantOf:
  "data-privacy"`, `route: null` — an overlay is not a route, per the port-workflow spec §5.4).
- `figmaCheckedAt: "2026-08-20"` on those two and on `settings`, which were genuinely compared today.
  **Every other row keeps its old stamp** — this plan did not re-reconcile them.
- A new `settings` message namespace, wired in all **five** places including
  `types/messages.d.ts`'s `AppConfig.Messages` (the L9a Task-13 rule — miss it and tsc fails), with
  `vi` and `en` catalogs. Destructive copy is chrome, so it is translated.

---

## 10. Consent, stated precisely (decision 6)

**Using Companion memory to personalise the experience is core product, is always on, is not a
toggle, and needs no consent — it is not model training.** Nothing in §2 restricts it.

`model_training_consent` covers only what §2 rule 2 actually restricts: **using the user's data,
including voice recordings, to train models.** It ships **off**, opt-in, matching both the frame and
`capability-map.md`'s capability table, which classifies it *layer D*.

**The toggle is renamed** so it stops claiming the personalisation half — the Figma label *"Help
improve Korume using your learning patterns"* is B-content and is corrected (Amendment C case 2).

**Honesty requirement.** No training pipeline exists today, so this consent is **a stored preference
and a documented gate, not a live switch.** The spec must not imply enforcement that no code
performs. What Plan 1 owes: the column, the endpoint, the UI, and a comment at the one place a future
training path would have to read it. `docs/lessons.md` `L-012` is the reason this paragraph exists.

---

## 11. Testing

TDD, per CLAUDE.md §7 — failing test first, and no claim of passing without the command output.

**Deterministic unit tests** for the state machine: request → pending; cancel → cancelled; second
request while one is live → rejected; execution at the boundary; `close_account` retaining data vs
`erase_all` purging. Clock injected, never `Date.now()` read inside the logic.

**Mutation-check every guard** (`L-004` / CLAUDE.md §7): break it, watch it go red, restore, report
both outputs. Several tests here are written over code that already exists (registry entries, grants)
and therefore **cannot fail first** — those get the mutation treatment instead. Any assertion over a
pattern-gathered collection must also assert the collection is non-empty and of the expected size.

**⚠️ The completeness of erasure cannot be proven by a mocked test.** `L-005` is explicit: RLS and
grants are invisible to `supabase-mock.ts`, and so is cascade. A mocked test can prove the eraser
*calls* what it intends; only a real Postgres can prove the data is *gone*. This plan therefore:

1. ships mocked unit tests for orchestration and the state machine, **claiming no more than that**;
2. records a **measured manual verification** in the branch's acceptance notes — the
   `supabase db reset` + real-role probe recipe proven on 2026-08-19
   (`mem:screen_registry_phase_2b_run_state`), run against a seeded account, with a **positive
   control**: rows must be shown present before deletion, or "absent" proves nothing;
3. hands the permanent guard to the already-scoped DB-backed harness task, and **does not** build that
   harness here.

Playwright: read the result as a **comparison against the branch point**, never as an absolute pass
count — specs die locally for want of credentials and that is environmental
(`mem:project_status` § Verify commands).

---

## 12. The two small debts

**Persist the voice-mode pronunciation score.** `conversation_messages.pronunciation_score`
(`20260712000001_schema.sql`) has existed since Layer 1 and Layer 4 deliberately left it unwired,
keeping the score client-side. Wire the voice-conversation scoring result through on message insert.
Note `lib/data/companion.ts` already reads `shadowing_sessions.pronunciation_score` — that is a
**different** column and is not what this item is about.

**Badge icons.** `badges.icon_url` is null for every row; the UI has an SVG fallback. Author an
original icon per badge (§2 rule 3 — all content original, no copying), store under `public/badges/`,
and set `icon_url` in a migration, since content is versioned reference data that must travel with
`db push` (§ Key gotchas). Keep the fallback: a null icon must stay renderable.

---

## 13. The third row — ✅ ruled, 2026-08-20

**The Danger Zone card is designed with three rows and this plan builds the behaviour of two.**
**User ruling: build the card as though all three exist** — *"cứ làm như thế đã có đi, sau khi có thì
trỏ tới rồi fill vào"* — and the reason it is safe to do so is that nothing is published yet.

So: **all three rows render exactly as `337:3323` draws them.** The template is not edited, nothing is
greyed out, and no row is dropped. `Delete Korume Memory`'s `Manage` action points at a placeholder
destination — the `UpcomingScreen` pattern the repo already uses for `/settings` itself — and when
that tier is built, the pointer is repointed rather than the card being redesigned.

**What this must not become:** a button that looks live and silently does nothing. Pointing at an
honest "not built yet" surface and *appearing* functional are different things, and only the first is
acceptable even pre-launch. The row is real; its destination says plainly that the feature is coming.

**Consequence for §14:** `Delete Korume Memory` stays deferred as *behaviour*. Its **row is delivered
by this plan**, which is why it is no longer purely out of scope.

---

## 14. Deferred, with reasons attached

| Deferred | Reason |
|---|---|
| Export Data / Download Learning History | Semantics unsettled (§1). Revisit with a ruling on what the export contains and in what format. |
| `Delete Korume Memory` — the behaviour behind the row | The row ships now (§13); only the erase itself waits. Design and data reach are both already known when it returns. |
| Figma frame-map + registry re-capture | 12 frames are missing from the map. Own pass, own branch. |
| DB-backed RLS/grant regression guard | Already scoped and deliberately deferred; §11 states what this plan hands to it. |
| PayOS cancellation before erasure | No billing integration exists; belongs in L8's spec (§6). |
