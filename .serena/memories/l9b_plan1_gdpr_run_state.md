# L9b Plan 1 (GDPR / data deletion) — run state

> Written 2026-08-20. **This file is the authority for where L9b Plan 1 stands.**
> `mem:project_status` § NEXT ACTION points here and must not restate it.

# ▶▶ RESUME HERE

**Branch `l9b-plan1-gdpr` exists, off master `4bec8ec`, five commits, working tree clean.
Everything so far is DOCUMENTATION. Not one line of application code has been written, and no
test has been run because there is nothing yet to test.** Do not read the branch as partially
implemented.

**The next action is Task 1 of the plan** — `docs/superpowers/plans/2026-08-20-l9b-plan1-gdpr.md`.
Execute with `superpowers:subagent-driven-development` (the user was offered subagent-driven vs
inline and had not chosen when the session ended — **ask before starting**).

⚠️ **Task 1 and Task 5 need Docker Desktop running** (`npx supabase start`). Both verify against a
real local Postgres, because `L-005` makes a mocked test worthless for grants, RLS and cascade.
Without Docker they stop at the probe step — that is the design, not a failure.

## What is on the branch

| Commit | What |
|---|---|
| `7973a26` | `screen-inventory.md` § **Amendment C** + `decision-register.md` **M13/M14** — the Figma-vs-spec adjudication rule |
| `df5c59b` | `figma-frame-map.md` staleness warning |
| `7c6f79c` | The spec |
| `6f1925e` | Spec §13 closed by user ruling |
| `6034dd6` | The plan, + the PayOS dependency written into `mem:project_status` |

**Spec:** `docs/superpowers/specs/2026-08-20-l9b-plan1-gdpr-design.md` — 14 sections, no open
questions left.
**Plan:** `docs/superpowers/plans/2026-08-20-l9b-plan1-gdpr.md` — 13 tasks, 85 checkbox steps.
Never quote those figures back without re-counting (`L-002`); they are here to say "it is whole",
not as a measurement.

## The four rulings this work rests on (2026-08-20)

Outcomes are built into the spec; **the reasoning lives in the assistant's memory file
`l9b-plan1-launch-blocker-debt-status`, decisions 4–7**, which does not travel with the repo. If that
is ever lost, the spec still states what gets built — only the *why* would be gone.

1. **The 7-day cancelable window survives** the modal's *"cannot be undone"*. The modal's template is
   kept verbatim; only its copy changes. A `settings` catalog test asserts no string claims
   irreversibility, so the wrong sentence cannot come back quietly.
2. **`Delete Account` ≠ `Delete all my data`** — close (data kept, reopenable) vs erase (full GDPR,
   unrecoverable). The design gives them different buttons for this reason.
3. **`AI Training` splits.** Personalising the Companion from memory is core, always on, needs no
   consent — **it is not model training**. The toggle keeps only what §2 rule 2 restricts, stays
   opt-in, and is renamed. ⚠️ The user recalled ruling "auto-on"; **no file records that**, and
   default-on would breach §2 rule 2, which M6 says nothing overrides.
4. **Route is `/settings/privacy`**, per the new frame's own breadcrumb. `/settings` stays the
   `UpcomingScreen` placeholder.

Plus §13, ruled after the plan was drafted: **all three Danger Zone rows render as drawn**; the
memory row points at a placeholder and gets repointed when that tier is built. Nothing is greyed out
or dropped.

## Scope, as the user narrowed it — do not re-widen without asking

**In:** account closure + full erasure · model-training consent · persist the voice-mode pronunciation
score · badge icons.
**Out:** **Export Data / Download Learning History** (user: nobody can yet say what belongs inside the
export, so its semantics cannot be ruled) · the `Delete Korume Memory` *behaviour* (its row still
ships) · Theme / Accent Color / Camera Permission · the rest of `/settings`.

## Two discoveries worth not re-deriving

1. **⭐ The Figma file has grown and nothing in the repo knew.** 69 top-level frames measured
   2026-08-20 against `figma-frame-map.md`'s 57 — **including the two frames that design this very
   feature** (`337:3323` Data privacy, `339:3612` Delete data). The 2026-07-30 GDPR brainstorm was
   therefore decided without ever seeing its own design. Consequence: every `screen-registry.ts` row's
   `figmaCheckedAt` overstates what was compared (`R7`). **A re-capture pass is owed and is
   deliberately NOT part of this branch.** Enumeration method that works: `get_metadata` on page `0:1`
   exceeds the MCP token cap but is written to a file, so filter direct children locally — no frame
   selection in the desktop app needed.
2. **The voice pronunciation score is client-computed.** Layer 4 kept it client-side on purpose, so
   persisting it means storing a self-reported number. Plan Task 12 range-validates it 0–100 at the
   API and marks it a learning signal only — never an input to authorization or XP without
   server-side re-scoring. The spec did not have this note; the plan found it.

## Things the plan insists on, because they are how this feature fails quietly

- **Postgres cascade never touches Storage.** The `recordings` bucket is keyed `{uid}/…` and holds
  the §2 rule-2 asset. The eraser deletes the prefix explicitly, **before** deleting the row that
  identifies it.
- **Two community tables are `on delete set null`** — `forum_posts.user_id`, `forum_comments.user_id`
  (plus `videos.added_by_user_id`). Authorship is anonymised rather than removed. Correct GDPR
  outcome, and it must be deliberate rather than discovered.
- **Never hardcode the cascade table list.** Enumerate from `pg_constraint` — the set changes with
  every migration that adds a user-owned table.
- **The scheduler claim IS the work:** one atomic `update … where status='pending' … returning *`.
  Select-then-update races. Off unless `SCHEDULER_ENABLED=true` is set explicitly, never inferred
  from `NODE_ENV` — a build step must not delete an account. Every pass logs, including one that
  handled nothing.

## Related

`docs/superpowers/specs/2026-08-20-l9b-plan1-gdpr-design.md` ·
`docs/superpowers/plans/2026-08-20-l9b-plan1-gdpr.md` ·
`docs/product/screen-inventory.md` § Amendment C · `docs/product/decision-register.md` M13/M14 ·
`docs/product/figma-frame-map.md` (stale, warned) ·
`mem:project_status` § Deferred follow-ups (the PayOS-before-erasure dependency L8 inherits) ·
`docs/lessons.md` L-002, L-004, L-005, L-011, L-012, L-032.
