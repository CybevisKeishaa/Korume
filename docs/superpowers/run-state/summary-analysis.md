# Branch Run State

## Goal and scope

Summary / Analysis mode (Part 4, Figma `125:1030`): deterministic lesson snapshot, shared grounded lesson analysis,
personal lesson-local Korume reflection, Review Tomorrow, saving words and expressions. Free = Plus.

## Authorities

- Spec: `docs/superpowers/specs/2026-10-04-summary-analysis-design.md` — frozen by the owner at `2b701cd`.
- Plan: `docs/superpowers/plans/2026-10-04-summary-analysis.md` (17 tasks) — **approved by the owner 2026-10-04 with
  Plan corrections C1–C5**; `selection` stays in the Vocabulary tile and Saved Knowledge Retention as the frozen spec says.
- `AGENTS.md`, `docs/lessons.md`, `.codex/docs/workflow.md` §8.

## Accepted commits

- `4b1ea1c` spec · `2b701cd` spec contract fixes (frozen) · plan (this commit).

## Contracts and decisions

- Owner 2026-10-04: `npx supabase db reset` approved for THIS branch, local Supabase only; a reset wipes the local
  dictionary and the Ep.729 demo lesson — re-import with the 1b worktree's `.tmp/import.sh` and
  `scripts/seed-real-lesson.ts` before any live or Chrome check.
- Live Gemini smoke pre-approved (free tier, synthetic evidence rows only).
- Measured before planning (2026-10-04, live Gemini, 2/2 each): item schemas from `z.looseObject(...)` and
  `z.looseObject(...).catch(null)` are accepted; Gemini put a requested reading into free text instead of an extra
  field — strict item schemas cannot catch facts smuggled into prose (prompt rule + manual live review instead).

## Verification

- Task 1 (Codex via Paseo, 1 run; Claude reviewed): 11 files / 68 tests green on re-run; `db reset` 0. Live Postgres
  probe (rolled back): duplicate vocabulary → 23505 on `sentence_mining_cards_one_knowledge`; selection repeats OK;
  null-ref selection and ref-carrying sentence → 23514; `ON CONFLICT (cols)` without predicate → 42P10 (proves the
  brief's correction). Mutations: drop the 23505 branch → RED; drop `.strict()` → RED. Deferred nit: POST route
  conflict test does not assert the body carries the existing card.
- Task 2 (Codex hit its quota before writing anything, 14:50 — Claude implemented): plan SQL applied verbatim after a
  live rolled-back exercise (evidence shape, Review Tomorrow least(), lease leader/follower/stale/ready, definer grants);
  pin test RED (missing) → GREEN 4/4; export guard RED (36 vs 35, `lesson_reflections` unaccounted) → GREEN; mutation
  (drop `authenticated` from one revoke) → pin RED; `db reset` 0; `tsc` 0.
- Task 3 (Claude, Codex quota out): `npm run verify:db:summary` PASS — 12 single-session cases + 4 race checks
  (20-connection reflection lease, lesson_analysis knowledge lease, Review Tomorrow one card, expired-lease takeover with
  stale token refused). Mutations, live: policy `using (true)` → FAIL 8; drop `sentence_mining_cards_one_sentence` →
  case 7 errors (42P10); `reflection_complete` without the token check → FAIL 11. After `db reset`:
  `verify:db:summary` and `verify:db:knowledge` both PASS.
- Task 4 (Claude): `runLeasedGeneration` in `lib/knowledge/leased.ts`; orchestrator delegates; `KnowledgeStore extends
  LeaseStore<KnowledgeKey>` (not `& BudgetStore` as the plan said — BudgetStore is a Pick of KnowledgeStore, so that
  would be circular); `createMemoryLeaseStore<K>`. Regression suite 266 → 274 (8 new, 0 changed); tsc 0; lint 0.
  Mutation: a reservation before the claim → 6/8 leased tests RED incl. "never lets a follower reserve".
- Task 5 (Codex via Paseo, 1 run; Claude reviewed): snapshot/thresholds/loader, 16 tests (+1 refs) green on re-run;
  mutations: retention denominator → RED, `p_mastery: 1` → RED, target ordering reversed → RED.
- Task 6 (Codex, 1 run): Review Tomorrow service 13 + route 7 tests green on re-run; `nextLocalMidnightUtc` checked
  in node by Claude for HCM, NY, Santiago DST (local 01:00), Paris, Kiritimati, Pago Pago, Kathmandu. Mutations:
  `now + 24h` → 6 RED; drop the `t > now` guard → RED via an added invariant test. Note for Task 14: the service
  schedules EVERY review target (spec §6.2), while the list shows at most 5 — UI copy must not promise "these 5".
- Task 7 (Codex, 1 run, finished just before its quota ran out at 19:45): navigation 10 tests green on re-run;
  the PostgREST `collections!inner(kind)` filter shape was probed live by Claude (200). Mutations: drop the
  position filter → RED; first-not-last resume line → RED.
- Task 8 (Claude, Codex quota out): analysis input/schema/prompt/finalize + `FinalizeError`; 22 new tests. Plan
  deviation: zod v4 types reject `looseObject(...).catch(null)`, so `schema.ts` keeps that exact runtime schema and
  states the result type with a cast — `z.toJSONSchema` output re-checked: `default: null`, `additionalProperties: {}`,
  the shape measured on Gemini (adding `.nullable()` instead would change the schema Gemini receives, unmeasured).
  Mutations: span check → `true` → Review Focus 2 test RED; skip the strict word parse → extra-field test RED.
  Note for Task 14: stored expression spans are NFKC (half-width `?`), so highlighting must match NFKC, not raw text.
- Task 9 (Claude, Codex quota out): view/hydrate/service/route; 29 new tests (service 12 over the real memory store
  + fake provider, hydrate 4, view 1, route 12). Mutations: grammar title from the artifact → RED; drop the read
  path's failed branch → RED; video id out of the cache key → RED. Rate limit runs before the no-transcript answer.
- Task 10 (Claude): reflection evidence/schema/prompt/fallback/view, 13 tests. Plan deviation: the AI schema uses
  empty strings for "no highlight" instead of `.nullable()` — no repo schema has sent a nullable field to Gemini,
  so none starts here unmeasured. The type-boundary test is compile-only (tsc). Mutations: a score in evidence → 2
  RED; `nextLesson?` accepted by `ReflectionEvidence` → tsc TS2578.
- Task 11 (Claude): reflection store/service/route, 13 service tests (per-user memory store over
  `createMemoryLeaseStore`) + 11 route tests. The SQL store's RPC shapes were exercised through local PostgREST
  (claim → leader row array, complete → true, latest ready read, claim → ready, fail on ready → false). Mutations:
  stale reported as ready → 2 RED; evidence fingerprint constant → 3 RED.
- Task 12 (Claude): `LessonHeaderFrame` (props only) + `WorkspaceHeader` on it; `HEADER_ICON_BUTTON` re-exported;
  Summary `complete: true`, so the workspace header now shows the mode bar. Workspace suite 295 → 301. Existing tests
  updated to that intended truth (named here): mode-nav "nothing with the real registry", workspace-header "no mode
  bar", learning-modes 1a case; seven tests' `@/lib/i18n/navigation` mocks gained `usePathname`; selection-popover and
  utility-drawer list queries now scope to the transcript list (the mode bar is a `<ul>` too); e2e
  `route-group-provider-identity` focus chrome now counts the Main nav (0) and the Learning-modes nav (1) — NOT RUN
  yet (Task 16). Mutation: a probe importing workspace-context + "isPlus" under lib/summary → 2 boundary tests RED.
  To check in Chrome (Task 17): the header with the mode bar must stay one row ≤ 48 px at 1280×529.
  Follow-up `9b475ba`: Task 12 had left `components/ui/token-scale.test.ts` RED (shadowing-workspace source pin
  44 → 45, lesson-header-frame) — I ran only the workspace suites before committing; now pinned.
- Task 13 (Claude): route `(focus)/shadowing/[id]/summary/page.tsx`, `components/lesson-summary/*` (header, hero,
  status, saved, review list, next, props, section heading, area helper, island placeholder), `.lesson-summary-grid`,
  `lessonSummary` copy in both catalogs (parity tests green). Figma frame saved at
  `.superpowers/sdd/summary-analysis/figma-125-1030.png`. Hero renders no AI overview (spec §7.2 has none). The token
  scan now covers `components/lesson-summary` (11) and the summary route (1). Mutations: a real 0 shown as Not
  started → RED; Lesson Status before the hero → order test RED. 1037 tests across the touched suites green.

- Task 14 (Codex 2 runs, then Claude): Codex delivered a thin first cut (7 tests, no mutations, unstyled, a
  hard-coded English error) and stopped twice with the work unfinished; Claude rewrote the six files on the frame
  (Card/Badge/Button/Skeleton, `HEADER_ICON_BUTTON` bookmark toggle) and wrote the plan's full cases: hook 6, island
  11, save 6, Review Tomorrow 4. Found by the tests: when a stale GET and the follow-up POST land in one tick React
  batches the stale body away, so the hook gained `onBody` (sees every body) and the island keeps the last AI text
  from it. Deviations: `hasTranscript` added to the island props (plan gap); new copy key `lessonSummary.saveFailed`
  (both catalogs); no-transcript lessons never fetch the reflection (plan: `enabled: analysis.settled`). Boundary
  floor 15 → 40 (real count), token-scale lesson-summary 11 → 16. Mutations, each RED then reverted: stale ignored by
  `needsPost`; stale text kept only on `ready`; raw ref compare in SaveToggle; `disabled` instead of `aria-disabled`;
  Retry gate always open.

- Execution (owner 2026-10-04): Codex via Paseo, one task per run, packets in `.superpowers/sdd/summary-analysis/`;
  Claude reviews, runs DB/e2e gates and commits each task; tasks back to back.
- Plan-code correction (Task 1 brief): Summary saves use insert + `23505` → re-read, not `upsert(onConflict)` —
  the knowledge unique index is partial and `ON CONFLICT (cols)` without its predicate cannot infer it (42P10).

## Working tree and environment

- Owner: Claude
- Worktree `.worktrees/summary-analysis`, branch `summary-analysis`, from master `09d2684`. Own `node_modules`
  (`npm ci`) and a copy of the main `.env.local`. Paseo workspace `wks_8b67611c339e7409`.

## Blockers

None.

## Next actions

1. Task 15 (clip player: "Hear in lesson" buttons via the clip context).
