# Nihongo Cinema — Project Status

Read this first each session. Source of truth for the product is
`../japanese-learning-app-spec.md`; root rules are `CLAUDE.md`; agent workflow +
8-layer build order + branching policy is `.claude/docs/workflow.md`.

## What this is
Web app to learn Japanese through video shadowing/dictation + kanji/vocab/grammar/JLPT,
with a cinematic scroll-driven UI. Built in 8 layers (one per session), all 8 = the finished
product (not an MVP cut). Use `/build-layer <n>`.

## Stack (as implemented)
- Next.js **14.2.35** App Router + TypeScript strict + Tailwind. React pinned **18.3.1**
  (Next 14 needs React 18; repo was originally CRA/React 19).
- Supabase (Postgres + Auth + Storage) via `@supabase/ssr`. Zod validation.
- Motion: Lenis + Framer Motion + GSAP/ScrollTrigger.
- Tests: **Vitest + RTL** (unit, `*.test.ts(x)`), **Playwright** (`tests/e2e/`).
- Decision: staying on **Next 14** despite npm audit advisories (spec pins it; low real
  exposure — App Router, not Pages-Router i18n). Revisit at Layer 8. Do NOT silently bump.

## Branching & merge policy (user-set)
One branch per layer: `layer-<n>-<slug>` off master. Merge to master with `git merge --no-ff`
ONLY after Definition of Done (tests pass + code-reviewer sign-off). Never push to a remote
unless the user explicitly asks. Documented in `.claude/docs/workflow.md` §6.

## Progress
- **Layer 1 (Foundation): DONE, APPROVED, MERGED TO MASTER.** Feature commit `80aae8d`, merge
  commit `1d1628e`. (An `origin/master` remote exists but nothing has been pushed.) Delivered:
  CRA→Next 14 migration; full spec §4 schema (29 tables incl. `pitch_score`, RLS on all,
  indexes, original seed) in `supabase/migrations/`; Supabase Auth (email + Google) + session
  middleware with route protection; design system + reduce-motion; layout shell; shared motion.
  `lib/safe-redirect.ts` guards open-redirect.
- **Layers 2–8: NOT STARTED.** Next = **Layer 2**: Kanji + Vocab + Grammar modules + SRS (SM-2)
  engine. Schema + app shell already exist (stub pages under `app/(app)/`). When starting,
  first `git checkout master` then create branch `layer-2-static-content`.

## DB / running locally
- User chose **Supabase Cloud** but hadn't created the project during Layer 1. A **local
  Supabase (Docker)** was started (`npx supabase start`) and `.env.local` points at it, so the
  app runs today: `npm run dev` → http://localhost:3000. Studio http://127.0.0.1:54323. Stop
  with `npx supabase stop`. (`.env.local` is gitignored — recreate from `.env.local.example`.)
- To move to cloud: create free project → swap 4 values in `.env.local` → `npx supabase link
  --project-ref <ref>` → `npx supabase db push`. Google OAuth needs client id/secret in dashboard.

## Verify commands
`npx tsc --noEmit` · `npm test` (15 passing) · `npm run build` · `npm run test:e2e` ·
`npx supabase db reset` (re-applies migrations + seed).

## Deferred follow-ups (reviewer-approved as non-blocking for L1)
GDPR "delete all my data" (cascade FKs already wired); `getUser()` runs in middleware on all
routes (perf — could narrow matcher); conditional `aria-describedby` on auth form;
`users_update_own` RLS lets a user edit own email/level (tighten to column scope later).

## Working agreements
TDD-first; every feature ships with tests + shown passing output. code-reviewer signs off every
non-trivial change before a layer is "done" (CLAUDE.md §9). Data flows down: schema → API → UI.
Never download/proxy video (YouTube IFrame only). Commit only when asked; branch-per-layer +
merge-to-master-when-done as above.
