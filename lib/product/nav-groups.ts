import { deriveNavGroups, type NavGroup } from "./nav-derivation";
import { SCREEN_REGISTRY } from "./screen-registry";

/**
 * The sidebar's data, derived once from the screen registry (R4).
 *
 * ⛔ **Server-only by convention — do not import this from a `"use client"`
 * module.** It lives here rather than in `components/layout/app-nav.tsx`
 * because that file is a client component, and importing `SCREEN_REGISTRY`
 * there shipped the whole registry to the browser: ~18 KB of Figma node ids
 * from a private design file, the names of every unshipped screen, and
 * internal survey fields (`repoOnlyReason`, `figmaCheckedAt`). None of that
 * is the learner's business, and none of it reached the client before the
 * registry existed (final whole-branch review FIX 3).
 *
 * The two server layouts that mount `AppNav`
 * (`app/[locale]/(protected)/(app)` and `…/(focus)`) import this and pass the
 * result down as a prop, so only the 14 `{ href, key }` pairs the sidebar
 * actually renders cross the boundary — 4 `learn` · 3 `practice` ·
 * 3 `remember` · 2 `journey` · 2 `account`, pinned per group by
 * `components/layout/app-nav.test.tsx`'s `expectedCounts`. (It read **22**
 * until 2026-08-14. 22 was true at Phase 1a — `learn 8 · study 6 · insights 3 ·
 * progress 3 · account 2` — and Phase 1b's LOCKED IA replaced those groups
 * wholesale. The data moved, the prose beside it did not. `docs/lessons.md`
 * L-002.)
 *
 * Phase 1a proved this derivation reproduces the previous hand-written literal
 * byte-for-byte (T6 vs `lib/product/nav-baseline.fixture.ts`). Changing
 * navigation means editing the registry, not `app-nav.tsx`.
 */
export const NAV_GROUPS: readonly NavGroup[] = deriveNavGroups(SCREEN_REGISTRY);

/** Flat view kept for the catalog-parity test; no production consumer today. */
export const NAV_ITEMS: readonly NavGroup["items"][number][] = NAV_GROUPS.map(
  (group) => group.items,
).flat();
