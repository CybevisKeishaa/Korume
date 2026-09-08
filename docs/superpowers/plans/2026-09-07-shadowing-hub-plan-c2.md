# Shadowing Hub Plan C2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal `/shadowing` listing with the Figma `149:2` Shadowing Hub, driven by truthful lesson, quota, progress, recommendation, and companion data.

**Architecture:** C1's route, `TwoColumnShell`, lesson access model, collection/taxonomy tables, and ranking port remain the foundation. C2 adds a server-only Hub read model that composes those existing sources behind one typed contract; focused presentational components render each of the eight Figma sections. Client code is limited to the import interaction. The page never invents percentages, ETAs, recommendation reasons, or activity data that is absent.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript strict, Tailwind tokens, next-intl, Supabase, Vitest + RTL, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-07-shadowing-hub-plan-c-design.md` sections 4 and 6; Figma file `IwFHZDZdHW7qsSFiNbWrkd`, node `149:2`.

## Global Constraints

- Figma decides presentation; semantic tokens and existing primitives decide implementation. Never paste generated Figma code or raw design pixels into production source.
- A Lesson remains the canonical object; every Hub section is a projection of `videos`, never a duplicate store.
- YouTube playback uses the official IFrame Player API only. Do not download, proxy, extract, or persist media.
- Import quota must use `user_lesson_library`; Plus is unlimited. A quota state is contextual discovery, never a trial.
- A building lesson shows only the real current step label; C4 owns durable asynchronous progress, percentages, and ETA.
- Recommendations must contain a derived reason from learner data. Do not render sample Figma reasons or templates as user facts.
- The Companion rail is supplementary, hidden below `xl`, and no information needed to learn may exist only there.
- All strings are localized in `messages/en/shadowing.json` and `messages/vi/shadowing.json`; reuse `common` only for strings already shared by another module.
- Preserve keyboard navigation, WCAG AA contrast, focus-visible treatment, and reduced-motion behaviour.

---

## File structure

| File | Responsibility |
| --- | --- |
| `lib/data/shadowing-hub.ts` | One server-only orchestration contract for all Hub sections. |
| `lib/data/shadowing-hub.test.ts` | Deterministic data-contract and no-fabrication tests. |
| `lib/data/recommendations.ts` | Add truthful, derived recommendation-reason data. |
| `components/shadowing/hub-*.tsx` | Small, presentational Hub regions: cards, shelves, import, rail. |
| `components/shadowing/*.test.tsx` | RTL coverage for each interaction/empty state and accessibility contract. |
| `app/[locale]/(protected)/(app)/shadowing/page.tsx` | Thin server composition of the Hub and C1 `TwoColumnShell`. |
| `messages/{en,vi}/shadowing.json` | Hub copy; no English literals in components. |
| `tests/e2e/shadowing-hub.spec.ts` | Real route, keyboard, responsive, and no-fabrication browser checks. |

### Task 1: Define the Hub server contract

**Files:**
- Create: `lib/data/shadowing-hub.ts`
- Create: `lib/data/shadowing-hub.test.ts`

**Interfaces:**
- Produces `getShadowingHub(): Promise<GetShadowingHubResult>` where a success carries `featured`, `library`, `continueLearning`, `recentlyAdded`, `popular`, `recommendations`, `quota`, and `rail` fields.
- Consumes C1 collection functions, `PopularStrategyV1`, `getRecommendations`, `getUserStats`, and the authenticated server user.

- [x] Write tests first for a signed-out result, a ready/private lesson, an unavailable-transcript lesson, and a no-data result. Do not add a server-side `building` projection: C4 owns the durable job source it would require.
- [x] Run `npm exec vitest -- run lib/data/shadowing-hub.test.ts`; verify the missing module fails.
- [x] Implement the discriminated result and orchestration function. Query through existing data-layer functions; return `null` for unavailable optional sections rather than sample rows.
- [x] Re-run the focused test and commit `feat(shadowing): add Hub read model`.

### Task 2: Add an honest recommendation reason

**Files:**
- Modify: `lib/data/recommendations.ts`
- Modify: `lib/recommendation-types.ts`
- Modify: relevant recommendation unit tests

**Interfaces:**
- Extends `VideoRecommendation` with `reason: RecommendationReason | null`, where the reason is a structured, measurable fact (for example known-word fit or a recorded weak grammar signal), not a rendered sentence.
- `getShadowingHub` consumes the structured reason and the UI localizes it.

- [x] Add a failing unit test proving a recommendation never returns the Figma sample copy and that a reason is absent when no supporting learner data exists.
- [x] Implement the smallest reason taxonomy backed by fields already read by the scorer; do not claim a grammar weakness until an actual grammar-mistake source is queried.
- [x] Update the recommendation API contract tests and the shared type consumers.
- [x] Run focused recommendation and Hub tests, then commit `feat(recommendations): expose truthful learning reasons`.

### Task 3: Build reusable Hub lesson cards and section headings

**Files:**
- Create: `components/shadowing/hub-section-heading.tsx`
- Create: `components/shadowing/hub-lesson-card.tsx`
- Create: `components/shadowing/hub-lesson-card.test.tsx`

**Interfaces:**
- `HubLessonCard` accepts a typed lesson projection, action label, optional progress, and `href`.
- It does not issue fetches, choose rankings, or use a hardcoded image; stored lesson thumbnails remain the source.

- [x] Write RTL tests for semantic heading hierarchy, accessible lesson link, thumbnail fallback, progress label, and focus-visible link.
- [x] Verify RED with absent components.
- [x] Implement token-based card geometry responsive from one column to the Figma shelf layout, reusing `next/image`, `Link`, and current card tokens.
- [x] Run focused tests and commit `feat(shadowing): add Hub lesson card primitives`.

### Task 4: Port the import and My Lessons state machine

**Files:**
- Create: `components/shadowing/hub-import-section.tsx`
- Create: `components/shadowing/hub-library-section.tsx`
- Create: corresponding RTL tests
- Modify: `components/video/video-import-form.tsx` only if extracting its validated POST behaviour avoids duplication

**Interfaces:**
- `HubImportSection` receives `{ used, limit, tier }` and uses the existing validated `/api/videos/import` endpoint.
- `HubLibrarySection` receives typed `ready | unavailable` projections. `HubImportSection` owns the short-lived client submission state and may say it is preparing the lesson while the request is pending.

- [x] Write failing tests for quota copy, disabled submit during request, truthful preparing copy while the request is pending, 403 quota response, ready/open action, unavailable/retry state, and the absence of percentage/ETA UI. C4 is the only plan allowed to replace this pending state with job progress.
- [x] Implement by reusing the existing form validation/error mapping. Keep the server contract authoritative after refresh; no optimistic fake pipeline.
- [x] Run the focused component tests and checkpoint the import/library implementation.

### Task 5: Port the editorial Hub shelves

**Files:**
- Create: `components/shadowing/hub-shelves.tsx`
- Create: `components/shadowing/hub-shelves.test.tsx`

**Interfaces:**
- Renders Featured, Continue Learning, Recently Added, Popular, and Recommended projections passed from Task 1.
- Recommended cards require a non-null structured reason before displaying a reason line.

- [x] Write tests for ordered section landmarks, empty sections being omitted rather than replaced with sample cards, and recommendation reason rendering only from the supplied contract.
- [x] Implement the five data-driven shelves with `HubLessonCard`; use the existing ranking strategy rather than duplicating a popularity formula.
- [x] Run the focused tests and checkpoint the editorial shelves.

### Task 6: Port the Companion rail as an optional, truthful summary

**Files:**
- Create: `components/shadowing/hub-companion-rail.tsx`
- Create: `components/shadowing/hub-companion-rail.test.tsx`

**Interfaces:**
- Accepts an optional rail projection with goal, weekly activity, summary stats, and an optional suggestion link.
- Renders no fabricated chart, estimate, or insight when its source data is absent.

- [x] Write failing tests for complementary-label semantics, no-data fallback, suggestion link, and an empty weekly chart that is not announced as a completed activity history.
- [x] Implement the authoritative rail projection without relabelling generic user statistics as weekly Shadowing data. Do not mount `CompanionAnchor`; this is not an approved Hub anchor.
- [x] Run focused tests and checkpoint the truthful Companion rail.

### Task 7: Replace the route body and localize the product copy

**Files:**
- Modify: `app/[locale]/(protected)/(app)/shadowing/page.tsx`
- Modify: `messages/en/shadowing.json`
- Modify: `messages/vi/shadowing.json`
- Add/modify: message pin tests only for newly introduced invariants
- Create: `app/[locale]/(protected)/(app)/shadowing/page.test.tsx` if the route pattern supports server-component characterization

- [x] Characterize the actual route through its deterministic read-model tests and browser assertions for one `main` landmark and the responsive rail landmark.
- [x] Replace the legacy `Container`/flat grid with C1's `TwoColumnShell`, the new sections, and `getShadowingHub`.
- [x] Move every new literal into both locale catalogs; preserve existing keys still used by other callers.
- [x] Run focused page/message tests and checkpoint the Hub page port.

### Task 8: Accessibility, responsive fidelity, and final verification

**Files:**
- Create: `tests/e2e/shadowing-hub.spec.ts`
- Modify only files discovered by the tests above

- [x] Write Playwright checks for `/en/shadowing`: all lesson actions keyboard-reachable, import error announced, no horizontal overflow at 390px, companion rail absent below `xl`, and no fabricated building percentage/ETA.
- [ ] Verify they fail against the legacy page, then implement only repairs necessary to pass.
- [ ] Run `npm exec vitest -- run`, `npm run typecheck`, `npm run lint`, `npm run build`, and the new focused Playwright spec on a fresh production server.
- [ ] Compare 1536px and 390px renders with Figma node `149:2`; verify reduced motion does not hide content or block actions.
- [ ] Commit the verification repair, request a task review, then a whole-branch review before merge.

## Self-review

- Spec coverage: C2's eight-section Hub, real import quota, library states, popularity port, i+1 recommendations with reasons, Companion rail, responsive shell, and no-fabrication rule are each covered by Tasks 1–8.
- Excluded on purpose: Explore and Quick Preview belong to C3; durable import-job percentages and ETA belong to C4; no PayOS checkout is introduced.
- Placeholder scan: no undecided data source is silently displayed. Where source data does not exist, the plan requires omission or a neutral empty state.
- Type consistency: only Task 1 creates Hub projections; every later component consumes those projections rather than reconstructing database rows.
