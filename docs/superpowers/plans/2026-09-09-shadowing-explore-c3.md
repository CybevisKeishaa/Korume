# Shadowing Explore Lessons — Plan C3

> **For implementation:** execute in this worktree (`shadowing-explore-c3`) in the listed order.
> The source design is Figma `IwFHZDZdHW7qsSFiNbWrkd`, nodes `200:7705` and `200:10726`.

**Goal:** replace `/shadowing/explore`'s upcoming placeholder with the desktop Explore Lessons screen, driven only by authorized lesson, transcript, taxonomy, collection, and recommendation data. The preview drawer keeps the approved transcript preview and Add-to-library action.

**Scope boundary:** C3 includes the hero's catalogue search, situation context, imported lessons, recent/recommended shelves, quiet factual suggestion, five curated shelves, and the preview drawer. It excludes the global `Search lesson` command palette (`212:14610` / `212:14753`), a standalone bookmark persistence model, deletion of imported lessons, pagination, creator/tag/grammar search facets, fabricated Companion copy, and C4 import-job progress.

**Authorities:** `AGENTS.md`; `docs/lessons.md`; `.codex/docs/workflow.md`; `docs/superpowers/specs/2026-08-07-shadowing-hub-plan-c-design.md` §5 and D13–D15, D18; `docs/product/screen-inventory.md` §8; current Figma design context for the two nodes.

## Design and data contract

- Route: `/[locale]/shadowing/explore`, `(app)` chrome, desktop-only through the existing global mobile-app handoff. It is a full-width `TwoColumnShell` without a Companion rail.
- Query: validated bounded `q` and `situation` URL parameters. A selected situation constrains **every shelf below it**; query text constrains all catalogue shelves. Unsupported Figma facets are not advertised or simulated.
- Lesson display metadata is derived in a batched read: current visible video, newest transcript, playback-ordered line count, first three Japanese lines, and word count using the existing `contentLemmas` tokenization semantics. Missing data stays missing.
- My Imported Lessons reuses the C2 `HubLibrarySection` semantics and its ready/unavailable states. It does not reproduce the Figma's invented percentage/ETA or create a C4 job state.
- The quiet suggestion is shown only for an existing recommendation with a measured reason. It is omitted when no such recommendation exists.
- The preview drawer is client-local state (not a route). It follows `200:10726` visually, adds the approved transcript region, and exposes Start plus one truthful Add-to-library affordance. Focus moves into the drawer, Escape/close restores focus to its opener, and the page behind is inert.
- The add endpoint validates the id, authenticates, confirms RLS-visible read access with the request client before service-role membership write, uses the existing idempotent upsert, and returns only opaque status errors. It does not fetch, proxy, or download video. Public catalogue saves must be excluded from the private-import quota count.

## Tasks

### 1. Lock the data and API contracts with RED tests

Files: create `lib/data/shadowing-explore.test.ts`, `lib/data/shadowing-explore.ts`, `app/api/videos/[id]/library/route.test.ts`, `app/api/videos/[id]/library/route.ts`; update `lib/data/lesson-library.test.ts`, `lib/data/lesson-library.ts`; create or extend `lib/validation/shadowing-explore.ts`.

Write failing tests first for unauthenticated Explore; one batched truthful projection containing library, recently added, recommendations, ordered situation chips, and five collection shelves; query/situation filtering affecting every shelf; first-three-lines ordering; missing transcript; collection cards with no invented grammar/series metadata; and empty measured suggestion. Test membership for malformed id (400), unauthenticated (401), RLS-invisible lesson (404), success, and duplicate add as success with `alreadyAdded`. Mutation-check the access guard by temporarily omitting the request-client video read and observing the invisible-lesson test go red.

Implement the composed read model without N+1 database reads: batch visible videos, membership, progress, latest transcripts and lines per request; share the existing tokenizer semantics for word counts; keep data types server-only. Extend `countMonthlyCreations` so it counts only learner-created private imports, not later saves of a public catalogue lesson. Implement the API as a narrow POST with UUID validation and no client-trusted user id.

### 2. Build reusable Explore cards, shelves, and drawer with RTL RED/GREEN

Files: create `components/shadowing/explore-lesson-card.tsx` and test, `components/shadowing/explore-shelves.tsx` and test, `components/shadowing/explore-preview-drawer.tsx` and test; reuse/update `components/shadowing/hub-library-section.tsx` only where its public props need Explore's localized import link; add primitive tests only when a needed existing primitive contract is absent.

Start with failing RTL tests: cards expose separate Start and Preview controls without nested interactive elements; shelf context changes all shelf card sets; no-data cases are honest; drawer shows three real lines or the unavailable state; Add posts only the selected UUID, enters a busy state, announces an error, and changes to its already-added state; keyboard open, Escape, close, and focus return work. Include a reduced-motion assertion for any transition class.

Implement the Figma hierarchy from tokens/primitives, not pasted pixel CSS: 4-up only where width allows, responsive grid below that, strong semantic landmarks and headings, valid accessible names, AA contrast, and `next/image` only for known image URLs. The drawer remains 420px at desktop and its extra transcript/add region follows the frame's existing panel vocabulary.

### 3. Replace the route placeholder and wire localization

Files: replace `app/[locale]/(protected)/(app)/shadowing/explore/page.tsx`; create `app/[locale]/(protected)/(app)/shadowing/explore/page.test.tsx`; update `messages/en/shadowing.json`, `messages/vi/shadowing.json`, and catalog/pin tests.

Write a failing page test that mocks the read model and verifies the full ordered landmark sequence, localized copy, form action retaining locale, validated default query/context, C2 My Lessons reuse, and no Companion rail. Add a contract test that the EN/VI Explore subtree has equal paths and ICU placeholders. Temporarily remove a required localized leaf to demonstrate the contract test fails, then restore it.

Render the server projection into the page and put only drawer interaction in a client boundary. Use the local hero search form and chip URLs; preserve the current locale. Add no `Cmd/Ctrl+K` handler and do not change `search-lesson` registry state. Update `screen-inventory.md` and `lib/product/screen-registry.ts` from placeholder/none to built only after the route is implemented.

### 4. Verify screen behavior, documents, and branch quality

Files: create `tests/e2e/shadowing-explore.spec.ts`; update `docs/design/screens/screen-shadowing-hub.md` only for a truthful link/entry-point statement if stale; update `docs/superpowers/run-state/shadowing-explore-c3.md` after each checkpoint; update `docs/lessons.md` in an existing applicable entry or with one compliant new lesson.

Add a browser test against a fresh isolated production artifact for 1023px handoff, 1024px desktop Explore, keyboard reachability of local search/chips/card preview/drawer actions, focus restoration, no horizontal overflow, reduced motion, and a controlled add-to-library success/error path. The e2e fixture must have at least one real visible lesson and assert non-empty selected collections; an empty selector may not satisfy the test.

Run focused RED/GREEN tests per task, then `npm run typecheck`, `npm run lint`, `npm test`, a fresh production `npm run build`, `git diff --check`, and the isolated browser spec. Use a new artifact/port, never the root worktree's long-lived server. Request a code review after each non-trivial checkpoint and a whole-branch review before merge. Do not merge or push without the user's direction.

## Expected change surface

The primary surface is a new `lib/data/shadowing-explore.ts` read model, a protected library-membership POST endpoint, three Explore UI components, one route replacement, translations, tests, and C3 documentation. It deliberately avoids schema changes: `user_lesson_library`, collections, taxonomy, videos, transcripts, and existing RLS are the authoritative homes.
