# Full-backlog estimate: build every Figma screen + backend (measured 2026-08-23)

> Snapshot, not a live counter — re-measure via the commands below before quoting any figure (`L-002`).
> Answers the user's question "how long to build every Figma screen with matching backend, and what
> speeds it up." Read `mem:figma_recapture_2026_08_23_run_state` first for what the new batch contains.

## Registry status (the direct answer to "đã lưu chưa")

⚠️ **SUPERSEDED — this paragraph said "NOT saved" and it is no longer true.** It was written on
2026-08-23, before Screen Registry Phase 3 Stage 1 existed. **Stage 1 is now implemented** on branch
`screen-registry-phase-3` (commits `467b7c1`…`d37027f`): the batch IS registered.

**Read `mem:screen_registry_phase_3_run_state` for the authority, and
`docs/product/figma-frame-map.md` § "Second capture batch (2026-08-23)" for the per-frame accounting
— that file is the single home for it, so it is deliberately not restated here.** In one line: every
frame in the batch is registered except `335:1588` (EXCLUDED — style-guide catalogue, same
classification as its twin `218:15740`) and `347:6277` (DEFERRED — the marketing-homepage identity
question is still reserved to the user). The `kind`/`navGroup` judgment calls this paragraph worried
about were made and reviewed: Unsubcribe membership and Choose method are `state-variant`s of
Membership, exactly the way Delete data is of Data privacy.

**Consequence for the estimate below: the "9 newly-captured, still-unregistered frames" it counts as
a separate bucket are no longer unregistered.** Registration was never build work, so the *build*
estimate is unaffected — but do not re-plan "register the new frames" as an outstanding task.

## Backlog measured from the registry (2026-08-23)

```
grep -o 'impl: "[a-z]*"' lib/product/screen-registry.ts | sort | uniq -c
```
→ 37 built · 33 `none` (1 is the deprecated Shadowing Hub, so **32 real unbuilt**) · 13 placeholder
(stub route exists, not fully built).

Of the 32 unbuilt, **13 are `state-variant`** (ride along their parent screen's build — near-zero
marginal plan cost, same as `339:3612` rode along `337:3323` in L9b). So independent unbuilt-screen
count ≈ **19**, plus **12 placeholders** to finish, plus the **9 newly-captured, still-unregistered**
frames (2 of which — Unsubcribe membership, Choose method — are themselves variants of Membership, so
≈7 independent new units).

**Total independent build units ≈ 19 + 12 + 7 = 38**, riding ~15 state-variants along for near-free.

## What already has backend, what doesn't (checked directly, not assumed)

- **Auth**: `/login` and `/register` pages + Supabase Auth actions (`app/[locale]/(auth)/actions.ts`:
  `login`, `register`, `signInWithGoogle`) already exist and are `impl: "built"`. **Reset password and
  Email OTP have NO code at all** — no page, no server action — though Supabase Auth's SDK provides the
  primitives (`resetPasswordForEmail`, OTP verify) so this is wiring, not inventing a backend. Apple
  and GitHub OAuth buttons appear in the new designs but only Google OAuth is implemented.
- **Billing**: a `subscriptions` table already exists in the DB schema (`20260712000001_schema.sql`),
  but **zero PayOS integration code** (`grep -rl PayOS lib app` → no hits outside admin stats), no
  `/settings/membership` route, no checkout flow. This is genuinely new backend work, not just UI —
  and it's the dependency L9b already flagged: account deletion must cancel PayOS *before* removing
  the `subscriptions` row, so billing must exist before deletion is fully correct.
- **Error UX**: no `app/**/error.tsx` or `not-found.tsx` anywhere in the repo — Next.js is serving its
  default fallback today. Building `335:1976`/`337:2055` is framework-idiomatic (drop-in special files)
  once the visual design is ported, so this is smaller than it looks.
- **New marketing Homepage (`347:6277`)**: conflicts with the EXISTING `/` route, which is already
  `impl: "built"` as `repo-only` (no Figma link recorded). This is a **redesign/reconciliation call**,
  not a build-from-zero — needs a ruling on what happens to the current landing page.
- **The 32 unbuilt screens spread across existing modules** (Kanji, Pronunciation, Conversation, JLPT,
  Companion, Profile/onboarding) mostly build on top of already-`built` parent modules/APIs — but a
  meaningful chunk is blocked on **open product rulings, not effort**: notably the Kanji
  explorer-vs-library dual-surface question (`mem:phase0_figma_inventory_run_state`, still open since
  Phase 0) covers 2 of the 19 independent units by itself.

## Effort estimate — framed in this repo's own unit (SDD plans/branches), not generic hours

"Hours" isn't a number this project has ever tracked (agentic dev, not timesheets), so the estimate
uses the repo's actual cadence instead. `docs/superpowers/plans/` has **19 dated plans between
2026-07-15 and 2026-08-20** (36 days) — roughly one plan/branch every 1.5–2 days of active engagement,
each sized similarly to L9b Plan 1 (13 tasks, one branch, one whole-branch review cycle).

Bucketing the 38 independent units into L9b-sized plans by natural module clusters:

| Cluster | Rough plan count | Blocked on |
|---|---|---|
| Auth completeness (reset password, email OTP, Apple/GitHub OAuth, restyle Login/Register) | 1 | nothing — can start now |
| Billing/Layer 8 (PayOS port + checkout + pricing/FAQ + `/settings/membership` + cancel flow) | 2 | payment provider ruling — RULED 2026-08-23 (PayOS-only, provider-agnostic port shape) |
| Error UX (404 + error boundary + design-system tone pass) | 0.5 (foldable into another plan) | nothing |
| Marketing homepage reconciliation | 1 | needs a ruling: replace `/`, or is `347:6277` a different route? |
| Kanji cluster (explorer + library) | 1 | nothing — ⚠️ CORRECTED 2026-08-23: an earlier draft of this file said the dual-surface question was "open since Phase 0". **That was false.** `docs/product/capability-map.md` §3.4 RULED it on 2026-08-12: both surfaces ship under ONE nav row, `/kanji` defaults to the curriculum surface, the explorer is a browse mode inside it. Browse-by-radical survives and is cheap (table + FK + index + RLS all exist); curated collections survive and DO have a schema gap. Four domain nouns (learning path · course · kanji lesson · study material) still need naming decisions before building. |
| Companion cluster (learning memory, growth areas, conversation memory, welcome page, sensei/companion-home placeholders) | 2 | nothing structural |
| JLPT cluster (phase test, practice result, review-mistake family, remaining state-variants) | 1–2 | nothing structural |
| Conversation practice + pronunciation-detail + pronunciation-library placeholder | 1 | nothing structural |
| Profile/onboarding (edit-profile, quickstart, generate-sensei) + search-lesson + remaining placeholders (review, challenges, roadmap, weekly-report, statistics, achievements, settings, explore-lessons) | 2–3 | nothing structural |

**Total ≈ 12–14 plans.** At the repo's own historical cadence (~1 plan per 1.5–2 days of active
engagement), that is roughly **4–7 weeks of continued active work** — this is a velocity observation
about THIS repo's agentic workflow, not a generic estimate, and it assumes: the user keeps reviewing at
the same pace, no plan needs more than L9b's one fix-wave, and the open rulings (Kanji dual-surface,
homepage reconciliation) get answered promptly rather than stalling a plan mid-flight.

## Speed-up levers (concrete, not generic advice)

1. **Answer the two open product rulings early** (Kanji explorer-vs-library, new-Homepage-vs-existing-`/`)
   — each currently blocks a whole plan from starting cleanly; answering them now removes a stall later.
2. ✅ **DONE — the new frames are registered** (Screen Registry Phase 3 Stage 1, branch
   `screen-registry-phase-3`). This lever has been spent; every downstream plan now has an accurate
   `figmaCheckedAt` for them. One caveat that survives: `login`/`65:2` still carries the older
   `2026-08-12` stamp, deliberately — nobody re-compared that row, and moving a stamp nobody earned
   is what `G2` exists to prevent.
3. **Build the payment code as a provider-agnostic port from day one** (mirrors `lib/ai`, `lib/email` —
   see `mem:korume-shared-infra-preference`), even though only the PayOS adapter ships now — avoids a
   rework pass when SePay/MoMo are added later.
4. **Cluster by module, not by frame** (already this project's pattern) — one SDD plan per row above,
   not one branch per screen; this is what kept L9b to a single branch for 13 tasks instead of 13
   branches.
5. **Parallelize independent clusters via worktrees** (`superpowers:using-git-worktrees`,
   `superpowers:dispatching-parallel-agents`, `docs/lessons.md` L-016/L-020/L-021) — Auth, Billing, and
   the Companion cluster touch disjoint files and could run as concurrent branches instead of serial
   ones, which is the single biggest lever on calendar time (though not on total agent-work).
6. **State-variants are already free** — don't plan them separately; they ride their parent screen's
   task list, same as `339:3612` rode `337:3323` in L9b.

## Related

`mem:figma_recapture_2026_08_23_run_state` · `mem:project_status` · `lib/product/screen-registry.ts`
(header comment, sourcing rules) · `docs/superpowers/plans/` (the cadence evidence) ·
`mem:phase0_figma_inventory_run_state` (the Kanji dual-surface open question).
