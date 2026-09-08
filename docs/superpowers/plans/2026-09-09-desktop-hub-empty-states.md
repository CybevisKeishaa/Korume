# Desktop Shadowing Hub Empty States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Shadowing Hub desktop-only, fluid, and complete even for a learner with no data.

**Architecture:** The locale root supplies a mobile app-download handoff below 1024px and hides the application tree. At desktop widths, application chrome is a horizontal flex layout and Hub is a `minmax(0, 1fr) | 300px` grid. Hub components always render their semantic regions and select data cards or a common honest empty interior. All customer-facing Hub and handoff text is supplied by a versioned EN/VI JSON copy contract.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript strict, Tailwind, next-intl, Vitest/RTL, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-09-desktop-hub-empty-states-design.md`

## Constraints

- `<1024px`: expose only the handoff. `>=1024px`: expose the web app. Do not build a mobile web layout.
- The handoff uses only `APP_STORE_URL` and `PLAY_STORE_URL` from `lib/app-stores.ts`, as external links.
- Desktop rail never stacks or hides; it is exactly 300px. Main content must expand when navigation collapses and never overflow horizontally.
- Always retain, in order: Featured, Import, My Lessons, Search/filter, Popular, Continue learning, Recently added, Recommended, then four companion cards.
- No no-data state may fabricate learner records, metrics, streaks, dates, estimates, charts, or recommendations. My Lessons alone may link to actual `#hub-import`.
- Components contain no localized product-copy literals. `hub.sections`, `hub.empty`, `hub.rail`, and `mobileHandoff` must exist with matching EN/VI paths and ICU placeholders.
- Preserve keyboard navigation, visible focus, WCAG-AA styling, and reduced-motion behavior.
- Shared desktop navbar/footer port is the next separate branch. Do not include it here.

## Task 1 — Add the mobile app handoff

**Files:** create `components/layout/mobile-app-handoff.tsx`, `components/layout/mobile-app-handoff.test.tsx`; modify `app/[locale]/layout.tsx`, `app/globals.css`, `messages/en/shadowing.json`, `messages/vi/shadowing.json`.

- [ ] Write a failing RTL test for a prop-driven `MobileAppHandoff`. It must find a labelled main landmark and App Store/Google Play links, assert their `href`s are `APP_STORE_URL`/`PLAY_STORE_URL`, and assert `target="_blank"` plus `rel="noreferrer"`.
- [ ] Run `npm exec vitest -- run components/layout/mobile-app-handoff.test.tsx`; confirm red because the module is absent.
- [ ] Add matching `mobileHandoff.{eyebrow,title,body,appStoreLabel,playStoreLabel}` values to both catalogs before any test pins copy.
- [ ] Implement the presentational component. Import URLs from `lib/app-stores.ts`; receive all copy as props; use semantic external anchors.
- [ ] Resolve the `shadowing` namespace in `app/[locale]/layout.tsx`, render the handoff before a `data-desktop-web` wrapper, and wrap all existing locale children in that wrapper.
- [ ] Add CSS: hide the handoff at desktop widths; in `@media (max-width: 1023px)`, make it at least `100svh` and apply `display:none !important` to `[data-desktop-web]`.
- [ ] Re-run the focused test green.
- [ ] Commit: `git add components/layout/mobile-app-handoff.tsx components/layout/mobile-app-handoff.test.tsx app/[locale]/layout.tsx app/globals.css messages/en/shadowing.json messages/vi/shadowing.json && git commit -m "feat(shadowing): add mobile app handoff"`.

## Task 2 — Repair desktop chrome and two-column geometry

**Files:** modify `app/[locale]/(protected)/(app)/layout.tsx`, `components/layout/app-nav.tsx`, `components/layout/two-column-shell.tsx`, `components/layout/two-column-shell.test.tsx`, `app/globals.css`.

- [ ] Add failing structural assertions in `two-column-shell.test.tsx`: no `hidden` rail, an outer `grid-cols-[minmax(0,1fr)_var(--layout-companion-width)]`, a `min-w-0` main, and a variable-driven rail width.
- [ ] Run `npm exec vitest -- run components/layout/two-column-shell.test.tsx`; confirm the existing column/`xl` behavior fails.
- [ ] Make application chrome a horizontal desktop flex row with `main` set to `flex-1 min-w-0`. Remove `md:` layout switching that exists only for mobile web, while preserving nav toggle semantics and keyboard control.
- [ ] Replace the shell's `flex-col`, `xl:flex-row`, conditional rail visibility, and permanent centered `max-w-content` with the two-column grid. Preserve one gutter, column gap tokens, and rail sticky behavior.
- [ ] Set `--layout-companion-width: 300px`; retain existing sidebar token unless nav rendering demands otherwise.
- [ ] Re-run the focused test green.
- [ ] Commit: `git add app/[locale]/(protected)/(app)/layout.tsx components/layout/app-nav.tsx components/layout/two-column-shell.tsx components/layout/two-column-shell.test.tsx app/globals.css && git commit -m "fix(layout): keep desktop Hub rail fluid"`.

## Task 3 — Render all Hub regions with truthful empty interiors

**Files:** create `components/shadowing/hub-empty-state.tsx`, `components/shadowing/hub-empty-state.test.tsx`; modify `hub-featured-hero.tsx`, `hub-featured-hero.test.tsx`, `hub-library-section.tsx`, `hub-library-section.test.tsx`, `hub-shelves.tsx`, `hub-shelves.test.tsx`, `hub-companion-rail.tsx`, `hub-companion-rail.test.tsx`, `app/[locale]/(protected)/(app)/shadowing/page.tsx`, both shadowing catalogs, and `docs/design/screens/screen-shadowing-hub.md`.

- [ ] Write failing component cases against an empty Hub model. Assert the eight named Hub regions remain in order, the four companion headings remain, My Lessons has a genuine `#hub-import` link, and other empty regions have no invented action.
- [ ] Run `npm exec vitest -- run components/shadowing/hub-empty-state.test.tsx components/shadowing/hub-featured-hero.test.tsx components/shadowing/hub-library-section.test.tsx components/shadowing/hub-shelves.test.tsx components/shadowing/hub-companion-rail.test.tsx`; confirm the conditional region code fails.
- [ ] Add/move labels into matching `hub.sections`, `hub.empty`, and `hub.rail` branches in both catalogs before assertions pin literal catalog content.
- [ ] Implement `HubEmptyState` as a labelled informative interior with title, body, and an optional parent-provided action slot only.
- [ ] Make Featured accept nullable data and render its named section in both states. Remove My Lessons' early return; give Import `id="hub-import"`; use its fragment action only for no-data My Lessons.
- [ ] Replace conditional shelf-array construction with four unconditional labelled sections: Popular, Continue learning, Recently added, Recommended. Each uses cards only for actual records, otherwise its corresponding empty interior.
- [ ] Keep all four rail cards regardless of data and use `hub.rail` no-data text without projections or metrics. Make the page the only translation boundary, passing typed labels into children.
- [ ] Update the screen document: desktop starts at 1024px, rail is always 300px, regions stay visible with empty interiors, and mobile is the app handoff. Remove claims of 340px, `xl` reveal, omitted shelves, and 390px Hub web UI.
- [ ] Re-run the focused suite green.
- [ ] Commit: `git add components/shadowing app/[locale]/(protected)/(app)/shadowing/page.tsx messages/en/shadowing.json messages/vi/shadowing.json docs/design/screens/screen-shadowing-hub.md && git commit -m "feat(shadowing): preserve Hub regions without data"`.

## Task 4 — Enforce copy contract and browser behavior

**Files:** create `messages/shadowing-copy-contract.test.ts`; modify `tests/e2e/shadowing-hub.spec.ts`, `docs/superpowers/run-state/shadowing-hub-plan-c2.md`.

- [ ] Write a failing JSON contract test. Recursively collect leaves under exactly `hub` and `mobileHandoff`; assert the two roots count is 2, EN and VI each yield non-empty collections, sorted paths match, and each matching leaf has identical ICU placeholder sets. Do not pin human wording.
- [ ] Add locale-provider render coverage for EN and VI that reaches a Hub section and empty message via locale-derived props.
- [ ] Run `npm exec vitest -- run messages/shadowing-copy-contract.test.ts`; confirm red, then implement helpers and make it green.
- [ ] At 1023px, Playwright must see only handoff links using the canonical URL constants and no web nav/main landmark. At exactly 1024px, authenticate a fresh learner and assert main, rail, eight Hub regions, and four rail cards are visible.
- [ ] Measure bounding boxes before/after the nav toggle: rail remains visible and approximately 300px, main width grows on collapse, and `document.documentElement.scrollWidth <= document.documentElement.clientWidth` in both states. Retain keyboard/focus and reduced-motion cases, replacing any non-empty-card assumption with fixed-region assertions.
- [ ] Update C2 run-state with the plan, implementation commits, commands, and evidence; do not mark it merge-ready yet.
- [ ] Commit: `git add messages/shadowing-copy-contract.test.ts tests/e2e/shadowing-hub.spec.ts docs/superpowers/run-state/shadowing-hub-plan-c2.md && git commit -m "test(shadowing): cover desktop Hub empty states"`.

## Task 5 — Verify, inspect, and review the whole branch

**Files:** modify evidence/docs only when earned: `docs/superpowers/run-state/shadowing-hub-plan-c2.md`, and an in-place applicable entry in `docs/lessons.md`; implementation files only for failures found by verification.

- [ ] Run the focused suite: `npm exec vitest -- run components/layout/mobile-app-handoff.test.tsx components/layout/two-column-shell.test.tsx components/shadowing/hub-empty-state.test.tsx components/shadowing/hub-featured-hero.test.tsx components/shadowing/hub-library-section.test.tsx components/shadowing/hub-shelves.test.tsx components/shadowing/hub-companion-rail.test.tsx messages/shadowing-copy-contract.test.ts lib/data/shadowing-hub.test.ts`.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm run build`, and `npm exec playwright -- test tests/e2e/shadowing-hub.spec.ts`; record output and resolve branch-caused failures.
- [ ] Visually inspect 1023px, 1024px, 1280px, and the Figma reference width of 1536px. Confirm handoff exclusivity, no overflow in either nav state, 300px rail, all authored regions, and honest no-data content.
- [ ] Run `source-command-review-changes` over the entire branch after all code is present; address findings or record evidence that they do not apply.
- [ ] Re-read `docs/lessons.md`, make only an in-place applicable update, update run-state with all evidence and readiness, then run `git diff --check` and inspect `git status --short`.
- [ ] Commit evidence-only docs if changed: `git add docs/superpowers/run-state/shadowing-hub-plan-c2.md docs/lessons.md && git commit -m "docs(shadowing): record Hub repair verification"`.

## Completion Criteria

- Mobile widths expose only the accessible app-download handoff with valid store links.
- Desktop widths keep main and a 300px rail side by side; nav collapse expands main without overflow.
- A new learner sees all authored sections and four rail cards, with truthful no-data interiors.
- EN and VI copy structures/ICU contracts agree and both variants render.
- Tests, typecheck, lint, build, targeted browser test, visual inspection, and whole-branch review have recorded passing evidence.
