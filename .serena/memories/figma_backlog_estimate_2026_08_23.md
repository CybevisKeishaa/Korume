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
classification as its twin `218:15740`). `347:6277` was deferred here pending the marketing-homepage
identity question; that was ruled 2026-08-26 and it is now registered as `landing-page`. **How many
of the batch remain unregistered is `docs/product/figma-frame-map.md`'s to state, not this file's**
(it is the named single home for the batch accounting, and this paragraph already says so) — an
earlier draft of this sentence wrote a total here and got it wrong. The `kind`/`navGroup` judgment calls this paragraph worried
about were made and reviewed: Unsubcribe membership and Choose method are `state-variant`s of
Membership, exactly the way Delete data is of Data privacy.

**Consequence for the estimate below: the "9 newly-captured, still-unregistered frames" it counts as
a separate bucket are no longer unregistered.** Registration was never build work, so the *build*
estimate is unaffected — but do not re-plan "register the new frames" as an outstanding task.

## Backlog measured from the registry (2026-08-23)

⚠️ **The command this section originally recorded OVER-COUNTED every bucket by exactly one.** It was
`grep -o 'impl: "[a-z]*"' … | sort | uniq -c`, unanchored — so it also matched the registry's own
*prose* in two places: the header comment (`lib/product/screen-registry.ts:54`, which writes
`impl: "placeholder"` and `impl: "built"` while explaining the field) and an inline section banner
*inside* the array (`:1608`, `impl: "none" for all — no page, no server`). That is the identical
counter-trap `L-002` already documents for `navGroup`. **Anchor to the field's own indentation:**

```
grep -c '^    impl: "built"'       lib/product/screen-registry.ts
grep -c '^    impl: "placeholder"' lib/product/screen-registry.ts
grep -c '^    impl: "none"'        lib/product/screen-registry.ts
grep -c '^  {$'                    lib/product/screen-registry.ts   # total rows
```

**Re-measured 2026-08-25 at `73676b5`** (branch `screen-registry-phase-3`, i.e. WITH the 2026-08-23
batch registered — 88 rows): **36 built · 12 placeholder · 40 `none`**. Cross-tabbed by `kind`, the
40 `none` rows are 26 `screen` + 13 `state-variant` + 1 `deprecated` (the superseded Shadowing Hub).

So: **26 independent unbuilt screens**, plus **12 placeholders** to finish, riding **13
state-variants** along for near-free (they ride their parent's build, same as `339:3612` rode
`337:3323` in L9b).

**Total independent build units ≈ 38.** ⚠️ That this total is unchanged from the original figure is
a coincidence — two counting errors and the newly-registered frames cancelled out. It is **not**
evidence the old numbers were fine. Re-run the commands above rather than quoting any figure here.

⚠️ The pre-2026-08-25 text also counted "**9 newly-captured, still-unregistered** frames" as a
separate bucket on top. They are registered now (§ Registry status above) and the 88-row measurement
already includes them — do not add that bucket again.

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
- **New marketing Homepage (`347:6277`)**: ✅ **RULED 2026-08-26 — it IS the design for the existing
  `/`**, now registered on the `landing-page` row (`a9ad897`). So this is a **redesign of a built
  route**, not a build-from-zero and no longer a reconciliation call. Sizing note that survives the
  ruling: the frame's own render is below the bar set by the reference image `346:6275` (missing
  photography/mascot art, missing connector linework, a bar chart where a dual pitch contour belongs,
  a broken 5-step row), so the port is "build to the reference using the frame's structure", which is
  more than a straight port. Authority: spec §9.1 + `docs/product/figma-frame-map.md`.
- **The unbuilt screens spread across existing modules** (Kanji, Pronunciation, Conversation, JLPT,
  Companion, Profile/onboarding) mostly build on top of already-`built` parent modules/APIs. ⚠️ An
  earlier draft said a "meaningful chunk is blocked on open product rulings", naming the Kanji
  explorer-vs-library dual-surface question as **still open since Phase 0**. **That was false** —
  `decision-register.md` **P4** ruled it on 2026-08-12 (evidence: `capability-map.md` §3.4). See the
  Kanji cluster row below.
  The one genuinely open ruling this backlog had left — the marketing-homepage identity question
  (`347:6277` vs the existing `/`) — was **ruled on 2026-08-26**. This backlog now has none.

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
| Marketing landing page (`347:6277` → the existing `/`) | 1 | nothing — RULED 2026-08-26: it IS the design for `/`. Build to reference image `346:6275`'s visual bar using the frame's structure; the frame's footer and its "A quieter way to keep going." section are authoritative. |
| Kanji cluster (explorer + library) | 1 | nothing — ⚠️ CORRECTED 2026-08-23: an earlier draft of this file said the dual-surface question was "open since Phase 0". **That was false.** `decision-register.md` **P4** RULED it on 2026-08-12 (evidence pointer: `capability-map.md` §3.4): both surfaces ship under ONE nav row, `/kanji` defaults to the curriculum surface, the explorer is a browse mode inside it. Browse-by-radical survives and is cheap (table + FK + index + RLS all exist); curated collections survive and DO have a schema gap. Four domain nouns (learning path · course · kanji lesson · study material) still need naming decisions before building. |
| Companion cluster (learning memory, growth areas, conversation memory, welcome page, sensei/companion-home placeholders) | 2 | nothing structural |
| JLPT cluster (phase test, practice result, review-mistake family, remaining state-variants) | 1–2 | nothing structural |
| Conversation practice + pronunciation-detail + pronunciation-library placeholder | 1 | nothing structural |
| Profile/onboarding (edit-profile, quickstart, generate-sensei) + search-lesson + remaining placeholders (review, challenges, roadmap, weekly-report, statistics, achievements, settings, explore-lessons) | 2–3 | nothing structural |

**Total ≈ 12–14 plans.** At the repo's own historical cadence (~1 plan per 1.5–2 days of active
engagement), that is roughly **4–7 weeks of continued active work** — this is a velocity observation
about THIS repo's agentic workflow, not a generic estimate, and it assumes: the user keeps reviewing at
the same pace, no plan needs more than L9b's one fix-wave, and the one open ruling (homepage
reconciliation) gets answered promptly rather than stalling a plan mid-flight.

## Speed-up levers (concrete, not generic advice)

1. ✅ **DONE 2026-08-26 — the one remaining open product ruling is answered.** New-Homepage
   (`347:6277`) IS the design for the existing `/`, so the marketing work can start without a stall.
   (An earlier draft listed Kanji explorer-vs-library here as a second one; that was false —
   `decision-register.md` **P4** ruled it 2026-08-12.)
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
`docs/product/decision-register.md` **P4** (the Kanji dual-surface ruling, 2026-08-12 — **ruled, not
open**) · `mem:phase0_figma_inventory_run_state`.
